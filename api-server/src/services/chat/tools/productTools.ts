// api-server/src/services/chat/tools/productTools.ts
import { tool } from 'ai';
import { z } from 'zod';
import * as productService from '../../products/productService.js';
import { prismaClientInstance } from '../../../db/prismaClient.js';

/**
 * Product tools for AI chatbot
 *
 * SECURITY: All tools use existing service functions which enforce:
 * - Tenant isolation (all queries filter by tenantId)
 * - No direct database queries bypass service layer
 *
 * Products are tenant-scoped, so no branch membership filtering needed
 */
export function productTools({ userId, tenantId }: { userId: string; tenantId: string }) {
  return {
    countAllProducts: tool({
      description: 'Get the total count of ALL products in the system. Use when user asks "how many products do we have?" or "how many total products?" without specifying a search query. Returns just the count, not the product list.',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const result = await productService.listProductsForCurrentTenantService({
            currentTenantId: tenantId,
            limitOptional: 1, // We only need totalCount, not the items
            includeTotalOptional: true, // REQUIRED to get totalCount in pageInfo
          });

          return {
            totalCount: result.pageInfo.totalCount,
            message: `You have ${result.pageInfo.totalCount} total product${result.pageInfo.totalCount === 1 ? '' : 's'}`,
          };
        } catch (error: any) {
          return {
            error: 'Unable to count products',
            message: error.message || 'An error occurred',
          };
        }
      },
    }),

    searchProducts: tool({
      description: 'Search for products by name or SKU. Use when user asks to find products, check product details, or look up items by SKU. Returns basic product info with totalCount showing the complete number of matching products (not just the limited results shown). IMPORTANT: Choose the limit intelligently based on the user\'s question - use 3-5 for "show me some products", 10-20 for "list products", 50+ for "show me all products" or analysis requests. Always inform the user if there are more results available (hasMore=true).',
      inputSchema: z.object({
        query: z.string().optional().describe('Product name or SKU to search (partial match supported). Leave empty to list all products.'),
        limit: z.number().optional().default(10).describe('Number of results to return. Choose intelligently: 3-5 for quick lists, 10-20 for standard searches, 50-100 for comprehensive requests. Max 100.'),
      }),
      execute: async ({ query, limit }) => {
        try {
          // Use existing service function for search
          const result = await productService.listProductsForCurrentTenantService({
            currentTenantId: tenantId,
            ...(query ? { qOptional: query } : {}),
            limitOptional: Math.min(limit || 10, 100),
            includeTotalOptional: true, // REQUIRED to get totalCount in pageInfo
          });

          if (result.items.length === 0) {
            return {
              products: [],
              count: 0,
              message: `No products found matching "${query}"`,
            };
          }

          // Return simplified data for AI
          return {
            products: result.items.map(p => ({
              id: p.id,
              name: p.productName,
              sku: p.productSku,
              price: `£${(p.productPricePence / 100).toFixed(2)}`,
              barcode: p.barcode || 'None',
            })),
            showing: result.items.length,
            count: result.pageInfo.totalCount, // Alias for backward compatibility
            totalCount: result.pageInfo.totalCount,
            hasMore: result.pageInfo.hasNextPage,
          };
        } catch (error: any) {
          return {
            error: 'Unable to search products',
            message: error.message || 'An error occurred while searching',
          };
        }
      },
    }),

    getProductDetails: tool({
      description: 'Get detailed information about a specific product by ID or SKU. Use when user asks for full details about a specific product.',
      inputSchema: z.object({
        productId: z.string().optional().describe('Product ID if known'),
        sku: z.string().optional().describe('Product SKU (alternative to ID)'),
      }),
      execute: async ({ productId, sku }) => {
        try {
          let product;

          if (productId) {
            // Get by ID
            product = await productService.getProductForCurrentTenantService({
              currentTenantId: tenantId,
              productIdPathParam: productId,
            });
          } else if (sku) {
            // Search by SKU
            const results = await productService.listProductsForCurrentTenantService({
              currentTenantId: tenantId,
              qOptional: sku,
              limitOptional: 1,
            });

            if (results.items.length > 0) {
              const item = results.items[0]!;
              // Get full details
              product = await productService.getProductForCurrentTenantService({
                currentTenantId: tenantId,
                productIdPathParam: item.id,
              });
            }
          }

          if (!product) {
            return {
              error: 'Product not found',
              message: 'No product found with the specified ID or SKU',
            };
          }

          return {
            id: product.id,
            name: product.productName,
            sku: product.productSku,
            price: `£${(product.productPricePence / 100).toFixed(2)}`,
            priceInPence: product.productPricePence,
            barcode: product.barcode || 'None',
            barcodeType: product.barcodeType || 'None',
            createdAt: product.createdAt,
            updatedAt: product.updatedAt,
          };
        } catch (error: any) {
          return {
            error: 'Unable to get product details',
            message: error.message || 'Product not found or access denied',
          };
        }
      },
    }),

    getStockLevel: tool({
      description: 'Get current stock level for a product at a specific branch. Use when user asks "how much stock do we have?" or "what\'s the inventory level?". Requires branch ID or branch name.',
      inputSchema: z.object({
        productId: z.string().optional().describe('Product ID if known'),
        sku: z.string().optional().describe('Product SKU (alternative to product ID)'),
        branchId: z.string().optional().describe('Branch ID (if known)'),
        branchName: z.string().optional().describe('Branch name to search for'),
      }),
      execute: async ({ productId, sku, branchId, branchName }) => {
        try {
          // Step 1: Resolve product
          let product;
          if (productId) {
            product = await productService.getProductForCurrentTenantService({
              currentTenantId: tenantId,
              productIdPathParam: productId,
            });
          } else if (sku) {
            const results = await productService.listProductsForCurrentTenantService({
              currentTenantId: tenantId,
              qOptional: sku,
              limitOptional: 1,
            });
            if (results.items.length > 0) {
              product = results.items[0]!;
            }
          }

          if (!product) {
            return {
              error: 'Product not found',
              message: 'Specify a valid product ID or SKU',
            };
          }

          // Step 2: Resolve branch
          let resolvedBranchId = branchId;
          let resolvedBranchName = '';

          if (!resolvedBranchId && branchName) {
            // Search for branch by name
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
            // Get branch name
            const branch = await prismaClientInstance.branch.findFirst({
              where: { id: resolvedBranchId, tenantId, isActive: true },
              select: { branchName: true },
            });
            resolvedBranchName = branch?.branchName || 'Unknown';
          }

          if (!resolvedBranchId) {
            // If no branch specified, check user's branch memberships
            const memberships = await prismaClientInstance.userBranchMembership.findMany({
              where: { userId, tenantId },
              include: { branch: { select: { id: true, branchName: true } } },
              take: 1,
            });

            if (memberships.length > 0) {
              resolvedBranchId = memberships[0]!.branchId;
              resolvedBranchName = memberships[0]!.branch.branchName;
            } else {
              return {
                error: 'No branch specified',
                message: 'You must specify a branch name or ID, or be a member of at least one branch',
              };
            }
          }

          // Step 3: Get stock
          const productStock = await prismaClientInstance.productStock.findFirst({
            where: {
              tenantId,
              branchId: resolvedBranchId,
              productId: product.id,
            },
            select: {
              qtyOnHand: true,
              qtyAllocated: true,
              branch: { select: { branchName: true } },
            },
          });

          return {
            product: product.productName,
            sku: product.productSku,
            branch: resolvedBranchName || productStock?.branch.branchName || 'Unknown',
            qtyOnHand: productStock?.qtyOnHand || 0,
            qtyAllocated: productStock?.qtyAllocated || 0,
            qtyAvailable: (productStock?.qtyOnHand || 0) - (productStock?.qtyAllocated || 0),
          };
        } catch (error: any) {
          return {
            error: 'Unable to get stock level',
            message: error.message || 'An error occurred',
          };
        }
      },
    }),
  };
}
