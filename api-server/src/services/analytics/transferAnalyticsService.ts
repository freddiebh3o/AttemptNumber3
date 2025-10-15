// api-server/src/services/analytics/transferAnalyticsService.ts
import { Prisma, StockTransferStatus } from '@prisma/client';
import { prismaClientInstance } from '../../db/prismaClient.js';
import { Errors } from '../../utils/httpErrors.js';

/**
 * Get overview metrics for Transfer Analytics Dashboard
 * Calculates top 4 metrics cards from StockTransfer table in real-time
 */
export async function getOverviewMetrics(params: {
  tenantId: string;
  startDate: Date;
  endDate: Date;
  branchId?: string;
}) {
  const { tenantId, startDate, endDate, branchId } = params;

  // Build where clause
  const where: Prisma.StockTransferWhereInput = {
    tenantId,
    requestedAt: {
      gte: startDate,
      lte: endDate,
    },
  };

  // Filter by branch (either source or destination)
  if (branchId) {
    where.OR = [{ sourceBranchId: branchId }, { destinationBranchId: branchId }];
  }

  // Total transfers in date range
  const totalTransfers = await prismaClientInstance.stockTransfer.count({ where });

  // Active transfers (not COMPLETED, REJECTED, CANCELLED)
  const activeTransfers = await prismaClientInstance.stockTransfer.count({
    where: {
      ...where,
      status: {
        in: [
          StockTransferStatus.REQUESTED,
          StockTransferStatus.APPROVED,
          StockTransferStatus.IN_TRANSIT,
          StockTransferStatus.PARTIALLY_RECEIVED,
        ],
      },
    },
  });

  // Calculate average times (REQUESTED → APPROVED → IN_TRANSIT → COMPLETED)
  const completedTransfers = await prismaClientInstance.stockTransfer.findMany({
    where: {
      ...where,
      status: StockTransferStatus.COMPLETED,
      reviewedAt: { not: null },
      shippedAt: { not: null },
      completedAt: { not: null },
    },
    select: {
      requestedAt: true,
      reviewedAt: true,
      shippedAt: true,
      completedAt: true,
    },
  });

  let avgApprovalTime = 0;
  let avgShipTime = 0;
  let avgReceiveTime = 0;

  if (completedTransfers.length > 0) {
    const approvalTimes: number[] = [];
    const shipTimes: number[] = [];
    const receiveTimes: number[] = [];

    for (const transfer of completedTransfers) {
      if (transfer.reviewedAt) {
        approvalTimes.push(
          Math.floor((transfer.reviewedAt.getTime() - transfer.requestedAt.getTime()) / 1000)
        );
      }

      if (transfer.reviewedAt && transfer.shippedAt) {
        shipTimes.push(
          Math.floor((transfer.shippedAt.getTime() - transfer.reviewedAt.getTime()) / 1000)
        );
      }

      if (transfer.shippedAt && transfer.completedAt) {
        receiveTimes.push(
          Math.floor((transfer.completedAt.getTime() - transfer.shippedAt.getTime()) / 1000)
        );
      }
    }

    avgApprovalTime =
      approvalTimes.length > 0
        ? Math.floor(approvalTimes.reduce((sum, t) => sum + t, 0) / approvalTimes.length)
        : 0;

    avgShipTime =
      shipTimes.length > 0
        ? Math.floor(shipTimes.reduce((sum, t) => sum + t, 0) / shipTimes.length)
        : 0;

    avgReceiveTime =
      receiveTimes.length > 0
        ? Math.floor(receiveTimes.reduce((sum, t) => sum + t, 0) / receiveTimes.length)
        : 0;
  }

  return {
    totalTransfers,
    activeTransfers,
    avgApprovalTime, // Seconds
    avgShipTime, // Seconds
    avgReceiveTime, // Seconds
  };
}

/**
 * Get volume chart data (line chart time series)
 * Returns transfer counts by status over time (daily buckets)
 */
