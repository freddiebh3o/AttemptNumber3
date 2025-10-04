// admin-web/src/api/products.ts
import { httpRequestJson } from "./http";
import type { paths } from "../types/openapi";

type CreateProductRequestBody = NonNullable<
  paths["/api/products"]["post"]["requestBody"]
>["content"]["application/json"];

type GetProduct200Response =
  paths["/api/products/{productId}"]["get"]["responses"]["200"]["content"]["application/json"];

type CreateProduct201Response =
  paths["/api/products"]["post"]["responses"]["201"]["content"]["application/json"];

type UpdateProductRequestBody = NonNullable<
  paths["/api/products/{productId}"]["put"]["requestBody"]
>["content"]["application/json"];

type UpdateProduct200Response =
  paths["/api/products/{productId}"]["put"]["responses"]["200"]["content"]["application/json"];

type ListProducts200Response =
  paths["/api/products"]["get"]["responses"]["200"]["content"]["application/json"];

type DeleteProduct200Response =
  paths["/api/products/{productId}"]["delete"]["responses"]["200"]["content"]["application/json"];

type GetProductActivity200Response =
  paths["/api/products/{productId}/activity"]["get"]["responses"]["200"]["content"]["application/json"];

export async function getProductApiRequest(params: { productId: string }) {
  return httpRequestJson<GetProduct200Response>(`/api/products/${params.productId}`);
}

export async function listProductsApiRequest(params?: {
  limit?: number;
  cursorId?: string;
  q?: string;                       // search by name or SKU
  minPricePence?: number;
  maxPricePence?: number;
  createdAtFrom?: string;           // YYYY-MM-DD
  createdAtTo?: string;             // YYYY-MM-DD
  updatedAtFrom?: string;           // YYYY-MM-DD
  updatedAtTo?: string;             // YYYY-MM-DD
  sortBy?: "createdAt" | "updatedAt" | "productName" | "productPricePence";
  sortDir?: "asc" | "desc";
  includeTotal?: boolean;
}) {
  const search = new URLSearchParams();
  if (params?.limit !== undefined) search.set("limit", String(params.limit));
  if (params?.cursorId !== undefined) search.set("cursorId", String(params.cursorId));
  if (params?.q) search.set("q", params.q);
  if (params?.minPricePence !== undefined) search.set("minPricePence", String(params.minPricePence));
  if (params?.maxPricePence !== undefined) search.set("maxPricePence", String(params.maxPricePence));
  if (params?.createdAtFrom) search.set("createdAtFrom", params.createdAtFrom);
  if (params?.createdAtTo) search.set("createdAtTo", params.createdAtTo);
  if (params?.updatedAtFrom) search.set("updatedAtFrom", params.updatedAtFrom);
  if (params?.updatedAtTo) search.set("updatedAtTo", params.updatedAtTo);
  if (params?.sortBy) search.set("sortBy", params.sortBy);
  if (params?.sortDir) search.set("sortDir", params.sortDir);
  if (params?.includeTotal) search.set("includeTotal", "1");
  const qs = search.toString();

  return httpRequestJson<ListProducts200Response>(
    `/api/products${qs ? `?${qs}` : ""}`
  );
}

export async function createProductApiRequest(
  params: CreateProductRequestBody & { idempotencyKeyOptional?: string }
) {
  return httpRequestJson<CreateProduct201Response>("/api/products", {
    method: "POST",
    body: JSON.stringify({
      productName: params.productName,
      productSku: params.productSku,
      productPricePence: params.productPricePence,
    }),
    headers: params.idempotencyKeyOptional
      ? { "Idempotency-Key": params.idempotencyKeyOptional }
      : undefined,
  });
}

export async function updateProductApiRequest(
  params: { productId: string } & UpdateProductRequestBody & {
    idempotencyKeyOptional?: string;
  }
) {
  return httpRequestJson<UpdateProduct200Response>(
    `/api/products/${params.productId}`,
    {
      method: "PUT",
      body: JSON.stringify({
        ...(params.productName !== undefined && {
          productName: params.productName,
        }),
        ...(params.productPricePence !== undefined && {
          productPricePence: params.productPricePence,
        }),
        currentEntityVersion: params.currentEntityVersion,
      }),
      headers: params.idempotencyKeyOptional
        ? { "Idempotency-Key": params.idempotencyKeyOptional }
        : undefined,
    }
  );
}

export async function deleteProductApiRequest(params: {
  productId: string;
  idempotencyKeyOptional?: string;
}) {
  return httpRequestJson<DeleteProduct200Response>(
    `/api/products/${params.productId}`,
    {
      method: "DELETE",
      headers: params.idempotencyKeyOptional
        ? { "Idempotency-Key": params.idempotencyKeyOptional }
        : undefined,
    }
  );
}

export async function getProductActivityApiRequest(params: {
  productId: string;
  limit?: number;
  cursor?: string;
  occurredFrom?: string; // ISO (datetime) or YYYY-MM-DDT00:00:00Z
  occurredTo?: string;   // ISO
  type?: "all" | "audit" | "ledger";
  actorIds?: string[];   // user IDs
  includeFacets?: boolean;
  includeTotal?: boolean;
}) {
  const search = new URLSearchParams();
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.cursor) search.set("cursor", params.cursor);
  if (params.occurredFrom) search.set("occurredFrom", params.occurredFrom);
  if (params.occurredTo) search.set("occurredTo", params.occurredTo);
  if (params.type) search.set("type", params.type);
  if (params.actorIds && params.actorIds.length) search.set("actorIds", params.actorIds.join(","));
  if (params.includeFacets) search.set("includeFacets", "1");
  if (params.includeTotal) search.set("includeTotal", "1");
  
  const qs = search.toString();
  return httpRequestJson<GetProductActivity200Response>(
    `/api/products/${params.productId}/activity${qs ? `?${qs}` : ""}`
  );
}
