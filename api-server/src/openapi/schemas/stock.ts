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
  unitCostCents: z.number().int().nullable().optional(),
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
  unitCostCents: z.number().int().min(0).nullable().optional(),
  sourceRef: z.string().max(200).nullable().optional(),
  reason: z.string().max(500).nullable().optional(),
  occurredAt: z.string().datetime().optional(),
}).openapi('ReceiveStockRequestBody');

export const ZodAdjustStockRequestBody = z.object({
  branchId: z.string().min(1),
  productId: z.string().min(1),
  qtyDelta: z.number().int().refine(v => v !== 0, 'qtyDelta must be non-zero'),
  reason: z.string().max(500).nullable().optional(),
  occurredAt: z.string().datetime().optional(),
}).openapi('AdjustStockRequestBody');

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

// --- Response shapes ---
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
