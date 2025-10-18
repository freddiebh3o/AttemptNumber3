// api-server/src/openapi/schemas/tenantUsers.ts
import { z } from "zod";
import { ZodPermissionKey } from "../components/rbac.js";

export const ZodBranchSummary = z
  .object({
    id: z.string(),
    branchName: z.string(),
    isActive: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("BranchSummary");

export const ZodRoleSummary = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    isSystem: z.boolean(),
    tenantId: z.string(),
    permissions: z.array(ZodPermissionKey),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("RoleSummary");

export const ZodTenantUserRecord = z
  .object({
    userId: z.string(),
    userEmailAddress: z.string().email(),
    role: ZodRoleSummary.nullable(),
    branches: z.array(ZodBranchSummary).default([]),
    isArchived: z.boolean(),
    archivedAt: z.string().datetime().nullable(),
    archivedByUserId: z.string().nullable(),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
  })
  .openapi("TenantUserRecord");

export const ZodListTenantUsersQuery = z
  .object({
    limit: z.number().int().min(1).max(100).optional(),
    cursorId: z.string().optional(),
    q: z.string().optional(),
    roleIds: z.string().optional(),
    archivedFilter: z.enum(["active-only", "archived-only", "all"]).optional(),
    createdAtFrom: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    createdAtTo: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    updatedAtFrom: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    updatedAtTo: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    sortBy: z
      .enum(["createdAt", "updatedAt", "userEmailAddress", "role"])
      .optional(),
    sortDir: z.enum(["asc", "desc"]).optional(),
    includeTotal: z.boolean().optional(),
  })
  .openapi("ListTenantUsersQuery");

export const ZodTenantUsersListResponseData = z
  .object({
    items: z.array(ZodTenantUserRecord),
    pageInfo: z.object({
      hasNextPage: z.boolean(),
      nextCursor: z.string().nullable().optional(),
      totalCount: z.number().int().min(0).optional(),
    }),
    applied: z.object({
      limit: z.number().int().min(1).max(100),
      sort: z.object({
        field: z.enum(["createdAt", "updatedAt", "userEmailAddress", "role"]),
        direction: z.enum(["asc", "desc"]),
      }),
      filters: z.object({
        q: z.string().optional(),
        roleIds: z.array(z.string()).optional(),
        createdAtFrom: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        createdAtTo: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        updatedAtFrom: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        updatedAtTo: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      }),
    }),
  })
  .openapi("TenantUsersListResponseData");

export const ZodCreateTenantUserBody = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
    roleId: z.string(),
    branchIds: z.array(z.string()).optional(),
  })
  .openapi("CreateTenantUserBody");

export const ZodUpdateTenantUserBody = z
  .object({
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
    roleId: z.string().optional(),
    branchIds: z.array(z.string()).optional(),
  })
  .openapi("UpdateTenantUserBody");

export const ZodTenantUserActivityItem = z
  .object({
    kind: z.literal("audit"),
    id: z.string(),
    when: z.string().datetime(),
    action: z.string(),
    message: z.string(),
    messageParts: z.object({}).catchall(z.any()).nullable().optional(),
    actor: z
      .object({
        userId: z.string(),
        display: z.string(),
      })
      .nullable()
      .optional(),
    correlationId: z.string().nullable().optional(),
  })
  .openapi("TenantUserActivityItem");

export const ZodListTenantUserActivityQuery = z
  .object({
    limit: z.number().int().min(1).max(100).optional(),
    cursor: z.string().optional(),
    actorIds: z.string().optional(), // CSV
    occurredFrom: z.string().optional(), // ISO or YYYY-MM-DD
    occurredTo: z.string().optional(),
    includeFacets: z.boolean().optional(),
    includeTotal: z.boolean().optional(),
  })
  .openapi("ListTenantUserActivityQuery");

export const ZodTenantUserActivityResponseData = z
  .object({
    items: z.array(ZodTenantUserActivityItem),
    pageInfo: z.object({
      hasNextPage: z.boolean(),
      nextCursor: z.string().nullable().optional(),
      totalCount: z.number().int().min(0).optional(),
    }),
    facets: z
      .object({
        actors: z.array(z.object({ userId: z.string(), display: z.string() })),
      })
      .optional(),
    applied: z.object({
      limit: z.number().int().min(1).max(100),
      filters: z.object({
        actorIds: z.array(z.string()).optional(),
        occurredFrom: z.string().optional(),
        occurredTo: z.string().optional(),
      }),
    }),
  })
  .openapi("TenantUserActivityResponseData");
