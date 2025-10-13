// api-server/__tests__/routes/tenantUserRoutes.test.ts
/**
 * [ST-010] Tenant User API Routes Tests
 *
 * Tests full HTTP request/response cycle for tenant user management routes:
 * - GET /api/tenant-users
 * - GET /api/tenant-users/:userId
 * - POST /api/tenant-users
 * - PUT /api/tenant-users/:userId
 * - DELETE /api/tenant-users/:userId
 *
 * These tests verify:
 * - Authentication and authorization (users:manage)
 * - Request validation (Zod schemas)
 * - Success responses (200, 201)
 * - Error responses (400, 401, 403, 404)
 */

import express from 'express';
import type { Express } from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { sessionMiddleware } from '../../src/middleware/sessionMiddleware.js';
import { tenantUserRouter } from '../../src/routes/tenantUserRouter.js';
import { standardErrorHandler } from '../../src/middleware/errorHandler.js';
import {
  createTestTenant,
  createTestUser,
  createTestRoleWithPermissions,
  createTestMembership,
} from '../helpers/factories.js';
import { createSessionCookie } from '../helpers/auth.js';

describe('[ST-010] Tenant User API Routes', () => {
  let app: Express;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let adminUser: Awaited<ReturnType<typeof createTestUser>>;
  let viewerUser: Awaited<ReturnType<typeof createTestUser>>;
  let adminCookie: string;
  let viewerCookie: string;
  let testRole: Awaited<ReturnType<typeof createTestRoleWithPermissions>>;

  beforeAll(async () => {

    // Setup Express app with middleware
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(sessionMiddleware);
    app.use('/api/tenant-users', tenantUserRouter);
    app.use(standardErrorHandler);

    // Create test tenant - use factory default for unique slug
    testTenant = await createTestTenant();

    // Create admin role with users:manage permission - use factory defaults
    const adminRole = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ['users:manage'],
    });

    // Create viewer role without users:manage - use factory defaults
    const viewerRole = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ['products:read'],
    });

    // Create test role for user creation - use factory defaults
    testRole = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ['products:read'],
    });

    // Create users - use factory defaults for unique emails
    adminUser = await createTestUser();
    viewerUser = await createTestUser();

    // Create memberships
    await createTestMembership({
      userId: adminUser.id,
      tenantId: testTenant.id,
      roleId: adminRole.id,
    });
    await createTestMembership({
      userId: viewerUser.id,
      tenantId: testTenant.id,
      roleId: viewerRole.id,
    });

    // Create session cookies
    adminCookie = createSessionCookie(adminUser.id, testTenant.id);
    viewerCookie = createSessionCookie(viewerUser.id, testTenant.id);
  });

  afterAll(async () => {
  });

  describe('[AC-010-1] GET /api/tenant-users - List Users', () => {
    it('should list all users in tenant', async () => {
      const response = await request(app)
        .get('/api/tenant-users')
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeDefined();
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data.pageInfo).toBeDefined();
    });

    it('should reject without authentication', async () => {
      const response = await request(app).get('/api/tenant-users');

      expect(response.status).toBe(401);
    });

    it('should reject without users:manage permission', async () => {
      const response = await request(app)
        .get('/api/tenant-users')
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });
  });

  describe('[AC-010-2] POST /api/tenant-users - Create User', () => {
    it('should create user with valid data', async () => {
      const response = await request(app)
        .post('/api/tenant-users')
        .set('Cookie', adminCookie)
        .send({
          email: 'newuser@test.com',
          password: 'SecurePass123',
          roleId: testRole.id,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.userEmailAddress).toBe('newuser@test.com');
    });

    it('should reject without authentication', async () => {
      const response = await request(app)
        .post('/api/tenant-users')
        .send({
          email: 'test@example.com',
          password: 'password123',
          roleId: testRole.id,
        });

      expect(response.status).toBe(401);
    });

    it('should reject without users:manage permission', async () => {
      const response = await request(app)
        .post('/api/tenant-users')
        .set('Cookie', viewerCookie)
        .send({
          email: 'test@example.com',
          password: 'password123',
          roleId: testRole.id,
        });

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/tenant-users')
        .set('Cookie', adminCookie)
        .send({
          email: 'invalid-email',
          password: 'short',
          roleId: testRole.id,
        });

      expect(response.status).toBe(400);
      expect(response.body.error?.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('[AC-010-3] PUT /api/tenant-users/:userId - Update User', () => {
    it('should update user role', async () => {
      const response = await request(app)
        .put(`/api/tenant-users/${viewerUser.id}`)
        .set('Cookie', adminCookie)
        .send({
          roleId: testRole.id,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
    });

    it('should reject without authentication', async () => {
      const response = await request(app)
        .put(`/api/tenant-users/${viewerUser.id}`)
        .send({
          roleId: testRole.id,
        });

      expect(response.status).toBe(401);
    });

    it('should reject without users:manage permission', async () => {
      const response = await request(app)
        .put(`/api/tenant-users/${viewerUser.id}`)
        .set('Cookie', viewerCookie)
        .send({
          roleId: testRole.id,
        });

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });
  });

  describe('[AC-010-4] GET /api/tenant-users/:userId - Get User', () => {
    it('should get user by ID', async () => {
      const response = await request(app)
        .get(`/api/tenant-users/${viewerUser.id}`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.userId).toBe(viewerUser.id);
    });

    it('should reject without authentication', async () => {
      const response = await request(app).get(`/api/tenant-users/${viewerUser.id}`);

      expect(response.status).toBe(401);
    });

    it('should reject without users:manage permission', async () => {
      const response = await request(app)
        .get(`/api/tenant-users/${viewerUser.id}`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });
  });

  describe('[AC-010-5] DELETE /api/tenant-users/:userId - Remove User', () => {
    it('should reject without authentication', async () => {
      const response = await request(app).delete(`/api/tenant-users/${viewerUser.id}`);

      expect(response.status).toBe(401);
    });

    it('should reject without users:manage permission', async () => {
      const response = await request(app)
        .delete(`/api/tenant-users/${viewerUser.id}`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });
  });
});
