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
