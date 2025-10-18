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

type FieldDiff = { before: any; after: any };

function coerceVal(v: any) {
  if (v == null) return v;
  if (typeof v === 'object' && 'toNumber' in v && typeof (v as any).toNumber === 'function') {
    try { return (v as any).toNumber(); } catch { /* noop */ }
  }
  if (typeof v === 'object') return JSON.parse(JSON.stringify(v));
  return v;
}

function normalizeSnapshotDiff(before: unknown, after: unknown): Record<string, FieldDiff> {
  const out: Record<string, FieldDiff> = {};
  if (!before && !after) return out;
  const b = (before ?? {}) as Record<string, any>;
  const a = (after ?? {}) as Record<string, any>;
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  for (const k of keys) {
    const vb = b[k];
    const va = a[k];
    if (JSON.stringify(vb) !== JSON.stringify(va)) {
      out[k] = { before: coerceVal(vb), after: coerceVal(va) };
    }
  }
  return out;
}

// Map multiple possible field names to a single alias
function pickFirst<T extends string>(
  diffs: Record<string, FieldDiff>,
  keys: readonly T[],
): { alias: T; diff: FieldDiff } | null {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(diffs, k)) {
      return { alias: k, diff: diffs[k]! }
    }
  }
  return null;
}

function arrayDiff(before: any, after: any) {
  const b = Array.isArray(before) ? before : [];
  const a = Array.isArray(after) ? after : [];
  const bSet = new Set(b);
  const aSet = new Set(a);
  const added = a.filter((x: any) => !bSet.has(x));
  const removed = b.filter((x: any) => !aSet.has(x));
  return { added, removed };
}

const IGNORE_KEYS = new Set([
  'updatedAt','updated_at',
  'entityVersion','version',
  'lastLoginAt','last_login_at',
]);

// Build messageParts for a user audit row (don’t include PII for password)
function buildUserMessageParts(beforeJson: unknown, afterJson: unknown) {
  const diffs = normalizeSnapshotDiff(beforeJson, afterJson);

  // strip ignorable
  for (const k of Object.keys(diffs)) {
    if (IGNORE_KEYS.has(k)) delete diffs[k];
  }

  const parts: Record<string, unknown> = {};

  // Email
  const emailPick = pickFirst(diffs, ['userEmailAddress','email','user_email']);
  if (emailPick) parts.email = { before: emailPick.diff.before, after: emailPick.diff.after };

  // Password (various field shapes)
  const passwordChanged =
    'password' in diffs ||
    'passwordHash' in diffs ||
    'password_hash' in diffs ||
    'pwHash' in diffs ||
    'passwordUpdated' in diffs;
  if (passwordChanged) parts.password = { changed: true };

  // Role
  const rolePick = pickFirst(diffs, ['role','userRole','tenantRole','authRole']);
  if (rolePick) parts.role = { before: rolePick.diff.before, after: rolePick.diff.after };

  // Branch memberships (array of ids)
  const branchesPick =
    pickFirst(diffs, ['branchIds','branches','assignedBranchIds','memberBranchIds']) ||
    null;
  if (branchesPick) {
    const { added, removed } = arrayDiff(branchesPick.diff.before, branchesPick.diff.after);
    parts.branches = { added, removed };
  }

  // Archive status
  const archivedPick = pickFirst(diffs, ['isArchived','archived']);
  if (archivedPick) {
    parts.archived = { before: archivedPick.diff.before, after: archivedPick.diff.after };
  }

  // If nothing recognized, expose a count so UI can still say "N field(s) changed)"
  const remainingKeys = Object.keys(diffs).filter(k =>
    !['userEmailAddress','email','user_email','password','passwordHash','password_hash','pwHash','passwordUpdated',
      'role','userRole','tenantRole','authRole',
      'branchIds','branches','assignedBranchIds','memberBranchIds',
      'isArchived','archived','archivedAt','archivedByUserId',
    ].includes(k)
  );
  if (remainingKeys.length > 0) parts.changedKeys = remainingKeys.length;

  return parts;
}

function summarizeUserChange(action: string, parts?: Record<string, any>) {
  // Don't include the user's email again (we're already on their page).
  if (action !== 'UPDATE' || !parts) {
    // reasonable defaults for non-UPDATE actions
    if (action === 'CREATE') return 'User created';
    if (action === 'DELETE') return 'User deleted';
    if (action === 'ROLE_ASSIGN') return 'Role assigned';
    if (action === 'ROLE_REVOKE') return 'Role revoked';
    return action.replaceAll('_',' ').toLowerCase();
  }

  // Check for archive/restore first (most specific)
  if (parts.archived) {
    const wasArchived = parts.archived.before === true;
    const isNowArchived = parts.archived.after === true;

    if (!wasArchived && isNowArchived) {
      return 'Archived user';
    } else if (wasArchived && !isNowArchived) {
      return 'Restored user';
    }
  }

  const changes: string[] = [];
  if (parts.email) changes.push('email');
  if (parts.password?.changed) changes.push('password');
  if (parts.role) changes.push('role');
  if (parts.branches && (parts.branches.added?.length || parts.branches.removed?.length)) {
    const a = parts.branches.added?.length ?? 0;
    const r = parts.branches.removed?.length ?? 0;
    if (a || r) changes.push(`branches (${a} added, ${r} removed)`);
  }
  if (!changes.length && typeof parts.changedKeys === 'number') {
    return `Updated user · ${parts.changedKeys} field(s) changed`;
  }
  return `Updated user · ${changes.join(', ')}`;
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
  
    const parts = buildUserMessageParts(r.beforeJson as any, r.afterJson as any);
    const message = summarizeUserChange(r.action as string, parts);
  
    const actor = r.actorUserId
      ? { userId: r.actorUserId, display: actorsMap[r.actorUserId] ?? r.actorUserId }
      : null;
  
    return {
      kind: 'audit',
      id: r.id,
      when,
      action: r.action as string, // enum → string
      message,
      ...(Object.keys(parts).length ? { messageParts: parts as Record<string, unknown> } : {}), // ✅ omit if empty
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
