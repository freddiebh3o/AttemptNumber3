import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { successEnvelope, RESPONSES } from '../components/envelopes.js';
import {
  ZodMeResponseData,
  ZodSignInRequestBody,
  ZodSwitchTenantRequestBody,
  ZodSwitchTenantResponseData,
} from '../schemas/auth.js';
import { z } from 'zod';

export function registerAuthPaths(registry: OpenAPIRegistry) {
  // POST /api/auth/sign-in
  registry.registerPath({
    tags: ['Auth'],
    method: 'post',
    path: '/api/auth/sign-in',
    request: {
      body: { content: { 'application/json': { schema: ZodSignInRequestBody } } },
    },
    responses: {
      200: {
        description: 'Signed in',
        content: { 'application/json': { schema: successEnvelope(z.object({ signedIn: z.boolean() })) } },
      },
      400: RESPONSES[400],
      401: RESPONSES[401],
      429: RESPONSES[429],
      500: RESPONSES[500],
    },
  });

  // POST /api/auth/sign-out
  registry.registerPath({
    tags: ['Auth'],
    method: 'post',
    path: '/api/auth/sign-out',
    responses: {
      200: {
        description: 'Signed out',
        content: {
          'application/json': { schema: successEnvelope(z.object({ signedOut: z.boolean() })) },
        },
      },
      500: RESPONSES[500],
    },
  });

  // GET /api/auth/me
  registry.registerPath({
    tags: ['Auth'],
    method: 'get',
    path: '/api/auth/me',
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: 'Current user',
        content: { 'application/json': { schema: successEnvelope(ZodMeResponseData) } },
      },
      401: RESPONSES[401],
      500: RESPONSES[500],
    },
  });

  // POST /api/auth/switch-tenant
  registry.registerPath({
    tags: ['Auth'],
    method: 'post',
    path: '/api/auth/switch-tenant',
    security: [{ cookieAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: ZodSwitchTenantRequestBody } } },
    },
    responses: {
      200: {
        description: 'Switched current tenant for the session',
        content: { 'application/json': { schema: successEnvelope(ZodSwitchTenantResponseData) } },
      },
      400: RESPONSES[400],
      401: RESPONSES[401],
      403: RESPONSES[403],
      429: RESPONSES[429],
      500: RESPONSES[500],
    },
  });
}
