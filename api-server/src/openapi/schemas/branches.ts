// api-server/src/openapi/schemas/branches.ts
import { z } from 'zod';

export const ZodBranchRecord = z.object({
  id: z.string(),
  tenantId: z.string(),
  branchSlug: z.string(),
  branchName: z.string(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).openapi('BranchRecord');

export const ZodCreateBranchRequestBody = z.object({
  branchSlug: z.string().min(3).max(40),
  branchName: z.string().min(1).max(200),
  isActive: z.boolean().optional(),
}).openapi('CreateBranchRequestBody');

export const ZodUpdateBranchParams = z.object({
  branchId: z.string(),
}).openapi('UpdateBranchRouteParams');

export const ZodUpdateBranchRequestBody = z.object({
  branchSlug: z.string().min(3).max(40).optional(),
  branchName: z.string().min(1).max(200).optional(),
  isActive: z.boolean().optional(),
}).openapi('UpdateBranchRequestBody');

export const ZodListBranchesQuery = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  cursorId: z.string().optional(),
  q: z.string().optional(),
  isActive: z.boolean().optional(),
  sortBy: z.enum(['branchName', 'createdAt', 'updatedAt', 'isActive']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  includeTotal: z.boolean().optional(),
}).openapi('ListBranchesQuery');

export const ZodBranchesListResponseData = z.object({
  items: z.array(ZodBranchRecord),
  pageInfo: z.object({
    hasNextPage: z.boolean(),
    nextCursor: z.string().nullable().optional(),
    totalCount: z.number().int().min(0).optional(),
  }),
  applied: z.object({
    limit: z.number().int().min(1).max(100),
    sort: z.object({
      field: z.enum(['branchName', 'createdAt', 'updatedAt', 'isActive']),
      direction: z.enum(['asc', 'desc']),
    }),
    filters: z.object({
      q: z.string().optional(),
      isActive: z.boolean().optional(),
    }),
  }),
}).openapi('BranchesListResponseData');
