// admin-web/src/api/products.ts
import { httpRequestJson } from "./http";
import type { paths } from "../types/openapi"; // ← generated

// Request/Response types from OpenAPI (note the NonNullable around requestBody)
type CreateProductRequestBody = NonNullable<
  paths["/api/products"]["post"]["requestBody"]
>["content"]["application/json"];

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

export async function listProductsApiRequest(params?: {
  limit?: number;
  cursorId?: string;
}) {
  const search = new URLSearchParams();
  if (params?.limit !== undefined) search.set("limit", String(params.limit));
  if (params?.cursorId !== undefined)
    search.set("cursorId", String(params.cursorId));
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
      productPriceCents: params.productPriceCents,
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
        ...(params.productPriceCents !== undefined && {
          productPriceCents: params.productPriceCents,
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
