// admin-web/src/api/products.ts
import type { ApiEnvelope, ProductRecord } from './apiTypes'
import { httpRequestJson } from './http'

export async function listProductsApiRequest(params?: { limit?: number; cursorId?: string }) {
  const search = new URLSearchParams()
  if (params?.limit !== undefined) search.set('limit', String(params.limit))
  if (params?.cursorId !== undefined) search.set('cursorId', String(params.cursorId))
  const qs = search.toString()
  return httpRequestJson<ApiEnvelope<{ products: ProductRecord[] }>>(`/api/products${qs ? `?${qs}` : ''}`)
}

export async function createProductApiRequest(params: {
  productName: string
  productSku: string
  productPriceCents: number
  idempotencyKeyOptional?: string
}) {
  return httpRequestJson<ApiEnvelope<{ product: ProductRecord }>>('/api/products', {
    method: 'POST',
    body: JSON.stringify({
      productName: params.productName,
      productSku: params.productSku,
      productPriceCents: params.productPriceCents,
    }),
    headers: params.idempotencyKeyOptional
      ? { 'Idempotency-Key': params.idempotencyKeyOptional }
      : undefined,
  })
}

export async function updateProductApiRequest(params: {
  productId: string
  productNameOptional?: string
  productPriceCentsOptional?: number
  currentEntityVersion: number
  idempotencyKeyOptional?: string
}) {
  return httpRequestJson<ApiEnvelope<{ product: ProductRecord }>>(`/api/products/${params.productId}`, {
    method: 'PUT',
    body: JSON.stringify({
      ...(params.productNameOptional !== undefined && { productName: params.productNameOptional }),
      ...(params.productPriceCentsOptional !== undefined && {
        productPriceCents: params.productPriceCentsOptional,
      }),
      currentEntityVersion: params.currentEntityVersion,
    }),
    headers: params.idempotencyKeyOptional
      ? { 'Idempotency-Key': params.idempotencyKeyOptional }
      : undefined,
  })
}

export async function deleteProductApiRequest(params: { productId: string; idempotencyKeyOptional?: string }) {
  return httpRequestJson<ApiEnvelope<{ hasDeletedProduct: boolean }>>(`/api/products/${params.productId}`, {
    method: 'DELETE',
    headers: params.idempotencyKeyOptional
      ? { 'Idempotency-Key': params.idempotencyKeyOptional }
      : undefined,
  })
}
