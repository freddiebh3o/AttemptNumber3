import type { SessionUser } from "@acme/types";

declare global {
  namespace Express {
    interface Request {
      context?: {
        tenantId: string;
        tenantSlug: string;
        user?: SessionUser; // we'll fill this in Phase 3 (auth)
      };
    }
  }
}
export {};
