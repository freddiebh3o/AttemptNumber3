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

type GetThemeActivity200 =
  paths["/api/tenants/{tenantSlug}/theme/activity"]["get"]["responses"]["200"]["content"]["application/json"];

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

export async function getTenantThemeActivityApiRequest(params: {
  tenantSlug: string;
  limit?: number;
  cursor?: string;         // "<ISO>|<id>"
  occurredFrom?: string;   // ISO datetime
  occurredTo?: string;     // ISO datetime
  actorIds?: string[];     // user IDs
  includeFacets?: boolean;
  includeTotal?: boolean;
}) {
  const search = new URLSearchParams();
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.cursor) search.set("cursor", params.cursor);
  if (params.occurredFrom) search.set("occurredFrom", params.occurredFrom);
  if (params.occurredTo) search.set("occurredTo", params.occurredTo);
  if (params.actorIds?.length) search.set("actorIds", params.actorIds.join(","));
  if (params.includeFacets) search.set("includeFacets", "1");
  if (params.includeTotal) search.set("includeTotal", "1");

  const qs = search.toString();
  return httpRequestJson<GetThemeActivity200>(
    `/api/tenants/${params.tenantSlug}/theme/activity${qs ? `?${qs}` : ""}`
  );
}