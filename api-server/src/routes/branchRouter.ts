// api-server/src/routes/branchRouter.ts
import { Router } from 'express';
import { z } from 'zod';
import { requireAuthenticatedUserMiddleware } from '../middleware/sessionMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import {
  validateRequestBodyWithZod,
  validateRequestParamsWithZod,
  validateRequestQueryWithZod,
} from '../middleware/zodValidation.js';
import { idempotencyMiddleware } from '../middleware/idempotencyMiddleware.js';
import { assertAuthed } from '../types/assertions.js';
import { createStandardSuccessResponse } from '../utils/standardResponse.js';
import {
  listBranchesForCurrentTenantService,
  createBranchForCurrentTenantService,
  updateBranchForCurrentTenantService,
  deactivateBranchForCurrentTenantService,
  getBranchForCurrentTenantService,
  archiveBranchForCurrentTenantService,
  restoreBranchForCurrentTenantService,
} from '../services/branches/branchService.js';
import { getAuditContext } from '../utils/auditContext.js';
import { getBranchActivityForCurrentTenantService } from '../services/branches/branchActivityService.js'; // <-- NEW
import { serializeEntityTimestamps, serializeActivityLog } from '../services/common/entitySerializer.js';

export const branchRouter = Router();

const slugRegex = /^[a-z0-9-]{3,40}$/;

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursorId: z.string().min(1).optional(),
  q: z.string().min(1).optional(),
  isActive: z.coerce.boolean().optional(),
  archivedFilter: z.enum(['active-only', 'archived-only', 'all']).optional(),
  sortBy: z.enum(['branchName', 'createdAt', 'updatedAt', 'isActive']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  includeTotal: z.coerce.boolean().optional(),
});

const createBodySchema = z.object({
  branchSlug: z.string().regex(slugRegex, 'Slug must be lowercase, numbers, hyphen (3–40 chars)'),
  branchName: z.string().min(1).max(200),
  isActive: z.coerce.boolean().optional(),
});

const updateParamsSchema = z.object({
  branchId: z.string().min(1),
});

const updateBodySchema = z.object({
  branchSlug: z.string().regex(slugRegex).optional(),
  branchName: z.string().min(1).max(200).optional(),
  isActive: z.coerce.boolean().optional(),
});

const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
  occurredFrom: z.string().datetime().optional(),
  occurredTo: z.string().datetime().optional(),
  actorIds: z.string().min(1).optional(), // CSV
  includeFacets: z.coerce.boolean().optional(),
  includeTotal: z.coerce.boolean().optional(),
});

// GET /api/branches
branchRouter.get(
  '/',
  requireAuthenticatedUserMiddleware,
  validateRequestQueryWithZod(listQuerySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const q = req.validatedQuery as z.infer<typeof listQuerySchema>;
      const out = await listBranchesForCurrentTenantService({
        currentTenantId: req.currentTenantId,
        ...(q.limit !== undefined && { limitOptional: q.limit }),
        ...(q.cursorId !== undefined && { cursorIdOptional: q.cursorId }),
        ...(q.q !== undefined && { qOptional: q.q }),
        ...(q.isActive !== undefined && { isActiveOptional: q.isActive }),
        ...(q.archivedFilter !== undefined && { archivedFilterOptional: q.archivedFilter }),
        ...(q.sortBy !== undefined && { sortByOptional: q.sortBy }),
        ...(q.sortDir !== undefined && { sortDirOptional: q.sortDir }),
        ...(q.includeTotal !== undefined && { includeTotalOptional: q.includeTotal }),
      });
      const serialized = {
        ...out,
        items: out.items.map(serializeEntityTimestamps),
      };
      return res.status(200).json(createStandardSuccessResponse(serialized));
    } catch (err) {
      return next(err);
    }
  }
);

// GET /api/branches/:branchId (single) -----
branchRouter.get(
  '/:branchId',
  requireAuthenticatedUserMiddleware,
  validateRequestParamsWithZod(updateParamsSchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const { branchId } = req.validatedParams as z.infer<typeof updateParamsSchema>;
      const branch = await getBranchForCurrentTenantService({
        currentTenantId: req.currentTenantId,
        branchId,
      });
      return res.status(200).json(createStandardSuccessResponse({ branch: serializeEntityTimestamps(branch) }));
    } catch (err) {
      return next(err);
    }
  }
);

