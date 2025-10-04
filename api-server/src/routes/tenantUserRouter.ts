// api-server/src/routes/tenantUserRouter.ts
import { Router } from 'express';
import { z } from 'zod';
import {
  validateRequestBodyWithZod,
  validateRequestParamsWithZod,
  validateRequestQueryWithZod,
} from '../middleware/zodValidation.js';
import { requireAuthenticatedUserMiddleware } from '../middleware/sessionMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { idempotencyMiddleware } from '../middleware/idempotencyMiddleware.js';
import { assertAuthed } from '../types/assertions.js';
import { createStandardSuccessResponse } from '../utils/standardResponse.js';
import {
  listUsersForCurrentTenantService,
  getUserForCurrentTenantService,
  createOrAttachUserToTenantService,
  updateTenantUserService,
  removeUserFromTenantService,
} from '../services/tenantUserService.js';

// Minimal helper to pass audit context into services
function getAuditContext(req: any) {
  return {
    actorUserId: req.currentUserId ?? null,
    correlationId: (req as any).correlationId ?? null,
    ip: req.ip ?? null,
    userAgent: req.headers?.['user-agent'] ?? null,
  };
}

export const tenantUserRouter = Router();

// ---- Schemas ----
const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursorId: z.string().min(1).optional(),
  q: z.string().min(1).optional(),
  roleId: z.string().min(1).optional(),
  roleName: z.string().min(1).optional(),
  createdAtFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  createdAtTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  updatedAtFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  updatedAtTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'userEmailAddress', 'role']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  includeTotal: z.coerce.boolean().optional(),
});

const userIdParams = z.object({ userId: z.string().min(1) });

const createBody = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(200),
  roleId: z.string().min(1),
  branchIds: z.array(z.string().min(1)).optional(),
});

const updateBody = z.object({
  email: z.string().email().max(320).optional(),
  password: z.string().min(8).max(200).optional(),
  roleId: z.string().min(1).optional(),
  branchIds: z.array(z.string().min(1)).optional(),
});

// ---- Routes ----

// GET /api/tenant-users
tenantUserRouter.get(
  '/',
  requireAuthenticatedUserMiddleware,
  requirePermission('users:manage'),
  validateRequestQueryWithZod(listQuerySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const q = req.validatedQuery as z.infer<typeof listQuerySchema>;

      const out = await listUsersForCurrentTenantService({
        currentTenantId: req.currentTenantId,
        ...(q.limit !== undefined && { limitOptional: q.limit }),
        ...(q.cursorId !== undefined && { cursorIdOptional: q.cursorId }),
        ...(q.q !== undefined && { qOptional: q.q }),
        ...(q.roleId !== undefined && { roleIdOptional: q.roleId }),
        ...(q.roleName !== undefined && { roleNameOptional: q.roleName }),
        ...(q.createdAtFrom !== undefined && { createdAtFromOptional: q.createdAtFrom }),
        ...(q.createdAtTo !== undefined && { createdAtToOptional: q.createdAtTo }),
        ...(q.updatedAtFrom !== undefined && { updatedAtFromOptional: q.updatedAtFrom }),
        ...(q.updatedAtTo !== undefined && { updatedAtToOptional: q.updatedAtTo }),
        ...(q.sortBy !== undefined && { sortByOptional: q.sortBy }),
        ...(q.sortDir !== undefined && { sortDirOptional: q.sortDir }),
        ...(q.includeTotal !== undefined && { includeTotalOptional: q.includeTotal }),
      });

      return res.status(200).json(createStandardSuccessResponse(out));
    } catch (err) {
      return next(err);
    }
  }
);

// GET /api/tenant-users/:userId
tenantUserRouter.get(
  '/:userId',
  requireAuthenticatedUserMiddleware,
  requirePermission('users:manage'),
  validateRequestParamsWithZod(userIdParams),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const { userId } = req.validatedParams as z.infer<typeof userIdParams>;
      const out = await getUserForCurrentTenantService({
        currentTenantId: req.currentTenantId,
        targetUserId: userId,
      });
      return res.status(200).json(createStandardSuccessResponse({ user: out }));
    } catch (err) {
      return next(err);
    }
  }
);

// POST /api/tenant-users  (idempotent)
tenantUserRouter.post(
  '/',
  requireAuthenticatedUserMiddleware,
  requirePermission('users:manage'),
  idempotencyMiddleware(60),
  validateRequestBodyWithZod(createBody),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const body = req.validatedBody as z.infer<typeof createBody>;

      const out = await createOrAttachUserToTenantService({
        currentTenantId: req.currentTenantId,
        email: body.email,
        password: body.password,
        roleId: body.roleId,
        ...(body.branchIds !== undefined ? { branchIdsOptional: body.branchIds } : {}),
        auditContextOptional: getAuditContext(req),
      });

      return res.status(201).json(createStandardSuccessResponse({ user: out }));
    } catch (err) {
      return next(err);
    }
  }
);

// PUT /api/tenant-users/:userId  (idempotent)
tenantUserRouter.put(
  '/:userId',
  requireAuthenticatedUserMiddleware,
  requirePermission('users:manage'),
  idempotencyMiddleware(60),
  validateRequestParamsWithZod(userIdParams),
  validateRequestBodyWithZod(updateBody),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const { userId } = req.validatedParams as z.infer<typeof userIdParams>;
      const body = req.validatedBody as z.infer<typeof updateBody>;

      const out = await updateTenantUserService({
        currentTenantId: req.currentTenantId,
        currentUserId: req.currentUserId,
        targetUserId: userId,
        ...(body.email !== undefined && { newEmailOptional: body.email }),
        ...(body.password !== undefined && { newPasswordOptional: body.password }),
        ...(body.roleId !== undefined && { newRoleIdOptional: body.roleId }),
        ...(body.branchIds !== undefined && { newBranchIdsOptional: body.branchIds }),
        auditContextOptional: getAuditContext(req),
      });

      return res.status(200).json(createStandardSuccessResponse({ user: out }));
    } catch (err) {
      return next(err);
    }
  }
);

// DELETE /api/tenant-users/:userId
tenantUserRouter.delete(
  '/:userId',
  requireAuthenticatedUserMiddleware,
  requirePermission('users:manage'),
  validateRequestParamsWithZod(userIdParams),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const { userId } = req.validatedParams as z.infer<typeof userIdParams>;

      const out = await removeUserFromTenantService({
        currentTenantId: req.currentTenantId,
        currentUserId: req.currentUserId,
        targetUserId: userId,
        auditContextOptional: getAuditContext(req),
      });

      return res.status(200).json(createStandardSuccessResponse(out));
    } catch (err) {
      return next(err);
    }
  }
);
