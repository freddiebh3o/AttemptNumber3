// api-server/src/services/tenantUsers/tenantUserActivityService.ts
import { prismaClientInstance } from '../../db/prismaClient.js';
import type { Prisma } from '@prisma/client';
import { AuditEntityType } from '@prisma/client';

type ViewItemAudit = {
  kind: 'audit';
  id: string;
  when: string; // ISO
  action: string;
  message: string;
  messageParts?: Record<string, unknown> | null;
  actor?: { userId: string; display: string } | null;
  correlationId?: string | null;
};

type ListOut = {
  items: ViewItemAudit[];
  pageInfo: {
    hasNextPage: boolean;
    nextCursor: string | null;
    totalCount?: number;
  };
  facets?: {
    actors: Array<{ userId: string; display: string }>;
  };
  applied: {
    limit: number;
    filters: {
      actorIds?: string[];
      occurredFrom?: string;
      occurredTo?: string;
    };
  };
};

function clampLimit(n?: number) {
  const v = Number.isFinite(n as number) ? (n as number) : 20;
  return Math.max(1, Math.min(100, v));
}

// Cursor shape: "<createdAtISO>|<id>"
function encodeCursor(createdAtISO: string, id: string) {
  return `${createdAtISO}|${id}`;
}
function decodeCursor(cursor?: string | null) {
  if (!cursor) return null;
  const idx = cursor.indexOf('|');
  if (idx <= 0) return null;
  return { createdAtISO: cursor.slice(0, idx), id: cursor.slice(idx + 1) };
}

function makeHumanMessage(action: string, entityName: string | null, before: unknown, after: unknown) {
  // Keep it simple & generic (you can expand with action-specific messages later)
  const base = entityName ?? 'User';
  switch (action) {
    case 'CREATE': return `${base} created`;
    case 'UPDATE': return `${base} updated`;
    case 'ROLE_ASSIGN': return `${base} role assigned`;
    case 'ROLE_REVOKE': return `${base} role revoked`;
    default: return `${base} ${action.toLowerCase()}`;
  }
}

