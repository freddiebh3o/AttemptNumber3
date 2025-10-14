// admin-web/src/api/stockTransfers.ts
import { httpRequestJson } from "./http";
import type { paths } from "../types/openapi";

// OpenAPI-derived types
type StockTransfer = paths["/api/stock-transfers/{transferId}"]["get"]["responses"]["200"]["content"]["application/json"]["data"];

type CreateTransferRequestBody = NonNullable<
  paths["/api/stock-transfers"]["post"]["requestBody"]
>["content"]["application/json"];

type CreateTransfer200Response =
  paths["/api/stock-transfers"]["post"]["responses"]["200"]["content"]["application/json"];

type ListTransfers200Response =
  paths["/api/stock-transfers"]["get"]["responses"]["200"]["content"]["application/json"];

type GetTransfer200Response =
  paths["/api/stock-transfers/{transferId}"]["get"]["responses"]["200"]["content"]["application/json"];

type ReviewTransferRequestBody = NonNullable<
  paths["/api/stock-transfers/{transferId}/review"]["patch"]["requestBody"]
>["content"]["application/json"];

type ReviewTransfer200Response =
  paths["/api/stock-transfers/{transferId}/review"]["patch"]["responses"]["200"]["content"]["application/json"];

type ReceiveTransferRequestBody = NonNullable<
  paths["/api/stock-transfers/{transferId}/receive"]["post"]["requestBody"]
>["content"]["application/json"];

type ReceiveTransfer200Response =
  paths["/api/stock-transfers/{transferId}/receive"]["post"]["responses"]["200"]["content"]["application/json"];

type ShipTransfer200Response =
  paths["/api/stock-transfers/{transferId}/ship"]["post"]["responses"]["200"]["content"]["application/json"];

type CancelTransfer200Response =
  paths["/api/stock-transfers/{transferId}"]["delete"]["responses"]["200"]["content"]["application/json"];

type ReverseTransferRequestBody = NonNullable<
  paths["/api/stock-transfers/{transferId}/reverse"]["post"]["requestBody"]
>["content"]["application/json"];

type ReverseTransfer200Response =
  paths["/api/stock-transfers/{transferId}/reverse"]["post"]["responses"]["200"]["content"]["application/json"];

type SubmitApprovalRequestBody = NonNullable<
  paths["/api/stock-transfers/{transferId}/approve/{level}"]["post"]["requestBody"]
>["content"]["application/json"];

type SubmitApproval200Response =
  paths["/api/stock-transfers/{transferId}/approve/{level}"]["post"]["responses"]["200"]["content"]["application/json"];

type GetApprovalProgress200Response =
  paths["/api/stock-transfers/{transferId}/approval-progress"]["get"]["responses"]["200"]["content"]["application/json"];

// Export the StockTransfer type for use in components
export type { StockTransfer };

// List stock transfers (GET /api/stock-transfers)
export async function listStockTransfersApiRequest(params?: {
  branchId?: string;
  direction?: "inbound" | "outbound";
  status?: string; // Comma-separated
  q?: string; // Search transfer number
  sortBy?: "requestedAt" | "updatedAt" | "transferNumber" | "status";
  sortDir?: "asc" | "desc";
  requestedAtFrom?: string; // ISO date (YYYY-MM-DD)
  requestedAtTo?: string;
  shippedAtFrom?: string;
  shippedAtTo?: string;
  limit?: number;
  cursor?: string;
  includeTotal?: boolean;
}) {
  const search = new URLSearchParams();
  if (params?.branchId) search.set("branchId", params.branchId);
  if (params?.direction) search.set("direction", params.direction);
  if (params?.status) search.set("status", params.status);
  if (params?.q) search.set("q", params.q);
  if (params?.sortBy) search.set("sortBy", params.sortBy);
  if (params?.sortDir) search.set("sortDir", params.sortDir);
  if (params?.requestedAtFrom) search.set("requestedAtFrom", params.requestedAtFrom);
  if (params?.requestedAtTo) search.set("requestedAtTo", params.requestedAtTo);
  if (params?.shippedAtFrom) search.set("shippedAtFrom", params.shippedAtFrom);
  if (params?.shippedAtTo) search.set("shippedAtTo", params.shippedAtTo);
  if (params?.limit !== undefined) search.set("limit", String(params.limit));
  if (params?.cursor) search.set("cursor", params.cursor);
  if (params?.includeTotal !== undefined) search.set("includeTotal", String(params.includeTotal));

  const qs = search.toString();

  return httpRequestJson<ListTransfers200Response>(
    `/api/stock-transfers${qs ? `?${qs}` : ""}`
  );
}

