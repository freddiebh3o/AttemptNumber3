// api-server/src/openapi/components/envelopes.ts
import { z } from 'zod';

export const ZodStandardErrorPayload = z.object({
  errorCode: z.string(),
  httpStatusCode: z.number().int(),
  userFacingMessage: z.string(),
  developerMessage: z.string().optional(),
  correlationId: z.string().nullable(),
}).openapi('StandardErrorPayload');

export const successEnvelope = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    error: z.null(),
  });

export const errorEnvelope = z.object({
  success: z.literal(false),
  data: z.null(),
  error: ZodStandardErrorPayload,
}).openapi('ErrorEnvelope');

export const ZodRateLimitHeaders = z.object({
  'X-RateLimit-Limit': z.string().openapi({ example: '300' }),
  'X-RateLimit-Remaining': z.string().openapi({ example: '299' }),
  'X-RateLimit-Reset': z.string().openapi({ example: '1758912000' }),
  'Retry-After': z.string().openapi({ example: '42' }),
});

// Reusable response objects
export const RESPONSES = {
  400: { description: 'Bad Request', content: { 'application/json': { schema: errorEnvelope } } },
  401: { description: 'Unauthorized', content: { 'application/json': { schema: errorEnvelope } } },
  403: { description: 'Forbidden', content: { 'application/json': { schema: errorEnvelope } } },
  404: { description: 'Not Found', content: { 'application/json': { schema: errorEnvelope } } },
  409: { description: 'Conflict', content: { 'application/json': { schema: errorEnvelope } } },
  429: { description: 'Too Many Requests', headers: ZodRateLimitHeaders, content: { 'application/json': { schema: errorEnvelope } } },
  500: { description: 'Internal Error', content: { 'application/json': { schema: errorEnvelope } } },
} as const;
