// api-server/src/middleware/sessionMiddleware.ts
import type { Request, Response, NextFunction } from "express";
import {
  getSessionCookieName,
  verifySignedSessionToken,
} from "../utils/sessionCookie.js";

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
      (request as any).currentUserId = verifiedClaims.currentUserId;
      (request as any).currentTenantId = verifiedClaims.currentTenantId;
    }
  }
  next();
}

export function requireAuthenticatedUserMiddleware(
  request: Request,
  _response: Response,
  next: NextFunction
) {
  const currentUserId: string | undefined = (request as any).currentUserId;
  const currentTenantId: string | undefined = (request as any).currentTenantId;
  if (!currentUserId || !currentTenantId) {
    return next(
      new (class extends Error {
        httpStatusCode = 401;
        errorCode = "AUTH_REQUIRED";
        userFacingMessage = "Please sign in to continue.";
      })()
    );
  }
  next();
}
