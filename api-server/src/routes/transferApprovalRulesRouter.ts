// api-server/src/routes/transferApprovalRulesRouter.ts
import { Router } from 'express';
import { z } from 'zod';
import { validateRequestBodyWithZod } from '../middleware/zodValidation.js';
import { requireAuthenticatedUserMiddleware } from '../middleware/sessionMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { assertAuthed } from '../types/assertions.js';
import { createStandardSuccessResponse } from '../utils/standardResponse.js';
import * as approvalRulesService from '../services/stockTransfers/approvalRulesService.js';
import { getAuditContext } from '../utils/auditContext.js';

export const transferApprovalRulesRouter = Router();

// Validation schemas
const CreateApprovalRuleBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  isActive: z.boolean().optional(),
  approvalMode: z.enum(['SEQUENTIAL', 'PARALLEL', 'HYBRID']).optional(),
  priority: z.number().int().optional(),
  conditions: z
    .array(
      z.object({
        conditionType: z.enum([
          'TOTAL_QTY_THRESHOLD',
          'TOTAL_VALUE_THRESHOLD',
          'SOURCE_BRANCH',
          'DESTINATION_BRANCH',
          'PRODUCT_CATEGORY',
        ]),
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


// POST /api/transfer-approval-rules - Create approval rule
transferApprovalRulesRouter.post(
  '/',
  requireAuthenticatedUserMiddleware,
  requirePermission('stock:write'), // Admin permission required
  validateRequestBodyWithZod(CreateApprovalRuleBodySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const body = req.validatedBody as z.infer<typeof CreateApprovalRuleBodySchema>;

      const rule = await approvalRulesService.createApprovalRule({
        tenantId: req.currentTenantId,
        userId: req.currentUserId,
        data: {
          name: body.name,
          conditions: body.conditions.map(c => ({
            conditionType: c.conditionType,
            ...(c.threshold !== undefined ? { threshold: c.threshold } : {}),
            ...(c.branchId !== undefined ? { branchId: c.branchId } : {}),
          })),
          levels: body.levels.map(l => ({
            level: l.level,
            name: l.name,
            ...(l.requiredRoleId !== undefined ? { requiredRoleId: l.requiredRoleId } : {}),
            ...(l.requiredUserId !== undefined ? { requiredUserId: l.requiredUserId } : {}),
          })),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          ...(body.approvalMode !== undefined ? { approvalMode: body.approvalMode } : {}),
          ...(body.priority !== undefined ? { priority: body.priority } : {}),
        },
        auditContext: getAuditContext(req),
      });

      return res.status(200).json(createStandardSuccessResponse(rule));
    } catch (e) {
      return next(e);
    }
  }
);

// GET /api/transfer-approval-rules - List approval rules
transferApprovalRulesRouter.get(
  '/',
  requireAuthenticatedUserMiddleware,
  requirePermission('stock:read'),
  async (req, res, next) => {
    try {
      assertAuthed(req);

      const isActiveStr = req.query.isActive as string | undefined;
      const sortBy = req.query.sortBy as 'priority' | 'name' | 'createdAt' | undefined;
      const sortDir = req.query.sortDir as 'asc' | 'desc' | undefined;
      const limitStr = req.query.limit as string | undefined;
      const cursor = req.query.cursor as string | undefined;

      const result = await approvalRulesService.listApprovalRules({
        tenantId: req.currentTenantId,
        filters: {
          ...(isActiveStr !== undefined ? { isActive: isActiveStr === 'true' } : {}),
          ...(sortBy !== undefined ? { sortBy } : {}),
          ...(sortDir !== undefined ? { sortDir } : {}),
          ...(limitStr !== undefined ? { limit: parseInt(limitStr) } : {}),
          ...(cursor !== undefined ? { cursor } : {}),
        },
      });

      return res.status(200).json(createStandardSuccessResponse(result));
    } catch (e) {
      return next(e);
    }
  }
);

// GET /api/transfer-approval-rules/:ruleId - Get approval rule
transferApprovalRulesRouter.get(
  '/:ruleId',
  requireAuthenticatedUserMiddleware,
  requirePermission('stock:read'),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const { ruleId } = req.params;

      if (!ruleId) {
        throw new Error('Rule ID is required');
      }

      const rule = await approvalRulesService.getApprovalRule({
        tenantId: req.currentTenantId,
        ruleId,
      });

      return res.status(200).json(createStandardSuccessResponse(rule));
    } catch (e) {
      return next(e);
    }
  }
);

// PATCH /api/transfer-approval-rules/:ruleId - Update approval rule
transferApprovalRulesRouter.patch(
  '/:ruleId',
  requireAuthenticatedUserMiddleware,
  requirePermission('stock:write'),
  validateRequestBodyWithZod(UpdateApprovalRuleBodySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const { ruleId } = req.params;

      if (!ruleId) {
        throw new Error('Rule ID is required');
      }

      const body = req.validatedBody as z.infer<typeof UpdateApprovalRuleBodySchema>;

      const rule = await approvalRulesService.updateApprovalRule({
        tenantId: req.currentTenantId,
        userId: req.currentUserId,
        ruleId,
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          ...(body.approvalMode !== undefined ? { approvalMode: body.approvalMode } : {}),
          ...(body.priority !== undefined ? { priority: body.priority } : {}),
        },
        auditContext: getAuditContext(req),
      });

      return res.status(200).json(createStandardSuccessResponse(rule));
    } catch (e) {
      return next(e);
    }
  }
);

// DELETE /api/transfer-approval-rules/:ruleId - Delete approval rule
transferApprovalRulesRouter.delete(
  '/:ruleId',
  requireAuthenticatedUserMiddleware,
  requirePermission('stock:write'),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const { ruleId } = req.params;

      if (!ruleId) {
        throw new Error('Rule ID is required');
      }

      const result = await approvalRulesService.deleteApprovalRule({
        tenantId: req.currentTenantId,
        userId: req.currentUserId,
        ruleId,
        auditContext: getAuditContext(req),
      });

      return res.status(200).json(createStandardSuccessResponse(result));
    } catch (e) {
      return next(e);
    }
  }
);

// Note: Approval submission endpoints are in stockTransfersRouter.ts
