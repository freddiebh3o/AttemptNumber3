// api-server/src/services/stockTransfers/stockTransferService.ts
import { Prisma, StockTransferStatus, AuditAction, AuditEntityType } from '@prisma/client';
import { prismaClientInstance } from '../../db/prismaClient.js';
import { Errors } from '../../utils/httpErrors.js';
import { writeAuditEvent } from '../auditLoggerService.js';
import { consumeStock, receiveStock } from '../stockService.js';
import {
  calculateWeightedAvgCost,
  extractLotsConsumed,
  assertTransferAccess,
  assertBranchMembership,
} from './transferHelpers.js';

type Ids = {
  currentTenantId: string;
  currentUserId: string;
};

type AuditCtx = {
  correlationId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * Generate next transfer number for tenant
 * Format: TRF-{YYYY}-{NNNN}
 *
 * NOTE: To handle race conditions, this function adds a small random offset
 * to spread out concurrent requests. If a unique constraint violation still
 * occurs, the caller should retry the entire transaction.
 */
export async function generateTransferNumber(
  tenantId: string,
  tx?: Prisma.TransactionClient
): Promise<string> {
  const db = tx ?? prismaClientInstance;

  const year = new Date().getFullYear();
  const prefix = `TRF-${year}-`;

  // Find max transfer number for this tenant in this year
  const latest = await db.stockTransfer.findFirst({
    where: {
      tenantId,
      transferNumber: { startsWith: prefix },
    },
    orderBy: { transferNumber: 'desc' },
    select: { transferNumber: true },
  });

  let nextNum = 1;
  if (latest) {
    // Extract numeric suffix (e.g., "TRF-2025-0042" → 42)
    const match = latest.transferNumber.match(/(\d+)$/);
    if (match && match[1]) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  // Add small random offset (0-9) to reduce collision probability in concurrent requests
  // This helps when multiple requests arrive simultaneously
  const randomOffset = Math.floor(Math.random() * 10);
  nextNum += randomOffset;

  // Zero-pad to 4 digits
  const suffix = String(nextNum).padStart(4, '0');
  return `${prefix}${suffix}`;
}

/**
 * Create a new stock transfer request
 */
export async function createStockTransfer(params: {
  tenantId: string;
  userId: string;
  data: {
    sourceBranchId: string;
    destinationBranchId: string;
    requestNotes?: string;
    items: Array<{
      productId: string;
      qtyRequested: number;
    }>;
  };
  auditContext?: AuditCtx;
}) {
  const { tenantId, userId, data, auditContext } = params;

  // Validation: source and destination must be different
  if (data.sourceBranchId === data.destinationBranchId) {
    throw Errors.validation('Source and destination branches must be different');
  }

  // Validation: at least one item
  if (!data.items || data.items.length === 0) {
    throw Errors.validation('Transfer must include at least one item');
  }

  // Validate: user is member of destination branch
  await assertBranchMembership({
    userId,
    tenantId,
    branchId: data.destinationBranchId,
    errorMessage: 'You must be a member of the destination branch to request transfers',
  });

  // Validate: both branches exist and belong to tenant
  const [sourceBranch, destinationBranch] = await Promise.all([
    prismaClientInstance.branch.findFirst({
      where: { id: data.sourceBranchId, tenantId, isActive: true },
      select: { id: true },
    }),
    prismaClientInstance.branch.findFirst({
      where: { id: data.destinationBranchId, tenantId, isActive: true },
      select: { id: true },
    }),
  ]);

  if (!sourceBranch) throw Errors.notFound('Source branch not found');
  if (!destinationBranch) throw Errors.notFound('Destination branch not found');

  // Validate: all products exist and belong to tenant
  const products = await prismaClientInstance.product.findMany({
    where: {
      id: { in: data.items.map((i) => i.productId) },
      tenantId,
    },
    select: { id: true },
  });

  if (products.length !== data.items.length) {
    throw Errors.validation('One or more products not found for this tenant');
  }

  // Create transfer in transaction with retry for race conditions
  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await prismaClientInstance.$transaction(async (tx) => {
        // Generate transfer number
        const transferNumber = await generateTransferNumber(tenantId, tx);

        // Create transfer
        const transfer = await tx.stockTransfer.create({
      data: {
        tenantId,
        transferNumber,
        sourceBranchId: data.sourceBranchId,
        destinationBranchId: data.destinationBranchId,
        status: StockTransferStatus.REQUESTED,
        requestedByUserId: userId,
        requestNotes: data.requestNotes ?? null,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            qtyRequested: item.qtyRequested,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                productName: true,
                productSku: true,
              },
            },
          },
        },
        sourceBranch: {
          select: { id: true, branchName: true, branchSlug: true },
        },
        destinationBranch: {
          select: { id: true, branchName: true, branchSlug: true },
        },
        requestedByUser: {
          select: { id: true, userEmailAddress: true },
        },
      },
    });

    // Write audit event
    try {
      await writeAuditEvent(tx, {
        tenantId,
        actorUserId: auditContext?.correlationId ? null : userId,
        entityType: AuditEntityType.STOCK_TRANSFER,
        entityId: transfer.id,
        action: AuditAction.TRANSFER_REQUEST,
        entityName: transfer.transferNumber,
        before: null,
        after: {
          id: transfer.id,
          transferNumber: transfer.transferNumber,
          sourceBranchId: transfer.sourceBranchId,
          destinationBranchId: transfer.destinationBranchId,
          status: transfer.status,
          requestedByUserId: transfer.requestedByUserId,
        },
        correlationId: auditContext?.correlationId ?? null,
        ip: auditContext?.ip ?? null,
        userAgent: auditContext?.userAgent ?? null,
      });
    } catch {
      // Swallow audit errors
    }

        return transfer;
      });

      // Success - return the result
      return result;
    } catch (error: any) {
      // Check if this is a unique constraint violation on transferNumber
      if (error.code === 'P2002' && error.meta?.target?.includes('transferNumber')) {
        lastError = error;
        // If not last attempt, add small delay and retry
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
          continue;
        }
      }
      // Not a transferNumber collision or last attempt failed - throw the error
      throw error;
    }
  }

  // All retries exhausted
  throw lastError || new Error('Failed to create transfer after retries');
}

