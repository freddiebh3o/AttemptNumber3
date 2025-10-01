/* api-server/src/services/roleProvisioningService.ts */
import type { PrismaClient } from '@prisma/client';
import { prismaClientInstance as prisma } from '../db/prismaClient.js';
import { PERMISSIONS, ROLE_DEFS } from '../rbac/catalog.js';

type Client = PrismaClient;

/**
 * Upsert the global permission catalogue (idempotent).
 * Call this once before creating tenant roles.
 */
export async function ensurePermissionCatalog(client: Client = prisma) {
  for (const p of PERMISSIONS) {
    await client.permission.upsert({
      where: { key: p.key },
      update: { description: p.description },
      create: { key: p.key, description: p.description },
    });
  }
}

/**
 * Ensure a tenant has the default system roles with correct permission links.
 * Idempotent — safe to call multiple times.
 */
export async function ensureTenantSystemRoles(tenantId: string, client: Client = prisma) {
  // Map permission keys -> ids
  const allPerms = await client.permission.findMany({ select: { id: true, key: true } });
  const permIdByKey = new Map(allPerms.map(p => [p.key, p.id] as const));

  for (const [roleName, keys] of Object.entries(ROLE_DEFS) as [keyof typeof ROLE_DEFS, readonly string[]][]) {
    // Upsert the role itself
    const role = await client.role.upsert({
      where: { tenantId_name: { tenantId, name: roleName } },
      update: { description: `${roleName} (seeded)`, isSystem: true },
      create: { tenantId, name: roleName, description: `${roleName} (seeded)`, isSystem: true },
    });

    // Desired permission IDs for this role
    const wantIds = new Set(keys.map(k => permIdByKey.get(k)!));

    // Existing links
    const existing = await client.rolePermission.findMany({
      where: { roleId: role.id },
      select: { permissionId: true },
    });
    const haveIds = new Set(existing.map(e => e.permissionId));

    // Add missing
    const toAdd = [...wantIds].filter(id => !haveIds.has(id));
    if (toAdd.length) {
      await client.rolePermission.createMany({
        data: toAdd.map(permissionId => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      });
    }

    // Remove extras (keep tight)
    const toRemove = [...haveIds].filter(id => !wantIds.has(id));
    if (toRemove.length) {
      await client.rolePermission.deleteMany({
        where: { roleId: role.id, permissionId: { in: toRemove } },
      });
    }
  }
}

/**
 * One-call helper for new tenants: ensures the permission catalogue exists,
 * then creates/aligns the tenant's system roles.
 */
export async function provisionTenantRBAC(tenantId: string, client: Client = prisma) {
  await ensurePermissionCatalog(client);
  await ensureTenantSystemRoles(tenantId, client);
}
