// api-server/src/services/branchService.ts
import type { Prisma } from '@prisma/client';
import { prismaClientInstance } from '../db/prismaClient.js';
import { Errors } from '../utils/httpErrors.js';

import { writeAuditEvent } from './auditLoggerService.js';
import { AuditAction, AuditEntityType } from '@prisma/client';

type SortField = 'branchName' | 'createdAt' | 'updatedAt' | 'isActive';
type SortDir = 'asc' | 'desc';

type AuditCtx = {
  actorUserId?: string | null;
  correlationId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

export async function listBranchesForCurrentTenantService(params: {
  currentTenantId: string;
  limitOptional?: number;
  cursorIdOptional?: string;
  qOptional?: string;            // search slug/name
  isActiveOptional?: boolean;
  sortByOptional?: SortField;
  sortDirOptional?: SortDir;
  includeTotalOptional?: boolean;
}) {
  const {
    currentTenantId,
    limitOptional,
    cursorIdOptional,
    qOptional,
    isActiveOptional,
    sortByOptional,
    sortDirOptional,
    includeTotalOptional,
  } = params;

  const limit = Math.min(Math.max(limitOptional ?? 20, 1), 100);
  const sortBy: SortField = sortByOptional ?? 'createdAt';
  const sortDir: SortDir = sortDirOptional ?? 'desc';

  const where: Prisma.BranchWhereInput = {
    tenantId: currentTenantId,
    ...(isActiveOptional !== undefined ? { isActive: isActiveOptional } : {}),
    ...(qOptional && qOptional.trim()
      ? {
          OR: [
            { branchName: { contains: qOptional, mode: 'insensitive' } },
            { branchSlug: { contains: qOptional, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.BranchOrderByWithRelationInput[] = [
    { [sortBy]: sortDir } as Prisma.BranchOrderByWithRelationInput,
    { id: sortDir },
  ];

  const take = limit + 1;

  const findArgs: Prisma.BranchFindManyArgs = {
    where,
    orderBy,
    take,
    select: {
      id: true,
      tenantId: true,
      branchSlug: true,
      branchName: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  };

  if (cursorIdOptional) {
    findArgs.cursor = { id: cursorIdOptional };
    findArgs.skip = 1;
  }

  const rows = await prismaClientInstance.branch.findMany(findArgs);
  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const nextCursor = hasNextPage ? items[items.length - 1]?.id ?? null : null;

  let totalCount: number | undefined;
  if (includeTotalOptional) {
    totalCount = await prismaClientInstance.branch.count({ where });
  }

  return {
    items,
    pageInfo: { hasNextPage, nextCursor, ...(totalCount !== undefined && { totalCount }) },
    applied: {
      limit,
      sort: { field: sortBy, direction: sortDir },
      filters: {
        ...(qOptional ? { q: qOptional } : {}),
        ...(isActiveOptional !== undefined ? { isActive: isActiveOptional } : {}),
      },
    },
  };
}

export async function createBranchForCurrentTenantService(params: {
  currentTenantId: string;
  branchSlugInputValue: string;
  branchNameInputValue: string;
  isActiveInputValue?: boolean | undefined;
  auditContextOptional?: AuditCtx;
}) {
  const {
    currentTenantId,
    branchSlugInputValue,
    branchNameInputValue,
    isActiveInputValue,
    auditContextOptional,
  } = params;

  try {
    const result = await prismaClientInstance.$transaction(async (tx) => {
      const created = await tx.branch.create({
        data: {
          tenantId: currentTenantId,
          branchSlug: branchSlugInputValue,
          branchName: branchNameInputValue,
          isActive: isActiveInputValue ?? true,
        },
        select: {
          id: true,
          tenantId: true,
          branchSlug: true,
          branchName: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // AUDIT: CREATE
      await writeAuditEvent(tx, {
        tenantId: currentTenantId,
        actorUserId: auditContextOptional?.actorUserId ?? null,
        entityType: AuditEntityType.BRANCH,
        entityId: created.id,
        action: AuditAction.CREATE,
        entityName: created.branchName,
        before: null,
        after: created,
        correlationId: auditContextOptional?.correlationId ?? null,
        ip: auditContextOptional?.ip ?? null,                      
        userAgent: auditContextOptional?.userAgent ?? null,        
      });

      return created;
    });

    return result;
  } catch (error: any) {
    // Unique (tenantId, branchSlug)
    if (error?.code === 'P2002') {
      throw Errors.conflict('A branch with this slug already exists for this tenant.');
    }
    throw error;
  }
}

export async function updateBranchForCurrentTenantService(params: {
  currentTenantId: string;
  branchIdPathParam: string;
  branchSlugInputValueOptional?: string;
  branchNameInputValueOptional?: string;
  isActiveInputValueOptional?: boolean;
  auditContextOptional?: AuditCtx;
}) {
  const {
    currentTenantId,
    branchIdPathParam,
    branchSlugInputValueOptional,
    branchNameInputValueOptional,
    isActiveInputValueOptional,
    auditContextOptional,
  } = params;

  try {
    const result = await prismaClientInstance.$transaction(async (tx) => {
      // load "before"
      const before = await tx.branch.findFirst({
        where: { id: branchIdPathParam, tenantId: currentTenantId },
        select: {
          id: true,
          tenantId: true,
          branchSlug: true,
          branchName: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!before) throw Errors.notFound('Branch not found.');

      const updated = await tx.branch.update({
        where: { id: branchIdPathParam },
        data: {
          // guard tenant as well
          tenant: { connect: { id: currentTenantId } },
          ...(branchSlugInputValueOptional !== undefined && { branchSlug: branchSlugInputValueOptional }),
          ...(branchNameInputValueOptional !== undefined && { branchName: branchNameInputValueOptional }),
          ...(isActiveInputValueOptional !== undefined && { isActive: isActiveInputValueOptional }),
        },
        select: {
          id: true,
          tenantId: true,
          branchSlug: true,
          branchName: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (updated.tenantId !== currentTenantId) {
        throw Errors.permissionDenied();
      }

      // AUDIT: UPDATE
      await writeAuditEvent(tx, {
        tenantId: currentTenantId,
        actorUserId: auditContextOptional?.actorUserId ?? null,
        entityType: AuditEntityType.BRANCH,
        entityId: updated.id,
        action: AuditAction.UPDATE,
        entityName: updated.branchName,
        before,
        after: updated,
        correlationId: auditContextOptional?.correlationId ?? null,
        ip: auditContextOptional?.ip ?? null,                      
        userAgent: auditContextOptional?.userAgent ?? null,        
      });

      return updated;
    });

    return result;
  } catch (error: any) {
    if (error?.code === 'P2025') {
      throw Errors.notFound('Branch not found.');
    }
    if (error?.code === 'P2002') {
      throw Errors.conflict('A branch with this slug already exists for this tenant.');
    }
    throw error;
  }
}

/** Soft delete (deactivate) to keep historical stock/ledger intact */
export async function deactivateBranchForCurrentTenantService(params: {
  currentTenantId: string;
  branchIdPathParam: string;
  auditContextOptional?: AuditCtx;
}) {
  const { currentTenantId, branchIdPathParam, auditContextOptional } = params;

  return await prismaClientInstance.$transaction(async (tx) => {
    // load "before"
    const before = await tx.branch.findFirst({
      where: { id: branchIdPathParam, tenantId: currentTenantId },
      select: {
        id: true,
        tenantId: true,
        branchSlug: true,
        branchName: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!before) throw Errors.notFound('Branch not found.');

    // only deactivate if active
    if (!before.isActive) {
      // already inactive — keep behavior same as before
      return { hasDeactivatedBranch: true };
    }

    const res = await tx.branch.updateMany({
      where: { id: branchIdPathParam, tenantId: currentTenantId, isActive: true },
      data: { isActive: false },
    });

    if (res.count === 0) {
      // Either not found, or already inactive (we just checked)
      throw Errors.notFound('Branch not found.');
    }

    // load "after"
    const after = { ...before, isActive: false };

    // AUDIT: DELETE (soft)
    await writeAuditEvent(tx, {
      tenantId: currentTenantId,
      actorUserId: auditContextOptional?.actorUserId ?? null,
      entityType: AuditEntityType.BRANCH,
      entityId: before.id,
      action: AuditAction.DELETE, // soft delete represented as DELETE
      entityName: before.branchName,
      before,
      after,
      correlationId: auditContextOptional?.correlationId ?? null,
      ip: auditContextOptional?.ip ?? null,                      
      userAgent: auditContextOptional?.userAgent ?? null,        
    });

    return { hasDeactivatedBranch: true };
  });
}
