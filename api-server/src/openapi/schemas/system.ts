// api-server/src/openapi/schemas/system.ts
import { z } from 'zod';

export const ZodHealthResponseData = z
  .object({
    serviceName: z.string(),
    healthStatus: z.enum(['HEALTHY', 'UNHEALTHY']).default('HEALTHY'),
  })
  .openapi('HealthResponseData');

export const ZodVersionResponseData = z
  .object({
    serviceName: z.string(),
    semanticVersion: z.string(),
  })
  .openapi('VersionResponseData');
