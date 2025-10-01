/* api-server/src/openapi/schemas/common.ts */
import { z } from 'zod';

// Reusable role enum
export const ZodRoleName = z
  .enum(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'])
  .openapi('RoleName');

// Reusable Idempotency header schema
export const ZodIdempotencyHeaders = z
  .object({
    'Idempotency-Key': z.string().optional(),
  })
  .openapi('IdempotencyHeaders');
