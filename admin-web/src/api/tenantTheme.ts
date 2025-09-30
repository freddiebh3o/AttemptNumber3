// admin-web/src/api/tenantTheme.ts
import { httpRequestJson } from "./http";
import type { paths } from "../types/openapi";

type GetTheme200 =
  paths["/api/tenants/{tenantSlug}/theme"]["get"]["responses"]["200"]["content"]["application/json"];

type PutThemeBody = NonNullable<
  paths["/api/tenants/{tenantSlug}/theme"]["put"]["requestBody"]
>["content"]["application/json"];

type PutTheme200 =
  paths["/api/tenants/{tenantSlug}/theme"]["put"]["responses"]["200"]["content"]["application/json"];

export async function getTenantThemeApiRequest(tenantSlug: string) {
  return httpRequestJson<GetTheme200>(`/api/tenants/${tenantSlug}/theme`);
}

export async function putTenantThemeApiRequest(params: {
  tenantSlug: string;
  body: PutThemeBody;
  idempotencyKeyOptional?: string;
}) {
  const { tenantSlug, body, idempotencyKeyOptional } = params;
  return httpRequestJson<PutTheme200>(`/api/tenants/${tenantSlug}/theme`, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: idempotencyKeyOptional
      ? { "Idempotency-Key": idempotencyKeyOptional }
      : undefined,
  });
}
