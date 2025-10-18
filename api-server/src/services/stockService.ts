// api-server/src/services/stockService.ts
import { Prisma, StockMovementKind, AuditAction, AuditEntityType } from '@prisma/client';
import { prismaClientInstance } from '../db/prismaClient.js';
import { Errors } from '../utils/httpErrors.js';
import { writeAuditEvent } from './auditLoggerService.js';

type Ids = {
  currentTenantId: string;
  currentUserId: string;
};

type AuditCtx = {
  actorUserId?: string | null | undefined;
  correlationId?: string | null | undefined;
  ip?: string | null | undefined;
  userAgent?: string | null | undefined;
};

async function assertBranchAccess({
  currentTenantId,
  currentUserId,
  branchId,
  requireMembership = true,
}: {
  currentTenantId: string;
  currentUserId: string;
  branchId: string;
  requireMembership?: boolean;
}) {
  const branch = await prismaClientInstance.branch.findFirst({
    where: { id: branchId, tenantId: currentTenantId, isActive: true },
    select: { id: true },
  });
  if (!branch) throw Errors.notFound('Branch not found for this tenant');

  if (requireMembership) {
    const membership = await prismaClientInstance.userBranchMembership.findFirst({
      where: { userId: currentUserId, tenantId: currentTenantId, branchId },
      select: { id: true },
    });
    if (!membership) throw Errors.permissionDenied();
  }
}

async function ensureProductBelongsToTenant(currentTenantId: string, productId: string) {
  const p = await prismaClientInstance.product.findFirst({
    where: { id: productId, tenantId: currentTenantId },
    select: { id: true },
  });
  if (!p) throw Errors.notFound('Product not found for this tenant');
}

async function ensureProductStockRow(
  tx: Prisma.TransactionClient,
  {
    tenantId,
    branchId,
    productId,
  }: { tenantId: string; branchId: string; productId: string }
) {
  return tx.productStock.upsert({
    where: { tenantId_branchId_productId: { tenantId, branchId, productId } },
    update: {},
    create: { tenantId, branchId, productId, qtyOnHand: 0, qtyAllocated: 0 },
  });
}

function toDateMaybe(s?: string) {
  return s ? new Date(s) : new Date();
}

function auditCtxOrNull(ctx?: AuditCtx) {
  return {
    actorUserId: ctx?.actorUserId ?? null,
    correlationId: ctx?.correlationId ?? null,
    ip: ctx?.ip ?? null,
    userAgent: ctx?.userAgent ?? null,
  };
}

