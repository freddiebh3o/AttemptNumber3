import { prismaClientInstance } from '../db/prismaClient.js'
import { Errors } from '../utils/httpErrors.js'

export async function listProductsForCurrentTenantService(params: {
  currentTenantId: string
  limitOptional?: number
  cursorIdOptional?: string
}) {
  const { currentTenantId, limitOptional = 50, cursorIdOptional } = params

  const whereClause = { tenantId: currentTenantId }
  const takeValue = Math.min(Math.max(limitOptional, 1), 100)

  const products = await prismaClientInstance.product.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    take: takeValue,
    ...(cursorIdOptional ? { skip: 1, cursor: { id: cursorIdOptional } } : {}),
    select: {
      id: true,
      productName: true,
      productSku: true,
      productPriceCents: true,
      entityVersion: true,
      updatedAt: true,
      createdAt: true,
    },
  })

  return products
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
