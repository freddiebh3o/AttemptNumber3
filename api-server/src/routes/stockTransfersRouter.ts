import { Router } from 'express';
import { z } from 'zod';
import { validateRequestBodyWithZod } from '../middleware/zodValidation.js';
import { requireAuthenticatedUserMiddleware } from '../middleware/sessionMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { assertAuthed } from '../types/assertions.js';
import { createStandardSuccessResponse } from '../utils/standardResponse.js';
import * as transferService from '../services/stockTransfers/stockTransferService.js';
import * as approvalEvaluationService from '../services/stockTransfers/approvalEvaluationService.js';
import { getAuditContext } from '../utils/auditContext.js';

export const stockTransfersRouter = Router();

// Validation schemas (match OpenAPI)
const CreateTransferBodySchema = z.object({
  sourceBranchId: z.string(),
  destinationBranchId: z.string(),
  requestNotes: z.string().max(1000).optional(),
  orderNotes: z.string().max(2000).optional(),
  expectedDeliveryDate: z.string().datetime().optional(),
  priority: z.enum(['URGENT', 'HIGH', 'NORMAL', 'LOW']).optional(),
  initiationType: z.enum(['PUSH', 'PULL']).optional(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        qtyRequested: z.number().int().min(1),
      })
    )
    .min(1),
});

const ReviewTransferBodySchema = z.object({
  action: z.enum(['approve', 'reject']),
  reviewNotes: z.string().max(1000).optional(),
  items: z
    .array(
      z.object({
        itemId: z.string(),
        qtyApproved: z.number().int().min(0),
      })
    )
    .optional(),
});

const ReceiveTransferBodySchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string(),
        qtyReceived: z.number().int().min(1),
      })
    )
    .min(1),
});

// POST /api/stock-transfers - Create transfer
stockTransfersRouter.post(
  '/',
  requireAuthenticatedUserMiddleware,
  requirePermission('stock:write'),
  validateRequestBodyWithZod(CreateTransferBodySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const { sourceBranchId, destinationBranchId, items, requestNotes, orderNotes, expectedDeliveryDate, priority, initiationType } =
        req.validatedBody as z.infer<typeof CreateTransferBodySchema>;

      const transfer = await transferService.createStockTransfer({
        tenantId: req.currentTenantId,
        userId: req.currentUserId,
        data: {
          sourceBranchId,
          destinationBranchId,
          items,
          ...(requestNotes ? { requestNotes } : {}),
          ...(orderNotes ? { orderNotes } : {}),
          ...(expectedDeliveryDate ? { expectedDeliveryDate: new Date(expectedDeliveryDate) } : {}),
          ...(priority ? { priority } : {}),
          ...(initiationType ? { initiationType } : {}),
        },
        auditContext: getAuditContext(req),
      });

      return res.status(200).json(createStandardSuccessResponse(transfer));
    } catch (e) {
      return next(e);
    }
  }
);

// GET /api/stock-transfers - List transfers
stockTransfersRouter.get(
  '/',
  requireAuthenticatedUserMiddleware,
  requirePermission('stock:read'),
  async (req, res, next) => {
    try {
      assertAuthed(req);

      const branchId = req.query.branchId as string | undefined;
      const direction = req.query.direction as 'inbound' | 'outbound' | undefined;
      const status = req.query.status as string | undefined;
      const priority = req.query.priority as string | undefined;
      const initiationType = req.query.initiationType as 'PUSH' | 'PULL' | undefined;
      const initiatedByMeStr = req.query.initiatedByMe as string | undefined;
      const q = req.query.q as string | undefined;
      const sortBy = req.query.sortBy as 'requestedAt' | 'updatedAt' | 'transferNumber' | 'status' | 'priority' | undefined;
      const sortDir = req.query.sortDir as 'asc' | 'desc' | undefined;
      const requestedAtFrom = req.query.requestedAtFrom as string | undefined;
      const requestedAtTo = req.query.requestedAtTo as string | undefined;
      const shippedAtFrom = req.query.shippedAtFrom as string | undefined;
      const shippedAtTo = req.query.shippedAtTo as string | undefined;
      const expectedDeliveryDateFrom = req.query.expectedDeliveryDateFrom as string | undefined;
      const expectedDeliveryDateTo = req.query.expectedDeliveryDateTo as string | undefined;
      const limitStr = req.query.limit as string | undefined;
      const cursor = req.query.cursor as string | undefined;
      const includeTotalStr = req.query.includeTotal as string | undefined;

      const result = await transferService.listStockTransfers({
        tenantId: req.currentTenantId,
        userId: req.currentUserId,
        filters: {
          ...(branchId ? { branchId } : {}),
          ...(direction ? { direction } : {}),
          ...(status ? { status } : {}),
          ...(priority ? { priority } : {}),
          ...(initiationType ? { initiationType } : {}),
          ...(initiatedByMeStr ? { initiatedByMe: initiatedByMeStr === 'true' } : {}),
          ...(q ? { q } : {}),
          ...(sortBy ? { sortBy } : {}),
          ...(sortDir ? { sortDir } : {}),
          ...(requestedAtFrom ? { requestedAtFrom } : {}),
          ...(requestedAtTo ? { requestedAtTo } : {}),
          ...(shippedAtFrom ? { shippedAtFrom } : {}),
          ...(shippedAtTo ? { shippedAtTo } : {}),
          ...(expectedDeliveryDateFrom ? { expectedDeliveryDateFrom } : {}),
          ...(expectedDeliveryDateTo ? { expectedDeliveryDateTo } : {}),
          ...(limitStr ? { limit: parseInt(limitStr) } : {}),
          ...(cursor ? { cursor } : {}),
          ...(includeTotalStr ? { includeTotal: includeTotalStr === 'true' } : {}),
        },
      });

      return res.status(200).json(createStandardSuccessResponse(result));
    } catch (e) {
      return next(e);
    }
  }
);

