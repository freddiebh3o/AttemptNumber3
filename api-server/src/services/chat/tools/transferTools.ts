// api-server/src/services/chat/tools/transferTools.ts
import { tool } from 'ai';
import { z } from 'zod';
import * as transferService from '../../stockTransfers/stockTransferService.js';

/**
 * Transfer tools for AI chatbot
 *
 * SECURITY: All tools use existing service functions which enforce:
 * - Branch membership filtering (listStockTransfers filters to user's branches automatically)
 * - Access control (getStockTransfer calls assertTransferAccess)
 * - Tenant isolation (all queries filter by tenantId)
 *
 * NO direct database queries - security is enforced at service layer
 */
export function transferTools({ userId, tenantId }: { userId: string; tenantId: string }) {
  return {
    searchTransfers: tool({
      description: 'Search and list stock transfers. Use this when user asks about their transfers, pending transfers, or wants to find a specific transfer. Results are automatically filtered to branches the user is a member of.',
      inputSchema: z.object({
        status: z.enum(['REQUESTED', 'APPROVED', 'IN_TRANSIT', 'COMPLETED', 'REJECTED', 'CANCELLED']).optional()
          .describe('Filter by transfer status'),
        priority: z.enum(['URGENT', 'HIGH', 'NORMAL', 'LOW']).optional()
          .describe('Filter by priority'),
        direction: z.enum(['inbound', 'outbound']).optional()
          .describe('inbound = transfers coming TO user branches, outbound = transfers going FROM user branches'),
        branchId: z.string().optional()
          .describe('Filter to specific branch (user must be member)'),
        limit: z.number().optional().default(5)
          .describe('Number of results (max 10 for chat)'),
      }),
      execute: async ({ status, priority, direction, branchId, limit }) => {
        // Call existing service function which enforces branch membership
        // See stockTransferService.ts lines 993-1023 for filtering logic
        const result = await transferService.listStockTransfers({
          tenantId,
          userId,
          filters: {
            ...(status ? { status } : {}),
            ...(priority ? { priority } : {}),
            ...(direction ? { direction } : {}),
            ...(branchId ? { branchId } : {}),
            limit: Math.min(limit || 5, 10),
          },
        });

        // Return simplified data for AI to process
        return {
          transfers: result.items.map(t => {
            // Type assertion: we know these are included from service implementation
            const transfer = t as typeof t & {
              sourceBranch: { branchName: string } | null;
              destinationBranch: { branchName: string } | null;
              items: any[];
            };
            return {
              id: transfer.id,
              transferNumber: transfer.transferNumber,
              status: transfer.status,
              priority: transfer.priority,
              sourceBranch: transfer.sourceBranch?.branchName || 'Unknown',
              destinationBranch: transfer.destinationBranch?.branchName || 'Unknown',
              itemCount: transfer.items?.length || 0,
              requestedAt: transfer.requestedAt.toISOString(),
            };
          }),
          count: result.items.length,
          hasMore: result.pageInfo.hasNextPage,
        };
      },
    }),

    getTransferDetails: tool({
      description: 'Get detailed information about a specific stock transfer. Use when user asks about a specific transfer by number or ID. User must have access to at least one of the branches (source or destination).',
      inputSchema: z.object({
        transferNumber: z.string().optional().describe('Transfer number (e.g., TRF-2025-0001)'),
        transferId: z.string().optional().describe('Transfer ID if known'),
      }),
      execute: async ({ transferNumber, transferId }) => {
        try {
          let transfer;

          if (transferId) {
            // Get transfer by ID - service enforces access control
            transfer = await transferService.getStockTransfer({ tenantId, userId, transferId });
          } else if (transferNumber) {
            // Search by transfer number first
            const results = await transferService.listStockTransfers({
              tenantId,
              userId,
              filters: { q: transferNumber, limit: 1 },
            });

            if (results.items.length > 0) {
              // Get full details
              transfer = await transferService.getStockTransfer({
                tenantId,
                userId,
                transferId: results.items[0]!.id,
              });
            }
          }

          if (!transfer) {
            return {
              error: 'Transfer not found or you do not have access to it',
              message: 'You need to be a member of either the source or destination branch to view this transfer',
            };
          }

          // Return detailed data
          return {
            transferNumber: transfer.transferNumber,
            status: transfer.status,
            priority: transfer.priority,
            sourceBranch: transfer.sourceBranch.branchName,
            destinationBranch: transfer.destinationBranch.branchName,
            requestedBy: transfer.requestedByUser.userEmailAddress,
            requestedAt: transfer.requestedAt,
            reviewedBy: transfer.reviewedByUser?.userEmailAddress || null,
            reviewedAt: transfer.reviewedAt,
            shippedBy: transfer.shippedByUser?.userEmailAddress || null,
            shippedAt: transfer.shippedAt,
            items: transfer.items.map(item => ({
              product: item.product.productName,
              sku: item.product.productSku,
              qtyRequested: item.qtyRequested,
              qtyApproved: item.qtyApproved || null,
              qtyShipped: item.qtyShipped,
              qtyReceived: item.qtyReceived,
            })),
            notes: transfer.requestNotes,
            requiresMultiLevelApproval: transfer.requiresMultiLevelApproval,
          };
        } catch (error: any) {
          // Handle permission denied or not found errors gracefully
          return {
            error: 'Unable to access transfer',
            message: error.message || 'You may not have permission to view this transfer',
          };
        }
      },
    }),

    getApprovalStatus: tool({
      description: 'Check approval progress for a stock transfer. Use when user asks why a transfer is pending or stuck. Only works for transfers requiring multi-level approval.',
      inputSchema: z.object({
        transferId: z.string().describe('Transfer ID'),
      }),
      execute: async ({ transferId }) => {
        try {
          // First verify user has access to this transfer
          const transfer = await transferService.getStockTransfer({
            tenantId,
            userId,
            transferId,
          });

          // Check if transfer requires multi-level approval
          if (!transfer.requiresMultiLevelApproval) {
            return {
              requiresMultiLevelApproval: false,
              status: transfer.status,
              message: 'This transfer uses simple approval workflow (one-step approval)',
            };
          }

          // For MVP, return basic approval info from transfer
          // TODO: Add approvalEvaluationService.getApprovalProgress() if available
          return {
            requiresMultiLevelApproval: true,
            status: transfer.status,
            message: transfer.status === 'REQUESTED'
              ? 'Transfer is pending multi-level approval'
              : `Transfer is ${transfer.status.toLowerCase()}`,
            reviewedBy: transfer.reviewedByUser?.userEmailAddress,
            reviewedAt: transfer.reviewedAt,
          };
        } catch (error: any) {
          return {
            error: 'Unable to check approval status',
            message: 'Transfer not found or you do not have access to it',
          };
        }
      },
    }),
  };
}
