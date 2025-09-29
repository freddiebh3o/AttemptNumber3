// api-server/src/routes/tenantUserRouter.ts
import { Router } from "express";
import { z } from "zod";
import { requireAuthenticatedUserMiddleware } from "../middleware/sessionMiddleware.js";
import { requireRoleAtLeastMiddleware } from "../middleware/rbacMiddleware.js";
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
import { assertAuthed, assertHasQuery, assertHasBody, assertHasParams } from "../types/assertions.js";
import { createFixedWindowRateLimiterMiddleware } from "../middleware/rateLimiterMiddleware.js";

export const tenantUserRouter = Router();


const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const tenantUsersRateLimiter = createFixedWindowRateLimiterMiddleware({
  windowSeconds: 60,
  limit: 60,
  bucketScope: "ip+session",
});

tenantUserRouter.use(tenantUsersRateLimiter);

const RoleEnum = z.enum(["OWNER", "ADMIN", "EDITOR", "VIEWER"]);

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursorId: z.string().min(1).optional(),
  // filters
  q: z.string().min(1).optional(),
  roleName: RoleEnum.optional(),
  createdAtFrom: z.string().regex(dateRegex, 'Use YYYY-MM-DD').optional(),
  createdAtTo: z.string().regex(dateRegex, 'Use YYYY-MM-DD').optional(),
  updatedAtFrom: z.string().regex(dateRegex, 'Use YYYY-MM-DD').optional(),
  updatedAtTo: z.string().regex(dateRegex, 'Use YYYY-MM-DD').optional(),
  // sort
  sortBy: z.enum(["createdAt", "updatedAt", "userEmailAddress", "roleName"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  includeTotal: z.coerce.boolean().optional(),
});

tenantUserRouter.get(
  "/",
  requireAuthenticatedUserMiddleware,
  requireRoleAtLeastMiddleware("ADMIN"),
  validateRequestQueryWithZod(listQuerySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      assertHasQuery<z.infer<typeof listQuerySchema>>(req);

      const {
        limit, cursorId, q, roleName,
        createdAtFrom, createdAtTo, updatedAtFrom, updatedAtTo,
        sortBy, sortDir, includeTotal,
      } = req.validatedQuery;

      const result = await listUsersForCurrentTenantService({
        currentTenantId: req.currentTenantId,
        ...(limit !== undefined && { limitOptional: limit }),
        ...(cursorId !== undefined && { cursorIdOptional: cursorId }),
        ...(q !== undefined && { qOptional: q }),
        ...(roleName !== undefined && { roleNameOptional: roleName }),
        ...(createdAtFrom !== undefined && { createdAtFromOptional: createdAtFrom }),
        ...(createdAtTo !== undefined && { createdAtToOptional: createdAtTo }),
        ...(updatedAtFrom !== undefined && { updatedAtFromOptional: updatedAtFrom }),
        ...(updatedAtTo !== undefined && { updatedAtToOptional: updatedAtTo }),
        ...(sortBy !== undefined && { sortByOptional: sortBy }),
        ...(sortDir !== undefined && { sortDirOptional: sortDir }),
        ...(includeTotal !== undefined && { includeTotalOptional: includeTotal }),
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
  roleName: RoleEnum,
});

tenantUserRouter.post(
  "/",
  requireAuthenticatedUserMiddleware,
  requireRoleAtLeastMiddleware("ADMIN"),
  validateRequestBodyWithZod(createBodySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      assertHasBody<z.infer<typeof createBodySchema>>(req);

      const { currentTenantId } = req;
      const { email, password, roleName } = req.validatedBody;

      const created = await createOrAttachUserToTenantService({
        currentTenantId,
        email,
        password,
        roleName,
      });

      return res.status(201).json(createStandardSuccessResponse({ user: created }));
    } catch (err) {
      return next(err);
    }
  }
);

//PUT /api/tenant-users/:userId
const updateParamsSchema = z.object({ userId: z.string().min(1) });
const updateBodySchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  roleName: RoleEnum.optional(),
});

tenantUserRouter.put(
  "/:userId",
  requireAuthenticatedUserMiddleware,
  requireRoleAtLeastMiddleware("ADMIN"),
  validateRequestParamsWithZod(updateParamsSchema),
  validateRequestBodyWithZod(updateBodySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      assertHasParams<z.infer<typeof updateParamsSchema>>(req);
      assertHasBody<z.infer<typeof updateBodySchema>>(req);

      const { currentTenantId, currentUserId } = req;
      const { userId } = req.validatedParams;
      const { email, password, roleName } = req.validatedBody;

      const updated = await updateTenantUserService({
        currentTenantId,
        currentUserId,
        targetUserId: userId,
        ...(email !== undefined && { newEmailOptional: email }),
        ...(password !== undefined && { newPasswordOptional: password }),
        ...(roleName !== undefined && { newRoleNameOptional: roleName }),
      });

      return res.status(200).json(createStandardSuccessResponse({ user: updated }));
    } catch (err) {
      return next(err);
    }
  }
);

// DELETE /api/tenant-users/:userId
tenantUserRouter.delete(
  "/:userId",
  requireAuthenticatedUserMiddleware,
  requireRoleAtLeastMiddleware("ADMIN"),
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
