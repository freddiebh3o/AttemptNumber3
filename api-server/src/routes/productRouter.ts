// api-server/src/routes/productRouter.ts
import { Router } from "express";
import { z } from "zod";
import { createStandardSuccessResponse } from "../utils/standardResponse.js";
import {
  validateRequestBodyWithZod,
  validateRequestParamsWithZod,
  validateRequestQueryWithZod,
} from "../middleware/zodValidation.js";
import { requireAuthenticatedUserMiddleware } from "../middleware/sessionMiddleware.js";
import { idempotencyMiddleware } from "../middleware/idempotencyMiddleware.js";
import {
  listProductsForCurrentTenantService,
  createProductForCurrentTenantService,
  updateProductForCurrentTenantService,
  deleteProductForCurrentTenantService,
  getProductForCurrentTenantService,
} from "../services/productService.js";
import { assertAuthed } from "../types/assertions.js";
import { requirePermission } from "../middleware/permissionMiddleware.js";
import { getAuditContext } from "../utils/auditContext.js";
import { getProductActivityForCurrentTenantService } from "../services/productActivityService.js";

export const productRouter = Router();

const productSkuRegex = /^[A-Z0-9-]{3,40}$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// Schemas
const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursorId: z.string().min(1).optional(),
  // filters
  q: z.string().min(1).optional(),
  minPricePence: z.coerce.number().int().min(0).optional(),
  maxPricePence: z.coerce.number().int().min(0).optional(),
  createdAtFrom: z.string().regex(dateRegex, "Use YYYY-MM-DD").optional(),
  createdAtTo: z.string().regex(dateRegex, "Use YYYY-MM-DD").optional(),
  updatedAtFrom: z.string().regex(dateRegex, "Use YYYY-MM-DD").optional(),
  updatedAtTo: z.string().regex(dateRegex, "Use YYYY-MM-DD").optional(),
  // sort
  sortBy: z
    .enum(["createdAt", "updatedAt", "productName", "productPricePence"])
    .optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  includeTotal: z.coerce.boolean().optional(),
});

const createBodySchema = z.object({
  productName: z.string().min(1).max(200),
  productSku: z
    .string()
    .regex(
      productSkuRegex,
      "SKU must be A-Z, 0-9, or hyphen (3-40 chars)"
    ),
  productPricePence: z.coerce.number().int().min(0),
});

const updateParamsSchema = z.object({
  productId: z.string().min(1),
});

const updateBodySchema = z.object({
  productName: z.string().min(1).max(200).optional(),
  productPricePence: z.coerce.number().int().min(0).max(1_000_000).optional(),
  currentEntityVersion: z.coerce.number().int().min(1),
});

const getParamsSchema = z.object({ productId: z.string().min(1) });

const activityParamsSchema = z.object({ productId: z.string().min(1) });
const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  // allow undefined (omit) and any non-empty string; client omits for first page anyway
  cursor: z.string().optional(),
  occurredFrom: z.string().datetime().optional(),
  occurredTo: z.string().datetime().optional(),
  type: z.enum(["all", "audit", "ledger"]).optional(),
  actorIds: z.string().min(1).optional(), // CSV of userIds
  includeFacets: z.coerce.boolean().optional(),
  includeTotal: z.coerce.boolean().optional(), // NEW: expose totals
});

// GET /api/products/:productId
productRouter.get(
  "/:productId",
  requireAuthenticatedUserMiddleware,
  requirePermission("products:read"),
  validateRequestParamsWithZod(getParamsSchema),
  async (request, response, next) => {
    try {
      assertAuthed(request);
      const currentTenantId: string = request.currentTenantId;
      const { productId } = request.validatedParams as z.infer<
        typeof getParamsSchema
      >;

      const product = await getProductForCurrentTenantService({
        currentTenantId,
        productIdPathParam: productId,
      });

      return response
        .status(200)
        .json(createStandardSuccessResponse({ product }));
    } catch (error) {
      return next(error);
    }
  }
);

// GET /api/products
productRouter.get(
  "/",
  requireAuthenticatedUserMiddleware,
  requirePermission("products:read"),
  validateRequestQueryWithZod(listQuerySchema),
  async (request, response, next) => {
    try {
      assertAuthed(request);
      const {
        limit,
        cursorId,
        q,
        minPricePence,
        maxPricePence,
        createdAtFrom,
        createdAtTo,
        updatedAtFrom,
        updatedAtTo,
        sortBy,
        sortDir,
        includeTotal,
      } = request.validatedQuery as z.infer<typeof listQuerySchema>;

      const result = await listProductsForCurrentTenantService({
        currentTenantId: request.currentTenantId!,
        ...(limit !== undefined && { limitOptional: limit }),
        ...(cursorId !== undefined && { cursorIdOptional: cursorId }),

        ...(q !== undefined && { qOptional: q }),
        ...(minPricePence !== undefined && {
          minPricePenceOptional: minPricePence,
        }),
        ...(maxPricePence !== undefined && {
          maxPricePenceOptional: maxPricePence,
        }),
        ...(createdAtFrom !== undefined && {
          createdAtFromOptional: createdAtFrom,
        }),
        ...(createdAtTo !== undefined && {
          createdAtToOptional: createdAtTo,
        }),
        ...(updatedAtFrom !== undefined && {
          updatedAtFromOptional: updatedAtFrom,
        }),
        ...(updatedAtTo !== undefined && { updatedAtToOptional: updatedAtTo }),

        ...(sortBy !== undefined && { sortByOptional: sortBy }),
        ...(sortDir !== undefined && { sortDirOptional: sortDir }),
        ...(includeTotal !== undefined && { includeTotalOptional: includeTotal }),
      });

      return response
        .status(200)
        .json(createStandardSuccessResponse(result));
    } catch (error) {
      return next(error);
    }
  }
);

