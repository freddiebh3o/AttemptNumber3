import { z } from 'zod';
import { ZodRoleName } from './common.js';
import { ZodPermissionKey } from '../components/rbac.js';

export const ZodSignInRequestBody = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
    tenantSlug: z.string().min(1),
  })
  .openapi('SignInRequestBody');

export const ZodTenantMembership = z
  .object({
    tenantSlug: z.string(),
    roleName: ZodRoleName,
  })
  .openapi('TenantMembership');

  export const ZodMeResponseData = z.object({
    user: z.object({
      id: z.string(),
      userEmailAddress: z.string().email(),
    }),
    tenantMemberships: z.array(
      z.object({
        tenantSlug: z.string(),
        roleName: z.enum(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']).nullable().optional(), // legacy while migrating
      })
    ),
    currentTenant: z.object({
      tenantId: z.string(),
      tenantSlug: z.string(),
      roleName: z.enum(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']).nullable().optional(),
    }).nullable(),
    permissionsCurrentTenant: z.array(ZodPermissionKey),
  }).openapi('MeResponseData');

export const ZodSwitchTenantRequestBody = z
  .object({
    tenantSlug: z.string().min(1),
  })
  .openapi('SwitchTenantRequestBody');

export const ZodSwitchTenantResponseData = z
  .object({
    hasSwitchedTenant: z.boolean(),
  })
  .openapi('SwitchTenantResponseData');
