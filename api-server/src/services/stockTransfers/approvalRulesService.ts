// api-server/src/services/stockTransfers/approvalRulesService.ts
import { Prisma, ApprovalMode, ApprovalRuleConditionType, AuditAction, AuditEntityType } from '@prisma/client';
import { prismaClientInstance } from '../../db/prismaClient.js';
import { Errors } from '../../utils/httpErrors.js';
import { writeAuditEvent } from '../auditLoggerService.js';

type AuditCtx = {
  correlationId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * Create a new approval rule
 */
export async function createApprovalRule(params: {
  tenantId: string;
  userId: string;
  data: {
    name: string;
    description?: string;
    isActive?: boolean;
    approvalMode?: ApprovalMode;
    priority?: number;
    conditions: Array<{
      conditionType: ApprovalRuleConditionType;
      threshold?: number;
      branchId?: string;
    }>;
    levels: Array<{
      level: number;
      name: string;
      requiredRoleId?: string;
      requiredUserId?: string;
    }>;
  };
  auditContext?: AuditCtx;
}) {
  const { tenantId, userId, data, auditContext } = params;

  // Validation: at least one condition
  if (!data.conditions || data.conditions.length === 0) {
    throw Errors.validation('Approval rule must have at least one condition');
  }

  // Validation: at least one approval level
  if (!data.levels || data.levels.length === 0) {
    throw Errors.validation('Approval rule must have at least one approval level');
  }

  // Validation: levels must be sequential starting from 1
  const sortedLevels = [...data.levels].sort((a, b) => a.level - b.level);
  for (let i = 0; i < sortedLevels.length; i++) {
    const currentLevel = sortedLevels[i];
    if (!currentLevel || currentLevel.level !== i + 1) {
      throw Errors.validation('Approval levels must be sequential starting from 1');
    }
  }

  // Validation: each level must have either role or user
  for (const level of data.levels) {
    if (!level.requiredRoleId && !level.requiredUserId) {
      throw Errors.validation('Each approval level must specify either requiredRoleId or requiredUserId');
    }
  }

  // Validate branches exist if specified in conditions
  const branchIds = data.conditions
    .filter(c => c.branchId)
    .map(c => c.branchId as string);

  if (branchIds.length > 0) {
    const branches = await prismaClientInstance.branch.findMany({
      where: {
        id: { in: branchIds },
        tenantId,
        isActive: true,
      },
      select: { id: true },
    });

    if (branches.length !== branchIds.length) {
      throw Errors.validation('One or more branches not found');
    }
  }

  // Validate roles exist if specified in levels
  const roleIds = data.levels
    .filter(l => l.requiredRoleId)
    .map(l => l.requiredRoleId as string);

  if (roleIds.length > 0) {
    const roles = await prismaClientInstance.role.findMany({
      where: {
        id: { in: roleIds },
        tenantId,
      },
      select: { id: true },
    });

    if (roles.length !== roleIds.length) {
      throw Errors.validation('One or more roles not found');
    }
  }

  // Validate users exist if specified in levels
  const userIds = data.levels
    .filter(l => l.requiredUserId)
    .map(l => l.requiredUserId as string);

  if (userIds.length > 0) {
    const users = await prismaClientInstance.user.findMany({
      where: {
        id: { in: userIds },
      },
      select: { id: true },
    });

    if (users.length !== userIds.length) {
      throw Errors.validation('One or more users not found');
    }
  }

  // Create rule in transaction
  const result = await prismaClientInstance.$transaction(async (tx) => {
    const rule = await tx.transferApprovalRule.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description ?? null,
        isActive: data.isActive ?? true,
        approvalMode: data.approvalMode ?? ApprovalMode.SEQUENTIAL,
        priority: data.priority ?? 0,
        conditions: {
          create: data.conditions.map(c => ({
            conditionType: c.conditionType,
            threshold: c.threshold ?? null,
            branchId: c.branchId ?? null,
          })),
        },
        levels: {
          create: data.levels.map(l => ({
            level: l.level,
            name: l.name,
            requiredRoleId: l.requiredRoleId ?? null,
            requiredUserId: l.requiredUserId ?? null,
          })),
        },
      },
      include: {
        conditions: {
          include: {
            branch: {
              select: { id: true, branchName: true, branchSlug: true },
            },
          },
        },
        levels: {
          include: {
            role: {
              select: { id: true, name: true },
            },
            user: {
              select: { id: true, userEmailAddress: true },
            },
          },
        },
      },
    });

    // Audit
    try {
      await writeAuditEvent(tx, {
        tenantId,
        actorUserId: userId,
        entityType: AuditEntityType.STOCK_TRANSFER,
        entityId: rule.id,
        action: AuditAction.APPROVAL_RULE_CREATE,
        entityName: rule.name,
        before: null,
        after: {
          id: rule.id,
          name: rule.name,
          isActive: rule.isActive,
          approvalMode: rule.approvalMode,
          conditionsCount: rule.conditions.length,
          levelsCount: rule.levels.length,
        },
        correlationId: auditContext?.correlationId ?? null,
        ip: auditContext?.ip ?? null,
        userAgent: auditContext?.userAgent ?? null,
      });
    } catch {
      // Swallow audit errors
    }

    return rule;
  });

  return result;
}

