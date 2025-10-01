// api-server/src/openapi/paths/products.ts
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { successEnvelope, RESPONSES } from '../components/envelopes.js';
import {
  ZodCreateProductRequestBody,
  ZodListProductsQuery,
  ZodProductsListResponseData,
  ZodProductRecord,
  ZodUpdateProductParams,
  ZodUpdateProductRequestBody,
} from '../schemas/products.js';
import { ZodIdempotencyHeaders } from '../schemas/common.js';
import { z } from 'zod';

export function registerProductPaths(registry: OpenAPIRegistry) {
  // GET /api/products
  registry.registerPath({
    tags: ['Products'],
    method: 'get',
    path: '/api/products',
    security: [{ cookieAuth: [] }],
    request: { query: ZodListProductsQuery },
    responses: {
      200: {
        description: 'List products',
        content: { 'application/json': { schema: successEnvelope(ZodProductsListResponseData) } },
      },
      401: RESPONSES[401],
      500: RESPONSES[500],
    },
  });

  // POST /api/products
  registry.registerPath({
    tags: ['Products'],
    method: 'post',
    path: '/api/products',
    security: [{ cookieAuth: [] }],
    request: {
      headers: ZodIdempotencyHeaders,
      body: { content: { 'application/json': { schema: ZodCreateProductRequestBody } } },
    },
    responses: {
      201: {
        description: 'Created',
        content: { 'application/json': { schema: successEnvelope(z.object({ product: ZodProductRecord })) } },
      },
      400: RESPONSES[400],
      401: RESPONSES[401],
      403: RESPONSES[403],
      409: RESPONSES[409],
      429: RESPONSES[429],
      500: RESPONSES[500],
    },
  });

  // PUT /api/products/{productId}
  registry.registerPath({
    tags: ['Products'],
    method: 'put',
    path: '/api/products/{productId}',
    security: [{ cookieAuth: [] }],
    request: {
      headers: ZodIdempotencyHeaders,
      params: ZodUpdateProductParams,
      body: { content: { 'application/json': { schema: ZodUpdateProductRequestBody } } },
    },
    responses: {
      200: {
        description: 'Updated',
        content: { 'application/json': { schema: successEnvelope(z.object({ product: ZodProductRecord })) } },
      },
      400: RESPONSES[400],
      401: RESPONSES[401],
      403: RESPONSES[403],
      404: RESPONSES[404],
      409: RESPONSES[409],
      429: RESPONSES[429],
      500: RESPONSES[500],
    },
  });

  // DELETE /api/products/{productId}
  registry.registerPath({
    tags: ['Products'],
    method: 'delete',
    path: '/api/products/{productId}',
    security: [{ cookieAuth: [] }],
    request: {
      headers: ZodIdempotencyHeaders,
      params: ZodUpdateProductParams,
    },
    responses: {
      200: {
        description: 'Deleted',
        content: { 'application/json': { schema: successEnvelope(
          z.object({ hasDeletedProduct: z.boolean() })
        ) } },
      },
      401: RESPONSES[401],
      403: RESPONSES[403],
      404: RESPONSES[404],
      429: RESPONSES[429],
      500: RESPONSES[500],
    },
  });
}