// GET /api/stock-transfers/:transferId - Get transfer
stockTransfersRouter.get(
  '/:transferId',
  requireAuthenticatedUserMiddleware,
  requirePermission('stock:read'),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const { transferId } = req.params;

      if (!transferId) {
        throw new Error('Transfer ID is required');
      }

      const transfer = await transferService.getStockTransfer({
        tenantId: req.currentTenantId,
        userId: req.currentUserId,
        transferId,
      });

      return res.status(200).json(createStandardSuccessResponse(transfer));
    } catch (e) {
      return next(e);
    }
  }
);

// PATCH /api/stock-transfers/:transferId/review - Review transfer (approve/reject)
stockTransfersRouter.patch(
  '/:transferId/review',
  requireAuthenticatedUserMiddleware,
  requirePermission('stock:write'),
  validateRequestBodyWithZod(ReviewTransferBodySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const { transferId } = req.params;
      const { action, reviewNotes, items } =
        req.validatedBody as z.infer<typeof ReviewTransferBodySchema>;

      if (!transferId) {
        throw new Error('Transfer ID is required');
      }

      const transfer = await transferService.reviewStockTransfer({
        tenantId: req.currentTenantId,
        userId: req.currentUserId,
        transferId,
        action,
        ...(reviewNotes ? { reviewNotes } : {}),
        ...(items ? { approvedItems: items } : {}),
        auditContext: getAuditContext(req),
      });

      return res.status(200).json(createStandardSuccessResponse(transfer));
    } catch (e) {
      return next(e);
    }
  }
);

// Ship validation schema
const ShipTransferBodySchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string(),
        qtyToShip: z.number().int().min(1),
      })
    )
    .optional(), // If not provided, ships all approved quantities
});

// POST /api/stock-transfers/:transferId/ship - Ship transfer (supports partial shipments)
stockTransfersRouter.post(
  '/:transferId/ship',
  requireAuthenticatedUserMiddleware,
  requirePermission('stock:write'),
  validateRequestBodyWithZod(ShipTransferBodySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const { transferId } = req.params;
      const { items } = req.validatedBody as z.infer<typeof ShipTransferBodySchema>;

      if (!transferId) {
        throw new Error('Transfer ID is required');
      }

      const transfer = await transferService.shipStockTransfer({
        tenantId: req.currentTenantId,
        userId: req.currentUserId,
        transferId,
        ...(items ? { items } : {}),
        auditContext: getAuditContext(req),
      });

      return res.status(200).json(createStandardSuccessResponse(transfer));
    } catch (e) {
      return next(e);
    }
  }
);

// POST /api/stock-transfers/:transferId/receive - Receive transfer
stockTransfersRouter.post(
  '/:transferId/receive',
  requireAuthenticatedUserMiddleware,
  requirePermission('stock:write'),
  validateRequestBodyWithZod(ReceiveTransferBodySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const { transferId } = req.params;
      const { items } = req.validatedBody as z.infer<typeof ReceiveTransferBodySchema>;

      if (!transferId) {
        throw new Error('Transfer ID is required');
      }

      const transfer = await transferService.receiveStockTransfer({
        tenantId: req.currentTenantId,
        userId: req.currentUserId,
        transferId,
        receivedItems: items,
        auditContext: getAuditContext(req),
      });

      return res.status(200).json(createStandardSuccessResponse(transfer));
    } catch (e) {
      return next(e);
    }
  }
);

