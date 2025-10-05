// api-server/src/services/theme/tenantThemeActivityService.ts
import { prismaClientInstance as prisma } from '../../db/prismaClient.js';
import type { Prisma, AuditEntityType } from '@prisma/client';

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

function buildNextCursor(last?: ThemeActivityItem | null) {
  if (!last) return null;
  return `${last.when}|${last.id}`;
}

// ---------------- diff helpers ----------------

function jsonEqual(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

type BrandingSnap = {
  presetKey?: string | null;
  overrides?: {
    colorScheme?: 'light' | 'dark';
    primaryColor?: string;
    primaryShade?: number | { light?: number; dark?: number };
    colors?: Record<string, string[]>;
    defaultRadius?: string;
    fontFamily?: string;
  } | null;
  logoUrl?: string | null;
};

function safeBefore(a: any): BrandingSnap | undefined {
  // Be tolerant to different column names (beforeJson/before)
  return (a?.beforeJson as BrandingSnap | undefined)
      ?? (a?.before as BrandingSnap | undefined);
}

function safeAfter(a: any): BrandingSnap | undefined {
  return (a?.afterJson as BrandingSnap | undefined)
      ?? (a?.after as BrandingSnap | undefined);
}

function humanizePrimaryShade(v: unknown) {
  if (typeof v === 'number') return String(v);
  if (v && typeof v === 'object') {
    const o = v as any;
    const l = o.light ?? '—';
    const d = o.dark  ?? '—';
    return `light ${l}, dark ${d}`;
  }
  return '—';
}

function humanizeThemeChange(before?: BrandingSnap, after?: BrandingSnap) {
  const parts: string[] = [];
  const details: Record<string, unknown> = {};
  const changed: Record<string, boolean> = {};

  const b = before ?? {};
  const a = after ?? {};

  // preset
  if (b.presetKey !== a.presetKey) {
    parts.push(`preset → ${a.presetKey ?? 'None'}`);
    details.preset = { before: b.presetKey ?? null, after: a.presetKey ?? null };
    changed.preset = true;
  }

  const bo = (b.overrides ?? {}) as NonNullable<BrandingSnap['overrides']>;
  const ao = (a.overrides ?? {}) as NonNullable<BrandingSnap['overrides']>;

  // primaryColor
  if (bo.primaryColor !== ao.primaryColor) {
    parts.push(`primaryColor ${bo.primaryColor ?? '—'} → ${ao.primaryColor ?? '—'}`);
    details.primaryColor = { before: bo.primaryColor ?? null, after: ao.primaryColor ?? null };
    changed.primaryColor = true;
  }

  // primaryShade
  if (!jsonEqual(bo.primaryShade, ao.primaryShade)) {
    parts.push(`shades ${humanizePrimaryShade(bo.primaryShade)} → ${humanizePrimaryShade(ao.primaryShade)}`);
    details.primaryShade = { before: bo.primaryShade ?? null, after: ao.primaryShade ?? null };
    changed.primaryShade = true;
  }

  // defaultRadius
  if (bo.defaultRadius !== ao.defaultRadius) {
    parts.push(`defaultRadius ${bo.defaultRadius ?? '—'} → ${ao.defaultRadius ?? '—'}`);
    details.defaultRadius = { before: bo.defaultRadius ?? null, after: ao.defaultRadius ?? null };
    changed.defaultRadius = true;
  }

  // fontFamily
  if (bo.fontFamily !== ao.fontFamily) {
    parts.push(`fontFamily ${bo.fontFamily ?? '—'} → ${ao.fontFamily ?? '—'}`);
    details.fontFamily = { before: bo.fontFamily ?? null, after: ao.fontFamily ?? null };
    changed.fontFamily = true;
  }

  // colors (palettes)
  const bc = bo.colors ?? {};
  const ac = ao.colors ?? {};
  if (!jsonEqual(bc, ac)) {
    const beforeKeys = Object.keys(bc);
    const afterKeys  = Object.keys(ac);
    const added   = afterKeys.filter(k => !beforeKeys.includes(k));
    const removed = beforeKeys.filter(k => !afterKeys.includes(k));
    const updated = afterKeys.filter(k => beforeKeys.includes(k) && !jsonEqual(bc[k], ac[k]));

    const buckets: string[] = [];
    if (added.length)   buckets.push(`+${added.length} palette(s): ${added.join(', ')}`);
    if (removed.length) buckets.push(`-${removed.length} palette(s): ${removed.join(', ')}`);
    if (updated.length) buckets.push(`updated ${updated.length} palette(s): ${updated.join(', ')}`);

    if (buckets.length) parts.push(buckets.join('; '));
    details.colors = { added, removed, updated };
    changed.colors = true;
  }

  // logo
  const logoChanged = (b.logoUrl ?? null) !== (a.logoUrl ?? null);
  if (logoChanged) {
    const summary =
      !b.logoUrl && a.logoUrl ? 'logo added'
      : b.logoUrl && !a.logoUrl ? 'logo removed'
      : 'logo updated';
    parts.push(summary);
    details.logo = { before: b.logoUrl ?? null, after: a.logoUrl ?? null };
    changed.logo = true;
  }

  const summary = parts.length ? parts.join(', ') : 'Theme settings updated';
  return { summary, details: { changed, ...details } };
}

function titleCaseFromAction(action: string) {
  return action.replaceAll('_', ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
}

// ------------------------------------------------

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
    // If you have explicit columns for before/after, you can select them to avoid loading huge rows.
    // select: { id: true, action: true, createdAt: true, correlationId: true, actorUserId: true, beforeJson: true, afterJson: true }
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
    const action = String(a.action);
    const before = safeBefore(a);
    const after  = safeAfter(a);

    let message = '';

    // Prefer a humanized message whenever we have snapshots
    if ((action === 'THEME_UPDATE' || action === 'UPDATE' || action === 'CREATE') && (before || after)) {
      const h = humanizeThemeChange(before, after);
      message = h.summary;

      const parts: Record<string, unknown> = { ...h.details };
      return {
        kind: 'audit',
        id: a.id,
        when: a.createdAt.toISOString(),
        action,
        message,
        actor: toActor(a.actorUserId),
        correlationId: a.correlationId ?? null,
        ...(Object.keys(parts).length ? { messageParts: parts } : {}),
      };
    }

    // Fallbacks (including rare/legacy THEME_LOGO_UPDATE)
    if (action === 'THEME_LOGO_UPDATE' && (before || after)) {
      const bUrl = before?.logoUrl ?? null;
      const aUrl = after?.logoUrl ?? null;
      if (bUrl === aUrl) {
        message = 'Logo unchanged';
      } else if (!bUrl && aUrl) {
        message = 'Logo added';
      } else if (bUrl && !aUrl) {
        message = 'Logo removed';
      } else {
        message = 'Logo updated';
      }
      const parts = { logo: { before: bUrl, after: aUrl }, changed: { logo: bUrl !== aUrl } };
      return {
        kind: 'audit',
        id: a.id,
        when: a.createdAt.toISOString(),
        action,
        message,
        actor: toActor(a.actorUserId),
        correlationId: a.correlationId ?? null,
        messageParts: parts,
      };
    }

    // Absolute fallback to something readable
    message = titleCaseFromAction(action);

    return {
      kind: 'audit',
      id: a.id,
      when: a.createdAt.toISOString(),
      action,
      message,
      actor: toActor(a.actorUserId),
      correlationId: a.correlationId ?? null,
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
