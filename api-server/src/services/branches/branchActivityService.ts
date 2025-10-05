import { prismaClientInstance as prisma } from '../../db/prismaClient.js';
import type { Prisma, AuditEntityType } from '@prisma/client';

type GetActivityParams = {
  currentTenantId: string;
  branchIdPathParam: string;
  limitOptional?: number;
  cursorOptional?: string | null;       // "ISO|id"
  occurredFromOptional?: string | null; // ISO
  occurredToOptional?: string | null;   // ISO
  actorIdsOptional?: string[] | null;
  includeFacetsOptional?: boolean;
  includeTotalOptional?: boolean;
};

export type BranchActivityItem = {
  kind: 'audit';
  id: string;
  when: string; // ISO
  action: string;
  message: string;
  messageParts?: Record<string, unknown>;
  actor?: { userId: string; display: string } | null;
  correlationId?: string | null;
  entityName?: string | null;
};

// ---------------- cursor helpers ----------------
function parseCursor(cursor?: string | null) {
  if (!cursor) return null;
  const i = cursor.indexOf('|');
  if (i <= 0) return null;
  const iso = cursor.slice(0, i);
  const id = cursor.slice(i + 1);
  const d = new Date(iso);
  if (!id || Number.isNaN(d.getTime())) return null;
  return { iso, id };
}
function buildNextCursor(last?: BranchActivityItem | null) {
  if (!last) return null;
  return `${last.when}|${last.id}`;
}

// ---------------- humanization helpers ----------------
type BranchSnap = {
  branchSlug?: string | null;
  branchName?: string | null;
  isActive?: boolean | null;
};

const quote = (s: string | null | undefined) => (s == null || s === '' ? '—' : `“${s}”`);

function safeBefore(a: any): BranchSnap | undefined {
  return (a?.beforeJson as BranchSnap | undefined) ?? (a?.before as BranchSnap | undefined);
}
function safeAfter(a: any): BranchSnap | undefined {
  return (a?.afterJson as BranchSnap | undefined) ?? (a?.after as BranchSnap | undefined);
}

function humanizeBranchChange(before?: BranchSnap, after?: BranchSnap) {
  const b = before ?? {};
  const a = after ?? {};
  const parts: string[] = [];
  const details: Record<string, unknown> = {};
  const changed: Record<string, boolean> = {};

  if (b.branchName !== a.branchName) {
    parts.push(`renamed ${quote(b.branchName)} → ${quote(a.branchName)}`);
    details.branchName = { before: b.branchName ?? null, after: a.branchName ?? null };
    changed.branchName = true;
  }

  if (b.branchSlug !== a.branchSlug) {
    parts.push(`slug ${quote(b.branchSlug)} → ${quote(a.branchSlug)}`);
    details.branchSlug = { before: b.branchSlug ?? null, after: a.branchSlug ?? null };
    changed.branchSlug = true;
  }

  if ((b.isActive ?? true) !== (a.isActive ?? true)) {
    parts.push(`isActive → ${Boolean(a.isActive)}`);
    details.isActive = { before: Boolean(b.isActive), after: Boolean(a.isActive) };
    changed.isActive = true;
  }

  const summary = parts.length ? parts.join(', ') : 'Branch updated';
  return { summary, details: { changed, ...details } };
}

function titleFromAction(action: string) {
  switch (action) {
    case 'CREATE': return 'Branch created';
    case 'UPDATE': return 'Branch updated';
    case 'DELETE': return 'Branch deleted';
    default: return action.replaceAll('_', ' ').toLowerCase();
  }
}

// ---------------- main ----------------
export async function getBranchActivityForCurrentTenantService(params: GetActivityParams) {
  const tenantId = params.currentTenantId;
  const branchId = params.branchIdPathParam;

  const limit = Math.max(1, Math.min(100, params.limitOptional ?? 50));
  const actorFilter =
    params.actorIdsOptional && params.actorIdsOptional.length ? params.actorIdsOptional : null;

  const cursor = parseCursor(params.cursorOptional);
  const occurredTo = cursor?.iso ?? params.occurredToOptional ?? null;
  const occurredFrom = params.occurredFromOptional ?? null;

  const where: Prisma.AuditEventWhereInput = {
    tenantId,
    entityType: 'BRANCH' as AuditEntityType,
    entityId: branchId,
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

  const orderBy = [{ createdAt: 'desc' } as const, { id: 'desc' } as const];
  const TAKE = Math.max(100, limit * 6);

  const audits = await prisma.auditEvent.findMany({
    where,
    orderBy,
    take: TAKE,
  });

  // hydrate actors
  const actorIds = Array.from(new Set(audits.map(a => a.actorUserId).filter((v): v is string => !!v)));
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, userEmailAddress: true } })
    : [];
  const actorMap = new Map(actors.map(u => [u.id, u.userEmailAddress ?? u.id]));
  const toActor = (userId?: string | null) => (userId ? { userId, display: actorMap.get(userId) ?? userId } : null);

  const items: BranchActivityItem[] = audits.map(a => {
    const action = String(a.action);
    const before = safeBefore(a);
    const after  = safeAfter(a);

    let message = titleFromAction(action);
    let messageParts: Record<string, unknown> | undefined;

    if ((action === 'UPDATE' || action === 'CREATE' || action === 'DELETE') && (before || after)) {
      const h = humanizeBranchChange(before, after);
      if (action === 'UPDATE') {
        message = h.summary;
      } else {
        message = h.summary === 'Branch updated' ? titleFromAction(action) : h.summary;
      }
      messageParts = { entityName: (a as any).entityName ?? undefined, ...h.details };
    }

    return {
      kind: 'audit' as const,
      id: a.id,
      when: a.createdAt.toISOString(),
      action,
      message,
      ...(messageParts ? { messageParts } : {}),
      actor: toActor(a.actorUserId),
      correlationId: a.correlationId ?? null,
      entityName: (a as any).entityName ?? null,
    };
  });

  items.sort((a, b) =>
    a.when > b.when ? -1 : a.when < b.when ? 1 : a.id > b.id ? -1 : a.id < b.id ? 1 : 0
  );

  const final = cursor
    ? items.filter(it => it.when < cursor.iso || (it.when === cursor.iso && it.id < cursor.id))
    : items;

  const pageItems = final.slice(0, limit);
  const last = pageItems[pageItems.length - 1] ?? null;
  const nextCursor = buildNextCursor(last);
  const hasNextPage = final.length > limit;

  // facets (distinct actors for this branch)
  let facets:
    | {
        actors: { userId: string; display: string }[];
      }
    | undefined;

  if (params.includeFacetsOptional) {
    const distinct = await prisma.auditEvent.findMany({
      where: {
        tenantId,
        entityType: 'BRANCH' as AuditEntityType,
        entityId: branchId,
        actorUserId: { not: null },
      },
      distinct: ['actorUserId'],
      select: { actorUserId: true },
    });

    const ids = distinct.map(x => x.actorUserId).filter((v): v is string => !!v);
    const actorsFull = ids.length
      ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, userEmailAddress: true } })
      : [];

    facets = {
      actors: actorsFull.map(u => ({ userId: u.id, display: u.userEmailAddress ?? u.id })),
    };
  }

  let totalCount: number | undefined;
  if (params.includeTotalOptional) {
    totalCount = await prisma.auditEvent.count({ where });
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
