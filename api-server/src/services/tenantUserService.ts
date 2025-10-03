// api-server/src/services/tenantUserService.ts
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { Errors } from '../utils/httpErrors.js';
import { prismaClientInstance } from '../db/prismaClient.js';
import type { Prisma as PrismaNS } from '@prisma/client';

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

async function syncUserBranches(
  tx: PrismaNS.TransactionClient,
  tenantId: string,
  userId: string,
  branchIds: string[]
) {
  const unique = Array.from(new Set(branchIds ?? []));

  // Validate all belong to tenant
  if (unique.length) {
    const valid = await tx.branch.findMany({
      where: { tenantId, id: { in: unique } },
      select: { id: true },
    });
    if (valid.length !== unique.length) {
      throw Errors.validation('Invalid branches', 'One or more branches do not belong to this tenant.');
    }
  }

  // Existing memberships
  const existing = await tx.userBranchMembership.findMany({
    where: { tenantId, userId },
    select: { branchId: true },
  });
  const existingIds = new Set(existing.map(e => e.branchId));

  const toCreate = unique.filter(id => !existingIds.has(id));
  const toDelete = [...existingIds].filter(id => !unique.includes(id));

  if (toCreate.length) {
    await tx.userBranchMembership.createMany({
      data: toCreate.map(branchId => ({ tenantId, userId, branchId })),
      skipDuplicates: true,
    });
  }
  if (toDelete.length) {
    await tx.userBranchMembership.deleteMany({
      where: { tenantId, userId, branchId: { in: toDelete } },
    });
  }
}

