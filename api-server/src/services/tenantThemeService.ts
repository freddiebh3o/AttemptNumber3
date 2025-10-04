import { Prisma, AuditAction, AuditEntityType } from '@prisma/client';
import { prismaClientInstance } from '../db/prismaClient.js';
import { Errors } from '../utils/httpErrors.js';
import { writeAuditEvent } from './auditLoggerService.js';

export type TenantThemePayload = {
  presetKey: string | null;
  overrides: unknown; // already validated in router; keep as unknown here
  logoUrl: string | null;
  updatedAt: Date | null;
  createdAt: Date | null;
};

type AuditCtx = {
  actorUserId?: string | null | undefined;
  correlationId?: string | null | undefined;
  ip?: string | null | undefined;
  userAgent?: string | null | undefined;
};

function auditCtxOrNull(ctx?: AuditCtx) {
  return {
    actorUserId: ctx?.actorUserId ?? null,
    correlationId: ctx?.correlationId ?? null,
    ip: ctx?.ip ?? null,
    userAgent: ctx?.userAgent ?? null,
  };
}

export async function ensureTenantIdForSlugAndSession(
  tenantSlug: string,
  currentTenantId?: string
): Promise<string> {
  if (!currentTenantId) throw Errors.authRequired();

  const tenant = await prismaClientInstance.tenant.findUnique({
    where: { tenantSlug },
    select: { id: true },
  });
  if (!tenant) throw Errors.notFound('Tenant not found');
  if (tenant.id !== currentTenantId) throw Errors.permissionDenied();

  return tenant.id;
}

export async function getTenantThemeService(tenantId: string): Promise<TenantThemePayload> {
  const row = await prismaClientInstance.tenantBranding.findUnique({
    where: { tenantId },
    select: { presetKey: true, overridesJson: true, logoUrl: true, updatedAt: true, createdAt: true },
  });

  return {
    presetKey: row?.presetKey ?? null,
    overrides: (row?.overridesJson as unknown) ?? {},
    logoUrl: row?.logoUrl ?? null,
    updatedAt: row?.updatedAt ?? null,
    createdAt: row?.createdAt ?? null,
  };
}

/**
 * Upsert theme values (preset/overrides/logoUrl). Any omitted fields are set to null (for preset/logo)
 * or {} (for overrides) to keep semantics explicit, matching your previous implementation.
 * Writes a CREATE or UPDATE audit event on TENANT_BRANDING.
 */
