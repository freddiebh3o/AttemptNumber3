// api-server/src/services/stockTransfers/transferHelpers.ts
import { prismaClientInstance } from '../../db/prismaClient.js';
import { Errors } from '../../utils/httpErrors.js';

/**
 * Calculate weighted average unit cost from consumed lots
 */
export function calculateWeightedAvgCost(
  lotsConsumed: Array<{
    lotId: string;
    qty: number;
    unitCostPence: number | null;
  }>
): number {
  let totalCost = 0;
  let totalQty = 0;

  for (const lot of lotsConsumed) {
    if (lot.unitCostPence !== null) {
      totalCost += lot.qty * lot.unitCostPence;
      totalQty += lot.qty;
    }
  }

  return totalQty > 0 ? Math.round(totalCost / totalQty) : 0;
}

/**
 * Extract lot details from FIFO consumption result
 */
export function extractLotsConsumed(
  fifoResult: {
    affected: Array<{
      lotId: string;
      take: number;
      ledgerId: string;
    }>;
  },
  lots: Array<{
    id: string;
    unitCostPence: number | null;
  }>
): Array<{
  lotId: string;
  qty: number;
  unitCostPence: number | null;
}> {
  return fifoResult.affected.map((a) => {
    const lot = lots.find((l) => l.id === a.lotId);
    return {
      lotId: a.lotId,
      qty: a.take,
      unitCostPence: lot?.unitCostPence ?? null,
    };
  });
}

/**
 * Check if user has access to transfer (member of initiating branch)
 * For PUSH transfers: user must be in source branch (initiating)
 * For PULL transfers: user must be in destination branch (initiating)
 *
 * Note: This allows users from the initiating branch to view/manage the transfer
 */
export async function assertTransferAccess(params: {
  userId: string;
  tenantId: string;
  transferId: string;
}) {
  const { userId, tenantId, transferId } = params;

  const transfer = await prismaClientInstance.stockTransfer.findFirst({
    where: { id: transferId, tenantId },
    select: {
      sourceBranchId: true,
      destinationBranchId: true,
      initiatedByBranchId: true,
    },
  });

  if (!transfer) throw Errors.notFound('Transfer not found');

  // User must be member of the initiating branch to access the transfer
  const initiatingBranchId = transfer.initiatedByBranchId ?? transfer.sourceBranchId;

  const membership = await prismaClientInstance.userBranchMembership.findFirst({
    where: {
      userId,
      tenantId,
      branchId: initiatingBranchId,
    },
  });

  if (!membership) {
    throw Errors.permissionDenied();
  }

  return transfer;
}

/**
 * Assert user has membership in a specific branch
 */
export async function assertBranchMembership(params: {
  userId: string;
  tenantId: string;
  branchId: string;
  errorMessage?: string;
}) {
  const { userId, tenantId, branchId, errorMessage } = params;

  const membership = await prismaClientInstance.userBranchMembership.findFirst({
    where: { userId, tenantId, branchId },
    select: { id: true },
  });

  if (!membership) {
    throw Errors.permissionDenied();
  }
}

/**
 * Reverse lots at a branch by extracting lotsConsumed from transfer items
 * and restoring those specific lots
 */
export async function reverseLotsAtBranch(params: {
  tenantId: string;
  userId: string;
  branchId: string;
  transferItems: Array<{
    productId: string;
    shipmentBatches?: any; // JSON field containing lotsConsumed
  }>;
  transferNumber: string;
  auditContext?: {
    correlationId?: string | null;
    ip?: string | null;
    userAgent?: string | null;
  };
}): Promise<{
  restoredLots: Array<{
    lotId: string;
    qty: number;
    productId: string;
  }>;
}> {
  const { tenantId, userId, branchId, transferItems, transferNumber, auditContext } = params;

  // Import restoreLotQuantities (must be done dynamically to avoid circular dependency)
  const { restoreLotQuantities } = await import('../stockService.js');

  // Extract all lotsConsumed from shipmentBatches across all items
  const lotsToRestoreMap = new Map<string, number>(); // lotId -> total qty

  for (const item of transferItems) {
    if (!item.shipmentBatches) continue;

    const batches = Array.isArray(item.shipmentBatches) ? item.shipmentBatches : [];

    for (const batch of batches) {
      if (!batch.lotsConsumed) continue;

      const lotsConsumed = Array.isArray(batch.lotsConsumed) ? batch.lotsConsumed : [];

      for (const lot of lotsConsumed) {
        if (lot.lotId && lot.qty > 0) {
          const currentQty = lotsToRestoreMap.get(lot.lotId) ?? 0;
          lotsToRestoreMap.set(lot.lotId, currentQty + lot.qty);
        }
      }
    }
  }

  // Convert map to array
  const lotsToRestore = Array.from(lotsToRestoreMap.entries()).map(([lotId, qty]) => ({
    lotId,
    qty,
  }));

  if (lotsToRestore.length === 0) {
    // No lots to restore (e.g., old transfers before lot tracking)
    return { restoredLots: [] };
  }

  // Call restoreLotQuantities to increment lots and create REVERSAL ledger entries
  const result = await restoreLotQuantities(
    { currentTenantId: tenantId, currentUserId: userId },
    {
      branchId,
      lotsToRestore,
      reason: `Reversal of transfer ${transferNumber}`,
      ...(auditContext ? { auditContextOptional: auditContext } : {}),
    }
  );

  return {
    restoredLots: result.restoredLots.map((lot) => ({
      lotId: lot.lotId,
      qty: lot.qty,
      productId: lot.productId,
    })),
  };
}
