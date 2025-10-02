// api-server/src/routes/tenantUserRouter.ts
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
  listUsersForCurrentTenantService,
  createOrAttachUserToTenantService,
  updateTenantUserService,
  removeUserFromTenantService,
} from "../services/tenantUserService.js";
import {
  assertAuthed,
  assertHasQuery,
  assertHasBody,
  assertHasParams,
} from "../types/assertions.js";

export const tenantUserRouter = Router();

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// Query: support roleId and roleName (contains) filters; sort by roleName (role.name)
const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursorId: z.string().min(1).optional(),

  // filters
  q: z.string().min(1).optional(),
  roleId: z.string().min(1).optional(),
  roleName: z.string().min(1).optional(), // contains filter on role.name
  createdAtFrom: z.string().regex(dateRegex, "Use YYYY-MM-DD").optional(),
  createdAtTo: z.string().regex(dateRegex, "Use YYYY-MM-DD").optional(),
  updatedAtFrom: z.string().regex(dateRegex, "Use YYYY-MM-DD").optional(),
  updatedAtTo: z.string().regex(dateRegex, "Use YYYY-MM-DD").optional(),

  // sort
  sortBy: z
    .enum(["createdAt", "updatedAt", "userEmailAddress", "role"])
    .optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),

  includeTotal: z.coerce.boolean().optional(),
});

tenantUserRouter.get(
  "/",
  requireAuthenticatedUserMiddleware,
  requirePermission("users:manage"),
  validateRequestQueryWithZod(listQuerySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      assertHasQuery<z.infer<typeof listQuerySchema>>(req);

      const {
        limit,
        cursorId,
        q,
        roleId,
        roleName,
        createdAtFrom,
        createdAtTo,
        updatedAtFrom,
        updatedAtTo,
        sortBy,
        sortDir,
        includeTotal,
      } = req.validatedQuery;

      const sortByInternal:
        | "createdAt"
        | "updatedAt"
        | "userEmailAddress"
        | "role"
        | undefined = sortBy
        ? sortBy === "role"
          ? "role"
          : sortBy
        : undefined;

      const result = await listUsersForCurrentTenantService({
        currentTenantId: req.currentTenantId,

        ...(limit !== undefined && { limitOptional: limit }),
        ...(cursorId !== undefined && { cursorIdOptional: cursorId }),
        ...(q !== undefined && { qOptional: q }),

        // filters
        ...(roleId !== undefined && { roleIdOptional: roleId }),
        ...(roleName !== undefined && { roleNameOptional: roleName }),

        // date filters
        ...(createdAtFrom !== undefined && {
          createdAtFromOptional: createdAtFrom,
        }),
        ...(createdAtTo !== undefined && { createdAtToOptional: createdAtTo }),
        ...(updatedAtFrom !== undefined && {
          updatedAtFromOptional: updatedAtFrom,
        }),
        ...(updatedAtTo !== undefined && { updatedAtToOptional: updatedAtTo }),

        // sort
        ...(sortByInternal !== undefined && { sortByOptional: sortByInternal }),
        ...(sortDir !== undefined && { sortDirOptional: sortDir }),

        // totals
        ...(includeTotal !== undefined && {
          includeTotalOptional: includeTotal,
        }),
      });

      return res.status(200).json(createStandardSuccessResponse(result));
    } catch (err) {
      return next(err);
    }
  }
);

// POST /api/tenant-users
const createBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  roleId: z.string(), // roleId now required
});

tenantUserRouter.post(
  "/",
  requireAuthenticatedUserMiddleware,
  requirePermission("users:manage"),
  validateRequestBodyWithZod(createBodySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      assertHasBody<z.infer<typeof createBodySchema>>(req);

      const { currentTenantId } = req;
      const { email, password, roleId } = req.validatedBody;

      const created = await createOrAttachUserToTenantService({
        currentTenantId,
        email,
        password,
        roleId,
      });

      return res
        .status(201)
        .json(createStandardSuccessResponse({ user: created }));
    } catch (err) {
      return next(err);
    }
  }
);

// PUT /api/tenant-users/:userId
const updateParamsSchema = z.object({ userId: z.string().min(1) });
const updateBodySchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  roleId: z.string().optional(), // roleId is optional on update
});

tenantUserRouter.put(
  "/:userId",
  requireAuthenticatedUserMiddleware,
  requirePermission("users:manage"),
  validateRequestParamsWithZod(updateParamsSchema),
  validateRequestBodyWithZod(updateBodySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      assertHasParams<z.infer<typeof updateParamsSchema>>(req);
      assertHasBody<z.infer<typeof updateBodySchema>>(req);

      const { currentTenantId, currentUserId } = req;
      const { userId } = req.validatedParams;
      const { email, password, roleId } = req.validatedBody;

      const updated = await updateTenantUserService({
        currentTenantId,
        currentUserId,
        targetUserId: userId,
        ...(email !== undefined && { newEmailOptional: email }),
        ...(password !== undefined && { newPasswordOptional: password }),
        ...(roleId !== undefined && { newRoleIdOptional: roleId }),
      });

      return res
        .status(200)
        .json(createStandardSuccessResponse({ user: updated }));
    } catch (err) {
      return next(err);
    }
  }
);

// DELETE /api/tenant-users/:userId
tenantUserRouter.delete(
  "/:userId",
  requireAuthenticatedUserMiddleware,
  requirePermission("users:manage"),
  validateRequestParamsWithZod(updateParamsSchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      assertHasParams<z.infer<typeof updateParamsSchema>>(req);

      const { currentTenantId, currentUserId } = req;
      const { userId } = req.validatedParams;

      const result = await removeUserFromTenantService({
        currentTenantId,
        currentUserId,
        targetUserId: userId,
      });

      return res.status(200).json(createStandardSuccessResponse(result));
    } catch (err) {
      return next(err);
    }
  }
);
