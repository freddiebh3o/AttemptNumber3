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

export const productRouter = Router();

const productSkuRegex = /^[A-Z0-9-]{3,40}$/;

const productRateLimiterMiddleware = createFixedWindowRateLimiterMiddleware({
  windowSeconds: 60,
  limit: 60,
  bucketScope: "ip+session",
});

productRouter.use(productRateLimiterMiddleware)

// Schemas
const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursorId: z.string().min(1).optional(),
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
      const currentTenantId: string = (request as any).currentTenantId;
      const { limit, cursorId } = (request as any).validatedQuery as z.infer<
        typeof listQuerySchema
      >;

      const products = await listProductsForCurrentTenantService({
        currentTenantId,
        ...(limit !== undefined && { limitOptional: limit }),
        ...(cursorId !== undefined && { cursorIdOptional: cursorId }),
      });

      return response
        .status(200)
        .json(createStandardSuccessResponse({ products }));
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
      const currentTenantId: string = (request as any).currentTenantId;
      const { productName, productSku, productPriceCents } = (request as any)
        .validatedBody as z.infer<typeof createBodySchema>;

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
      const currentTenantId: string = (request as any).currentTenantId;
      const { productId } = (request as any).validatedParams as z.infer<
        typeof updateParamsSchema
      >;
      const { productName, productPriceCents, currentEntityVersion } = (
        request as any
      ).validatedBody as z.infer<typeof updateBodySchema>;

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
      const currentTenantId: string = (request as any).currentTenantId;
      const { productId } = (request as any).validatedParams as z.infer<
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