// POST /api/products  (ADMIN+; idempotent via Idempotency-Key)
productRouter.post(
  "/",
  requireAuthenticatedUserMiddleware,
  requirePermission("products:write"),
  idempotencyMiddleware(60),
  validateRequestBodyWithZod(createBodySchema),
  async (request, response, next) => {
    try {
      assertAuthed(request);
      const currentTenantId: string = request.currentTenantId;
      const { productName, productSku, productPricePence } =
        request.validatedBody as z.infer<typeof createBodySchema>;

      const createdProduct = await createProductForCurrentTenantService({
        currentTenantId,
        productNameInputValue: productName,
        productSkuInputValue: productSku,
        productPricePenceInputValue: productPricePence,
        auditContextOptional: getAuditContext(request),
      });
      return response
        .status(201)
        .json(createStandardSuccessResponse({ product: createdProduct }));
    } catch (error) {
      return next(error);
    }
  }
);

// PUT /api/products/:productId  (ADMIN+; optimistic concurrency)
productRouter.put(
  "/:productId",
  requireAuthenticatedUserMiddleware,
  requirePermission("products:write"),
  idempotencyMiddleware(60),
  validateRequestParamsWithZod(updateParamsSchema),
  validateRequestBodyWithZod(updateBodySchema),
  async (request, response, next) => {
    try {
      assertAuthed(request);
      const currentTenantId: string = request.currentTenantId;
      const { productId } = request.validatedParams as z.infer<
        typeof updateParamsSchema
      >;
      const { productName, productPricePence, currentEntityVersion } =
        request.validatedBody as z.infer<typeof updateBodySchema>;

      const updatedProduct = await updateProductForCurrentTenantService({
        currentTenantId,
        productIdPathParam: productId,
        ...(productName !== undefined && { productNameInputValue: productName }),
        ...(productPricePence !== undefined && {
          productPricePenceInputValue: productPricePence,
        }),
        currentEntityVersionInputValue: currentEntityVersion,
        auditContextOptional: getAuditContext(request),
      });

      return response
        .status(200)
        .json(createStandardSuccessResponse({ product: updatedProduct }));
    } catch (error) {
      return next(error);
    }
  }
);

// DELETE /api/products/:productId  (ADMIN+)
productRouter.delete(
  "/:productId",
  requireAuthenticatedUserMiddleware,
  requirePermission("products:write"),
  validateRequestParamsWithZod(updateParamsSchema),
  async (request, response, next) => {
    try {
      assertAuthed(request);
      const currentTenantId: string = request.currentTenantId;
      const { productId } = request.validatedParams as z.infer<
        typeof updateParamsSchema
      >;

      const result = await deleteProductForCurrentTenantService({
        currentTenantId,
        productIdPathParam: productId,
        auditContextOptional: getAuditContext(request),
      });
      return response
        .status(200)
        .json(createStandardSuccessResponse(result));
    } catch (error) {
      return next(error);
    }
  }
);

// GET /api/products/:productId/activity
productRouter.get(
  "/:productId/activity",
  requireAuthenticatedUserMiddleware,
  requirePermission("products:read"),
  validateRequestParamsWithZod(activityParamsSchema),
  validateRequestQueryWithZod(activityQuerySchema),
  async (request, response, next) => {
    try {
      assertAuthed(request);
      const { productId } = request.validatedParams as z.infer<
        typeof activityParamsSchema
      >;
      const {
        limit,
        cursor,
        occurredFrom,
        occurredTo,
        type,
        actorIds,
        includeFacets,
        includeTotal,
      } = request.validatedQuery as z.infer<typeof activityQuerySchema>;

      const data = await getProductActivityForCurrentTenantService({
        currentTenantId: request.currentTenantId!,
        productIdPathParam: productId,
        ...(limit !== undefined ? { limitOptional: limit } : {}),
        ...(cursor !== undefined ? { cursorOptional: cursor } : {}),
        ...(occurredFrom !== undefined ? { occurredFromOptional: occurredFrom } : {}),
        ...(occurredTo !== undefined ? { occurredToOptional: occurredTo } : {}),
        ...(type !== undefined ? { typeOptional: type } : {}),
        ...(actorIds
          ? {
              actorIdsOptional: actorIds
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            }
          : {}),
        ...(includeFacets !== undefined ? { includeFacetsOptional: includeFacets } : {}),
        ...(includeTotal !== undefined ? { includeTotalOptional: includeTotal } : {}),
      });

      return response.status(200).json(createStandardSuccessResponse(data));
    } catch (error) {
      return next(error);
    }
  }
);
