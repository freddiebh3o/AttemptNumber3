// api-server/src/services/theme/tenantThemeActivityService.ts
import { prismaClientInstance as prisma } from '../../db/prismaClient.js';
import type { Prisma, AuditEntityType  } from '@prisma/client';

type GetActivityParams = {
  currentTenantId: string;
  limitOptional?: number;
  cursorOptional?: string | null;       // "<ISO>|<id>"
  occurredFromOptional?: string | null; // ISO
  occurredToOptional?: string | null;   // ISO
  actorIdsOptional?: string[] | null;
  includeFacetsOptional?: boolean;
  includeTotalOptional?: boolean;
};

export type ThemeActivityItem = {
  kind: 'audit';
  id: string;
  when: string; // ISO
  action: string;
  message: string;
  messageParts?: Record<string, unknown>;
  actor?: { userId: string; display: string } | null;
  correlationId?: string | null;
};

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

function buildNextCursor(last?: ThemeActivityItem | null) {
  if (!last) return null;
  return `${last.when}|${last.id}`;
}

function messageForAction(action: string) {
  switch (action) {
    case 'CREATE': return 'Theme created';
    case 'UPDATE': return 'Theme updated';
    case 'THEME_UPDATE': return 'Theme settings updated';
    case 'THEME_LOGO_UPDATE': return 'Logo updated';
    default: return action.replaceAll('_', ' ').toLowerCase();
  }
}

function diffSummary(diffJson: unknown): { changedKeys: number } | undefined {
  if (!diffJson || typeof diffJson !== 'object') return;
  const keys = Object.keys(diffJson as Record<string, unknown>);
  return { changedKeys: keys.length };
}

export async function getTenantThemeActivityForCurrentTenantService(params: GetActivityParams) {
  const tenantId = params.currentTenantId;

  const limit = Math.max(1, Math.min(100, params.limitOptional ?? 50));
  const actorFilter =
    params.actorIdsOptional && params.actorIdsOptional.length ? params.actorIdsOptional : null;

  // Cursor clamps the "to" end
  const cursor = parseCursor(params.cursorOptional);
  const occurredTo = cursor?.iso ?? params.occurredToOptional ?? null;
  const occurredFrom = params.occurredFromOptional ?? null;

  const where: Prisma.AuditEventWhereInput = {
    tenantId,
    entityType: 'TENANT_BRANDING' as AuditEntityType,
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

  // hydrate actors (emails)
  const actorIds = Array.from(
    new Set(audits.map(a => a.actorUserId).filter((v): v is string => !!v))
  );

  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, userEmailAddress: true },
      })
    : [];
  const actorMap = new Map(actors.map(u => [u.id, u.userEmailAddress ?? u.id]));
  const toActor = (userId?: string | null) =>
    userId ? { userId, display: actorMap.get(userId) ?? userId } : null;

  const items: ThemeActivityItem[] = audits.map((a) => {
    const parts = diffSummary(a.diffJson ?? undefined);
  
    return {
      kind: 'audit',
      id: a.id,
      when: a.createdAt.toISOString(),
      action: a.action as string,
      message: messageForAction(a.action as string),
      actor: toActor(a.actorUserId),
      correlationId: a.correlationId ?? null,
      ...(parts ? { messageParts: parts } : {}),
    };
  });

  // sort desc (createdAt, id) – already sorted, but keep stable
  items.sort((a, b) => (a.when > b.when ? -1 : a.when < b.when ? 1 : a.id > b.id ? -1 : a.id < b.id ? 1 : 0));

  // cursor clamp
  const final = cursor
    ? items.filter(it => it.when < cursor.iso || (it.when === cursor.iso && it.id < cursor.id))
    : items;

  const pageItems = final.slice(0, limit);
  const last = pageItems[pageItems.length - 1] ?? null;
  const nextCursor = buildNextCursor(last);
  const hasNextPage = final.length > limit;

  // facets
  let facets:
    | {
        actors: { userId: string; display: string }[];
      }
    | undefined;

  if (params.includeFacetsOptional) {
    const distinctActors = await prisma.auditEvent.findMany({
      where: {
        tenantId,
        entityType: 'TENANT_BRANDING' as AuditEntityType,
        actorUserId: { not: null },
      },
      distinct: ['actorUserId'],
      select: { actorUserId: true },
    });

    const ids = distinctActors.map(x => x.actorUserId).filter((v): v is string => !!v);
    const actorsFull = ids.length
      ? await prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, userEmailAddress: true },
        })
      : [];

    facets = {
      actors: actorsFull.map(u => ({
        userId: u.id,
        display: u.userEmailAddress ?? u.id,
      })),
    };
  }

  // optional total
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
