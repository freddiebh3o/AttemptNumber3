// api-server/src/services/chat/tools/approvalTools.ts
import { tool } from 'ai';
import { z } from 'zod';
import * as approvalRulesService from '../../stockTransfers/approvalRulesService.js';
import * as transferService from '../../stockTransfers/stockTransferService.js';

/**
 * Approval rule tools for AI chatbot
 *
 * SECURITY: All tools enforce:
 * - Tenant isolation (all queries filter by tenantId)
 * - Approval rules are tenant-scoped
 */
export function approvalTools({ userId, tenantId }: { userId: string; tenantId: string }) {
  return {
    listApprovalRules: tool({
      description: 'List approval rules that determine when transfers need approval. Use when user asks "what approval rules do we have?" or "show me our approval workflow".',
      inputSchema: z.object({
        isActive: z.boolean().optional().describe('Filter by active status (true = only active rules)'),
        limit: z.number().optional().default(10).describe('Number of results (max 20)'),
      }),
      execute: async ({ isActive, limit }) => {
        try {
          const result = await approvalRulesService.listApprovalRules({
            tenantId,
            filters: {
              ...(isActive !== undefined ? { isActive } : {}),
              limit: Math.min(limit || 10, 20),
              sortBy: 'priority',
              sortDir: 'desc',
              includeTotal: true, // REQUIRED to get totalCount in pageInfo
            },
          });

          if (result.items.length === 0) {
            return {
              rules: [],
              count: 0,
              message: 'No approval rules found',
            };
          }

          return {
            rules: result.items.map((r: any) => ({
              id: r.id,
              name: r.name,
              description: r.description || 'No description',
              isActive: r.isActive,
              approvalMode: r.approvalMode,
              priority: r.priority,
              conditionCount: r.conditions?.length || 0,
              levelCount: r.levels?.length || 0,
              levels: r.levels?.map((l: any) => ({
                level: l.level,
                name: l.name,
                requiredRole: l.role?.name || null,
                requiredUser: l.user?.userEmailAddress || null,
              })) || [],
              createdAt: r.createdAt,
            })),
            showing: result.items.length,
            totalCount: result.pageInfo.totalCount!,
            hasMore: result.pageInfo.hasNextPage,
          };
        } catch (error: any) {
          return {
            error: 'Unable to list approval rules',
            message: error.message || 'An error occurred',
          };
        }
      },
    }),

    explainApprovalNeeds: tool({
      description: 'Explain why a transfer requires approval and what rules apply. Use when user asks "why does transfer X need approval?" or "what approval is needed for this transfer?"',
      inputSchema: z.object({
        transferId: z.string().optional().describe('Transfer ID'),
        transferNumber: z.string().optional().describe('Transfer number (e.g., TRF-2025-0001)'),
      }),
      execute: async ({ transferId, transferNumber }) => {
        try {
          // Step 1: Get transfer
          let transfer;

          if (transferId) {
            transfer = await transferService.getStockTransfer({
              tenantId,
              userId,
              transferId,
            });
          } else if (transferNumber) {
            // Search by transfer number
            const results = await transferService.listStockTransfers({
              tenantId,
              userId,
              filters: { q: transferNumber, limit: 1 },
            });

            if (results.items.length > 0) {
              transfer = await transferService.getStockTransfer({
                tenantId,
                userId,
                transferId: results.items[0]!.id,
              });
            }
          }

          if (!transfer) {
            return {
              error: 'Transfer not found',
              message: 'Transfer not found or you do not have access to it',
            };
          }

          // Step 2: Check if multi-level approval required
          if (!transfer.requiresMultiLevelApproval) {
            return {
              transferNumber: transfer.transferNumber,
              requiresApproval: false,
              status: transfer.status,
              message: 'This transfer uses simple approval workflow (one-step approval by branch manager)',
            };
          }

          // Step 3: Get active approval rules to explain what might have matched
          const activeRules = await approvalRulesService.listApprovalRules({
            tenantId,
            filters: {
              isActive: true,
              limit: 100,
              sortBy: 'priority',
              sortDir: 'desc',
            },
          });

          // Step 4: Explain which rules could apply
          const applicableRules = activeRules.items.filter((rule: any) => {
            // Check if any conditions might match
            return rule.conditions?.some((c: any) => {
              if (c.conditionType === 'VALUE_THRESHOLD' && c.threshold) {
                // Calculate transfer value
                const totalValue = transfer.items.reduce((sum: number, item: any) =>
                  sum + (item.qtyRequested * item.product.productPricePence), 0
                );
                return totalValue >= c.threshold * 100; // threshold in pounds, price in pence
              }
              if (c.conditionType === 'PRIORITY' && transfer.priority === 'URGENT') {
                return true;
              }
              if (c.conditionType === 'BRANCH_SPECIFIC' && c.branchId) {
                return transfer.sourceBranchId === c.branchId ||
                       transfer.destinationBranchId === c.branchId;
              }
              return false;
            });
          });

          return {
            transferNumber: transfer.transferNumber,
            status: transfer.status,
            requiresMultiLevelApproval: true,
            currentStep: transfer.status === 'REQUESTED' ? 'Pending approval' : transfer.status,
            reviewedBy: transfer.reviewedByUser?.userEmailAddress,
            reviewedAt: transfer.reviewedAt,
            applicableRules: applicableRules.length > 0 ? applicableRules.map((r: any) => ({
              name: r.name,
              description: r.description,
              approvalMode: r.approvalMode,
              levels: r.levels?.map((l: any) => ({
                level: l.level,
                name: l.name,
                approver: l.role ? `Role: ${l.role.name}` : `User: ${l.user?.userEmailAddress}`,
              })) || [],
            })) : null,
            explanation: applicableRules.length > 0
              ? `This transfer matched ${applicableRules.length} approval rule(s) based on its value, priority, or branches involved`
              : 'This transfer requires multi-level approval based on system configuration',
          };
        } catch (error: any) {
          return {
            error: 'Unable to explain approval needs',
            message: error.message || 'Transfer not found or access denied',
          };
        }
      },
    }),
  };
}
