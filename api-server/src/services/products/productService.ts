// api-server/src/services/products/productService.ts
import { prismaClientInstance } from '../../db/prismaClient.js';
import { Errors } from '../../utils/httpErrors.js';
import type { Prisma } from '@prisma/client';
import { writeAuditEvent } from '../auditLoggerService.js';
import { AuditAction, AuditEntityType } from '@prisma/client';

type SortField = 'createdAt' | 'updatedAt' | 'productName' | 'productPricePence';
type SortDir = 'asc' | 'desc';

type ListProductsArgs = {
  currentTenantId: string;
  limitOptional?: number;
  cursorIdOptional?: string;
  // filters
  qOptional?: string;
  minPricePenceOptional?: number;
  maxPricePenceOptional?: number;
  createdAtFromOptional?: string; // YYYY-MM-DD
  createdAtToOptional?: string;   // YYYY-MM-DD
  updatedAtFromOptional?: string; // YYYY-MM-DD
  updatedAtToOptional?: string;   // YYYY-MM-DD
  includeArchivedOptional?: boolean; // DEPRECATED: kept for backward compatibility
  archivedFilterOptional?: "no-archived" | "only-archived" | "both"; // NEW: archived filter
  // sort
  sortByOptional?: SortField;
  sortDirOptional?: SortDir;
  includeTotalOptional?: boolean;
};

// Same lightweight audit context type we used for branches
type AuditCtx = {
  actorUserId?: string | null | undefined;
  correlationId?: string | null | undefined;
  ip?: string | null | undefined;
  userAgent?: string | null | undefined;
};

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function getProductForCurrentTenantService(params: {
  currentTenantId: string;
  productIdPathParam: string;
}) {
  const { currentTenantId, productIdPathParam } = params;

  const product = await prismaClientInstance.product.findFirst({
    where: {
      id: productIdPathParam,
      tenantId: currentTenantId,
      // Allow access to both active and archived products on detail pages
    },
    select: {
      id: true,
      productName: true,
      productSku: true,
      productPricePence: true,
      barcode: true,
      barcodeType: true,
      isArchived: true,
      archivedAt: true,
      archivedByUserId: true,
      entityVersion: true,
      updatedAt: true,
      createdAt: true,
    },
  });

  if (!product) {
    throw Errors.notFound('Product not found.');
  }
  return product;
}

