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
  restoreUserMembershipService,
} from '../services/tenantUsers/tenantUserService.js';
import { listTenantUserActivityForUserService } from '../services/tenantUsers/tenantUserActivityService.js';
import { serializeNestedEntity, serializeActivityLog } from '../services/common/entitySerializer.js';

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
  roleIds: z.string().transform(s => s.split(',').map(x => x.trim()).filter(Boolean)).optional(),
  archivedFilter: z.enum(['active-only', 'archived-only', 'all']).optional(),
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
  email: z.string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .max(320, 'Email must be 320 characters or less'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(200, 'Password must be 200 characters or less')
    .optional(),
  roleId: z.string()
    .min(1, 'Role is required')
    .optional(),
  branchIds: z.array(z.string().min(1)).optional(),
});

const updateBody = z.object({
  email: z.string()
    .email('Invalid email format')
    .max(320, 'Email must be 320 characters or less')
    .optional(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(200, 'Password must be 200 characters or less')
    .optional(),
  roleId: z.string()
    .min(1, 'Role is required')
    .optional(),
  branchIds: z.array(z.string().min(1)).optional(),
});

const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().min(1).optional(),
  actorIds: z.string().transform(s => s.split(',').map(x => x.trim()).filter(Boolean)).optional(),
  occurredFrom: z.string().optional(), // accept ISO or YYYY-MM-DD
  occurredTo: z.string().optional(),
  includeFacets: z.coerce.boolean().optional(),
  includeTotal: z.coerce.boolean().optional(),
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
        ...(q.roleIds !== undefined && { roleIdsOptional: q.roleIds }),
        ...(q.archivedFilter !== undefined && { archivedFilterOptional: q.archivedFilter }),
        ...(q.createdAtFrom !== undefined && { createdAtFromOptional: q.createdAtFrom }),
        ...(q.createdAtTo !== undefined && { createdAtToOptional: q.createdAtTo }),
        ...(q.updatedAtFrom !== undefined && { updatedAtFromOptional: q.updatedAtFrom }),
        ...(q.updatedAtTo !== undefined && { updatedAtToOptional: q.updatedAtTo }),
        ...(q.sortBy !== undefined && { sortByOptional: q.sortBy }),
        ...(q.sortDir !== undefined && { sortDirOptional: q.sortDir }),
        ...(q.includeTotal !== undefined && { includeTotalOptional: q.includeTotal }),
      });

      // Serialize timestamps in response
      const serialized = {
        ...out,
        items: out.items.map((item: any) => serializeNestedEntity(item, ['user', 'role'])),
      };

      return res.status(200).json(createStandardSuccessResponse(serialized));
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
      return res.status(200).json(createStandardSuccessResponse({ user: serializeNestedEntity(out, ['user', 'role']) }));
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
        currentUserId: req.currentUserId,
        email: body.email,
        password: body.password ?? '',
        roleId: body.roleId ?? '',
        ...(body.branchIds !== undefined ? { branchIdsOptional: body.branchIds } : {}),
        auditContextOptional: getAuditContext(req),
      });

      return res.status(201).json(createStandardSuccessResponse({ user: serializeNestedEntity(out, ['user', 'role']) }));
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

      return res.status(200).json(createStandardSuccessResponse({ user: serializeNestedEntity(out, ['user', 'role']) }));
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

// POST /api/tenant-users/:userId/restore
tenantUserRouter.post(
  '/:userId/restore',
  requireAuthenticatedUserMiddleware,
  requirePermission('users:manage'),
  validateRequestParamsWithZod(userIdParams),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const { userId } = req.validatedParams as z.infer<typeof userIdParams>;

      const out = await restoreUserMembershipService({
        currentTenantId: req.currentTenantId,
        targetUserId: userId,
        auditContextOptional: getAuditContext(req),
      });

      return res.status(200).json(createStandardSuccessResponse(out));
    } catch (err) {
      return next(err);
    }
  }
);

// GET /api/tenant-users/:userId/activity
tenantUserRouter.get(
  '/:userId/activity',
  requireAuthenticatedUserMiddleware,
  requirePermission('users:manage'),
  validateRequestParamsWithZod(userIdParams),
  validateRequestQueryWithZod(activityQuerySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const { userId } = req.validatedParams as z.infer<typeof userIdParams>;
      const q = req.validatedQuery as z.infer<typeof activityQuerySchema>;

      const out = await listTenantUserActivityForUserService({
        currentTenantId: req.currentTenantId,
        targetUserId: userId,
        ...(q.limit !== undefined && { limitOptional: q.limit }),
        ...(q.cursor !== undefined && { cursorOptional: q.cursor }),
        ...(q.actorIds !== undefined && { actorIdsOptional: q.actorIds }),
        ...(q.occurredFrom !== undefined && { occurredFromOptional: q.occurredFrom }),
        ...(q.occurredTo !== undefined && { occurredToOptional: q.occurredTo }),
        ...(q.includeFacets !== undefined && { includeFacetsOptional: q.includeFacets }),
        ...(q.includeTotal !== undefined && { includeTotalOptional: q.includeTotal }),
      });

      // Serialize activity logs
      const serialized = {
        ...out,
        items: out.items.map((item: any) => serializeActivityLog(item)),
      };

      return res.status(200).json(createStandardSuccessResponse(serialized));
    } catch (err) {
      return next(err);
    }
  }
);

