// admin-web/src/api/apiTypes.ts
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

// ----- RBAC types -----
export type PermissionKey =
  | 'products:read'
  | 'products:write'
  | 'users:manage'
  | 'roles:manage'
  | 'tenant:manage'
  | 'theme:manage'
  | 'uploads:write'

export type RoleBrief = {
  id: string
  name: string // free-form (e.g. "OWNER", "ADMIN", or custom)
}

export type MeResponseData = {
  user: {
    id: string
    userEmailAddress: string
  }
  tenantMemberships: Array<{
    tenantSlug: string
    role: RoleBrief
  }>
  currentTenant: {
    tenantId: string
    tenantSlug: string
    role: RoleBrief
  } | null
  permissionsCurrentTenant: PermissionKey[]
}

// ----- Products -----
export type ProductRecord = {
  id: string
  tenantId: string
  productName: string
  productSku: string
  productPriceCents: number
  entityVersion: number
  createdAt: string
  updatedAt: string
}