export async function listProductsForCurrentTenantService(args: ListProductsArgs) {
  const {
    currentTenantId,
    limitOptional,
    cursorIdOptional,
    qOptional,
    minPricePenceOptional,
    maxPricePenceOptional,
    createdAtFromOptional,
    createdAtToOptional,
    updatedAtFromOptional,
    updatedAtToOptional,
    includeArchivedOptional,
    archivedFilterOptional,
    sortByOptional,
    sortDirOptional,
    includeTotalOptional,
  } = args;

  // Clamp limit
  const limit = Math.min(Math.max(limitOptional ?? 20, 1), 100);

  // Sort defaults
  const sortBy: SortField = sortByOptional ?? 'createdAt';
  const sortDir: SortDir = sortDirOptional ?? 'desc';

  // --- WHERE construction ---
  const priceFilter: Prisma.ProductWhereInput =
    minPricePenceOptional !== undefined || maxPricePenceOptional !== undefined
      ? {
          productPricePence: {
            ...(minPricePenceOptional !== undefined ? { gte: minPricePenceOptional } : {}),
            ...(maxPricePenceOptional !== undefined ? { lte: maxPricePenceOptional } : {}),
          },
        }
      : {};

  const createdAt: Prisma.DateTimeFilter = {};
  if (createdAtFromOptional) {
    const d = new Date(createdAtFromOptional);
    if (!Number.isNaN(d.getTime())) createdAt.gte = d;
  }
  if (createdAtToOptional) {
    const d = new Date(createdAtToOptional);
    if (!Number.isNaN(d.getTime())) createdAt.lt = addDays(d, 1);
  }
  const createdAtFilter: Prisma.ProductWhereInput =
    createdAt.gte || createdAt.lt ? { createdAt } : {};

  const updatedAt: Prisma.DateTimeFilter = {};
  if (updatedAtFromOptional) {
    const d = new Date(updatedAtFromOptional);
    if (!Number.isNaN(d.getTime())) updatedAt.gte = d;
  }
  if (updatedAtToOptional) {
    const d = new Date(updatedAtToOptional);
    if (!Number.isNaN(d.getTime())) updatedAt.lt = addDays(d, 1);
  }
  const updatedAtFilter: Prisma.ProductWhereInput =
    updatedAt.gte || updatedAt.lt ? { updatedAt } : {};

  const searchFilter: Prisma.ProductWhereInput =
    qOptional && qOptional.trim()
      ? {
          OR: [
            { productName: { contains: qOptional, mode: 'insensitive' } },
            { productSku: { contains: qOptional, mode: 'insensitive' } },
          ],
        }
      : {};

  // Filter archived products
  // Priority: archivedFilterOptional > includeArchivedOptional (backward compat) > default (no-archived)
  let archivedFilter: Prisma.ProductWhereInput;

  if (archivedFilterOptional) {
    // New parameter takes precedence
    if (archivedFilterOptional === "only-archived") {
      archivedFilter = { isArchived: true }; // Show only archived
    } else if (archivedFilterOptional === "both") {
      archivedFilter = {}; // Show all (both archived and non-archived)
    } else {
      archivedFilter = { isArchived: false }; // Show only non-archived (default)
    }
  } else if (includeArchivedOptional === true) {
    // Backward compatibility: includeArchived=true means "both"
    archivedFilter = {};
  } else {
    // Default: hide archived products
    archivedFilter = { isArchived: false };
  }

  const where: Prisma.ProductWhereInput = {
    tenantId: currentTenantId,
    ...priceFilter,
    ...createdAtFilter,
    ...updatedAtFilter,
    ...searchFilter,
    ...archivedFilter,
  };

  const orderBy: Prisma.ProductOrderByWithRelationInput[] = [
    { [sortBy]: sortDir } as Prisma.ProductOrderByWithRelationInput,
    { id: sortDir },
  ];

  const take = limit + 1;

  const findArgs: Prisma.ProductFindManyArgs = {
    where,
    orderBy,
    take,
    select: {
      id: true,
      tenantId: true,
      productName: true,
      productSku: true,
      productPricePence: true,
      barcode: true,
      barcodeType: true,
      isArchived: true,
      archivedAt: true,
      archivedByUserId: true,
      entityVersion: true,
      updatedAt: true,
      createdAt: true,
    },
  };

  if (cursorIdOptional) {
    findArgs.cursor = { id: cursorIdOptional };
    findArgs.skip = 1;
  }

  const rows = await prismaClientInstance.product.findMany(findArgs);

  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const nextCursor = hasNextPage ? items[items.length - 1]?.id ?? null : null;

  let totalCount: number | undefined;
  if (includeTotalOptional) {
    totalCount = await prismaClientInstance.product.count({ where });
  }

  return {
    items,
    pageInfo: {
      hasNextPage,
      nextCursor,
      ...(totalCount !== undefined && { totalCount }),
    },
    applied: {
      limit,
      sort: { field: sortBy, direction: sortDir },
      filters: {
        ...(qOptional ? { q: qOptional } : {}),
        ...(minPricePenceOptional !== undefined ? { minPricePence: minPricePenceOptional } : {}),
        ...(maxPricePenceOptional !== undefined ? { maxPricePence: maxPricePenceOptional } : {}),
        ...(createdAtFromOptional ? { createdAtFrom: createdAtFromOptional } : {}),
        ...(createdAtToOptional ? { createdAtTo: createdAtToOptional } : {}),
        ...(updatedAtFromOptional ? { updatedAtFrom: updatedAtFromOptional } : {}),
        ...(updatedAtToOptional ? { updatedAtTo: updatedAtToOptional } : {}),
      },
    },
  };
}

