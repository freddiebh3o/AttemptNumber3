// api-server/__tests__/permissions/theme.permissions.test.ts
import request from 'supertest';
import express, { type Express } from 'express';
import { tenantThemeRouter } from '../../src/routes/tenantThemeRouter.js';
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

describe('[RBAC] Theme Permissions', () => {
  let app: Express;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let tenantSlug: string;

  // Users for each role
  let ownerUser: Awaited<ReturnType<typeof createTestUser>>;
  let adminUser: Awaited<ReturnType<typeof createTestUser>>;
  let editorUser: Awaited<ReturnType<typeof createTestUser>>;
  let viewerUser: Awaited<ReturnType<typeof createTestUser>>;

  // Session cookies for each role
  let ownerCookie: string;
  let adminCookie: string;
  let editorCookie: string;
  let viewerCookie: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(sessionMiddleware);
    app.use('/api/tenants', tenantThemeRouter);
    app.use(standardErrorHandler);
  });

  beforeEach(async () => {
    testTenant = await createTestTenant();
    tenantSlug = testTenant.tenantSlug;

    // Create users for each role
    ownerUser = await createTestUser();
    adminUser = await createTestUser();
    editorUser = await createTestUser();
    viewerUser = await createTestUser();

    // Create roles
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

    // Create memberships
    await createTestMembership({ userId: ownerUser.id, tenantId: testTenant.id, roleId: ownerRole.id });
    await createTestMembership({ userId: adminUser.id, tenantId: testTenant.id, roleId: adminRole.id });
    await createTestMembership({ userId: editorUser.id, tenantId: testTenant.id, roleId: editorRole.id });
    await createTestMembership({ userId: viewerUser.id, tenantId: testTenant.id, roleId: viewerRole.id });

    // Create session cookies
    ownerCookie = createSessionCookie(ownerUser.id, testTenant.id);
    adminCookie = createSessionCookie(adminUser.id, testTenant.id);
    editorCookie = createSessionCookie(editorUser.id, testTenant.id);
    viewerCookie = createSessionCookie(viewerUser.id, testTenant.id);
  });

  describe('GET /api/tenants/:tenantSlug/theme - Get Theme', () => {
    it('OWNER - should allow access (has theme:manage)', async () => {
      const response = await request(app)
        .get(`/api/tenants/${tenantSlug}/theme`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('ADMIN - should allow access (has theme:manage)', async () => {
      const response = await request(app)
        .get(`/api/tenants/${tenantSlug}/theme`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('EDITOR - should deny (lacks theme:manage)', async () => {
      const response = await request(app)
        .get(`/api/tenants/${tenantSlug}/theme`)
        .set('Cookie', editorCookie);

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('VIEWER - should deny (lacks theme:manage)', async () => {
      const response = await request(app)
        .get(`/api/tenants/${tenantSlug}/theme`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
    });

    it('Custom role with theme:manage - should allow', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['theme:manage'],
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .get(`/api/tenants/${tenantSlug}/theme`)
        .set('Cookie', customCookie);

      expect(response.status).toBe(200);
    });

    it('Custom role without theme:manage - should deny', async () => {
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
        .get(`/api/tenants/${tenantSlug}/theme`)
        .set('Cookie', customCookie);

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).get(`/api/tenants/${tenantSlug}/theme`);

      expect(response.status).toBe(401);
      expect(response.body.error?.errorCode).toBe('AUTH_REQUIRED');
    });

    it('Cross-tenant access - should return 403', async () => {
      const otherTenant = await createTestTenant();

      const response = await request(app)
        .get(`/api/tenants/${otherTenant.tenantSlug}/theme`)
        .set('Cookie', ownerCookie);

      // Theme endpoints return 403 for cross-tenant access (tenant isolation)
      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/tenants/:tenantSlug/theme - Update Theme', () => {
    const updateBody = {
      presetKey: 'classicBlue',
      overrides: {
        primaryColor: 'blue',
      },
    };

    it('OWNER - should allow (has theme:manage)', async () => {
      const response = await request(app)
        .put(`/api/tenants/${tenantSlug}/theme`)
        .set('Cookie', ownerCookie)
        .send(updateBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('ADMIN - should allow (has theme:manage)', async () => {
      const response = await request(app)
        .put(`/api/tenants/${tenantSlug}/theme`)
        .set('Cookie', adminCookie)
        .send({ presetKey: 'emeraldLight' });

      expect(response.status).toBe(200);
    });

    it('EDITOR - should deny (lacks theme:manage)', async () => {
      const response = await request(app)
        .put(`/api/tenants/${tenantSlug}/theme`)
        .set('Cookie', editorCookie)
        .send(updateBody);

      expect(response.status).toBe(403);
    });

    it('VIEWER - should deny (lacks theme:manage)', async () => {
      const response = await request(app)
        .put(`/api/tenants/${tenantSlug}/theme`)
        .set('Cookie', viewerCookie)
        .send(updateBody);

      expect(response.status).toBe(403);
    });

    it('Custom role with permission - should allow', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['theme:manage'],
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .put(`/api/tenants/${tenantSlug}/theme`)
        .set('Cookie', customCookie)
        .send(updateBody);

      expect(response.status).toBe(200);
    });

    it('Custom role without permission - should deny', async () => {
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
        .put(`/api/tenants/${tenantSlug}/theme`)
        .set('Cookie', customCookie)
        .send(updateBody);

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app)
        .put(`/api/tenants/${tenantSlug}/theme`)
        .send(updateBody);

      expect(response.status).toBe(401);
    });

    it('Cross-tenant access - should return 403', async () => {
      const otherTenant = await createTestTenant();

      const response = await request(app)
        .put(`/api/tenants/${otherTenant.tenantSlug}/theme`)
        .set('Cookie', ownerCookie)
        .send(updateBody);

      // Theme endpoints return 403 for cross-tenant access (tenant isolation)
      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/tenants/:tenantSlug/theme/activity - Get Theme Activity', () => {
    it('OWNER - should allow access (has theme:manage)', async () => {
      const response = await request(app)
        .get(`/api/tenants/${tenantSlug}/theme/activity`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('ADMIN - should allow access (has theme:manage)', async () => {
      const response = await request(app)
        .get(`/api/tenants/${tenantSlug}/theme/activity`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
    });

    it('EDITOR - should deny (lacks theme:manage)', async () => {
      const response = await request(app)
        .get(`/api/tenants/${tenantSlug}/theme/activity`)
        .set('Cookie', editorCookie);

      expect(response.status).toBe(403);
    });

    it('VIEWER - should deny (lacks theme:manage)', async () => {
      const response = await request(app)
        .get(`/api/tenants/${tenantSlug}/theme/activity`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).get(`/api/tenants/${tenantSlug}/theme/activity`);

      expect(response.status).toBe(401);
    });

    it('Cross-tenant access - should return 403', async () => {
      const otherTenant = await createTestTenant();

      const response = await request(app)
        .get(`/api/tenants/${otherTenant.tenantSlug}/theme/activity`)
        .set('Cookie', ownerCookie);

      // Theme endpoints return 403 for cross-tenant access (tenant isolation)
      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/tenants/:tenantSlug/feature-flags - Get Feature Flags', () => {
    it('OWNER - should allow access (has theme:manage)', async () => {
      const response = await request(app)
        .get(`/api/tenants/${tenantSlug}/feature-flags`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('ADMIN - should allow access (has theme:manage)', async () => {
      const response = await request(app)
        .get(`/api/tenants/${tenantSlug}/feature-flags`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
    });

    it('EDITOR - should deny (lacks theme:manage)', async () => {
      const response = await request(app)
        .get(`/api/tenants/${tenantSlug}/feature-flags`)
        .set('Cookie', editorCookie);

      expect(response.status).toBe(403);
    });

    it('VIEWER - should deny (lacks theme:manage)', async () => {
      const response = await request(app)
        .get(`/api/tenants/${tenantSlug}/feature-flags`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
    });

    it('Custom role with theme:manage - should allow', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['theme:manage'],
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .get(`/api/tenants/${tenantSlug}/feature-flags`)
        .set('Cookie', customCookie);

      expect(response.status).toBe(200);
    });

    it('Custom role without theme:manage - should deny', async () => {
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
        .get(`/api/tenants/${tenantSlug}/feature-flags`)
        .set('Cookie', customCookie);

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).get(`/api/tenants/${tenantSlug}/feature-flags`);

      expect(response.status).toBe(401);
    });

    it('Cross-tenant access - should return 403', async () => {
      const otherTenant = await createTestTenant();

      const response = await request(app)
        .get(`/api/tenants/${otherTenant.tenantSlug}/feature-flags`)
        .set('Cookie', ownerCookie);

      // Feature flags endpoints return 403 for cross-tenant access (tenant isolation)
      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/tenants/:tenantSlug/feature-flags - Update Feature Flags', () => {
    const updateBody = {
      chatAssistantEnabled: true,
      openaiApiKey: 'sk-test-fake-openai-key-for-testing-purposes-only',
      barcodeScanningEnabled: false,
    };

    it('OWNER - should allow (has theme:manage)', async () => {
      const response = await request(app)
        .put(`/api/tenants/${tenantSlug}/feature-flags`)
        .set('Cookie', ownerCookie)
        .send(updateBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('ADMIN - should allow (has theme:manage)', async () => {
      const response = await request(app)
        .put(`/api/tenants/${tenantSlug}/feature-flags`)
        .set('Cookie', adminCookie)
        .send({ chatAssistantEnabled: false });

      expect(response.status).toBe(200);
    });

    it('EDITOR - should deny (lacks theme:manage)', async () => {
      const response = await request(app)
        .put(`/api/tenants/${tenantSlug}/feature-flags`)
        .set('Cookie', editorCookie)
        .send(updateBody);

      expect(response.status).toBe(403);
    });

    it('VIEWER - should deny (lacks theme:manage)', async () => {
      const response = await request(app)
        .put(`/api/tenants/${tenantSlug}/feature-flags`)
        .set('Cookie', viewerCookie)
        .send(updateBody);

      expect(response.status).toBe(403);
    });

    it('Custom role with permission - should allow', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['theme:manage', 'tenant:manage'],
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .put(`/api/tenants/${tenantSlug}/feature-flags`)
        .set('Cookie', customCookie)
        .send(updateBody);

      expect(response.status).toBe(200);
    });

    it('Custom role without permission - should deny', async () => {
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
        .put(`/api/tenants/${tenantSlug}/feature-flags`)
        .set('Cookie', customCookie)
        .send(updateBody);

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app)
        .put(`/api/tenants/${tenantSlug}/feature-flags`)
        .send(updateBody);

      expect(response.status).toBe(401);
    });

    it('Cross-tenant access - should return 403', async () => {
      const otherTenant = await createTestTenant();

      const response = await request(app)
        .put(`/api/tenants/${otherTenant.tenantSlug}/feature-flags`)
        .set('Cookie', ownerCookie)
        .send(updateBody);

      // Feature flags endpoints return 403 for cross-tenant access (tenant isolation)
      expect(response.status).toBe(403);
    });
  });

  // Note: POST /api/tenants/:tenantSlug/logo endpoint uses multer file upload
  // which is difficult to test with supertest without actual file buffers.
  // This endpoint is also protected by theme:manage permission.
  // Comprehensive testing of file upload permissions would require:
  // - Creating a Buffer from test image data
  // - Using .attach() method with supertest
  // - Testing file type validation
  // This is left as a future enhancement to avoid test complexity.
  describe('POST /api/tenants/:tenantSlug/logo - Upload Logo (Skipped)', () => {
    it.skip('OWNER - should allow logo upload (has theme:manage)', async () => {
      // Would require file upload testing setup
    });

    it.skip('ADMIN - should allow logo upload (has theme:manage)', async () => {
      // Would require file upload testing setup
    });

    it.skip('EDITOR - should deny logo upload (lacks theme:manage)', async () => {
      // Would require file upload testing setup
    });

    it.skip('VIEWER - should deny logo upload (lacks theme:manage)', async () => {
      // Would require file upload testing setup
    });
  });
});