export async function listTenantUserActivityForUserService(params: {
  currentTenantId: string;
  targetUserId: string;

  // paging
  limitOptional?: number;
  cursorOptional?: string | null;

  // filters
  actorIdsOptional?: string[];           // who performed the action
  occurredFromOptional?: string | null;  // ISO or 'YYYY-MM-DD'
  occurredToOptional?: string | null;    // ISO or 'YYYY-MM-DD'

  // extras
  includeFacetsOptional?: boolean;
  includeTotalOptional?: boolean;
}): Promise<ListOut> {
  const {
    currentTenantId,
    targetUserId,
    limitOptional,
    cursorOptional,
    actorIdsOptional,
    occurredFromOptional,
    occurredToOptional,
    includeFacetsOptional = false,
    includeTotalOptional = false,
  } = params;

  const limit = clampLimit(limitOptional);
  const take = limit + 1;

  // Time filters
  const createdAt: Prisma.DateTimeFilter = {};
  if (occurredFromOptional) {
    const d = new Date(occurredFromOptional);
    if (!Number.isNaN(d.getTime())) createdAt.gte = d;
  }
  if (occurredToOptional) {
    const d = new Date(occurredToOptional);
    if (!Number.isNaN(d.getTime())) createdAt.lte = d;
  }

  // Cursor → apply as a "createdAt <=" + "id <" tie-breaker (for stable desc ordering)
  // We’ll fetch `take` with an orderBy [createdAt desc, id desc].
  const decoded = decodeCursor(cursorOptional ?? null);
  const cursorWhere: Prisma.AuditEventWhereInput | undefined = decoded
    ? {
        OR: [
          { createdAt: { lt: new Date(decoded.createdAtISO) } },
          {
            AND: [
              { createdAt: new Date(decoded.createdAtISO) },
              { id: { lt: decoded.id } },
            ],
          },
        ],
      }
    : undefined;

  // Where
  const where: Prisma.AuditEventWhereInput = {
    tenantId: currentTenantId,
    entityType: AuditEntityType.USER,
    entityId: targetUserId,
    ...(actorIdsOptional && actorIdsOptional.length
      ? { actorUserId: { in: actorIdsOptional } }
      : {}),
    ...((createdAt.gte || createdAt.lte) ? { createdAt } : {}),
    ...(cursorWhere ? cursorWhere : {}),
  };

  // Query
  const [rows, totalMaybe] = await Promise.all([
    prismaClientInstance.auditEvent.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      select: {
        id: true,
        createdAt: true,
        action: true,
        actorUserId: true,
        entityName: true,
        beforeJson: true,
        afterJson: true,
        correlationId: true,
      },
    }),
    includeTotalOptional
      ? prismaClientInstance.auditEvent.count({
          where: {
            tenantId: currentTenantId,
            entityType: AuditEntityType.USER,
            entityId: targetUserId,
            ...(actorIdsOptional && actorIdsOptional.length
              ? { actorUserId: { in: actorIdsOptional } }
              : {}),
            ...((createdAt.gte || createdAt.lte) ? { createdAt } : {}),
          },
        })
      : Promise.resolve(0),
  ]);

  const hasNextPage = rows.length > limit;
  const pageRows = hasNextPage ? rows.slice(0, limit) : rows;

  // Grab actor displays (emails) in one go
  const actorIds = Array.from(
    new Set(pageRows.map(r => r.actorUserId).filter(Boolean) as string[])
  );
  const actorsMap: Record<string, string> = {};
  if (actorIds.length) {
    const actors = await prismaClientInstance.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, userEmailAddress: true },
    });
    for (const a of actors) actorsMap[a.id] = a.userEmailAddress;
  }

  const items: ViewItemAudit[] = pageRows.map((r) => {
    const when = r.createdAt.toISOString();
    const message = makeHumanMessage(
      r.action,
      r.entityName ?? null,
      r.beforeJson as any,
      r.afterJson as any
    );
  
    const actor = r.actorUserId
      ? { userId: r.actorUserId, display: actorsMap[r.actorUserId] ?? r.actorUserId }
      : null;
  
    return {
      kind: 'audit',
      id: r.id,
      when,
      action: r.action,
      message,
      actor,
      correlationId: r.correlationId ?? null,
    };
  });

  const nextCursor =
    hasNextPage && pageRows.length
      ? encodeCursor(pageRows[pageRows.length - 1]!.createdAt.toISOString(), pageRows[pageRows.length - 1]!.id)
      : null;

  // Facets (actors who acted on this user)
  let facets: ListOut['facets'] | undefined;
  if (includeFacetsOptional) {
    const facetActorsRaw = await prismaClientInstance.auditEvent.findMany({
      where: {
        tenantId: currentTenantId,
        entityType: AuditEntityType.USER,
        entityId: targetUserId,
        actorUserId: { not: null },
      },
      select: { actorUserId: true },
      distinct: ['actorUserId'],
      take: 200, // cheap guard
      orderBy: { actorUserId: 'asc' },
    });
    const facetIds = facetActorsRaw
      .map(a => a.actorUserId)
      .filter((x): x is string => Boolean(x));
    let facetMap: Record<string, string> = {};
    if (facetIds.length) {
      const users = await prismaClientInstance.user.findMany({
        where: { id: { in: facetIds } },
        select: { id: true, userEmailAddress: true },
      });
      facetMap = Object.fromEntries(users.map(u => [u.id, u.userEmailAddress]));
    }
    facets = {
      actors: facetIds.map(id => ({ userId: id, display: facetMap[id] ?? id })),
    };
  }

  return {
    items,
    pageInfo: {
      hasNextPage,
      nextCursor,
      ...(includeTotalOptional ? { totalCount: totalMaybe } : {}),
    },
    ...(facets ? { facets } : {}),
    applied: {
      limit,
      filters: {
        ...(actorIdsOptional?.length ? { actorIds: actorIdsOptional } : {}),
        ...(occurredFromOptional ? { occurredFrom: occurredFromOptional } : {}),
        ...(occurredToOptional ? { occurredTo: occurredToOptional } : {}),
      },
    },
  };
}
