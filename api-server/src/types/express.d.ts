// api-server/src/types/express.d.ts
import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    // Auth/session context
    currentUserId?: string;
    currentTenantId?: string;
    correlationId?: string;

    // Zod-validated request data (filled by your validators)
    validatedBody?: unknown;
    validatedQuery?: unknown;
    validatedParams?: unknown;
  }
}
