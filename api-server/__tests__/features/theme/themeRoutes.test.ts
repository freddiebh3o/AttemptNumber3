// api-server/__tests__/features/theme/themeRoutes.test.ts
import request from 'supertest';
import express, { type Express } from 'express';
import { tenantThemeRouter } from '../../../src/routes/tenantThemeRouter.js';
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
import { upsertTenantThemeService } from '../../../src/services/theme/tenantThemeService.js';

describe('[THEME-API] Tenant Theme API Routes', () => {
  let app: Express;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let sessionCookie: string;

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
    testUser = await createTestUser();

    // Use OWNER role since theme routes require theme:manage permission
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

  describe('GET /api/tenants/:tenantSlug/theme - Get Theme', () => {
    it('should get theme with authentication and permission', async () => {
      const response = await request(app)
        .get(`/api/tenants/${testTenant.tenantSlug}/theme`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.presetKey).toBeDefined();
      expect(response.body.data.overrides).toBeDefined();
      expect(response.body.data.logoUrl).toBeDefined();
    });

    it('should return default theme when no branding exists', async () => {
      const response = await request(app)
        .get(`/api/tenants/${testTenant.tenantSlug}/theme`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.presetKey).toBeNull();
      expect(response.body.data.overrides).toEqual({});
      expect(response.body.data.logoUrl).toBeNull();
    });

    it('should return existing theme with preset', async () => {
      await upsertTenantThemeService({
        tenantId: testTenant.id,
        presetKey: 'classicBlue',
        overrides: {},
        logoUrl: null,
      });

      const response = await request(app)
        .get(`/api/tenants/${testTenant.tenantSlug}/theme`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.presetKey).toBe('classicBlue');
    });

    it('should reject without authentication', async () => {
      const response = await request(app)
        .get(`/api/tenants/${testTenant.tenantSlug}/theme`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject without theme:manage permission', async () => {
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
        .get(`/api/tenants/${testTenant.tenantSlug}/theme`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });
  });

  describe('PUT /api/tenants/:tenantSlug/theme - Update Theme', () => {
    it('should update theme with preset', async () => {
      const response = await request(app)
        .put(`/api/tenants/${testTenant.tenantSlug}/theme`)
        .set('Cookie', sessionCookie)
        .send({
          presetKey: 'rubyDark',
          overrides: {},
          logoUrl: null,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.presetKey).toBe('rubyDark');
    });

    it('should update theme with color overrides', async () => {
      const overrides = {
        primaryColor: 'teal',
        primaryShade: 5,
        fontFamily: 'Arial',
      };

      const response = await request(app)
        .put(`/api/tenants/${testTenant.tenantSlug}/theme`)
        .set('Cookie', sessionCookie)
        .send({
          presetKey: null,
          overrides,
          logoUrl: null,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.overrides).toEqual(overrides);
    });

    it('should update theme with logo URL', async () => {
      const response = await request(app)
        .put(`/api/tenants/${testTenant.tenantSlug}/theme`)
        .set('Cookie', sessionCookie)
        .send({
          presetKey: null,
          overrides: {},
          logoUrl: 'https://example.com/logo.png',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.logoUrl).toBe('https://example.com/logo.png');
    });

    it('should validate request body schema', async () => {
      const response = await request(app)
        .put(`/api/tenants/${testTenant.tenantSlug}/theme`)
        .set('Cookie', sessionCookie)
        .send({
          presetKey: 'invalidPreset', // Invalid preset key
          overrides: {},
          logoUrl: null,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error?.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should validate logo URL format', async () => {
      const response = await request(app)
        .put(`/api/tenants/${testTenant.tenantSlug}/theme`)
        .set('Cookie', sessionCookie)
        .send({
          presetKey: null,
          overrides: {},
          logoUrl: 'not-a-valid-url',
        });

      expect(response.status).toBe(400);
      expect(response.body.error?.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return standard envelope format', async () => {
      const response = await request(app)
        .put(`/api/tenants/${testTenant.tenantSlug}/theme`)
        .set('Cookie', sessionCookie)
        .send({
          presetKey: 'emeraldLight',
          overrides: {},
          logoUrl: null,
        });

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('error');
      expect(response.body.success).toBe(true);
      expect(response.body.error).toBeNull();
    });

    it('should reject without authentication', async () => {
      const response = await request(app)
        .put(`/api/tenants/${testTenant.tenantSlug}/theme`)
        .send({
          presetKey: 'oceanLight',
          overrides: {},
          logoUrl: null,
        });

      expect(response.status).toBe(401);
    });

    it('should reject without theme:manage permission', async () => {
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
        .put(`/api/tenants/${testTenant.tenantSlug}/theme`)
        .set('Cookie', editorCookie)
        .send({
          presetKey: 'violetLight',
          overrides: {},
          logoUrl: null,
        });

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('should support idempotency with Idempotency-Key header', async () => {
      const idempotencyKey = 'theme-update-123';
      const requestBody = {
        presetKey: 'grapeDark',
        overrides: {},
        logoUrl: null,
      };

      const response1 = await request(app)
        .put(`/api/tenants/${testTenant.tenantSlug}/theme`)
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send(requestBody);

      expect(response1.status).toBe(200);

      const response2 = await request(app)
        .put(`/api/tenants/${testTenant.tenantSlug}/theme`)
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send(requestBody);

      expect(response2.status).toBe(200);
      expect(response2.body.data.presetKey).toBe('grapeDark');
    });
  });
});
