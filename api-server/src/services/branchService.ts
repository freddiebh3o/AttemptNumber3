// api-server/src/services/branchService.ts
import type { Prisma } from '@prisma/client';
import { prismaClientInstance } from '../db/prismaClient.js';
import { Errors } from '../utils/httpErrors.js';

type SortField = 'branchName' | 'createdAt' | 'updatedAt' | 'isActive';
type SortDir = 'asc' | 'desc';

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
}) {
  const {
    currentTenantId,
    branchSlugInputValue,
    branchNameInputValue,
    isActiveInputValue,
  } = params;

  try {
    const created = await prismaClientInstance.branch.create({
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
    return created;
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
}) {
  const {
    currentTenantId,
    branchIdPathParam,
    branchSlugInputValueOptional,
    branchNameInputValueOptional,
    isActiveInputValueOptional,
  } = params;

  try {
    const updated = await prismaClientInstance.branch.update({
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
      // If someone tries to update a branch from another tenant via ID
      throw Errors.permissionDenied();
    }

    return updated;
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
}) {
  const { currentTenantId, branchIdPathParam } = params;

  const res = await prismaClientInstance.branch.updateMany({
    where: { id: branchIdPathParam, tenantId: currentTenantId, isActive: true },
    data: { isActive: false },
  });

  if (res.count === 0) {
    // Either not found, or already inactive
    // Check existence to return the right error
    const exists = await prismaClientInstance.branch.findFirst({
      where: { id: branchIdPathParam, tenantId: currentTenantId },
      select: { id: true },
    });
    if (!exists) throw Errors.notFound('Branch not found.');
  }

  return { hasDeactivatedBranch: true };
}
