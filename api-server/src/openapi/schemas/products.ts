// api-server/src/openapi/schemas/products.ts
import { z } from 'zod';

export const ZodProductRecord = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    productName: z.string(),
    productSku: z.string(),
    productPricePence: z.number().int(),
    entityVersion: z.number().int(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('ProductRecord');

export const ZodCreateProductRequestBody = z
  .object({
    productName: z.string().min(1).max(200),
    productSku: z.string().min(1).max(100),
    productPricePence: z.number().int().min(0),
  })
  .openapi('CreateProductRequestBody');

export const ZodUpdateProductParams = z
  .object({
    productId: z.string(),
  })
  .openapi('UpdateProductRouteParams');

export const ZodUpdateProductRequestBody = z
  .object({
    productName: z.string().min(1).max(200).optional(),
    productPricePence: z.number().int().min(0).optional(),
    currentEntityVersion: z.number().int().min(1),
  })
  .openapi('UpdateProductRequestBody');

export const ZodListProductsQuery = z
  .object({
    limit: z.number().int().min(1).max(100).optional(),
    cursorId: z.string().optional(),
    // filters
    q: z.string().optional(),
    minPricePence: z.number().int().min(0).optional(),
    maxPricePence: z.number().int().min(0).optional(),
    createdAtFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    createdAtTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    updatedAtFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    updatedAtTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    // sort
    sortBy: z
      .enum(['createdAt', 'updatedAt', 'productName', 'productPricePence'])
      .optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
    includeTotal: z.boolean().optional(),
  })
  .openapi('ListProductsQuery');

export const ZodProductsListResponseData = z
  .object({
    items: z.array(ZodProductRecord),
    pageInfo: z.object({
      hasNextPage: z.boolean(),
      nextCursor: z.string().nullable().optional(),
      totalCount: z.number().int().min(0).optional(),
    }),
    applied: z.object({
      limit: z.number().int().min(1).max(100),
      sort: z.object({
        field: z.enum([
          'createdAt',
          'updatedAt',
          'productName',
          'productPricePence',
        ]),
        direction: z.enum(['asc', 'desc']),
      }),
      filters: z.object({
        q: z.string().optional(),
        minPricePence: z.number().int().min(0).optional(),
        maxPricePence: z.number().int().min(0).optional(),
        createdAtFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        createdAtTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        updatedAtFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        updatedAtTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }),
    }),
  })
  .openapi('ProductsListResponseData');