/**
 * List approval rules for tenant
 */
export async function listApprovalRules(params: {
  tenantId: string;
  filters?: {
    isActive?: boolean;
    archivedFilter?: 'active-only' | 'archived-only' | 'all';
    sortBy?: 'priority' | 'name' | 'createdAt';
    sortDir?: 'asc' | 'desc';
    limit?: number;
    cursor?: string;
    includeTotal?: boolean;
  };
}) {
  const { tenantId, filters } = params;

  // Build where clause
  const where: Prisma.TransferApprovalRuleWhereInput = {
    tenantId,
  };

  // Handle archive filtering (default to active-only)
  const archivedFilter = filters?.archivedFilter ?? 'active-only';
  if (archivedFilter === 'active-only') {
    where.isArchived = false;
  } else if (archivedFilter === 'archived-only') {
    where.isArchived = true;
  }
  // If 'all', don't filter by isArchived

  if (filters?.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  // Sorting
  const sortBy = filters?.sortBy ?? 'priority';
  const sortDir = filters?.sortDir ?? 'desc';

  const orderBy: Prisma.TransferApprovalRuleOrderByWithRelationInput[] = [];

  if (sortBy === 'priority') {
    orderBy.push({ priority: sortDir }, { id: sortDir });
  } else if (sortBy === 'name') {
    orderBy.push({ name: sortDir }, { id: sortDir });
  } else if (sortBy === 'createdAt') {
    orderBy.push({ createdAt: sortDir }, { id: sortDir });
  } else {
    orderBy.push({ priority: sortDir }, { id: sortDir });
  }

  // Pagination
  const limit = Math.min(Math.max(filters?.limit ?? 20, 1), 100);
  const take = limit + 1;

  const findArgs: Prisma.TransferApprovalRuleFindManyArgs = {
    where,
    orderBy,
    take,
    include: {
      conditions: {
        include: {
          branch: {
            select: { id: true, branchName: true, branchSlug: true },
          },
        },
      },
      levels: {
        include: {
          role: {
            select: { id: true, name: true },
          },
          user: {
            select: { id: true, userEmailAddress: true },
          },
        },
        orderBy: { level: 'asc' },
      },
    },
  };

  if (filters?.cursor) {
    findArgs.cursor = { id: filters.cursor };
    findArgs.skip = 1;
  }

  const rows = await prismaClientInstance.transferApprovalRule.findMany(findArgs);

  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const nextCursor = hasNextPage ? items[items.length - 1]?.id ?? null : null;

  // Optionally include total count
  let totalCount: number | undefined = undefined;
  if (filters?.includeTotal) {
    totalCount = await prismaClientInstance.transferApprovalRule.count({ where });
  }

  return {
    items,
    pageInfo: {
      hasNextPage,
      nextCursor,
      ...(totalCount !== undefined ? { totalCount } : {}),
    },
  };
}

/**
 * Get single approval rule
 */
export async function getApprovalRule(params: {
  tenantId: string;
  ruleId: string;
}) {
  const { tenantId, ruleId } = params;

  const rule = await prismaClientInstance.transferApprovalRule.findFirst({
    where: { id: ruleId, tenantId },
    include: {
      conditions: {
        include: {
          branch: {
            select: { id: true, branchName: true, branchSlug: true },
          },
        },
      },
      levels: {
        include: {
          role: {
            select: { id: true, name: true },
          },
          user: {
            select: { id: true, userEmailAddress: true },
          },
        },
        orderBy: { level: 'asc' },
      },
    },
  });

  if (!rule) throw Errors.notFound('Approval rule not found');

  return rule;
}

/**
 * Update approval rule
 */
export async function updateApprovalRule(params: {
  tenantId: string;
  userId: string;
  ruleId: string;
  data: {
    name?: string;
    description?: string;
    isActive?: boolean;
    approvalMode?: ApprovalMode;
    priority?: number;
  };
  auditContext?: AuditCtx;
}) {
  const { tenantId, userId, ruleId, data, auditContext } = params;

  // Get existing rule
  const existing = await prismaClientInstance.transferApprovalRule.findFirst({
    where: { id: ruleId, tenantId },
    select: { id: true, name: true, isActive: true, approvalMode: true, priority: true },
  });

  if (!existing) throw Errors.notFound('Approval rule not found');

  // Update rule in transaction
  const result = await prismaClientInstance.$transaction(async (tx) => {
    const updated = await tx.transferApprovalRule.update({
      where: { id: ruleId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.approvalMode !== undefined ? { approvalMode: data.approvalMode } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
      },
      include: {
        conditions: {
          include: {
            branch: {
              select: { id: true, branchName: true, branchSlug: true },
            },
          },
        },
        levels: {
          include: {
            role: {
              select: { id: true, name: true },
            },
            user: {
              select: { id: true, userEmailAddress: true },
            },
          },
          orderBy: { level: 'asc' },
        },
      },
    });

    // Audit
    try {
      await writeAuditEvent(tx, {
        tenantId,
        actorUserId: userId,
        entityType: AuditEntityType.STOCK_TRANSFER,
        entityId: updated.id,
        action: AuditAction.APPROVAL_RULE_UPDATE,
        entityName: updated.name,
        before: existing,
        after: {
          id: updated.id,
          name: updated.name,
          isActive: updated.isActive,
          approvalMode: updated.approvalMode,
          priority: updated.priority,
        },
        correlationId: auditContext?.correlationId ?? null,
        ip: auditContext?.ip ?? null,
        userAgent: auditContext?.userAgent ?? null,
      });
    } catch {
      // Swallow audit errors
    }

    return updated;
  });

  return result;
}

/**
 * Archive approval rule (soft delete)
 */
export async function deleteApprovalRule(params: {
  tenantId: string;
  userId: string;
  ruleId: string;
  auditContext?: AuditCtx;
}) {
  const { tenantId, userId, ruleId, auditContext } = params;

  // Get existing rule
  const existing = await prismaClientInstance.transferApprovalRule.findFirst({
    where: { id: ruleId, tenantId },
    select: { id: true, name: true, isActive: true, isArchived: true },
  });

  if (!existing) throw Errors.notFound('Approval rule not found');
  if (existing.isArchived) throw Errors.validation('Approval rule is already archived');

  // Archive rule in transaction (preserves conditions and levels)
  const result = await prismaClientInstance.$transaction(async (tx) => {
    const archived = await tx.transferApprovalRule.update({
      where: { id: ruleId },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        archivedByUserId: userId,
      },
      include: {
        conditions: {
          include: {
            branch: {
              select: { id: true, branchName: true, branchSlug: true },
            },
          },
        },
        levels: {
          include: {
            role: {
              select: { id: true, name: true },
            },
            user: {
              select: { id: true, userEmailAddress: true },
            },
          },
          orderBy: { level: 'asc' },
        },
      },
    });

    // Audit
    try {
      await writeAuditEvent(tx, {
        tenantId,
        actorUserId: userId,
        entityType: AuditEntityType.STOCK_TRANSFER,
        entityId: archived.id,
        action: AuditAction.APPROVAL_RULE_DELETE,
        entityName: archived.name,
        before: { id: existing.id, name: existing.name, isActive: existing.isActive, isArchived: false },
        after: { id: archived.id, name: archived.name, isActive: archived.isActive, isArchived: true, archivedAt: archived.archivedAt },
        correlationId: auditContext?.correlationId ?? null,
        ip: auditContext?.ip ?? null,
        userAgent: auditContext?.userAgent ?? null,
      });
    } catch {
      // Swallow audit errors
    }

    return archived;
  });

  return result;
}

