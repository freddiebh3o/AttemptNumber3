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
  shipmentBatches: z
    .array(
      z.object({
        batchNumber: z.number().int(),
        qty: z.number().int(),
        shippedAt: z.string(),
        shippedByUserId: z.string(),
        lotsConsumed: z.array(
          z.object({
            lotId: z.string(),
            qty: z.number().int(),
            unitCostPence: z.number().int().nullable(),
          })
        ),
      })
    )
    .nullable()
    .optional(),
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
  priority: z.enum(['URGENT', 'HIGH', 'NORMAL', 'LOW']),
  initiationType: z.enum(['PUSH', 'PULL']),
  initiatedByBranchId: z.string().nullable(),
  requestedByUserId: z.string(),
  reviewedByUserId: z.string().nullable(),
  shippedByUserId: z.string().nullable(),
  requestedAt: z.string(),
  reviewedAt: z.string().nullable(),
  shippedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  requestNotes: z.string().nullable(),
  reviewNotes: z.string().nullable(),
  orderNotes: z.string().nullable(),
  expectedDeliveryDate: z.string().nullable(),
  isReversal: z.boolean(),
  reversalOfId: z.string().nullable(),
  reversedByTransferId: z.string().nullable(),
  reversalReason: z.string().nullable(),
  requiresMultiLevelApproval: z.boolean(),
  items: z.array(StockTransferItemSchema),
  // Reversal relationships
  reversalOf: z
    .object({
      id: z.string(),
      transferNumber: z.string(),
      status: z.enum([
        'REQUESTED',
        'APPROVED',
        'REJECTED',
        'IN_TRANSIT',
        'PARTIALLY_RECEIVED',
        'COMPLETED',
        'CANCELLED',
      ]),
      reversalReason: z.string().nullable(),
    })
    .nullable()
    .optional(),
  reversedBy: z
    .object({
      id: z.string(),
      transferNumber: z.string(),
      status: z.enum([
        'REQUESTED',
        'APPROVED',
        'REJECTED',
        'IN_TRANSIT',
        'PARTIALLY_RECEIVED',
        'COMPLETED',
        'CANCELLED',
      ]),
      reversalReason: z.string().nullable(),
    })
    .nullable()
    .optional(),
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
  orderNotes: z.string().max(2000).optional().describe('Order notes for communication between branches'),
  expectedDeliveryDate: z.string().datetime().optional().describe('Expected delivery date (ISO 8601 format)'),
  priority: z.enum(['URGENT', 'HIGH', 'NORMAL', 'LOW']).optional().describe('Transfer priority (default: NORMAL)'),
  initiationType: z
    .enum(['PUSH', 'PULL'])
    .optional()
    .describe('Transfer initiation type: PUSH (source sends) or PULL (destination requests). Default: PUSH'),
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

const ShipTransferBodySchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string(),
        qtyToShip: z.number().int().min(1),
      })
    )
    .optional()
    .describe('Optional: Partial shipment items. If not provided, ships all approved quantities.'),
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

const UpdatePriorityBodySchema = z.object({
  priority: z.enum(['URGENT', 'HIGH', 'NORMAL', 'LOW']),
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
        priority: z.string().optional().describe('Comma-separated priority values (URGENT,HIGH,NORMAL,LOW)'),
        initiationType: z.enum(['PUSH', 'PULL']).optional().describe('Filter by transfer initiation type'),
        initiatedByMe: z.string().optional().describe('Filter by transfers initiated by user\'s branches (true/false)'),
        q: z.string().optional(), // Search transfer number
        sortBy: z.enum(['requestedAt', 'updatedAt', 'transferNumber', 'status', 'priority']).optional().describe('Default: priority'),
        sortDir: z.enum(['asc', 'desc']).optional().describe('Default: desc'),
        requestedAtFrom: z.string().optional(), // ISO date (YYYY-MM-DD)
        requestedAtTo: z.string().optional(),
        shippedAtFrom: z.string().optional(),
        shippedAtTo: z.string().optional(),
        expectedDeliveryDateFrom: z.string().optional().describe('Filter by expected delivery date from (ISO date YYYY-MM-DD)'),
        expectedDeliveryDateTo: z.string().optional().describe('Filter by expected delivery date to (ISO date YYYY-MM-DD)'),
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

  // POST /api/stock-transfers/:transferId/ship - Ship transfer (supports partial shipments)
  registry.registerPath({
    method: 'post',
    path: '/api/stock-transfers/{transferId}/ship',
    tags: ['Stock Transfers'],
    summary: 'Ship approved transfer (supports partial shipments)',
    request: {
      params: z.object({ transferId: z.string() }),
      body: {
        content: { 'application/json': { schema: ShipTransferBodySchema } },
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

  // PATCH /api/stock-transfers/:transferId/priority - Update transfer priority
  registry.registerPath({
    method: 'patch',
    path: '/api/stock-transfers/{transferId}/priority',
    tags: ['Stock Transfers'],
    summary: 'Update transfer priority (REQUESTED or APPROVED only)',
    request: {
      params: z.object({ transferId: z.string() }),
      body: {
        content: { 'application/json': { schema: UpdatePriorityBodySchema } },
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
}
