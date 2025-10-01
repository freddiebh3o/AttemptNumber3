// api-server/src/services/tenantUserService.ts
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { Errors } from '../utils/httpErrors.js';
import { prismaClientInstance } from '../db/prismaClient.js';

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

async function countOwners(tenantId: string) {
  const ownerRole = await prismaClientInstance.role.findUnique({
    where: { tenantId_name: { tenantId, name: 'OWNER' } },
    select: { id: true },
  });
  if (!ownerRole) return 0;
  return prismaClientInstance.userTenantMembership.count({
    where: { tenantId, roleId: ownerRole.id },
  });
}

async function isOwner(tenantId: string, userId: string) {
  const m = await prismaClientInstance.userTenantMembership.findUnique({
    where: { userId_tenantId: { tenantId, userId } },
    select: { role: { select: { name: true } } },
  });
  return m?.role?.name === 'OWNER';
}

/**
 * List tenant users with role info.
 * Supports filters by email, roleId, roleName (contains), date ranges, and sorting (including role.name).
 */
export async function listUsersForCurrentTenantService(params: {
  currentTenantId: string;
  limitOptional?: number;
  cursorIdOptional?: string;
  // filters
  qOptional?: string;
  roleIdOptional?: string;         // exact roleId
  roleNameOptional?: string;       // contains on role.name (case-insensitive)
  createdAtFromOptional?: string;  // 'YYYY-MM-DD'
  createdAtToOptional?: string;    // 'YYYY-MM-DD'
  updatedAtFromOptional?: string;  // 'YYYY-MM-DD'
  updatedAtToOptional?: string;    // 'YYYY-MM-DD'
  // sort
  sortByOptional?: 'createdAt' | 'updatedAt' | 'userEmailAddress' | 'role';
  sortDirOptional?: 'asc' | 'desc';
  includeTotalOptional?: boolean;
}) {
  const {
    currentTenantId,
    limitOptional = 20,
    cursorIdOptional,
    qOptional,
    roleIdOptional,
    roleNameOptional,
    createdAtFromOptional,
    createdAtToOptional,
    updatedAtFromOptional,
    updatedAtToOptional,
    sortByOptional = 'createdAt',
    sortDirOptional = 'desc',
    includeTotalOptional = false,
  } = params;

  // Build date filters (inclusive "to" by using < next day)
  const createdAt: Prisma.DateTimeFilter = {};
  if (createdAtFromOptional) createdAt.gte = new Date(createdAtFromOptional);
  if (createdAtToOptional) createdAt.lt = addDays(new Date(createdAtToOptional), 1);

  const updatedAt: Prisma.DateTimeFilter = {};
  if (updatedAtFromOptional) updatedAt.gte = new Date(updatedAtFromOptional);
  if (updatedAtToOptional) updatedAt.lt = addDays(new Date(updatedAtToOptional), 1);

  const where: Prisma.UserTenantMembershipWhereInput = {
    tenantId: currentTenantId,
    ...(qOptional && {
      user: { userEmailAddress: { contains: qOptional, mode: 'insensitive' } },
    }),
    ...(roleIdOptional && { roleId: roleIdOptional }),
    ...(roleNameOptional && {
      role: { name: { contains: roleNameOptional, mode: 'insensitive' } },
    }),
    ...((createdAt.gte || createdAt.lt) && { createdAt }),
    ...((updatedAt.gte || updatedAt.lt) && { updatedAt }),
  };

  // Sort mapping (role => role.name)
  const orderBy: Prisma.UserTenantMembershipOrderByWithRelationInput =
    sortByOptional === 'userEmailAddress'
      ? { user: { userEmailAddress: sortDirOptional } }
      : sortByOptional === 'role'
      ? { role: { name: sortDirOptional } }
      : ({ [sortByOptional]: sortDirOptional } as Prisma.UserTenantMembershipOrderByWithRelationInput);

  const take = Math.max(1, Math.min(100, limitOptional));
  const cursor = cursorIdOptional ? { id: cursorIdOptional } : undefined;

  const [rows, total] = await Promise.all([
    prismaClientInstance.userTenantMembership.findMany({
      where,
      take,
      ...(cursor && { skip: 1, cursor }),
      orderBy,
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, userEmailAddress: true } },
        role: {
          select: {
            id: true,
            tenantId: true,
            name: true,
            description: true,
            isSystem: true,
            createdAt: true,
            updatedAt: true,
            permissions: { select: { permission: { select: { key: true } } } },
          },
        },
      },
    }),
    includeTotalOptional
      ? prismaClientInstance.userTenantMembership.count({ where })
      : Promise.resolve(0),
  ]);

  const items = rows.map((m) => ({
    userId: m.user.id,
    userEmailAddress: m.user.userEmailAddress,
    role: m.role
      ? {
          id: m.role.id,
          tenantId: m.role.tenantId,
          name: m.role.name,
          description: m.role.description ?? null,
          isSystem: m.role.isSystem,
          permissions: m.role.permissions.map((rp) => rp.permission.key),
          createdAt: m.role.createdAt.toISOString(),
          updatedAt: m.role.updatedAt.toISOString(),
        }
      : null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  }));

  const last = rows.at(-1);
  const nextCursor = last ? last.id : null;

  return {
    items,
    pageInfo: {
      hasNextPage: Boolean(nextCursor),
      nextCursor,
      ...(includeTotalOptional ? { totalCount: total } : {}),
    },
    applied: {
      limit: take,
      sort: { field: sortByOptional, direction: sortDirOptional },
      filters: {
        ...(qOptional ? { q: qOptional } : {}),
        ...(roleIdOptional ? { roleId: roleIdOptional } : {}),
        ...(roleNameOptional ? { roleName: roleNameOptional } : {}),
        ...(createdAtFromOptional ? { createdAtFrom: createdAtFromOptional } : {}),
        ...(createdAtToOptional ? { createdAtTo: createdAtToOptional } : {}),
        ...(updatedAtFromOptional ? { updatedAtFrom: updatedAtFromOptional } : {}),
        ...(updatedAtToOptional ? { updatedAtTo: updatedAtToOptional } : {}),
      },
    },
  };
}

