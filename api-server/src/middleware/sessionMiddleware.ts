// api-server/src/middleware/sessionMiddleware.ts
import type { Request, Response, NextFunction } from "express";
import {
  getSessionCookieName,
  verifySignedSessionToken,
} from "../utils/sessionCookie.js";
import { Errors } from "../utils/httpErrors.js";
import { prismaClientInstance } from "../db/prismaClient.js";

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

export async function requireAuthenticatedUserMiddleware(
  request: Request,
  _response: Response,
  next: NextFunction
) {
  const currentUserId: string | undefined = request.currentUserId;
  const currentTenantId: string | undefined = request.currentTenantId;
  if (!currentUserId || !currentTenantId) {
    return next(Errors.authRequired());
  }

  // Check if the user's membership is archived
  try {
    const membership = await prismaClientInstance.userTenantMembership.findUnique({
      where: {
        userId_tenantId: {
          userId: currentUserId,
          tenantId: currentTenantId,
        },
      },
      select: {
        isArchived: true,
      },
    });

    if (membership?.isArchived) {
      return next(Errors.authRequired('User membership has been archived. Please contact your administrator.'));
    }
  } catch (error) {
    // If there's a DB error, allow the request to proceed
    // (fail open to avoid blocking all requests if DB is down)
  }

  next();
}
