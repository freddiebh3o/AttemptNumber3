import { z } from 'zod';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { successEnvelope, RESPONSES } from '../components/envelopes.js';

// Schemas
const StockTransferItemSchema = z.object({
  id: z.string(),
  productId: z.string(),
  qtyRequested: z.number().int(),
  qtyApproved: z.number().int().nullable(),
  qtyShipped: z.number().int(),
  qtyReceived: z.number().int(),
  avgUnitCostPence: z.number().int().nullable(),
  lotsConsumed: z
    .array(
      z.object({
        lotId: z.string(),
        qty: z.number().int(),
        unitCostPence: z.number().int().nullable(),
      })
    )
    .nullable(),
  product: z
    .object({
      id: z.string(),
      productName: z.string(),
      productSku: z.string(),
    })
    .optional(),
});

const StockTransferSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  transferNumber: z.string(),
  sourceBranchId: z.string(),
  destinationBranchId: z.string(),
  status: z.enum([
    'REQUESTED',
    'APPROVED',
    'REJECTED',
    'IN_TRANSIT',
    'PARTIALLY_RECEIVED',
    'COMPLETED',
    'CANCELLED',
  ]),
  requestedByUserId: z.string(),
  reviewedByUserId: z.string().nullable(),
  shippedByUserId: z.string().nullable(),
  requestedAt: z.string(),
  reviewedAt: z.string().nullable(),
  shippedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  requestNotes: z.string().nullable(),
  reviewNotes: z.string().nullable(),
  isReversal: z.boolean(),
  reversalOfId: z.string().nullable(),
  reversedById: z.string().nullable(),
  reversalReason: z.string().nullable(),
  requiresMultiLevelApproval: z.boolean(),
  items: z.array(StockTransferItemSchema),
  sourceBranch: z
    .object({
      id: z.string(),
      branchName: z.string(),
      branchSlug: z.string(),
    })
    .optional(),
  destinationBranch: z
    .object({
      id: z.string(),
      branchName: z.string(),
      branchSlug: z.string(),
    })
    .optional(),
  requestedByUser: z
    .object({
      id: z.string(),
      userEmailAddress: z.string(),
    })
    .optional(),
  reviewedByUser: z
    .object({
      id: z.string(),
      userEmailAddress: z.string(),
    })
    .nullable()
    .optional(),
  shippedByUser: z
    .object({
      id: z.string(),
      userEmailAddress: z.string(),
    })
    .nullable()
    .optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const CreateTransferBodySchema = z.object({
  sourceBranchId: z.string(),
  destinationBranchId: z.string(),
  requestNotes: z.string().max(1000).optional(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        qtyRequested: z.number().int().min(1),
      })
    )
    .min(1),
});

const ReviewTransferBodySchema = z.object({
  action: z.enum(['approve', 'reject']),
  reviewNotes: z.string().max(1000).optional(),
  items: z
    .array(
      z.object({
        itemId: z.string(),
        qtyApproved: z.number().int().min(0), // 0 = don't ship this item
      })
    )
    .optional(), // Only for approve
});

const ReceiveTransferBodySchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string(),
        qtyReceived: z.number().int().min(1),
      })
    )
    .min(1),
});

