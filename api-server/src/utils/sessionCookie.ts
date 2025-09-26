// src/utils/sessionCookie.ts
import jwt from 'jsonwebtoken'
import type { Response } from 'express'
import type { SessionJwtClaims } from './sessionTypes.js'
import { URL } from 'node:url'

const sessionCookieNameFromEnvironmentVariable =
  process.env.SESSION_COOKIE_NAME || 'mt_session'

const sessionJwtSecretFromEnvironmentVariable =
  process.env.SESSION_JWT_SECRET || 'dev-secret-change-me'

// Optional but recommended in hosted/staging/prod:
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN 
const API_ORIGIN = process.env.API_ORIGIN

function isCrossSite(): boolean {
  try {
    // If either origin is missing, assume same-site (local dev fallback)
    if (!FRONTEND_ORIGIN || !API_ORIGIN) return false
    const f = new URL(FRONTEND_ORIGIN)
    const a = new URL(API_ORIGIN)
    // Heuristic: different host or scheme => cross-site
    return f.protocol !== a.protocol || f.hostname !== a.hostname
  } catch {
    // If parsing fails, be conservative
    return true
  }
}

const useCrossSite = isCrossSite()

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
    secure: useCrossSite,                // must be true with SameSite=None
    sameSite: useCrossSite ? 'none' : 'none',
    path: '/',
    maxAge: 60 * 60 * 1000,             // 60 minutes in ms
  })
}

export function clearSessionCookie(res: Response) {
  // To reliably clear in cross-site contexts, the options must match
  res.clearCookie(getSessionCookieName(), {
    httpOnly: true,
    secure: useCrossSite,
    sameSite: useCrossSite ? 'none' : 'none',
    path: '/',
  })
}
