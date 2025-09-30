// api-server/src/openapi/paths/tenants.ts
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { successEnvelope, RESPONSES } from '../components/envelopes.js';
import {
  ZodTenantSlugParam,
  ZodTenantThemeResponseData,
  ZodTenantThemePutBody,
} from '../schemas/tenants.js';
import { ZodTenantLogoUploadBody, ZodUploadInfo } from '../components/uploads.js';

export function registerTenantPaths(registry: OpenAPIRegistry) {
  // GET /api/tenants/{tenantSlug}/theme
  registry.registerPath({
    tags: ['Tenants'],
    method: 'get',
    path: '/api/tenants/{tenantSlug}/theme',
    security: [{ cookieAuth: [] }],
    request: { params: ZodTenantSlugParam },
    responses: {
      200: {
        description: 'Tenant theme (preset, overrides, logo)',
        content: { 'application/json': { schema: successEnvelope(ZodTenantThemeResponseData) } },
      },
      401: RESPONSES[401], 403: RESPONSES[403], 404: RESPONSES[404], 429: RESPONSES[429], 500: RESPONSES[500],
    },
  });

  // PUT /api/tenants/{tenantSlug}/theme
  registry.registerPath({
    tags: ['Tenants'],
    method: 'put',
    path: '/api/tenants/{tenantSlug}/theme',
    security: [{ cookieAuth: [] }],
    request: {
      headers: /* Idempotency header schema if you want here, or reuse shared one */ undefined,
      params: ZodTenantSlugParam,
      body: { content: { 'application/json': { schema: ZodTenantThemePutBody } } },
    },
    responses: {
      200: {
        description: 'Saved tenant theme',
        content: { 'application/json': { schema: successEnvelope(ZodTenantThemeResponseData) } },
      },
      400: RESPONSES[400], 401: RESPONSES[401], 403: RESPONSES[403], 404: RESPONSES[404], 429: RESPONSES[429], 500: RESPONSES[500],
    },
  });

  // POST /api/tenants/{tenantSlug}/logo
  registry.registerPath({
    tags: ['Tenants'],
    method: 'post',
    path: '/api/tenants/{tenantSlug}/logo',
    security: [{ cookieAuth: [] }],
    request: {
      params: ZodTenantSlugParam,
      body: {
        content: {
          'multipart/form-data': { schema: ZodTenantLogoUploadBody },
        },
      },
    },
    responses: {
      200: {
        description: 'Uploaded logo and updated tenant branding',
        content: {
          'application/json': {
            // Your route returns theme payload + upload info
            schema: successEnvelope(
              ZodTenantThemeResponseData.extend({ upload: ZodUploadInfo })
            ),
          },
        },
      },
      400: RESPONSES[400],
      401: RESPONSES[401],
      403: RESPONSES[403],
      404: RESPONSES[404],
      429: RESPONSES[429],
      500: RESPONSES[500],
    },
  });
}
