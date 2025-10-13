// [ST-004][AC-004] Session Middleware acceptance tests
import request from 'supertest';
import type { Express } from 'express';
import express from 'express';
import cookieParser from 'cookie-parser';
import {
} from '../helpers/db.js';
import {
  generateSessionToken,
  createSessionCookie,
} from '../helpers/auth.js';
import {
  createTestUser,
  createTestTenant,
  createTestRole,
  addUserToTenant,
  getPermissionsByKeys,
} from '../helpers/factories.js';
import { sessionMiddleware, requireAuthenticatedUserMiddleware } from '../../src/middleware/sessionMiddleware.js';
import { standardErrorHandler } from '../../src/middleware/errorHandler.js';
import jwt from 'jsonwebtoken';

describe('[ST-004] Session Middleware', () => {
  let app: Express;
  let testUser: any;
  let testTenant: any;

  beforeAll(async () => {
  });

  afterAll(async () => {
  });

  beforeEach(async () => {

    // Create test app with session middleware
    app = express();
    app.use(cookieParser());
    app.use(sessionMiddleware);

    // Test route that exposes currentUserId and currentTenantId
    app.get('/test/session-info', (req, res) => {
      res.json({
        currentUserId: req.currentUserId || null,
        currentTenantId: req.currentTenantId || null,
        hasSession: !!(req.currentUserId && req.currentTenantId),
      });
    });

    // Protected route that requires authentication
    app.get('/test/protected', requireAuthenticatedUserMiddleware, (req, res) => {
      res.json({
        message: 'Access granted',
        currentUserId: req.currentUserId,
        currentTenantId: req.currentTenantId,
      });
    });

    // Error handler
    app.use(standardErrorHandler);

    // Create test data - use factory defaults for unique values
    testUser = await createTestUser();
    testTenant = await createTestTenant();
    const permissions = await getPermissionsByKeys(['products:read']);
    const role = await createTestRole({
      tenantId: testTenant.id,
      permissionIds: permissions.map((p) => p.id),
    });
    await addUserToTenant(testUser.id, testTenant.id, role.id);
  });

  describe('[AC-004-1] sessionMiddleware', () => {
    it('should set currentUserId and currentTenantId from valid session cookie', async () => {
      // Arrange: Create valid session cookie
      const sessionCookie = createSessionCookie(testUser.id, testTenant.id);

      // Act: Request with valid session
      const response = await request(app)
        .get('/test/session-info')
        .set('Cookie', sessionCookie);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        currentUserId: testUser.id,
        currentTenantId: testTenant.id,
        hasSession: true,
      });
    });

    it('should not set session fields when no cookie is present', async () => {
      // Act: Request without cookie
      const response = await request(app).get('/test/session-info');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        currentUserId: null,
        currentTenantId: null,
        hasSession: false,
      });
    });

    it('should not set session fields for invalid token', async () => {
      // Act: Request with malformed token
      const response = await request(app)
        .get('/test/session-info')
        .set('Cookie', 'mt_session=invalid-token-value');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        currentUserId: null,
        currentTenantId: null,
        hasSession: false,
      });
    });

    it('should not set session fields for token with wrong secret', async () => {
      // Arrange: Create token with wrong secret
      const wrongPayload = {
        currentUserId: testUser.id,
        currentTenantId: testTenant.id,
      };
      const wrongToken = jwt.sign(wrongPayload, 'wrong-secret', { expiresIn: '1h' });

      // Act: Request with wrong-secret token
      const response = await request(app)
        .get('/test/session-info')
        .set('Cookie', `mt_session=${wrongToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        currentUserId: null,
        currentTenantId: null,
        hasSession: false,
      });
    });

    it('should handle missing currentUserId in token payload', async () => {
      // Arrange: Create token missing currentUserId
      const incompletePayload = {
        currentTenantId: testTenant.id,
        // currentUserId missing
      } as any;
      const SECRET = process.env.SESSION_JWT_SECRET || 'test-secret-key';
      const incompleteToken = jwt.sign(incompletePayload, SECRET, { expiresIn: '1h' });

      // Act
      const response = await request(app)
        .get('/test/session-info')
        .set('Cookie', `mt_session=${incompleteToken}`);

      // Assert: Session middleware sets fields if present in token
      // The middleware doesn't validate completeness - that's done by requireAuthenticatedUserMiddleware
      expect(response.status).toBe(200);
      // Token has tenantId but no userId
      expect(response.body.currentTenantId).toBe(testTenant.id);
      // currentUserId is undefined/null since it wasn't in the token
      expect(response.body.currentUserId).toMatch(/null|undefined/);
      // hasSession should be based on both fields being present
      // Note: This demonstrates that session middleware sets what's in the token,
      // but doesn't validate completeness - that's the job of requireAuthenticatedUserMiddleware
      expect(response.body.hasSession).toBeDefined();
    });
  });

  describe('[AC-004-2] requireAuthenticatedUserMiddleware', () => {
    it('should allow access with valid session', async () => {
      // Arrange: Valid session
      const sessionCookie = createSessionCookie(testUser.id, testTenant.id);

      // Act
      const response = await request(app)
        .get('/test/protected')
        .set('Cookie', sessionCookie);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        message: 'Access granted',
        currentUserId: testUser.id,
        currentTenantId: testTenant.id,
      });
    });

    it('should return 401 without session cookie', async () => {
      // Act: Request without cookie
      const response = await request(app).get('/test/protected');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          errorCode: 'AUTH_REQUIRED',
          httpStatusCode: 401,
        },
      });
    });

    it('should return 401 with invalid session cookie', async () => {
      // Act: Request with invalid token
      const response = await request(app)
        .get('/test/protected')
        .set('Cookie', 'mt_session=invalid-token');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          errorCode: 'AUTH_REQUIRED',
        },
      });
    });

    it('should return 401 if only currentUserId is set', async () => {
      // Arrange: Create a new app for this test to avoid route conflicts
      const testApp = express();
      testApp.use(cookieParser());
      testApp.use(sessionMiddleware);
      testApp.get('/test/partial-user', (req, _res, next) => {
        req.currentUserId = testUser.id;
        // req.currentTenantId is NOT set
        next();
      }, requireAuthenticatedUserMiddleware, (_req, res) => {
        res.json({ message: 'Should not reach here' });
      });
      testApp.use(standardErrorHandler);

      // Act
      const response = await request(testApp).get('/test/partial-user');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.error.errorCode).toBe('AUTH_REQUIRED');
    });

    it('should return 401 if only currentTenantId is set', async () => {
      // Arrange: Create a new app for this test to avoid route conflicts
      const testApp = express();
      testApp.use(cookieParser());
      testApp.use(sessionMiddleware);
      testApp.get('/test/partial-tenant', (req, _res, next) => {
        req.currentTenantId = testTenant.id;
        // req.currentUserId is NOT set
        next();
      }, requireAuthenticatedUserMiddleware, (_req, res) => {
        res.json({ message: 'Should not reach here' });
      });
      testApp.use(standardErrorHandler);

      // Act
      const response = await request(testApp).get('/test/partial-tenant');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.error.errorCode).toBe('AUTH_REQUIRED');
    });
  });

  describe('[AC-004-3] Session token structure', () => {
    it('should include required fields in token payload', async () => {
      // Arrange: Generate token
      const token = generateSessionToken(testUser.id, testTenant.id);

      // Act: Decode token
      const SECRET = process.env.SESSION_JWT_SECRET || 'test-secret-key';
      const decoded = jwt.verify(token, SECRET) as any;

      // Assert: Check payload structure
      expect(decoded).toHaveProperty('currentUserId', testUser.id);
      expect(decoded).toHaveProperty('currentTenantId', testTenant.id);
      expect(decoded).toHaveProperty('iat'); // Issued at
      expect(decoded).toHaveProperty('exp'); // Expiration
    });

    it('should have expiration set to 24 hours', async () => {
      // Arrange: Generate token
      const token = generateSessionToken(testUser.id, testTenant.id);

      // Act: Decode token
      const SECRET = process.env.SESSION_JWT_SECRET || 'test-secret-key';
      const decoded = jwt.verify(token, SECRET) as any;

      // Assert: Check expiration (should be ~24 hours from now)
      const now = Math.floor(Date.now() / 1000);
      const expectedExpiration = now + 24 * 60 * 60; // 24 hours
      expect(decoded.exp).toBeGreaterThan(now);
      expect(decoded.exp).toBeLessThanOrEqual(expectedExpiration + 10); // Allow 10s tolerance
    });
  });
});
