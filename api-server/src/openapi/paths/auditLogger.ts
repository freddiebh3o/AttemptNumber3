import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { successEnvelope, RESPONSES } from '../components/envelopes.js';
import {
  ZodAuditAction,
  ZodAuditEntityType,
  ZodAuditEventRecord,
  ZodAuditEventsListResponseData,
  ZodListAuditEventsForEntityQuery,
  ZodListAuditEventsQuery,
} from '../schemas/auditLogger.js';

export function registerAuditLoggerPaths(registry: OpenAPIRegistry) {
  // GET /api/audit/events  (tenant-scoped list, supports includeTotal)
  registry.registerPath({
    tags: ['Audit'],
    method: 'get',
    path: '/api/audit/events',
    security: [{ cookieAuth: [] }],
    request: { query: ZodListAuditEventsQuery },
    responses: {
      200: {
        description: 'List audit events (tenant-scoped)',
        content: { 'application/json': { schema: successEnvelope(ZodAuditEventsListResponseData) } },
      },
      401: RESPONSES[401],
      403: RESPONSES[403],
      429: RESPONSES[429],
      500: RESPONSES[500],
    },
  });

  // GET /api/audit/entities/{entityType}/{entityId}  (list constrained to one entity)
  registry.registerPath({
    tags: ['Audit'],
    method: 'get',
    path: '/api/audit/entities/{entityType}/{entityId}',
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        entityType: ZodAuditEntityType,
        entityId: z.string(),
      }),
      query: ZodListAuditEventsForEntityQuery,
    },
    responses: {
      200: {
        description: 'List audit events for a single entity',
        content: { 'application/json': { schema: successEnvelope(ZodAuditEventsListResponseData) } },
      },
      400: RESPONSES[400], // invalid entityType
      401: RESPONSES[401],
      403: RESPONSES[403],
      429: RESPONSES[429],
      500: RESPONSES[500],
    },
  });

  // GET /api/audit/events/{id} (single event fetch)
  registry.registerPath({
    tags: ['Audit'],
    method: 'get',
    path: '/api/audit/events/{id}',
    security: [{ cookieAuth: [] }],
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: 'Audit event',
        content: { 'application/json': { schema: successEnvelope(ZodAuditEventRecord) } },
      },
      401: RESPONSES[401],
      403: RESPONSES[403],
      404: RESPONSES[404],
      429: RESPONSES[429],
      500: RESPONSES[500],
    },
  });
}