/**
 * Create (or attach) a user to the current tenant with a role.
 * If a user with the same email exists, we attach membership (idempotent-ish).
 */
export async function createOrAttachUserToTenantService(params: {
  currentTenantId: string;
  email: string;
  password: string;
  roleId: string;
}) {
  const { currentTenantId, email, password, roleId } = params;

  // Validate role belongs to tenant
  const role = await prismaClientInstance.role.findUnique({
    where: { id: roleId },
    select: {
      id: true,
      tenantId: true,
      name: true,
      description: true,
      isSystem: true,
      createdAt: true,
      updatedAt: true,
      permissions: { select: { permission: { select: { key: true } } } },
    },
  });
  if (!role || role.tenantId !== currentTenantId) {
    throw Errors.validation('Invalid role', 'Role not found for this tenant.');
  }

  // Find or create user
  const existingUser = await prismaClientInstance.user.findUnique({
    where: { userEmailAddress: email },
  });

  let userId: string;
  if (!existingUser) {
    const hashed = await bcrypt.hash(password, 10);
    const user = await prismaClientInstance.user.create({
      data: { userEmailAddress: email, userHashedPassword: hashed },
      select: { id: true, userEmailAddress: true },
    });
    userId = user.id;
  } else {
    userId = existingUser.id;
  }

  // Upsert membership (roleId only; roleName deprecated)
  const membership = await prismaClientInstance.userTenantMembership.upsert({
    where: { userId_tenantId: { userId, tenantId: currentTenantId } },
    update: { roleId: role.id },
    create: { userId, tenantId: currentTenantId, roleId: role.id },
    select: {
      createdAt: true,
      updatedAt: true,
      user: { select: { id: true, userEmailAddress: true } },
    },
  });

  return {
    userId: membership.user.id,
    userEmailAddress: membership.user.userEmailAddress,
    role: {
      id: role.id,
      tenantId: role.tenantId,
      name: role.name,
      description: role.description ?? null,
      isSystem: role.isSystem,
      permissions: role.permissions.map((rp) => rp.permission.key),
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
    },
    createdAt: membership.createdAt.toISOString(),
    updatedAt: membership.updatedAt.toISOString(),
  };
}

