// api-server/src/services/stockSerializer.ts
/**
 * Serializers for Stock objects - converts Date objects to UK formatted strings
 */

import { formatDateUK, formatDateTimeUK } from '../utils/dateFormatter.js';

/**
 * StockLot with Date fields (as returned from Prisma)
 */
type StockLotWithDates = {
  id: string;
  tenantId?: string;
  branchId?: string;
  productId?: string;
  qtyReceived: number;
  qtyRemaining: number;
  unitCostPence: number | null;
  sourceRef: string | null;
  receivedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * StockLedger with Date fields (as returned from Prisma)
 */
type StockLedgerWithDates = {
  id: string;
  tenantId?: string;
  branchId?: string;
  productId?: string;
  lotId: string | null;
  kind: string;
  qtyDelta: number;
  reason: string | null;
  actorUserId: string | null;
  occurredAt: Date;
  createdAt: Date;
};

/**
 * ProductStock with Date fields (as returned from Prisma)
 */
type ProductStockWithDates = {
  id?: string;
  tenantId?: string;
  branchId?: string;
  productId?: string;
  qtyOnHand: number;
  qtyAllocated: number;
  createdAt?: Date;
  updatedAt?: Date;
};

/**
 * Serialized StockLot with UK formatted dates
 */
export type SerializedStockLot = Omit<StockLotWithDates, 'receivedAt' | 'createdAt' | 'updatedAt'> & {
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Serialized StockLedger with UK formatted dates
 */
export type SerializedStockLedger = Omit<StockLedgerWithDates, 'occurredAt' | 'createdAt'> & {
  occurredAt: string;
  createdAt: string;
};

/**
 * Serialized ProductStock with UK formatted dates
 */
export type SerializedProductStock = Omit<ProductStockWithDates, 'createdAt' | 'updatedAt'> & {
  createdAt?: string;
  updatedAt?: string;
};

/**
 * Serialize a single stock lot - converts dates to UK format
 */
export function serializeStockLot(lot: StockLotWithDates): SerializedStockLot {
  return {
    ...lot,
    receivedAt: formatDateUK(lot.receivedAt),
    createdAt: formatDateTimeUK(lot.createdAt),
    updatedAt: formatDateTimeUK(lot.updatedAt),
  };
}

/**
 * Serialize a list of stock lots - converts dates to UK format
 */
export function serializeStockLotList(lots: StockLotWithDates[]): SerializedStockLot[] {
  return lots.map(serializeStockLot);
}

/**
 * Serialize a single stock ledger entry - converts dates to UK format
 */
export function serializeStockLedger(ledger: StockLedgerWithDates): SerializedStockLedger {
  return {
    ...ledger,
    occurredAt: formatDateTimeUK(ledger.occurredAt),
    createdAt: formatDateTimeUK(ledger.createdAt),
  };
}

/**
 * Serialize a list of stock ledger entries - converts dates to UK format
 */
export function serializeStockLedgerList(ledgers: StockLedgerWithDates[]): SerializedStockLedger[] {
  return ledgers.map(serializeStockLedger);
}

/**
 * Serialize a single product stock - converts dates to UK format
 */
export function serializeProductStock(stock: ProductStockWithDates): SerializedProductStock {
  const result: any = {
    qtyOnHand: stock.qtyOnHand,
    qtyAllocated: stock.qtyAllocated,
  };

  if (stock.id !== undefined) result.id = stock.id;
  if (stock.tenantId !== undefined) result.tenantId = stock.tenantId;
  if (stock.branchId !== undefined) result.branchId = stock.branchId;
  if (stock.productId !== undefined) result.productId = stock.productId;

  if (stock.createdAt) {
    result.createdAt = formatDateTimeUK(stock.createdAt);
  }

  if (stock.updatedAt) {
    result.updatedAt = formatDateTimeUK(stock.updatedAt);
  }

  return result;
}

/**
 * Serialize stock service responses that contain nested lot/ledger/productStock
 */
export function serializeStockResponse(response: {
  lot?: any;
  ledger?: any;
  ledgerId?: string;
  productStock?: any;
  affected?: any[];
  restoredLots?: any[];
  productStockUpdates?: any[];
  [key: string]: any;
}): any {
  const result: any = { ...response };

  // Serialize lot if present
  if (result.lot) {
    result.lot = serializeStockLot(result.lot);
  }

  // Serialize ledger if present
  if (result.ledger) {
    result.ledger = serializeStockLedger(result.ledger);
  }

  // Serialize productStock if present
  if (result.productStock) {
    result.productStock = serializeProductStock(result.productStock);
  }

  // Serialize affected lots if present
  if (result.affected && Array.isArray(result.affected)) {
    result.affected = result.affected.map((item: any) => ({
      ...item,
      lot: item.lot ? serializeStockLot(item.lot) : item.lot,
      ledger: item.ledger ? serializeStockLedger(item.ledger) : item.ledger,
    }));
  }

  // Serialize restored lots if present
  if (result.restoredLots && Array.isArray(result.restoredLots)) {
    result.restoredLots = serializeStockLotList(result.restoredLots);
  }

  // Serialize productStockUpdates if present
  if (result.productStockUpdates && Array.isArray(result.productStockUpdates)) {
    result.productStockUpdates = result.productStockUpdates.map(serializeProductStock);
  }

  return result;
}