// DELETE /api/stock-transfers/:transferId - Cancel transfer
stockTransfersRouter.delete(
  '/:transferId',
  requireAuthenticatedUserMiddleware,
  requirePermission('stock:write'),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const { transferId } = req.params;

      if (!transferId) {
        throw new Error('Transfer ID is required');
      }

      await transferService.cancelStockTransfer({
        tenantId: req.currentTenantId,
        userId: req.currentUserId,
        transferId,
        auditContext: getAuditContext(req),
      });

      return res.status(200).json(createStandardSuccessResponse({ message: 'Transfer cancelled successfully' }));
    } catch (e) {
      return next(e);
    }
  }
);

// Reversal validation schema
const ReverseTransferBodySchema = z.object({
  reversalReason: z.string().max(1000).optional(),
});

// Approval validation schema
const SubmitApprovalBodySchema = z.object({
  notes: z.string().max(1000).optional(),
});

// POST /api/stock-transfers/:transferId/reverse - Reverse completed transfer
stockTransfersRouter.post(
  '/:transferId/reverse',
  requireAuthenticatedUserMiddleware,
  requirePermission('stock:write'),
  validateRequestBodyWithZod(ReverseTransferBodySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const { transferId } = req.params;
      const { reversalReason } = req.validatedBody as z.infer<typeof ReverseTransferBodySchema>;

      if (!transferId) {
        throw new Error('Transfer ID is required');
      }

      const reversalTransfer = await transferService.reverseStockTransfer({
        tenantId: req.currentTenantId,
        userId: req.currentUserId,
        transferId,
        ...(reversalReason !== undefined ? { reversalReason } : {}),
        auditContext: getAuditContext(req),
      });

      return res.status(200).json(createStandardSuccessResponse(reversalTransfer));
    } catch (e) {
      return next(e);
    }
  }
);

// POST /api/stock-transfers/:transferId/approve/:level - Submit approval for level
stockTransfersRouter.post(
  '/:transferId/approve/:level',
  requireAuthenticatedUserMiddleware,
  requirePermission('stock:write'),
  validateRequestBodyWithZod(SubmitApprovalBodySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const { transferId, level: levelStr } = req.params;
      const body = req.validatedBody as z.infer<typeof SubmitApprovalBodySchema>;

      if (!transferId || !levelStr) {
        throw new Error('Transfer ID and level are required');
      }

      const level = parseInt(levelStr, 10);
      if (isNaN(level) || level < 1) {
        throw new Error('Level must be a positive integer');
      }

      const transfer = await approvalEvaluationService.submitApproval({
        tenantId: req.currentTenantId,
        userId: req.currentUserId,
        transferId,
        level,
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        auditContext: getAuditContext(req),
      });

      return res.status(200).json(createStandardSuccessResponse(transfer));
    } catch (e) {
      return next(e);
    }
  }
);

// GET /api/stock-transfers/:transferId/approval-progress - Get approval progress
stockTransfersRouter.get(
  '/:transferId/approval-progress',
  requireAuthenticatedUserMiddleware,
  requirePermission('stock:read'),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const { transferId } = req.params;

      if (!transferId) {
        throw new Error('Transfer ID is required');
      }

      const progress = await approvalEvaluationService.getApprovalProgress({
        tenantId: req.currentTenantId,
        transferId,
      });

      return res.status(200).json(createStandardSuccessResponse(progress));
    } catch (e) {
      return next(e);
    }
  }
);

// Priority validation schema
const UpdatePriorityBodySchema = z.object({
  priority: z.enum(['URGENT', 'HIGH', 'NORMAL', 'LOW']),
});

// PATCH /api/stock-transfers/:transferId/priority - Update transfer priority
stockTransfersRouter.patch(
  '/:transferId/priority',
  requireAuthenticatedUserMiddleware,
  requirePermission('stock:write'),
  validateRequestBodyWithZod(UpdatePriorityBodySchema),
  async (req, res, next) => {
    try {
      assertAuthed(req);
      const { transferId } = req.params;
      const { priority } = req.validatedBody as z.infer<typeof UpdatePriorityBodySchema>;

      if (!transferId) {
        throw new Error('Transfer ID is required');
      }

      const transfer = await transferService.updateTransferPriority({
        tenantId: req.currentTenantId,
        userId: req.currentUserId,
        transferId,
        priority,
        auditContext: getAuditContext(req),
      });

      return res.status(200).json(createStandardSuccessResponse(transfer));
    } catch (e) {
      return next(e);
    }
  }
);
