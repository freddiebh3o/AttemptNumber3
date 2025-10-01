// api-server/src/routes/roleRouter.ts
import { Router } from 'express';
import { z } from 'zod';
import { requireAuthenticatedUserMiddleware } from '../middleware/sessionMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import {
  validateRequestBodyWithZod,
  validateRequestParamsWithZod,
  validateRequestQueryWithZod,
} from '../middleware/zodValidation.js';
import { createStandardSuccessResponse } from '../utils/standardResponse.js';
import {
  listPermissionsService,
  listTenantRolesService,
  createTenantRoleService,
  updateTenantRoleService,
  deleteTenantRoleService,
} from '../services/roleService.js';
import { assertAuthed, assertHasBody, assertHasParams, assertHasQuery } from '../types/assertions.js';
import { createFixedWindowRateLimiterMiddleware } from '../middleware/rateLimiterMiddleware.js';

export const roleRouter = Router();

const rateLimiter = createFixedWindowRateLimiterMiddleware({
  windowSeconds: 60,
  limit: 60,
  bucketScope: 'ip+session',
});
roleRouter.use(rateLimiter);

const csvToArray = z
  .string()
  .transform((s) =>
    s
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
  );

// GET /api/permissions
roleRouter.get(
  '/permissions',
  requireAuthenticatedUserMiddleware,
  requirePermission('roles:manage'),
  async (req, res, next) => {
    try {
      const permissions = await listPermissionsService();
      return res.status(200).json(createStandardSuccessResponse({ permissions }));
    } catch (err) {
      return next(err);
    }
  }
);

const boolFromString = z.union([z.literal("true"), z.literal("false")]).transform(v => v === "true");

// GET /api/roles
const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursorId: z.string().min(1).optional(),
  q: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  isSystem: z.coerce.boolean().optional(),
  createdAtFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  createdAtTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  updatedAtFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  updatedAtTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'isSystem']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  includeTotal: z.coerce.boolean().optional(),
  permissionKeys: csvToArray.optional(),              // e.g. "products:read,uploads:write"
  permMatch: z.enum(['any', 'all']).optional(),       // defaults to 'any' if omitted
});

roleRouter.get(
  '/roles',
  requireAuthenticatedUserMiddleware,
  requirePermission('roles:manage'),
  validateRequestQueryWithZod(listQuerySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      assertHasQuery<z.infer<typeof listQuerySchema>>(req);

      const result = await listTenantRolesService({
        currentTenantId: req.currentTenantId,
        ...(req.validatedQuery.limit !== undefined && { limitOptional: req.validatedQuery.limit }),
        ...(req.validatedQuery.cursorId !== undefined && { cursorIdOptional: req.validatedQuery.cursorId }),
        ...(req.validatedQuery.q !== undefined && { qOptional: req.validatedQuery.q }),
        ...(req.validatedQuery.name !== undefined && { nameOptional: req.validatedQuery.name }),
        ...(req.validatedQuery.isSystem !== undefined && { isSystemOptional: req.validatedQuery.isSystem }),
        ...(req.validatedQuery.createdAtFrom !== undefined && { createdAtFromOptional: req.validatedQuery.createdAtFrom }),
        ...(req.validatedQuery.createdAtTo !== undefined && { createdAtToOptional: req.validatedQuery.createdAtTo }),
        ...(req.validatedQuery.updatedAtFrom !== undefined && { updatedAtFromOptional: req.validatedQuery.updatedAtFrom }),
        ...(req.validatedQuery.updatedAtTo !== undefined && { updatedAtToOptional: req.validatedQuery.updatedAtTo }),
        ...(req.validatedQuery.sortBy !== undefined && { sortByOptional: req.validatedQuery.sortBy }),
        ...(req.validatedQuery.sortDir !== undefined && { sortDirOptional: req.validatedQuery.sortDir }),
        ...(req.validatedQuery.includeTotal !== undefined && { includeTotalOptional: req.validatedQuery.includeTotal }),
        ...(req.validatedQuery.permissionKeys !== undefined && { permissionKeysOptional: req.validatedQuery.permissionKeys }),
        ...(req.validatedQuery.permMatch !== undefined && { permMatchOptional: req.validatedQuery.permMatch }),
      });

      return res.status(200).json(createStandardSuccessResponse(result));
    } catch (err) {
      return next(err);
    }
  }
);

// POST /api/roles
const createBodySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  permissionKeys: z.array(z.string()).min(0),
});

roleRouter.post(
  '/roles',
  requireAuthenticatedUserMiddleware,
  requirePermission('roles:manage'),
  validateRequestBodyWithZod(createBodySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      assertHasBody<z.infer<typeof createBodySchema>>(req);

      const role = await createTenantRoleService({
        currentTenantId: req.currentTenantId,
        name: req.validatedBody.name,
        description: req.validatedBody.description ?? null,
        permissionKeys: req.validatedBody.permissionKeys,
      });

      return res.status(201).json(createStandardSuccessResponse({ role }));
    } catch (err) {
      return next(err);
    }
  }
);

// PUT /api/roles/:roleId
const roleIdParams = z.object({ roleId: z.string().min(1) });
const updateBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  permissionKeys: z.array(z.string()).min(0).optional(),
});

roleRouter.put(
  '/roles/:roleId',
  requireAuthenticatedUserMiddleware,
  requirePermission('roles:manage'),
  validateRequestParamsWithZod(roleIdParams),
  validateRequestBodyWithZod(updateBodySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      assertHasParams<z.infer<typeof roleIdParams>>(req);
      assertHasBody<z.infer<typeof updateBodySchema>>(req);

      const role = await updateTenantRoleService({
        currentTenantId: req.currentTenantId,
        roleId: req.validatedParams.roleId,
        ...(req.validatedBody.name !== undefined && { nameOptional: req.validatedBody.name }),
        ...(req.validatedBody.description !== undefined && { descriptionOptional: req.validatedBody.description }),
        ...(req.validatedBody.permissionKeys !== undefined && { permissionKeysOptional: req.validatedBody.permissionKeys }),
      });

      return res.status(200).json(createStandardSuccessResponse({ role }));
    } catch (err) {
      return next(err);
    }
  }
);

// DELETE /api/roles/:roleId
roleRouter.delete(
  '/roles/:roleId',
  requireAuthenticatedUserMiddleware,
  requirePermission('roles:manage'),
  validateRequestParamsWithZod(roleIdParams),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      assertHasParams<z.infer<typeof roleIdParams>>(req);

      const result = await deleteTenantRoleService({
        currentTenantId: req.currentTenantId,
        roleId: req.validatedParams.roleId,
      });

      return res.status(200).json(createStandardSuccessResponse(result));
    } catch (err) {
      return next(err);
    }
  }
);
