// api-server/src/openapi/paths/branches.ts
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { successEnvelope, RESPONSES } from '../components/envelopes.js';
import {
  ZodBranchRecord,
  ZodCreateBranchRequestBody,
  ZodUpdateBranchParams,
  ZodUpdateBranchRequestBody,
  ZodListBranchesQuery,
  ZodBranchesListResponseData,
  ZodGetBranchResponseData,          // <-- NEW
  ZodBranchActivityQuery,            // <-- NEW
  ZodBranchActivityResponseData,     // <-- NEW
} from '../schemas/branches.js';
import { ZodIdempotencyHeaders } from '../schemas/common.js';
import { z } from 'zod';

export function registerBranchPaths(registry: OpenAPIRegistry) {
  // GET /api/branches
  registry.registerPath({
    tags: ['Branches'],
    method: 'get',
    path: '/api/branches',
    security: [{ cookieAuth: [] }],
    request: { query: ZodListBranchesQuery },
    responses: {
      200: {
        description: 'List branches',
        content: { 'application/json': { schema: successEnvelope(ZodBranchesListResponseData) } },
      },
      401: RESPONSES[401],
      500: RESPONSES[500],
    },
  });

  // ----- NEW: GET /api/branches/{branchId}
  registry.registerPath({
    tags: ['Branches'],
    method: 'get',
    path: '/api/branches/{branchId}',
    security: [{ cookieAuth: [] }],
    request: { params: ZodUpdateBranchParams },
    responses: {
      200: {
        description: 'Get a single branch by id',
        content: { 'application/json': { schema: successEnvelope(ZodGetBranchResponseData) } },
      },
      401: RESPONSES[401],
      403: RESPONSES[403],
      404: RESPONSES[404],
      429: RESPONSES[429],
      500: RESPONSES[500],
    },
  });

  // POST /api/branches
  registry.registerPath({
    tags: ['Branches'],
    method: 'post',
    path: '/api/branches',
    security: [{ cookieAuth: [] }],
    request: {
      headers: ZodIdempotencyHeaders,
      body: { content: { 'application/json': { schema: ZodCreateBranchRequestBody } } },
    },
    responses: {
      201: {
        description: 'Created branch',
        content: { 'application/json': { schema: successEnvelope(z.object({ branch: ZodBranchRecord })) } },
      },
      400: RESPONSES[400],
      401: RESPONSES[401],
      403: RESPONSES[403],
      409: RESPONSES[409],
      429: RESPONSES[429],
      500: RESPONSES[500],
    },
  });

  // PUT /api/branches/{branchId}
  registry.registerPath({
    tags: ['Branches'],
    method: 'put',
    path: '/api/branches/{branchId}',
    security: [{ cookieAuth: [] }],
    request: {
      headers: ZodIdempotencyHeaders,
      params: ZodUpdateBranchParams,
      body: { content: { 'application/json': { schema: ZodUpdateBranchRequestBody } } },
    },
    responses: {
      200: {
        description: 'Updated branch',
        content: { 'application/json': { schema: successEnvelope(z.object({ branch: ZodBranchRecord })) } },
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

  // DELETE /api/branches/{branchId}
  registry.registerPath({
    tags: ['Branches'],
    method: 'delete',
    path: '/api/branches/{branchId}',
    security: [{ cookieAuth: [] }],
    request: { params: ZodUpdateBranchParams },
    responses: {
      200: {
        description: 'Deactivated branch',
        content: { 'application/json': { schema: successEnvelope(z.object({ hasDeactivatedBranch: z.boolean() })) } },
      },
      401: RESPONSES[401],
      403: RESPONSES[403],
      404: RESPONSES[404],
      429: RESPONSES[429],
      500: RESPONSES[500],
    },
  });

  // ----- NEW: GET /api/branches/{branchId}/activity
  registry.registerPath({
    tags: ['Branches'],
    method: 'get',
    path: '/api/branches/{branchId}/activity',
    security: [{ cookieAuth: [] }],
    request: {
      params: ZodUpdateBranchParams,
      query: ZodBranchActivityQuery,
    },
    responses: {
      200: {
        description: 'Branch activity (audit) with filters',
        content: { 'application/json': { schema: successEnvelope(ZodBranchActivityResponseData) } },
      },
      401: RESPONSES[401],
      403: RESPONSES[403],
      404: RESPONSES[404],
      429: RESPONSES[429],
      500: RESPONSES[500],
    },
  });
}
