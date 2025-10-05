// api-server/src/routes/roleRouter.ts
import { Router } from "express";
import { z } from "zod";
import { requireAuthenticatedUserMiddleware } from "../middleware/sessionMiddleware.js";
import { requirePermission } from "../middleware/permissionMiddleware.js";
import {
  validateRequestBodyWithZod,
  validateRequestParamsWithZod,
  validateRequestQueryWithZod,
} from "../middleware/zodValidation.js";
import { createStandardSuccessResponse } from "../utils/standardResponse.js";
import {
  listPermissionsService,
  listTenantRolesService,
  createTenantRoleService,
  updateTenantRoleService,
  deleteTenantRoleService,
  getTenantRoleService,
} from "../services/role/roleService.js";
import {
  assertAuthed,
  assertHasBody,
  assertHasParams,
  assertHasQuery,
} from "../types/assertions.js";
import { getAuditContext } from "../utils/auditContext.js";
import { getRoleActivityForCurrentTenantService } from "../services/role/roleActivityService.js";

export const roleRouter = Router();

const csvToArray = z.string().transform((s) =>
  s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
);

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursorId: z.string().min(1).optional(),
  q: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  isSystem: z.coerce.boolean().optional(),
  createdAtFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  createdAtTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  updatedAtFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  updatedAtTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  sortBy: z.enum(["name", "createdAt", "updatedAt", "isSystem"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  includeTotal: z.coerce.boolean().optional(),
  permissionKeys: csvToArray.optional(),
  permMatch: z.enum(["any", "all"]).optional(),
});

const createBodySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  permissionKeys: z.array(z.string()).min(0),
});

const roleIdParams = z.object({ roleId: z.string().min(1) });
const updateBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  permissionKeys: z.array(z.string()).min(0).optional(),
});

const activityParamsSchema = z.object({ roleId: z.string().min(1) });
const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
  occurredFrom: z.string().datetime().optional(),
  occurredTo: z.string().datetime().optional(),
  actorIds: z.string().min(1).optional(), // CSV
  includeFacets: z.coerce.boolean().optional(),
  includeTotal: z.coerce.boolean().optional(),
});

const getRoleParams = z.object({ roleId: z.string().min(1) });

// GET /api/permissions
roleRouter.get(
  "/permissions",
  requireAuthenticatedUserMiddleware,
  requirePermission("roles:manage"),
  async (_req, res, next) => {
    try {
      const permissions = await listPermissionsService();
      return res
        .status(200)
        .json(createStandardSuccessResponse({ permissions }));
    } catch (err) {
      return next(err);
    }
  }
);

// GET /api/roles
roleRouter.get(
  "/roles",
  requireAuthenticatedUserMiddleware,
  requirePermission("roles:manage"),
  validateRequestQueryWithZod(listQuerySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      assertHasQuery<z.infer<typeof listQuerySchema>>(req);

      const result = await listTenantRolesService({
        currentTenantId: req.currentTenantId,
        ...(req.validatedQuery.limit !== undefined && {
          limitOptional: req.validatedQuery.limit,
        }),
        ...(req.validatedQuery.cursorId !== undefined && {
          cursorIdOptional: req.validatedQuery.cursorId,
        }),
        ...(req.validatedQuery.q !== undefined && {
          qOptional: req.validatedQuery.q,
        }),
        ...(req.validatedQuery.name !== undefined && {
          nameOptional: req.validatedQuery.name,
        }),
        ...(req.validatedQuery.isSystem !== undefined && {
          isSystemOptional: req.validatedQuery.isSystem,
        }),
        ...(req.validatedQuery.createdAtFrom !== undefined && {
          createdAtFromOptional: req.validatedQuery.createdAtFrom,
        }),
        ...(req.validatedQuery.createdAtTo !== undefined && {
          createdAtToOptional: req.validatedQuery.createdAtTo,
        }),
        ...(req.validatedQuery.updatedAtFrom !== undefined && {
          updatedAtFromOptional: req.validatedQuery.updatedAtFrom,
        }),
        ...(req.validatedQuery.updatedAtTo !== undefined && {
          updatedAtToOptional: req.validatedQuery.updatedAtTo,
        }),
        ...(req.validatedQuery.sortBy !== undefined && {
          sortByOptional: req.validatedQuery.sortBy,
        }),
        ...(req.validatedQuery.sortDir !== undefined && {
          sortDirOptional: req.validatedQuery.sortDir,
        }),
        ...(req.validatedQuery.includeTotal !== undefined && {
          includeTotalOptional: req.validatedQuery.includeTotal,
        }),
        ...(req.validatedQuery.permissionKeys !== undefined && {
          permissionKeysOptional: req.validatedQuery.permissionKeys,
        }),
        ...(req.validatedQuery.permMatch !== undefined && {
          permMatchOptional: req.validatedQuery.permMatch,
        }),
      });

      return res.status(200).json(createStandardSuccessResponse(result));
    } catch (err) {
      return next(err);
    }
  }
);

