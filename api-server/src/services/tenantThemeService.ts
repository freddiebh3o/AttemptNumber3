// api-server/src/services/tenantThemeService.ts
import { Prisma } from '@prisma/client';
import { prismaClientInstance } from '../db/prismaClient.js';
import { Errors } from '../utils/httpErrors.js';

export type TenantThemePayload = {
  presetKey: string | null;
  overrides: unknown; // already validated in router; keep as unknown here
  logoUrl: string | null;
  updatedAt: Date | null;
  createdAt: Date | null;
};

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

export async function upsertTenantThemeService(params: {
  tenantId: string;
  presetKey: string | null | undefined;
  overrides: unknown | undefined;
  logoUrl: string | null | undefined;
}): Promise<TenantThemePayload> {
  const { tenantId, presetKey, overrides, logoUrl } = params;

  const updated = await prismaClientInstance.tenantBranding.upsert({
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

  return {
    presetKey: updated.presetKey ?? null,
    overrides: (updated.overridesJson as unknown) ?? {},
    logoUrl: updated.logoUrl ?? null,
    updatedAt: updated.updatedAt,
    createdAt: updated.createdAt,
  };
}
