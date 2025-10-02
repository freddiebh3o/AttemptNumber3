// api-server/src/routes/stockRouter.ts
import { Router } from 'express';
import { z } from 'zod';
import {
  validateRequestBodyWithZod,
  validateRequestQueryWithZod,
} from '../middleware/zodValidation.js';
import { requireAuthenticatedUserMiddleware } from '../middleware/sessionMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { idempotencyMiddleware } from '../middleware/idempotencyMiddleware.js';
import { assertAuthed } from '../types/assertions.js';
import { createStandardSuccessResponse } from '../utils/standardResponse.js';
import {
  receiveStock,
  adjustStock,
  consumeStock,
  getStockLevelsForProductService,
} from '../services/stockService.js';

export const stockRouter = Router();

const isoDate = z.string().datetime().optional();

const receiveBodySchema = z.object({
  branchId: z.string().min(1),
  productId: z.string().min(1),
  qty: z.coerce.number().int().positive(),
  unitCostCents: z.coerce.number().int().min(0).nullable().optional(),
  sourceRef: z.string().max(200).nullable().optional(),
  reason: z.string().max(500).nullable().optional(),
  occurredAt: isoDate,
});

const adjustBodySchema = z.object({
  branchId: z.string().min(1),
  productId: z.string().min(1),
  qtyDelta: z.coerce.number().int().refine((v) => v !== 0, 'qtyDelta must be non-zero'),
  reason: z.string().max(500).nullable().optional(),
  occurredAt: isoDate,
});

const consumeBodySchema = z.object({
  branchId: z.string().min(1),
  productId: z.string().min(1),
  qty: z.coerce.number().int().positive(),
  reason: z.string().max(500).nullable().optional(),
  occurredAt: isoDate,
});

const levelsQuerySchema = z.object({
  branchId: z.string().min(1),
  productId: z.string().min(1),
});

// POST /api/stock/receive
stockRouter.post(
  '/receive',
  requireAuthenticatedUserMiddleware,
  requirePermission('stock:write'),
  idempotencyMiddleware(60),
  validateRequestBodyWithZod(receiveBodySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const {
        branchId,
        productId,
        qty,
        unitCostCents,
        sourceRef,
        reason,
        occurredAt,
      } = req.validatedBody as z.infer<typeof receiveBodySchema>;

      const out = await receiveStock(
        { currentTenantId: req.currentTenantId, currentUserId: req.currentUserId },
        {
          branchId,
          productId,
          qty,
          ...(unitCostCents !== undefined ? { unitCostCents } : {}),
          ...(sourceRef !== undefined ? { sourceRef } : {}),
          ...(reason !== undefined ? { reason } : {}),
          ...(occurredAt !== undefined ? { occurredAt } : {}),
        }
      );

      return res.status(201).json(createStandardSuccessResponse(out));
    } catch (err) {
      return next(err);
    }
  }
);

// POST /api/stock/adjust
stockRouter.post(
  '/adjust',
  requireAuthenticatedUserMiddleware,
  requirePermission('stock:write'),
  idempotencyMiddleware(60),
  validateRequestBodyWithZod(adjustBodySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const { branchId, productId, qtyDelta, reason, occurredAt } =
        req.validatedBody as z.infer<typeof adjustBodySchema>;

      const out = await adjustStock(
        { currentTenantId: req.currentTenantId, currentUserId: req.currentUserId },
        {
          branchId,
          productId,
          qtyDelta,
          ...(reason !== undefined ? { reason } : {}),
          ...(occurredAt !== undefined ? { occurredAt } : {}),
        }
      );

      return res.status(200).json(createStandardSuccessResponse(out));
    } catch (err) {
      return next(err);
    }
  }
);

// POST /api/stock/consume
stockRouter.post(
  '/consume',
  requireAuthenticatedUserMiddleware,
  requirePermission('stock:write'),
  idempotencyMiddleware(60),
  validateRequestBodyWithZod(consumeBodySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const { branchId, productId, qty, reason, occurredAt } =
        req.validatedBody as z.infer<typeof consumeBodySchema>;

      const out = await consumeStock(
        { currentTenantId: req.currentTenantId, currentUserId: req.currentUserId },
        {
          branchId,
          productId,
          qty,
          ...(reason !== undefined ? { reason } : {}),
          ...(occurredAt !== undefined ? { occurredAt } : {}),
        }
      );

      return res.status(200).json(createStandardSuccessResponse(out));
    } catch (err) {
      return next(err);
    }
  }
);

// GET /api/stock/levels
stockRouter.get(
  '/levels',
  requireAuthenticatedUserMiddleware,
  requirePermission('stock:read'),
  validateRequestQueryWithZod(levelsQuerySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const { branchId, productId } = req.validatedQuery as z.infer<typeof levelsQuerySchema>;

      const result = await getStockLevelsForProductService({
        currentTenantId: req.currentTenantId,
        branchId,
        productId,
      });

      return res.status(200).json(createStandardSuccessResponse(result));
    } catch (err) {
      return next(err);
    }
  }
);