/**
 * Restore archived approval rule
 */
export async function restoreApprovalRule(params: {
  tenantId: string;
  userId: string;
  ruleId: string;
  auditContext?: AuditCtx;
}) {
  const { tenantId, userId, ruleId, auditContext } = params;

  // Get existing rule
  const existing = await prismaClientInstance.transferApprovalRule.findFirst({
    where: { id: ruleId, tenantId },
    select: { id: true, name: true, isActive: true, isArchived: true },
  });

  if (!existing) throw Errors.notFound('Approval rule not found');
  if (!existing.isArchived) throw Errors.validation('Approval rule is not archived');

  // Restore rule in transaction
  const result = await prismaClientInstance.$transaction(async (tx) => {
    const restored = await tx.transferApprovalRule.update({
      where: { id: ruleId },
      data: {
        isArchived: false,
        archivedAt: null,
        archivedByUserId: null,
      },
      include: {
        conditions: {
          include: {
            branch: {
              select: { id: true, branchName: true, branchSlug: true },
            },
          },
        },
        levels: {
          include: {
            role: {
              select: { id: true, name: true },
            },
            user: {
              select: { id: true, userEmailAddress: true },
            },
          },
          orderBy: { level: 'asc' },
        },
      },
    });

    // Audit
    try {
      await writeAuditEvent(tx, {
        tenantId,
        actorUserId: userId,
        entityType: AuditEntityType.STOCK_TRANSFER,
        entityId: restored.id,
        action: AuditAction.UPDATE,
        entityName: restored.name,
        before: { id: existing.id, name: existing.name, isActive: existing.isActive, isArchived: true },
        after: { id: restored.id, name: restored.name, isActive: restored.isActive, isArchived: false },
        correlationId: auditContext?.correlationId ?? null,
        ip: auditContext?.ip ?? null,
        userAgent: auditContext?.userAgent ?? null,
      });
    } catch {
      // Swallow audit errors
    }

    return restored;
  });

  return result;
}