/**
 * List tenant users with role info.
 * Supports filters by email, roleId, roleName (contains), date ranges,
 * and sorting (including role.name).
 *
 * Deterministic pagination:
 * - orderBy always includes `id` as a tie-breaker
 * - fetch `limit+1` rows to detect next page
 * - when using a cursor, skip the cursor row itself
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

  // Deterministic order with `id` tie-breaker
  const orderBy: Prisma.UserTenantMembershipOrderByWithRelationInput[] =
    sortByOptional === 'userEmailAddress'
      ? [{ user: { userEmailAddress: sortDirOptional } }, { id: sortDirOptional }]
      : sortByOptional === 'role'
      ? [{ role: { name: sortDirOptional } }, { id: sortDirOptional }]
      : [
          { [sortByOptional]: sortDirOptional } as Prisma.UserTenantMembershipOrderByWithRelationInput,
          { id: sortDirOptional },
        ];

  const limit = Math.max(1, Math.min(100, limitOptional));
  const take = limit + 1; // fetch one extra to detect next page
  const cursor = cursorIdOptional ? { id: cursorIdOptional } : undefined;

  const [rows, total] = await Promise.all([
    prismaClientInstance.userTenantMembership.findMany({
      where,
      orderBy,
      take,
      ...(cursor && { cursor, skip: 1 }), // exclude the cursor row
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            userEmailAddress: true,
            branchMemberships: {
              where: { tenantId: currentTenantId },
              select: {
                branch: {
                  select: {
                    id: true,
                    branchName: true,
                    isActive: true,
                    createdAt: true,
                    updatedAt: true,
                  },
                },
              },
            },
          },
        },
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

  // Page window & hasNext
  const hasNextPage = rows.length > limit;
  const pageRows = hasNextPage ? rows.slice(0, limit) : rows;

  const items = pageRows.map((m) => ({
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
    branches: (m.user.branchMemberships ?? []).map((bm) => ({
      id: bm.branch.id,
      branchName: bm.branch.branchName,
      isActive: bm.branch.isActive,
      createdAt: bm.branch.createdAt.toISOString(),
      updatedAt: bm.branch.updatedAt.toISOString(),
    })),
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  }));

  const nextCursor = hasNextPage ? pageRows[pageRows.length - 1]?.id ?? null : null;

  return {
    items,
    pageInfo: {
      hasNextPage,
      nextCursor,
      ...(includeTotalOptional ? { totalCount: total } : {}),
    },
    applied: {
      limit, // return the real page size, not `take`
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

export async function getUserForCurrentTenantService(params: {
  currentTenantId: string;
  targetUserId: string;
}) {
  const { currentTenantId, targetUserId } = params;

  const m = await prismaClientInstance.userTenantMembership.findUnique({
    where: { userId_tenantId: { userId: targetUserId, tenantId: currentTenantId } },
    select: {
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          userEmailAddress: true,
          branchMemberships: {
            where: { tenantId: currentTenantId },
            select: {
              branch: {
                select: {
                  id: true,
                  branchName: true,
                  isActive: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
            },
          },
        },
      },
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

  if (!m || !m.user) throw Errors.notFound('User is not a member of this tenant.');

  return {
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
    branches: (m.user.branchMemberships ?? []).map((bm) => ({
      id: bm.branch.id,
      branchName: bm.branch.branchName,
      isActive: bm.branch.isActive,
      createdAt: bm.branch.createdAt.toISOString(),
      updatedAt: bm.branch.updatedAt.toISOString(),
    })),
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
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
  branchIdsOptional?: string[];
}) {
  const { currentTenantId, email, password, roleId, branchIdsOptional } = params;

  // Validate role belongs to tenant (unchanged)
  const role = await prismaClientInstance.role.findUnique({
    where: { id: roleId },
    select: {
      id: true, tenantId: true, name: true, description: true, isSystem: true,
      createdAt: true, updatedAt: true,
      permissions: { select: { permission: { select: { key: true } } } },
    },
  });
  if (!role || role.tenantId !== currentTenantId) {
    throw Errors.validation('Invalid role', 'Role not found for this tenant.');
  }

  // Find or create user (unchanged)
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

  // Do membership and branch sync in a single tx
  await prismaClientInstance.$transaction(async (tx) => {
    await tx.userTenantMembership.upsert({
      where: { userId_tenantId: { userId, tenantId: currentTenantId } },
      update: { roleId: role.id },
      create: { userId, tenantId: currentTenantId, roleId: role.id },
      select: { id: true },
    });

    if (branchIdsOptional !== undefined) {
      await syncUserBranches(tx, currentTenantId, userId, branchIdsOptional);
    }
  });

  // Return with role (and branches)
  const fresh = await getUserForCurrentTenantService({
    currentTenantId,
    targetUserId: userId,
  });
  return fresh;
}

export async function updateTenantUserService(params: {
  currentTenantId: string;
  currentUserId: string;
  targetUserId: string;
  newEmailOptional?: string;
  newPasswordOptional?: string;
  newRoleIdOptional?: string;
  newBranchIdsOptional?: string[];
}) {
  const { currentTenantId, targetUserId } = params;

  // prefetch membership/role (unchanged)
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

  await prismaClientInstance.$transaction(async (tx) => {
    if (nextRoleId !== undefined) {
      const currRoleName = membership.role?.name ?? null;

      if (currRoleName === 'OWNER') {
        const ownerRole = await tx.role.findUnique({
          where: { tenantId_name: { tenantId: currentTenantId, name: 'OWNER' } },
          select: { id: true },
        });
        if (!ownerRole) throw Errors.internal('OWNER role missing for tenant.');
        const owners = await tx.userTenantMembership.count({
          where: { tenantId: currentTenantId, roleId: ownerRole.id },
        });
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

    // account updates (unchanged)
    if (params.newEmailOptional !== undefined || params.newPasswordOptional !== undefined) {
      const data: { userEmailAddress?: string; userHashedPassword?: string } = {};
      if (params.newEmailOptional !== undefined) data.userEmailAddress = params.newEmailOptional;
      if (params.newPasswordOptional !== undefined) {
        data.userHashedPassword = await bcrypt.hash(params.newPasswordOptional, 10);
      }
      await tx.user.update({ where: { id: targetUserId }, data });
    }

    if (params.newBranchIdsOptional !== undefined) {
      await syncUserBranches(tx, currentTenantId, targetUserId, params.newBranchIdsOptional);
    }
  });

  // fresh selection, now with branches (reuse existing getter)
  const fresh = await getUserForCurrentTenantService({
    currentTenantId,
    targetUserId,
  });
  return fresh;
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
