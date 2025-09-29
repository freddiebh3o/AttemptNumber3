// api-server/src/services/productService.ts
import { prismaClientInstance } from '../db/prismaClient.js'
import { Errors } from '../utils/httpErrors.js'

type SortField = 'createdAt' | 'updatedAt' | 'productName' | 'productPriceCents'
type SortDir = 'asc' | 'desc'

type ListProductsArgs = {
  currentTenantId: string
  limitOptional?: number
  cursorIdOptional?: string
  // filters
  qOptional?: string
  minPriceCentsOptional?: number
  maxPriceCentsOptional?: number
  createdAtFromOptional?: string // 'YYYY-MM-DD'
  createdAtToOptional?: string   // 'YYYY-MM-DD'
  updatedAtFromOptional?: string // 'YYYY-MM-DD'  // NEW
  updatedAtToOptional?: string   // 'YYYY-MM-DD'  // NEW
  // sort
  sortByOptional?: SortField
  sortDirOptional?: SortDir
  includeTotalOptional?: boolean
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

export async function listProductsForCurrentTenantService(args: ListProductsArgs) {
  const {
    currentTenantId,
    limitOptional,
    cursorIdOptional,
    qOptional,
    minPriceCentsOptional,
    maxPriceCentsOptional,
    createdAtFromOptional,
    createdAtToOptional,
    updatedAtFromOptional,
    updatedAtToOptional,
    sortByOptional,
    sortDirOptional,
    includeTotalOptional,
  } = args

  const limit = Math.min(Math.max(limitOptional ?? 20, 1), 100)
  const sortBy: SortField = sortByOptional ?? 'createdAt'
  const sortDir: SortDir = sortDirOptional ?? 'desc'

  // Build WHERE
  const priceFilter =
    minPriceCentsOptional !== undefined || maxPriceCentsOptional !== undefined
      ? {
          productPriceCents: {
            ...(minPriceCentsOptional !== undefined ? { gte: minPriceCentsOptional } : {}),
            ...(maxPriceCentsOptional !== undefined ? { lte: maxPriceCentsOptional } : {}),
          },
        }
      : {}

  // Dates: inclusive range for whole days. 'YYYY-MM-DD' is treated as UTC in JS Date.
  let createdAtFilter: any = {}
  if (createdAtFromOptional) {
    const from = new Date(createdAtFromOptional)
    if (!isNaN(from.getTime())) {
      createdAtFilter = { ...createdAtFilter, gte: from }
    }
  }
  if (createdAtToOptional) {
    const to = new Date(createdAtToOptional)
    if (!isNaN(to.getTime())) {
      createdAtFilter = { ...createdAtFilter, lt: addDays(to, 1) } // inclusive end
    }
  }
  if (Object.keys(createdAtFilter).length > 0) {
    createdAtFilter = { createdAt: createdAtFilter }
  } else {
    createdAtFilter = {}
  }

  // NEW: updatedAt filter
  let updatedAtFilter: any = {}
  if (updatedAtFromOptional) {
    const from = new Date(updatedAtFromOptional)
    if (!isNaN(from.getTime())) {
      updatedAtFilter = { ...updatedAtFilter, gte: from }
    }
  }
  if (updatedAtToOptional) {
    const to = new Date(updatedAtToOptional)
    if (!isNaN(to.getTime())) {
      updatedAtFilter = { ...updatedAtFilter, lt: addDays(to, 1) } // inclusive end
    }
  }
  if (Object.keys(updatedAtFilter).length > 0) {
    updatedAtFilter = { updatedAt: updatedAtFilter }
  } else {
    updatedAtFilter = {}
  }

  const searchFilter =
    qOptional && qOptional.trim().length > 0
      ? {
          OR: [
            { productName: { contains: qOptional, mode: 'insensitive' } },
            { productSku: { contains: qOptional, mode: 'insensitive' } },
          ],
        }
      : {}

  const where = {
    tenantId: currentTenantId,
    ...priceFilter,
    ...createdAtFilter,
    ...updatedAtFilter, // NEW
    ...searchFilter,
  } as const

  // Deterministic ordering with id as tie-breaker
  const orderBy: any[] = [{ [sortBy]: sortDir }]
  orderBy.push({ id: sortDir })

  const take = limit + 1 // fetch one extra to detect next page

  const findArgs: any = {
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
  }

  if (cursorIdOptional) {
    findArgs.cursor = { id: cursorIdOptional }
    findArgs.skip = 1 // exclude cursor row itself
  }

  const rows = await prismaClientInstance.product.findMany(findArgs)
  const hasNextPage = rows.length > limit
  const items = hasNextPage ? rows.slice(0, limit) : rows
  const nextCursor = hasNextPage ? items[items.length - 1]?.id ?? null : null

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
        ...(qOptional ? { q: qOptional } : {}),
        ...(minPriceCentsOptional !== undefined ? { minPriceCents: minPriceCentsOptional } : {}),
        ...(maxPriceCentsOptional !== undefined ? { maxPriceCents: maxPriceCentsOptional } : {}),
        ...(createdAtFromOptional ? { createdAtFrom: createdAtFromOptional } : {}),
        ...(createdAtToOptional ? { createdAtTo: createdAtToOptional } : {}),
        ...(updatedAtFromOptional ? { updatedAtFrom: updatedAtFromOptional } : {}), // NEW
        ...(updatedAtToOptional ? { updatedAtTo: updatedAtToOptional } : {}),       // NEW
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
 * Optimistic concurrency
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