/** Receive: creates a new lot (+qty), ledger (+), increments aggregate */
export async function receiveStock(
  ids: Ids,
  input: {
    branchId: string;
    productId: string;
    qty: number; // > 0
    /** Unit cost in **pence** (GBP minor units) */
    unitCostPence?: number | null | undefined;
    sourceRef?: string | null | undefined;
    reason?: string | null | undefined;
    occurredAt?: string | undefined; // ISO
    auditContextOptional?: AuditCtx;
  }
) {
  const { currentTenantId, currentUserId } = ids;
  const { branchId, productId, qty, unitCostPence, sourceRef, reason, occurredAt, auditContextOptional } = input;

  if (qty <= 0) throw Errors.validation('qty must be > 0');

  await assertBranchAccess({ currentTenantId, currentUserId, branchId, requireMembership: true });
  await ensureProductBelongsToTenant(currentTenantId, productId);

  const result = await prismaClientInstance.$transaction(async (tx) => {
    // Ensure aggregate row exists and capture "before"
    const aggBefore = await ensureProductStockRow(tx, { tenantId: currentTenantId, branchId, productId });

    const lot = await tx.stockLot.create({
      data: {
        tenantId: currentTenantId,
        branchId,
        productId,
        qtyReceived: qty,
        qtyRemaining: qty,
        unitCostPence: unitCostPence ?? null,
        sourceRef: sourceRef ?? null,
        receivedAt: toDateMaybe(occurredAt),
      },
      select: {
        id: true, tenantId: true, branchId: true, productId: true,
        qtyReceived: true, qtyRemaining: true, unitCostPence: true, sourceRef: true, receivedAt: true, createdAt: true, updatedAt: true,
      },
    });

    const ledger = await tx.stockLedger.create({
      data: {
        tenantId: currentTenantId,
        branchId,
        productId,
        lotId: lot.id,
        kind: StockMovementKind.RECEIPT,
        qtyDelta: qty,
        reason: reason ?? null,
        actorUserId: currentUserId,
        occurredAt: toDateMaybe(occurredAt),
      },
      select: {
        id: true, tenantId: true, branchId: true, productId: true, lotId: true, kind: true, qtyDelta: true,
        reason: true, actorUserId: true, occurredAt: true, createdAt: true,
      },
    });

    const productStock = await tx.productStock.update({
      where: {
        tenantId_branchId_productId: { tenantId: currentTenantId, branchId, productId },
      },
      data: { qtyOnHand: { increment: qty } },
      select: { tenantId: true, branchId: true, productId: true, qtyOnHand: true, qtyAllocated: true, id: true },
    });

    // AUDIT (best-effort; don’t break the transaction if audit fails)
    try {
      const meta = auditCtxOrNull(auditContextOptional);

      // 1) STOCK_LEDGER (domain action)
      await writeAuditEvent(tx, {
        tenantId: currentTenantId,
        actorUserId: meta.actorUserId ?? currentUserId,
        entityType: AuditEntityType.STOCK_LEDGER,
        entityId: ledger.id,
        action: AuditAction.STOCK_RECEIVE,
        entityName: null,
        before: null,
        after: ledger,
        correlationId: meta.correlationId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      // 2) STOCK_LOT (CRUD create)
      await writeAuditEvent(tx, {
        tenantId: currentTenantId,
        actorUserId: meta.actorUserId ?? currentUserId,
        entityType: AuditEntityType.STOCK_LOT,
        entityId: lot.id,
        action: AuditAction.CREATE,
        entityName: null,
        before: null,
        after: lot,
        correlationId: meta.correlationId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      // 3) PRODUCT_STOCK (aggregate update)
      await writeAuditEvent(tx, {
        tenantId: currentTenantId,
        actorUserId: meta.actorUserId ?? currentUserId,
        entityType: AuditEntityType.PRODUCT_STOCK,
        entityId: `${currentTenantId}:${branchId}:${productId}`,
        action: AuditAction.UPDATE,
        entityName: null,
        before: { branchId, productId, qtyOnHand: aggBefore.qtyOnHand, qtyAllocated: aggBefore.qtyAllocated },
        after: { branchId, productId, qtyOnHand: productStock.qtyOnHand, qtyAllocated: productStock.qtyAllocated },
        correlationId: meta.correlationId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    } catch {
      // swallow audit errors
    }

    return { lot, ledger, productStock };
  }, { isolationLevel: 'Serializable' });

  return result;
}

/** Core FIFO decrement used by consume and negative adjustments */
async function fifoDecrementLots(
  tx: Prisma.TransactionClient,
  {
    tenantId,
    branchId,
    productId,
    qty,
    userId,
    kind,
    reason,
    occurredAt,
    auditContextOptional,
  }: {
    tenantId: string;
    branchId: string;
    productId: string;
    qty: number; // positive
    userId: string;
    kind: StockMovementKind; // CONSUMPTION or ADJUSTMENT
    reason?: string | null | undefined;
    occurredAt?: string | undefined;
    auditContextOptional?: AuditCtx;
  }
) {
  // Ensure aggregate exists
  const ps = await tx.productStock.findUnique({
    where: { tenantId_branchId_productId: { tenantId, branchId, productId } },
    select: { id: true, qtyOnHand: true, qtyAllocated: true },
  });
  const qtyOnHand = ps?.qtyOnHand ?? 0;
  if (qty > qtyOnHand) {
    throw Errors.conflict('Insufficient stock to fulfill request', `Need ${qty}, on-hand ${qtyOnHand}`);
  }

  const lots = await tx.stockLot.findMany({
    where: { tenantId, branchId, productId, qtyRemaining: { gt: 0 } },
    orderBy: [{ receivedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, qtyRemaining: true },
  });

  let remaining = qty;
  const affected: { lotId: string; take: number; ledgerId: string }[] = [];

  for (const lot of lots) {
    if (!remaining) break;
    const take = Math.min(remaining, lot.qtyRemaining);
    if (take <= 0) continue;

    await tx.stockLot.update({
      where: { id: lot.id },
      data: { qtyRemaining: { decrement: take } },
    });

    const ledger = await tx.stockLedger.create({
      data: {
        tenantId,
        branchId,
        productId,
        lotId: lot.id,
        kind,
        qtyDelta: -take,
        reason: reason ?? null,
        actorUserId: userId,
        occurredAt: toDateMaybe(occurredAt),
      },
      select: {
        id: true, tenantId: true, branchId: true, productId: true, lotId: true, kind: true, qtyDelta: true,
        reason: true, actorUserId: true, occurredAt: true, createdAt: true,
      },
    });

    // AUDIT: per-lot ledger entry (domain)
    try {
      const meta = auditCtxOrNull(auditContextOptional);
      await writeAuditEvent(tx, {
        tenantId,
        actorUserId: meta.actorUserId ?? userId,
        entityType: AuditEntityType.STOCK_LEDGER,
        entityId: ledger.id,
        action: kind === StockMovementKind.CONSUMPTION ? AuditAction.STOCK_CONSUME : AuditAction.STOCK_ADJUST,
        entityName: null,
        before: null,
        after: ledger,
        correlationId: meta.correlationId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    } catch {
      // swallow audit errors
    }

    affected.push({ lotId: lot.id, take, ledgerId: ledger.id });
    remaining -= take;
  }

  if (remaining > 0) {
    // Should not happen because we pre-checked qtyOnHand, but guard anyway
    throw Errors.conflict('Insufficient stock during FIFO processing');
  }

  const aggBefore = { qtyOnHand, qtyAllocated: ps?.qtyAllocated ?? 0 };
  const productStock = await tx.productStock.update({
    where: { tenantId_branchId_productId: { tenantId, branchId, productId } },
    data: { qtyOnHand: { decrement: qty } },
    select: { qtyOnHand: true, qtyAllocated: true },
  });

  // AUDIT: aggregate update
  try {
    const meta = auditCtxOrNull(auditContextOptional);
    await writeAuditEvent(tx, {
      tenantId,
      actorUserId: meta.actorUserId ?? userId,
      entityType: AuditEntityType.PRODUCT_STOCK,
      entityId: `${tenantId}:${branchId}:${productId}`,
      action: AuditAction.UPDATE,
      entityName: null,
      before: { branchId, productId, qtyOnHand: aggBefore.qtyOnHand, qtyAllocated: aggBefore.qtyAllocated },
      after: { branchId, productId, qtyOnHand: productStock.qtyOnHand, qtyAllocated: productStock.qtyAllocated },
      correlationId: meta.correlationId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  } catch {
    // swallow audit errors
  }

  return { affected, productStock };
}

/** Adjust: qtyDelta>0 behaves like a mini-receive (new lot); qtyDelta<0 consumes FIFO */
export async function adjustStock(
  ids: Ids,
  input: {
    branchId: string;
    productId: string;
    qtyDelta: number;
    reason?: string | null | undefined;
    occurredAt?: string | undefined;
    /** Unit cost in **pence** when increasing stock */
    unitCostPence?: number | null | undefined;
    auditContextOptional?: AuditCtx;
  }
) {
  const { currentTenantId, currentUserId } = ids;
  const { branchId, productId, qtyDelta, reason, occurredAt, unitCostPence, auditContextOptional } = input;

  if (qtyDelta === 0) throw Errors.validation('qtyDelta must be non-zero');

  await assertBranchAccess({ currentTenantId, currentUserId, branchId, requireMembership: true });
  await ensureProductBelongsToTenant(currentTenantId, productId);

  const result = await prismaClientInstance.$transaction(async (tx) => {
    await ensureProductStockRow(tx, { tenantId: currentTenantId, branchId, productId });

    if (qtyDelta > 0) {
      // Adjust-up: create lot + ledger (ADJUSTMENT) + increment aggregate
      const aggBefore = await tx.productStock.findUnique({
        where: { tenantId_branchId_productId: { tenantId: currentTenantId, branchId, productId } },
        select: { qtyOnHand: true, qtyAllocated: true },
      });

      const lot = await tx.stockLot.create({
        data: {
          tenantId: currentTenantId,
          branchId,
          productId,
          qtyReceived: qtyDelta,
          qtyRemaining: qtyDelta,
          unitCostPence: unitCostPence!,
          sourceRef: null,
          receivedAt: toDateMaybe(occurredAt),
        },
        select: { id: true, tenantId: true, branchId: true, productId: true, qtyReceived: true, qtyRemaining: true, unitCostPence: true, receivedAt: true, createdAt: true, updatedAt: true },
      });

      const ledger = await tx.stockLedger.create({
        data: {
          tenantId: currentTenantId,
          branchId,
          productId,
          lotId: lot.id,
          kind: StockMovementKind.ADJUSTMENT,
          qtyDelta: qtyDelta,
          reason: reason ?? 'adjust-up',
          actorUserId: currentUserId,
          occurredAt: toDateMaybe(occurredAt),
        },
        select: { id: true, tenantId: true, branchId: true, productId: true, lotId: true, kind: true, qtyDelta: true, reason: true, actorUserId: true, occurredAt: true, createdAt: true },
      });

      const productStock = await tx.productStock.update({
        where: { tenantId_branchId_productId: { tenantId: currentTenantId, branchId, productId } },
        data: { qtyOnHand: { increment: qtyDelta } },
        select: { qtyOnHand: true, qtyAllocated: true },
      });

      // AUDIT
      try {
        const meta = auditCtxOrNull(auditContextOptional);

        await writeAuditEvent(tx, {
          tenantId: currentTenantId,
          actorUserId: meta.actorUserId ?? currentUserId,
          entityType: AuditEntityType.STOCK_LEDGER,
          entityId: ledger.id,
          action: AuditAction.STOCK_ADJUST,
          entityName: null,
          before: null,
          after: ledger,
          correlationId: meta.correlationId,
          ip: meta.ip,
          userAgent: meta.userAgent,
        });

        await writeAuditEvent(tx, {
          tenantId: currentTenantId,
          actorUserId: meta.actorUserId ?? currentUserId,
          entityType: AuditEntityType.STOCK_LOT,
          entityId: lot.id,
          action: AuditAction.CREATE,
          entityName: null,
          before: null,
          after: lot,
          correlationId: meta.correlationId,
          ip: meta.ip,
          userAgent: meta.userAgent,
        });

        await writeAuditEvent(tx, {
          tenantId: currentTenantId,
          actorUserId: meta.actorUserId ?? currentUserId,
          entityType: AuditEntityType.PRODUCT_STOCK,
          entityId: `${currentTenantId}:${branchId}:${productId}`,
          action: AuditAction.UPDATE,
          entityName: null,
          before: { branchId, productId, qtyOnHand: aggBefore?.qtyOnHand ?? 0, qtyAllocated: aggBefore?.qtyAllocated ?? 0 },
          after: { branchId, productId, qtyOnHand: productStock.qtyOnHand, qtyAllocated: productStock.qtyAllocated },
          correlationId: meta.correlationId,
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
      } catch {}

      return { lot, ledgerId: ledger.id, productStock };
    }

    // qtyDelta < 0 → FIFO consumption with ADJUSTMENT kind
    const out = await fifoDecrementLots(tx, {
      tenantId: currentTenantId,
      branchId,
      productId,
      qty: Math.abs(qtyDelta),
      userId: currentUserId,
      kind: StockMovementKind.ADJUSTMENT,
      reason: reason ?? 'adjust-down',
      occurredAt,
      ...(auditContextOptional ? { auditContextOptional } : {}),
    });

    return out;
  }, { isolationLevel: 'Serializable' });

  return result;
}

/** Consume: FIFO reduce lots, create CONSUMPTION ledger entries, decrement aggregate */
export async function consumeStock(
  ids: Ids,
  input: {
    branchId: string;
    productId: string;
    qty: number;
    reason?: string | null | undefined;
    occurredAt?: string | undefined;
    auditContextOptional?: AuditCtx;
  }
) {
  const { currentTenantId, currentUserId } = ids;
  const { branchId, productId, qty, reason, occurredAt, auditContextOptional } = input;
  if (qty <= 0) throw Errors.validation('qty must be > 0');

  await assertBranchAccess({ currentTenantId, currentUserId, branchId, requireMembership: true });
  await ensureProductBelongsToTenant(currentTenantId, productId);

  const result = await prismaClientInstance.$transaction(async (tx) => {
    await ensureProductStockRow(tx, { tenantId: currentTenantId, branchId, productId });

    const out = await fifoDecrementLots(tx, {
      tenantId: currentTenantId,
      branchId,
      productId,
      qty,
      userId: currentUserId,
      kind: StockMovementKind.CONSUMPTION,
      reason: reason ?? null,
      occurredAt,
      ...(auditContextOptional ? { auditContextOptional } : {}),
    });

    return out;
  }, { isolationLevel: 'Serializable' });

  return result;
}

/** Restore: increments qtyRemaining on existing lots (+qty), ledger (REVERSAL), increments aggregate */
export async function restoreLotQuantities(
  ids: Ids,
  input: {
    branchId: string;
    lotsToRestore: Array<{ lotId: string; qty: number }>;
    reason?: string | null | undefined;
    occurredAt?: string | undefined; // ISO
    auditContextOptional?: AuditCtx;
  }
) {
  const { currentTenantId, currentUserId } = ids;
  const { branchId, lotsToRestore, reason, occurredAt, auditContextOptional } = input;

  if (!lotsToRestore || lotsToRestore.length === 0) {
    throw Errors.validation('lotsToRestore must not be empty');
  }

  // Validate quantities
  for (const lotRestore of lotsToRestore) {
    if (lotRestore.qty <= 0) {
      throw Errors.validation('qty must be > 0 for each lot');
    }
  }

  await assertBranchAccess({ currentTenantId, currentUserId, branchId, requireMembership: true });

  const result = await prismaClientInstance.$transaction(async (tx) => {
    const lotIds = lotsToRestore.map((lr) => lr.lotId);

    // Fetch all lots to validate they exist and belong to correct branch/tenant
    const lots = await tx.stockLot.findMany({
      where: {
        id: { in: lotIds },
        tenantId: currentTenantId,
        branchId,
      },
      select: { id: true, productId: true, qtyRemaining: true, qtyReceived: true },
    });

    if (lots.length !== lotIds.length) {
      const foundIds = lots.map((l) => l.id);
      const missingIds = lotIds.filter((id) => !foundIds.includes(id));
      throw Errors.validation(`One or more lots not found or do not belong to the specified branch/tenant. Missing: ${missingIds.join(', ')}`);
    }

    // Group lots by product for aggregate updates
    const productUpdates = new Map<string, number>();

    const restoredLots: Array<{
      lotId: string;
      qty: number;
      productId: string;
      ledgerId: string;
    }> = [];

    // Restore each lot
    for (const lotRestore of lotsToRestore) {
      const lot = lots.find((l) => l.id === lotRestore.lotId);
      if (!lot) continue; // Should not happen due to validation above

      // Increment qtyRemaining on the lot
      try {
        await tx.stockLot.update({
          where: { id: lot.id },
          data: { qtyRemaining: { increment: lotRestore.qty } },
        });
      } catch (error) {
        console.error(`Failed to update lot ${lot.id}:`, error);
        throw error;
      }

      // Create REVERSAL ledger entry
      const ledger = await tx.stockLedger.create({
        data: {
          tenantId: currentTenantId,
          branchId,
          productId: lot.productId,
          lotId: lot.id,
          kind: StockMovementKind.REVERSAL,
          qtyDelta: lotRestore.qty,
          reason: reason ?? null,
          actorUserId: currentUserId,
          occurredAt: toDateMaybe(occurredAt),
        },
        select: {
          id: true,
          tenantId: true,
          branchId: true,
          productId: true,
          lotId: true,
          kind: true,
          qtyDelta: true,
          reason: true,
          actorUserId: true,
          occurredAt: true,
          createdAt: true,
        },
      });

      // AUDIT: per-lot ledger entry (domain)
      try {
        const meta = auditCtxOrNull(auditContextOptional);
        await writeAuditEvent(tx, {
          tenantId: currentTenantId,
          actorUserId: meta.actorUserId ?? currentUserId,
          entityType: AuditEntityType.STOCK_LEDGER,
          entityId: ledger.id,
          action: AuditAction.STOCK_REVERSE,
          entityName: null,
          before: null,
          after: ledger,
          correlationId: meta.correlationId,
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
      } catch (auditError) {
        // swallow audit errors - don't break the transaction
        console.error('Failed to write audit event for STOCK_REVERSE:', auditError);
      }

      restoredLots.push({
        lotId: lot.id,
        qty: lotRestore.qty,
        productId: lot.productId,
        ledgerId: ledger.id,
      });

      // Accumulate qty per product for aggregate updates
      const currentQty = productUpdates.get(lot.productId) ?? 0;
      productUpdates.set(lot.productId, currentQty + lotRestore.qty);
    }

    // Update ProductStock aggregates for each affected product
    const productStockUpdates: Array<{
      productId: string;
      qtyOnHand: number;
      qtyAllocated: number;
    }> = [];

    for (const [productId, totalQty] of productUpdates.entries()) {
      // Ensure aggregate row exists and capture "before"
      const aggBefore = await ensureProductStockRow(tx, {
        tenantId: currentTenantId,
        branchId,
        productId,
      });

      // Update aggregate with incremented qty
      const productStock = await tx.productStock.update({
        where: {
          tenantId_branchId_productId: { tenantId: currentTenantId, branchId, productId },
        },
        data: { qtyOnHand: { increment: totalQty } },
        select: { qtyOnHand: true, qtyAllocated: true },
      });

      productStockUpdates.push({
        productId,
        qtyOnHand: productStock.qtyOnHand,
        qtyAllocated: productStock.qtyAllocated,
      });

      // AUDIT: aggregate update
      try {
        const meta = auditCtxOrNull(auditContextOptional);
        await writeAuditEvent(tx, {
          tenantId: currentTenantId,
          actorUserId: meta.actorUserId ?? currentUserId,
          entityType: AuditEntityType.PRODUCT_STOCK,
          entityId: `${currentTenantId}:${branchId}:${productId}`,
          action: AuditAction.UPDATE,
          entityName: null,
          before: {
            branchId,
            productId,
            qtyOnHand: aggBefore.qtyOnHand,
            qtyAllocated: aggBefore.qtyAllocated,
          },
          after: {
            branchId,
            productId,
            qtyOnHand: productStock.qtyOnHand,
            qtyAllocated: productStock.qtyAllocated,
          },
          correlationId: meta.correlationId,
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
      } catch {
        // swallow audit errors
      }
    }

    return { restoredLots, productStockUpdates };
  }, { isolationLevel: 'Serializable' });

  return result;
}

/** Levels: aggregate row + open lots (qtyRemaining > 0) */
export async function getStockLevelsForProductService(params: {
  currentTenantId: string;
  branchId: string;
  productId: string;
}) {
  const { currentTenantId, branchId, productId } = params;

  const [productStock, lots] = await Promise.all([
    prismaClientInstance.productStock.findUnique({
      where: {
        tenantId_branchId_productId: {
          tenantId: currentTenantId,
          branchId,
          productId,
        },
      },
    }),
    prismaClientInstance.stockLot.findMany({
      where: {
        tenantId: currentTenantId,
        branchId,
        productId,
        qtyRemaining: { gt: 0 },
      },
      orderBy: [{ receivedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        qtyReceived: true,
        qtyRemaining: true,
        unitCostPence: true,
        sourceRef: true,
        receivedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  return {
    productStock:
      productStock ??
      {
        tenantId: currentTenantId,
        branchId,
        productId,
        qtyOnHand: 0,
        qtyAllocated: 0,
      },
    lots,
  };
}

// listStockLedgerService (cursor-paged, newest first)
export async function listStockLedgerService(params: {
  currentTenantId: string;
  productId: string;
  branchIdOptional?: string;
  limitOptional?: number;
  cursorIdOptional?: string;
  sortDirOptional?: 'asc' | 'desc';      // default: 'desc' (newest first)
  occurredFromOptional?: string;         // ISO
  occurredToOptional?: string;           // ISO
  kindsOptional?: StockMovementKind[];
  minQtyOptional?: number;
  maxQtyOptional?: number;
}) {
  const {
    currentTenantId,
    productId,
    branchIdOptional,
    limitOptional,
    cursorIdOptional,
    sortDirOptional,
    occurredFromOptional,
    occurredToOptional,
    kindsOptional,
    minQtyOptional,
    maxQtyOptional,
  } = params;

  // Clamp limit
  const limit = Math.min(Math.max(limitOptional ?? 20, 1), 100);
  const sortDir: 'asc' | 'desc' = sortDirOptional ?? 'desc';

  // Validate product belongs to tenant (re-use helper)
  await ensureProductBelongsToTenant(currentTenantId, productId);

  const where: Prisma.StockLedgerWhereInput = {
    tenantId: currentTenantId,
    productId,
    ...(branchIdOptional ? { branchId: branchIdOptional } : {}),
    ...(occurredFromOptional || occurredToOptional
      ? {
          occurredAt: {
            ...(occurredFromOptional ? { gte: new Date(occurredFromOptional) } : {}),
            ...(occurredToOptional ? { lt: new Date(occurredToOptional) } : {}),
          },
        }
      : {}),
    ...(kindsOptional && kindsOptional.length
      ? { kind: { in: kindsOptional } }
      : {}),
    ...((minQtyOptional !== undefined || maxQtyOptional !== undefined)
      ? {
          qtyDelta: {
            ...(minQtyOptional !== undefined ? { gte: minQtyOptional } : {}),
            ...(maxQtyOptional !== undefined ? { lte: maxQtyOptional } : {}),
          },
        }
      : {}),
  };

  const orderBy: Prisma.StockLedgerOrderByWithRelationInput[] = [
    { occurredAt: sortDir },
    { id: sortDir }, // deterministic tiebreak
  ];

  const take = limit + 1;

  const findArgs: Prisma.StockLedgerFindManyArgs = {
    where,
    orderBy,
    take,
    select: {
      id: true,
      tenantId: true,
      branchId: true,
      productId: true,
      lotId: true,
      kind: true,
      qtyDelta: true,
      reason: true,
      actorUserId: true,
      occurredAt: true,
      createdAt: true,
    },
  };

  if (cursorIdOptional) {
    findArgs.cursor = { id: cursorIdOptional };
    findArgs.skip = 1;
  }

  const rows = await prismaClientInstance.stockLedger.findMany(findArgs);

  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const nextCursor = hasNextPage ? items[items.length - 1]?.id ?? null : null;

  return {
    items,
    pageInfo: {
      hasNextPage,
      nextCursor,
    },
    applied: {
      limit,
      sort: { field: 'occurredAt', direction: sortDir },
      filters: {
        productId,
        ...(branchIdOptional ? { branchId: branchIdOptional } : {}),
        ...(occurredFromOptional ? { occurredFrom: occurredFromOptional } : {}),
        ...(occurredToOptional ? { occurredTo: occurredToOptional } : {}),
        ...(kindsOptional && kindsOptional.length ? { kinds: kindsOptional } : {}),
        ...(minQtyOptional !== undefined ? { minQty: minQtyOptional } : {}),
        ...(maxQtyOptional !== undefined ? { maxQty: maxQtyOptional } : {}),
      },
    },
  };
}

// getStockLevelsBulkService (all active branches for tenant)
export async function getStockLevelsBulkService(params: {
  currentTenantId: string;
  productId: string;
}) {
  const { currentTenantId, productId } = params;

  await ensureProductBelongsToTenant(currentTenantId, productId);

  // Only active branches
  const branches = await prismaClientInstance.branch.findMany({
    where: { tenantId: currentTenantId, isActive: true },
    select: { id: true, branchName: true },
    orderBy: [{ branchName: 'asc' }, { id: 'asc' }],
  });

  if (branches.length === 0) return { items: [] as Array<{
    branchId: string;
    branchName: string;
    productStock: { qtyOnHand: number; qtyAllocated: number };
    lots: Awaited<ReturnType<typeof prismaClientInstance.stockLot.findMany>>;
  }> };

  // Gather levels per branch (in parallel)
  const results = await Promise.all(
    branches.map(async (b) => {
      const [productStock, lots] = await Promise.all([
        prismaClientInstance.productStock.findUnique({
          where: {
            tenantId_branchId_productId: {
              tenantId: currentTenantId,
              branchId: b.id,
              productId,
            },
          },
          select: { qtyOnHand: true, qtyAllocated: true, id: true, createdAt: true, updatedAt: true },
        }),
        prismaClientInstance.stockLot.findMany({
          where: {
            tenantId: currentTenantId,
            branchId: b.id,
            productId,
            qtyRemaining: { gt: 0 },
          },
          orderBy: [{ receivedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            qtyReceived: true,
            qtyRemaining: true,
            unitCostPence: true,
            sourceRef: true,
            receivedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
      ]);

      return {
        branchId: b.id,
        branchName: b.branchName,
        productStock:
          productStock ?? {
            qtyOnHand: 0,
            qtyAllocated: 0,
          },
        lots,
      };
    })
  );

  return { items: results };
}
