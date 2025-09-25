import jwt from "jsonwebtoken";
import type { SessionJwtClaims } from "./sessionTypes.js";

const sessionCookieNameFromEnvironmentVariable: string =
  process.env.SESSION_COOKIE_NAME || "mt_session";
const sessionJwtSecretFromEnvironmentVariable: string =
  process.env.SESSION_JWT_SECRET || "dev-secret-change-me";

const toSeconds = (minutes: number) => minutes * 60;

export function getSessionCookieName(): string {
  return sessionCookieNameFromEnvironmentVariable;
}

export function createSignedSessionToken(
  sessionJwtClaims: SessionJwtClaims
): string {
  return jwt.sign(sessionJwtClaims, sessionJwtSecretFromEnvironmentVariable, {
    algorithm: "HS256",
    expiresIn: toSeconds(60), 
  });
}

export function verifySignedSessionToken(
  sessionTokenValue: string
): SessionJwtClaims | null {
  try {
    const decoded = jwt.verify(
      sessionTokenValue,
      sessionJwtSecretFromEnvironmentVariable
    ) as jwt.JwtPayload;
    return {
      currentUserId: String(decoded.currentUserId),
      currentTenantId: String(decoded.currentTenantId),
      issuedAtUnixSeconds: Number(decoded.iat ?? 0),
    };
  } catch {
    return null;
  }
}
