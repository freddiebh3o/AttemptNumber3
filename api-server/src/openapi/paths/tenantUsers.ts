import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { successEnvelope, RESPONSES, errorEnvelope } from '../components/envelopes.js';
import {
  ZodCreateTenantUserBody,
  ZodListTenantUsersQuery,
  ZodTenantUsersListResponseData,
  ZodUpdateTenantUserBody,
} from '../schemas/tenantUsers.js';
import { z } from 'zod';

// Small helper envelope for single user (kept from your original)
export const ZodTenantUserEnvelope = z.object({
  user: z.object({
    userId: z.string(),
    userEmailAddress: z.string().email(),
    roleName: z.enum(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']).nullable().optional(),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
  }),
});

export function registerTenantUsersPaths(registry: OpenAPIRegistry) {
  // GET /api/tenant-users
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

  // POST /api/tenant-users
  registry.registerPath({
    tags: ['TenantUsers'],
    method: 'post',
    path: '/api/tenant-users',
    security: [{ cookieAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: ZodCreateTenantUserBody } } },
    },
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

  // PUT /api/tenant-users/{userId}
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
      403: {
        description: 'Forbidden',
        content: {
          'application/json': {
            schema: errorEnvelope,
            examples: {
              CANT_DEMOTE_LAST_OWNER: {
                summary: 'Cannot demote the last OWNER',
                value: {
                  success: false,
                  data: null,
                  error: {
                    errorCode: 'CANT_DEMOTE_LAST_OWNER',
                    httpStatusCode: 403,
                    userFacingMessage: 'You cannot demote the last owner of a tenant.',
                    developerMessage: 'Refuse demotion if tenant would have zero OWNERs.',
                    correlationId: 'example-correlation-id',
                  },
                },
              },
            },
          },
        },
      },
      404: RESPONSES[404],
      409: RESPONSES[409],
      429: RESPONSES[429],
      500: RESPONSES[500],
    },
  });

  // DELETE /api/tenant-users/{userId}
  registry.registerPath({
    tags: ['TenantUsers'],
    method: 'delete',
    path: '/api/tenant-users/{userId}',
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({ userId: z.string() }),
    },
    responses: {
      200: {
        description: 'Removed membership',
        content: { 'application/json': { schema: successEnvelope(
          z.object({ hasRemovedMembership: z.boolean() })
        ) } },
      },
      401: RESPONSES[401],
      403: {
        description: 'Forbidden',
        content: {
          'application/json': {
            schema: errorEnvelope,
            examples: {
              CANT_DELETE_LAST_OWNER: {
                summary: 'Cannot remove the last OWNER',
                value: {
                  success: false,
                  data: null,
                  error: {
                    errorCode: 'CANT_DELETE_LAST_OWNER',
                    httpStatusCode: 403,
                    userFacingMessage: 'You cannot delete the last owner of a tenant.',
                    developerMessage: 'Refuse delete if tenant would have zero OWNERs.',
                    correlationId: 'example-correlation-id',
                  },
                },
              },
            },
          },
        },
      },
      404: RESPONSES[404],
      429: RESPONSES[429],
      500: RESPONSES[500],
    },
  });
}
