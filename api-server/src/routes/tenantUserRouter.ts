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

export const tenantUserRouter = Router();

const RoleEnum = z.enum(["OWNER", "ADMIN", "EDITOR", "VIEWER"]);

// GET /api/tenant-users
const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursorId: z.string().min(1).optional(),
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

      const currentTenantId = req.currentTenantId;
      const { limit, cursorId } = req.validatedQuery;

      const result = await listUsersForCurrentTenantService({
        currentTenantId,
        ...(limit !== undefined && { limitOptional: limit }),
        ...(cursorId !== undefined && { cursorIdOptional: cursorId }),
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
