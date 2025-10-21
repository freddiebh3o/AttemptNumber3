// api-server/__tests__/permissions/transferAnalytics.permissions.test.ts
import request from 'supertest';
import express, { type Express } from 'express';
import { transferAnalyticsRouter } from '../../src/routes/transferAnalyticsRouter.js';
import { sessionMiddleware } from '../../src/middleware/sessionMiddleware.js';
import { standardErrorHandler } from '../../src/middleware/errorHandler.js';
import cookieParser from 'cookie-parser';
import {
  createTestUser,
  createTestTenant,
  createTestRoleWithPermissions,
  createTestMembership,
} from '../helpers/factories.js';
import { createSessionCookie } from '../helpers/auth.js';
import { ROLE_DEFS } from '../../src/rbac/catalog.js';

describe('[RBAC] Transfer Analytics Permissions', () => {
  let app: Express;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;

  let ownerUser: Awaited<ReturnType<typeof createTestUser>>;
  let adminUser: Awaited<ReturnType<typeof createTestUser>>;
  let editorUser: Awaited<ReturnType<typeof createTestUser>>;
  let viewerUser: Awaited<ReturnType<typeof createTestUser>>;

  let ownerCookie: string;
  let adminCookie: string;
  let editorCookie: string;
  let viewerCookie: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(sessionMiddleware);
    app.use('/api/transfer-analytics', transferAnalyticsRouter);
    app.use(standardErrorHandler);
  });

  beforeEach(async () => {
    testTenant = await createTestTenant();

    ownerUser = await createTestUser();
    adminUser = await createTestUser();
    editorUser = await createTestUser();
    viewerUser = await createTestUser();

    const ownerRole = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ROLE_DEFS.OWNER,
    });
    const adminRole = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ROLE_DEFS.ADMIN,
    });
    const editorRole = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ROLE_DEFS.EDITOR,
    });
    const viewerRole = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ROLE_DEFS.VIEWER,
    });

    await createTestMembership({ userId: ownerUser.id, tenantId: testTenant.id, roleId: ownerRole.id });
    await createTestMembership({ userId: adminUser.id, tenantId: testTenant.id, roleId: adminRole.id });
    await createTestMembership({ userId: editorUser.id, tenantId: testTenant.id, roleId: editorRole.id });
    await createTestMembership({ userId: viewerUser.id, tenantId: testTenant.id, roleId: viewerRole.id });

    ownerCookie = createSessionCookie(ownerUser.id, testTenant.id);
    adminCookie = createSessionCookie(adminUser.id, testTenant.id);
    editorCookie = createSessionCookie(editorUser.id, testTenant.id);
    viewerCookie = createSessionCookie(viewerUser.id, testTenant.id);
  });

  // All transfer analytics endpoints require reports:view permission (OWNER, ADMIN only)

  describe('GET /api/transfer-analytics/overview - Get Overview Metrics', () => {
    it('OWNER - should allow (has reports:view)', async () => {
      const response = await request(app)
        .get('/api/transfer-analytics/overview')
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('ADMIN - should allow (has reports:view)', async () => {
      const response = await request(app)
        .get('/api/transfer-analytics/overview')
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
    });

    it('EDITOR - should deny (lacks reports:view)', async () => {
      const response = await request(app)
        .get('/api/transfer-analytics/overview')
        .set('Cookie', editorCookie);

      expect(response.status).toBe(403);
    });

    it('VIEWER - should deny (lacks reports:view)', async () => {
      const response = await request(app)
        .get('/api/transfer-analytics/overview')
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
    });

    it('Custom role with reports:view - should allow', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['reports:view'],
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .get('/api/transfer-analytics/overview')
        .set('Cookie', customCookie);

      expect(response.status).toBe(200);
    });

    it('Custom role without reports:view - should deny', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'],
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .get('/api/transfer-analytics/overview')
        .set('Cookie', customCookie);

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).get('/api/transfer-analytics/overview');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/transfer-analytics/volume-chart - Get Volume Chart', () => {
    it('OWNER - should allow (has reports:view)', async () => {
      const response = await request(app)
        .get('/api/transfer-analytics/volume-chart')
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
    });

    it('ADMIN - should allow (has reports:view)', async () => {
      const response = await request(app)
        .get('/api/transfer-analytics/volume-chart')
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
    });

    it('EDITOR - should deny (lacks reports:view)', async () => {
      const response = await request(app)
        .get('/api/transfer-analytics/volume-chart')
        .set('Cookie', editorCookie);

      expect(response.status).toBe(403);
    });

    it('VIEWER - should deny (lacks reports:view)', async () => {
      const response = await request(app)
        .get('/api/transfer-analytics/volume-chart')
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).get('/api/transfer-analytics/volume-chart');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/transfer-analytics/top-routes - Get Top Routes', () => {
    it('OWNER - should allow (has reports:view)', async () => {
      const response = await request(app)
        .get('/api/transfer-analytics/top-routes')
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
    });

    it('ADMIN - should allow (has reports:view)', async () => {
      const response = await request(app)
        .get('/api/transfer-analytics/top-routes')
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
    });

    it('EDITOR - should deny (lacks reports:view)', async () => {
      const response = await request(app)
        .get('/api/transfer-analytics/top-routes')
        .set('Cookie', editorCookie);

      expect(response.status).toBe(403);
    });

    it('VIEWER - should deny (lacks reports:view)', async () => {
      const response = await request(app)
        .get('/api/transfer-analytics/top-routes')
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).get('/api/transfer-analytics/top-routes');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/transfer-analytics/product-frequency - Get Product Frequency', () => {
    it('OWNER - should allow (has reports:view)', async () => {
      const response = await request(app)
        .get('/api/transfer-analytics/product-frequency')
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
    });

    it('ADMIN - should allow (has reports:view)', async () => {
      const response = await request(app)
        .get('/api/transfer-analytics/product-frequency')
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
    });

    it('EDITOR - should deny (lacks reports:view)', async () => {
      const response = await request(app)
        .get('/api/transfer-analytics/product-frequency')
        .set('Cookie', editorCookie);

      expect(response.status).toBe(403);
    });

    it('VIEWER - should deny (lacks reports:view)', async () => {
      const response = await request(app)
        .get('/api/transfer-analytics/product-frequency')
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).get('/api/transfer-analytics/product-frequency');
      expect(response.status).toBe(401);
    });
  });
});
