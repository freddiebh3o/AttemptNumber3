// api-server/src/openapi/schemas/branches.ts
import { z } from 'zod';

export const ZodBranchRecord = z.object({
  id: z.string(),
  tenantId: z.string(),
  branchSlug: z.string(),
  branchName: z.string(),
  isActive: z.boolean(),
  isArchived: z.boolean(),
  archivedAt: z.string().datetime().nullable(),
  archivedByUserId: z.string().nullable(),
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
  archivedFilter: z.enum(['active-only', 'archived-only', 'all']).optional(),
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
      archivedFilter: z.enum(['active-only', 'archived-only', 'all']).optional(),
    }),
  }),
}).openapi('BranchesListResponseData');

// ----- NEW: single branch get -----
export const ZodGetBranchResponseData = z
  .object({ branch: ZodBranchRecord })
  .openapi('GetBranchResponseData');

// ----- NEW: Branch Activity -----
export const ZodBranchActivityActor = z
  .object({ userId: z.string(), display: z.string() })
  .nullable()
  .openapi('BranchActivityActor');

export const ZodBranchActivityItem = z.object({
  kind: z.literal('audit'),
  id: z.string(),
  when: z.string().datetime(),
  action: z.string(),
  message: z.string(),
  messageParts: z.record(z.string(), z.unknown()).optional(),
  actor: ZodBranchActivityActor.optional(),
  correlationId: z.string().nullable().optional(),
  entityName: z.string().nullable().optional(),
}).openapi('BranchActivityItem');

export const ZodBranchActivityQuery = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
  occurredFrom: z.string().datetime().optional(),
  occurredTo: z.string().datetime().optional(),
  actorIds: z.string().optional().openapi({ description: 'CSV of user IDs to filter by' }),
  includeFacets: z.boolean().optional(),
  includeTotal: z.boolean().optional(),
}).openapi('BranchActivityQuery');

export const ZodBranchActivityResponseData = z.object({
  items: z.array(ZodBranchActivityItem),
  pageInfo: z.object({
    hasNextPage: z.boolean(),
    nextCursor: z.string().nullable().optional(),
    totalCount: z.number().int().min(0).optional(),
  }),
  facets: z.object({
    actors: z.array(z.object({ userId: z.string(), display: z.string() })),
  }).optional(),
}).openapi('BranchActivityResponseData');
