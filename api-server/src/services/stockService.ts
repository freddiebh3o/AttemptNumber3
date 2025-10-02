// api-server/src/services/stockService.ts
import { Prisma, StockMovementKind } from '@prisma/client';
import { prismaClientInstance } from '../db/prismaClient.js';
import { Errors } from '../utils/httpErrors.js';

type Ids = {
  currentTenantId: string;
  currentUserId: string;
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

/** Receive: creates a new lot (+qty), ledger (+), increments aggregate */
export async function receiveStock(
  ids: Ids,
  input: {
    branchId: string;
    productId: string;
    qty: number; // > 0
    unitCostCents?: number | null | undefined;
    sourceRef?: string | null | undefined;
    reason?: string | null | undefined;
    occurredAt?: string | undefined; // ISO
  }
) {
  const { currentTenantId, currentUserId } = ids;
  const { branchId, productId, qty, unitCostCents, sourceRef, reason, occurredAt } = input;

  if (qty <= 0) throw Errors.validation('qty must be > 0');

  await assertBranchAccess({ currentTenantId, currentUserId, branchId, requireMembership: true });
  await ensureProductBelongsToTenant(currentTenantId, productId);

  const result = await prismaClientInstance.$transaction(async (tx) => {
    await ensureProductStockRow(tx, { tenantId: currentTenantId, branchId, productId });

    const lot = await tx.stockLot.create({
      data: {
        tenantId: currentTenantId,
        branchId,
        productId,
        qtyReceived: qty,
        qtyRemaining: qty,
        unitCostCents: unitCostCents ?? null,
        sourceRef: sourceRef ?? null,
        receivedAt: toDateMaybe(occurredAt),
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
    });

    const productStock = await tx.productStock.update({
      where: {
        tenantId_branchId_productId: { tenantId: currentTenantId, branchId, productId },
      },
      data: { qtyOnHand: { increment: qty } },
    });

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
  }: {
    tenantId: string;
    branchId: string;
    productId: string;
    qty: number; // positive
    userId: string;
    kind: StockMovementKind; // CONSUMPTION or ADJUSTMENT
    reason?: string | null | undefined;
    occurredAt?: string | undefined;
  }
) {
  // Ensure aggregate exists
  const ps = await tx.productStock.findUnique({
    where: { tenantId_branchId_productId: { tenantId, branchId, productId } },
    select: { qtyOnHand: true },
  });
  const qtyOnHand = ps?.qtyOnHand ?? 0;
  if (qty > qtyOnHand) {
    throw Errors.conflict('Insufficient stock to fulfill request', `Need ${qty}, on-hand ${qtyOnHand}`);
  }

  const lots = await tx.stockLot.findMany({
    where: { tenantId, branchId, productId, qtyRemaining: { gt: 0 } },
    orderBy: [{ receivedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
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
      select: { id: true },
    });

    affected.push({ lotId: lot.id, take, ledgerId: ledger.id });
    remaining -= take;
  }

  if (remaining > 0) {
    // Should not happen because we pre-checked qtyOnHand, but guard anyway
    throw Errors.conflict('Insufficient stock during FIFO processing');
  }

  const productStock = await tx.productStock.update({
    where: { tenantId_branchId_productId: { tenantId, branchId, productId } },
    data: { qtyOnHand: { decrement: qty } },
  });

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
  }
) {
  const { currentTenantId, currentUserId } = ids;
  const { branchId, productId, qtyDelta, reason, occurredAt } = input;

  if (qtyDelta === 0) throw Errors.validation('qtyDelta must be non-zero');

  await assertBranchAccess({ currentTenantId, currentUserId, branchId, requireMembership: true });
  await ensureProductBelongsToTenant(currentTenantId, productId);

  const result = await prismaClientInstance.$transaction(async (tx) => {
    await ensureProductStockRow(tx, { tenantId: currentTenantId, branchId, productId });

    if (qtyDelta > 0) {
      const lot = await tx.stockLot.create({
        data: {
          tenantId: currentTenantId,
          branchId,
          productId,
          qtyReceived: qtyDelta,
          qtyRemaining: qtyDelta,
          unitCostCents: null,
          sourceRef: null,
          receivedAt: toDateMaybe(occurredAt),
        },
        select: { id: true, qtyReceived: true, qtyRemaining: true, receivedAt: true },
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
        select: { id: true },
      });

      const productStock = await tx.productStock.update({
        where: { tenantId_branchId_productId: { tenantId: currentTenantId, branchId, productId } },
        data: { qtyOnHand: { increment: qtyDelta } },
      });

      return { lot, ledgerId: ledger.id, productStock };
    }

    // qtyDelta < 0 → FIFO consumption
    const { affected, productStock } = await fifoDecrementLots(tx, {
      tenantId: currentTenantId,
      branchId,
      productId,
      qty: Math.abs(qtyDelta),
      userId: currentUserId,
      kind: StockMovementKind.ADJUSTMENT,
      reason: reason ?? 'adjust-down',
      occurredAt,
    });

    return { affected, productStock };
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
  }
) {
  const { currentTenantId, currentUserId } = ids;
  const { branchId, productId, qty, reason, occurredAt } = input;
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
    });

    return out;
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
        unitCostCents: true,
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
