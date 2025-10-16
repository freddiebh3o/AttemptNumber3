// api-server/src/services/chat/tools/analyticsTools.ts
import { tool } from 'ai';
import { z } from 'zod';
import { prismaClientInstance } from '../../../db/prismaClient.js';

/**
 * Analytics tools for AI chatbot
 *
 * SECURITY: All tools enforce:
 * - Tenant isolation (all queries filter by tenantId)
 * - Branch membership filtering (users can only see analytics for their branches)
 */
export function analyticsTools({ userId, tenantId }: { userId: string; tenantId: string }) {
  return {
    getTransferMetrics: tool({
      description: 'Get transfer statistics (volume, cycle time, completion rates). Use when user asks "how many transfers did we complete?" or "show me transfer metrics". Defaults to last 30 days.',
      inputSchema: z.object({
        branchId: z.string().optional().describe('Filter to specific branch'),
        days: z.number().optional().default(30).describe('Number of days to analyze (default: 30)'),
      }),
      execute: async ({ branchId, days }) => {
        try {
          // Check user has access to branch if specified
          if (branchId) {
            const membership = await prismaClientInstance.userBranchMembership.findFirst({
              where: { userId, tenantId, branchId },
            });

            if (!membership) {
              return {
                error: 'Access denied',
                message: 'You are not a member of the specified branch',
              };
            }
          }

          // Build filter based on user's branches
          const userBranches = await prismaClientInstance.userBranchMembership.findMany({
            where: { userId, tenantId },
            select: { branchId: true },
          });

          if (userBranches.length === 0) {
            return {
              error: 'No branch access',
              message: 'You are not a member of any branches',
            };
          }

          const branchIds = branchId ? [branchId] : userBranches.map(m => m.branchId);

          // Date range
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - (days || 30));

          // Get transfers
          const transfers = await prismaClientInstance.stockTransfer.findMany({
            where: {
              tenantId,
              OR: [
                { sourceBranchId: { in: branchIds } },
                { destinationBranchId: { in: branchIds } },
              ],
              requestedAt: { gte: startDate },
            },
            select: {
              id: true,
              status: true,
              requestedAt: true,
              reviewedAt: true,
              completedAt: true,
              items: {
                select: {
                  qtyRequested: true,
                  qtyReceived: true,
                },
              },
            },
          });

          // Calculate metrics
          const totalTransfers = transfers.length;
          const completedTransfers = transfers.filter(t => t.status === 'COMPLETED').length;
          const pendingTransfers = transfers.filter(t => t.status === 'REQUESTED').length;
          const inTransitTransfers = transfers.filter(t => t.status === 'IN_TRANSIT').length;

          // Calculate average cycle time (requested to completed)
          const completedWithDates = transfers.filter(t =>
            t.status === 'COMPLETED' && t.completedAt
          );

          let avgCycleTimeDays = 0;
          if (completedWithDates.length > 0) {
            const totalDays = completedWithDates.reduce((sum, t) => {
              const days = Math.floor(
                (t.completedAt!.getTime() - t.requestedAt.getTime()) / (1000 * 60 * 60 * 24)
              );
              return sum + days;
            }, 0);
            avgCycleTimeDays = totalDays / completedWithDates.length;
          }

          // Calculate fill rate (received vs requested)
          const totalRequested = transfers.reduce((sum, t) =>
            sum + t.items.reduce((isum, i) => isum + i.qtyRequested, 0), 0
          );

          const totalReceived = transfers.reduce((sum, t) =>
            sum + t.items.reduce((isum, i) => isum + i.qtyReceived, 0), 0
          );

          const fillRate = totalRequested > 0 ? (totalReceived / totalRequested) * 100 : 0;

          return {
            period: `Last ${days} days`,
            metrics: {
              totalTransfers,
              completedTransfers,
              pendingTransfers,
              inTransitTransfers,
              completionRate: totalTransfers > 0
                ? `${((completedTransfers / totalTransfers) * 100).toFixed(1)}%`
                : '0%',
              avgCycleTime: `${avgCycleTimeDays.toFixed(1)} days`,
              fillRate: `${fillRate.toFixed(1)}%`,
            },
            breakdown: {
              COMPLETED: completedTransfers,
              REQUESTED: pendingTransfers,
              IN_TRANSIT: inTransitTransfers,
              APPROVED: transfers.filter(t => t.status === 'APPROVED').length,
              REJECTED: transfers.filter(t => t.status === 'REJECTED').length,
              CANCELLED: transfers.filter(t => t.status === 'CANCELLED').length,
            },
          };
        } catch (error: any) {
          return {
            error: 'Unable to get transfer metrics',
            message: error.message || 'An error occurred',
          };
        }
      },
    }),

    getBranchPerformance: tool({
      description: 'Get branch performance metrics (inbound/outbound volume, fill rates). Use when user asks "how is branch X performing?" or "show me branch activity".',
      inputSchema: z.object({
        branchId: z.string().describe('Branch ID to analyze'),
        period: z.enum(['week', 'month', 'quarter']).optional().default('month')
          .describe('Time period (default: month)'),
      }),
      execute: async ({ branchId, period }) => {
        try {
          // Check user has access to this branch
          const membership = await prismaClientInstance.userBranchMembership.findFirst({
            where: { userId, tenantId, branchId },
          });

          if (!membership) {
            return {
              error: 'Access denied',
              message: 'You are not a member of this branch',
            };
          }

          // Get branch info
          const branch = await prismaClientInstance.branch.findFirst({
            where: { id: branchId, tenantId },
            select: { branchName: true },
          });

          if (!branch) {
            return {
              error: 'Branch not found',
              message: 'Branch not found',
            };
          }

          // Calculate date range
          const daysMap = { week: 7, month: 30, quarter: 90 };
          const days = daysMap[period || 'month'];
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - days);

          // Get inbound transfers (coming TO this branch)
          const inbound = await prismaClientInstance.stockTransfer.findMany({
            where: {
              tenantId,
              destinationBranchId: branchId,
              requestedAt: { gte: startDate },
            },
            select: {
              status: true,
              items: {
                select: {
                  qtyRequested: true,
                  qtyReceived: true,
                },
              },
            },
          });

          // Get outbound transfers (going FROM this branch)
          const outbound = await prismaClientInstance.stockTransfer.findMany({
            where: {
              tenantId,
              sourceBranchId: branchId,
              requestedAt: { gte: startDate },
            },
            select: {
              status: true,
              items: {
                select: {
                  qtyRequested: true,
                  qtyShipped: true,
                },
              },
            },
          });

          // Calculate metrics
          const inboundCount = inbound.length;
          const outboundCount = outbound.length;

          const inboundQtyRequested = inbound.reduce((sum, t) =>
            sum + t.items.reduce((isum, i) => isum + i.qtyRequested, 0), 0
          );

          const inboundQtyReceived = inbound.reduce((sum, t) =>
            sum + t.items.reduce((isum, i) => isum + i.qtyReceived, 0), 0
          );

          const outboundQtyRequested = outbound.reduce((sum, t) =>
            sum + t.items.reduce((isum, i) => isum + i.qtyRequested, 0), 0
          );

          const outboundQtyShipped = outbound.reduce((sum, t) =>
            sum + t.items.reduce((isum, i) => isum + i.qtyShipped, 0), 0
          );

          const inboundFillRate = inboundQtyRequested > 0
            ? (inboundQtyReceived / inboundQtyRequested) * 100
            : 0;

          const outboundFillRate = outboundQtyRequested > 0
            ? (outboundQtyShipped / outboundQtyRequested) * 100
            : 0;

          return {
            branch: branch.branchName,
            period: period || 'month',
            inbound: {
              transferCount: inboundCount,
              qtyRequested: inboundQtyRequested,
              qtyReceived: inboundQtyReceived,
              fillRate: `${inboundFillRate.toFixed(1)}%`,
              completedCount: inbound.filter(t => t.status === 'COMPLETED').length,
            },
            outbound: {
              transferCount: outboundCount,
              qtyRequested: outboundQtyRequested,
              qtyShipped: outboundQtyShipped,
              fillRate: `${outboundFillRate.toFixed(1)}%`,
              completedCount: outbound.filter(t => t.status === 'COMPLETED').length,
            },
            netFlow: inboundQtyReceived - outboundQtyShipped,
          };
        } catch (error: any) {
          return {
            error: 'Unable to get branch performance',
            message: error.message || 'An error occurred',
          };
        }
      },
    }),

    getStockValueReport: tool({
      description: 'Get total stock value by branch (using FIFO cost). Use when user asks "what is our inventory worth?" or "show me stock value".',
      inputSchema: z.object({
        branchId: z.string().optional().describe('Filter to specific branch (optional)'),
      }),
      execute: async ({ branchId }) => {
        try {
          // Get user's accessible branches
          const userBranches = await prismaClientInstance.userBranchMembership.findMany({
            where: { userId, tenantId },
            include: { branch: { select: { branchName: true } } },
          });

          if (userBranches.length === 0) {
            return {
              error: 'No branch access',
              message: 'You are not a member of any branches',
            };
          }

          // Filter to specific branch if requested
          let branchesToAnalyze = userBranches;
          if (branchId) {
            const hasAccess = userBranches.some(b => b.branchId === branchId);
            if (!hasAccess) {
              return {
                error: 'Access denied',
                message: 'You are not a member of the specified branch',
              };
            }
            branchesToAnalyze = userBranches.filter(b => b.branchId === branchId);
          }

          // For each branch, calculate stock value using FIFO lots
          const branchValues = await Promise.all(
            branchesToAnalyze.map(async (membership) => {
              // Get all lots with remaining qty for this branch
              const lots = await prismaClientInstance.stockLot.findMany({
                where: {
                  tenantId,
                  branchId: membership.branchId,
                  qtyRemaining: { gt: 0 },
                },
                select: {
                  qtyRemaining: true,
                  unitCostPence: true,
                },
              });

              // Calculate total value
              const totalValuePence = lots.reduce((sum, lot) => {
                const costPence = lot.unitCostPence || 0;
                return sum + (lot.qtyRemaining * costPence);
              }, 0);

              // Also get product count
              const stockCount = await prismaClientInstance.productStock.count({
                where: {
                  tenantId,
                  branchId: membership.branchId,
                  qtyOnHand: { gt: 0 },
                },
              });

              return {
                branchName: membership.branch.branchName,
                branchId: membership.branchId,
                totalValue: `£${(totalValuePence / 100).toFixed(2)}`,
                totalValuePence,
                productCount: stockCount,
              };
            })
          );

          // Calculate grand total
          const grandTotalPence = branchValues.reduce((sum, b) => sum + b.totalValuePence, 0);

          return {
            branches: branchValues.map(b => ({
              branchName: b.branchName,
              totalValue: b.totalValue,
              productCount: b.productCount,
            })),
            grandTotal: `£${(grandTotalPence / 100).toFixed(2)}`,
            branchCount: branchValues.length,
          };
        } catch (error: any) {
          return {
            error: 'Unable to get stock value report',
            message: error.message || 'An error occurred',
          };
        }
      },
    }),
  };
}
