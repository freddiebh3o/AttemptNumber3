// admin-web/src/api/tenantFeatureFlags.ts
import { httpRequestJson } from "./http";
import type { paths } from "../types/openapi";

type GetFeatureFlags200 =
  paths["/api/tenants/{tenantSlug}/feature-flags"]["get"]["responses"]["200"]["content"]["application/json"];

type PutFeatureFlagsBody = NonNullable<
  paths["/api/tenants/{tenantSlug}/feature-flags"]["put"]["requestBody"]
>["content"]["application/json"];

type PutFeatureFlags200 =
  paths["/api/tenants/{tenantSlug}/feature-flags"]["put"]["responses"]["200"]["content"]["application/json"];

export async function getTenantFeatureFlagsApiRequest(tenantSlug: string) {
  return httpRequestJson<GetFeatureFlags200>(`/api/tenants/${tenantSlug}/feature-flags`);
}

export async function putTenantFeatureFlagsApiRequest(params: {
  tenantSlug: string;
  body: PutFeatureFlagsBody;
  idempotencyKeyOptional?: string;
}) {
  const { tenantSlug, body, idempotencyKeyOptional } = params;
  return httpRequestJson<PutFeatureFlags200>(`/api/tenants/${tenantSlug}/feature-flags`, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: idempotencyKeyOptional
      ? { "Idempotency-Key": idempotencyKeyOptional }
      : undefined,
  });
}
