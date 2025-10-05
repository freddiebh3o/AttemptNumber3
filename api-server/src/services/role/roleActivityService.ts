// api-server/src/services/role/roleActivityService.ts
import { prismaClientInstance as prisma } from '../../db/prismaClient.js';
import type { Prisma, AuditEntityType } from '@prisma/client';

type GetActivityParams = {
  currentTenantId: string;
  roleIdPathParam: string;
  limitOptional?: number;
  cursorOptional?: string | null;       // "ISO|id"
  occurredFromOptional?: string | null; // ISO
  occurredToOptional?: string | null;   // ISO
  actorIdsOptional?: string[] | null;
  includeFacetsOptional?: boolean;
  includeTotalOptional?: boolean;
};

export type RoleActivityItem = {
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
function buildNextCursor(last?: RoleActivityItem | null) {
  if (!last) return null;
  return `${last.when}|${last.id}`;
}

// ---------------- humanization helpers ----------------
type RoleSnap = {
  name?: string | null;
  description?: string | null;
  isSystem?: boolean | null;
  permissions?: string[]; // permission keys
};

const jsonEqual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const truncate = (s: string | null | undefined, n = 120) =>
  s == null ? (s ?? null) : s.length > n ? `${s.slice(0, n)}…` : s;
const quote = (s: string | null | undefined) => (s == null || s === '' ? '—' : `“${s}”`);

function safeBefore(a: any): RoleSnap | undefined {
  // tolerate different columns: beforeJson/before
  return (a?.beforeJson as RoleSnap | undefined) ?? (a?.before as RoleSnap | undefined);
}
function safeAfter(a: any): RoleSnap | undefined {
  return (a?.afterJson as RoleSnap | undefined) ?? (a?.after as RoleSnap | undefined);
}

function humanizeRoleChange(before?: RoleSnap, after?: RoleSnap) {
  const b = before ?? {};
  const a = after ?? {};
  const parts: string[] = [];
  const details: Record<string, unknown> = {};
  const changed: Record<string, boolean> = {};

  // name
  if (b.name !== a.name) {
    parts.push(`renamed ${quote(b.name)} → ${quote(a.name)}`);
    details.name = { before: b.name ?? null, after: a.name ?? null };
    changed.name = true;
  }

  // description (with preview)
  const bDesc = b.description ?? null;
  const aDesc = a.description ?? null;
  if (bDesc !== aDesc) {
    const pretty =
      !bDesc && aDesc
        ? `description set to ${quote(truncate(aDesc))}`
        : bDesc && !aDesc
        ? 'description cleared'
        : `description updated to ${quote(truncate(aDesc))}`;
    parts.push(pretty);
    details.description = { before: truncate(bDesc), after: truncate(aDesc) };
    changed.description = true;
  }

  // permissions (with counts + preview)
  const bp = new Set((b.permissions ?? []).slice().sort());
  const ap = new Set((a.permissions ?? []).slice().sort());

  if (!jsonEqual([...bp], [...ap])) {
    const added = [...ap].filter((k) => !bp.has(k)).sort();
    const removed = [...bp].filter((k) => !ap.has(k)).sort();
    const kept = [...ap].filter((k) => bp.has(k)).sort();

    const addPart = added.length ? `+${added.length}` : '';
    const remPart = removed.length ? `-${removed.length}` : '';
    const permPart = [addPart, remPart].filter(Boolean).join(' / ');
    if (permPart) parts.push(`permissions ${permPart}`);

    details.permissions = {
      added,
      removed,
      kept,
      preview: {
        added: added.slice(0, 5),
        removed: removed.slice(0, 5),
        truncatedAdded: Math.max(0, added.length - 5),
        truncatedRemoved: Math.max(0, removed.length - 5),
      },
    };
    changed.permissions = true;
  }

  // isSystem rarely changes (but include if it ever does)
  if ((b.isSystem ?? false) !== (a.isSystem ?? false)) {
    parts.push(`isSystem → ${Boolean(a.isSystem)}`);
    details.isSystem = { before: Boolean(b.isSystem), after: Boolean(a.isSystem) };
    changed.isSystem = true;
  }

  const summary = parts.length ? parts.join(', ') : 'Role updated';
  return { summary, details: { changed, ...details } };
}

function titleFromAction(action: string) {
  switch (action) {
    case 'CREATE':
      return 'Role created';
    case 'UPDATE':
      return 'Role updated';
    case 'DELETE':
      return 'Role deleted';
    default:
      return action.replaceAll('_', ' ').toLowerCase();
  }
}

// ---------------- main ----------------
export async function getRoleActivityForCurrentTenantService(params: GetActivityParams) {
  const tenantId = params.currentTenantId;
  const roleId = params.roleIdPathParam;

  const limit = Math.max(1, Math.min(100, params.limitOptional ?? 50));
  const actorFilter =
    params.actorIdsOptional && params.actorIdsOptional.length ? params.actorIdsOptional : null;

  // cursor → clamp occurredTo
  const cursor = parseCursor(params.cursorOptional);
  const occurredTo = cursor?.iso ?? params.occurredToOptional ?? null;
  const occurredFrom = params.occurredFromOptional ?? null;

  const where: Prisma.AuditEventWhereInput = {
    tenantId,
    entityType: 'ROLE' as AuditEntityType,
    entityId: roleId,
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
  const actorIds = Array.from(
    new Set(audits.map((a) => a.actorUserId).filter((v): v is string => !!v))
  );
  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, userEmailAddress: true },
      })
    : [];
  const actorMap = new Map(actors.map((u) => [u.id, u.userEmailAddress ?? u.id]));
  const toActor = (userId?: string | null) =>
    userId ? { userId, display: actorMap.get(userId) ?? userId } : null;

  const items: RoleActivityItem[] = audits.map((a) => {
    const action = String(a.action);
    const before = safeBefore(a);
    const after = safeAfter(a);

    let message = titleFromAction(action);
    let messageParts: Record<string, unknown> | undefined;

    if ((action === 'UPDATE' || action === 'CREATE' || action === 'DELETE') && (before || after)) {
      const h = humanizeRoleChange(before, after);
      // Prefer humanized summary for UPDATE.
      // For CREATE/DELETE, keep explicit title if no interesting change was detected,
      // otherwise use the humanized summary (creates can include "description set", "+N permissions", etc.)
      if (action === 'UPDATE') {
        message = h.summary;
      } else {
        message = h.summary === 'Role updated' ? titleFromAction(action) : h.summary;
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

  // stable sort (already desc, keep stable)
  items.sort((a, b) =>
    a.when > b.when ? -1 : a.when < b.when ? 1 : a.id > b.id ? -1 : a.id < b.id ? 1 : 0
  );

  // cursor clamp
  const final = cursor
    ? items.filter(
        (it) => it.when < cursor.iso || (it.when === cursor.iso && it.id < cursor.id)
      )
    : items;

  const pageItems = final.slice(0, limit);
  const last = pageItems[pageItems.length - 1] ?? null;
  const nextCursor = buildNextCursor(last);
  const hasNextPage = final.length > limit;

  // facets (distinct actors for this role)
  let facets:
    | {
        actors: { userId: string; display: string }[];
      }
    | undefined;

  if (params.includeFacetsOptional) {
    const distinct = await prisma.auditEvent.findMany({
      where: {
        tenantId,
        entityType: 'ROLE' as AuditEntityType,
        entityId: roleId,
        actorUserId: { not: null },
      },
      distinct: ['actorUserId'],
      select: { actorUserId: true },
    });

    const ids = distinct.map((x) => x.actorUserId).filter((v): v is string => !!v);
    const actorsFull = ids.length
      ? await prisma.user.findMany({
          where: { id: { in: ids } },
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
