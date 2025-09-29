// api-server/src/services/productService.ts
import { prismaClientInstance } from '../db/prismaClient.js'
import { Errors } from '../utils/httpErrors.js'
import type { Prisma } from '@prisma/client';

type ListProductsArgs = {
  currentTenantId: string
  limitOptional?: number
  cursorIdOptional?: string
  minPriceCentsOptional?: number
  sortByOptional?: 'createdAt' | 'productName' | 'productPriceCents'
  sortDirOptional?: 'asc' | 'desc'
  includeTotalOptional?: boolean
}

export async function listProductsForCurrentTenantService(args: ListProductsArgs) {
  const {
    currentTenantId,
    limitOptional,
    cursorIdOptional,
    minPriceCentsOptional,
    sortByOptional,
    sortDirOptional,
    includeTotalOptional,
  } = args

  const limit = Math.min(Math.max(limitOptional ?? 20, 1), 100)
  const sortBy = sortByOptional ?? 'createdAt'
  const sortDir = sortDirOptional ?? 'desc'

  const where = {
    tenantId: currentTenantId,
    ...(minPriceCentsOptional !== undefined && {
      productPriceCents: { gte: minPriceCentsOptional },
    }),
  } as const

  // Deterministic ordering with id as tie-breaker
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = [
    { [sortBy]: sortDir } as Prisma.ProductOrderByWithRelationInput,
    { id: sortDir },
  ];
  

const take = limit + 1 // fetch one extra to detect next page

  const findArgs: Prisma.ProductFindManyArgs = {
    where,
    orderBy,
    take,
    select: {
      id: true,
      tenantId: true,
      productName: true,
      productSku: true,
      productPriceCents: true,
      entityVersion: true,
      updatedAt: true,
      createdAt: true,
    },
    ...(cursorIdOptional && { cursor: { id: cursorIdOptional }, skip: 1 }),
  };

  if (cursorIdOptional) {
    findArgs.cursor = { id: cursorIdOptional }
    findArgs.skip = 1 // exclude cursor row itself
  }

  const rows = await prismaClientInstance.product.findMany(findArgs)
  const hasNextPage = rows.length > limit
  const items = hasNextPage ? rows.slice(0, limit) : rows
  const nextCursor = hasNextPage ? items[items.length - 1]!.id : null

  let totalCount: number | undefined
  if (includeTotalOptional) {
    totalCount = await prismaClientInstance.product.count({ where })
  }

  return {
    items,
    pageInfo: {
      hasNextPage,
      nextCursor,
      ...(totalCount !== undefined && { totalCount }),
    },
    applied: {
      limit,
      sort: { field: sortBy, direction: sortDir },
      filters: {
        ...(minPriceCentsOptional !== undefined && {
          minPriceCents: minPriceCentsOptional,
        }),
      },
    },
  }
}

export async function createProductForCurrentTenantService(params: {
  currentTenantId: string
  productNameInputValue: string
  productSkuInputValue: string
  productPriceCentsInputValue: number
}) {
  const { currentTenantId, productNameInputValue, productSkuInputValue, productPriceCentsInputValue } = params
  try {
    const created = await prismaClientInstance.product.create({
      data: {
        tenantId: currentTenantId,
        productName: productNameInputValue,
        productSku: productSkuInputValue,
        productPriceCents: productPriceCentsInputValue,
      },
      select: { id: true, productName: true, productSku: true, productPriceCents: true, entityVersion: true, updatedAt: true, createdAt: true },
    })
    return created
  } catch (error: any) {
    // Unique SKU per tenant
    if (error?.code === 'P2002') {
      throw Errors.conflict('A product with this SKU already exists for this tenant.')
    }
    throw error
  }
}

/**
 * Optimistic concurrency: updateMany with (id, tenantId, entityVersion) where clause.
 * If count === 0, version mismatch or not found -> 409.
 */
export async function updateProductForCurrentTenantService(params: {
  currentTenantId: string
  productIdPathParam: string
  productNameInputValue?: string
  productPriceCentsInputValue?: number
  currentEntityVersionInputValue: number
}) {
  const {
    currentTenantId,
    productIdPathParam,
    productNameInputValue,
    productPriceCentsInputValue,
    currentEntityVersionInputValue,
  } = params

  const updateResult = await prismaClientInstance.product.updateMany({
    where: {
      id: productIdPathParam,
      tenantId: currentTenantId,
      entityVersion: currentEntityVersionInputValue,
    },
    data: {
      ...(productNameInputValue !== undefined ? { productName: productNameInputValue } : {}),
      ...(productPriceCentsInputValue !== undefined ? { productPriceCents: productPriceCentsInputValue } : {}),
      entityVersion: { increment: 1 },
    },
  })

  if (updateResult.count === 0) {
    throw Errors.conflict('The product was modified by someone else. Please reload and try again.')
  }

  // Return the fresh row
  const updated = await prismaClientInstance.product.findFirst({
    where: { id: productIdPathParam, tenantId: currentTenantId },
    select: { id: true, productName: true, productSku: true, productPriceCents: true, entityVersion: true, updatedAt: true, createdAt: true },
  })
  if (!updated) throw Errors.notFound('Product not found.')
  return updated
}

export async function deleteProductForCurrentTenantService(params: {
  currentTenantId: string
  productIdPathParam: string
}) {
  const { currentTenantId, productIdPathParam } = params
  const deleteResult = await prismaClientInstance.product.deleteMany({
    where: { id: productIdPathParam, tenantId: currentTenantId },
  })
  if (deleteResult.count === 0) throw Errors.notFound('Product not found.')
  return { hasDeletedProduct: true }
}
