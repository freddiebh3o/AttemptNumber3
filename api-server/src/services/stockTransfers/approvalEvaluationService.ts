// api-server/src/services/stockTransfers/approvalEvaluationService.ts
import {
  Prisma,
  ApprovalRuleConditionType,
  ApprovalMode,
  ApprovalStatus,
  StockTransferStatus,
  AuditAction,
  AuditEntityType,
} from '@prisma/client';
import { prismaClientInstance } from '../../db/prismaClient.js';
import { Errors } from '../../utils/httpErrors.js';
import { writeAuditEvent } from '../auditLoggerService.js';

type AuditCtx = {
  correlationId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

type TransferWithItems = {
  id: string;
  tenantId: string;
  sourceBranchId: string;
  destinationBranchId: string;
  items: Array<{
    productId: string;
    qtyRequested: number;
    product: {
      productPricePence: number;
    };
  }>;
};

/**
 * Evaluate approval rules for a transfer and create approval records
 * Returns the matched rule (if any) and the approval records created
 */
export async function evaluateApprovalRules(params: {
  transfer: TransferWithItems;
  tx?: Prisma.TransactionClient;
}): Promise<{
  matched: boolean;
  rule?: {
    id: string;
    name: string;
    approvalMode: ApprovalMode;
  };
  approvalRecords?: Array<{
    level: number;
    levelName: string;
    status: ApprovalStatus;
    requiredRoleId?: string | null;
    requiredUserId?: string | null;
  }>;
}> {
  const { transfer, tx } = params;
  const db = tx ?? prismaClientInstance;

  // Get all active rules for tenant, ordered by priority (highest first)
  const rules = await db.transferApprovalRule.findMany({
    where: {
      tenantId: transfer.tenantId,
      isActive: true,
    },
    include: {
      conditions: {
        include: {
          branch: { select: { id: true } },
        },
      },
      levels: {
        orderBy: { level: 'asc' },
        select: {
          level: true,
          name: true,
          requiredRoleId: true,
          requiredUserId: true,
        },
      },
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });

  // Evaluate each rule until we find a match
  for (const rule of rules) {
    const matches = await evaluateRuleConditions(transfer, rule.conditions);

    if (matches) {
      // Create approval records for this transfer
      const approvalRecords = rule.levels.map(level => ({
        transferId: transfer.id,
        level: level.level,
        levelName: level.name,
        status: ApprovalStatus.PENDING,
        requiredRoleId: level.requiredRoleId,
        requiredUserId: level.requiredUserId,
      }));

      // Create records in database
      await db.transferApprovalRecord.createMany({
        data: approvalRecords,
      });

      return {
        matched: true,
        rule: {
          id: rule.id,
          name: rule.name,
          approvalMode: rule.approvalMode,
        },
        approvalRecords,
      };
    }
  }

  // No rule matched
  return { matched: false };
}

/**
 * Evaluate if all conditions of a rule match the transfer
 */
async function evaluateRuleConditions(
  transfer: TransferWithItems,
  conditions: Array<{
    conditionType: ApprovalRuleConditionType;
    threshold?: number | null;
    branchId?: string | null;
  }>
): Promise<boolean> {
  // ALL conditions must match for the rule to apply
  for (const condition of conditions) {
    switch (condition.conditionType) {
      case ApprovalRuleConditionType.TOTAL_QTY_THRESHOLD: {
        const totalQty = transfer.items.reduce((sum, item) => sum + item.qtyRequested, 0);
        if (!(totalQty > (condition.threshold ?? 0))) {
          return false;
        }
        break;
      }

      case ApprovalRuleConditionType.TOTAL_VALUE_THRESHOLD: {
        const totalValuePence = transfer.items.reduce(
          (sum, item) => sum + item.qtyRequested * item.product.productPricePence,
          0
        );
        if (!(totalValuePence > (condition.threshold ?? 0))) {
          return false;
        }
        break;
      }

      case ApprovalRuleConditionType.SOURCE_BRANCH: {
        if (transfer.sourceBranchId !== condition.branchId) {
          return false;
        }
        break;
      }

      case ApprovalRuleConditionType.DESTINATION_BRANCH: {
        if (transfer.destinationBranchId !== condition.branchId) {
          return false;
        }
        break;
      }

      case ApprovalRuleConditionType.PRODUCT_CATEGORY: {
        // Future enhancement: product categories
        // For now, skip this condition type
        break;
      }

      default: {
        // Unknown condition type - skip
        break;
      }
    }
  }

  // All conditions matched
  return true;
}

/**
 * Submit approval for a specific level
 * Validates that:
 * - User is authorized to approve this level (matches required role or user)
 * - Previous levels are approved (if sequential mode)
 * - Level is still pending
 *
 * Returns the updated transfer if all approvals are complete
 */
export async function submitApproval(params: {
  tenantId: string;
  userId: string;
  transferId: string;
  level: number;
  notes?: string;
  auditContext?: AuditCtx;
}) {
  const { tenantId, userId, transferId, level, notes, auditContext } = params;

  // Get transfer with approval records
  const transfer = await prismaClientInstance.stockTransfer.findFirst({
    where: { id: transferId, tenantId },
    include: {
      approvalRecords: {
        orderBy: { level: 'asc' },
        include: {
          requiredRole: { select: { id: true, name: true } },
          requiredUser: { select: { id: true, userEmailAddress: true } },
        },
      },
      sourceBranch: { select: { id: true, branchName: true } },
      destinationBranch: { select: { id: true, branchName: true } },
    },
  });

  if (!transfer) throw Errors.notFound('Transfer not found');

  // Validate: transfer requires multi-level approval
  if (!transfer.requiresMultiLevelApproval) {
    throw Errors.conflict('Transfer does not require multi-level approval');
  }

  // Validate: transfer is in REQUESTED status
  if (transfer.status !== StockTransferStatus.REQUESTED) {
    throw Errors.conflict('Transfer must be in REQUESTED status for approval');
  }

  // Find the approval record for this level
  const approvalRecord = transfer.approvalRecords.find(r => r.level === level);
  if (!approvalRecord) {
    throw Errors.notFound(`Approval level ${level} not found for this transfer`);
  }

  // Validate: approval is still pending
  if (approvalRecord.status !== ApprovalStatus.PENDING) {
    throw Errors.conflict(`Approval level ${level} has already been ${approvalRecord.status.toLowerCase()}`);
  }

  // Validate: user is authorized to approve this level
  const userAuthorized = await isUserAuthorizedForLevel({
    userId,
    tenantId,
    requiredRoleId: approvalRecord.requiredRoleId,
    requiredUserId: approvalRecord.requiredUserId,
  });

  if (!userAuthorized) {
    throw Errors.permissionDenied();
  }

  // For now, assume SEQUENTIAL mode (check this by looking at previous levels)
  // If any previous level is still PENDING, reject
  const previousLevels = transfer.approvalRecords.filter(r => r.level < level);
  const hasPendingPrevious = previousLevels.some(r => r.status === ApprovalStatus.PENDING);

  if (hasPendingPrevious) {
    throw Errors.conflict('Previous approval levels must be completed first');
  }

  // Update approval record and potentially transfer status in transaction
  const result = await prismaClientInstance.$transaction(async (tx) => {
    // Update approval record
    await tx.transferApprovalRecord.update({
      where: { id: approvalRecord.id },
      data: {
        status: ApprovalStatus.APPROVED,
        approvedByUserId: userId,
        approvedAt: new Date(),
        notes: notes ?? null,
      },
    });

    // Check if all approval levels are now complete
    const allRecords = await tx.transferApprovalRecord.findMany({
      where: { transferId },
      select: { level: true, status: true },
    });

    const allApproved = allRecords.every(r => r.status === ApprovalStatus.APPROVED);

    // If all approved, update transfer status to APPROVED and set qtyApproved on items
    if (allApproved) {
      // Get transfer items to set qtyApproved = qtyRequested
      const transferItems = await tx.stockTransferItem.findMany({
        where: { transferId },
        select: { id: true, qtyRequested: true },
      });

      // Update each item's qtyApproved to qtyRequested (multi-level approval approves full qty)
      await Promise.all(
        transferItems.map((item) =>
          tx.stockTransferItem.update({
            where: { id: item.id },
            data: { qtyApproved: item.qtyRequested },
          })
        )
      );

      const updated = await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: StockTransferStatus.APPROVED,
          reviewedByUserId: userId, // Last approver becomes reviewer
          reviewedAt: new Date(),
        },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, productName: true, productSku: true },
              },
            },
          },
          sourceBranch: { select: { id: true, branchName: true, branchSlug: true } },
          destinationBranch: { select: { id: true, branchName: true, branchSlug: true } },
          requestedByUser: { select: { id: true, userEmailAddress: true } },
          reviewedByUser: { select: { id: true, userEmailAddress: true } },
          approvalRecords: {
            orderBy: { level: 'asc' },
            include: {
              approvedByUser: { select: { id: true, userEmailAddress: true } },
            },
          },
        },
      });

      // Audit: transfer approved (all levels complete)
      try {
        await writeAuditEvent(tx, {
          tenantId,
          actorUserId: userId,
          entityType: AuditEntityType.STOCK_TRANSFER,
          entityId: updated.id,
          action: AuditAction.TRANSFER_APPROVE,
          entityName: transfer.transferNumber,
          before: { status: StockTransferStatus.REQUESTED },
          after: {
            status: updated.status,
            reviewedByUserId: updated.reviewedByUserId,
            reviewedAt: updated.reviewedAt,
            approvalLevelsCompleted: updated.approvalRecords.length,
          },
          correlationId: auditContext?.correlationId ?? null,
          ip: auditContext?.ip ?? null,
          userAgent: auditContext?.userAgent ?? null,
        });
      } catch {
        // Swallow audit errors
      }

      return updated;
    }

    // Not all approved yet - return transfer with updated approval record
    const updated = await tx.stockTransfer.findFirst({
      where: { id: transferId },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, productName: true, productSku: true },
            },
          },
        },
        sourceBranch: { select: { id: true, branchName: true, branchSlug: true } },
        destinationBranch: { select: { id: true, branchName: true, branchSlug: true } },
        requestedByUser: { select: { id: true, userEmailAddress: true } },
        approvalRecords: {
          orderBy: { level: 'asc' },
          include: {
            approvedByUser: { select: { id: true, userEmailAddress: true } },
          },
        },
      },
    });

    // Audit: level approved
    try {
      await writeAuditEvent(tx, {
        tenantId,
        actorUserId: userId,
        entityType: AuditEntityType.STOCK_TRANSFER,
        entityId: transferId,
        action: AuditAction.TRANSFER_APPROVE_LEVEL,
        entityName: transfer.transferNumber,
        before: { approvalLevel: level, status: ApprovalStatus.PENDING },
        after: {
          approvalLevel: level,
          status: ApprovalStatus.APPROVED,
          approvedByUserId: userId,
          notes,
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
 * Check if user is authorized to approve a specific level
 * User is authorized if:
 * - Level requires a specific user AND user matches
 * - Level requires a role AND user has that role in the tenant
 */
async function isUserAuthorizedForLevel(params: {
  userId: string;
  tenantId: string;
  requiredRoleId?: string | null;
  requiredUserId?: string | null;
}): Promise<boolean> {
  const { userId, tenantId, requiredRoleId, requiredUserId } = params;

  // If specific user is required, check exact match
  if (requiredUserId) {
    return userId === requiredUserId;
  }

  // If role is required, check user has that role in tenant
  if (requiredRoleId) {
    const membership = await prismaClientInstance.userTenantMembership.findFirst({
      where: {
        userId,
        tenantId,
        roleId: requiredRoleId,
      },
      select: { id: true },
    });

    return !!membership;
  }

  // No requirement specified (shouldn't happen, but allow as fallback)
  return false;
}

/**
 * Get approval progress for a transfer
 */
export async function getApprovalProgress(params: {
  tenantId: string;
  transferId: string;
}) {
  const { tenantId, transferId } = params;

  const transfer = await prismaClientInstance.stockTransfer.findFirst({
    where: { id: transferId, tenantId },
    include: {
      approvalRecords: {
        orderBy: { level: 'asc' },
        include: {
          requiredRole: { select: { id: true, name: true } },
          requiredUser: { select: { id: true, userEmailAddress: true } },
          approvedByUser: { select: { id: true, userEmailAddress: true } },
        },
      },
    },
  });

  if (!transfer) throw Errors.notFound('Transfer not found');

  if (!transfer.requiresMultiLevelApproval) {
    return {
      requiresApproval: false,
      records: [],
    };
  }

  return {
    requiresApproval: true,
    records: transfer.approvalRecords,
  };
}
