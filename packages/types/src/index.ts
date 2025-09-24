// packages/types/src/index.ts
export type TenantId = string & { readonly brand: unique symbol };

export type TenantSlug = string;
export type UserId = string;

export type UserRole = "OWNER" | "ADMIN" | "EDITOR";

export interface SessionUser {
  id: UserId;
  email: string;
  role: UserRole;
  tenantId: TenantId;
  tenantSlug: TenantSlug;
}
