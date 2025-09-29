// api-server/src/middleware/sessionMiddleware.ts
import type { Request, Response, NextFunction } from "express";
import {
  getSessionCookieName,
  verifySignedSessionToken,
} from "../utils/sessionCookie.js";
import { Errors } from "../utils/httpErrors.js";

export function sessionMiddleware(
  request: Request,
  _response: Response,
  next: NextFunction
) {
  const sessionCookieNameValue = getSessionCookieName();
  const sessionCookieValue = request.cookies?.[sessionCookieNameValue];

  if (sessionCookieValue) {
    const verifiedClaims = verifySignedSessionToken(sessionCookieValue);
    if (verifiedClaims) {
      request.currentUserId = verifiedClaims.currentUserId;
      request.currentTenantId = verifiedClaims.currentTenantId;
    }
  }
  next();
}

export function requireAuthenticatedUserMiddleware(
  request: Request,
  _response: Response,
  next: NextFunction
) {
  const currentUserId: string | undefined = request.currentUserId;
  const currentTenantId: string | undefined = request.currentTenantId;
  if (!currentUserId || !currentTenantId) {
    return next(Errors.authRequired());
  }
  next();
}
