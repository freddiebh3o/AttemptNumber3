// api-server/__tests__/permissions/tenantUsers.permissions.test.ts
import request from 'supertest';
import express, { type Express } from 'express';
import { tenantUserRouter } from '../../src/routes/tenantUserRouter.js';
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

describe('[RBAC] Tenant Users Permissions', () => {
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

  // Test target user
  let targetUser: Awaited<ReturnType<typeof createTestUser>>;
  let targetRole: any;

  // Roles (created in beforeEach)
  let ownerRole: any;
  let adminRole: any;
  let editorRole: any;
  let viewerRole: any;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(sessionMiddleware);
    app.use('/api/tenant-users', tenantUserRouter);
    app.use(standardErrorHandler);
  });

  beforeEach(async () => {
    testTenant = await createTestTenant();

    // Create users for each role
    ownerUser = await createTestUser();
    adminUser = await createTestUser();
    editorUser = await createTestUser();
    viewerUser = await createTestUser();
    targetUser = await createTestUser();

    // Create roles (with proper system names for service logic)
    ownerRole = await createTestRoleWithPermissions({
      name: 'OWNER',
      tenantId: testTenant.id,
      permissionKeys: ROLE_DEFS.OWNER,
      isSystem: true,
    });
    adminRole = await createTestRoleWithPermissions({
      name: 'ADMIN',
      tenantId: testTenant.id,
      permissionKeys: ROLE_DEFS.ADMIN,
      isSystem: true,
    });
    editorRole = await createTestRoleWithPermissions({
      name: 'EDITOR',
      tenantId: testTenant.id,
      permissionKeys: ROLE_DEFS.EDITOR,
      isSystem: true,
    });
    viewerRole = await createTestRoleWithPermissions({
      name: 'VIEWER',
      tenantId: testTenant.id,
      permissionKeys: ROLE_DEFS.VIEWER,
      isSystem: true,
    });
    targetRole = await createTestRoleWithPermissions({
      name: 'EDITOR_TARGET',
      tenantId: testTenant.id,
      permissionKeys: ROLE_DEFS.EDITOR,
    });

    // Create memberships
    await createTestMembership({ userId: ownerUser.id, tenantId: testTenant.id, roleId: ownerRole.id });
    await createTestMembership({ userId: adminUser.id, tenantId: testTenant.id, roleId: adminRole.id });
    await createTestMembership({ userId: editorUser.id, tenantId: testTenant.id, roleId: editorRole.id });
    await createTestMembership({ userId: viewerUser.id, tenantId: testTenant.id, roleId: viewerRole.id });
    await createTestMembership({ userId: targetUser.id, tenantId: testTenant.id, roleId: targetRole.id });

    // Create session cookies
    ownerCookie = createSessionCookie(ownerUser.id, testTenant.id);
    adminCookie = createSessionCookie(adminUser.id, testTenant.id);
    editorCookie = createSessionCookie(editorUser.id, testTenant.id);
    viewerCookie = createSessionCookie(viewerUser.id, testTenant.id);
  });

  describe('GET /api/tenant-users - List Tenant Users', () => {
    it('OWNER - should allow access (has users:manage)', async () => {
      const response = await request(app)
        .get('/api/tenant-users')
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeDefined();
    });

    it('ADMIN - should allow access (has users:manage)', async () => {
      const response = await request(app)
        .get('/api/tenant-users')
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('EDITOR - should deny (lacks users:manage)', async () => {
      const response = await request(app)
        .get('/api/tenant-users')
        .set('Cookie', editorCookie);

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('VIEWER - should deny (lacks users:manage)', async () => {
      const response = await request(app)
        .get('/api/tenant-users')
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('Custom role with users:manage - should allow', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['users:manage'],
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .get('/api/tenant-users')
        .set('Cookie', customCookie);

      expect(response.status).toBe(200);
    });

    it('Custom role without users:manage - should deny', async () => {
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
        .get('/api/tenant-users')
        .set('Cookie', customCookie);

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).get('/api/tenant-users');

      expect(response.status).toBe(401);
      expect(response.body.error?.errorCode).toBe('AUTH_REQUIRED');
    });
  });

  describe('GET /api/tenant-users/:userId - Get Tenant User by ID', () => {
    it('OWNER - should allow access (has users:manage)', async () => {
      const response = await request(app)
        .get(`/api/tenant-users/${targetUser.id}`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
    });

    it('ADMIN - should allow access (has users:manage)', async () => {
      const response = await request(app)
        .get(`/api/tenant-users/${targetUser.id}`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
    });

    it('EDITOR - should deny (lacks users:manage)', async () => {
      const response = await request(app)
        .get(`/api/tenant-users/${targetUser.id}`)
        .set('Cookie', editorCookie);

      expect(response.status).toBe(403);
    });

    it('VIEWER - should deny (lacks users:manage)', async () => {
      const response = await request(app)
        .get(`/api/tenant-users/${targetUser.id}`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).get(`/api/tenant-users/${targetUser.id}`);

      expect(response.status).toBe(401);
    });

    it('Cross-tenant access - should return 404', async () => {
      const otherTenant = await createTestTenant();
      const otherUser = await createTestUser();
      const otherRole = await createTestRoleWithPermissions({
        tenantId: otherTenant.id,
        permissionKeys: ROLE_DEFS.EDITOR,
      });
      await createTestMembership({
        userId: otherUser.id,
        tenantId: otherTenant.id,
        roleId: otherRole.id,
      });

      const response = await request(app)
        .get(`/api/tenant-users/${otherUser.id}`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/tenant-users - Create Tenant User (Invite)', () => {
    const requestBody = {
      email: 'newuser@test.com',
      password: 'Password123!',
      roleId: '', // Will be set in test
    };

    it('OWNER - should allow (has users:manage)', async () => {
      const response = await request(app)
        .post('/api/tenant-users')
        .set('Cookie', ownerCookie)
        .send({ ...requestBody, roleId: targetRole.id });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
    });

    it('ADMIN - should allow (has users:manage)', async () => {
      const response = await request(app)
        .post('/api/tenant-users')
        .set('Cookie', adminCookie)
        .send({ ...requestBody, email: 'admin-invite@test.com', roleId: targetRole.id });

      expect(response.status).toBe(201);
    });

    it('EDITOR - should deny (lacks users:manage)', async () => {
      const response = await request(app)
        .post('/api/tenant-users')
        .set('Cookie', editorCookie)
        .send({ ...requestBody, email: 'editor-invite@test.com', roleId: targetRole.id });

      expect(response.status).toBe(403);
    });

    it('VIEWER - should deny (lacks users:manage)', async () => {
      const response = await request(app)
        .post('/api/tenant-users')
        .set('Cookie', viewerCookie)
        .send({ ...requestBody, email: 'viewer-invite@test.com', roleId: targetRole.id });

      expect(response.status).toBe(403);
    });

    it('Custom role with permission - should allow', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['users:manage'],
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .post('/api/tenant-users')
        .set('Cookie', customCookie)
        .send({ ...requestBody, email: 'custom-invite@test.com', roleId: targetRole.id });

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
        .post('/api/tenant-users')
        .set('Cookie', customCookie)
        .send({ ...requestBody, email: 'custom-denied@test.com', roleId: targetRole.id });

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app)
        .post('/api/tenant-users')
        .send({ ...requestBody, email: 'unauth-invite@test.com', roleId: targetRole.id });

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/tenant-users/:userId - Update Tenant User', () => {
    it('OWNER - should allow (has users:manage)', async () => {
      const updateUser = await createTestUser();
      await createTestMembership({
        userId: updateUser.id,
        tenantId: testTenant.id,
        roleId: targetRole.id,
      });

      const response = await request(app)
        .put(`/api/tenant-users/${updateUser.id}`)
        .set('Cookie', ownerCookie)
        .send({ email: `owner-updated-${Date.now()}@test.com` });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('ADMIN - should allow (has users:manage)', async () => {
      const updateUser = await createTestUser();
      await createTestMembership({
        userId: updateUser.id,
        tenantId: testTenant.id,
        roleId: targetRole.id,
      });

      const response = await request(app)
        .put(`/api/tenant-users/${updateUser.id}`)
        .set('Cookie', adminCookie)
        .send({ email: `admin-updated-${Date.now()}@test.com` });

      expect(response.status).toBe(200);
    });

    it('EDITOR - should deny (lacks users:manage)', async () => {
      const response = await request(app)
        .put(`/api/tenant-users/${targetUser.id}`)
        .set('Cookie', editorCookie)
        .send({ email: 'editor-attempt@test.com' });

      expect(response.status).toBe(403);
    });

    it('VIEWER - should deny (lacks users:manage)', async () => {
      const response = await request(app)
        .put(`/api/tenant-users/${targetUser.id}`)
        .set('Cookie', viewerCookie)
        .send({ email: 'viewer-attempt@test.com' });

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app)
        .put(`/api/tenant-users/${targetUser.id}`)
        .send({ email: 'unauth-attempt@test.com' });

      expect(response.status).toBe(401);
    });

    it('Cross-tenant access - should return 404', async () => {
      const otherTenant = await createTestTenant();
      const otherUser = await createTestUser();
      const otherRole = await createTestRoleWithPermissions({
        tenantId: otherTenant.id,
        permissionKeys: ROLE_DEFS.EDITOR,
      });
      await createTestMembership({
        userId: otherUser.id,
        tenantId: otherTenant.id,
        roleId: otherRole.id,
      });

      const response = await request(app)
        .put(`/api/tenant-users/${otherUser.id}`)
        .set('Cookie', ownerCookie)
        .send({ email: 'cross-tenant-attempt@test.com' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/tenant-users/:userId - Remove User from Tenant', () => {
    it('OWNER - should allow (has users:manage)', async () => {
      const response = await request(app)
        .delete(`/api/tenant-users/${targetUser.id}`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.hasArchivedMembership).toBe(true);
    });

    it('ADMIN - should allow (has users:manage)', async () => {
      const deleteUser = await createTestUser();
      await createTestMembership({
        userId: deleteUser.id,
        tenantId: testTenant.id,
        roleId: targetRole.id,
      });

      const response = await request(app)
        .delete(`/api/tenant-users/${deleteUser.id}`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('EDITOR - should deny (lacks users:manage)', async () => {
      const deleteUser = await createTestUser();
      await createTestMembership({
        userId: deleteUser.id,
        tenantId: testTenant.id,
        roleId: targetRole.id,
      });

      const response = await request(app)
        .delete(`/api/tenant-users/${deleteUser.id}`)
        .set('Cookie', editorCookie);

      expect(response.status).toBe(403);
    });

    it('VIEWER - should deny (lacks users:manage)', async () => {
      const deleteUser = await createTestUser();
      await createTestMembership({
        userId: deleteUser.id,
        tenantId: testTenant.id,
        roleId: targetRole.id,
      });

      const response = await request(app)
        .delete(`/api/tenant-users/${deleteUser.id}`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const deleteUser = await createTestUser();
      await createTestMembership({
        userId: deleteUser.id,
        tenantId: testTenant.id,
        roleId: targetRole.id,
      });

      const response = await request(app).delete(`/api/tenant-users/${deleteUser.id}`);

      expect(response.status).toBe(401);
    });

    it('Cross-tenant access - should return 404', async () => {
      const otherTenant = await createTestTenant();
      const otherUser = await createTestUser();
      const otherRole = await createTestRoleWithPermissions({
        tenantId: otherTenant.id,
        permissionKeys: ROLE_DEFS.EDITOR,
      });
      await createTestMembership({
        userId: otherUser.id,
        tenantId: otherTenant.id,
        roleId: otherRole.id,
      });

      const response = await request(app)
        .delete(`/api/tenant-users/${otherUser.id}`)
        .set('Cookie', ownerCookie);

      // Cross-tenant returns 200 with hasArchivedMembership: false (not found in current tenant)
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.hasArchivedMembership).toBe(false);
    });
  });

  describe('POST /api/tenant-users/:userId/restore - Restore User Membership', () => {
    it('OWNER - should allow (has users:manage)', async () => {
      // First delete the user
      await request(app)
        .delete(`/api/tenant-users/${targetUser.id}`)
        .set('Cookie', ownerCookie);

      const response = await request(app)
        .post(`/api/tenant-users/${targetUser.id}/restore`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('ADMIN - should allow (has users:manage)', async () => {
      const restoreUser = await createTestUser();
      await createTestMembership({
        userId: restoreUser.id,
        tenantId: testTenant.id,
        roleId: targetRole.id,
      });

      await request(app)
        .delete(`/api/tenant-users/${restoreUser.id}`)
        .set('Cookie', adminCookie);

      const response = await request(app)
        .post(`/api/tenant-users/${restoreUser.id}/restore`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
    });

    it('EDITOR - should deny (lacks users:manage)', async () => {
      const restoreUser = await createTestUser();
      await createTestMembership({
        userId: restoreUser.id,
        tenantId: testTenant.id,
        roleId: targetRole.id,
      });

      await request(app)
        .delete(`/api/tenant-users/${restoreUser.id}`)
        .set('Cookie', ownerCookie);

      const response = await request(app)
        .post(`/api/tenant-users/${restoreUser.id}/restore`)
        .set('Cookie', editorCookie);

      expect(response.status).toBe(403);
    });

    it('VIEWER - should deny (lacks users:manage)', async () => {
      const restoreUser = await createTestUser();
      await createTestMembership({
        userId: restoreUser.id,
        tenantId: testTenant.id,
        roleId: targetRole.id,
      });

      await request(app)
        .delete(`/api/tenant-users/${restoreUser.id}`)
        .set('Cookie', ownerCookie);

      const response = await request(app)
        .post(`/api/tenant-users/${restoreUser.id}/restore`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const restoreUser = await createTestUser();
      await createTestMembership({
        userId: restoreUser.id,
        tenantId: testTenant.id,
        roleId: targetRole.id,
      });

      await request(app)
        .delete(`/api/tenant-users/${restoreUser.id}`)
        .set('Cookie', ownerCookie);

      const response = await request(app).post(`/api/tenant-users/${restoreUser.id}/restore`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/tenant-users/:userId/activity - Get User Activity', () => {
    it('OWNER - should allow access (has users:manage)', async () => {
      const response = await request(app)
        .get(`/api/tenant-users/${targetUser.id}/activity`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('ADMIN - should allow access (has users:manage)', async () => {
      const response = await request(app)
        .get(`/api/tenant-users/${targetUser.id}/activity`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
    });

    it('EDITOR - should deny (lacks users:manage)', async () => {
      const response = await request(app)
        .get(`/api/tenant-users/${targetUser.id}/activity`)
        .set('Cookie', editorCookie);

      expect(response.status).toBe(403);
    });

    it('VIEWER - should deny (lacks users:manage)', async () => {
      const response = await request(app)
        .get(`/api/tenant-users/${targetUser.id}/activity`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).get(`/api/tenant-users/${targetUser.id}/activity`);

      expect(response.status).toBe(401);
    });

    it('Cross-tenant access - should return 200 with empty results', async () => {
      const otherTenant = await createTestTenant();
      const otherUser = await createTestUser();
      const otherRole = await createTestRoleWithPermissions({
        tenantId: otherTenant.id,
        permissionKeys: ROLE_DEFS.EDITOR,
      });
      await createTestMembership({
        userId: otherUser.id,
        tenantId: otherTenant.id,
        roleId: otherRole.id,
      });

      const response = await request(app)
        .get(`/api/tenant-users/${otherUser.id}/activity`)
        .set('Cookie', ownerCookie);

      // Activity endpoints typically return 200 with empty results for cross-tenant
      expect(response.status).toBe(200);
      expect(response.body.data.items).toEqual([]);
    });
  });

  describe('[OWNER-ASSIGN-SEC] OWNER Role Assignment Security', () => {
    describe('POST /api/tenant-users - Create User with OWNER Role', () => {
      it('OWNER - should allow creating user with OWNER role (returns 201)', async () => {
        const timestamp = Date.now();
        const requestBody = {
          email: `new-owner-${timestamp}@test.com`,
          password: 'Password123!',
          roleId: ownerRole.id,
        };

        const response = await request(app)
          .post('/api/tenant-users')
          .set('Cookie', ownerCookie)
          .send(requestBody);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.user.role.name).toBe('OWNER');
      });

      it('ADMIN - should deny creating user with OWNER role (returns 403)', async () => {
        const timestamp = Date.now();
        const requestBody = {
          email: `blocked-owner-${timestamp}@test.com`,
          password: 'Password123!',
          roleId: ownerRole.id,
        };

        const response = await request(app)
          .post('/api/tenant-users')
          .set('Cookie', adminCookie)
          .send(requestBody);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error?.errorCode).toBe('CANT_ASSIGN_OWNER_ROLE');
        expect(response.body.error?.userFacingMessage).toContain('Only OWNER users can assign the OWNER role');
      });

      it('ADMIN - should allow creating user with non-OWNER roles (returns 201)', async () => {
        const timestamp = Date.now();
        const requestBody = {
          email: `admin-created-${timestamp}@test.com`,
          password: 'Password123!',
          roleId: editorRole.id,
        };

        const response = await request(app)
          .post('/api/tenant-users')
          .set('Cookie', adminCookie)
          .send(requestBody);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.user.role.name).toBe('EDITOR');
      });

      it('Custom role with users:manage - should deny OWNER assignment (returns 403)', async () => {
        const customUser = await createTestUser();
        const customRole = await createTestRoleWithPermissions({
          tenantId: testTenant.id,
          permissionKeys: ['users:manage'],
        });
        await createTestMembership({
          userId: customUser.id,
          tenantId: testTenant.id,
          roleId: customRole.id,
        });
        const customCookie = createSessionCookie(customUser.id, testTenant.id);

        const timestamp = Date.now();
        const requestBody = {
          email: `custom-blocked-${timestamp}@test.com`,
          password: 'Password123!',
          roleId: ownerRole.id,
        };

        const response = await request(app)
          .post('/api/tenant-users')
          .set('Cookie', customCookie)
          .send(requestBody);

        expect(response.status).toBe(403);
        expect(response.body.error?.errorCode).toBe('CANT_ASSIGN_OWNER_ROLE');
      });
    });

    describe('PUT /api/tenant-users/:userId - Update User to OWNER Role', () => {
      it('OWNER - should allow updating user to OWNER role (returns 200)', async () => {
        const targetUser = await createTestUser();
        await createTestMembership({
          userId: targetUser.id,
          tenantId: testTenant.id,
          roleId: editorRole.id,
        });

        const response = await request(app)
          .put(`/api/tenant-users/${targetUser.id}`)
          .set('Cookie', ownerCookie)
          .send({ roleId: ownerRole.id });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.user.role.name).toBe('OWNER');
      });

      it('ADMIN - should deny updating user to OWNER role (returns 403)', async () => {
        const targetUser = await createTestUser();
        await createTestMembership({
          userId: targetUser.id,
          tenantId: testTenant.id,
          roleId: editorRole.id,
        });

        const response = await request(app)
          .put(`/api/tenant-users/${targetUser.id}`)
          .set('Cookie', adminCookie)
          .send({ roleId: ownerRole.id });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error?.errorCode).toBe('CANT_ASSIGN_OWNER_ROLE');
      });

      it('ADMIN - should allow updating user to non-OWNER roles (returns 200)', async () => {
        const targetUser = await createTestUser();
        await createTestMembership({
          userId: targetUser.id,
          tenantId: testTenant.id,
          roleId: viewerRole.id, // Use existing viewerRole from beforeEach
        });

        const response = await request(app)
          .put(`/api/tenant-users/${targetUser.id}`)
          .set('Cookie', adminCookie)
          .send({ roleId: editorRole.id });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.user.role.name).toBe('EDITOR');
      });
    });
  });
});
