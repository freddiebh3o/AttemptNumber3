// api-server/scripts/seedPermissionsAndRoles.ts
/// <reference types="node" />
import { prismaClientInstance as prisma } from '../src/db/prismaClient.js';

const PERMISSIONS = [
  // Products
  { key: 'products:read',  description: 'View products' },
  { key: 'products:write', description: 'Create/update/delete products' },

  // Users / roles / tenancy
  { key: 'users:manage',   description: 'Invite or manage tenant users' },
  { key: 'roles:manage',   description: 'Create/edit roles and permissions' },
  { key: 'tenant:manage',  description: 'Manage tenant settings' },

  // Theme & uploads
  { key: 'theme:manage',   description: 'Manage tenant theme/branding' },
  { key: 'uploads:write',  description: 'Upload images/files' },
] as const;

const ROLE_DEFS = {
  OWNER:  ['products:read','products:write','users:manage','roles:manage','tenant:manage','theme:manage','uploads:write'],
  ADMIN:  ['products:read','products:write','users:manage','theme:manage','uploads:write'], // no roles:manage, no tenant:manage
  EDITOR: ['products:read','products:write','uploads:write'],
  VIEWER: ['products:read'],
} as const;

type RoleNameKey = keyof typeof ROLE_DEFS;

async function main() {
  // 1) Upsert permission catalogue
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { description: p.description },
      create: { key: p.key, description: p.description },
    });
  }

  // Build a key->id map for quick linking
  const permMap = new Map(
    (await prisma.permission.findMany({ select: { id: true, key: true } }))
      .map(p => [p.key, p.id] as const)
  );

  // 2) Per-tenant roles + sync role-permissions
  const tenants = await prisma.tenant.findMany({ select: { id: true, tenantSlug: true } });

  for (const t of tenants) {
    for (const [roleName, keys] of Object.entries(ROLE_DEFS) as [RoleNameKey, readonly string[]][]) {
      const role = await prisma.role.upsert({
        where: { tenantId_name: { tenantId: t.id, name: roleName } },
        update: { description: `${roleName} (seeded)`, isSystem: true },
        create: { tenantId: t.id, name: roleName, description: `${roleName} (seeded)`, isSystem: true },
      });

      // Desired permission ids for this role
      const wantIds = new Set(keys.map(k => permMap.get(k)!));

      // Current links
      const existing = await prisma.rolePermission.findMany({
        where: { roleId: role.id },
        select: { permissionId: true },
      });
      const haveIds = new Set(existing.map(e => e.permissionId));

      // Add missing
      const toAdd = [...wantIds].filter(id => !haveIds.has(id));
      if (toAdd.length) {
        await prisma.rolePermission.createMany({
          data: toAdd.map(permissionId => ({ roleId: role.id, permissionId })),
          skipDuplicates: true,
        });
      }

      // Remove extras
      const toRemove = [...haveIds].filter(id => !wantIds.has(id));
      if (toRemove.length) {
        await prisma.rolePermission.deleteMany({
          where: { roleId: role.id, permissionId: { in: toRemove } },
        });
      }
    }
  }

  // 3) (Removed) Legacy roleName -> roleId mapping
  // Your schema no longer uses roleName; memberships should already have roleId.

  const countRoles = await prisma.role.count();
  const countLinks = await prisma.rolePermission.count();
  console.log(`Seed complete: ${PERMISSIONS.length} permissions, ${countRoles} roles, ${countLinks} role-permission links`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
