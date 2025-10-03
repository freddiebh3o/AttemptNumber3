// api-server/src/services/productService.ts
import { prismaClientInstance } from '../db/prismaClient.js';
import { Errors } from '../utils/httpErrors.js';
import type { Prisma } from '@prisma/client';

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

  // Price range (in pence)
  const priceFilter: Prisma.ProductWhereInput =
    minPricePenceOptional !== undefined || maxPricePenceOptional !== undefined
      ? {
          productPricePence: {
            ...(minPricePenceOptional !== undefined ? { gte: minPricePenceOptional } : {}),
            ...(maxPricePenceOptional !== undefined ? { lte: maxPricePenceOptional } : {}),
          },
        }
      : {};

  // CreatedAt (inclusive dates)
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

  // UpdatedAt (inclusive dates)
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

  // Text search (name or SKU)
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

  // --- ORDER BY with deterministic tie-breaker ---
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = [
    { [sortBy]: sortDir } as Prisma.ProductOrderByWithRelationInput,
    { id: sortDir },
  ];

  // --- Cursor pagination with look-ahead ---
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
    findArgs.skip = 1; // exclude the cursor row itself
  }

  const rows = await prismaClientInstance.product.findMany(findArgs);

  // Look-ahead: if we got > limit, there is a next page
  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const nextCursor = hasNextPage ? items[items.length - 1]?.id ?? null : null;

  // Optional total
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
}) {
  const {
    currentTenantId,
    productNameInputValue,
    productSkuInputValue,
    productPricePenceInputValue,
  } = params;
  try {
    const created = await prismaClientInstance.product.create({
      data: {
        tenantId: currentTenantId,
        productName: productNameInputValue,
        productSku: productSkuInputValue,
        productPricePence: productPricePenceInputValue,
      },
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
    return created;
  } catch (error: any) {
    // Unique SKU per tenant
    if (error?.code === 'P2002') {
      throw Errors.conflict('A product with this SKU already exists for this tenant.');
    }
    throw error;
  }
}

/**
 * Optimistic concurrency
 */
export async function updateProductForCurrentTenantService(params: {
  currentTenantId: string;
  productIdPathParam: string;
  productNameInputValue?: string;
  productPricePenceInputValue?: number;
  currentEntityVersionInputValue: number;
}) {
  const {
    currentTenantId,
    productIdPathParam,
    productNameInputValue,
    productPricePenceInputValue,
    currentEntityVersionInputValue,
  } = params;

  const updateResult = await prismaClientInstance.product.updateMany({
    where: {
      id: productIdPathParam,
      tenantId: currentTenantId,
      entityVersion: currentEntityVersionInputValue,
    },
    data: {
      ...(productNameInputValue !== undefined ? { productName: productNameInputValue } : {}),
      ...(productPricePenceInputValue !== undefined ? { productPricePence: productPricePenceInputValue } : {}),
      entityVersion: { increment: 1 },
    },
  });

  if (updateResult.count === 0) {
    throw Errors.conflict('The product was modified by someone else. Please reload and try again.');
  }

  const updated = await prismaClientInstance.product.findFirst({
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
  if (!updated) throw Errors.notFound('Product not found.');
  return updated;
}

export async function deleteProductForCurrentTenantService(params: {
  currentTenantId: string;
  productIdPathParam: string;
}) {
  const { currentTenantId, productIdPathParam } = params;
  const deleteResult = await prismaClientInstance.product.deleteMany({
    where: { id: productIdPathParam, tenantId: currentTenantId },
  });
  if (deleteResult.count === 0) throw Errors.notFound('Product not found.');
  return { hasDeletedProduct: true };
}
