// api-server/src/services/permissionService.ts
import { prismaClientInstance as prisma } from '../db/prismaClient.js';
import type { PermissionKey } from '../utils/permissions.js';
import { ROLE_NAME_TO_PERMS } from '../utils/permissions.js';

export async function getPermissionKeysForUserInTenant(params: {
  userId: string;
  tenantId: string;
}): Promise<Set<PermissionKey>> {
  const { userId, tenantId } = params;

  // Grab membership + role + role.permissions.permission.key
  const membership = await prisma.userTenantMembership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
    select: {
      roleName: true, // legacy
      role: {
        select: {
          id: true,
          name: true,
          permissions: {
            select: {
              permission: { select: { key: true } },
            },
          },
        },
      },
    },
  });

  const out = new Set<PermissionKey>();

  // 1) New-way: role->permissions (authoritative going forward)
  const keysFromRole = membership?.role?.permissions?.map(p => p.permission.key) ?? [];
  for (const k of keysFromRole) out.add(k as PermissionKey);

  // 2) Legacy fallback: add perms implied by old RoleName if still present
  const legacy = membership?.roleName ? ROLE_NAME_TO_PERMS[membership.roleName] : undefined;
  if (legacy) for (const k of legacy) out.add(k);

  return out;
}
