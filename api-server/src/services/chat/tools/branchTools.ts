// api-server/src/services/chat/tools/branchTools.ts
import { tool } from 'ai';
import { z } from 'zod';
import * as branchService from '../../branches/branchService.js';
import { prismaClientInstance } from '../../../db/prismaClient.js';

/**
 * Branch tools for AI chatbot
 *
 * SECURITY: All tools enforce:
 * - Tenant isolation (all queries filter by tenantId)
 * - Branches are tenant-scoped (no permission needed to list branches)
 */
export function branchTools({ userId, tenantId }: { userId: string; tenantId: string }) {
  return {
    listBranches: tool({
      description: 'List all branches in the organization. Use when user asks "what branches do we have?" or "show me our locations".',
      inputSchema: z.object({
        includeInactive: z.boolean().optional().default(false)
          .describe('Include inactive/deactivated branches (default: false)'),
        limit: z.number().optional().default(10).describe('Number of branches to return (max 20)'),
      }),
      execute: async ({ includeInactive, limit }) => {
        try {
          const result = await branchService.listBranchesForCurrentTenantService({
            currentTenantId: tenantId,
            ...(includeInactive ? {} : { isActiveOptional: true }),
            limitOptional: Math.min(limit || 10, 20),
            sortByOptional: 'branchName',
            sortDirOptional: 'asc',
            includeTotalOptional: true, // REQUIRED to get totalCount in pageInfo
          });

          if (result.items.length === 0) {
            return {
              branches: [],
              count: 0,
              message: 'No branches found',
            };
          }

          // Enrich with member counts
          const branchIds = result.items.map(b => b.id);
          const memberCounts = await prismaClientInstance.userBranchMembership.groupBy({
            by: ['branchId'],
            where: {
              tenantId,
              branchId: { in: branchIds },
            },
            _count: { branchId: true },
          });

          const memberCountMap = new Map(
            memberCounts.map(m => [m.branchId, m._count.branchId])
          );

          return {
            branches: result.items.map(b => ({
              id: b.id,
              name: b.branchName,
              slug: b.branchSlug,
              isActive: b.isActive,
              memberCount: memberCountMap.get(b.id) || 0,
              createdAt: b.createdAt,
            })),
            showing: result.items.length,
            totalCount: result.pageInfo.totalCount,
            hasMore: result.pageInfo.hasNextPage,
          };
        } catch (error: any) {
          return {
            error: 'Unable to list branches',
            message: error.message || 'An error occurred',
          };
        }
      },
    }),

    getBranchDetails: tool({
      description: 'Get detailed information about a branch including stock value, users, and activity. Use when user asks "tell me about X branch" or "what\'s the status of warehouse Y?"',
      inputSchema: z.object({
        branchId: z.string().optional().describe('Branch ID (if known)'),
        branchName: z.string().optional().describe('Branch name to search for'),
      }),
      execute: async ({ branchId, branchName }) => {
        try {
          // Step 1: Resolve branch
          let resolvedBranchId = branchId;
          let branch;

          if (!resolvedBranchId && branchName) {
            const branches = await branchService.listBranchesForCurrentTenantService({
              currentTenantId: tenantId,
              qOptional: branchName,
              limitOptional: 1,
            });

            if (branches.items.length > 0) {
              resolvedBranchId = branches.items[0]!.id;
            }
          }

          if (!resolvedBranchId) {
            return {
              error: 'Branch not found',
              message: 'Provide a valid branch ID or branch name',
            };
          }

          // Step 2: Get branch details
          branch = await branchService.getBranchForCurrentTenantService({
            currentTenantId: tenantId,
            branchId: resolvedBranchId,
          });

          // Step 3: Gather stats
          const [members, stockItems, recentTransfers] = await Promise.all([
            // Member count
            prismaClientInstance.userBranchMembership.count({
              where: { tenantId, branchId: resolvedBranchId },
            }),

            // Stock items count and total value
            prismaClientInstance.productStock.findMany({
              where: { tenantId, branchId: resolvedBranchId },
              include: {
                product: {
                  select: { productPricePence: true },
                },
              },
            }),

            // Recent transfers (last 30 days)
            prismaClientInstance.stockTransfer.count({
              where: {
                tenantId,
                OR: [
                  { sourceBranchId: resolvedBranchId },
                  { destinationBranchId: resolvedBranchId },
                ],
                requestedAt: {
                  gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
                },
              },
            }),
          ]);

          // Calculate total stock value
          const totalStockValue = stockItems.reduce((sum, item) => {
            return sum + (item.qtyOnHand * item.product.productPricePence);
          }, 0);

          const totalProductsWithStock = stockItems.filter(s => s.qtyOnHand > 0).length;

          return {
            id: branch.id,
            name: branch.branchName,
            slug: branch.branchSlug,
            isActive: branch.isActive,
            createdAt: branch.createdAt,
            stats: {
              memberCount: members,
              productCount: stockItems.length,
              productsWithStock: totalProductsWithStock,
              totalStockValue: `£${(totalStockValue / 100).toFixed(2)}`,
              recentTransfers: recentTransfers,
            },
          };
        } catch (error: any) {
          return {
            error: 'Unable to get branch details',
            message: error.message || 'Branch not found or access denied',
          };
        }
      },
    }),
  };
}
