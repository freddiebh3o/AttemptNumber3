// api-server/src/openapi/paths/stockTransferTemplates.ts
import { z } from 'zod';
import { registry } from '../registry.js';

// Common schemas
const BranchSummary = z.object({
  id: z.string(),
  branchName: z.string(),
  branchSlug: z.string(),
});

const ProductSummary = z.object({
  id: z.string(),
  productName: z.string(),
  productSku: z.string(),
  productPricePence: z.number().int(),
});

const UserSummary = z.object({
  id: z.string(),
  userEmailAddress: z.string(),
});

const StockTransferTemplateItemSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  productId: z.string(),
  defaultQty: z.number().int(),
  product: ProductSummary,
  createdAt: z.string(),
  updatedAt: z.string(),
});

const StockTransferTemplateSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  sourceBranchId: z.string(),
  destinationBranchId: z.string(),
  createdByUserId: z.string(),
  items: z.array(StockTransferTemplateItemSchema),
  sourceBranch: BranchSummary,
  destinationBranch: BranchSummary,
  createdByUser: UserSummary,
  createdAt: z.string(),
  updatedAt: z.string(),
});

const CreateTemplateBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  sourceBranchId: z.string(),
  destinationBranchId: z.string(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        defaultQty: z.number().int().min(1),
      })
    )
    .min(1),
});

const UpdateTemplateBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  sourceBranchId: z.string().optional(),
  destinationBranchId: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        defaultQty: z.number().int().min(1),
      })
    )
    .min(1)
    .optional(),
});

// Create template
registry.registerPath({
  method: 'post',
  path: '/api/stock-transfer-templates',
  tags: ['Stock Transfer Templates'],
  summary: 'Create a stock transfer template',
  request: {
    body: {
      content: { 'application/json': { schema: CreateTemplateBodySchema } },
    },
  },
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: StockTransferTemplateSchema,
          }),
        },
      },
    },
  },
});

// List templates
registry.registerPath({
  method: 'get',
  path: '/api/stock-transfer-templates',
  tags: ['Stock Transfer Templates'],
  summary: 'List stock transfer templates',
  request: {
    query: z.object({
      q: z.string().optional(),
      sourceBranchId: z.string().optional(),
      destinationBranchId: z.string().optional(),
      limit: z.string().optional(),
      cursor: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              items: z.array(StockTransferTemplateSchema),
              pageInfo: z.object({
                hasNextPage: z.boolean(),
                nextCursor: z.string().nullable(),
              }),
            }),
          }),
        },
      },
    },
  },
});

// Get template
registry.registerPath({
  method: 'get',
  path: '/api/stock-transfer-templates/{templateId}',
  tags: ['Stock Transfer Templates'],
  summary: 'Get template details',
  request: {
    params: z.object({ templateId: z.string() }),
  },
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: StockTransferTemplateSchema,
          }),
        },
      },
    },
  },
});

// Update template
registry.registerPath({
  method: 'patch',
  path: '/api/stock-transfer-templates/{templateId}',
  tags: ['Stock Transfer Templates'],
  summary: 'Update template',
  request: {
    params: z.object({ templateId: z.string() }),
    body: {
      content: { 'application/json': { schema: UpdateTemplateBodySchema } },
    },
  },
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: StockTransferTemplateSchema,
          }),
        },
      },
    },
  },
});

// Delete template
registry.registerPath({
  method: 'delete',
  path: '/api/stock-transfer-templates/{templateId}',
  tags: ['Stock Transfer Templates'],
  summary: 'Delete template',
  request: {
    params: z.object({ templateId: z.string() }),
  },
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({ success: z.boolean() }),
          }),
        },
      },
    },
  },
});

// Duplicate template
registry.registerPath({
  method: 'post',
  path: '/api/stock-transfer-templates/{templateId}/duplicate',
  tags: ['Stock Transfer Templates'],
  summary: 'Duplicate template',
  request: {
    params: z.object({ templateId: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            newName: z.string().min(1).max(255).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: StockTransferTemplateSchema,
          }),
        },
      },
    },
  },
});