export async function createProductForCurrentTenantService(params: {
  currentTenantId: string;
  productNameInputValue: string;
  productSkuInputValue: string;
  productPricePenceInputValue: number;
  barcode?: string;
  barcodeType?: string;
  auditContextOptional?: AuditCtx;
}) {
  const {
    currentTenantId,
    productNameInputValue,
    productSkuInputValue,
    productPricePenceInputValue,
    barcode,
    barcodeType,
    auditContextOptional,
  } = params;

  try {
    const created = await prismaClientInstance.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          tenantId: currentTenantId,
          productName: productNameInputValue,
          productSku: productSkuInputValue,
          productPricePence: productPricePenceInputValue,
          barcode: barcode || null,
          barcodeType: barcodeType || null,
        },
        select: {
          id: true,
          tenantId: true,
          productName: true,
          productSku: true,
          productPricePence: true,
          barcode: true,
          barcodeType: true,
          isArchived: true,
          archivedAt: true,
          archivedByUserId: true,
          entityVersion: true,
          updatedAt: true,
          createdAt: true,
        },
      });

      // AUDIT: CREATE
      await writeAuditEvent(tx, {
        tenantId: currentTenantId,
        actorUserId: auditContextOptional?.actorUserId ?? null,
        entityType: AuditEntityType.PRODUCT,
        entityId: product.id,
        action: AuditAction.CREATE,
        entityName: product.productName,
        before: null,
        after: product,
        correlationId: auditContextOptional?.correlationId ?? null,
        ip: auditContextOptional?.ip ?? null,
        userAgent: auditContextOptional?.userAgent ?? null,
      });

      return product;
    });

    return created;
  } catch (error: any) {
    if (error?.code === 'P2002') {
      // Check which field caused the unique constraint violation
      if (error?.meta?.target?.includes('barcode')) {
        throw Errors.conflict('A product with this barcode already exists for this tenant.');
      }
      throw Errors.conflict('A product with this SKU already exists for this tenant.');
    }
    throw error;
  }
}

/** Optimistic concurrency with audit */
export async function updateProductForCurrentTenantService(params: {
  currentTenantId: string;
  productIdPathParam: string;
  productNameInputValue?: string;
  productPricePenceInputValue?: number;
  barcode?: string | null | undefined;
  barcodeType?: string | null | undefined;
  currentEntityVersionInputValue: number;
  auditContextOptional?: AuditCtx;
}) {
  const {
    currentTenantId,
    productIdPathParam,
    productNameInputValue,
    productPricePenceInputValue,
    barcode,
    barcodeType,
    currentEntityVersionInputValue,
    auditContextOptional,
  } = params;

  return await prismaClientInstance.$transaction(async (tx) => {
    // Snapshot "before"
    const before = await tx.product.findFirst({
      where: { id: productIdPathParam, tenantId: currentTenantId },
      select: {
        id: true,
        tenantId: true,
        productName: true,
        productSku: true,
        productPricePence: true,
        barcode: true,
        barcodeType: true,
        isArchived: true,
        archivedAt: true,
        archivedByUserId: true,
        entityVersion: true,
        updatedAt: true,
        createdAt: true,
      },
    });
    if (!before) throw Errors.notFound('Product not found.');

    // Build updates object - handle optional and nullable fields correctly
    const updates: Prisma.ProductUpdateManyMutationInput = {
      entityVersion: { increment: 1 },
    };

    if (productNameInputValue !== undefined) {
      updates.productName = productNameInputValue;
    }
    if (productPricePenceInputValue !== undefined) {
      updates.productPricePence = productPricePenceInputValue;
    }
    if ('barcode' in params) {
      updates.barcode = barcode || null;
    }
    if ('barcodeType' in params) {
      updates.barcodeType = barcodeType || null;
    }

    const updateResult = await tx.product.updateMany({
      where: {
        id: productIdPathParam,
        tenantId: currentTenantId,
        entityVersion: currentEntityVersionInputValue,
      },
      data: updates,
    });

    if (updateResult.count === 0) {
      throw Errors.conflict('The product was modified by someone else. Please reload and try again.');
    }

    const after = await tx.product.findFirst({
      where: { id: productIdPathParam, tenantId: currentTenantId },
      select: {
        id: true,
        tenantId: true,
        productName: true,
        productSku: true,
        productPricePence: true,
        barcode: true,
        barcodeType: true,
        isArchived: true,
        archivedAt: true,
        archivedByUserId: true,
        entityVersion: true,
        updatedAt: true,
        createdAt: true,
      },
    });
    if (!after) throw Errors.notFound('Product not found.');

    // AUDIT: UPDATE
    await writeAuditEvent(tx, {
      tenantId: currentTenantId,
      actorUserId: auditContextOptional?.actorUserId ?? null,
      entityType: AuditEntityType.PRODUCT,
      entityId: after.id,
      action: AuditAction.UPDATE,
      entityName: after.productName,
      before,
      after,
      correlationId: auditContextOptional?.correlationId ?? null,
      ip: auditContextOptional?.ip ?? null,
      userAgent: auditContextOptional?.userAgent ?? null,
    });

    return after;
  });
}

