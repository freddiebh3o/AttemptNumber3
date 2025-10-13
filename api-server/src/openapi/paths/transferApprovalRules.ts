import { z } from 'zod';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

// Schemas
const ApprovalRuleConditionSchema = z.object({
  id: z.string(),
  conditionType: z.enum(['TOTAL_QTY_THRESHOLD', 'TOTAL_VALUE_THRESHOLD', 'SOURCE_BRANCH', 'DESTINATION_BRANCH', 'PRODUCT_CATEGORY']),
  threshold: z.number().int().nullable(),
  branchId: z.string().nullable(),
  branch: z
    .object({
      id: z.string(),
      branchName: z.string(),
      branchSlug: z.string(),
    })
    .nullable()
    .optional(),
});

const ApprovalLevelSchema = z.object({
  id: z.string(),
  level: z.number().int(),
  name: z.string(),
  requiredRoleId: z.string().nullable(),
  requiredUserId: z.string().nullable(),
  role: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable()
    .optional(),
  user: z
    .object({
      id: z.string(),
      userEmailAddress: z.string(),
    })
    .nullable()
    .optional(),
});

const ApprovalRuleSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  approvalMode: z.enum(['SEQUENTIAL', 'PARALLEL', 'HYBRID']),
  priority: z.number().int(),
  conditions: z.array(ApprovalRuleConditionSchema),
  levels: z.array(ApprovalLevelSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const CreateApprovalRuleBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  isActive: z.boolean().optional(),
  approvalMode: z.enum(['SEQUENTIAL', 'PARALLEL', 'HYBRID']).optional(),
  priority: z.number().int().optional(),
  conditions: z
    .array(
      z.object({
        conditionType: z.enum(['TOTAL_QTY_THRESHOLD', 'TOTAL_VALUE_THRESHOLD', 'SOURCE_BRANCH', 'DESTINATION_BRANCH', 'PRODUCT_CATEGORY']),
        threshold: z.number().int().optional(),
        branchId: z.string().optional(),
      })
    )
    .min(1),
  levels: z
    .array(
      z.object({
        level: z.number().int().min(1),
        name: z.string().min(1).max(255),
        requiredRoleId: z.string().optional(),
        requiredUserId: z.string().optional(),
      })
    )
    .min(1),
});

const UpdateApprovalRuleBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  isActive: z.boolean().optional(),
  approvalMode: z.enum(['SEQUENTIAL', 'PARALLEL', 'HYBRID']).optional(),
  priority: z.number().int().optional(),
});

const ApprovalRecordSchema = z.object({
  id: z.string(),
  transferId: z.string(),
  level: z.number().int(),
  levelName: z.string(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SKIPPED']),
  requiredRoleId: z.string().nullable(),
  requiredUserId: z.string().nullable(),
  approvedByUserId: z.string().nullable(),
  approvedAt: z.string().nullable(),
  notes: z.string().nullable(),
  requiredRole: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable()
    .optional(),
  requiredUser: z
    .object({
      id: z.string(),
      userEmailAddress: z.string(),
    })
    .nullable()
    .optional(),
  approvedByUser: z
    .object({
      id: z.string(),
      userEmailAddress: z.string(),
    })
    .nullable()
    .optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const SubmitApprovalBodySchema = z.object({
  notes: z.string().max(1000).optional(),
});

// Register paths
export function registerTransferApprovalRulePaths(registry: OpenAPIRegistry) {
  // POST /api/transfer-approval-rules - Create approval rule
  registry.registerPath({
    method: 'post',
    path: '/api/transfer-approval-rules',
    tags: ['Transfer Approval'],
    summary: 'Create a transfer approval rule',
    request: {
      body: {
        content: { 'application/json': { schema: CreateApprovalRuleBodySchema } },
      },
    },
    responses: {
      200: {
        description: 'Success',
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              data: ApprovalRuleSchema,
            }),
          },
        },
      },
    },
  });

  // GET /api/transfer-approval-rules - List approval rules
  registry.registerPath({
    method: 'get',
    path: '/api/transfer-approval-rules',
    tags: ['Transfer Approval'],
    summary: 'List transfer approval rules',
    request: {
      query: z.object({
        isActive: z.enum(['true', 'false']).optional(),
        sortBy: z.enum(['priority', 'name', 'createdAt']).optional(),
        sortDir: z.enum(['asc', 'desc']).optional(),
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
                items: z.array(ApprovalRuleSchema),
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

  // GET /api/transfer-approval-rules/:ruleId - Get approval rule
  registry.registerPath({
    method: 'get',
    path: '/api/transfer-approval-rules/{ruleId}',
    tags: ['Transfer Approval'],
    summary: 'Get approval rule details',
    request: {
      params: z.object({ ruleId: z.string() }),
    },
    responses: {
      200: {
        description: 'Success',
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              data: ApprovalRuleSchema,
            }),
          },
        },
      },
    },
  });

  // PATCH /api/transfer-approval-rules/:ruleId - Update approval rule
  registry.registerPath({
    method: 'patch',
    path: '/api/transfer-approval-rules/{ruleId}',
    tags: ['Transfer Approval'],
    summary: 'Update approval rule',
    request: {
      params: z.object({ ruleId: z.string() }),
      body: {
        content: { 'application/json': { schema: UpdateApprovalRuleBodySchema } },
      },
    },
    responses: {
      200: {
        description: 'Success',
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              data: ApprovalRuleSchema,
            }),
          },
        },
      },
    },
  });

  // DELETE /api/transfer-approval-rules/:ruleId - Delete approval rule
  registry.registerPath({
    method: 'delete',
    path: '/api/transfer-approval-rules/{ruleId}',
    tags: ['Transfer Approval'],
    summary: 'Delete approval rule',
    request: {
      params: z.object({ ruleId: z.string() }),
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

  // POST /api/stock-transfers/:transferId/approve/:level - Submit approval for level
  registry.registerPath({
    method: 'post',
    path: '/api/stock-transfers/{transferId}/approve/{level}',
    tags: ['Transfer Approval'],
    summary: 'Submit approval for a specific level',
    request: {
      params: z.object({
        transferId: z.string(),
        level: z.string(), // Convert to number in router
      }),
      body: {
        content: { 'application/json': { schema: SubmitApprovalBodySchema } },
      },
    },
    responses: {
      200: {
        description: 'Success - Returns updated transfer with approval records',
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              data: z.any(), // StockTransferSchema with approvalRecords
            }),
          },
        },
      },
    },
  });

  // GET /api/stock-transfers/:transferId/approval-progress - Get approval progress
  registry.registerPath({
    method: 'get',
    path: '/api/stock-transfers/{transferId}/approval-progress',
    tags: ['Transfer Approval'],
    summary: 'Get approval progress for a transfer',
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
              data: z.object({
                requiresApproval: z.boolean(),
                records: z.array(ApprovalRecordSchema),
              }),
            }),
          },
        },
      },
    },
  });
}
