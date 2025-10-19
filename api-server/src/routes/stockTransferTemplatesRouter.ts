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
      const body = req.validatedBody as z.infer<typeof CreateTemplateBodySchema>;
      const template = await templateService.createTransferTemplate({
        tenantId: req.currentTenantId,
        userId: req.currentUserId,
        data: {
          name: body.name,
          sourceBranchId: body.sourceBranchId,
          destinationBranchId: body.destinationBranchId,
          items: body.items,
          ...(body.description !== undefined ? { description: body.description } : {}),
        },
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
      const q = req.query.q as string | undefined;
      const sourceBranchId = req.query.sourceBranchId as string | undefined;
      const destinationBranchId = req.query.destinationBranchId as string | undefined;
      const archivedFilter = req.query.archivedFilter as 'active-only' | 'archived-only' | 'all' | undefined;
      const limitStr = req.query.limit as string | undefined;
      const cursor = req.query.cursor as string | undefined;

      const result = await templateService.listTransferTemplates({
        tenantId: req.currentTenantId,
        filters: {
          ...(q !== undefined ? { q } : {}),
          ...(sourceBranchId !== undefined ? { sourceBranchId } : {}),
          ...(destinationBranchId !== undefined ? { destinationBranchId } : {}),
          ...(archivedFilter !== undefined ? { archivedFilter } : {}),
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

      const body = req.validatedBody as z.infer<typeof UpdateTemplateBodySchema>;
      const template = await templateService.updateTransferTemplate({
        tenantId: req.currentTenantId,
        templateId,
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.sourceBranchId !== undefined ? { sourceBranchId: body.sourceBranchId } : {}),
          ...(body.destinationBranchId !== undefined ? { destinationBranchId: body.destinationBranchId } : {}),
          ...(body.items !== undefined ? { items: body.items } : {}),
        },
      });
      return res.status(200).json(createStandardSuccessResponse(template));
    } catch (e) {
      return next(e);
    }
  }
);

// DELETE /api/stock-transfer-templates/:templateId - Archive template (soft delete)
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
        userId: req.currentUserId,
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
        ...(newName !== undefined ? { newName } : {}),
      });
      return res.status(200).json(createStandardSuccessResponse(template));
    } catch (e) {
      return next(e);
    }
  }
);

// POST /api/stock-transfer-templates/:templateId/restore - Restore archived template
stockTransferTemplatesRouter.post(
  '/:templateId/restore',
  requireAuthenticatedUserMiddleware,
  requirePermission('stock:write'),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const { templateId } = req.params;

      if (!templateId) {
        throw new Error('Template ID is required');
      }

      const template = await templateService.restoreTransferTemplate({
        tenantId: req.currentTenantId,
        templateId,
      });
      return res.status(200).json(createStandardSuccessResponse(template));
    } catch (e) {
      return next(e);
    }
  }
);
