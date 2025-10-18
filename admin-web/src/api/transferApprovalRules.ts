// admin-web/src/api/transferApprovalRules.ts
import { httpRequestJson } from "./http";
import type { paths } from "../types/openapi";

// OpenAPI-derived types
type TransferApprovalRule = paths["/api/transfer-approval-rules/{ruleId}"]["get"]["responses"]["200"]["content"]["application/json"]["data"];

type CreateRuleRequestBody = NonNullable<
  paths["/api/transfer-approval-rules"]["post"]["requestBody"]
>["content"]["application/json"];

type UpdateRuleRequestBody = NonNullable<
  paths["/api/transfer-approval-rules/{ruleId}"]["patch"]["requestBody"]
>["content"]["application/json"];

type CreateRule200Response =
  paths["/api/transfer-approval-rules"]["post"]["responses"]["200"]["content"]["application/json"];

type ListRules200Response =
  paths["/api/transfer-approval-rules"]["get"]["responses"]["200"]["content"]["application/json"];

type GetRule200Response =
  paths["/api/transfer-approval-rules/{ruleId}"]["get"]["responses"]["200"]["content"]["application/json"];

type DeleteRule200Response =
  paths["/api/transfer-approval-rules/{ruleId}"]["delete"]["responses"]["200"]["content"]["application/json"];

type UpdateRule200Response =
  paths["/api/transfer-approval-rules/{ruleId}"]["patch"]["responses"]["200"]["content"]["application/json"];

// Export the TransferApprovalRule type for use in components
export type { TransferApprovalRule };

// List approval rules (GET /api/transfer-approval-rules)
export async function listApprovalRulesApiRequest(params?: {
  isActive?: boolean;
  archivedFilter?: "active-only" | "archived-only" | "all";
  sortBy?: "priority" | "name" | "createdAt";
  sortDir?: "asc" | "desc";
  limit?: number;
  cursor?: string;
}) {
  const search = new URLSearchParams();
  if (params?.isActive !== undefined) search.set("isActive", String(params.isActive));
  if (params?.archivedFilter) search.set("archivedFilter", params.archivedFilter);
  if (params?.sortBy) search.set("sortBy", params.sortBy);
  if (params?.sortDir) search.set("sortDir", params.sortDir);
  if (params?.limit !== undefined) search.set("limit", String(params.limit));
  if (params?.cursor) search.set("cursor", params.cursor);

  const qs = search.toString();

  return httpRequestJson<ListRules200Response>(
    `/api/transfer-approval-rules${qs ? `?${qs}` : ""}`
  );
}

// Get rule details (GET /api/transfer-approval-rules/{ruleId})
export async function getApprovalRuleApiRequest(ruleId: string) {
  return httpRequestJson<GetRule200Response>(
    `/api/transfer-approval-rules/${ruleId}`
  );
}

// Create approval rule (POST /api/transfer-approval-rules)
export async function createApprovalRuleApiRequest(
  params: CreateRuleRequestBody & { idempotencyKeyOptional?: string }
) {
  const { idempotencyKeyOptional, ...body } = params;
  return httpRequestJson<CreateRule200Response>("/api/transfer-approval-rules", {
    method: "POST",
    body: JSON.stringify(body),
    headers: idempotencyKeyOptional
      ? { "Idempotency-Key": idempotencyKeyOptional }
      : undefined,
  });
}

// Update approval rule (PATCH /api/transfer-approval-rules/{ruleId})
export async function updateApprovalRuleApiRequest(
  ruleId: string,
  params: UpdateRuleRequestBody & { idempotencyKeyOptional?: string }
) {
  const { idempotencyKeyOptional, ...body } = params;
  return httpRequestJson<UpdateRule200Response>(
    `/api/transfer-approval-rules/${ruleId}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: idempotencyKeyOptional
        ? { "Idempotency-Key": idempotencyKeyOptional }
        : undefined,
    }
  );
}

// Delete approval rule (DELETE /api/transfer-approval-rules/{ruleId})
// Note: This actually archives the rule (soft delete)
export async function deleteApprovalRuleApiRequest(
  ruleId: string,
  idempotencyKeyOptional?: string
) {
  return httpRequestJson<DeleteRule200Response>(
    `/api/transfer-approval-rules/${ruleId}`,
    {
      method: "DELETE",
      headers: idempotencyKeyOptional
        ? { "Idempotency-Key": idempotencyKeyOptional }
        : undefined,
    }
  );
}

type RestoreRule200Response =
  paths["/api/transfer-approval-rules/{ruleId}/restore"]["post"]["responses"]["200"]["content"]["application/json"];

// Restore archived approval rule (POST /api/transfer-approval-rules/{ruleId}/restore)
export async function restoreApprovalRuleApiRequest(
  ruleId: string,
  idempotencyKeyOptional?: string
) {
  return httpRequestJson<RestoreRule200Response>(
    `/api/transfer-approval-rules/${ruleId}/restore`,
    {
      method: "POST",
      headers: idempotencyKeyOptional
        ? { "Idempotency-Key": idempotencyKeyOptional }
        : undefined,
    }
  );
}
