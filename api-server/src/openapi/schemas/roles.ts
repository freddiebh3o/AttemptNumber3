// api-server/src/openapi/schemas/roles.ts
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { ZodPermissionKey } from '../components/rbac.js';

extendZodWithOpenApi(z);

export const ZodRoleIdParam = z.object({ roleId: z.string().min(1) }).openapi('RoleIdParam');

export const ZodPermissionRecord = z.object({
  id: z.string(),
  key: z.string(),
  description: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).openapi('PermissionRecord');

export const ZodRoleRecord = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isSystem: z.boolean(),
  permissions: z.array(ZodPermissionKey),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).openapi('RoleRecord');

export const ZodListRolesQuery = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  cursorId: z.string().optional(),
  // filters
  q: z.string().optional(),
  name: z.string().optional(),
  isSystem: z.coerce.boolean().optional(),
  createdAtFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  createdAtTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  updatedAtFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  updatedAtTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // sort
  sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'isSystem']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  includeTotal: z.boolean().optional(),
}).openapi('ListRolesQuery');

export const ZodRolesListResponseData = z.object({
  items: z.array(ZodRoleRecord),
  pageInfo: z.object({
    hasNextPage: z.boolean(),
    nextCursor: z.string().nullable().optional(),
    totalCount: z.number().int().min(0).optional(),
  }),
  applied: z.object({
    limit: z.number().int().min(1).max(100),
    sort: z.object({
      field: z.enum(['name', 'createdAt', 'updatedAt', 'isSystem']),
      direction: z.enum(['asc', 'desc']),
    }),
    filters: z.object({
      q: z.string().optional(),
      name: z.string().optional(),
      isSystem: z.boolean().optional(),
      createdAtFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      createdAtTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      updatedAtFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      updatedAtTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }),
  }),
}).openapi('RolesListResponseData');

export const ZodCreateRoleBody = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  permissionKeys: z.array(ZodPermissionKey).min(0),
}).openapi('CreateRoleBody');

export const ZodUpdateRoleBody = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  permissionKeys: z.array(ZodPermissionKey).min(0).optional(),
}).openapi('UpdateRoleBody');
