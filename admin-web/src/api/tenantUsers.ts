// admin-web/src/api/tenantUsers.ts
import { httpRequestJson } from "./http";
import type { paths } from "../types/openapi";

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

type GetUser200 =
  paths["/api/tenant-users/{userId}"]["get"]["responses"]["200"]["content"]["application/json"];

// ---- NEW: activity types ----
type GetTenantUserActivity200 =
  paths["/api/tenant-users/{userId}/activity"]["get"]["responses"]["200"]["content"]["application/json"];

export async function listTenantUsersApiRequest(params?: {
  limit?: number;
  cursorId?: string;
  q?: string;
  roleId?: string;
  roleName?: string;
  createdAtFrom?: string;
  createdAtTo?: string;
  updatedAtFrom?: string;
  updatedAtTo?: string;
  sortBy?: "createdAt" | "updatedAt" | "userEmailAddress" | "role";
  sortDir?: "asc" | "desc";
  includeTotal?: boolean;
}) {
  const search = new URLSearchParams();
  if (params?.limit !== undefined) search.set("limit", String(params.limit));
  if (params?.cursorId) search.set("cursorId", params.cursorId);
  if (params?.q) search.set("q", params.q);
  if (params?.roleId) search.set("roleId", params.roleId);
  if (params?.roleName) search.set("roleName", params.roleName);
  if (params?.createdAtFrom) search.set("createdAtFrom", params.createdAtFrom);
  if (params?.createdAtTo) search.set("createdAtTo", params.createdAtTo);
  if (params?.updatedAtFrom) search.set("updatedAtFrom", params.updatedAtFrom);
  if (params?.updatedAtTo) search.set("updatedAtTo", params.updatedAtTo);
  if (params?.sortBy) search.set("sortBy", params.sortBy);
  if (params?.sortDir) search.set("sortDir", params.sortDir);
  if (params?.includeTotal) search.set("includeTotal", "1");

  const qs = search.toString();
  return httpRequestJson<ListUsers200>(`/api/tenant-users${qs ? `?${qs}` : ""}`);
}

export async function getTenantUserApiRequest(params: { userId: string }) {
  return httpRequestJson<GetUser200>(`/api/tenant-users/${params.userId}`);
}

export async function createTenantUserApiRequest(
  params: CreateUserBody & { idempotencyKeyOptional?: string }
) {
  const { idempotencyKeyOptional, ...body } = params;
  return httpRequestJson<CreateUser201>("/api/tenant-users", {
    method: "POST",
    body: JSON.stringify(body),
    headers: idempotencyKeyOptional
      ? { "Idempotency-Key": idempotencyKeyOptional }
      : undefined,
  });
}

export async function updateTenantUserApiRequest(
  params: { userId: string } & UpdateUserBody & { idempotencyKeyOptional?: string }
) {
  const { userId, idempotencyKeyOptional, ...body } = params;
  return httpRequestJson<UpdateUser200>(`/api/tenant-users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: idempotencyKeyOptional
      ? { "Idempotency-Key": idempotencyKeyOptional }
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

// ---- NEW: get user activity (cursor-paged, filtered) ----
export async function getTenantUserActivityApiRequest(args: {
  userId: string;

  limit?: number;
  cursor?: string | null;

  actorIds?: string[];
  occurredFrom?: string | null; // ISO or YYYY-MM-DD
  occurredTo?: string | null;   // ISO or YYYY-MM-DD

  includeFacets?: boolean;
  includeTotal?: boolean;
}) {
  const {
    userId,
    limit = 20,
    cursor,
    actorIds,
    occurredFrom,
    occurredTo,
    includeFacets,
    includeTotal,
  } = args;

  const qs = new URLSearchParams();
  if (limit !== undefined) qs.set("limit", String(limit));
  if (cursor) qs.set("cursor", cursor);
  if (actorIds?.length) qs.set("actorIds", actorIds.join(","));
  if (occurredFrom) qs.set("occurredFrom", occurredFrom);
  if (occurredTo) qs.set("occurredTo", occurredTo);
  if (includeFacets) qs.set("includeFacets", "1");
  if (includeTotal) qs.set("includeTotal", "1");

  const q = qs.toString();
  return httpRequestJson<GetTenantUserActivity200>(
    `/api/tenant-users/${userId}/activity${q ? `?${q}` : ""}`
  );
}