export async function upsertTenantThemeService(params: {
  tenantId: string;
  presetKey: string | null | undefined;
  overrides: unknown | undefined;
  logoUrl: string | null | undefined;
  auditContextOptional?: AuditCtx;
}): Promise<TenantThemePayload> {
  const { tenantId, presetKey, overrides, logoUrl, auditContextOptional } = params;

  const result = await prismaClientInstance.$transaction(async (tx) => {
    // Detect whether this is a create vs update (for audit action)
    const before = await tx.tenantBranding.findUnique({
      where: { tenantId },
      select: { presetKey: true, overridesJson: true, logoUrl: true, updatedAt: true, createdAt: true },
    });

    const updated = await tx.tenantBranding.upsert({
      where: { tenantId },
      create: {
        tenantId,
        presetKey: presetKey ?? null,
        overridesJson: (overrides ?? {}) as Prisma.InputJsonValue,
        logoUrl: logoUrl ?? null,
      },
      update: {
        presetKey: presetKey ?? null,
        overridesJson: (overrides ?? {}) as Prisma.InputJsonValue,
        logoUrl: logoUrl ?? null,
      },
      select: { presetKey: true, overridesJson: true, logoUrl: true, updatedAt: true, createdAt: true },
    });

    // AUDIT (best-effort)
    try {
      const meta = auditCtxOrNull(auditContextOptional);
      await writeAuditEvent(tx, {
        tenantId,
        actorUserId: meta.actorUserId,
        entityType: AuditEntityType.TENANT_BRANDING,
        entityId: tenantId,
        action: before ? AuditAction.UPDATE : AuditAction.CREATE,
        entityName: null,
        before: before
          ? {
              presetKey: before.presetKey ?? null,
              overrides: (before.overridesJson as unknown) ?? {},
              logoUrl: before.logoUrl ?? null,
            }
          : null,
        after: {
          presetKey: updated.presetKey ?? null,
          overrides: (updated.overridesJson as unknown) ?? {},
          logoUrl: updated.logoUrl ?? null,
        },
        correlationId: meta.correlationId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      // Optional semantic audit actions
      if (presetKey !== undefined || overrides !== undefined) {
        await writeAuditEvent(tx, {
          tenantId,
          actorUserId: meta.actorUserId,
          entityType: AuditEntityType.TENANT_BRANDING,
          entityId: tenantId,
          action: AuditAction.THEME_UPDATE, // custom enum value in your schema; reuse UPDATE if not available
          entityName: null,
          before: null,
          after: { presetKey: updated.presetKey ?? null, overrides: (updated.overridesJson as unknown) ?? {} },
          correlationId: meta.correlationId,
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
      }
      if (logoUrl !== undefined) {
        await writeAuditEvent(tx, {
          tenantId,
          actorUserId: meta.actorUserId,
          entityType: AuditEntityType.TENANT_BRANDING,
          entityId: tenantId,
          action: AuditAction.THEME_LOGO_UPDATE, // custom enum; reuse UPDATE if not available
          entityName: null,
          before: null,
          after: { logoUrl: updated.logoUrl ?? null },
          correlationId: meta.correlationId,
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
      }
    } catch {
      // swallow audit errors
    }

    return updated;
  });

  return {
    presetKey: result.presetKey ?? null,
    overrides: (result.overridesJson as unknown) ?? {},
    logoUrl: result.logoUrl ?? null,
    updatedAt: result.updatedAt,
    createdAt: result.createdAt,
  };
}

/**
 * Helper dedicated to **logo-only** updates (used by the upload route).
 * Still returns full theme payload and writes an audit event.
 */
export async function upsertTenantLogoOnlyService(params: {
  tenantId: string;
  logoUrl: string;
  auditContextOptional?: AuditCtx;
}): Promise<TenantThemePayload> {
  const { tenantId, logoUrl, auditContextOptional } = params;

  const result = await prismaClientInstance.$transaction(async (tx) => {
    const before = await tx.tenantBranding.findUnique({
      where: { tenantId },
      select: { presetKey: true, overridesJson: true, logoUrl: true, updatedAt: true, createdAt: true },
    });

    const updated = await tx.tenantBranding.upsert({
      where: { tenantId },
      create: {
        tenantId,
        presetKey: before?.presetKey ?? null,
        overridesJson: (before?.overridesJson ?? {}) as Prisma.InputJsonValue,
        logoUrl,
      },
      update: { logoUrl },
      select: { presetKey: true, overridesJson: true, logoUrl: true, updatedAt: true, createdAt: true },
    });

    try {
      const meta = auditCtxOrNull(auditContextOptional);
      // Generic CREATE/UPDATE
      await writeAuditEvent(tx, {
        tenantId,
        actorUserId: meta.actorUserId,
        entityType: AuditEntityType.TENANT_BRANDING,
        entityId: tenantId,
        action: before ? AuditAction.UPDATE : AuditAction.CREATE,
        entityName: null,
        before: before
          ? {
              presetKey: before.presetKey ?? null,
              overrides: (before.overridesJson as unknown) ?? {},
              logoUrl: before.logoUrl ?? null,
            }
          : null,
        after: {
          presetKey: updated.presetKey ?? null,
          overrides: (updated.overridesJson as unknown) ?? {},
          logoUrl: updated.logoUrl ?? null,
        },
        correlationId: meta.correlationId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      // Semantic logo update
      await writeAuditEvent(tx, {
        tenantId,
        actorUserId: meta.actorUserId,
        entityType: AuditEntityType.TENANT_BRANDING,
        entityId: tenantId,
        action: AuditAction.THEME_LOGO_UPDATE, // or UPDATE if not present
        entityName: null,
        before: null,
        after: { logoUrl: updated.logoUrl ?? null },
        correlationId: meta.correlationId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    } catch {
      // swallow audit errors
    }

    return updated;
  });

  return {
    presetKey: result.presetKey ?? null,
    overrides: (result.overridesJson as unknown) ?? {},
    logoUrl: result.logoUrl ?? null,
    updatedAt: result.updatedAt,
    createdAt: result.createdAt,
  };
}
