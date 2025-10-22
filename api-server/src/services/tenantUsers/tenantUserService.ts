// api-server/src/services/tenantUsers/tenantUserService.ts
import { Prisma, AuditAction, AuditEntityType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { Errors } from '../../utils/httpErrors.js';
import { prismaClientInstance } from '../../db/prismaClient.js';
import type { Prisma as PrismaNS } from '@prisma/client';
import { writeAuditEvent } from '../auditLoggerService.js';

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

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

/**
 * Validates that only OWNER users can assign the OWNER role to other users.
 * Security control to prevent privilege escalation.
 *
 * @throws {HttpError} 403 CANT_ASSIGN_OWNER_ROLE if non-OWNER attempts to assign OWNER role
 */
async function requireOwnerRoleToAssignOwner(params: {
  currentUserId: string;
  currentTenantId: string;
  targetRoleId: string;
}) {
  const { currentUserId, currentTenantId, targetRoleId } = params;

  // Check if target role is OWNER by name
  const targetRole = await prismaClientInstance.role.findUnique({
    where: { id: targetRoleId },
    select: { name: true, tenantId: true },
  });

  // If target role is OWNER, verify current user is also OWNER
  if (targetRole && targetRole.name === 'OWNER') {
    const currentUserMembership = await prismaClientInstance.userTenantMembership.findUnique({
      where: { userId_tenantId: { userId: currentUserId, tenantId: currentTenantId } },
      select: { role: { select: { name: true } } },
    });

    const currentUserRoleName = currentUserMembership?.role?.name;
    if (currentUserRoleName !== 'OWNER') {
      throw Errors.cantAssignOwnerRole();
    }
  }
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
 */
export async function listUsersForCurrentTenantService(params: {
  currentTenantId: string;
  limitOptional?: number;
  cursorIdOptional?: string;
  // filters
  qOptional?: string;
  roleIdsOptional?: string[];
  createdAtFromOptional?: string;  // 'YYYY-MM-DD'
  createdAtToOptional?: string;    // 'YYYY-MM-DD'
  updatedAtFromOptional?: string;  // 'YYYY-MM-DD'
  updatedAtToOptional?: string;    // 'YYYY-MM-DD'
  archivedFilterOptional?: 'active-only' | 'archived-only' | 'all';
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
    roleIdsOptional,
    createdAtFromOptional,
    createdAtToOptional,
    updatedAtFromOptional,
    updatedAtToOptional,
    archivedFilterOptional = 'active-only',
    sortByOptional = 'createdAt',
    sortDirOptional = 'desc',
    includeTotalOptional = false,
  } = params;

  const createdAt: Prisma.DateTimeFilter = {};
  if (createdAtFromOptional) createdAt.gte = new Date(createdAtFromOptional);
  if (createdAtToOptional) createdAt.lt = addDays(new Date(createdAtToOptional), 1);

  const updatedAt: Prisma.DateTimeFilter = {};
  if (updatedAtFromOptional) updatedAt.gte = new Date(updatedAtFromOptional);
  if (updatedAtToOptional) updatedAt.lt = addDays(new Date(updatedAtToOptional), 1);

  // Apply archive filter
  let isArchivedFilter: boolean | undefined;
  if (archivedFilterOptional === 'active-only') {
    isArchivedFilter = false;
  } else if (archivedFilterOptional === 'archived-only') {
    isArchivedFilter = true;
  }
  // if 'all', leave undefined (no filter)

  const where: Prisma.UserTenantMembershipWhereInput = {
    tenantId: currentTenantId,
    ...(isArchivedFilter !== undefined && { isArchived: isArchivedFilter }),
    ...(qOptional && {
      user: { userEmailAddress: { contains: qOptional, mode: 'insensitive' } },
    }),
    ...(roleIdsOptional && roleIdsOptional.length > 0 && {
      roleId: { in: roleIdsOptional },
    }),
    ...((createdAt.gte || createdAt.lt) && { createdAt }),
    ...((updatedAt.gte || updatedAt.lt) && { updatedAt }),
  };

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
  const take = limit + 1;
  const cursor = cursorIdOptional ? { id: cursorIdOptional } : undefined;

  const [rows, total] = await Promise.all([
    prismaClientInstance.userTenantMembership.findMany({
      where,
      orderBy,
      take,
      ...(cursor && { cursor, skip: 1 }),
      select: {
        id: true,
        isArchived: true,
        archivedAt: true,
        archivedByUserId: true,
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
    isArchived: m.isArchived,
    archivedAt: m.archivedAt?.toISOString() ?? null,
    archivedByUserId: m.archivedByUserId ?? null,
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
      limit,
      sort: { field: sortByOptional, direction: sortDirOptional },
      filters: {
        ...(qOptional ? { q: qOptional } : {}),
        ...(roleIdsOptional && roleIdsOptional.length > 0 ? { roleIds: roleIdsOptional } : {}),
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
      isArchived: true,
      archivedAt: true,
      archivedByUserId: true,
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
    isArchived: m.isArchived,
    archivedAt: m.archivedAt?.toISOString() ?? null,
    archivedByUserId: m.archivedByUserId ?? null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

/**
 * Create (or attach) a user to the current tenant with a role.
 * Emits audit for: USER create (if new), role assign/reassign, branch sync.
 */
export async function createOrAttachUserToTenantService(params: {
  currentTenantId: string;
  currentUserId: string;
  email: string;
  password: string;
  roleId: string;
  branchIdsOptional?: string[];
  auditContextOptional?: AuditCtx;
}) {
  const { currentTenantId, currentUserId, email, password, roleId, branchIdsOptional, auditContextOptional } = params;
  const meta = auditCtxOrNull(auditContextOptional);

  // Validate role belongs to tenant
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

  // SECURITY: Only OWNER users can assign OWNER role
  await requireOwnerRoleToAssignOwner({
    currentUserId,
    currentTenantId,
    targetRoleId: roleId,
  });

  // Find or create user
  const existingUser = await prismaClientInstance.user.findUnique({
    where: { userEmailAddress: email },
  });

  let userId: string;
  let createdUser = false;
  if (!existingUser) {
    const hashed = await bcrypt.hash(password, 10);
    const user = await prismaClientInstance.user.create({
      data: { userEmailAddress: email, userHashedPassword: hashed },
      select: { id: true, userEmailAddress: true },
    });
    userId = user.id;
    createdUser = true;

    // AUDIT: new user account
    try {
      await writeAuditEvent(prismaClientInstance, {
        tenantId: currentTenantId,
        actorUserId: meta.actorUserId,
        entityType: AuditEntityType.USER,
        entityId: userId,
        action: AuditAction.CREATE,
        entityName: user.userEmailAddress,
        before: null,
        after: { id: userId, userEmailAddress: user.userEmailAddress },
        correlationId: meta.correlationId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    } catch {}
  } else {
    userId = existingUser.id;
  }

  // Membership & branches in a single tx (with audit inside)
  await prismaClientInstance.$transaction(async (tx) => {
    // Membership before/after
    const beforeMembership = await tx.userTenantMembership.findUnique({
      where: { userId_tenantId: { userId, tenantId: currentTenantId } },
      select: { roleId: true },
    });

    const upserted = await tx.userTenantMembership.upsert({
      where: { userId_tenantId: { userId, tenantId: currentTenantId } },
      update: { roleId: role.id },
      create: { userId, tenantId: currentTenantId, roleId: role.id },
      select: { roleId: true },
    });

    // Role audit (assign or reassign)
    try {
      if (!beforeMembership) {
        await writeAuditEvent(tx, {
          tenantId: currentTenantId,
          actorUserId: meta.actorUserId,
          entityType: AuditEntityType.USER,
          entityId: userId,
          action: AuditAction.ROLE_ASSIGN,
          entityName: email,
          before: null,
          after: { roleId: upserted.roleId, roleName: role.name },
          correlationId: meta.correlationId,
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
      } else if (beforeMembership.roleId !== upserted.roleId) {
        await writeAuditEvent(tx, {
          tenantId: currentTenantId,
          actorUserId: meta.actorUserId,
          entityType: AuditEntityType.USER,
          entityId: userId,
          action: AuditAction.ROLE_REVOKE,
          entityName: email,
          before: { roleId: beforeMembership.roleId },
          after: null,
          correlationId: meta.correlationId,
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
        await writeAuditEvent(tx, {
          tenantId: currentTenantId,
          actorUserId: meta.actorUserId,
          entityType: AuditEntityType.USER,
          entityId: userId,
          action: AuditAction.ROLE_ASSIGN,
          entityName: email,
          before: null,
          after: { roleId: upserted.roleId, roleName: role.name },
          correlationId: meta.correlationId,
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
      }
    } catch {}

    // Branch sync + audit (if requested)
    if (branchIdsOptional !== undefined) {
      // snapshot before
      const beforeBranches = await tx.userBranchMembership.findMany({
        where: { tenantId: currentTenantId, userId },
        select: { branchId: true },
      });
      const beforeIds = beforeBranches.map(b => b.branchId).sort();

      await syncUserBranches(tx, currentTenantId, userId, branchIdsOptional);

      const afterBranches = await tx.userBranchMembership.findMany({
        where: { tenantId: currentTenantId, userId },
        select: { branchId: true },
      });
      const afterIds = afterBranches.map(b => b.branchId).sort();

      const changed = beforeIds.length !== afterIds.length ||
        beforeIds.some((v, i) => v !== afterIds[i]);

      if (changed) {
        try {
          await writeAuditEvent(tx, {
            tenantId: currentTenantId,
            actorUserId: meta.actorUserId,
            entityType: AuditEntityType.USER,
            entityId: userId,
            action: AuditAction.UPDATE,
            entityName: email,
            before: { branchIds: beforeIds },
            after: { branchIds: afterIds },
            correlationId: meta.correlationId,
            ip: meta.ip,
            userAgent: meta.userAgent,
          });
        } catch {}
      }
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
  auditContextOptional?: AuditCtx;
}) {
  const { currentTenantId, targetUserId, auditContextOptional } = params;
  const meta = auditCtxOrNull(auditContextOptional);

  // prefetch membership/role
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

    // SECURITY: Only OWNER users can assign OWNER role
    await requireOwnerRoleToAssignOwner({
      currentUserId: params.currentUserId,
      currentTenantId,
      targetRoleId: nextRoleId,
    });
  }

  await prismaClientInstance.$transaction(async (tx) => {
    // Role change with safety (owner guard) + audit
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

      const beforeRoleId = membership.role?.id ?? null;

      const updated = await tx.userTenantMembership.update({
        where: { userId_tenantId: { userId: targetUserId, tenantId: currentTenantId } },
        data: { roleId: nextRoleId },
        select: { roleId: true },
      });

      if (beforeRoleId !== updated.roleId) {
        try {
          if (beforeRoleId) {
            await writeAuditEvent(tx, {
              tenantId: currentTenantId,
              actorUserId: meta.actorUserId,
              entityType: AuditEntityType.USER,
              entityId: membership.user.id,
              action: AuditAction.ROLE_REVOKE,
              entityName: membership.user.userEmailAddress,
              before: { roleId: beforeRoleId },
              after: null,
              correlationId: meta.correlationId,
              ip: meta.ip,
              userAgent: meta.userAgent,
            });
          }
          await writeAuditEvent(tx, {
            tenantId: currentTenantId,
            actorUserId: meta.actorUserId,
            entityType: AuditEntityType.USER,
            entityId: membership.user.id,
            action: AuditAction.ROLE_ASSIGN,
            entityName: membership.user.userEmailAddress,
            before: null,
            after: { roleId: updated.roleId },
            correlationId: meta.correlationId,
            ip: meta.ip,
            userAgent: meta.userAgent,
          });
        } catch {}
      }
    }

    // Account updates (+ audit)
    if (params.newEmailOptional !== undefined || params.newPasswordOptional !== undefined) {
      const data: { userEmailAddress?: string; userHashedPassword?: string } = {};
      const beforeEmail = membership.user.userEmailAddress;

      if (params.newEmailOptional !== undefined) data.userEmailAddress = params.newEmailOptional;
      let passwordChanged = false;
      if (params.newPasswordOptional !== undefined) {
        data.userHashedPassword = await bcrypt.hash(params.newPasswordOptional, 10);
        passwordChanged = true;
      }

      await tx.user.update({ where: { id: targetUserId }, data });

      // Audit (redact password)
      try {
        await writeAuditEvent(tx, {
          tenantId: currentTenantId,
          actorUserId: meta.actorUserId,
          entityType: AuditEntityType.USER,
          entityId: membership.user.id,
          action: AuditAction.UPDATE,
          entityName: params.newEmailOptional ?? beforeEmail,
          before: { userEmailAddress: beforeEmail },
          after: { userEmailAddress: params.newEmailOptional ?? beforeEmail, passwordChanged },
          correlationId: meta.correlationId,
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
      } catch {}
    }

    // Branch sync (+ audit)
    if (params.newBranchIdsOptional !== undefined) {
      const beforeBranches = await tx.userBranchMembership.findMany({
        where: { tenantId: currentTenantId, userId: targetUserId },
        select: { branchId: true },
      });
      const beforeIds = beforeBranches.map(b => b.branchId).sort();

      await syncUserBranches(tx, currentTenantId, targetUserId, params.newBranchIdsOptional);

      const afterBranches = await tx.userBranchMembership.findMany({
        where: { tenantId: currentTenantId, userId: targetUserId },
        select: { branchId: true },
      });
      const afterIds = afterBranches.map(b => b.branchId).sort();

      const changed = beforeIds.length !== afterIds.length ||
        beforeIds.some((v, i) => v !== afterIds[i]);

      if (changed) {
        try {
          await writeAuditEvent(tx, {
            tenantId: currentTenantId,
            actorUserId: meta.actorUserId,
            entityType: AuditEntityType.USER,
            entityId: membership.user.id,
            action: AuditAction.UPDATE,
            entityName: membership.user.userEmailAddress,
            before: { branchIds: beforeIds },
            after: { branchIds: afterIds },
            correlationId: meta.correlationId,
            ip: meta.ip,
            userAgent: meta.userAgent,
          });
        } catch {}
      }
    }
  });

  const fresh = await getUserForCurrentTenantService({
    currentTenantId,
    targetUserId,
  });
  return fresh;
}

/**
 * Archive (soft delete) a user membership from the current tenant.
 * Prevents users from archiving their own membership.
 * Emits UPDATE audit event for archival.
 */
export async function removeUserFromTenantService(params: {
  currentTenantId: string;
  currentUserId: string;
  targetUserId: string;
  auditContextOptional?: AuditCtx;
}) {
  const { currentTenantId, currentUserId, targetUserId, auditContextOptional } = params;
  const meta = auditCtxOrNull(auditContextOptional);

  // Prevent self-archival
  if (currentUserId === targetUserId) {
    throw Errors.validation('Cannot archive own membership', 'You cannot archive your own user membership.');
  }

  const result = await prismaClientInstance.$transaction(async (tx) => {
    const ownerRole = await tx.role.findUnique({
      where: { tenantId_name: { tenantId: currentTenantId, name: 'OWNER' } },
      select: { id: true },
    });
    if (!ownerRole) throw Errors.internal('OWNER role missing for tenant.');

    const targetMembership = await tx.userTenantMembership.findUnique({
      where: { userId_tenantId: { userId: targetUserId, tenantId: currentTenantId } },
      select: {
        roleId: true,
        isArchived: true,
        user: { select: { userEmailAddress: true } }
      },
    });
    if (!targetMembership) return { hasArchivedMembership: false };

    // Already archived, nothing to do
    if (targetMembership.isArchived) {
      return { hasArchivedMembership: false };
    }

    const isTargetOwner = targetMembership.roleId === ownerRole.id;
    if (isTargetOwner) {
      const owners = await tx.userTenantMembership.count({
        where: { tenantId: currentTenantId, roleId: ownerRole.id, isArchived: false },
      });
      if (owners <= 1) throw Errors.cantDeleteLastOwner();
    }

    // Archive the membership (soft delete)
    await tx.userTenantMembership.update({
      where: { userId_tenantId: { userId: targetUserId, tenantId: currentTenantId } },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        archivedByUserId: currentUserId,
      },
    });

    // Audit event for archival
    try {
      await writeAuditEvent(tx, {
        tenantId: currentTenantId,
        actorUserId: meta.actorUserId,
        entityType: AuditEntityType.USER,
        entityId: targetUserId,
        action: AuditAction.UPDATE,
        entityName: targetMembership.user.userEmailAddress,
        before: { isArchived: false },
        after: { isArchived: true, archivedAt: new Date().toISOString(), archivedByUserId: currentUserId },
        correlationId: meta.correlationId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    } catch {}

    return { hasArchivedMembership: true };
  });

  return result;
}

/**
 * Restore an archived user membership.
 * Emits UPDATE audit event for restoration.
 */
export async function restoreUserMembershipService(params: {
  currentTenantId: string;
  targetUserId: string;
  auditContextOptional?: AuditCtx;
}) {
  const { currentTenantId, targetUserId, auditContextOptional } = params;
  const meta = auditCtxOrNull(auditContextOptional);

  const result = await prismaClientInstance.$transaction(async (tx) => {
    const targetMembership = await tx.userTenantMembership.findUnique({
      where: { userId_tenantId: { userId: targetUserId, tenantId: currentTenantId } },
      select: {
        isArchived: true,
        archivedAt: true,
        archivedByUserId: true,
        user: { select: { userEmailAddress: true } }
      },
    });

    if (!targetMembership) {
      throw Errors.notFound('User membership not found.');
    }

    // Not archived, nothing to restore
    if (!targetMembership.isArchived) {
      return { hasRestoredMembership: false };
    }

    // Restore the membership
    await tx.userTenantMembership.update({
      where: { userId_tenantId: { userId: targetUserId, tenantId: currentTenantId } },
      data: {
        isArchived: false,
        archivedAt: null,
        archivedByUserId: null,
      },
    });

    // Audit event for restoration
    try {
      await writeAuditEvent(tx, {
        tenantId: currentTenantId,
        actorUserId: meta.actorUserId,
        entityType: AuditEntityType.USER,
        entityId: targetUserId,
        action: AuditAction.UPDATE,
        entityName: targetMembership.user.userEmailAddress,
        before: {
          isArchived: true,
          archivedAt: targetMembership.archivedAt?.toISOString() ?? null,
          archivedByUserId: targetMembership.archivedByUserId
        },
        after: { isArchived: false, archivedAt: null, archivedByUserId: null },
        correlationId: meta.correlationId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    } catch {}

    return { hasRestoredMembership: true };
  });

  return result;
}