export async function getVolumeChartData(params: {
  tenantId: string;
  startDate: Date;
  endDate: Date;
}) {
  const { tenantId, startDate, endDate } = params;

  // Query all transfers in date range
  const transfers = await prismaClientInstance.stockTransfer.findMany({
    where: {
      tenantId,
      requestedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      requestedAt: true,
      reviewedAt: true,
      shippedAt: true,
      completedAt: true,
      status: true,
    },
    orderBy: { requestedAt: 'asc' },
  });

  // Group by date
  const dateMap = new Map<
    string,
    { date: string; created: number; approved: number; shipped: number; completed: number }
  >();

  for (const transfer of transfers) {
    // Created
    const createdDate = transfer.requestedAt.toISOString().split('T')[0]!;
    if (!dateMap.has(createdDate)) {
      dateMap.set(createdDate, { date: createdDate, created: 0, approved: 0, shipped: 0, completed: 0 });
    }
    dateMap.get(createdDate)!.created += 1;

    // Approved
    if (transfer.reviewedAt && transfer.status !== StockTransferStatus.REJECTED) {
      const approvedDate = transfer.reviewedAt.toISOString().split('T')[0]!;
      if (!dateMap.has(approvedDate)) {
        dateMap.set(approvedDate, { date: approvedDate, created: 0, approved: 0, shipped: 0, completed: 0 });
      }
      dateMap.get(approvedDate)!.approved += 1;
    }

    // Shipped
    if (transfer.shippedAt) {
      const shippedDate = transfer.shippedAt.toISOString().split('T')[0]!;
      if (!dateMap.has(shippedDate)) {
        dateMap.set(shippedDate, { date: shippedDate, created: 0, approved: 0, shipped: 0, completed: 0 });
      }
      dateMap.get(shippedDate)!.shipped += 1;
    }

    // Completed
    if (transfer.completedAt) {
      const completedDate = transfer.completedAt.toISOString().split('T')[0]!;
      if (!dateMap.has(completedDate)) {
        dateMap.set(completedDate, { date: completedDate, created: 0, approved: 0, shipped: 0, completed: 0 });
      }
      dateMap.get(completedDate)!.completed += 1;
    }
  }

  // Fill in missing dates with zero values
  const result: Array<{ date: string; created: number; approved: number; shipped: number; completed: number }> = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0]!;

    if (dateMap.has(dateStr)) {
      result.push(dateMap.get(dateStr)!);
    } else {
      result.push({ date: dateStr, created: 0, approved: 0, shipped: 0, completed: 0 });
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return result;
}

/**
 * Get branch dependency data (for network graph or table)
 * Shows transfer volume between branches
 */
