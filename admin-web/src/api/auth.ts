import type { ApiEnvelope, MeResponseData } from './apiTypes'
import { httpRequestJson } from './http'

export async function signInApiRequest(params: { email: string; password: string; tenantSlug: string }) {
  return httpRequestJson<ApiEnvelope<{ isSignedIn: boolean }>>('/api/auth/sign-in', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function signOutApiRequest() {
  return httpRequestJson<ApiEnvelope<{ isSignedIn: boolean }>>('/api/auth/sign-out', { method: 'POST' })
}

export async function meApiRequest() {
  return httpRequestJson<ApiEnvelope<MeResponseData>>('/api/auth/me', { method: 'GET' })
}

export async function switchTenantApiRequest(params: { tenantSlug: string }) {
  return httpRequestJson<ApiEnvelope<{ hasSwitchedTenant: boolean }>>('/api/auth/switch-tenant', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}