/**
 * Archive product (soft delete) - preserves historical data and relationships
 */
export async function deleteProductForCurrentTenantService(params: {
  currentTenantId: string;
  productIdPathParam: string;
  currentUserIdOptional?: string;
  auditContextOptional?: AuditCtx;
}) {
  const { currentTenantId, productIdPathParam, currentUserIdOptional, auditContextOptional } = params;

  return await prismaClientInstance.$transaction(async (tx) => {
    // Snapshot "before"
    const before = await tx.product.findFirst({
      where: { id: productIdPathParam, tenantId: currentTenantId },
      select: {
        id: true,
        tenantId: true,
        productName: true,
        productSku: true,
        productPricePence: true,
        barcode: true,
        barcodeType: true,
        isArchived: true,
        archivedAt: true,
        archivedByUserId: true,
        entityVersion: true,
        updatedAt: true,
        createdAt: true,
      },
    });
    if (!before) throw Errors.notFound('Product not found.');

    // Archive instead of delete (soft delete)
    const res = await tx.product.updateMany({
      where: { id: productIdPathParam, tenantId: currentTenantId },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        archivedByUserId: currentUserIdOptional ?? null,
      },
    });
    if (res.count === 0) throw Errors.notFound('Product not found.');

    const after = await tx.product.findFirst({
      where: { id: productIdPathParam, tenantId: currentTenantId },
      select: {
        id: true,
        tenantId: true,
        productName: true,
        productSku: true,
        productPricePence: true,
        barcode: true,
        barcodeType: true,
        isArchived: true,
        archivedAt: true,
        archivedByUserId: true,
        entityVersion: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    // AUDIT: DELETE (archival)
    await writeAuditEvent(tx, {
      tenantId: currentTenantId,
      actorUserId: auditContextOptional?.actorUserId ?? null,
      entityType: AuditEntityType.PRODUCT,
      entityId: before.id,
      action: AuditAction.DELETE,
      entityName: before.productName,
      before,
      after,
      correlationId: auditContextOptional?.correlationId ?? null,
      ip: auditContextOptional?.ip ?? null,
      userAgent: auditContextOptional?.userAgent ?? null,
    });

    return { hasDeletedProduct: true };
  });
}

/**
 * Restore archived product
 */
export async function restoreProductForCurrentTenantService(params: {
  currentTenantId: string;
  productIdPathParam: string;
  auditContextOptional?: AuditCtx;
}) {
  const { currentTenantId, productIdPathParam, auditContextOptional } = params;

  return await prismaClientInstance.$transaction(async (tx) => {
    // Snapshot "before"
    const before = await tx.product.findFirst({
      where: { id: productIdPathParam, tenantId: currentTenantId, isArchived: true },
      select: {
        id: true,
        tenantId: true,
        productName: true,
        productSku: true,
        productPricePence: true,
        barcode: true,
        barcodeType: true,
        isArchived: true,
        archivedAt: true,
        archivedByUserId: true,
        entityVersion: true,
        updatedAt: true,
        createdAt: true,
      },
    });
    if (!before) throw Errors.notFound('Archived product not found.');

    // Restore: clear archive fields
    const res = await tx.product.updateMany({
      where: { id: productIdPathParam, tenantId: currentTenantId },
      data: {
        isArchived: false,
        archivedAt: null,
        archivedByUserId: null,
      },
    });
    if (res.count === 0) throw Errors.notFound('Product not found.');

    const after = await tx.product.findFirst({
      where: { id: productIdPathParam, tenantId: currentTenantId },
      select: {
        id: true,
        tenantId: true,
        productName: true,
        productSku: true,
        productPricePence: true,
        barcode: true,
        barcodeType: true,
        isArchived: true,
        archivedAt: true,
        archivedByUserId: true,
        entityVersion: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    // AUDIT: UPDATE (restore)
    await writeAuditEvent(tx, {
      tenantId: currentTenantId,
      actorUserId: auditContextOptional?.actorUserId ?? null,
      entityType: AuditEntityType.PRODUCT,
      entityId: before.id,
      action: AuditAction.UPDATE,
      entityName: before.productName,
      before,
      after,
      correlationId: auditContextOptional?.correlationId ?? null,
      ip: auditContextOptional?.ip ?? null,
      userAgent: auditContextOptional?.userAgent ?? null,
    });

    return after;
  });
}

/**
 * Lookup product by barcode for the current tenant.
 * Optionally includes stock information if branchId is provided.
 */
export async function getProductByBarcodeForCurrentTenantService(params: {
  currentTenantId: string;
  barcodePathParam: string;
  branchIdOptional?: string;
}) {
  const { currentTenantId, barcodePathParam, branchIdOptional } = params;

  // Validate barcode parameter
  if (!barcodePathParam || barcodePathParam.trim().length === 0) {
    throw Errors.validation('Barcode parameter is required and cannot be empty.');
  }

  // Query product by barcode and tenant (exclude archived)
  const product = await prismaClientInstance.product.findFirst({
    where: {
      tenantId: currentTenantId,
      barcode: barcodePathParam,
      isArchived: false, // Exclude archived products from barcode lookup
    },
    select: {
      id: true,
      tenantId: true,
      productName: true,
      productSku: true,
      productPricePence: true,
      barcode: true,
      barcodeType: true,
      isArchived: true,
      archivedAt: true,
      archivedByUserId: true,
      entityVersion: true,
      updatedAt: true,
      createdAt: true,
    },
  });

  if (!product) {
    throw Errors.notFound(`Product with barcode '${barcodePathParam}' not found for this tenant.`);
  }

  // If branchId provided, include stock information
  let stockInfo: {
    branchId: string;
    branchName: string;
    qtyOnHand: number;
    qtyAllocated: number;
  } | null = null;

  if (branchIdOptional) {
    const productStock = await prismaClientInstance.productStock.findFirst({
      where: {
        tenantId: currentTenantId,
        branchId: branchIdOptional,
        productId: product.id,
      },
      select: {
        branchId: true,
        qtyOnHand: true,
        qtyAllocated: true,
        branch: {
          select: {
            branchName: true,
          },
        },
      },
    });

    if (productStock) {
      stockInfo = {
        branchId: productStock.branchId,
        branchName: productStock.branch.branchName,
        qtyOnHand: productStock.qtyOnHand,
        qtyAllocated: productStock.qtyAllocated,
      };
    }
  }

  return {
    ...product,
    stock: stockInfo,
  };
}
