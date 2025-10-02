// admin-web/src/api/branches.ts
import { httpRequestJson } from "./http";
import type { paths } from "../types/openapi";

// OpenAPI-derived types
type CreateBranchRequestBody = NonNullable<
  paths["/api/branches"]["post"]["requestBody"]
>["content"]["application/json"];

type CreateBranch201Response =
  paths["/api/branches"]["post"]["responses"]["201"]["content"]["application/json"];

type UpdateBranchRequestBody = NonNullable<
  paths["/api/branches/{branchId}"]["put"]["requestBody"]
>["content"]["application/json"];

type UpdateBranch200Response =
  paths["/api/branches/{branchId}"]["put"]["responses"]["200"]["content"]["application/json"];

type ListBranches200Response =
  paths["/api/branches"]["get"]["responses"]["200"]["content"]["application/json"];

type DeleteBranch200Response =
  paths["/api/branches/{branchId}"]["delete"]["responses"]["200"]["content"]["application/json"];

// List (GET /api/branches)
export async function listBranchesApiRequest(params?: {
  limit?: number;
  cursorId?: string;
  q?: string; // name contains
  isActive?: boolean;
  // NOTE: If your backend ignores unknown params, you can keep these.
  // If you want strict OpenAPI conformance, remove them here and in the caller.
  createdAtFrom?: string; // YYYY-MM-DD
  createdAtTo?: string;   // YYYY-MM-DD
  updatedAtFrom?: string; // YYYY-MM-DD
  updatedAtTo?: string;   // YYYY-MM-DD
  sortBy?: "branchName" | "createdAt" | "updatedAt" | "isActive";
  sortDir?: "asc" | "desc";
  includeTotal?: boolean;
}) {
  const search = new URLSearchParams();
  if (params?.limit !== undefined) search.set("limit", String(params.limit));
  if (params?.cursorId !== undefined) search.set("cursorId", String(params.cursorId));
  if (params?.q) search.set("q", params.q);
  if (params?.isActive !== undefined) search.set("isActive", String(params.isActive));

  // Safe to include if backend ignores unknowns (else delete these four lines)
  if (params?.createdAtFrom) search.set("createdAtFrom", params.createdAtFrom);
  if (params?.createdAtTo) search.set("createdAtTo", params.createdAtTo);
  if (params?.updatedAtFrom) search.set("updatedAtFrom", params.updatedAtFrom);
  if (params?.updatedAtTo) search.set("updatedAtTo", params.updatedAtTo);

  if (params?.sortBy) search.set("sortBy", params.sortBy);
  if (params?.sortDir) search.set("sortDir", params.sortDir);
  if (params?.includeTotal) search.set("includeTotal", "1");
  const qs = search.toString();

  return httpRequestJson<ListBranches200Response>(
    `/api/branches${qs ? `?${qs}` : ""}`
  );
}

// Create (POST /api/branches)
export async function createBranchApiRequest(
  params: CreateBranchRequestBody & { idempotencyKeyOptional?: string }
) {
  const { idempotencyKeyOptional, ...body } = params;
  return httpRequestJson<CreateBranch201Response>("/api/branches", {
    method: "POST",
    body: JSON.stringify(body),
    headers: idempotencyKeyOptional
      ? { "Idempotency-Key": idempotencyKeyOptional }
      : undefined,
  });
}

// Update (PUT /api/branches/{branchId})
export async function updateBranchApiRequest(
  params: { branchId: string } & UpdateBranchRequestBody & {
    idempotencyKeyOptional?: string;
  }
) {
  const { branchId, idempotencyKeyOptional, ...body } = params;
  return httpRequestJson<UpdateBranch200Response>(
    `/api/branches/${branchId}`,
    {
      method: "PUT",
      body: JSON.stringify(body),
      headers: idempotencyKeyOptional
        ? { "Idempotency-Key": idempotencyKeyOptional }
        : undefined,
    }
  );
}

// Delete (DELETE /api/branches/{branchId})
export async function deleteBranchApiRequest(params: {
  branchId: string;
  idempotencyKeyOptional?: string;
}) {
  const { branchId, idempotencyKeyOptional } = params;
  return httpRequestJson<DeleteBranch200Response>(
    `/api/branches/${branchId}`,
    {
      method: "DELETE",
      headers: idempotencyKeyOptional
        ? { "Idempotency-Key": idempotencyKeyOptional }
        : undefined,
    }
  );
}
