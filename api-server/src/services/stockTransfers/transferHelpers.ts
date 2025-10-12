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
 * Check if user has access to transfer (member of source or destination branch)
 */
export async function assertTransferAccess(params: {
  userId: string;
  tenantId: string;
  transferId: string;
}) {
  const { userId, tenantId, transferId } = params;

  const transfer = await prismaClientInstance.stockTransfer.findFirst({
    where: { id: transferId, tenantId },
    select: { sourceBranchId: true, destinationBranchId: true },
  });

  if (!transfer) throw Errors.notFound('Transfer not found');

  const membership = await prismaClientInstance.userBranchMembership.findFirst({
    where: {
      userId,
      tenantId,
      branchId: { in: [transfer.sourceBranchId, transfer.destinationBranchId] },
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
