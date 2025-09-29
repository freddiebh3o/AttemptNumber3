// api-server/src/routes/productRouter.ts
import { Router } from "express";
import { z } from "zod";
import { createStandardSuccessResponse } from "../utils/standardResponse.js";
// import { Errors } from '../utils/httpErrors.js'  // ← unused; remove
import {
  validateRequestBodyWithZod,
  validateRequestParamsWithZod,
  validateRequestQueryWithZod,
} from "../middleware/zodValidation.js";
import { requireAuthenticatedUserMiddleware } from "../middleware/sessionMiddleware.js";
import { requireRoleAtLeastMiddleware } from "../middleware/rbacMiddleware.js";
import { idempotencyMiddleware } from "../middleware/idempotencyMiddleware.js";
import {
  listProductsForCurrentTenantService,
  createProductForCurrentTenantService,
  updateProductForCurrentTenantService,
  deleteProductForCurrentTenantService,
} from "../services/productService.js";
import { createFixedWindowRateLimiterMiddleware } from "../middleware/rateLimiterMiddleware.js";
import { assertAuthed } from '../types/assertions.js'

export const productRouter = Router();

const productSkuRegex = /^[A-Z0-9-]{3,40}$/;

const productRateLimiterMiddleware = createFixedWindowRateLimiterMiddleware({
  windowSeconds: 60,
  limit: 60,
  bucketScope: "ip+session",
});

productRouter.use(productRateLimiterMiddleware)

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// Schemas
const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursorId: z.string().min(1).optional(),
  // filters
  q: z.string().min(1).optional(),
  minPriceCents: z.coerce.number().int().min(0).optional(),
  maxPriceCents: z.coerce.number().int().min(0).optional(),
  createdAtFrom: z.string().regex(dateRegex, 'Use YYYY-MM-DD').optional(),
  createdAtTo: z.string().regex(dateRegex, 'Use YYYY-MM-DD').optional(),
  updatedAtFrom: z.string().regex(dateRegex, 'Use YYYY-MM-DD').optional(), // NEW
  updatedAtTo: z.string().regex(dateRegex, 'Use YYYY-MM-DD').optional(),   // NEW
  // sort
  sortBy: z.enum(["createdAt", "updatedAt", "productName", "productPriceCents"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  includeTotal: z.coerce.boolean().optional(),
});

const createBodySchema = z.object({
  productName: z.string().min(1).max(200),
  productSku: z.string().regex(productSkuRegex, 'SKU must be A-Z, 0-9, or hyphen (3-40 chars)'),
  productPriceCents: z.coerce.number().int().min(0),
});

const updateParamsSchema = z.object({
  productId: z.string().min(1),
});

const updateBodySchema = z.object({
  productName: z.string().min(1).max(200).optional(),
  productPriceCents: z.coerce.number().int().min(0).max(1_000_000).optional(),
  currentEntityVersion: z.coerce.number().int().min(1),
});

// GET /api/products
productRouter.get(
  "/",
  requireAuthenticatedUserMiddleware,
  validateRequestQueryWithZod(listQuerySchema),
  async (request, response, next) => {
    try {
      assertAuthed(request);
      const {
        limit,
        cursorId,
        q,
        minPriceCents,
        maxPriceCents,
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
        ...(minPriceCents !== undefined && { minPriceCentsOptional: minPriceCents }),
        ...(maxPriceCents !== undefined && { maxPriceCentsOptional: maxPriceCents }),
        ...(createdAtFrom !== undefined && { createdAtFromOptional: createdAtFrom }),
        ...(createdAtTo !== undefined && { createdAtToOptional: createdAtTo }),
        ...(updatedAtFrom !== undefined && { updatedAtFromOptional: updatedAtFrom }), // NEW
        ...(updatedAtTo !== undefined && { updatedAtToOptional: updatedAtTo }),       // NEW

        ...(sortBy !== undefined && { sortByOptional: sortBy }),
        ...(sortDir !== undefined && { sortDirOptional: sortDir }),
        ...(includeTotal !== undefined && { includeTotalOptional: includeTotal }),
      });

      return response.status(200).json(createStandardSuccessResponse(result));
    } catch (error) {
      return next(error);
    }
  }
);

// POST /api/products  (ADMIN+; idempotent via Idempotency-Key)
productRouter.post(
  "/",
  requireAuthenticatedUserMiddleware,
  requireRoleAtLeastMiddleware("ADMIN"),
  idempotencyMiddleware(60), // 60-minute TTL for idempotency
  validateRequestBodyWithZod(createBodySchema),
  async (request, response, next) => {
    try {
      assertAuthed(request);
      const currentTenantId: string = request.currentTenantId;
      const { productName, productSku, productPriceCents } = request.validatedBody as z.infer<typeof createBodySchema>;

      const createdProduct = await createProductForCurrentTenantService({
        currentTenantId,
        productNameInputValue: productName,
        productSkuInputValue: productSku,
        productPriceCentsInputValue: productPriceCents,
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
  requireRoleAtLeastMiddleware("ADMIN"),
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
      const { productName, productPriceCents, currentEntityVersion } = request.validatedBody as z.infer<typeof updateBodySchema>;

      const updatedProduct = await updateProductForCurrentTenantService({
        currentTenantId,
        productIdPathParam: productId,
        ...(productName !== undefined && {
          productNameInputValue: productName,
        }),
        ...(productPriceCents !== undefined && {
          productPriceCentsInputValue: productPriceCents,
        }),
        currentEntityVersionInputValue: currentEntityVersion,
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
  requireRoleAtLeastMiddleware("ADMIN"),
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
      });
      return response.status(200).json(createStandardSuccessResponse(result));
    } catch (error) {
      return next(error);
    }
  }
);
