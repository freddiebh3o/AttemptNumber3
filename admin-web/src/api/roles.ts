// admin-web/src/api/roles.ts
import { httpRequestJson } from "./http";
import type { paths, components } from "../types/openapi";

type ListRoles200 =
  paths["/api/roles"]["get"]["responses"]["200"]["content"]["application/json"];

type CreateRoleBody = NonNullable<
  paths["/api/roles"]["post"]["requestBody"]
>["content"]["application/json"];

type CreateRole201 =
  paths["/api/roles"]["post"]["responses"]["201"]["content"]["application/json"];

type UpdateRoleBody = NonNullable<
  paths["/api/roles/{roleId}"]["put"]["requestBody"]
>["content"]["application/json"];
type UpdateRole200 =
  paths["/api/roles/{roleId}"]["put"]["responses"]["200"]["content"]["application/json"];

type DeleteRole200 =
  paths["/api/roles/{roleId}"]["delete"]["responses"]["200"]["content"]["application/json"];

type ListPermissions200 =
  paths["/api/permissions"]["get"]["responses"]["200"]["content"]["application/json"];

type GetRole200 =
  paths["/api/roles/{roleId}"]["get"]["responses"]["200"]["content"]["application/json"];

type GetRoleActivity200 =
  paths["/api/roles/{roleId}/activity"]["get"]["responses"]["200"]["content"]["application/json"];

export type RoleRecord = components["schemas"]["RoleRecord"];
export type PermissionRecord = components["schemas"]["PermissionRecord"];
export type PermissionKey = components["schemas"]["PermissionKey"];

// Optional: schema types for activity (handy if you want to export them)
export type RoleActivityItem = components["schemas"]["RoleActivityItem"];

export async function listRolesApiRequest(params?: {
  limit?: number;
  cursorId?: string;
  q?: string;
  name?: string;
  isSystem?: boolean;
  createdAtFrom?: string;
  createdAtTo?: string;
  updatedAtFrom?: string;
  updatedAtTo?: string;
  sortBy?: "name" | "createdAt" | "updatedAt" | "isSystem";
  sortDir?: "asc" | "desc";
  includeTotal?: boolean;
  // NEW: permission filters
  permissionKeys?: string[] | PermissionKey[];
  permMatch?: "any" | "all";
}) {
  const search = new URLSearchParams();
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.cursorId) search.set("cursorId", params.cursorId);
  if (params?.q) search.set("q", params.q);
  if (params?.name) search.set("name", params.name);
  if (params?.isSystem != null) search.set("isSystem", String(params.isSystem));
  if (params?.createdAtFrom) search.set("createdAtFrom", params.createdAtFrom);
  if (params?.createdAtTo) search.set("createdAtTo", params.createdAtTo);
  if (params?.updatedAtFrom) search.set("updatedAtFrom", params.updatedAtFrom);
  if (params?.updatedAtTo) search.set("updatedAtTo", params.updatedAtTo);
  if (params?.sortBy) search.set("sortBy", params.sortBy);
  if (params?.sortDir) search.set("sortDir", params.sortDir);
  if (params?.includeTotal) search.set("includeTotal", "1");

  // NEW: permission filters as CSV + match mode
  const keys = params?.permissionKeys ?? [];
  if (Array.isArray(keys) && keys.length > 0) {
    search.set("permissionKeys", keys.join(","));
    if (params?.permMatch) search.set("permMatch", params.permMatch);
  } else if (typeof params?.permissionKeys === "string" && params.permissionKeys) {
    search.set("permissionKeys", String(params.permissionKeys));
    if (params?.permMatch) search.set("permMatch", params.permMatch);
  }

  const qs = search.toString();
  return httpRequestJson<ListRoles200>(`/api/roles${qs ? `?${qs}` : ""}`);
}

export async function listPermissionsApiRequest() {
  return httpRequestJson<ListPermissions200>("/api/permissions", {
    method: "GET",
  });
}

export async function getRoleApiRequest(roleId: string) {
  return httpRequestJson<GetRole200>(`/api/roles/${roleId}`, {
    method: "GET",
  });
}

export async function createRoleApiRequest(
  body: CreateRoleBody,
  idempotencyKey?: string
) {
  return httpRequestJson<CreateRole201>("/api/roles", {
    method: "POST",
    body: JSON.stringify(body),
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  });
}

export async function updateRoleApiRequest(
  roleId: string,
  body: UpdateRoleBody,
  idempotencyKey?: string
) {
  return httpRequestJson<UpdateRole200>(`/api/roles/${roleId}`, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  });
}

export async function deleteRoleApiRequest(
  roleId: string,
  idempotencyKey?: string
) {
  return httpRequestJson<DeleteRole200>(`/api/roles/${roleId}`, {
    method: "DELETE",
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  });
}

export async function getRoleActivityApiRequest(params: {
  roleId: string;
  limit?: number;
  cursor?: string;
  occurredFrom?: string; // ISO
  occurredTo?: string;   // ISO
  actorIds?: string[];   // CSV of user IDs
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
  return httpRequestJson<GetRoleActivity200>(
    `/api/roles/${params.roleId}/activity${qs ? `?${qs}` : ""}`
  );
}
