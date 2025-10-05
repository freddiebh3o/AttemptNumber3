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
    where: { id: productIdPathParam, tenantId: currentTenantId },
    select: {
      id: true,
      productName: true,
      productSku: true,
      productPricePence: true,
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

  const where: Prisma.ProductWhereInput = {
    tenantId: currentTenantId,
    ...priceFilter,
    ...createdAtFilter,
    ...updatedAtFilter,
    ...searchFilter,
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
  auditContextOptional?: AuditCtx;
}) {
  const {
    currentTenantId,
    productNameInputValue,
    productSkuInputValue,
    productPricePenceInputValue,
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
        },
        select: {
          id: true,
          tenantId: true,
          productName: true,
          productSku: true,
          productPricePence: true,
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
  currentEntityVersionInputValue: number;
  auditContextOptional?: AuditCtx;
}) {
  const {
    currentTenantId,
    productIdPathParam,
    productNameInputValue,
    productPricePenceInputValue,
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
        entityVersion: true,
        updatedAt: true,
        createdAt: true,
      },
    });
    if (!before) throw Errors.notFound('Product not found.');

    const updateResult = await tx.product.updateMany({
      where: {
        id: productIdPathParam,
        tenantId: currentTenantId,
        entityVersion: currentEntityVersionInputValue,
      },
      data: {
        ...(productNameInputValue !== undefined ? { productName: productNameInputValue } : {}),
        ...(productPricePenceInputValue !== undefined
          ? { productPricePence: productPricePenceInputValue }
          : {}),
        entityVersion: { increment: 1 },
      },
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

export async function deleteProductForCurrentTenantService(params: {
  currentTenantId: string;
  productIdPathParam: string;
  auditContextOptional?: AuditCtx;
}) {
  const { currentTenantId, productIdPathParam, auditContextOptional } = params;

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
        entityVersion: true,
        updatedAt: true,
        createdAt: true,
      },
    });
    if (!before) throw Errors.notFound('Product not found.');

    const res = await tx.product.deleteMany({
      where: { id: productIdPathParam, tenantId: currentTenantId },
    });
    if (res.count === 0) throw Errors.notFound('Product not found.');

    // AUDIT: DELETE
    await writeAuditEvent(tx, {
      tenantId: currentTenantId,
      actorUserId: auditContextOptional?.actorUserId ?? null,
      entityType: AuditEntityType.PRODUCT,
      entityId: before.id,
      action: AuditAction.DELETE,
      entityName: before.productName,
      before,
      after: null,
      correlationId: auditContextOptional?.correlationId ?? null,
      ip: auditContextOptional?.ip ?? null,
      userAgent: auditContextOptional?.userAgent ?? null,
    });

    return { hasDeletedProduct: true };
  });
}
