// admin-web/src/api/stock.ts
import { httpRequestJson } from "./http";
import type { paths } from "../types/openapi";

type ReceiveReq = NonNullable<paths["/api/stock/receive"]["post"]["requestBody"]>["content"]["application/json"];
type ReceiveRes = paths["/api/stock/receive"]["post"]["responses"]["201"]["content"]["application/json"];

type AdjustReq = NonNullable<paths["/api/stock/adjust"]["post"]["requestBody"]>["content"]["application/json"];
type AdjustRes = paths["/api/stock/adjust"]["post"]["responses"]["200"]["content"]["application/json"];

type ConsumeReq = NonNullable<paths["/api/stock/consume"]["post"]["requestBody"]>["content"]["application/json"];
type ConsumeRes = paths["/api/stock/consume"]["post"]["responses"]["200"]["content"]["application/json"];

type LevelsQuery = NonNullable<paths["/api/stock/levels"]["get"]["parameters"]["query"]>;
type LevelsRes = paths["/api/stock/levels"]["get"]["responses"]["200"]["content"]["application/json"];
type ListLedger200 = paths["/api/stock/ledger"]["get"]["responses"]["200"]["content"]["application/json"];
type BulkLevels200 = paths["/api/stock/levels/bulk"]["get"]["responses"]["200"]["content"]["application/json"];

export async function receiveStockApiRequest(
  body: ReceiveReq & { idempotencyKeyOptional?: string }
) {
  return httpRequestJson<ReceiveRes>("/api/stock/receive", {
    method: "POST",
    body: JSON.stringify(body),
    headers: body.idempotencyKeyOptional
      ? { "Idempotency-Key": body.idempotencyKeyOptional }
      : undefined,
  });
}

export async function adjustStockApiRequest(
  body: AdjustReq & { idempotencyKeyOptional?: string }
) {
  return httpRequestJson<AdjustRes>("/api/stock/adjust", {
    method: "POST",
    body: JSON.stringify(body),
    headers: body.idempotencyKeyOptional
      ? { "Idempotency-Key": body.idempotencyKeyOptional }
      : undefined,
  });
}

export async function consumeStockApiRequest(
  body: ConsumeReq & { idempotencyKeyOptional?: string }
) {
  return httpRequestJson<ConsumeRes>("/api/stock/consume", {
    method: "POST",
    body: JSON.stringify(body),
    headers: body.idempotencyKeyOptional
      ? { "Idempotency-Key": body.idempotencyKeyOptional }
      : undefined,
  });
}

export async function getStockLevelsApiRequest(query: LevelsQuery) {
  const params = new URLSearchParams();
  params.set("branchId", query.branchId);
  params.set("productId", query.productId);
  return httpRequestJson<LevelsRes>(`/api/stock/levels?${params.toString()}`);
}

export async function listStockLedgerApiRequest(params: {
  productId: string;
  branchId?: string;
  limit?: number;
  cursorId?: string;
  sortDir?: "asc" | "desc";
  occurredFrom?: string;   // ISO
  occurredTo?: string;     // ISO
  kinds?: Array<"RECEIPT" | "ADJUSTMENT" | "CONSUMPTION" | "REVERSAL">;
  minQty?: number;
  maxQty?: number;
}) {
  const qs = new URLSearchParams();
  qs.set("productId", params.productId);
  if (params.branchId) qs.set("branchId", params.branchId);
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.cursorId) qs.set("cursorId", params.cursorId);
  if (params.sortDir) qs.set("sortDir", params.sortDir);
  if (params.occurredFrom) qs.set("occurredFrom", params.occurredFrom);
  if (params.occurredTo) qs.set("occurredTo", params.occurredTo);
  if (params.kinds && params.kinds.length) qs.set("kinds", params.kinds.join(","));
  if (typeof params.minQty === "number") qs.set("minQty", String(params.minQty));
  if (typeof params.maxQty === "number") qs.set("maxQty", String(params.maxQty));

  return httpRequestJson<ListLedger200>(`/api/stock/ledger?${qs.toString()}`);
}

export async function getStockLevelsBulkApiRequest(params: { productId: string }) {
  const qs = new URLSearchParams();
  qs.set("productId", params.productId);
  return httpRequestJson<BulkLevels200>(`/api/stock/levels/bulk?${qs.toString()}`);
}