// Get transfer details (GET /api/stock-transfers/{transferId})
export async function getStockTransferApiRequest(transferId: string) {
  return httpRequestJson<GetTransfer200Response>(
    `/api/stock-transfers/${transferId}`
  );
}

// Create transfer (POST /api/stock-transfers)
export async function createStockTransferApiRequest(
  params: CreateTransferRequestBody & { idempotencyKeyOptional?: string }
) {
  const { idempotencyKeyOptional, ...body } = params;
  return httpRequestJson<CreateTransfer200Response>("/api/stock-transfers", {
    method: "POST",
    body: JSON.stringify(body),
    headers: idempotencyKeyOptional
      ? { "Idempotency-Key": idempotencyKeyOptional }
      : undefined,
  });
}

// Review transfer (PATCH /api/stock-transfers/{transferId}/review)
export async function reviewStockTransferApiRequest(
  transferId: string,
  params: ReviewTransferRequestBody & { idempotencyKeyOptional?: string }
) {
  const { idempotencyKeyOptional, ...body } = params;
  return httpRequestJson<ReviewTransfer200Response>(
    `/api/stock-transfers/${transferId}/review`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: idempotencyKeyOptional
        ? { "Idempotency-Key": idempotencyKeyOptional }
        : undefined,
    }
  );
}

// Ship transfer (POST /api/stock-transfers/{transferId}/ship)
export async function shipStockTransferApiRequest(
  transferId: string,
  idempotencyKeyOptional?: string
) {
  return httpRequestJson<ShipTransfer200Response>(
    `/api/stock-transfers/${transferId}/ship`,
    {
      method: "POST",
      headers: idempotencyKeyOptional
        ? { "Idempotency-Key": idempotencyKeyOptional }
        : undefined,
    }
  );
}

// Receive transfer (POST /api/stock-transfers/{transferId}/receive)
export async function receiveStockTransferApiRequest(
  transferId: string,
  params: ReceiveTransferRequestBody & { idempotencyKeyOptional?: string }
) {
  const { idempotencyKeyOptional, ...body } = params;
  return httpRequestJson<ReceiveTransfer200Response>(
    `/api/stock-transfers/${transferId}/receive`,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: idempotencyKeyOptional
        ? { "Idempotency-Key": idempotencyKeyOptional }
        : undefined,
    }
  );
}

// Cancel transfer (DELETE /api/stock-transfers/{transferId})
export async function cancelStockTransferApiRequest(
  transferId: string,
  idempotencyKeyOptional?: string
) {
  return httpRequestJson<CancelTransfer200Response>(
    `/api/stock-transfers/${transferId}`,
    {
      method: "DELETE",
      headers: idempotencyKeyOptional
        ? { "Idempotency-Key": idempotencyKeyOptional }
        : undefined,
    }
  );
}

// Reverse transfer (POST /api/stock-transfers/{transferId}/reverse)
export async function reverseStockTransferApiRequest(
  transferId: string,
  params: ReverseTransferRequestBody & { idempotencyKeyOptional?: string }
) {
  const { idempotencyKeyOptional, ...body } = params;
  return httpRequestJson<ReverseTransfer200Response>(
    `/api/stock-transfers/${transferId}/reverse`,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: idempotencyKeyOptional
        ? { "Idempotency-Key": idempotencyKeyOptional }
        : undefined,
    }
  );
}

// Submit approval for a level (POST /api/stock-transfers/{transferId}/approve/{level})
export async function submitApprovalApiRequest(
  transferId: string,
  level: number,
  params: SubmitApprovalRequestBody & { idempotencyKeyOptional?: string }
) {
  const { idempotencyKeyOptional, ...body } = params;
  return httpRequestJson<SubmitApproval200Response>(
    `/api/stock-transfers/${transferId}/approve/${level}`,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: idempotencyKeyOptional
        ? { "Idempotency-Key": idempotencyKeyOptional }
        : undefined,
    }
  );
}

// Get approval progress (GET /api/stock-transfers/{transferId}/approval-progress)
export async function getApprovalProgressApiRequest(transferId: string) {
  return httpRequestJson<GetApprovalProgress200Response>(
    `/api/stock-transfers/${transferId}/approval-progress`
  );
}
