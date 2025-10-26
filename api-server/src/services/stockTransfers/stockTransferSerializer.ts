// api-server/src/services/stockTransfers/stockTransferSerializer.ts
/**
 * Serializers for StockTransfer objects - converts Date objects to UK formatted strings
 */

import { formatDateUK, formatDateTimeUK } from '../../utils/dateFormatter.js';

/**
 * StockTransfer with Date fields (as returned from Prisma)
 */
type StockTransferWithDates = {
  id: string;
  transferNumber: string;
  tenantId?: string;
  sourceBranchId?: string;
  destinationBranchId?: string;
  status: string;
  priority?: string | null;
  initiationType?: string | null;
  requestNotes?: string | null;
  orderNotes?: string | null;
  reviewNotes?: string | null;
  deliveryNotes?: string | null;
  expectedDeliveryDate?: Date | null;
  requestedAt: Date;
  reviewedAt?: Date | null;
  dispatchedAt?: Date | null;
  receivedAt?: Date | null;
  cancelledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  requestedByUserId?: string | null;
  reviewedByUserId?: string | null;
  dispatchedByUserId?: string | null;
  receivedByUserId?: string | null;
  cancelledByUserId?: string | null;
  dispatchNotePdfUrl?: string | null;
  reversalOfTransferId?: string | null;
  reversedByTransferId?: string | null;
  [key: string]: any; // Allow additional fields like items, branches, etc.
};

/**
 * Serialized StockTransfer with UK formatted dates
 */
export type SerializedStockTransfer = Omit<
  StockTransferWithDates,
  'requestedAt' | 'reviewedAt' | 'dispatchedAt' | 'receivedAt' | 'cancelledAt' | 'createdAt' | 'updatedAt' | 'expectedDeliveryDate'
> & {
  requestedAt: string;
  reviewedAt: string | null;
  dispatchedAt: string | null;
  receivedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  expectedDeliveryDate: string | null;
};

/**
 * Serialize a single stock transfer - converts dates to UK format
 */
export function serializeStockTransfer(transfer: StockTransferWithDates): SerializedStockTransfer {
  return {
    ...transfer,
    requestedAt: formatDateTimeUK(transfer.requestedAt),
    reviewedAt: transfer.reviewedAt ? formatDateTimeUK(transfer.reviewedAt) : null,
    dispatchedAt: transfer.dispatchedAt ? formatDateTimeUK(transfer.dispatchedAt) : null,
    receivedAt: transfer.receivedAt ? formatDateTimeUK(transfer.receivedAt) : null,
    cancelledAt: transfer.cancelledAt ? formatDateTimeUK(transfer.cancelledAt) : null,
    createdAt: formatDateTimeUK(transfer.createdAt),
    updatedAt: formatDateTimeUK(transfer.updatedAt),
    expectedDeliveryDate: transfer.expectedDeliveryDate ? formatDateUK(transfer.expectedDeliveryDate) : null,
  };
}

/**
 * Serialize a list of stock transfers - converts dates to UK format
 */
export function serializeStockTransferList(transfers: StockTransferWithDates[]): SerializedStockTransfer[] {
  return transfers.map(serializeStockTransfer);
}

/**
 * Serialize stock transfer service responses that may contain nested data
 */
export function serializeStockTransferResponse(response: any): any {
  if (!response) return response;

  // Handle single transfer object
  if (response.id && response.transferNumber) {
    return serializeStockTransfer(response);
  }

  // Handle list responses with items array
  if (response.items && Array.isArray(response.items)) {
    return {
      ...response,
      items: serializeStockTransferList(response.items),
    };
  }

  // Handle pagination responses
  if (response.transfers && Array.isArray(response.transfers)) {
    return {
      ...response,
      transfers: serializeStockTransferList(response.transfers),
    };
  }

  // Return as-is if no recognized structure
  return response;
}
