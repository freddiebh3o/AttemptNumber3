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

export type PostStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export interface PostDTO {
  id: string;
  tenantId: string;
  authorId: string;
  title: string;
  content?: string | null;
  status: PostStatus;
  createdAt: string;
  updatedAt: string;
}
