// api-server/__tests__/features/roles/roleRoutes.test.ts
import request from 'supertest';
import express, { type Express } from 'express';
import { roleRouter } from '../../../src/routes/roleRouter.js';
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

describe('[ROLE-API] Role API Routes', () => {
  let app: Express;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let sessionCookie: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(sessionMiddleware);
    app.use('/api', roleRouter);
    app.use(standardErrorHandler);
  });

  beforeEach(async () => {
    testTenant = await createTestTenant();
    testUser = await createTestUser();

    // Use OWNER role since role routes require roles:manage permission
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

  describe('GET /api/roles - List Roles', () => {
    it('should list roles with authentication', async () => {
      const response = await request(app)
        .get('/api/roles')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeDefined();
    });

    it('should reject without roles:manage permission', async () => {
      const viewer = await createTestUser();
      const viewerRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ROLE_DEFS.VIEWER,
      });
      await createTestMembership({
        userId: viewer.id,
        tenantId: testTenant.id,
        roleId: viewerRole.id,
      });

      const viewerCookie = createSessionCookie(viewer.id, testTenant.id);

      const response = await request(app)
        .get('/api/roles')
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
    });

    it('should reject without authentication', async () => {
      const response = await request(app).get('/api/roles');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/roles/:roleId - Get Role by ID', () => {
    it('should get role by ID', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'],
      });

      const response = await request(app)
        .get(`/api/roles/${role.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.role.id).toBe(role.id);
    });

    it('should return 404 for non-existent role', async () => {
      const response = await request(app)
        .get('/api/roles/non-existent-id')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
    });

    it('should reject without authentication', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'],
      });

      const response = await request(app).get(`/api/roles/${role.id}`);
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/roles - Create Role', () => {
    it('should create role with valid data', async () => {
      const response = await request(app)
        .post('/api/roles')
        .set('Cookie', sessionCookie)
        .send({
          name: 'Custom Manager',
          description: 'Custom manager role',
          permissionKeys: ['products:read', 'products:write'],
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.role.name).toBe('Custom Manager');
      expect(response.body.data.role.permissions).toContain('products:read');
    });

    it('should validate request body with Zod', async () => {
      const response = await request(app)
        .post('/api/roles')
        .set('Cookie', sessionCookie)
        .send({
          name: '',
          permissionKeys: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.error?.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should reject without roles:manage permission', async () => {
      const viewer = await createTestUser();
      const viewerRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ROLE_DEFS.VIEWER,
      });
      await createTestMembership({
        userId: viewer.id,
        tenantId: testTenant.id,
        roleId: viewerRole.id,
      });

      const viewerCookie = createSessionCookie(viewer.id, testTenant.id);

      const response = await request(app)
        .post('/api/roles')
        .set('Cookie', viewerCookie)
        .send({
          name: 'Test Role',
          permissionKeys: ['products:read'],
        });

      expect(response.status).toBe(403);
    });

    it('should reject without authentication', async () => {
      const response = await request(app)
        .post('/api/roles')
        .send({
          name: 'Test Role',
          permissionKeys: ['products:read'],
        });

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/roles/:roleId - Update Role', () => {
    it('should update role name and permissions', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'],
      });

      const response = await request(app)
        .put(`/api/roles/${role.id}`)
        .set('Cookie', sessionCookie)
        .send({
          name: 'Updated Name',
          permissionKeys: ['products:read', 'products:write'],
        });

      expect(response.status).toBe(200);
      expect(response.body.data.role.name).toBe('Updated Name');
      expect(response.body.data.role.permissions).toHaveLength(2);
    });

    it('should validate request body', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'],
      });

      const response = await request(app)
        .put(`/api/roles/${role.id}`)
        .set('Cookie', sessionCookie)
        .send({
          name: '',
        });

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent role', async () => {
      const response = await request(app)
        .put('/api/roles/non-existent-id')
        .set('Cookie', sessionCookie)
        .send({
          name: 'Updated',
        });

      expect(response.status).toBe(404);
    });

    it('should reject without roles:manage permission', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'],
      });

      const viewer = await createTestUser();
      const viewerRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ROLE_DEFS.VIEWER,
      });
      await createTestMembership({
        userId: viewer.id,
        tenantId: testTenant.id,
        roleId: viewerRole.id,
      });

      const viewerCookie = createSessionCookie(viewer.id, testTenant.id);

      const response = await request(app)
        .put(`/api/roles/${role.id}`)
        .set('Cookie', viewerCookie)
        .send({
          name: 'Hacked',
        });

      expect(response.status).toBe(403);
    });

    it('should reject without authentication', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'],
      });

      const response = await request(app)
        .put(`/api/roles/${role.id}`)
        .send({
          name: 'Updated',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/roles/:roleId - Archive Role', () => {
    it('should archive role', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'],
      });

      const response = await request(app)
        .delete(`/api/roles/${role.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.role.isArchived).toBe(true);
    });

    it('should return 404 for non-existent role', async () => {
      const response = await request(app)
        .delete('/api/roles/non-existent-id')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
    });

    it('should reject without roles:manage permission', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'],
      });

      const viewer = await createTestUser();
      const viewerRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ROLE_DEFS.VIEWER,
      });
      await createTestMembership({
        userId: viewer.id,
        tenantId: testTenant.id,
        roleId: viewerRole.id,
      });

      const viewerCookie = createSessionCookie(viewer.id, testTenant.id);

      const response = await request(app)
        .delete(`/api/roles/${role.id}`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
    });

    it('should reject without authentication', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'],
      });

      const response = await request(app).delete(`/api/roles/${role.id}`);
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/roles/:roleId/restore - Restore Role', () => {
    it('should restore archived role', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'],
      });

      await request(app)
        .delete(`/api/roles/${role.id}`)
        .set('Cookie', sessionCookie);

      const response = await request(app)
        .post(`/api/roles/${role.id}/restore`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.role.isArchived).toBe(false);
    });

    it('should reject without roles:manage permission', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'],
      });

      const viewer = await createTestUser();
      const viewerRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ROLE_DEFS.VIEWER,
      });
      await createTestMembership({
        userId: viewer.id,
        tenantId: testTenant.id,
        roleId: viewerRole.id,
      });

      const viewerCookie = createSessionCookie(viewer.id, testTenant.id);

      const response = await request(app)
        .post(`/api/roles/${role.id}/restore`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
    });

    it('should reject without authentication', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'],
      });

      const response = await request(app).post(`/api/roles/${role.id}/restore`);
      expect(response.status).toBe(401);
    });
  });

  describe('Response Envelope Format', () => {
    it('should return standard success envelope', async () => {
      const response = await request(app)
        .get('/api/roles')
        .set('Cookie', sessionCookie);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('error', null);
    });

    it('should return standard error envelope', async () => {
      const response = await request(app)
        .get('/api/roles/non-existent-id')
        .set('Cookie', sessionCookie);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('errorCode');
    });
  });
});
