import { z } from 'zod';
import { ZodRoleName } from './common.js';

export const ZodTenantUserRecord = z
  .object({
    userId: z.string(),
    userEmailAddress: z.string().email(),
    roleName: ZodRoleName,
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
  })
  .openapi('TenantUserRecord');

export const ZodTenantUsersList = z
  .object({
    users: z.array(ZodTenantUserRecord),
    nextCursorId: z.string().optional(),
  })
  .openapi('TenantUsersList');

export const ZodListTenantUsersQuery = z
  .object({
    limit: z.number().int().min(1).max(100).optional(),
    cursorId: z.string().optional(),
    // filters
    q: z.string().optional(),
    roleName: ZodRoleName.optional(),
    createdAtFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    createdAtTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    updatedAtFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    updatedAtTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    // sort
    sortBy: z.enum(['createdAt', 'updatedAt', 'userEmailAddress', 'roleName']).optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
    includeTotal: z.boolean().optional(),
  })
  .openapi('ListTenantUsersQuery');

export const ZodTenantUsersListResponseData = z
  .object({
    items: z.array(
      z.object({
        userId: z.string(),
        userEmailAddress: z.string().email(),
        roleName: ZodRoleName,
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
      })
    ),
    pageInfo: z.object({
      hasNextPage: z.boolean(),
      nextCursor: z.string().nullable().optional(),
      totalCount: z.number().int().min(0).optional(),
    }),
    applied: z.object({
      limit: z.number().int().min(1).max(100),
      sort: z.object({
        field: z.enum(['createdAt', 'updatedAt', 'userEmailAddress', 'roleName']),
        direction: z.enum(['asc', 'desc']),
      }),
      filters: z.object({
        q: z.string().optional(),
        roleName: ZodRoleName.optional(),
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
    roleName: ZodRoleName,
  })
  .openapi('CreateTenantUserBody');

export const ZodUpdateTenantUserBody = z
  .object({
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
    roleName: ZodRoleName.optional(),
  })
  .openapi('UpdateTenantUserBody');
