// src/types/assertions.ts
import type { Request } from "express";
import type { AuthedRequest } from "./request.js";

// Narrows to an authenticated request (after your auth middleware)
export function assertAuthed(req: Request): asserts req is AuthedRequest {
  if (!req.currentUserId || !req.currentTenantId) {
    // At runtime this shouldn't happen because the auth middleware guards it.
    // Throwing keeps types + protects if someone reorders middleware.
    throw new Error("assertAuthed: missing auth context");
  }
}

// Narrows presence of a zod-validated Query
export function assertHasQuery<T>(
  req: Request
): asserts req is Request & { validatedQuery: T } {
  if (req.validatedQuery === undefined) {
    throw new Error("assertHasQuery: validatedQuery not set");
  }
}

// Same pattern exists if you want them for body/params:
export function assertHasBody<T>(
  req: Request
): asserts req is Request & { validatedBody: T } {
  if (req.validatedBody === undefined) {
    throw new Error("assertHasBody: validatedBody not set");
  }
}

export function assertHasParams<T>(
  req: Request
): asserts req is Request & { validatedParams: T } {
  if (req.validatedParams === undefined) {
    throw new Error("assertHasParams: validatedParams not set");
  }
}
