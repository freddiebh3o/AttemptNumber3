// admin-web/src/api/tenantUsers.ts
import { httpRequestJson } from "./http";
import type { paths } from "../types/openapi";

// ---- Types from OpenAPI (generated) ----
type ListUsers200 =
  paths["/api/tenant-users"]["get"]["responses"]["200"]["content"]["application/json"];

type CreateUserBody = NonNullable<
  paths["/api/tenant-users"]["post"]["requestBody"]
>["content"]["application/json"];
type CreateUser201 =
  paths["/api/tenant-users"]["post"]["responses"]["201"]["content"]["application/json"];

type UpdateUserBody = NonNullable<
  paths["/api/tenant-users/{userId}"]["put"]["requestBody"]
>["content"]["application/json"];
type UpdateUser200 =
  paths["/api/tenant-users/{userId}"]["put"]["responses"]["200"]["content"]["application/json"];

type DeleteUser200 =
  paths["/api/tenant-users/{userId}"]["delete"]["responses"]["200"]["content"]["application/json"];

export async function listTenantUsersApiRequest(params?: {
  limit?: number;
  cursorId?: string;
}) {
  const search = new URLSearchParams();
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.cursorId) search.set("cursorId", params.cursorId);
  const qs = search.toString();
  return httpRequestJson<ListUsers200>(
    `/api/tenant-users${qs ? `?${qs}` : ""}`
  );
}

export async function createTenantUserApiRequest(
  params: CreateUserBody & { idempotencyKeyOptional?: string }
) {
  return httpRequestJson<CreateUser201>("/api/tenant-users", {
    method: "POST",
    body: JSON.stringify(params),
    headers: params.idempotencyKeyOptional
      ? { "Idempotency-Key": params.idempotencyKeyOptional }
      : undefined,
  });
}

export async function updateTenantUserApiRequest(
  params: { userId: string } & UpdateUserBody & {
      idempotencyKeyOptional?: string;
    }
) {
  return httpRequestJson<UpdateUser200>(`/api/tenant-users/${params.userId}`, {
    method: "PUT",
    body: JSON.stringify(params),
    headers: params.idempotencyKeyOptional
      ? { "Idempotency-Key": params.idempotencyKeyOptional }
      : undefined,
  });
}

export async function deleteTenantUserApiRequest(params: {
  userId: string;
  idempotencyKeyOptional?: string;
}) {
  return httpRequestJson<DeleteUser200>(`/api/tenant-users/${params.userId}`, {
    method: "DELETE",
    headers: params.idempotencyKeyOptional
      ? { "Idempotency-Key": params.idempotencyKeyOptional }
      : undefined,
  });
}
