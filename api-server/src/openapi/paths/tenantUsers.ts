/* api-server/src/openapi/paths/tenantUsers.ts */
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { successEnvelope, RESPONSES, errorEnvelope } from '../components/envelopes.js';
import {
  ZodCreateTenantUserBody,
  ZodListTenantUsersQuery,
  ZodTenantUsersListResponseData,
  ZodUpdateTenantUserBody,
  ZodTenantUserRecord,
  ZodTenantUserActivityResponseData,
  ZodListTenantUserActivityQuery,
} from '../schemas/tenantUsers.js';
import { z } from 'zod';

const ZodTenantUserEnvelope = z.object({
  user: ZodTenantUserRecord,
});

export function registerTenantUsersPaths(registry: OpenAPIRegistry) {
  registry.registerPath({
    tags: ['TenantUsers'],
    method: 'get',
    path: '/api/tenant-users',
    security: [{ cookieAuth: [] }],
    request: { query: ZodListTenantUsersQuery },
    responses: {
      200: {
        description: 'List tenant users',
        content: { 'application/json': { schema: successEnvelope(ZodTenantUsersListResponseData) } },
      },
      401: RESPONSES[401],
      403: RESPONSES[403],
      429: RESPONSES[429],
      500: RESPONSES[500],
    },
  });

  registry.registerPath({
    tags: ['TenantUsers'],
    method: 'get',
    path: '/api/tenant-users/{userId}',
    security: [{ cookieAuth: [] }],
    request: { params: z.object({ userId: z.string() }) },
    responses: {
      200: {
        description: 'Tenant user',
        content: { 'application/json': { schema: successEnvelope(ZodTenantUserEnvelope) } },
      },
      401: RESPONSES[401],
      403: RESPONSES[403],
      404: RESPONSES[404],
      429: RESPONSES[429],
      500: RESPONSES[500],
    },
  });

  registry.registerPath({
    tags: ['TenantUsers'],
    method: 'post',
    path: '/api/tenant-users',
    security: [{ cookieAuth: [] }],
    request: { body: { content: { 'application/json': { schema: ZodCreateTenantUserBody } } } },
    responses: {
      201: {
        description: 'Created/attached user',
        content: { 'application/json': { schema: successEnvelope(ZodTenantUserEnvelope) } },
      },
      400: RESPONSES[400],
      401: RESPONSES[401],
      403: RESPONSES[403],
      409: RESPONSES[409],
      429: RESPONSES[429],
      500: RESPONSES[500],
    },
  });

  registry.registerPath({
    tags: ['TenantUsers'],
    method: 'put',
    path: '/api/tenant-users/{userId}',
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({ userId: z.string() }),
      body: { content: { 'application/json': { schema: ZodUpdateTenantUserBody } } },
    },
    responses: {
      200: {
        description: 'Updated user/membership',
        content: { 'application/json': { schema: successEnvelope(ZodTenantUserEnvelope) } },
      },
      400: RESPONSES[400],
      401: RESPONSES[401],
      403: { description: 'Forbidden', content: { 'application/json': { schema: errorEnvelope } } },
      404: RESPONSES[404],
      409: RESPONSES[409],
      429: RESPONSES[429],
      500: RESPONSES[500],
    },
  });

  registry.registerPath({
    tags: ['TenantUsers'],
    method: 'delete',
    path: '/api/tenant-users/{userId}',
    security: [{ cookieAuth: [] }],
    request: { params: z.object({ userId: z.string() }) },
    responses: {
      200: {
        description: 'Archived membership',
        content: { 'application/json': { schema: successEnvelope(z.object({ hasArchivedMembership: z.boolean() })) } },
      },
      401: RESPONSES[401],
      403: { description: 'Forbidden', content: { 'application/json': { schema: errorEnvelope } } },
      404: RESPONSES[404],
      429: RESPONSES[429],
      500: RESPONSES[500],
    },
  });

  registry.registerPath({
    tags: ['TenantUsers'],
    method: 'post',
    path: '/api/tenant-users/{userId}/restore',
    security: [{ cookieAuth: [] }],
    request: { params: z.object({ userId: z.string() }) },
    responses: {
      200: {
        description: 'Restored archived membership',
        content: { 'application/json': { schema: successEnvelope(z.object({ hasRestoredMembership: z.boolean() })) } },
      },
      401: RESPONSES[401],
      403: { description: 'Forbidden', content: { 'application/json': { schema: errorEnvelope } } },
      404: RESPONSES[404],
      429: RESPONSES[429],
      500: RESPONSES[500],
    },
  });

  registry.registerPath({
    tags: ['TenantUsers'],
    method: 'get',
    path: '/api/tenant-users/{userId}/activity',
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({ userId: z.string() }),
      query: ZodListTenantUserActivityQuery,
    },
    responses: {
      200: {
        description: 'Tenant user activity (audit events)',
        content: {
          'application/json': { schema: successEnvelope(ZodTenantUserActivityResponseData) },
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
