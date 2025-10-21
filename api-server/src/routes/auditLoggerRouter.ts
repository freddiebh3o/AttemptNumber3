// api-server/src/routes/auditLoggerRouter.ts
import { Router } from 'express';
import { Prisma, AuditAction, AuditEntityType } from '@prisma/client';
import { prismaClientInstance } from '../db/prismaClient.js';
import { Errors } from '../utils/httpErrors.js';

const router = Router();

// --- helpers ---
function parseLimit(raw: unknown, def = 25) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.max(1, Math.min(100, Math.trunc(n)));
}

function parseEnum<T extends Record<string, string>>(
  raw: unknown,
  EnumObj: T
): T[keyof T] | undefined {
  if (typeof raw !== 'string') return undefined;
  return (EnumObj as any)[raw] as T[keyof T] | undefined;
}

function requireTenant(req: any) {
  const tenantId = req.currentTenantId as string | undefined;
  if (!tenantId) {
    throw Errors.authRequired();
  }
  return tenantId;
}

// Consistent ordering for cursor pagination
const ORDER_BY = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

// Build where clause scoped to tenant + optional filters
function buildWhere(
  tenantId: string,
  q: {
    entityType?: AuditEntityType | undefined;
    entityId?: string | undefined;
    action?: AuditAction | undefined;
    actorUserId?: string | undefined;
    occurredFrom?: string | undefined; // ISO date string (start)
    occurredTo?: string | undefined;   // ISO date string (end)
  }
): Prisma.AuditEventWhereInput {
  const where: Prisma.AuditEventWhereInput = { tenantId };

  if (q.entityType != null) where.entityType = q.entityType;
  if (q.entityId != null) where.entityId = q.entityId;
  if (q.action != null) where.action = q.action;
  if (q.actorUserId != null) where.actorUserId = q.actorUserId;

  if (q.occurredFrom != null || q.occurredTo != null) {
    where.createdAt = {};
    if (q.occurredFrom != null) (where.createdAt as any).gte = new Date(q.occurredFrom);
    if (q.occurredTo   != null) (where.createdAt as any).lte = new Date(q.occurredTo);
  }

  return where;
}

/**
 * GET /api/audit/events
 * Query params:
 *  - limit (1..100, default 25)
 *  - cursorId (string id from previous page)
 *  - entityType (e.g. PRODUCT)
 *  - entityId
 *  - action (e.g. UPDATE)
 *  - actorUserId
 *  - occurredFrom (ISO date)
 *  - occurredTo   (ISO date)
 *  - includeTotal=1 (optional)
 */
router.get('/events', async (req, res, next) => {
  try {
    const tenantId = requireTenant(req);
    const limit = parseLimit(req.query.limit, 25);
    const cursorId = typeof req.query.cursorId === 'string' ? req.query.cursorId : undefined;

    const entityType = parseEnum(req.query.entityType, AuditEntityType);
    const action = parseEnum(req.query.action, AuditAction);
    const actorUserId = typeof req.query.actorUserId === 'string' ? req.query.actorUserId : undefined;
    const entityId = typeof req.query.entityId === 'string' ? req.query.entityId : undefined;

    const occurredFrom = typeof req.query.occurredFrom === 'string' ? req.query.occurredFrom : undefined;
    const occurredTo   = typeof req.query.occurredTo   === 'string' ? req.query.occurredTo   : undefined;

    const where = buildWhere(tenantId, {
      entityType,
      entityId,
      action,
      actorUserId,
      occurredFrom,
      occurredTo,
    });

    const items = await prismaClientInstance.auditEvent.findMany({
      where,
      orderBy: ORDER_BY,
      take: limit,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });

    const hasNextPage = items.length === limit;
    const nextCursor = hasNextPage ? items[items.length - 1]?.id ?? null : null;

    let totalCount: number | undefined;
    const includeTotal = req.query.includeTotal === '1' || req.query.includeTotal === 'true';
    if (includeTotal) {
      totalCount = await prismaClientInstance.auditEvent.count({ where });
    }

    return res.json({
      success: true,
      data: {
        items,
        pageInfo: {
          hasNextPage,
          nextCursor,
          ...(includeTotal ? { totalCount } : {}),
        },
      },
      error: null,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/audit/entities/:entityType/:entityId
 * Same as /events but constrained to a single entity.
 */
router.get('/entities/:entityType/:entityId', async (req, res, next) => {
  try {
    const tenantId = requireTenant(req);
    const limit = parseLimit(req.query.limit, 25);
    const cursorId = typeof req.query.cursorId === 'string' ? req.query.cursorId : undefined;

    const entityType = parseEnum(req.params.entityType, AuditEntityType);
    if (!entityType) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          errorCode: 'BAD_REQUEST',
          httpStatusCode: 400,
          userFacingMessage: 'Invalid entityType.',
          developerMessage: `Unknown entityType: ${req.params.entityType}`,
          correlationId: req.correlationId ?? null,
        },
      });
    }

    const where = buildWhere(tenantId, {
      entityType,
      entityId: req.params.entityId,
      action: parseEnum(req.query.action, AuditAction),
      actorUserId: typeof req.query.actorUserId === 'string' ? req.query.actorUserId : undefined,
      occurredFrom: typeof req.query.occurredFrom === 'string' ? req.query.occurredFrom : undefined,
      occurredTo:   typeof req.query.occurredTo   === 'string' ? req.query.occurredTo   : undefined,
    });

    const items = await prismaClientInstance.auditEvent.findMany({
      where,
      orderBy: ORDER_BY,
      take: limit,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });

    const hasNextPage = items.length === limit;
    const nextCursor = hasNextPage ? items[items.length - 1]?.id ?? null : null;

    return res.json({
      success: true,
      data: {
        items,
        pageInfo: { hasNextPage, nextCursor },
      },
      error: null,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/audit/events/:id
 * Fetch a single event (tenant-scoped).
 */
router.get('/events/:id', async (req, res, next) => {
  try {
    const tenantId = requireTenant(req);
    const event = await prismaClientInstance.auditEvent.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!event) {
      return res.status(404).json({
        success: false,
        data: null,
        error: {
          errorCode: 'RESOURCE_NOT_FOUND',
          httpStatusCode: 404,
          userFacingMessage: 'Audit event not found.',
          developerMessage: 'No audit event with that id for this tenant.',
          correlationId: req.correlationId ?? null,
        },
      });
    }
    return res.json({ success: true, data: event, error: null });
  } catch (e) {
    next(e);
  }
});

export { router as auditLoggerRouter };
