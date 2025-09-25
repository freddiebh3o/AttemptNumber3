export type StandardSuccessResponse<T> = { success: true; data: T; error: null }
export type StandardError = {
  errorCode: string
  httpStatusCode: number
  userFacingMessage: string
  developerMessage?: string
  correlationId?: string | null
}
export type StandardErrorResponse = { success: false; data: null; error: StandardError }

export type ApiEnvelope<T> = StandardSuccessResponse<T> | StandardErrorResponse

export type MeResponseData = {
  currentUserId: string
  currentTenantId: string
  tenantMemberships: Array<{ tenantSlug: string; roleName: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER' }>
}

export type ProductRecord = {
  id: string
  productName: string
  productSku: string
  productPriceCents: number
  entityVersion: number
  createdAt: string
  updatedAt: string
}
