/* api-server/src/services/permissionService.ts */
import { prismaClientInstance as prisma } from '../db/prismaClient.js';
import type { PermissionKey } from '../utils/permissions.js';

export async function getPermissionKeysForUserInTenant(params: {
  userId: string;
  tenantId: string;
}): Promise<Set<PermissionKey>> {
  const { userId, tenantId } = params;

  const membership = await prisma.userTenantMembership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
    select: {
      role: {
        select: {
          id: true,
          permissions: {
            select: { permission: { select: { key: true } } },
          },
        },
      },
    },
  });

  const out = new Set<PermissionKey>();
  const keysFromRole =
    membership?.role?.permissions?.map((p) => p.permission.key) ?? [];
  for (const k of keysFromRole) out.add(k as PermissionKey);
  return out;
}
