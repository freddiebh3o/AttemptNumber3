// api-server/src/openapi/paths/transferAnalytics.ts
import { z } from 'zod';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

// Common query params for all analytics endpoints
const AnalyticsQueryParamsSchema = z.object({
  startDate: z.string().optional().describe('Start date (ISO 8601 YYYY-MM-DD). Defaults to 30 days ago.'),
  endDate: z.string().optional().describe('End date (ISO 8601 YYYY-MM-DD). Defaults to today.'),
  branchId: z.string().optional().describe('Filter by specific branch (optional)'),
});

const TopRoutesQueryParamsSchema = AnalyticsQueryParamsSchema.extend({
  limit: z.string().optional().describe('Max number of routes to return (default: 10)'),
});

const ProductFrequencyQueryParamsSchema = AnalyticsQueryParamsSchema.extend({
  limit: z.string().optional().describe('Max number of products to return (default: 10)'),
});

// Response schemas
const OverviewMetricsSchema = z.object({
  totalTransfers: z.number().int(),
  activeTransfers: z.number().int(),
  avgApprovalTime: z.number().int().describe('Average time in seconds for REQUESTED → APPROVED'),
  avgShipTime: z.number().int().describe('Average time in seconds for APPROVED → IN_TRANSIT'),
  avgReceiveTime: z.number().int().describe('Average time in seconds for IN_TRANSIT → COMPLETED'),
});

const VolumeChartDataPointSchema = z.object({
  date: z.string().describe('Date (YYYY-MM-DD)'),
  created: z.number().int().describe('Transfers created on this date'),
  approved: z.number().int().describe('Transfers approved on this date'),
  shipped: z.number().int().describe('Transfers shipped on this date'),
  completed: z.number().int().describe('Transfers completed on this date'),
});

const BranchDependencySchema = z.object({
  sourceBranch: z.string(),
  destinationBranch: z.string(),
  transferCount: z.number().int(),
  totalUnits: z.number().int(),
});

const TopRouteSchema = z.object({
  sourceBranch: z.string(),
  destinationBranch: z.string(),
  transferCount: z.number().int(),
  totalUnits: z.number().int(),
  avgCompletionTime: z.number().int().nullable().describe('Average time in seconds from REQUESTED → COMPLETED'),
});

const StatusDistributionSchema = z.record(z.string(), z.number().int()).describe(
  'Status distribution keyed by status (e.g., { "REQUESTED": 10, "APPROVED": 5 })'
);

const BottlenecksSchema = z.object({
  approvalStage: z.number().int().describe('Average time in seconds for REQUESTED → APPROVED'),
  shippingStage: z.number().int().describe('Average time in seconds for APPROVED → IN_TRANSIT'),
  receiptStage: z.number().int().describe('Average time in seconds for IN_TRANSIT → COMPLETED'),
});

const ProductFrequencySchema = z.object({
  productName: z.string(),
  transferCount: z.number().int(),
  totalQty: z.number().int(),
  topRoutes: z.array(z.string()).describe('Top 3 routes for this product'),
});

// Register paths
export function registerTransferAnalyticsPaths(registry: OpenAPIRegistry) {
  // GET /api/stock-transfers/analytics/overview
  registry.registerPath({
    method: 'get',
    path: '/api/stock-transfers/analytics/overview',
    tags: ['Analytics'],
    summary: 'Get overview metrics for Transfer Analytics Dashboard',
    request: {
      query: AnalyticsQueryParamsSchema,
    },
    responses: {
      200: {
        description: 'Success',
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              data: OverviewMetricsSchema,
            }),
          },
        },
      },
    },
  });

  // GET /api/stock-transfers/analytics/volume-chart
  registry.registerPath({
    method: 'get',
    path: '/api/stock-transfers/analytics/volume-chart',
    tags: ['Analytics'],
    summary: 'Get transfer volume chart data (time series)',
    request: {
      query: AnalyticsQueryParamsSchema.omit({ branchId: true }),
    },
    responses: {
      200: {
        description: 'Success',
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              data: z.array(VolumeChartDataPointSchema),
            }),
          },
        },
      },
    },
  });

  // GET /api/stock-transfers/analytics/branch-dependencies
  registry.registerPath({
    method: 'get',
    path: '/api/stock-transfers/analytics/branch-dependencies',
    tags: ['Analytics'],
    summary: 'Get branch dependency data (transfer routes)',
    request: {
      query: AnalyticsQueryParamsSchema.omit({ branchId: true }),
    },
    responses: {
      200: {
        description: 'Success',
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              data: z.array(BranchDependencySchema),
            }),
          },
        },
      },
    },
  });

  // GET /api/stock-transfers/analytics/top-routes
  registry.registerPath({
    method: 'get',
    path: '/api/stock-transfers/analytics/top-routes',
    tags: ['Analytics'],
    summary: 'Get top transfer routes (sorted by volume)',
    request: {
      query: TopRoutesQueryParamsSchema.omit({ branchId: true }),
    },
    responses: {
      200: {
        description: 'Success',
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              data: z.array(TopRouteSchema),
            }),
          },
        },
      },
    },
  });

  // GET /api/stock-transfers/analytics/status-distribution
  registry.registerPath({
    method: 'get',
    path: '/api/stock-transfers/analytics/status-distribution',
    tags: ['Analytics'],
    summary: 'Get transfer status distribution (pie chart data)',
    request: {
      query: AnalyticsQueryParamsSchema.omit({ branchId: true }),
    },
    responses: {
      200: {
        description: 'Success',
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              data: StatusDistributionSchema,
            }),
          },
        },
      },
    },
  });

  // GET /api/stock-transfers/analytics/bottlenecks
  registry.registerPath({
    method: 'get',
    path: '/api/stock-transfers/analytics/bottlenecks',
    tags: ['Analytics'],
    summary: 'Get bottleneck analysis (avg time per stage)',
    request: {
      query: AnalyticsQueryParamsSchema.omit({ branchId: true }),
    },
    responses: {
      200: {
        description: 'Success',
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              data: BottlenecksSchema,
            }),
          },
        },
      },
    },
  });

  // GET /api/stock-transfers/analytics/product-frequency
  registry.registerPath({
    method: 'get',
    path: '/api/stock-transfers/analytics/product-frequency',
    tags: ['Analytics'],
    summary: 'Get product transfer frequency (which products are transferred most)',
    request: {
      query: ProductFrequencyQueryParamsSchema.omit({ branchId: true }),
    },
    responses: {
      200: {
        description: 'Success',
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              data: z.array(ProductFrequencySchema),
            }),
          },
        },
      },
    },
  });
}
