import { z } from 'zod';
import { ZodRoleName } from './common.js';

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
        roleName: ZodRoleName,
      })
      .nullable(),
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
