/* api-server/src/openapi/schemas/auth.ts */
import { z } from 'zod';
import { ZodPermissionKey } from '../components/rbac.js';

export const ZodSignInRequestBody = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
    tenantSlug: z.string().min(1),
  })
  .openapi('SignInRequestBody');

// Minimal role shape returned by /me
export const ZodRoleBrief = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .openapi('RoleBrief');

export const ZodTenantMembership = z
  .object({
    tenantSlug: z.string(),
    role: ZodRoleBrief, // role assigned within that tenant
  })
  .openapi('TenantMembership');

export const ZodMeResponseData = z
  .object({
    user: z.object({
      id: z.string(),
      userEmailAddress: z.string().email(),
    }),
    tenantMemberships: z.array(ZodTenantMembership),
    currentTenant: z
      .object({
        tenantId: z.string(),
        tenantSlug: z.string(),
        role: ZodRoleBrief,
      })
      .nullable(),
    permissionsCurrentTenant: z.array(ZodPermissionKey),
  })
  .openapi('MeResponseData');

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
