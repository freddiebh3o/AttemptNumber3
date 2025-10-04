import { z } from 'zod';

// Keep these in sync with your Prisma enums
export const ZodAuditEntityType = z.enum([
  'PRODUCT',
  'BRANCH',
  'STOCK_LOT',
  'STOCK_LEDGER',
  'PRODUCT_STOCK',
  'USER',
  'ROLE',
  'TENANT',
  'TENANT_BRANDING',
]).openapi('AuditEntityType');

export const ZodAuditAction = z.enum([
  'CREATE',
  'UPDATE',
  'DELETE',
  'STOCK_RECEIVE',
  'STOCK_ADJUST',
  'STOCK_CONSUME',
  'ROLE_ASSIGN',
  'ROLE_REVOKE',
  'LOGIN',
  'LOGOUT',
  'THEME_UPDATE',
  'THEME_LOGO_UPDATE',
]).openapi('AuditAction');

const ZodJson = z.unknown(); // arbitrary JSON from server (already redacted/whitelisted)

export const ZodAuditEventRecord = z.object({
  id: z.string(),
  tenantId: z.string(),
  actorUserId: z.string().nullable(),
  entityType: ZodAuditEntityType,
  entityId: z.string(),
  action: ZodAuditAction,
  entityName: z.string().nullable(),
  beforeJson: ZodJson.nullable(),
  afterJson: ZodJson.nullable(),
  diffJson: ZodJson.nullable(),
  correlationId: z.string().nullable(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.string().datetime(),
}).openapi('AuditEventRecord');

export const ZodListAuditEventsQuery = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  cursorId: z.string().optional(),
  entityType: ZodAuditEntityType.optional(),
  entityId: z.string().optional(),
  action: ZodAuditAction.optional(),
  actorUserId: z.string().optional(),
  occurredFrom: z.string().datetime().optional(), // ISO string
  occurredTo: z.string().datetime().optional(),
  includeTotal: z.boolean().optional(), // only respected by /events
}).openapi('ListAuditEventsQuery');

export const ZodListAuditEventsForEntityQuery = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  cursorId: z.string().optional(),
  action: ZodAuditAction.optional(),
  actorUserId: z.string().optional(),
  occurredFrom: z.string().datetime().optional(),
  occurredTo: z.string().datetime().optional(),
}).openapi('ListAuditEventsForEntityQuery');

export const ZodAuditEventsListResponseData = z.object({
  items: z.array(ZodAuditEventRecord),
  pageInfo: z.object({
    hasNextPage: z.boolean(),
    nextCursor: z.string().nullable().optional(),
    totalCount: z.number().int().min(0).optional(), // present only when includeTotal=1 on /events
  }),
}).openapi('AuditEventsListResponseData');
