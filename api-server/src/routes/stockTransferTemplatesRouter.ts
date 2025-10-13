// api-server/src/routes/stockTransferTemplatesRouter.ts
import { Router } from 'express';
import { requireAuthenticatedUserMiddleware } from '../middleware/sessionMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { validateRequestBodyWithZod } from '../middleware/zodValidation.js';
import * as templateService from '../services/stockTransfers/templateService.js';
import { assertAuthed } from '../types/assertions.js';
import { createStandardSuccessResponse } from '../utils/standardResponse.js';
import { z } from 'zod';

export const stockTransferTemplatesRouter = Router();

// Validation schemas
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

const DuplicateTemplateBodySchema = z.object({
  newName: z.string().min(1).max(255).optional(),
});

// POST /api/stock-transfer-templates - Create template
stockTransferTemplatesRouter.post(
  '/',
  requireAuthenticatedUserMiddleware,
  requirePermission('stock:write'),
  validateRequestBodyWithZod(CreateTemplateBodySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const template = await templateService.createTransferTemplate({
        tenantId: req.currentTenantId,
        userId: req.currentUserId,
        data: req.validatedBody as z.infer<typeof CreateTemplateBodySchema>,
      });
      return res.status(200).json(createStandardSuccessResponse(template));
    } catch (e) {
      return next(e);
    }
  }
);

// GET /api/stock-transfer-templates - List templates
stockTransferTemplatesRouter.get(
  '/',
  requireAuthenticatedUserMiddleware,
  requirePermission('stock:read'),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const result = await templateService.listTransferTemplates({
        tenantId: req.currentTenantId,
        filters: {
          q: req.query.q as string | undefined,
          sourceBranchId: req.query.sourceBranchId as string | undefined,
          destinationBranchId: req.query.destinationBranchId as string | undefined,
          limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
          cursor: req.query.cursor as string | undefined,
        },
      });
      return res.status(200).json(createStandardSuccessResponse(result));
    } catch (e) {
      return next(e);
    }
  }
);

// GET /api/stock-transfer-templates/:templateId - Get template
stockTransferTemplatesRouter.get(
  '/:templateId',
  requireAuthenticatedUserMiddleware,
  requirePermission('stock:read'),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const { templateId } = req.params;

      if (!templateId) {
        throw new Error('Template ID is required');
      }

      const template = await templateService.getTransferTemplate({
        tenantId: req.currentTenantId,
        templateId,
      });
      return res.status(200).json(createStandardSuccessResponse(template));
    } catch (e) {
      return next(e);
    }
  }
);

// PATCH /api/stock-transfer-templates/:templateId - Update template
stockTransferTemplatesRouter.patch(
  '/:templateId',
  requireAuthenticatedUserMiddleware,
  requirePermission('stock:write'),
  validateRequestBodyWithZod(UpdateTemplateBodySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const { templateId } = req.params;

      if (!templateId) {
        throw new Error('Template ID is required');
      }

      const template = await templateService.updateTransferTemplate({
        tenantId: req.currentTenantId,
        templateId,
        data: req.validatedBody as z.infer<typeof UpdateTemplateBodySchema>,
      });
      return res.status(200).json(createStandardSuccessResponse(template));
    } catch (e) {
      return next(e);
    }
  }
);

// DELETE /api/stock-transfer-templates/:templateId - Delete template
stockTransferTemplatesRouter.delete(
  '/:templateId',
  requireAuthenticatedUserMiddleware,
  requirePermission('stock:write'),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const { templateId } = req.params;

      if (!templateId) {
        throw new Error('Template ID is required');
      }

      const result = await templateService.deleteTransferTemplate({
        tenantId: req.currentTenantId,
        templateId,
      });
      return res.status(200).json(createStandardSuccessResponse(result));
    } catch (e) {
      return next(e);
    }
  }
);

// POST /api/stock-transfer-templates/:templateId/duplicate - Duplicate template
stockTransferTemplatesRouter.post(
  '/:templateId/duplicate',
  requireAuthenticatedUserMiddleware,
  requirePermission('stock:write'),
  validateRequestBodyWithZod(DuplicateTemplateBodySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const { templateId } = req.params;
      const { newName } = req.validatedBody as z.infer<typeof DuplicateTemplateBodySchema>;

      if (!templateId) {
        throw new Error('Template ID is required');
      }

      const template = await templateService.duplicateTransferTemplate({
        tenantId: req.currentTenantId,
        userId: req.currentUserId,
        templateId,
        newName,
      });
      return res.status(200).json(createStandardSuccessResponse(template));
    } catch (e) {
      return next(e);
    }
  }
);
