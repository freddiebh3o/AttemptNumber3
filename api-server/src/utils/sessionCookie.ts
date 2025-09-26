// src/utils/sessionCookie.ts
import jwt from 'jsonwebtoken'
import type { Response } from 'express'
import type { SessionJwtClaims } from './sessionTypes.js'

const sessionCookieNameFromEnvironmentVariable =
  process.env.SESSION_COOKIE_NAME || 'mt_session'

const sessionJwtSecretFromEnvironmentVariable =
  process.env.SESSION_JWT_SECRET || 'dev-secret-change-me'

  const sameSiteMode = process.env.COOKIE_SAMESITE_MODE === 'lax' ? 'lax' : 'none';

const toSeconds = (minutes: number) => minutes * 60

export function getSessionCookieName(): string {
  return sessionCookieNameFromEnvironmentVariable
}

export function createSignedSessionToken(sessionJwtClaims: SessionJwtClaims): string {
  return jwt.sign(sessionJwtClaims, sessionJwtSecretFromEnvironmentVariable, {
    algorithm: 'HS256',
    expiresIn: toSeconds(60), // 60 minutes
  })
}

export function verifySignedSessionToken(sessionTokenValue: string): SessionJwtClaims | null {
  try {
    const decoded = jwt.verify(sessionTokenValue, sessionJwtSecretFromEnvironmentVariable) as jwt.JwtPayload
    return {
      currentUserId: String(decoded.currentUserId),
      currentTenantId: String(decoded.currentTenantId),
      issuedAtUnixSeconds: Number(decoded.iat ?? 0),
    }
  } catch {
    return null
  }
}

export function setSignedSessionCookie(res: Response, token: string) {
  res.cookie(getSessionCookieName(), token, {
    httpOnly: true,
    secure: sameSiteMode === 'none',
    sameSite: sameSiteMode,
    path: '/',
    maxAge: 60 * 60 * 1000,             // 60 minutes in ms
  })
}

export function clearSessionCookie(res: Response) {
  // To reliably clear in cross-site contexts, the options must match
  res.clearCookie(getSessionCookieName(), {
    httpOnly: true,
    secure: sameSiteMode === 'none',
    sameSite: sameSiteMode,
    path: '/',
  })
}
