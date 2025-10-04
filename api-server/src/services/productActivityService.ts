// api-server/src/services/ProductActivityService.ts
import { prismaClientInstance as prisma } from '../db/prismaClient.js';
import type { Prisma } from '@prisma/client';

type GetActivityParams = {
  currentTenantId: string;
  productIdPathParam: string;
  limitOptional?: number;
  cursorOptional?: string | null;         // "ISO|id" from pageInfo.nextCursor
  occurredFromOptional?: string | null;   // ISO date/time
  occurredToOptional?: string | null;     // ISO date/time
  typeOptional?: 'all' | 'audit' | 'ledger';
  actorIdsOptional?: string[] | null;
  includeFacetsOptional?: boolean;
  includeTotalOptional?: boolean;         // <— NEW: when true, compute and return totalCount
};

type UnifiedItem =
  | {
      kind: 'audit';
      id: string;
      when: string; // ISO
      action: string;
      message: string;
      messageParts?: Record<string, unknown>;
      actor?: { userId: string; display: string } | null;
      correlationId?: string | null;
      entityName?: string | null;
    }
  | {
      kind: 'ledger';
      id: string;
      when: string; // ISO (occurredAt)
      entryKind: 'RECEIPT' | 'ADJUSTMENT' | 'CONSUMPTION' | 'REVERSAL';
      qtyDelta: number;
      branchId?: string | null;
      branchName?: string | null;
      reason?: string | null;
      message: string;
      messageParts?: Record<string, unknown>;
      actor?: { userId: string; display: string } | null;
      correlationId?: string | null; // filled if we correlate to an audit event
      lotId?: string | null;
    };

function parseCursor(cursor?: string | null) {
  // cursor format: "<ISO>|<id>"
  if (!cursor) return null;
  const i = cursor.indexOf('|');
  if (i <= 0) return null;
  const iso = cursor.slice(0, i);
  const id = cursor.slice(i + 1);
  const d = new Date(iso);
  if (!id || Number.isNaN(d.getTime())) return null;
  return { iso, id };
}

function buildNextCursor(last?: UnifiedItem | null) {
  if (!last) return null;
  return `${last.when}|${last.id}`;
}

function diffSummary(diffJson: unknown): { changedKeys: number } | undefined {
  if (!diffJson || typeof diffJson !== 'object') return;
  const keys = Object.keys(diffJson as Record<string, unknown>);
  return { changedKeys: keys.length };
}

