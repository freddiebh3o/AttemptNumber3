// admin-web/src/api/apiTypes.ts
//
// This file contains ONLY generic API envelope types that are not endpoint-specific.
// All endpoint-specific types (ProductRecord, MeResponseData, PermissionKey, etc.)
// should be imported from the auto-generated OpenAPI types at src/types/openapi.d.ts
// via components["schemas"]["TypeName"].
//
// See: https://github.com/drwpow/openapi-typescript for usage patterns.

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