// Register paths
export function registerStockTransferPaths(registry: OpenAPIRegistry) {
  // POST /api/stock-transfers - Create transfer
  registry.registerPath({
    method: 'post',
    path: '/api/stock-transfers',
    tags: ['Stock Transfers'],
    summary: 'Create a stock transfer request',
    request: {
      body: {
        content: { 'application/json': { schema: CreateTransferBodySchema } },
      },
    },
    responses: {
      200: {
        description: 'Success',
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              data: StockTransferSchema,
            }),
          },
        },
      },
    },
  });

  // GET /api/stock-transfers - List transfers
  registry.registerPath({
    method: 'get',
    path: '/api/stock-transfers',
    tags: ['Stock Transfers'],
    summary: 'List stock transfers',
    request: {
      query: z.object({
        branchId: z.string().optional(),
        direction: z.enum(['inbound', 'outbound']).optional(),
        status: z.string().optional(), // Comma-separated
        q: z.string().optional(), // Search transfer number
        sortBy: z.enum(['requestedAt', 'updatedAt', 'transferNumber', 'status']).optional(),
        sortDir: z.enum(['asc', 'desc']).optional(),
        requestedAtFrom: z.string().optional(), // ISO date (YYYY-MM-DD)
        requestedAtTo: z.string().optional(),
        shippedAtFrom: z.string().optional(),
        shippedAtTo: z.string().optional(),
        limit: z.string().optional(),
        cursor: z.string().optional(),
        includeTotal: z.string().optional(), // "true" | "false"
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
                items: z.array(StockTransferSchema),
                pageInfo: z.object({
                  hasNextPage: z.boolean(),
                  nextCursor: z.string().nullable(),
                  totalCount: z.number().int().optional(),
                }),
              }),
            }),
          },
        },
      },
    },
  });

  // GET /api/stock-transfers/:transferId - Get transfer details
  registry.registerPath({
    method: 'get',
    path: '/api/stock-transfers/{transferId}',
    tags: ['Stock Transfers'],
    summary: 'Get transfer details',
    request: {
      params: z.object({ transferId: z.string() }),
    },
    responses: {
      200: {
        description: 'Success',
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              data: StockTransferSchema,
            }),
          },
        },
      },
    },
  });

  // PATCH /api/stock-transfers/:transferId/review - Approve or reject
  registry.registerPath({
    method: 'patch',
    path: '/api/stock-transfers/{transferId}/review',
    tags: ['Stock Transfers'],
    summary: 'Approve or reject transfer',
    request: {
      params: z.object({ transferId: z.string() }),
      body: {
        content: { 'application/json': { schema: ReviewTransferBodySchema } },
      },
    },
    responses: {
      200: {
        description: 'Success',
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              data: StockTransferSchema,
            }),
          },
        },
      },
    },
  });

  // POST /api/stock-transfers/:transferId/ship - Ship transfer
  registry.registerPath({
    method: 'post',
    path: '/api/stock-transfers/{transferId}/ship',
    tags: ['Stock Transfers'],
    summary: 'Ship approved transfer',
    request: {
      params: z.object({ transferId: z.string() }),
    },
    responses: {
      200: {
        description: 'Success',
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              data: StockTransferSchema,
            }),
          },
        },
      },
    },
  });

  // POST /api/stock-transfers/:transferId/receive - Receive items
  registry.registerPath({
    method: 'post',
    path: '/api/stock-transfers/{transferId}/receive',
    tags: ['Stock Transfers'],
    summary: 'Receive transferred items',
    request: {
      params: z.object({ transferId: z.string() }),
      body: {
        content: { 'application/json': { schema: ReceiveTransferBodySchema } },
      },
    },
    responses: {
      200: {
        description: 'Success',
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              data: StockTransferSchema,
            }),
          },
        },
      },
    },
  });

  // DELETE /api/stock-transfers/:transferId - Cancel transfer
  registry.registerPath({
    method: 'delete',
    path: '/api/stock-transfers/{transferId}',
    tags: ['Stock Transfers'],
    summary: 'Cancel transfer (REQUESTED only)',
    request: {
      params: z.object({ transferId: z.string() }),
    },
    responses: {
      200: {
        description: 'Success',
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              data: z.object({ message: z.string() }),
            }),
          },
        },
      },
    },
  });

  // POST /api/stock-transfers/:transferId/reverse - Reverse completed transfer
  registry.registerPath({
    method: 'post',
    path: '/api/stock-transfers/{transferId}/reverse',
    tags: ['Stock Transfers'],
    summary: 'Reverse a completed transfer',
    request: {
      params: z.object({ transferId: z.string() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              reversalReason: z.string().max(1000).optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Success - Returns the newly created reversal transfer',
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              data: StockTransferSchema,
            }),
          },
        },
      },
    },
  });
}
