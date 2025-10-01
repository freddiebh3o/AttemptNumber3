// api-server/src/openapi/paths/uploads.ts
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { successEnvelope, RESPONSES, ZodRateLimitHeaders, errorEnvelope } from '../components/envelopes.js';
import {
  ZodGenericUploadResponseData,
  ZodMultipartImageUploadBody,
} from '../components/uploads.js';

export function registerUploadPaths(registry: OpenAPIRegistry) {
  registry.registerPath({
    tags: ['Uploads'],
    method: 'post',
    path: '/api/uploads/images',
    security: [{ cookieAuth: [] }],
    request: {
      // multipart with a binary file + optional "kind"
      body: {
        content: {
          'multipart/form-data': { schema: ZodMultipartImageUploadBody },
        },
      },
    },
    responses: {
      201: {
        description: 'Image uploaded to Supabase Storage',
        content: {
          'application/json': { schema: successEnvelope(ZodGenericUploadResponseData) },
        },
      },
      400: RESPONSES[400],
      401: RESPONSES[401],
      403: RESPONSES[403],
      429: {
        description: 'Too Many Requests',
        headers: ZodRateLimitHeaders,
        content: { 'application/json': { schema: errorEnvelope } },
      },
      500: RESPONSES[500],
    },
  });
}
