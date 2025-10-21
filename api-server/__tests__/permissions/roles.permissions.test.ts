// api-server/__tests__/permissions/roles.permissions.test.ts
import request from 'supertest';
import express, { type Express } from 'express';
import { roleRouter } from '../../src/routes/roleRouter.js';
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
import { prismaClientInstance as prisma } from '../../src/db/prismaClient.js';

describe('[RBAC] Roles Permissions', () => {
  let app: Express;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;

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

  // Test target role
  let targetRole: any;

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

    // Create a custom role to test operations on
    targetRole = await prisma.role.create({
      data: {
        tenantId: testTenant.id,
        name: `Test Role ${Date.now()}`,
        description: 'Test role for permission testing',
        isSystem: false,
      },
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

  describe('GET /api/permissions - List Permissions', () => {
    it('OWNER - should allow access (has roles:manage)', async () => {
      const response = await request(app)
        .get('/api/permissions')
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.permissions).toBeDefined();
      expect(Array.isArray(response.body.data.permissions)).toBe(true);
    });

    it('ADMIN - should deny (lacks roles:manage)', async () => {
      const response = await request(app)
        .get('/api/permissions')
        .set('Cookie', adminCookie);

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('EDITOR - should deny (lacks roles:manage)', async () => {
      const response = await request(app)
        .get('/api/permissions')
        .set('Cookie', editorCookie);

      expect(response.status).toBe(403);
    });

    it('VIEWER - should deny (lacks roles:manage)', async () => {
      const response = await request(app)
        .get('/api/permissions')
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
    });

    it('Custom role with roles:manage - should allow', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['roles:manage'],
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .get('/api/permissions')
        .set('Cookie', customCookie);

      expect(response.status).toBe(200);
    });

    it('Custom role without roles:manage - should deny', async () => {
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
        .get('/api/permissions')
        .set('Cookie', customCookie);

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).get('/api/permissions');

      expect(response.status).toBe(401);
      expect(response.body.error?.errorCode).toBe('AUTH_REQUIRED');
    });
  });

  describe('GET /api/roles - List Roles', () => {
    it('OWNER - should allow access (has roles:manage)', async () => {
      const response = await request(app)
        .get('/api/roles')
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeDefined();
    });

    it('ADMIN - should deny (lacks roles:manage)', async () => {
      const response = await request(app)
        .get('/api/roles')
        .set('Cookie', adminCookie);

      expect(response.status).toBe(403);
    });

    it('EDITOR - should deny (lacks roles:manage)', async () => {
      const response = await request(app)
        .get('/api/roles')
        .set('Cookie', editorCookie);

      expect(response.status).toBe(403);
    });

    it('VIEWER - should deny (lacks roles:manage)', async () => {
      const response = await request(app)
        .get('/api/roles')
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).get('/api/roles');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/roles/:roleId - Get Role by ID', () => {
    it('OWNER - should allow access (has roles:manage)', async () => {
      const response = await request(app)
        .get(`/api/roles/${targetRole.id}`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.role).toBeDefined();
    });

    it('ADMIN - should deny (lacks roles:manage)', async () => {
      const response = await request(app)
        .get(`/api/roles/${targetRole.id}`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(403);
    });

    it('EDITOR - should deny (lacks roles:manage)', async () => {
      const response = await request(app)
        .get(`/api/roles/${targetRole.id}`)
        .set('Cookie', editorCookie);

      expect(response.status).toBe(403);
    });

    it('VIEWER - should deny (lacks roles:manage)', async () => {
      const response = await request(app)
        .get(`/api/roles/${targetRole.id}`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).get(`/api/roles/${targetRole.id}`);

      expect(response.status).toBe(401);
    });

    it('Cross-tenant access - should return 404', async () => {
      const otherTenant = await createTestTenant();
      const otherRole = await prisma.role.create({
        data: {
          tenantId: otherTenant.id,
          name: `Other Role ${Date.now()}`,
          description: 'Role from another tenant',
          isSystem: false,
        },
      });

      const response = await request(app)
        .get(`/api/roles/${otherRole.id}`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/roles - Create Role', () => {
    const requestBody = {
      name: 'Custom Role',
      description: 'A custom role for testing',
      permissionKeys: ['products:read', 'products:write'],
    };

    it('OWNER - should allow (has roles:manage)', async () => {
      const response = await request(app)
        .post('/api/roles')
        .set('Cookie', ownerCookie)
        .send(requestBody);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.role).toBeDefined();
    });

    it('ADMIN - should deny (lacks roles:manage)', async () => {
      const response = await request(app)
        .post('/api/roles')
        .set('Cookie', adminCookie)
        .send({ ...requestBody, name: 'Admin Custom Role' });

      expect(response.status).toBe(403);
    });

    it('EDITOR - should deny (lacks roles:manage)', async () => {
      const response = await request(app)
        .post('/api/roles')
        .set('Cookie', editorCookie)
        .send({ ...requestBody, name: 'Editor Custom Role' });

      expect(response.status).toBe(403);
    });

    it('VIEWER - should deny (lacks roles:manage)', async () => {
      const response = await request(app)
        .post('/api/roles')
        .set('Cookie', viewerCookie)
        .send({ ...requestBody, name: 'Viewer Custom Role' });

      expect(response.status).toBe(403);
    });

    it('Custom role with permission - should allow', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['roles:manage'],
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .post('/api/roles')
        .set('Cookie', customCookie)
        .send({ ...requestBody, name: 'Permission Allowed Role' });

      expect(response.status).toBe(201);
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
        .post('/api/roles')
        .set('Cookie', customCookie)
        .send({ ...requestBody, name: 'Permission Denied Role' });

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app)
        .post('/api/roles')
        .send({ ...requestBody, name: 'Unauth Role' });

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/roles/:roleId - Update Role', () => {
    const updateBody = {
      name: 'Updated Role Name',
      description: 'Updated description',
    };

    it('OWNER - should allow (has roles:manage)', async () => {
      const response = await request(app)
        .put(`/api/roles/${targetRole.id}`)
        .set('Cookie', ownerCookie)
        .send(updateBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('ADMIN - should deny (lacks roles:manage)', async () => {
      const role = await prisma.role.create({
        data: {
          tenantId: testTenant.id,
          name: `Admin Test Role ${Date.now()}`,
          isSystem: false,
        },
      });

      const response = await request(app)
        .put(`/api/roles/${role.id}`)
        .set('Cookie', adminCookie)
        .send(updateBody);

      expect(response.status).toBe(403);
    });

    it('EDITOR - should deny (lacks roles:manage)', async () => {
      const role = await prisma.role.create({
        data: {
          tenantId: testTenant.id,
          name: `Editor Test Role ${Date.now()}`,
          isSystem: false,
        },
      });

      const response = await request(app)
        .put(`/api/roles/${role.id}`)
        .set('Cookie', editorCookie)
        .send(updateBody);

      expect(response.status).toBe(403);
    });

    it('VIEWER - should deny (lacks roles:manage)', async () => {
      const role = await prisma.role.create({
        data: {
          tenantId: testTenant.id,
          name: `Viewer Test Role ${Date.now()}`,
          isSystem: false,
        },
      });

      const response = await request(app)
        .put(`/api/roles/${role.id}`)
        .set('Cookie', viewerCookie)
        .send(updateBody);

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const role = await prisma.role.create({
        data: {
          tenantId: testTenant.id,
          name: `Unauth Test Role ${Date.now()}`,
          isSystem: false,
        },
      });

      const response = await request(app)
        .put(`/api/roles/${role.id}`)
        .send(updateBody);

      expect(response.status).toBe(401);
    });

    it('Cross-tenant access - should return 404', async () => {
      const otherTenant = await createTestTenant();
      const otherRole = await prisma.role.create({
        data: {
          tenantId: otherTenant.id,
          name: `Other Role ${Date.now()}`,
          isSystem: false,
        },
      });

      const response = await request(app)
        .put(`/api/roles/${otherRole.id}`)
        .set('Cookie', ownerCookie)
        .send(updateBody);

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/roles/:roleId - Delete Role (Archive)', () => {
    it('OWNER - should allow (has roles:manage)', async () => {
      const role = await prisma.role.create({
        data: {
          tenantId: testTenant.id,
          name: `Delete Test Role ${Date.now()}`,
          isSystem: false,
        },
      });

      const response = await request(app)
        .delete(`/api/roles/${role.id}`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('ADMIN - should deny (lacks roles:manage)', async () => {
      const role = await prisma.role.create({
        data: {
          tenantId: testTenant.id,
          name: `Admin Delete Role ${Date.now()}`,
          isSystem: false,
        },
      });

      const response = await request(app)
        .delete(`/api/roles/${role.id}`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(403);
    });

    it('EDITOR - should deny (lacks roles:manage)', async () => {
      const role = await prisma.role.create({
        data: {
          tenantId: testTenant.id,
          name: `Editor Delete Role ${Date.now()}`,
          isSystem: false,
        },
      });

      const response = await request(app)
        .delete(`/api/roles/${role.id}`)
        .set('Cookie', editorCookie);

      expect(response.status).toBe(403);
    });

    it('VIEWER - should deny (lacks roles:manage)', async () => {
      const role = await prisma.role.create({
        data: {
          tenantId: testTenant.id,
          name: `Viewer Delete Role ${Date.now()}`,
          isSystem: false,
        },
      });

      const response = await request(app)
        .delete(`/api/roles/${role.id}`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const role = await prisma.role.create({
        data: {
          tenantId: testTenant.id,
          name: `Unauth Delete Role ${Date.now()}`,
          isSystem: false,
        },
      });

      const response = await request(app).delete(`/api/roles/${role.id}`);

      expect(response.status).toBe(401);
    });

    it('Cross-tenant access - should return 404', async () => {
      const otherTenant = await createTestTenant();
      const otherRole = await prisma.role.create({
        data: {
          tenantId: otherTenant.id,
          name: `Other Delete Role ${Date.now()}`,
          isSystem: false,
        },
      });

      const response = await request(app)
        .delete(`/api/roles/${otherRole.id}`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/roles/:roleId/restore - Restore Role', () => {
    it('OWNER - should allow (has roles:manage)', async () => {
      const role = await prisma.role.create({
        data: {
          tenantId: testTenant.id,
          name: `Restore Test Role ${Date.now()}`,
          isSystem: false,
        },
      });

      await request(app)
        .delete(`/api/roles/${role.id}`)
        .set('Cookie', ownerCookie);

      const response = await request(app)
        .post(`/api/roles/${role.id}/restore`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('ADMIN - should deny (lacks roles:manage)', async () => {
      const role = await prisma.role.create({
        data: {
          tenantId: testTenant.id,
          name: `Admin Restore Role ${Date.now()}`,
          isSystem: false,
        },
      });

      await request(app)
        .delete(`/api/roles/${role.id}`)
        .set('Cookie', ownerCookie);

      const response = await request(app)
        .post(`/api/roles/${role.id}/restore`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(403);
    });

    it('EDITOR - should deny (lacks roles:manage)', async () => {
      const role = await prisma.role.create({
        data: {
          tenantId: testTenant.id,
          name: `Editor Restore Role ${Date.now()}`,
          isSystem: false,
        },
      });

      await request(app)
        .delete(`/api/roles/${role.id}`)
        .set('Cookie', ownerCookie);

      const response = await request(app)
        .post(`/api/roles/${role.id}/restore`)
        .set('Cookie', editorCookie);

      expect(response.status).toBe(403);
    });

    it('VIEWER - should deny (lacks roles:manage)', async () => {
      const role = await prisma.role.create({
        data: {
          tenantId: testTenant.id,
          name: `Viewer Restore Role ${Date.now()}`,
          isSystem: false,
        },
      });

      await request(app)
        .delete(`/api/roles/${role.id}`)
        .set('Cookie', ownerCookie);

      const response = await request(app)
        .post(`/api/roles/${role.id}/restore`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const role = await prisma.role.create({
        data: {
          tenantId: testTenant.id,
          name: `Unauth Restore Role ${Date.now()}`,
          isSystem: false,
        },
      });

      await request(app)
        .delete(`/api/roles/${role.id}`)
        .set('Cookie', ownerCookie);

      const response = await request(app).post(`/api/roles/${role.id}/restore`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/roles/:roleId/activity - Get Role Activity', () => {
    it('OWNER - should allow access (has roles:manage)', async () => {
      const response = await request(app)
        .get(`/api/roles/${targetRole.id}/activity`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('ADMIN - should deny (lacks roles:manage)', async () => {
      const response = await request(app)
        .get(`/api/roles/${targetRole.id}/activity`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(403);
    });

    it('EDITOR - should deny (lacks roles:manage)', async () => {
      const response = await request(app)
        .get(`/api/roles/${targetRole.id}/activity`)
        .set('Cookie', editorCookie);

      expect(response.status).toBe(403);
    });

    it('VIEWER - should deny (lacks roles:manage)', async () => {
      const response = await request(app)
        .get(`/api/roles/${targetRole.id}/activity`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).get(`/api/roles/${targetRole.id}/activity`);

      expect(response.status).toBe(401);
    });

    it('Cross-tenant access - should return 200 with empty results', async () => {
      const otherTenant = await createTestTenant();
      const otherRole = await prisma.role.create({
        data: {
          tenantId: otherTenant.id,
          name: `Other Activity Role ${Date.now()}`,
          isSystem: false,
        },
      });

      const response = await request(app)
        .get(`/api/roles/${otherRole.id}/activity`)
        .set('Cookie', ownerCookie);

      // Activity endpoints typically return 200 with empty results for cross-tenant
      expect(response.status).toBe(200);
      expect(response.body.data.items).toEqual([]);
    });
  });
});
