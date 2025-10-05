// api-server/src/openapi/paths/roles.ts
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { successEnvelope, RESPONSES } from '../components/envelopes.js';
import { ZodIdempotencyHeaders } from '../schemas/common.js';
import {
  ZodPermissionRecord,
  ZodRoleRecord,
  ZodListRolesQuery,
  ZodRolesListResponseData,
  ZodCreateRoleBody,
  ZodUpdateRoleBody,
  ZodRoleIdParam,
  ZodRoleActivityQuery,
  ZodRoleActivityResponseData,
} from '../schemas/roles.js';

export function registerRolePaths(registry: OpenAPIRegistry) {
  // GET /api/permissions
  registry.registerPath({
    tags: ['Roles'],
    method: 'get',
    path: '/api/permissions',
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: 'Permission catalogue',
        content: {
          'application/json': {
            schema: successEnvelope(
              z.object({ permissions: z.array(ZodPermissionRecord) })
            ),
          },
        },
      },
      401: RESPONSES[401],
      403: RESPONSES[403],
      500: RESPONSES[500],
    },
  });

  // GET /api/roles
  registry.registerPath({
    tags: ['Roles'],
    method: 'get',
    path: '/api/roles',
    security: [{ cookieAuth: [] }],
    request: { query: ZodListRolesQuery },
    responses: {
      200: {
        description: 'List tenant roles',
        content: { 'application/json': { schema: successEnvelope(ZodRolesListResponseData) } },
      },
      401: RESPONSES[401],
      403: RESPONSES[403],
      500: RESPONSES[500],
    },
  });

  // POST /api/roles
  registry.registerPath({
    tags: ['Roles'],
    method: 'post',
    path: '/api/roles',
    security: [{ cookieAuth: [] }],
    request: {
      headers: ZodIdempotencyHeaders,
      body: { content: { 'application/json': { schema: ZodCreateRoleBody } } },
    },
    responses: {
      201: {
        description: 'Created role',
        content: {
          'application/json': {
            schema: successEnvelope(z.object({ role: ZodRoleRecord })),
          },
        },
      },
      400: RESPONSES[400],
      401: RESPONSES[401],
      403: RESPONSES[403],
      409: RESPONSES[409],
      429: RESPONSES[429],
      500: RESPONSES[500],
    },
  });

  // PUT /api/roles/{roleId}
  registry.registerPath({
    tags: ['Roles'],
    method: 'put',
    path: '/api/roles/{roleId}',
    security: [{ cookieAuth: [] }],
    request: {
      headers: ZodIdempotencyHeaders,
      params: ZodRoleIdParam,
      body: { content: { 'application/json': { schema: ZodUpdateRoleBody } } },
    },
    responses: {
      200: {
        description: 'Updated role',
        content: {
          'application/json': {
            schema: successEnvelope(z.object({ role: ZodRoleRecord })),
          },
        },
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

  // DELETE /api/roles/{roleId}
  registry.registerPath({
    tags: ['Roles'],
    method: 'delete',
    path: '/api/roles/{roleId}',
    security: [{ cookieAuth: [] }],
    request: { params: ZodRoleIdParam, headers: ZodIdempotencyHeaders },
    responses: {
      200: {
        description: 'Deleted role',
        content: {
          'application/json': {
            schema: successEnvelope(z.object({ hasDeletedRole: z.boolean() })),
          },
        },
      },
      401: RESPONSES[401],
      403: RESPONSES[403],
      404: RESPONSES[404],
      409: RESPONSES[409],
      429: RESPONSES[429],
      500: RESPONSES[500],
    },
  });

  // ---------- NEW: GET /api/roles/{roleId}/activity ----------
  registry.registerPath({
    tags: ['Roles'],
    method: 'get',
    path: '/api/roles/{roleId}/activity',
    security: [{ cookieAuth: [] }],
    request: {
      params: ZodRoleIdParam,
      query: ZodRoleActivityQuery,
    },
    responses: {
      200: {
        description: 'Role activity (audit) with filters',
        content: {
          'application/json': {
            schema: successEnvelope(ZodRoleActivityResponseData),
          },
        },
      },
      401: RESPONSES[401],
      403: RESPONSES[403],
      404: RESPONSES[404],
      429: RESPONSES[429],
      500: RESPONSES[500],
    },
  });
}
