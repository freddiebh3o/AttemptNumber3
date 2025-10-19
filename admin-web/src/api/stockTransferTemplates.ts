// admin-web/src/api/stockTransferTemplates.ts
import { httpRequestJson } from "./http";
import type { paths } from "../types/openapi";

// OpenAPI-derived types
type StockTransferTemplate = paths["/api/stock-transfer-templates/{templateId}"]["get"]["responses"]["200"]["content"]["application/json"]["data"];

type CreateTemplateRequestBody = NonNullable<
  paths["/api/stock-transfer-templates"]["post"]["requestBody"]
>["content"]["application/json"];

type CreateTemplate200Response =
  paths["/api/stock-transfer-templates"]["post"]["responses"]["200"]["content"]["application/json"];

type ListTemplates200Response =
  paths["/api/stock-transfer-templates"]["get"]["responses"]["200"]["content"]["application/json"];

type GetTemplate200Response =
  paths["/api/stock-transfer-templates/{templateId}"]["get"]["responses"]["200"]["content"]["application/json"];

type DeleteTemplate200Response =
  paths["/api/stock-transfer-templates/{templateId}"]["delete"]["responses"]["200"]["content"]["application/json"];

type DuplicateTemplateRequestBody = NonNullable<
  paths["/api/stock-transfer-templates/{templateId}/duplicate"]["post"]["requestBody"]
>["content"]["application/json"];

type DuplicateTemplate200Response =
  paths["/api/stock-transfer-templates/{templateId}/duplicate"]["post"]["responses"]["200"]["content"]["application/json"];

type UpdateTemplateRequestBody = NonNullable<
  paths["/api/stock-transfer-templates/{templateId}"]["patch"]["requestBody"]
>["content"]["application/json"];

type UpdateTemplate200Response =
  paths["/api/stock-transfer-templates/{templateId}"]["patch"]["responses"]["200"]["content"]["application/json"];

type RestoreTemplate200Response =
  paths["/api/stock-transfer-templates/{templateId}/restore"]["post"]["responses"]["200"]["content"]["application/json"];

// Export the StockTransferTemplate type for use in components
export type { StockTransferTemplate };

// List stock transfer templates (GET /api/stock-transfer-templates)
export async function listTransferTemplatesApiRequest(params?: {
  q?: string;
  sourceBranchId?: string;
  destinationBranchId?: string;
  archivedFilter?: "active-only" | "archived-only" | "all";
  limit?: number;
  cursor?: string;
}) {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.sourceBranchId) search.set("sourceBranchId", params.sourceBranchId);
  if (params?.destinationBranchId) search.set("destinationBranchId", params.destinationBranchId);
  if (params?.archivedFilter) search.set("archivedFilter", params.archivedFilter);
  if (params?.limit !== undefined) search.set("limit", String(params.limit));
  if (params?.cursor) search.set("cursor", params.cursor);

  const qs = search.toString();

  return httpRequestJson<ListTemplates200Response>(
    `/api/stock-transfer-templates${qs ? `?${qs}` : ""}`
  );
}

// Get template details (GET /api/stock-transfer-templates/{templateId})
export async function getTransferTemplateApiRequest(templateId: string) {
  return httpRequestJson<GetTemplate200Response>(
    `/api/stock-transfer-templates/${templateId}`
  );
}

// Create template (POST /api/stock-transfer-templates)
export async function createTransferTemplateApiRequest(
  params: CreateTemplateRequestBody & { idempotencyKeyOptional?: string }
) {
  const { idempotencyKeyOptional, ...body } = params;
  return httpRequestJson<CreateTemplate200Response>("/api/stock-transfer-templates", {
    method: "POST",
    body: JSON.stringify(body),
    headers: idempotencyKeyOptional
      ? { "Idempotency-Key": idempotencyKeyOptional }
      : undefined,
  });
}

// Delete template (DELETE /api/stock-transfer-templates/{templateId})
export async function deleteTransferTemplateApiRequest(
  templateId: string,
  idempotencyKeyOptional?: string
) {
  return httpRequestJson<DeleteTemplate200Response>(
    `/api/stock-transfer-templates/${templateId}`,
    {
      method: "DELETE",
      headers: idempotencyKeyOptional
        ? { "Idempotency-Key": idempotencyKeyOptional }
        : undefined,
    }
  );
}

// Update template (PATCH /api/stock-transfer-templates/{templateId})
export async function updateTransferTemplateApiRequest(
  templateId: string,
  params: UpdateTemplateRequestBody & { idempotencyKeyOptional?: string }
) {
  const { idempotencyKeyOptional, ...body } = params;
  return httpRequestJson<UpdateTemplate200Response>(
    `/api/stock-transfer-templates/${templateId}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: idempotencyKeyOptional
        ? { "Idempotency-Key": idempotencyKeyOptional }
        : undefined,
    }
  );
}

// Duplicate template (POST /api/stock-transfer-templates/{templateId}/duplicate)
export async function duplicateTransferTemplateApiRequest(
  templateId: string,
  params: DuplicateTemplateRequestBody & { idempotencyKeyOptional?: string }
) {
  const { idempotencyKeyOptional, ...body } = params;
  return httpRequestJson<DuplicateTemplate200Response>(
    `/api/stock-transfer-templates/${templateId}/duplicate`,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: idempotencyKeyOptional
        ? { "Idempotency-Key": idempotencyKeyOptional }
        : undefined,
    }
  );
}

// Restore template (POST /api/stock-transfer-templates/{templateId}/restore)
export async function restoreTransferTemplateApiRequest(
  templateId: string,
  idempotencyKeyOptional?: string
) {
  return httpRequestJson<RestoreTemplate200Response>(
    `/api/stock-transfer-templates/${templateId}/restore`,
    {
      method: "POST",
      headers: idempotencyKeyOptional
        ? { "Idempotency-Key": idempotencyKeyOptional }
        : undefined,
    }
  );
}
