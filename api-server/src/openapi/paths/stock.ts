// api-server/src/openapi/paths/stock.ts
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { successEnvelope, RESPONSES } from '../components/envelopes.js';
import {
  ZodReceiveStockRequestBody,
  ZodAdjustStockRequestBody,
  ZodConsumeStockRequestBody,
  ZodStockLevelsQuery,
  ZodReceiveStockResponseData,
  ZodAdjustStockResponseData,
  ZodConsumeStockResponseData,
  ZodStockLevelsResponseData,
} from '../schemas/stock.js';

export function registerStockPaths(registry: OpenAPIRegistry) {
  // POST /api/stock/receive
  registry.registerPath({
    tags: ['Stock'],
    method: 'post',
    path: '/api/stock/receive',
    security: [{ cookieAuth: [] }],
    request: { body: { content: { 'application/json': { schema: ZodReceiveStockRequestBody } } } },
    responses: {
      201: {
        description: 'Stock received',
        content: { 'application/json': { schema: successEnvelope(ZodReceiveStockResponseData) } },
      },
      400: RESPONSES[400],
      401: RESPONSES[401],
      403: RESPONSES[403],
      409: RESPONSES[409],
      429: RESPONSES[429],
      500: RESPONSES[500],
    },
  });

  // POST /api/stock/adjust
  registry.registerPath({
    tags: ['Stock'],
    method: 'post',
    path: '/api/stock/adjust',
    security: [{ cookieAuth: [] }],
    request: { body: { content: { 'application/json': { schema: ZodAdjustStockRequestBody } } } },
    responses: {
      200: {
        description: 'Stock adjusted',
        content: { 'application/json': { schema: successEnvelope(ZodAdjustStockResponseData) } },
      },
      400: RESPONSES[400],
      401: RESPONSES[401],
      403: RESPONSES[403],
      409: RESPONSES[409],
      429: RESPONSES[429],
      500: RESPONSES[500],
    },
  });

  // POST /api/stock/consume
  registry.registerPath({
    tags: ['Stock'],
    method: 'post',
    path: '/api/stock/consume',
    security: [{ cookieAuth: [] }],
    request: { body: { content: { 'application/json': { schema: ZodConsumeStockRequestBody } } } },
    responses: {
      200: {
        description: 'Stock consumed (FIFO)',
        content: { 'application/json': { schema: successEnvelope(ZodConsumeStockResponseData) } },
      },
      400: RESPONSES[400],
      401: RESPONSES[401],
      403: RESPONSES[403],
      409: RESPONSES[409],
      429: RESPONSES[429],
      500: RESPONSES[500],
    },
  });

  // GET /api/stock/levels
  registry.registerPath({
    tags: ['Stock'],
    method: 'get',
    path: '/api/stock/levels',
    security: [{ cookieAuth: [] }],
    request: { query: ZodStockLevelsQuery },
    responses: {
      200: {
        description: 'Current stock levels + open FIFO lots',
        content: { 'application/json': { schema: successEnvelope(ZodStockLevelsResponseData) } },
      },
      400: RESPONSES[400],
      401: RESPONSES[401],
      403: RESPONSES[403],
      429: RESPONSES[429],
      500: RESPONSES[500],
    },
  });
}
