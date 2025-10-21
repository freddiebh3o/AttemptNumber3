// api-server/__tests__/features/transferAnalytics/analyticsRoutes.test.ts
import request from 'supertest';
import express, { type Express } from 'express';
import { transferAnalyticsRouter } from '../../../src/routes/transferAnalyticsRouter.js';
import { sessionMiddleware } from '../../../src/middleware/sessionMiddleware.js';
import { standardErrorHandler } from '../../../src/middleware/errorHandler.js';
import cookieParser from 'cookie-parser';
import {
  createTestUser,
  createTestTenant,
  createTestRoleWithPermissions,
  createTestMembership,
} from '../../helpers/factories.js';
import { createSessionCookie } from '../../helpers/auth.js';
import { ROLE_DEFS } from '../../../src/rbac/catalog.js';

describe('[ANALYTICS-API] Transfer Analytics API Routes', () => {
  let app: Express;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let sessionCookie: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(sessionMiddleware);
    app.use('/api/stock-transfers/analytics', transferAnalyticsRouter);
    app.use(standardErrorHandler);
  });

  beforeEach(async () => {
    testTenant = await createTestTenant();
    testUser = await createTestUser();

    // Use OWNER role (has reports:view permission)
    const role = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ROLE_DEFS.OWNER,
    });

    await createTestMembership({
      userId: testUser.id,
      tenantId: testTenant.id,
      roleId: role.id,
    });

    sessionCookie = createSessionCookie(testUser.id, testTenant.id);
  });

  describe('GET /api/stock-transfers/analytics/overview - Overview Metrics', () => {
    it('should get overview metrics with reports:view permission', async () => {
      const response = await request(app)
        .get('/api/stock-transfers/analytics/overview')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should support date range filtering', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';

      const response = await request(app)
        .get(`/api/stock-transfers/analytics/overview?startDate=${startDate}&endDate=${endDate}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should support branch filtering', async () => {
      const response = await request(app)
        .get('/api/stock-transfers/analytics/overview?branchId=test-branch-id')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should validate date range format', async () => {
      const response = await request(app)
        .get('/api/stock-transfers/analytics/overview?startDate=invalid-date')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(400);
      expect(response.body.error?.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should reject when startDate is after endDate', async () => {
      const response = await request(app)
        .get('/api/stock-transfers/analytics/overview?startDate=2024-12-31&endDate=2024-01-01')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(400);
      expect(response.body.error?.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should reject without authentication', async () => {
      const response = await request(app).get('/api/stock-transfers/analytics/overview');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject without reports:view permission', async () => {
      const viewerUser = await createTestUser();
      const viewerRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ROLE_DEFS.VIEWER,
      });

      await createTestMembership({
        userId: viewerUser.id,
        tenantId: testTenant.id,
        roleId: viewerRole.id,
      });

      const viewerCookie = createSessionCookie(viewerUser.id, testTenant.id);

      const response = await request(app)
        .get('/api/stock-transfers/analytics/overview')
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });
  });

  describe('GET /api/stock-transfers/analytics/volume-chart - Volume Chart Data', () => {
    it('should get volume chart data with reports:view permission', async () => {
      const response = await request(app)
        .get('/api/stock-transfers/analytics/volume-chart')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should support date range filtering', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';

      const response = await request(app)
        .get(`/api/stock-transfers/analytics/volume-chart?startDate=${startDate}&endDate=${endDate}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject without authentication', async () => {
      const response = await request(app).get('/api/stock-transfers/analytics/volume-chart');

      expect(response.status).toBe(401);
    });

    it('should reject without reports:view permission', async () => {
      const editorUser = await createTestUser();
      const editorRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ROLE_DEFS.EDITOR,
      });

      await createTestMembership({
        userId: editorUser.id,
        tenantId: testTenant.id,
        roleId: editorRole.id,
      });

      const editorCookie = createSessionCookie(editorUser.id, testTenant.id);

      const response = await request(app)
        .get('/api/stock-transfers/analytics/volume-chart')
        .set('Cookie', editorCookie);

      expect(response.status).toBe(403);
    });
  });

  describe('Response Format', () => {
    it('should return standard envelope format', async () => {
      const response = await request(app)
        .get('/api/stock-transfers/analytics/overview')
        .set('Cookie', sessionCookie);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('error');
      expect(response.body.success).toBe(true);
      expect(response.body.error).toBeNull();
    });
  });
});
