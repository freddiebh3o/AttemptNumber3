// api-server/src/openapi/schemas/tenantUsers.ts
import { z } from 'zod';
import { ZodPermissionKey } from '../components/rbac.js';

export const ZodRoleSummary = z
  .object({
    id: z.string(),
    name: z.string(), // free-form to support custom roles
    description: z.string().nullable(),
    isSystem: z.boolean(),
    tenantId: z.string(),
    permissions: z.array(ZodPermissionKey),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('RoleSummary');

export const ZodTenantUserRecord = z
  .object({
    userId: z.string(),
    userEmailAddress: z.string().email(),
    role: ZodRoleSummary.nullable(),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
  })
  .openapi('TenantUserRecord');

export const ZodListTenantUsersQuery = z
  .object({
    limit: z.number().int().min(1).max(100).optional(),
    cursorId: z.string().optional(),
    // filters
    q: z.string().optional(),
    roleId: z.string().optional(),
    roleName: z.string().optional(), // optional "contains" filter on role.name
    createdAtFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    createdAtTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    updatedAtFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    updatedAtTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    // sort
    sortBy: z.enum(['createdAt', 'updatedAt', 'userEmailAddress', 'role']).optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
    includeTotal: z.boolean().optional(),
  })
  .openapi('ListTenantUsersQuery');

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
        field: z.enum(['createdAt', 'updatedAt', 'userEmailAddress', 'role']),
        direction: z.enum(['asc', 'desc']),
      }),
      filters: z.object({
        q: z.string().optional(),
        roleId: z.string().optional(),
        roleName: z.string().optional(),
        createdAtFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        createdAtTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        updatedAtFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        updatedAtTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }),
    }),
  })
  .openapi('TenantUsersListResponseData');

export const ZodCreateTenantUserBody = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
    roleId: z.string(),
  })
  .openapi('CreateTenantUserBody');

export const ZodUpdateTenantUserBody = z
  .object({
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
    roleId: z.string().optional(),
  })
  .openapi('UpdateTenantUserBody');
