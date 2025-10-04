// api-server/src/openapi/schemas/stock.ts
import { z } from 'zod';

// Reuse this if you want to expose movement kinds on ledger records
export const ZodStockMovementKind = z
  .enum(['RECEIPT', 'ADJUSTMENT', 'CONSUMPTION', 'REVERSAL'])
  .openapi('StockMovementKind');

const ZodISODate = z.string().datetime();

// --- Records (mirror DB shapes we return) ---
export const ZodProductStockRecord = z.object({
  id: z.string(),
  tenantId: z.string(),
  branchId: z.string(),
  productId: z.string(),
  qtyOnHand: z.number().int(),
  qtyAllocated: z.number().int(),
  createdAt: ZodISODate,
  updatedAt: ZodISODate,
}).openapi('ProductStockRecord');

export const ZodStockLotRecord = z.object({
  id: z.string(),
  tenantId: z.string(),
  branchId: z.string(),
  productId: z.string(),
  qtyReceived: z.number().int(),
  qtyRemaining: z.number().int(),
  // Unit cost stored in **pence**
  unitCostPence: z.number().int().nullable().optional(),
  sourceRef: z.string().nullable().optional(),
  receivedAt: ZodISODate,
  createdAt: ZodISODate,
  updatedAt: ZodISODate,
}).openapi('StockLotRecord');

export const ZodStockLedgerRecord = z.object({
  id: z.string(),
  tenantId: z.string(),
  branchId: z.string(),
  productId: z.string(),
  lotId: z.string().nullable(),
  kind: ZodStockMovementKind,
  qtyDelta: z.number().int(),
  reason: z.string().nullable().optional(),
  actorUserId: z.string().nullable().optional(),
  occurredAt: ZodISODate,
  createdAt: ZodISODate,
}).openapi('StockLedgerRecord');

// For GET /stock/levels productStock fallback (no id/timestamps)
export const ZodProductStockLevelsSnapshot = z.object({
  tenantId: z.string(),
  branchId: z.string(),
  productId: z.string(),
  qtyOnHand: z.number().int(),
  qtyAllocated: z.number().int(),
}).openapi('ProductStockLevelsSnapshot');

// --- Request bodies ---
export const ZodReceiveStockRequestBody = z.object({
  branchId: z.string().min(1),
  productId: z.string().min(1),
  qty: z.number().int().positive(),
  // Unit cost in **pence**
  unitCostPence: z.number().int().min(0).nullable().optional(),
  sourceRef: z.string().max(200).nullable().optional(),
  reason: z.string().max(500).nullable().optional(),
  occurredAt: z.string().datetime().optional(),
}).openapi('ReceiveStockRequestBody');

export const ZodAdjustStockRequestBody = z.object({
  branchId: z.string().min(1),
  productId: z.string().min(1),
  qtyDelta: z.number().int().refine(v => v !== 0, 'qtyDelta must be non-zero'),
  // Unit cost in **pence** (required when qtyDelta > 0)
  unitCostPence: z.number().int().min(0).optional(),
  reason: z.string().max(500).nullable().optional(),
  occurredAt: z.string().datetime().optional(),
}).superRefine((val, ctx) => {
  if (val.qtyDelta > 0 && typeof val.unitCostPence !== 'number') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'unitCostPence is required when increasing stock (qtyDelta > 0)',
      path: ['unitCostPence'],
    });
  }
});

export const ZodConsumeStockRequestBody = z.object({
  branchId: z.string().min(1),
  productId: z.string().min(1),
  qty: z.number().int().positive(),
  reason: z.string().max(500).nullable().optional(),
  occurredAt: z.string().datetime().optional(),
}).openapi('ConsumeStockRequestBody');

export const ZodStockLevelsQuery = z.object({
  branchId: z.string().min(1),
  productId: z.string().min(1),
}).openapi('StockLevelsQuery');

// POST /stock/receive
export const ZodReceiveStockResponseData = z.object({
  lot: ZodStockLotRecord,
  ledger: ZodStockLedgerRecord,
  productStock: ZodProductStockRecord,
}).openapi('ReceiveStockResponseData');

// POST /stock/adjust → union (up vs down)
export const ZodAdjustStockResponseData = z.union([
  // qtyDelta > 0
  z.object({
    lot: ZodStockLotRecord.pick({
      id: true, qtyReceived: true, qtyRemaining: true, receivedAt: true,
    }),
    ledgerId: z.string(),
    productStock: ZodProductStockRecord,
  }),
  // qtyDelta < 0
  z.object({
    affected: z.array(z.object({
      lotId: z.string(),
      take: z.number().int(),
      ledgerId: z.string(),
    })),
    productStock: ZodProductStockRecord,
  }),
]).openapi('AdjustStockResponseData');

// POST /stock/consume
export const ZodConsumeStockResponseData = z.object({
  affected: z.array(z.object({
    lotId: z.string(),
    take: z.number().int(),
    ledgerId: z.string(),
  })),
  productStock: ZodProductStockRecord,
}).openapi('ConsumeStockResponseData');

// GET /stock/levels
export const ZodStockLevelsResponseData = z.object({
  productStock: ZodProductStockLevelsSnapshot,
  lots: z.array(ZodStockLotRecord),
}).openapi('StockLevelsResponseData');

// list ledger query & response
export const ZodStockLedgerListQuery = z.object({
  productId: z.string().min(1),
  branchId: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  cursorId: z.string().min(1).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  occurredFrom: z.string().datetime().optional(),
  occurredTo: z.string().datetime().optional(),
  kinds: z.string().optional().openapi({ description: 'CSV of movement kinds (RECEIPT,ADJUSTMENT,CONSUMPTION,REVERSAL)' }),
  minQty: z.number().int().optional().openapi({ description: 'Minimum qtyDelta inclusive' }),
  maxQty: z.number().int().optional().openapi({ description: 'Maximum qtyDelta inclusive' }),
}).openapi('StockLedgerListQuery');

// light PageInfo
export const ZodPageInfo = z.object({
  hasNextPage: z.boolean(),
  nextCursor: z.string().nullable(),
  totalCount: z.number().int().min(0).optional(),
}).openapi('PageInfo');

// Response
export const ZodStockLedgerListResponseData = z.object({
  items: z.array(ZodStockLedgerRecord),
  pageInfo: ZodPageInfo,
  applied: z.object({
    limit: z.number().int(),
    sort: z.object({ field: z.string(), direction: z.enum(['asc','desc']) }),
    filters: z.record(z.string(), z.any()),
  }),
}).openapi('StockLedgerListResponseData');

// --- ADD: bulk levels query & response ---
export const ZodStockLevelsBulkQuery = z.object({
  productId: z.string().min(1),
}).openapi('StockLevelsBulkQuery');

export const ZodStockLevelsBulkItem = z.object({
  branchId: z.string(),
  branchName: z.string(),
  productStock: ZodProductStockLevelsSnapshot,
  lots: z.array(ZodStockLotRecord),
}).openapi('StockLevelsBulkItem');

export const ZodStockLevelsBulkResponseData = z.object({
  items: z.array(ZodStockLevelsBulkItem),
}).openapi('StockLevelsBulkResponseData');