export async function getProductActivityForCurrentTenantService(params: GetActivityParams) {
  const tenantId = params.currentTenantId;
  const productId = params.productIdPathParam;

  const limit = Math.max(1, Math.min(100, params.limitOptional ?? 50));
  const mode: 'all' | 'audit' | 'ledger' = params.typeOptional ?? 'all';

  const actorFilter =
    params.actorIdsOptional && params.actorIdsOptional.length
      ? params.actorIdsOptional
      : null;

  // Cursor → occurredTo clamp
  const cursor = parseCursor(params.cursorOptional);
  const occurredTo = cursor?.iso ?? params.occurredToOptional ?? null;
  const occurredFrom = params.occurredFromOptional ?? null;

  // ---- Build WHEREs ----
  const auditWhere: Prisma.AuditEventWhereInput = {
    tenantId,
    entityType: 'PRODUCT' as any,
    entityId: productId,
    ...(occurredFrom ? { createdAt: { gte: new Date(occurredFrom) } } : {}),
    ...(occurredTo
      ? {
          createdAt: {
            ...(occurredFrom ? { gte: new Date(occurredFrom) } : {}),
            lte: new Date(occurredTo),
          },
        }
      : {}),
    ...(actorFilter ? { actorUserId: { in: actorFilter } } : {}),
  };

  const ledgerWhere: Prisma.StockLedgerWhereInput = {
    tenantId,
    productId,
    ...(occurredFrom ? { occurredAt: { gte: new Date(occurredFrom) } } : {}),
    ...(occurredTo
      ? {
          occurredAt: {
            ...(occurredFrom ? { gte: new Date(occurredFrom) } : {}),
            lte: new Date(occurredTo),
          },
        }
      : {}),
    ...(actorFilter ? { actorUserId: { in: actorFilter } } : {}),
  };

  const orderAud = [{ createdAt: 'desc' } as const, { id: 'desc' } as const];
  const orderLed = [{ occurredAt: 'desc' } as const, { id: 'desc' } as const];

  // Pull more than one page per source so merged results can reliably determine "hasNextPage".
  const TAKE = Math.max(100, limit * 6);

  const [auditEvents, ledgerItems] = await Promise.all([
    mode !== 'ledger'
      ? prisma.auditEvent.findMany({
          where: auditWhere,
          orderBy: orderAud,
          take: TAKE,
        })
      : Promise.resolve([]),
    mode !== 'audit'
      ? prisma.stockLedger.findMany({
          where: ledgerWhere,
          orderBy: orderLed,
          take: TAKE,
          include: {
            branch: { select: { id: true, branchName: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  // ---- Hydrate actors ----
  const actorIds = new Set<string>();
  for (const a of auditEvents) if (a.actorUserId) actorIds.add(a.actorUserId);
  for (const l of ledgerItems) if (l.actorUserId) actorIds.add(l.actorUserId);

  const actors = actorIds.size
    ? await prisma.user.findMany({
        where: { id: { in: Array.from(actorIds) } },
        select: { id: true, userEmailAddress: true },
      })
    : [];

  const actorMap = new Map(actors.map((u) => [u.id, u.userEmailAddress ?? u.id]));
  const toActor = (userId?: string | null) =>
    userId ? { userId, display: actorMap.get(userId) ?? userId } : null;

  // ---- Heuristic correlate ledger → audit ONLY for correlationId fallback
  const matchableAudits = auditEvents.filter((a) =>
    ['STOCK_RECEIVE', 'STOCK_ADJUST', 'STOCK_CONSUME'].includes(a.action as any)
  );

  function nearestAuditFor(when: Date) {
    let best: (typeof matchableAudits)[number] | null = null;
    let bestDiff = Number.POSITIVE_INFINITY;
    for (const a of matchableAudits) {
      const dt = Math.abs(a.createdAt.getTime() - when.getTime());
      if (dt < bestDiff) {
        best = a;
        bestDiff = dt;
      }
    }
    return best && bestDiff <= 30_000 ? best : null; // 30s window
  }

  // ---- Map to unified items ----
  const auditMapped: UnifiedItem[] = auditEvents.map((a) => ({
    kind: 'audit',
    id: a.id,
    when: a.createdAt.toISOString(),
    action: a.action as string,
    message:
      a.action === 'CREATE'
        ? 'Created product'
        : a.action === 'UPDATE'
        ? 'Updated product'
        : a.action === 'DELETE'
        ? 'Deleted product'
        : a.action === 'STOCK_RECEIVE'
        ? 'Received stock'
        : a.action === 'STOCK_ADJUST'
        ? 'Adjusted stock'
        : a.action === 'STOCK_CONSUME'
        ? 'Consumed stock'
        : a.action.replaceAll('_', ' ').toLowerCase(),
    messageParts: {
      entityName: a.entityName ?? undefined,
      ...diffSummary(a.diffJson ?? undefined),
    },
    actor: toActor(a.actorUserId),
    correlationId: a.correlationId ?? null,
    entityName: a.entityName ?? null,
  }));

  const ledgerMapped: UnifiedItem[] = ledgerItems.map((le) => {
    const when = new Date(le.occurredAt);
    const matchedAudit = nearestAuditFor(when); // only for correlation id

    const noun = Math.abs(le.qtyDelta) === 1 ? 'unit' : 'units';
    const message =
      le.qtyDelta > 0
        ? `Stock was increased by ${le.qtyDelta} ${noun}`
        : le.qtyDelta < 0
        ? `Stock was decreased by ${Math.abs(le.qtyDelta)} ${noun}`
        : `Stock was adjusted by 0 ${noun}`;

    return {
      kind: 'ledger' as const,
      id: le.id,
      when: le.occurredAt.toISOString(),
      entryKind: le.kind as any,
      qtyDelta: le.qtyDelta,
      branchId: le.branchId ?? null,
      branchName: le.branch?.branchName ?? null,
      reason: le.reason ?? null,
      lotId: le.lotId ?? null,
      message,
      messageParts: {
        qtyDelta: le.qtyDelta,
        branchName: le.branch?.branchName ?? null,
        reason: le.reason ?? null,
      },
      actor: toActor(le.actorUserId),
      correlationId: matchedAudit?.correlationId ?? null,
    };
  });

  // ---- Merge + sort desc by time then id ----
  const merged = [...auditMapped, ...ledgerMapped].sort((a, b) => {
    const ta = a.when, tb = b.when;
    if (ta > tb) return -1;
    if (ta < tb) return 1;
    return a.id > b.id ? -1 : a.id < b.id ? 1 : 0;
  });

  // ---- Cursor clamp ----
  const final = cursor
    ? merged.filter(
        (it) => it.when < cursor.iso || (it.when === cursor.iso && it.id < cursor.id)
      )
    : merged;

  const pageItems = final.slice(0, limit);
  const last = pageItems[pageItems.length - 1] ?? null;
  const nextCursor = buildNextCursor(last);
  const hasNextPage = final.length > limit;

  // ---- Facets (distinct actors) ----
  let facets:
    | {
        actors: { userId: string; display: string }[];
      }
    | undefined;

  if (params.includeFacetsOptional) {
    const [auditActorIds, ledgerActorIds] = await Promise.all([
      prisma.auditEvent.findMany({
        where: {
          tenantId,
          entityType: 'PRODUCT' as any,
        entityId: productId,
          actorUserId: { not: null },
        },
        distinct: ['actorUserId'],
        select: { actorUserId: true },
      }),
      prisma.stockLedger.findMany({
        where: {
          tenantId,
          productId,
          actorUserId: { not: null },
        },
        distinct: ['actorUserId'],
        select: { actorUserId: true },
      }),
    ]);

    const distinctIds = Array.from(
      new Set(
        [...auditActorIds, ...ledgerActorIds]
          .map((x) => x.actorUserId)
          .filter((v): v is string => !!v)
      )
    );

    const actorsFull = distinctIds.length
      ? await prisma.user.findMany({
          where: { id: { in: distinctIds } },
          select: { id: true, userEmailAddress: true },
        })
      : [];

    facets = {
      actors: actorsFull.map((u) => ({
        userId: u.id,
        display: u.userEmailAddress ?? u.id,
      })),
    };
  }

  // ---- Total (optional) ----
  let totalCount: number | undefined;
  if (params.includeTotalOptional) {
    const [auditCount, ledgerCount] = await Promise.all([
      mode !== 'ledger' ? prisma.auditEvent.count({ where: auditWhere }) : Promise.resolve(0),
      mode !== 'audit' ? prisma.stockLedger.count({ where: ledgerWhere }) : Promise.resolve(0),
    ]);
    totalCount = auditCount + ledgerCount;
  }

  return {
    items: pageItems,
    pageInfo: {
      hasNextPage,
      nextCursor,
      ...(typeof totalCount === 'number' ? { totalCount } : {}),
    },
    ...(facets ? { facets } : {}),
  };
}
