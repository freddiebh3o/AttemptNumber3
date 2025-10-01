/* api-server/src/openapi/schemas/common.ts */
import { z } from 'zod';

// Reusable Idempotency header schema
export const ZodIdempotencyHeaders = z
  .object({
    'Idempotency-Key': z.string().optional(),
  })
  .openapi('IdempotencyHeaders');
