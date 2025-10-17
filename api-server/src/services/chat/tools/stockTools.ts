// api-server/src/services/chat/tools/stockTools.ts
import { tool } from 'ai';
import { z } from 'zod';
import * as stockService from '../../stockService.js';
import { prismaClientInstance } from '../../../db/prismaClient.js';
import { StockMovementKind } from '@prisma/client';

/**
 * Stock management tools for AI chatbot
 *
 * SECURITY: All tools enforce:
 * - Tenant isolation (all queries filter by tenantId)
 * - Branch membership (user must be member of branch to view stock)
 * - Service layer security (no direct DB bypasses)
 */
export function stockTools({ userId, tenantId }: { userId: string; tenantId: string }) {
  return {
    getStockAtBranch: tool({
      description: 'Get current stock levels for all products at a specific branch. Use when user asks "what inventory do we have at X branch?" or "show me all stock at warehouse". IMPORTANT: Choose the limit intelligently - use 10-20 for quick overviews, 50-100 for comprehensive inventory lists.',
      inputSchema: z.object({
        branchId: z.string().optional().describe('Branch ID (if known)'),
        branchName: z.string().optional().describe('Branch name to search for'),
        limit: z.number().optional().default(20).describe('Number of products to return. Choose intelligently: 10-20 for quick lists, 50-100 for comprehensive inventory. Max 200.'),
      }),
      execute: async ({ branchId, branchName, limit }) => {
        try {
          // Step 1: Resolve branch
          let resolvedBranchId = branchId;
          let resolvedBranchName = '';

          if (!resolvedBranchId && branchName) {
            const branch = await prismaClientInstance.branch.findFirst({
              where: {
                tenantId,
                branchName: { contains: branchName, mode: 'insensitive' },
                isActive: true,
              },
              select: { id: true, branchName: true },
            });

            if (branch) {
              resolvedBranchId = branch.id;
              resolvedBranchName = branch.branchName;
            }
          } else if (resolvedBranchId) {
            const branch = await prismaClientInstance.branch.findFirst({
              where: { id: resolvedBranchId, tenantId, isActive: true },
              select: { branchName: true },
            });
            resolvedBranchName = branch?.branchName || 'Unknown';
          }

          if (!resolvedBranchId) {
            // Try user's first branch membership
            const membership = await prismaClientInstance.userBranchMembership.findFirst({
              where: { userId, tenantId },
              include: { branch: { select: { id: true, branchName: true } } },
            });

            if (membership) {
              resolvedBranchId = membership.branchId;
              resolvedBranchName = membership.branch.branchName;
            } else {
              return {
                error: 'No branch specified',
                message: 'You must specify a branch or be a member of at least one branch',
              };
            }
          }

          // Step 2: Check user has access to this branch
          const membership = await prismaClientInstance.userBranchMembership.findFirst({
            where: { userId, tenantId, branchId: resolvedBranchId },
          });

          if (!membership) {
            return {
              error: 'Access denied',
              message: `You are not a member of ${resolvedBranchName}. You can only view stock for branches you belong to.`,
            };
          }

          // Step 3: Get stock levels
          const stock = await prismaClientInstance.productStock.findMany({
            where: {
              tenantId,
              branchId: resolvedBranchId,
            },
            include: {
              product: {
                select: {
                  productName: true,
                  productSku: true,
                  productPricePence: true,
                },
              },
            },
            orderBy: { qtyOnHand: 'desc' },
            take: Math.min(limit || 20, 200),
          });

          return {
            branch: resolvedBranchName,
            branchId: resolvedBranchId,
            products: stock.map(s => ({
              productName: s.product.productName,
              sku: s.product.productSku,
              qtyOnHand: s.qtyOnHand,
              qtyAllocated: s.qtyAllocated,
              qtyAvailable: s.qtyOnHand - s.qtyAllocated,
              value: `£${((s.qtyOnHand * s.product.productPricePence) / 100).toFixed(2)}`,
            })),
            count: stock.length,
          };
        } catch (error: any) {
          return {
            error: 'Unable to get stock',
            message: error.message || 'An error occurred',
          };
        }
      },
    }),

    viewStockMovements: tool({
      description: 'View recent stock movements (receipts, adjustments, consumption) from the ledger. Use when user asks about stock history, recent changes, or "what happened to our inventory?" IMPORTANT: Choose limit intelligently - use 10-20 for recent activity, 50-100 for detailed history.',
      inputSchema: z.object({
        productId: z.string().optional().describe('Filter to specific product ID'),
        sku: z.string().optional().describe('Filter to specific product SKU'),
        branchId: z.string().optional().describe('Filter to specific branch'),
        movementType: z.enum(['RECEIPT', 'ADJUSTMENT', 'CONSUMPTION', 'REVERSAL']).optional()
          .describe('Type of movement to filter'),
        limit: z.number().optional().default(20).describe('Number of movements to return. Choose intelligently: 10-20 for recent activity, 50-100 for detailed history. Max 100.'),
      }),
      execute: async ({ productId, sku, branchId, movementType, limit }) => {
        try {
          // Step 1: Resolve product if SKU provided
          let resolvedProductId = productId;
          let productName = '';

          if (!resolvedProductId && sku) {
            const product = await prismaClientInstance.product.findFirst({
              where: { tenantId, productSku: sku },
              select: { id: true, productName: true },
            });

            if (product) {
              resolvedProductId = product.id;
              productName = product.productName;
            }
          } else if (resolvedProductId) {
            const product = await prismaClientInstance.product.findFirst({
              where: { id: resolvedProductId, tenantId },
              select: { productName: true },
            });
            productName = product?.productName || 'Unknown';
          }

          if (!resolvedProductId) {
            return {
              error: 'Product not specified',
              message: 'You must provide a product ID or SKU to view stock movements',
            };
          }

          // Step 2: Use existing service function
          const result = await stockService.listStockLedgerService({
            currentTenantId: tenantId,
            productId: resolvedProductId,
            ...(branchId ? { branchIdOptional: branchId } : {}),
            ...(movementType ? { kindsOptional: [movementType] } : {}),
            limitOptional: Math.min(limit || 20, 100),
            sortDirOptional: 'desc', // Most recent first
          });

          // Step 3: Enrich with branch names
          const branchIds = [...new Set(result.items.map(i => i.branchId))];
          const branches = await prismaClientInstance.branch.findMany({
            where: { id: { in: branchIds }, tenantId },
            select: { id: true, branchName: true },
          });

          const branchMap = new Map(branches.map(b => [b.id, b.branchName]));

          return {
            product: productName,
            movements: result.items.map(m => ({
              type: m.kind,
              qtyDelta: m.qtyDelta,
              branch: branchMap.get(m.branchId) || 'Unknown',
              reason: m.reason || 'N/A',
              occurredAt: m.occurredAt,
              createdAt: m.createdAt,
            })),
            count: result.items.length,
            hasMore: result.pageInfo.hasNextPage,
          };
        } catch (error: any) {
          return {
            error: 'Unable to view stock movements',
            message: error.message || 'An error occurred',
          };
        }
      },
    }),

    checkLowStock: tool({
      description: 'Find products with low stock across branches. Use when user asks "what products are low?" or "do we need to reorder anything?" IMPORTANT: Choose limit intelligently - use 10-20 for quick alerts, 50+ for comprehensive low stock reports.',
      inputSchema: z.object({
        threshold: z.number().optional().default(10).describe('Stock level threshold (default: 10)'),
        branchId: z.string().optional().describe('Filter to specific branch'),
        limit: z.number().optional().default(20).describe('Number of results to return. Choose intelligently: 10-20 for quick alerts, 50-100 for comprehensive reports. Max 100.'),
      }),
      execute: async ({ threshold, branchId, limit }) => {
        try {
          // Build where clause
          const where: any = {
            tenantId,
            qtyOnHand: { lte: threshold || 10 },
          };

          if (branchId) {
            // Check user has access to this branch
            const membership = await prismaClientInstance.userBranchMembership.findFirst({
              where: { userId, tenantId, branchId },
            });

            if (!membership) {
              return {
                error: 'Access denied',
                message: 'You are not a member of the specified branch',
              };
            }

            where.branchId = branchId;
          } else {
            // Filter to user's branches only
            const memberships = await prismaClientInstance.userBranchMembership.findMany({
              where: { userId, tenantId },
              select: { branchId: true },
            });

            if (memberships.length === 0) {
              return {
                error: 'No branch access',
                message: 'You are not a member of any branches',
              };
            }

            where.branchId = { in: memberships.map(m => m.branchId) };
          }

          // Query low stock
          const lowStock = await prismaClientInstance.productStock.findMany({
            where,
            include: {
              product: {
                select: {
                  productName: true,
                  productSku: true,
                },
              },
              branch: {
                select: {
                  branchName: true,
                },
              },
            },
            orderBy: { qtyOnHand: 'asc' }, // Lowest first
            take: Math.min(limit || 20, 100),
          });

          if (lowStock.length === 0) {
            return {
              products: [],
              count: 0,
              message: `No products found with stock below ${threshold}`,
            };
          }

          return {
            threshold,
            products: lowStock.map(s => ({
              productName: s.product.productName,
              sku: s.product.productSku,
              branch: s.branch.branchName,
              qtyOnHand: s.qtyOnHand,
              qtyAllocated: s.qtyAllocated,
              qtyAvailable: s.qtyOnHand - s.qtyAllocated,
            })),
            count: lowStock.length,
          };
        } catch (error: any) {
          return {
            error: 'Unable to check low stock',
            message: error.message || 'An error occurred',
          };
        }
      },
    }),

    getFIFOLotInfo: tool({
      description: 'Get FIFO lot details for a product at a branch (cost, received date, quantities). Use when user asks about product cost basis or "where did this stock come from?"',
      inputSchema: z.object({
        productId: z.string().optional().describe('Product ID'),
        sku: z.string().optional().describe('Product SKU'),
        branchId: z.string().optional().describe('Branch ID'),
        branchName: z.string().optional().describe('Branch name'),
      }),
      execute: async ({ productId, sku, branchId, branchName }) => {
        try {
          // Step 1: Resolve product
          let resolvedProductId = productId;
          let productNameResolved = '';

          if (!resolvedProductId && sku) {
            const product = await prismaClientInstance.product.findFirst({
              where: { tenantId, productSku: sku },
              select: { id: true, productName: true },
            });

            if (product) {
              resolvedProductId = product.id;
              productNameResolved = product.productName;
            }
          } else if (resolvedProductId) {
            const product = await prismaClientInstance.product.findFirst({
              where: { id: resolvedProductId, tenantId },
              select: { productName: true },
            });
            productNameResolved = product?.productName || 'Unknown';
          }

          if (!resolvedProductId) {
            return {
              error: 'Product not specified',
              message: 'Provide a product ID or SKU',
            };
          }

          // Step 2: Resolve branch
          let resolvedBranchId = branchId;
          let resolvedBranchName = '';

          if (!resolvedBranchId && branchName) {
            const branch = await prismaClientInstance.branch.findFirst({
              where: {
                tenantId,
                branchName: { contains: branchName, mode: 'insensitive' },
                isActive: true,
              },
              select: { id: true, branchName: true },
            });

            if (branch) {
              resolvedBranchId = branch.id;
              resolvedBranchName = branch.branchName;
            }
          } else if (resolvedBranchId) {
            const branch = await prismaClientInstance.branch.findFirst({
              where: { id: resolvedBranchId, tenantId },
              select: { branchName: true },
            });
            resolvedBranchName = branch?.branchName || 'Unknown';
          }

          if (!resolvedBranchId) {
            return {
              error: 'Branch not specified',
              message: 'Provide a branch ID or branch name',
            };
          }

          // Step 3: Check user has access
          const membership = await prismaClientInstance.userBranchMembership.findFirst({
            where: { userId, tenantId, branchId: resolvedBranchId },
          });

          if (!membership) {
            return {
              error: 'Access denied',
              message: `You are not a member of ${resolvedBranchName}`,
            };
          }

          // Step 4: Get lot info using service function
          const result = await stockService.getStockLevelsForProductService({
            currentTenantId: tenantId,
            branchId: resolvedBranchId,
            productId: resolvedProductId,
          });

          if (result.lots.length === 0) {
            return {
              product: productNameResolved,
              branch: resolvedBranchName,
              lots: [],
              message: 'No active lots found (stock may be zero)',
            };
          }

          return {
            product: productNameResolved,
            branch: resolvedBranchName,
            totalQtyOnHand: result.productStock.qtyOnHand,
            lots: result.lots.map(lot => ({
              qtyRemaining: lot.qtyRemaining,
              unitCostPence: lot.unitCostPence,
              unitCostFormatted: lot.unitCostPence
                ? `£${(lot.unitCostPence / 100).toFixed(2)}`
                : 'N/A',
              receivedAt: lot.receivedAt,
              sourceRef: lot.sourceRef || 'N/A',
            })),
            lotsCount: result.lots.length,
          };
        } catch (error: any) {
          return {
            error: 'Unable to get FIFO lot info',
            message: error.message || 'An error occurred',
          };
        }
      },
    }),
  };
}