// POST /api/branches
branchRouter.post(
  '/',
  requireAuthenticatedUserMiddleware,
  requirePermission('tenant:manage'),
  idempotencyMiddleware(60),
  validateRequestBodyWithZod(createBodySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const ctx = getAuditContext(req);
      const body = req.validatedBody as z.infer<typeof createBodySchema>;
      const created = await createBranchForCurrentTenantService({
        currentTenantId: req.currentTenantId,
        branchSlugInputValue: body.branchSlug,
        branchNameInputValue: body.branchName,
        isActiveInputValue: body.isActive,
        auditContextOptional: {
          actorUserId: ctx.actorUserId ?? null,
          correlationId: ctx.correlationId ?? null,
          ip: ctx.ip ?? null,
          userAgent: ctx.userAgent ?? null,
        },
      });
      return res.status(201).json(createStandardSuccessResponse({ branch: serializeEntityTimestamps(created) }));
    } catch (err) {
      return next(err);
    }
  }
);

// PUT /api/branches/:branchId
branchRouter.put(
  '/:branchId',
  requireAuthenticatedUserMiddleware,
  requirePermission('tenant:manage'),
  idempotencyMiddleware(60),
  validateRequestParamsWithZod(updateParamsSchema),
  validateRequestBodyWithZod(updateBodySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const ctx = getAuditContext(req);
      const { branchId } = req.validatedParams as z.infer<typeof updateParamsSchema>;
      const body = req.validatedBody as z.infer<typeof updateBodySchema>;
      const updated = await updateBranchForCurrentTenantService({
        currentTenantId: req.currentTenantId,
        branchIdPathParam: branchId,
        ...(body.branchSlug !== undefined && { branchSlugInputValueOptional: body.branchSlug }),
        ...(body.branchName !== undefined && { branchNameInputValueOptional: body.branchName }),
        ...(body.isActive !== undefined && { isActiveInputValueOptional: body.isActive }),
        auditContextOptional: ctx,
      });
      return res.status(200).json(createStandardSuccessResponse({ branch: serializeEntityTimestamps(updated) }));
    } catch (err) {
      return next(err);
    }
  }
);

// DELETE /api/branches/:branchId  (archive - soft delete)
branchRouter.delete(
  '/:branchId',
  requireAuthenticatedUserMiddleware,
  requirePermission('tenant:manage'),
  validateRequestParamsWithZod(updateParamsSchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const ctx = getAuditContext(req);
      const { branchId } = req.validatedParams as z.infer<typeof updateParamsSchema>;
      const out = await archiveBranchForCurrentTenantService({
        currentTenantId: req.currentTenantId,
        branchIdPathParam: branchId,
        actorUserId: req.currentUserId,
        auditContextOptional: ctx,
      });
      return res.status(200).json(createStandardSuccessResponse(out));
    } catch (err) {
      return next(err);
    }
  }
);

// POST /api/branches/:branchId/restore
branchRouter.post(
  '/:branchId/restore',
  requireAuthenticatedUserMiddleware,
  requirePermission('tenant:manage'),
  validateRequestParamsWithZod(updateParamsSchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const ctx = getAuditContext(req);
      const { branchId } = req.validatedParams as z.infer<typeof updateParamsSchema>;
      const out = await restoreBranchForCurrentTenantService({
        currentTenantId: req.currentTenantId,
        branchIdPathParam: branchId,
        auditContextOptional: ctx,
      });
      return res.status(200).json(createStandardSuccessResponse(out));
    } catch (err) {
      return next(err);
    }
  }
);

// GET /api/branches/:branchId/activity -----
branchRouter.get(
  '/:branchId/activity',
  requireAuthenticatedUserMiddleware,
  validateRequestParamsWithZod(updateParamsSchema),
  validateRequestQueryWithZod(activityQuerySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const { branchId } = req.validatedParams as z.infer<typeof updateParamsSchema>;
      const { limit, cursor, occurredFrom, occurredTo, actorIds, includeFacets, includeTotal } =
        req.validatedQuery as z.infer<typeof activityQuerySchema>;

      const data = await getBranchActivityForCurrentTenantService({
        currentTenantId: req.currentTenantId,
        branchIdPathParam: branchId,
        ...(limit !== undefined ? { limitOptional: limit } : {}),
        ...(cursor !== undefined ? { cursorOptional: cursor } : {}),
        ...(occurredFrom !== undefined ? { occurredFromOptional: occurredFrom } : {}),
        ...(occurredTo !== undefined ? { occurredToOptional: occurredTo } : {}),
        ...(actorIds
          ? {
              actorIdsOptional: actorIds
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            }
          : {}),
        ...(includeFacets !== undefined ? { includeFacetsOptional: includeFacets } : {}),
        ...(includeTotal !== undefined ? { includeTotalOptional: includeTotal } : {}),
      });

      const serialized = {
        ...data,
        items: data.items.map(serializeActivityLog),
      };
      return res.status(200).json(createStandardSuccessResponse(serialized));
    } catch (err) {
      return next(err);
    }
  }
);