export async function updateTenantUserService(params: {
  currentTenantId: string;
  currentUserId: string;  // actor
  targetUserId: string;
  newEmailOptional?: string;
  newPasswordOptional?: string;
  newRoleIdOptional?: string; // roleId, not roleName
}) {
  const { currentTenantId, targetUserId } = params;

  // Fetch membership and (maybe) nextRole outside tx for fast 404/validation
  const membership = await prismaClientInstance.userTenantMembership.findUnique({
    where: { userId_tenantId: { userId: targetUserId, tenantId: currentTenantId } },
    select: {
      user: { select: { id: true, userEmailAddress: true } },
      role: { select: { id: true, name: true } },
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!membership) throw Errors.notFound('User is not a member of this tenant.');

  let nextRoleId: string | undefined;
  if (params.newRoleIdOptional !== undefined) {
    const nextRole = await prismaClientInstance.role.findUnique({
      where: { id: params.newRoleIdOptional },
      select: { id: true, name: true, tenantId: true },
    });
    if (!nextRole || nextRole.tenantId !== currentTenantId) {
      throw Errors.validation('Invalid role', 'Role not found for this tenant.');
    }
    nextRoleId = nextRole.id;
  }

  // Perform sensitive membership updates inside a transaction to avoid races
  await prismaClientInstance.$transaction(async (tx) => {
    // Handle role change with "last OWNER" protection
    if (nextRoleId !== undefined) {
      const currRoleName = membership.role?.name ?? null;

      if (currRoleName === 'OWNER') {
        // Re-check inside the transaction
        const ownerRole = await tx.role.findUnique({
          where: { tenantId_name: { tenantId: currentTenantId, name: 'OWNER' } },
          select: { id: true },
        });
        if (!ownerRole) throw Errors.internal('OWNER role missing for tenant.');

        const owners = await tx.userTenantMembership.count({
          where: { tenantId: currentTenantId, roleId: ownerRole.id },
        });

        // Determine if the next role keeps the user as OWNER
        const isNextOwner = nextRoleId === ownerRole.id;

        if (!isNextOwner && owners <= 1) {
          throw Errors.cantDeleteLastOwner();
        }
      }

      await tx.userTenantMembership.update({
        where: { userId_tenantId: { userId: targetUserId, tenantId: currentTenantId } },
        data: { roleId: nextRoleId },
      });
    }

    // Account updates (email/password) — safe to do in the same tx
    if (params.newEmailOptional !== undefined || params.newPasswordOptional !== undefined) {
      const data: { userEmailAddress?: string; userHashedPassword?: string } = {};
      if (params.newEmailOptional !== undefined) data.userEmailAddress = params.newEmailOptional;
      if (params.newPasswordOptional !== undefined) {
        data.userHashedPassword = await bcrypt.hash(params.newPasswordOptional, 10);
      }
      await tx.user.update({ where: { id: targetUserId }, data });
    }
  });

  // Fresh selection with role + permissions
  const fresh = await prismaClientInstance.userTenantMembership.findUnique({
    where: { userId_tenantId: { userId: targetUserId, tenantId: currentTenantId } },
    select: {
      createdAt: true,
      updatedAt: true,
      user: { select: { id: true, userEmailAddress: true } },
      role: {
        select: {
          id: true,
          tenantId: true,
          name: true,
          description: true,
          isSystem: true,
          createdAt: true,
          updatedAt: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      },
    },
  });

  if (!fresh || !fresh.user || !fresh.role) {
    throw Errors.internal('State mismatch after update.');
  }

  return {
    userId: fresh.user.id,
    userEmailAddress: fresh.user.userEmailAddress,
    role: {
      id: fresh.role.id,
      tenantId: fresh.role.tenantId,
      name: fresh.role.name,
      description: fresh.role.description ?? null,
      isSystem: fresh.role.isSystem,
      permissions: fresh.role.permissions.map((rp) => rp.permission.key),
      createdAt: fresh.role.createdAt.toISOString(),
      updatedAt: fresh.role.updatedAt.toISOString(),
    },
    createdAt: fresh.createdAt.toISOString(),
    updatedAt: fresh.updatedAt.toISOString(),
  };
}

/**
 * Remove a user from the current tenant.
 */
export async function removeUserFromTenantService(params: {
  currentTenantId: string;
  currentUserId: string;
  targetUserId: string;
}) {
  const { currentTenantId, targetUserId } = params;

  // Do the sensitive check + delete in one transaction to prevent races
  const result = await prismaClientInstance.$transaction(async (tx) => {
    const ownerRole = await tx.role.findUnique({
      where: { tenantId_name: { tenantId: currentTenantId, name: 'OWNER' } },
      select: { id: true },
    });
    if (!ownerRole) throw Errors.internal('OWNER role missing for tenant.');

    // Is target currently an OWNER?
    const targetMembership = await tx.userTenantMembership.findUnique({
      where: { userId_tenantId: { userId: targetUserId, tenantId: currentTenantId } },
      select: { roleId: true },
    });
    if (!targetMembership) return { hasRemovedMembership: false }; // nothing to do

    const isTargetOwner = targetMembership.roleId === ownerRole.id;
    if (isTargetOwner) {
      const owners = await tx.userTenantMembership.count({
        where: { tenantId: currentTenantId, roleId: ownerRole.id },
      });
      if (owners <= 1) throw Errors.cantDeleteLastOwner();
    }

    const deleted = await tx.userTenantMembership.deleteMany({
      where: { userId: targetUserId, tenantId: currentTenantId },
    });

    return { hasRemovedMembership: deleted.count > 0 };
  });

  return result;
}
