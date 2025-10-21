/**
 * Authentication test helpers
 * Utilities for creating authenticated requests in tests
 */

import jwt from 'jsonwebtoken';
import type { SuperTest, Test } from 'supertest';

const SESSION_JWT_SECRET = process.env.SESSION_JWT_SECRET || 'test-secret-do-not-use-in-production';
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'mt_session';

interface SessionPayload {
  currentUserId: string;
  currentTenantId: string;
  issuedAtUnixSeconds: number;
}

/**
 * Generate a session token for testing
 */
export function generateSessionToken(
  userId: string,
  tenantId: string
): string {
  const payload: SessionPayload = {
    currentUserId: userId,
    currentTenantId: tenantId,
    issuedAtUnixSeconds: Math.floor(Date.now() / 1000),
  };

  return jwt.sign(payload, SESSION_JWT_SECRET, {
    expiresIn: '24h',
  });
}

/**
 * Create a session cookie string for testing
 */
export function createSessionCookie(userId: string, tenantId: string): string {
  const token = generateSessionToken(userId, tenantId);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

/**
 * Make an authenticated GET request
 */
export function authenticatedGet(
  request: SuperTest<Test>,
  url: string,
  userId: string,
  tenantId: string
) {
  const cookie = createSessionCookie(userId, tenantId);
  return request.get(url).set('Cookie', cookie);
}

/**
 * Make an authenticated POST request
 */
export function authenticatedPost(
  request: SuperTest<Test>,
  url: string,
  userId: string,
  tenantId: string,
  body?: any
) {
  const cookie = createSessionCookie(userId, tenantId);
  const req = request.post(url).set('Cookie', cookie);
  if (body) {
    req.send(body);
  }
  return req;
}

/**
 * Make an authenticated PUT request
 */
export function authenticatedPut(
  request: SuperTest<Test>,
  url: string,
  userId: string,
  tenantId: string,
  body?: any
) {
  const cookie = createSessionCookie(userId, tenantId);
  const req = request.put(url).set('Cookie', cookie);
  if (body) {
    req.send(body);
  }
  return req;
}

/**
 * Make an authenticated DELETE request
 */
export function authenticatedDelete(
  request: SuperTest<Test>,
  url: string,
  userId: string,
  tenantId: string
) {
  const cookie = createSessionCookie(userId, tenantId);
  return request.delete(url).set('Cookie', cookie);
}

/**
 * Decode a session token (for testing)
 */
export function decodeSessionToken(token: string): SessionPayload {
  return jwt.verify(token, SESSION_JWT_SECRET) as SessionPayload;
}

/**
 * Extract session cookie from response
 */
export function extractSessionCookie(response: any): string | null {
  const cookies = response.headers['set-cookie'];
  if (!cookies) return null;

  const sessionCookie = cookies.find((cookie: string) =>
    cookie.startsWith(SESSION_COOKIE_NAME)
  );

  if (!sessionCookie) return null;

  // Extract just the cookie value (without attributes)
  const match = sessionCookie.match(
    new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`)
  );
  return match ? match[1] : null;
}