export async function getBranchDependencies(params: {
  tenantId: string;
  startDate: Date;
  endDate: Date;
}) {
  const { tenantId, startDate, endDate } = params;

  const result = await prismaClientInstance.stockTransfer.groupBy({
    by: ['sourceBranchId', 'destinationBranchId'],
    where: {
      tenantId,
      requestedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    _count: { id: true },
  });

  // Fetch branch names and calculate total units
  const dependencies = await Promise.all(
    result.map(async (row) => {
      // Get branch names
      const [sourceBranch, destinationBranch] = await Promise.all([
        prismaClientInstance.branch.findUnique({
          where: { id: row.sourceBranchId },
          select: { branchName: true },
        }),
        prismaClientInstance.branch.findUnique({
          where: { id: row.destinationBranchId },
          select: { branchName: true },
        }),
      ]);

      // Calculate total units for this route
      const transfers = await prismaClientInstance.stockTransfer.findMany({
        where: {
          tenantId,
          sourceBranchId: row.sourceBranchId,
          destinationBranchId: row.destinationBranchId,
          requestedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          items: {
            select: { qtyShipped: true },
          },
        },
      });

      const totalUnits = transfers.reduce(
        (sum, t) => sum + t.items.reduce((itemSum, item) => itemSum + item.qtyShipped, 0),
        0
      );

      return {
        sourceBranch: sourceBranch?.branchName || 'Unknown',
        destinationBranch: destinationBranch?.branchName || 'Unknown',
        transferCount: row._count.id,
        totalUnits,
      };
    })
  );

  return dependencies.sort((a, b) => b.transferCount - a.transferCount);
}

/**
 * Get top transfer routes (table view)
 * Similar to branch dependencies but with more details
 */
export async function getTopRoutes(params: {
  tenantId: string;
  startDate: Date;
  endDate: Date;
  limit?: number;
}) {
  const { tenantId, startDate, endDate, limit = 10 } = params;

  const result = await prismaClientInstance.stockTransfer.groupBy({
    by: ['sourceBranchId', 'destinationBranchId'],
    where: {
      tenantId,
      requestedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    _count: { id: true },
  });

  // Fetch details for each route
  const routes = await Promise.all(
    result.map(async (row) => {
      // Get branch names
      const [sourceBranch, destinationBranch] = await Promise.all([
        prismaClientInstance.branch.findUnique({
          where: { id: row.sourceBranchId },
          select: { branchName: true },
        }),
        prismaClientInstance.branch.findUnique({
          where: { id: row.destinationBranchId },
          select: { branchName: true },
        }),
      ]);

      // Get transfers for this route to calculate avg completion time and total units
      const transfers = await prismaClientInstance.stockTransfer.findMany({
        where: {
          tenantId,
          sourceBranchId: row.sourceBranchId,
          destinationBranchId: row.destinationBranchId,
          requestedAt: {
            gte: startDate,
            lte: endDate,
          },
          status: StockTransferStatus.COMPLETED,
          completedAt: { not: null },
        },
        select: {
          requestedAt: true,
          completedAt: true,
          items: {
            select: { qtyShipped: true },
          },
        },
      });

      const completionTimes: number[] = [];
      let totalUnits = 0;

      for (const transfer of transfers) {
        if (transfer.completedAt) {
          completionTimes.push(
            Math.floor((transfer.completedAt.getTime() - transfer.requestedAt.getTime()) / 1000)
          );
        }
        totalUnits += transfer.items.reduce((sum, item) => sum + item.qtyShipped, 0);
      }

      const avgCompletionTime =
        completionTimes.length > 0
          ? Math.floor(completionTimes.reduce((sum, t) => sum + t, 0) / completionTimes.length)
          : null;

      return {
        sourceBranch: sourceBranch?.branchName || 'Unknown',
        destinationBranch: destinationBranch?.branchName || 'Unknown',
        transferCount: row._count.id,
        totalUnits,
        avgCompletionTime, // Seconds
      };
    })
  );

  // Sort by transfer count DESC and limit
  return routes.sort((a, b) => b.transferCount - a.transferCount).slice(0, limit);
}

/**
 * Get status distribution (pie chart data)
 */
export async function getStatusDistribution(params: {
  tenantId: string;
  startDate: Date;
  endDate: Date;
}) {
  const { tenantId, startDate, endDate } = params;

  const result = await prismaClientInstance.stockTransfer.groupBy({
    by: ['status'],
    where: {
      tenantId,
      requestedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    _count: { id: true },
  });

  // Initialize all statuses with 0
  const distribution: Record<string, number> = {
    [StockTransferStatus.REQUESTED]: 0,
    [StockTransferStatus.APPROVED]: 0,
    [StockTransferStatus.IN_TRANSIT]: 0,
    [StockTransferStatus.PARTIALLY_RECEIVED]: 0,
    [StockTransferStatus.COMPLETED]: 0,
    [StockTransferStatus.REJECTED]: 0,
    [StockTransferStatus.CANCELLED]: 0,
  };

  // Fill in actual counts
  for (const row of result) {
    distribution[row.status] = row._count.id;
  }

  return distribution;
}

/**
 * Get bottleneck analysis (average time in each stage)
 */
export async function getBottlenecks(params: {
  tenantId: string;
  startDate: Date;
  endDate: Date;
}) {
  const { tenantId, startDate, endDate } = params;

  const completedTransfers = await prismaClientInstance.stockTransfer.findMany({
    where: {
      tenantId,
      requestedAt: {
        gte: startDate,
        lte: endDate,
      },
      status: StockTransferStatus.COMPLETED,
      reviewedAt: { not: null },
      shippedAt: { not: null },
      completedAt: { not: null },
    },
    select: {
      requestedAt: true,
      reviewedAt: true,
      shippedAt: true,
      completedAt: true,
    },
  });

  const approvalTimes: number[] = [];
  const shippingTimes: number[] = [];
  const receiptTimes: number[] = [];

  for (const transfer of completedTransfers) {
    if (transfer.reviewedAt) {
      approvalTimes.push(
        Math.floor((transfer.reviewedAt.getTime() - transfer.requestedAt.getTime()) / 1000)
      );
    }

    if (transfer.reviewedAt && transfer.shippedAt) {
      shippingTimes.push(
        Math.floor((transfer.shippedAt.getTime() - transfer.reviewedAt.getTime()) / 1000)
      );
    }

    if (transfer.shippedAt && transfer.completedAt) {
      receiptTimes.push(
        Math.floor((transfer.completedAt.getTime() - transfer.shippedAt.getTime()) / 1000)
      );
    }
  }

  const avgApprovalTime =
    approvalTimes.length > 0
      ? Math.floor(approvalTimes.reduce((sum, t) => sum + t, 0) / approvalTimes.length)
      : 0;

  const avgShippingTime =
    shippingTimes.length > 0
      ? Math.floor(shippingTimes.reduce((sum, t) => sum + t, 0) / shippingTimes.length)
      : 0;

  const avgReceiptTime =
    receiptTimes.length > 0
      ? Math.floor(receiptTimes.reduce((sum, t) => sum + t, 0) / receiptTimes.length)
      : 0;

  return {
    approvalStage: avgApprovalTime, // Seconds: REQUESTED → APPROVED
    shippingStage: avgShippingTime, // Seconds: APPROVED → IN_TRANSIT
    receiptStage: avgReceiptTime, // Seconds: IN_TRANSIT → COMPLETED
  };
}

/**
 * Get product transfer frequency (which products are transferred most often)
 */
export async function getProductFrequency(params: {
  tenantId: string;
  startDate: Date;
  endDate: Date;
  limit?: number;
}) {
  const { tenantId, startDate, endDate, limit = 10 } = params;

  // Get all transfer items in date range
  const transferItems = await prismaClientInstance.stockTransferItem.findMany({
    where: {
      transfer: {
        tenantId,
        requestedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    },
    include: {
      product: {
        select: {
          id: true,
          productName: true,
        },
      },
      transfer: {
        select: {
          sourceBranchId: true,
          destinationBranchId: true,
        },
      },
    },
  });

  // Group by product
  const productMap = new Map<
    string,
    {
      productId: string;
      productName: string;
      transferCount: number;
      totalQty: number;
      routes: Map<string, number>; // route -> count
    }
  >();

  // Create a map to cache branch names (avoid N+1 queries)
  const branchCache = new Map<string, string>();

  async function getBranchName(branchId: string): Promise<string> {
    if (branchCache.has(branchId)) {
      return branchCache.get(branchId)!;
    }

    const branch = await prismaClientInstance.branch.findUnique({
      where: { id: branchId },
      select: { branchName: true },
    });

    const name = branch?.branchName || 'Unknown';
    branchCache.set(branchId, name);
    return name;
  }

  for (const item of transferItems) {
    const productId = item.productId;
    const productName = item.product.productName;
    const routeKey = `${item.transfer.sourceBranchId}→${item.transfer.destinationBranchId}`;

    if (!productMap.has(productId)) {
      productMap.set(productId, {
        productId,
        productName,
        transferCount: 0,
        totalQty: 0,
        routes: new Map(),
      });
    }

    const entry = productMap.get(productId)!;
    entry.transferCount += 1;
    entry.totalQty += item.qtyShipped;

    // Track routes (use key without spaces for grouping)
    entry.routes.set(routeKey, (entry.routes.get(routeKey) ?? 0) + 1);
  }

  // Convert to array with top routes (with human-readable branch names)
  const products = await Promise.all(
    Array.from(productMap.values()).map(async (entry) => {
      // Get top 3 routes for this product
      const topRoutesRaw = Array.from(entry.routes.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([routeKey]) => routeKey);

      // Convert route keys to human-readable format
      const topRoutes = await Promise.all(
        topRoutesRaw.map(async (routeKey) => {
          const [sourceBranchId, destBranchId] = routeKey.split('→');
          const sourceName = await getBranchName(sourceBranchId!);
          const destName = await getBranchName(destBranchId!);
          return `${sourceName} → ${destName}`;
        })
      );

      return {
        productName: entry.productName,
        transferCount: entry.transferCount,
        totalQty: entry.totalQty,
        topRoutes,
      };
    })
  );

  // Sort by transfer count DESC and limit
  return products.sort((a, b) => b.transferCount - a.transferCount).slice(0, limit);
}
