// api-server/src/types/request.ts
import type { Request } from "express";

export type AuthedRequest = Request & {
  currentUserId: string;
  currentTenantId: string;
};

export type WithBody<T> = Request & { validatedBody: T };
export type WithQuery<T> = Request & { validatedQuery: T };
export type WithParams<T> = Request & { validatedParams: T };