// POST /api/roles
roleRouter.post(
  "/roles",
  requireAuthenticatedUserMiddleware,
  requirePermission("roles:manage"),
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
        auditContextOptional: getAuditContext(req),
      });

      return res.status(201).json(createStandardSuccessResponse({ role }));
    } catch (err) {
      return next(err);
    }
  }
);

// PUT /api/roles/:roleId
roleRouter.put(
  "/roles/:roleId",
  requireAuthenticatedUserMiddleware,
  requirePermission("roles:manage"),
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
        ...(req.validatedBody.name !== undefined && {
          nameOptional: req.validatedBody.name,
        }),
        ...(req.validatedBody.description !== undefined && {
          descriptionOptional: req.validatedBody.description,
        }),
        ...(req.validatedBody.permissionKeys !== undefined && {
          permissionKeysOptional: req.validatedBody.permissionKeys,
        }),
        auditContextOptional: getAuditContext(req),
      });

      return res.status(200).json(createStandardSuccessResponse({ role }));
    } catch (err) {
      return next(err);
    }
  }
);

// DELETE /api/roles/:roleId
roleRouter.delete(
  "/roles/:roleId",
  requireAuthenticatedUserMiddleware,
  requirePermission("roles:manage"),
  validateRequestParamsWithZod(roleIdParams),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      assertHasParams<z.infer<typeof roleIdParams>>(req);

      const result = await deleteTenantRoleService({
        currentTenantId: req.currentTenantId,
        roleId: req.validatedParams.roleId,
        auditContextOptional: getAuditContext(req),
      });

      return res.status(200).json(createStandardSuccessResponse(result));
    } catch (err) {
      return next(err);
    }
  }
);

// GET /api/roles/:roleId/activity
roleRouter.get(
  "/roles/:roleId/activity",
  requireAuthenticatedUserMiddleware,
  requirePermission("roles:manage"),
  validateRequestParamsWithZod(activityParamsSchema),
  validateRequestQueryWithZod(activityQuerySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);

      const { roleId } = req.validatedParams as z.infer<
        typeof activityParamsSchema
      >;
      const {
        limit,
        cursor,
        occurredFrom,
        occurredTo,
        actorIds,
        includeFacets,
        includeTotal,
      } = req.validatedQuery as z.infer<typeof activityQuerySchema>;

      const data = await getRoleActivityForCurrentTenantService({
        currentTenantId: req.currentTenantId!,
        roleIdPathParam: roleId,
        ...(limit !== undefined ? { limitOptional: limit } : {}),
        ...(cursor !== undefined ? { cursorOptional: cursor } : {}),
        ...(occurredFrom !== undefined
          ? { occurredFromOptional: occurredFrom }
          : {}),
        ...(occurredTo !== undefined ? { occurredToOptional: occurredTo } : {}),
        ...(actorIds
          ? {
              actorIdsOptional: actorIds
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            }
          : {}),
        ...(includeFacets !== undefined
          ? { includeFacetsOptional: includeFacets }
          : {}),
        ...(includeTotal !== undefined
          ? { includeTotalOptional: includeTotal }
          : {}),
      });

      return res.status(200).json(createStandardSuccessResponse(data));
    } catch (err) {
      return next(err);
    }
  }
);

// GET /api/roles/:roleId
roleRouter.get(
  '/roles/:roleId',
  requireAuthenticatedUserMiddleware,
  requirePermission('roles:manage'),
  validateRequestParamsWithZod(getRoleParams),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      assertHasParams<z.infer<typeof getRoleParams>>(req);

      const role = await getTenantRoleService({
        currentTenantId: req.currentTenantId,
        roleId: req.validatedParams.roleId,
      });

      return res.status(200).json(createStandardSuccessResponse({ role }));
    } catch (err) {
      return next(err);
    }
  }
);
