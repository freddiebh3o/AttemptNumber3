// api-server/src/services/chat/tools/templateTools.ts
import { tool } from 'ai';
import { z } from 'zod';
import * as templateService from '../../stockTransfers/templateService.js';

/**
 * Transfer template tools for AI chatbot
 *
 * SECURITY: All tools enforce:
 * - Tenant isolation (all queries filter by tenantId)
 * - Templates are tenant-scoped
 */
export function templateTools({ userId, tenantId }: { userId: string; tenantId: string }) {
  return {
    listTemplates: tool({
      description: 'List transfer templates for quick transfer creation. Use when user asks "what templates do we have?" or "show me transfer templates". Templates are pre-configured transfer setups.',
      inputSchema: z.object({
        sourceBranchId: z.string().optional().describe('Filter by source branch'),
        destinationBranchId: z.string().optional().describe('Filter by destination branch'),
        query: z.string().optional().describe('Search by template name or description'),
        limit: z.number().optional().default(10).describe('Number of results (max 20)'),
      }),
      execute: async ({ sourceBranchId, destinationBranchId, query, limit }) => {
        try {
          const result = await templateService.listTransferTemplates({
            tenantId,
            filters: {
              ...(sourceBranchId ? { sourceBranchId } : {}),
              ...(destinationBranchId ? { destinationBranchId } : {}),
              ...(query ? { q: query } : {}),
              limit: Math.min(limit || 10, 20),
              includeTotal: true, // REQUIRED to get totalCount in pageInfo
            },
          });

          if (result.items.length === 0) {
            return {
              templates: [],
              count: 0,
              message: 'No templates found',
            };
          }

          return {
            templates: result.items.map((t: any) => ({
              id: t.id,
              name: t.name,
              description: t.description || 'No description',
              sourceBranch: t.sourceBranch?.branchName || 'Unknown',
              destinationBranch: t.destinationBranch?.branchName || 'Unknown',
              itemCount: t.items?.length || 0,
              createdBy: t.createdByUser?.userEmailAddress || 'Unknown',
              createdAt: t.createdAt,
            })),
            showing: result.items.length,
            totalCount: result.pageInfo.totalCount!,
            hasMore: result.pageInfo.hasNextPage,
          };
        } catch (error: any) {
          return {
            error: 'Unable to list templates',
            message: error.message || 'An error occurred',
          };
        }
      },
    }),

    getTemplateDetails: tool({
      description: 'Get full details of a transfer template including all products and quantities. Use when user asks "tell me about template X" or "what\'s in the weekly restock template?"',
      inputSchema: z.object({
        templateId: z.string().describe('Template ID'),
      }),
      execute: async ({ templateId }) => {
        try {
          const template = await templateService.getTransferTemplate({
            tenantId,
            templateId,
          });

          return {
            id: template.id,
            name: template.name,
            description: template.description || 'No description',
            sourceBranch: {
              id: template.sourceBranch.id,
              name: template.sourceBranch.branchName,
            },
            destinationBranch: {
              id: template.destinationBranch.id,
              name: template.destinationBranch.branchName,
            },
            items: template.items.map(item => ({
              product: item.product.productName,
              sku: item.product.productSku,
              defaultQty: item.defaultQty,
              price: `£${(item.product.productPricePence / 100).toFixed(2)}`,
            })),
            itemCount: template.items.length,
            totalValue: `£${(template.items.reduce((sum, item) =>
              sum + (item.defaultQty * item.product.productPricePence), 0) / 100
            ).toFixed(2)}`,
            createdBy: template.createdByUser.userEmailAddress,
            createdAt: template.createdAt,
            updatedAt: template.updatedAt,
          };
        } catch (error: any) {
          return {
            error: 'Unable to get template details',
            message: error.message || 'Template not found',
          };
        }
      },
    }),
  };
}
