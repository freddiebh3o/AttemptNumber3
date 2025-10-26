// api-server/src/services/products/productSerializer.ts
/**
 * Serializers for Product objects - converts Date objects to UK formatted strings
 */

import { formatDateTimeUK } from '../../utils/dateFormatter.js';
import type { Product } from '@prisma/client';

/**
 * Product with Date fields (as returned from Prisma)
 */
type ProductWithDates = {
  id: string;
  productName: string;
  productSku: string;
  productPricePence: number;
  barcode: string | null;
  barcodeType: string | null;
  isArchived: boolean;
  archivedAt: Date | null;
  archivedByUserId: string | null;
  entityVersion: number;
  updatedAt: Date;
  createdAt: Date;
  tenantId?: string; // Optional, not always selected
  stock?: any; // Optional stock info for barcode lookup
};

/**
 * Serialized product with UK formatted dates
 */
type SerializedProduct = Omit<ProductWithDates, 'createdAt' | 'updatedAt' | 'archivedAt'> & {
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

/**
 * Serialize a single product - converts dates to UK format
 */
export function serializeProduct(product: ProductWithDates): SerializedProduct {
  return {
    ...product,
    createdAt: formatDateTimeUK(product.createdAt),
    updatedAt: formatDateTimeUK(product.updatedAt),
    archivedAt: product.archivedAt ? formatDateTimeUK(product.archivedAt) : null,
  };
}

/**
 * Serialize a list of products - converts dates to UK format
 */
export function serializeProductList(products: ProductWithDates[]): SerializedProduct[] {
  return products.map(serializeProduct);
}