/**
 * Review transfer (approve or reject)
 */
export async function reviewStockTransfer(params: {
  tenantId: string;
  userId: string;
  transferId: string;
  action: 'approve' | 'reject';
  reviewNotes?: string;
  approvedItems?: Array<{
    itemId: string;
    qtyApproved: number;
  }>;
  auditContext?: AuditCtx;
}) {
  const { tenantId, userId, transferId, action, reviewNotes, approvedItems, auditContext } = params;

  // Get transfer and validate access
  const transfer = await prismaClientInstance.stockTransfer.findFirst({
    where: { id: transferId, tenantId },
    include: {
      items: true,
      sourceBranch: { select: { id: true, branchName: true } },
      destinationBranch: { select: { id: true, branchName: true } },
    },
  });

  if (!transfer) throw Errors.notFound('Transfer not found');

  // Validate: user is member of source branch
  await assertBranchMembership({
    userId,
    tenantId,
    branchId: transfer.sourceBranchId,
    errorMessage: 'You must be a member of the source branch to review transfers',
  });

  // Validate: transfer is in REQUESTED status
  if (transfer.status !== StockTransferStatus.REQUESTED) {
    throw Errors.conflict('Transfer can only be reviewed when in REQUESTED status');
  }

  // Update transfer in transaction
  const result = await prismaClientInstance.$transaction(async (tx) => {
    if (action === 'reject') {
      // Reject transfer
      const updated = await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: StockTransferStatus.REJECTED,
          reviewedByUserId: userId,
          reviewedAt: new Date(),
          reviewNotes: reviewNotes ?? null,
        },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, productName: true, productSku: true },
              },
            },
          },
          sourceBranch: {
            select: { id: true, branchName: true, branchSlug: true },
          },
          destinationBranch: {
            select: { id: true, branchName: true, branchSlug: true },
          },
          requestedByUser: {
            select: { id: true, userEmailAddress: true },
          },
          reviewedByUser: {
            select: { id: true, userEmailAddress: true },
          },
        },
      });

      // Audit: rejection
      try {
        await writeAuditEvent(tx, {
          tenantId,
          actorUserId: userId,
          entityType: AuditEntityType.STOCK_TRANSFER,
          entityId: updated.id,
          action: AuditAction.TRANSFER_REJECT,
          entityName: updated.transferNumber,
          before: { status: StockTransferStatus.REQUESTED },
          after: {
            status: updated.status,
            reviewedByUserId: updated.reviewedByUserId,
            reviewedAt: updated.reviewedAt,
            reviewNotes: updated.reviewNotes,
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

    // Approve transfer
    // Build approval map from approvedItems (if provided)
    const approvalMap = new Map<string, number>();
    if (approvedItems && approvedItems.length > 0) {
      for (const item of approvedItems) {
        approvalMap.set(item.itemId, item.qtyApproved);
      }
    }

    // Update transfer status and items
    const itemUpdates = transfer.items.map((item) => {
      const qtyApproved = approvalMap.has(item.id)
        ? approvalMap.get(item.id)!
        : item.qtyRequested;

      return tx.stockTransferItem.update({
        where: { id: item.id },
        data: { qtyApproved },
      });
    });

    await Promise.all(itemUpdates);

    const updated = await tx.stockTransfer.update({
      where: { id: transferId },
      data: {
        status: StockTransferStatus.APPROVED,
        reviewedByUserId: userId,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes ?? null,
      },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, productName: true, productSku: true },
            },
          },
        },
        sourceBranch: {
          select: { id: true, branchName: true, branchSlug: true },
        },
        destinationBranch: {
          select: { id: true, branchName: true, branchSlug: true },
        },
        requestedByUser: {
          select: { id: true, userEmailAddress: true },
        },
        reviewedByUser: {
          select: { id: true, userEmailAddress: true },
        },
      },
    });

    // Audit: approval
    try {
      await writeAuditEvent(tx, {
        tenantId,
        actorUserId: userId,
        entityType: AuditEntityType.STOCK_TRANSFER,
        entityId: updated.id,
        action: AuditAction.TRANSFER_APPROVE,
        entityName: updated.transferNumber,
        before: { status: StockTransferStatus.REQUESTED },
        after: {
          status: updated.status,
          reviewedByUserId: updated.reviewedByUserId,
          reviewedAt: updated.reviewedAt,
          items: updated.items.map((i) => ({
            itemId: i.id,
            qtyRequested: i.qtyRequested,
            qtyApproved: i.qtyApproved,
          })),
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
 * Ship approved transfer (consume stock at source using FIFO)
 * NOTE: consumeStock creates its own serializable transaction, so we process
 * items first, then update the transfer in a separate transaction.
 */
export async function shipStockTransfer(params: {
  tenantId: string;
  userId: string;
  transferId: string;
  auditContext?: AuditCtx;
}) {
  const { tenantId, userId, transferId, auditContext } = params;

  // Get transfer and validate
  const transfer = await prismaClientInstance.stockTransfer.findFirst({
    where: { id: transferId, tenantId },
    include: {
      items: {
        include: {
          product: { select: { id: true, productName: true, productSku: true } },
        },
      },
      sourceBranch: { select: { id: true, branchName: true } },
      destinationBranch: { select: { id: true, branchName: true } },
    },
  });

  if (!transfer) throw Errors.notFound('Transfer not found');

  // Validate: user is member of source branch
  await assertBranchMembership({
    userId,
    tenantId,
    branchId: transfer.sourceBranchId,
    errorMessage: 'You must be a member of the source branch to ship transfers',
  });

  // Validate: transfer is APPROVED
  if (transfer.status !== StockTransferStatus.APPROVED) {
    throw Errors.conflict('Transfer must be APPROVED before shipping');
  }

  // Process stock consumption for each item (each consumeStock call creates its own serializable transaction)
  const itemUpdates: Array<{
    itemId: string;
    qtyShipped: number;
    lotsConsumed: Array<{ lotId: string; qty: number; unitCostPence: number | null }>;
    avgUnitCostPence: number;
  }> = [];

  for (const item of transfer.items) {
    if (!item.qtyApproved || item.qtyApproved <= 0) continue;

    // Get lots for cost tracking BEFORE consuming
    const lots = await prismaClientInstance.stockLot.findMany({
      where: {
        tenantId,
        branchId: transfer.sourceBranchId,
        productId: item.productId,
        qtyRemaining: { gt: 0 },
      },
      orderBy: [{ receivedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, unitCostPence: true, qtyRemaining: true },
    });

    // Consume stock using existing FIFO service (creates its own serializable transaction)
    const consumeResult = await consumeStock(
      { currentTenantId: tenantId, currentUserId: userId },
      {
        branchId: transfer.sourceBranchId,
        productId: item.productId,
        qty: item.qtyApproved,
        reason: `Transfer ${transfer.transferNumber}`,
        ...(auditContext ? { auditContextOptional: auditContext } : {}),
      }
    );

    // Extract lot consumption details
    const lotsConsumed = extractLotsConsumed(consumeResult, lots);

    // Calculate weighted average cost
    const avgUnitCostPence = calculateWeightedAvgCost(lotsConsumed);

    itemUpdates.push({
      itemId: item.id,
      qtyShipped: item.qtyApproved,
      lotsConsumed,
      avgUnitCostPence,
    });
  }

  // Now update the transfer and items in a single transaction
  const result = await prismaClientInstance.$transaction(async (tx) => {
    // Update all items with shipping details
    await Promise.all(
      itemUpdates.map((update) =>
        tx.stockTransferItem.update({
          where: { id: update.itemId },
          data: {
            qtyShipped: update.qtyShipped,
            lotsConsumed: update.lotsConsumed as any, // JSON field
            avgUnitCostPence: update.avgUnitCostPence,
          },
        })
      )
    );

    // Update transfer status
    const updated = await tx.stockTransfer.update({
      where: { id: transferId },
      data: {
        status: StockTransferStatus.IN_TRANSIT,
        shippedByUserId: userId,
        shippedAt: new Date(),
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, productName: true, productSku: true } },
          },
        },
        sourceBranch: { select: { id: true, branchName: true, branchSlug: true } },
        destinationBranch: { select: { id: true, branchName: true, branchSlug: true } },
        requestedByUser: { select: { id: true, userEmailAddress: true } },
        reviewedByUser: { select: { id: true, userEmailAddress: true } },
        shippedByUser: { select: { id: true, userEmailAddress: true } },
      },
    });

    // Audit
    try {
      await writeAuditEvent(tx, {
        tenantId,
        actorUserId: userId,
        entityType: AuditEntityType.STOCK_TRANSFER,
        entityId: updated.id,
        action: AuditAction.TRANSFER_SHIP,
        entityName: updated.transferNumber,
        before: { status: StockTransferStatus.APPROVED },
        after: {
          status: updated.status,
          shippedByUserId: updated.shippedByUserId,
          shippedAt: updated.shippedAt,
          items: updated.items.map((i) => ({
            itemId: i.id,
            qtyShipped: i.qtyShipped,
            avgUnitCostPence: i.avgUnitCostPence,
          })),
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
 * Receive transferred items at destination
 * NOTE: receiveStock creates its own serializable transaction, so we process
 * items first, then update the transfer in a separate transaction.
 */
export async function receiveStockTransfer(params: {
  tenantId: string;
  userId: string;
  transferId: string;
  receivedItems: Array<{
    itemId: string;
    qtyReceived: number;
  }>;
  auditContext?: AuditCtx;
}) {
  const { tenantId, userId, transferId, receivedItems, auditContext } = params;

  // Get transfer and validate
  const transfer = await prismaClientInstance.stockTransfer.findFirst({
    where: { id: transferId, tenantId },
    include: {
      items: {
        include: {
          product: { select: { id: true, productName: true, productSku: true } },
        },
      },
      sourceBranch: { select: { id: true, branchName: true } },
      destinationBranch: { select: { id: true, branchName: true } },
    },
  });

  if (!transfer) throw Errors.notFound('Transfer not found');

  // Validate: user is member of destination branch
  await assertBranchMembership({
    userId,
    tenantId,
    branchId: transfer.destinationBranchId,
    errorMessage: 'You must be a member of the destination branch to receive transfers',
  });

  // Validate: transfer is IN_TRANSIT or PARTIALLY_RECEIVED
  if (
    transfer.status !== StockTransferStatus.IN_TRANSIT &&
    transfer.status !== StockTransferStatus.PARTIALLY_RECEIVED
  ) {
    throw Errors.conflict('Transfer must be IN_TRANSIT or PARTIALLY_RECEIVED to receive items');
  }

  // Validate received quantities
  for (const received of receivedItems) {
    const item = transfer.items.find((i) => i.id === received.itemId);
    if (!item) {
      throw Errors.validation(`Item ${received.itemId} not found in transfer`);
    }

    const remainingToReceive = item.qtyShipped - item.qtyReceived;
    if (received.qtyReceived > remainingToReceive) {
      throw Errors.validation(
        `Cannot receive ${received.qtyReceived} units - only ${remainingToReceive} remaining`
      );
    }

    if (received.qtyReceived <= 0) {
      throw Errors.validation('Received quantity must be greater than 0');
    }
  }

  // Process stock receipt for each item (each receiveStock call creates its own serializable transaction)
  for (const received of receivedItems) {
    const item = transfer.items.find((i) => i.id === received.itemId);
    if (!item) continue;

    // Use avgUnitCostPence from transfer item as cost basis
    await receiveStock(
      { currentTenantId: tenantId, currentUserId: userId },
      {
        branchId: transfer.destinationBranchId,
        productId: item.productId,
        qty: received.qtyReceived,
        unitCostPence: item.avgUnitCostPence ?? undefined,
        sourceRef: `Transfer ${transfer.transferNumber}`,
        reason: `Transfer ${transfer.transferNumber}`,
        ...(auditContext ? { auditContextOptional: auditContext } : {}),
      }
    );
  }

  // Now update the transfer in a transaction
  const result = await prismaClientInstance.$transaction(async (tx) => {
    // Update item received quantities
    for (const received of receivedItems) {
      await tx.stockTransferItem.update({
        where: { id: received.itemId },
        data: {
          qtyReceived: { increment: received.qtyReceived },
        },
      });
    }

    // Check if all items fully received
    const updatedItems = await tx.stockTransferItem.findMany({
      where: { transferId },
      select: { qtyShipped: true, qtyReceived: true },
    });

    const allReceived = updatedItems.every((item) => item.qtyReceived >= item.qtyShipped);

    // Update transfer status
    const newStatus = allReceived
      ? StockTransferStatus.COMPLETED
      : StockTransferStatus.PARTIALLY_RECEIVED;

    const updated = await tx.stockTransfer.update({
      where: { id: transferId },
      data: {
        status: newStatus,
        ...(allReceived ? { completedAt: new Date() } : {}),
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, productName: true, productSku: true } },
          },
        },
        sourceBranch: { select: { id: true, branchName: true, branchSlug: true } },
        destinationBranch: { select: { id: true, branchName: true, branchSlug: true } },
        requestedByUser: { select: { id: true, userEmailAddress: true } },
        reviewedByUser: { select: { id: true, userEmailAddress: true } },
        shippedByUser: { select: { id: true, userEmailAddress: true } },
      },
    });

    // Audit
    try {
      await writeAuditEvent(tx, {
        tenantId,
        actorUserId: userId,
        entityType: AuditEntityType.STOCK_TRANSFER,
        entityId: updated.id,
        action: AuditAction.TRANSFER_RECEIVE,
        entityName: updated.transferNumber,
        before: { status: transfer.status },
        after: {
          status: updated.status,
          ...(allReceived ? { completedAt: updated.completedAt } : {}),
          receivedItems: receivedItems,
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
 * Cancel transfer (only REQUESTED status)
 */
export async function cancelStockTransfer(params: {
  tenantId: string;
  userId: string;
  transferId: string;
  auditContext?: AuditCtx;
}) {
  const { tenantId, userId, transferId, auditContext } = params;

  // Get transfer and validate
  const transfer = await prismaClientInstance.stockTransfer.findFirst({
    where: { id: transferId, tenantId },
    select: {
      id: true,
      transferNumber: true,
      status: true,
      requestedByUserId: true,
      destinationBranchId: true,
    },
  });

  if (!transfer) throw Errors.notFound('Transfer not found');

  // Validate: only REQUESTED status can be cancelled
  if (transfer.status !== StockTransferStatus.REQUESTED) {
    throw Errors.conflict('Only transfers in REQUESTED status can be cancelled');
  }

  // Validate: user is either requester or member of destination branch
  const isRequester = transfer.requestedByUserId === userId;
  let isMember = false;
  if (!isRequester) {
    const membership = await prismaClientInstance.userBranchMembership.findFirst({
      where: { userId, tenantId, branchId: transfer.destinationBranchId },
    });
    isMember = !!membership;
  }

  if (!isRequester && !isMember) {
    throw Errors.permissionDenied();
  }

  // Update transfer
  const result = await prismaClientInstance.$transaction(async (tx) => {
    const updated = await tx.stockTransfer.update({
      where: { id: transferId },
      data: {
        status: StockTransferStatus.CANCELLED,
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, productName: true, productSku: true } },
          },
        },
        sourceBranch: { select: { id: true, branchName: true, branchSlug: true } },
        destinationBranch: { select: { id: true, branchName: true, branchSlug: true } },
        requestedByUser: { select: { id: true, userEmailAddress: true } },
      },
    });

    // Audit
    try {
      await writeAuditEvent(tx, {
        tenantId,
        actorUserId: userId,
        entityType: AuditEntityType.STOCK_TRANSFER,
        entityId: updated.id,
        action: AuditAction.TRANSFER_CANCEL,
        entityName: updated.transferNumber,
        before: { status: StockTransferStatus.REQUESTED },
        after: { status: updated.status },
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
 * List stock transfers with filters and pagination
 */
export async function listStockTransfers(params: {
  tenantId: string;
  userId: string;
  filters?: {
    branchId?: string;
    direction?: 'inbound' | 'outbound';
    status?: string; // comma-separated
    q?: string; // Search transfer number
    sortBy?: 'requestedAt' | 'updatedAt' | 'transferNumber' | 'status';
    sortDir?: 'asc' | 'desc';
    requestedAtFrom?: string; // ISO date
    requestedAtTo?: string;
    shippedAtFrom?: string;
    shippedAtTo?: string;
    limit?: number;
    cursor?: string;
    includeTotal?: boolean;
  };
}) {
  const { tenantId, userId, filters } = params;

  // Get user's branch memberships
  const memberships = await prismaClientInstance.userBranchMembership.findMany({
    where: { userId, tenantId },
    select: { branchId: true },
  });

  const userBranchIds = memberships.map((m) => m.branchId);

  // Build where clause
  const where: Prisma.StockTransferWhereInput = {
    tenantId,
  };

  // Filter by branch and direction
  if (filters?.branchId) {
    if (filters.direction === 'inbound') {
      where.destinationBranchId = filters.branchId;
    } else if (filters.direction === 'outbound') {
      where.sourceBranchId = filters.branchId;
    } else {
      // Both directions
      where.OR = [
        { sourceBranchId: filters.branchId },
        { destinationBranchId: filters.branchId },
      ];
    }
  } else {
    // Filter to user's branches (either source or destination)
    where.OR = [
      { sourceBranchId: { in: userBranchIds } },
      { destinationBranchId: { in: userBranchIds } },
    ];
  }

  // Filter by status
  if (filters?.status) {
    const statuses = filters.status
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s) as StockTransferStatus[];

    if (statuses.length > 0) {
      where.status = { in: statuses };
    }
  }

  // Filter by transfer number (search)
  if (filters?.q) {
    where.transferNumber = { contains: filters.q, mode: 'insensitive' };
  }

  // Filter by requested date range
  if (filters?.requestedAtFrom) {
    const fromDate = new Date(filters.requestedAtFrom);
    if (!where.requestedAt) where.requestedAt = {};
    (where.requestedAt as any).gte = fromDate;
  }
  if (filters?.requestedAtTo) {
    const toDate = new Date(filters.requestedAtTo);
    toDate.setHours(23, 59, 59, 999); // End of day
    if (!where.requestedAt) where.requestedAt = {};
    (where.requestedAt as any).lte = toDate;
  }

  // Filter by shipped date range
  if (filters?.shippedAtFrom) {
    const fromDate = new Date(filters.shippedAtFrom);
    if (!where.shippedAt) where.shippedAt = {};
    (where.shippedAt as any).gte = fromDate;
  }
  if (filters?.shippedAtTo) {
    const toDate = new Date(filters.shippedAtTo);
    toDate.setHours(23, 59, 59, 999); // End of day
    if (!where.shippedAt) where.shippedAt = {};
    (where.shippedAt as any).lte = toDate;
  }

  // Sorting
  const sortBy = filters?.sortBy ?? 'requestedAt';
  const sortDir = filters?.sortDir ?? 'desc';

  const orderBy: Prisma.StockTransferOrderByWithRelationInput[] = [];

  if (sortBy === 'requestedAt') {
    orderBy.push({ requestedAt: sortDir }, { id: sortDir });
  } else if (sortBy === 'updatedAt') {
    orderBy.push({ updatedAt: sortDir }, { id: sortDir });
  } else if (sortBy === 'transferNumber') {
    orderBy.push({ transferNumber: sortDir }, { id: sortDir });
  } else if (sortBy === 'status') {
    orderBy.push({ status: sortDir }, { id: sortDir });
  } else {
    // Default fallback
    orderBy.push({ requestedAt: sortDir }, { id: sortDir });
  }

  // Pagination
  const limit = Math.min(Math.max(filters?.limit ?? 20, 1), 100);
  const take = limit + 1;

  const findArgs: Prisma.StockTransferFindManyArgs = {
    where,
    orderBy,
    take,
    include: {
      items: {
        include: {
          product: { select: { id: true, productName: true, productSku: true } },
        },
      },
      sourceBranch: { select: { id: true, branchName: true, branchSlug: true } },
      destinationBranch: { select: { id: true, branchName: true, branchSlug: true } },
      requestedByUser: { select: { id: true, userEmailAddress: true } },
      reviewedByUser: { select: { id: true, userEmailAddress: true } },
      shippedByUser: { select: { id: true, userEmailAddress: true } },
    },
  };

  if (filters?.cursor) {
    findArgs.cursor = { id: filters.cursor };
    findArgs.skip = 1;
  }

  const rows = await prismaClientInstance.stockTransfer.findMany(findArgs);

  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const nextCursor = hasNextPage ? items[items.length - 1]?.id ?? null : null;

  // Optionally include total count
  let totalCount: number | undefined = undefined;
  if (filters?.includeTotal) {
    totalCount = await prismaClientInstance.stockTransfer.count({ where });
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
 * Get single stock transfer with full details
 */
export async function getStockTransfer(params: {
  tenantId: string;
  userId: string;
  transferId: string;
}) {
  const { tenantId, userId, transferId } = params;

  // Validate access
  await assertTransferAccess({ userId, tenantId, transferId });

  // Get transfer with full details
  const transfer = await prismaClientInstance.stockTransfer.findFirst({
    where: { id: transferId, tenantId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              productName: true,
              productSku: true,
              productPricePence: true,
            },
          },
        },
      },
      sourceBranch: { select: { id: true, branchName: true, branchSlug: true } },
      destinationBranch: { select: { id: true, branchName: true, branchSlug: true } },
      requestedByUser: { select: { id: true, userEmailAddress: true } },
      reviewedByUser: { select: { id: true, userEmailAddress: true } },
      shippedByUser: { select: { id: true, userEmailAddress: true } },
    },
  });

  if (!transfer) throw Errors.notFound('Transfer not found');

  return transfer;
}
