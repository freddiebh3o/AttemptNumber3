// api-server/__tests__/permissions/branches.permissions.test.ts
import request from 'supertest';
import express, { type Express } from 'express';
import { branchRouter } from '../../src/routes/branchRouter.js';
import { sessionMiddleware } from '../../src/middleware/sessionMiddleware.js';
import { standardErrorHandler } from '../../src/middleware/errorHandler.js';
import cookieParser from 'cookie-parser';
import {
  createTestUser,
  createTestTenant,
  createTestBranch,
  createTestRoleWithPermissions,
  createTestMembership,
} from '../helpers/factories.js';
import { createSessionCookie } from '../helpers/auth.js';
import { ROLE_DEFS } from '../../src/rbac/catalog.js';
import { prismaClientInstance as prisma } from '../../src/db/prismaClient.js';

describe('[RBAC] Branches Permissions', () => {
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

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(sessionMiddleware);
    app.use('/api/branches', branchRouter);
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

  describe('GET /api/branches - List Branches', () => {
    it('OWNER - should allow access (authenticated)', async () => {
      const response = await request(app)
        .get('/api/branches')
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('ADMIN - should allow access (authenticated)', async () => {
      const response = await request(app)
        .get('/api/branches')
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('EDITOR - should allow access (authenticated)', async () => {
      const response = await request(app)
        .get('/api/branches')
        .set('Cookie', editorCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('VIEWER - should allow access (authenticated)', async () => {
      const response = await request(app)
        .get('/api/branches')
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).get('/api/branches');

      expect(response.status).toBe(401);
      expect(response.body.error?.errorCode).toBe('AUTH_REQUIRED');
    });
  });

  describe('GET /api/branches/:id - Get Branch by ID', () => {
    let testBranch: Awaited<ReturnType<typeof createTestBranch>>;

    beforeEach(async () => {
      testBranch = await createTestBranch({
        tenantId: testTenant.id,
      });
    });

    it('OWNER - should allow access (authenticated)', async () => {
      const response = await request(app)
        .get(`/api/branches/${testBranch.id}`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.branch.id).toBe(testBranch.id);
    });

    it('ADMIN - should allow access (authenticated)', async () => {
      const response = await request(app)
        .get(`/api/branches/${testBranch.id}`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('EDITOR - should allow access (authenticated)', async () => {
      const response = await request(app)
        .get(`/api/branches/${testBranch.id}`)
        .set('Cookie', editorCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('VIEWER - should allow access (authenticated)', async () => {
      const response = await request(app)
        .get(`/api/branches/${testBranch.id}`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).get(`/api/branches/${testBranch.id}`);

      expect(response.status).toBe(401);
      expect(response.body.error?.errorCode).toBe('AUTH_REQUIRED');
    });

    it('Cross-tenant access - should deny (404)', async () => {
      const otherTenant = await createTestTenant();
      const otherBranch = await createTestBranch({
        tenantId: otherTenant.id,
      });

      const response = await request(app)
        .get(`/api/branches/${otherBranch.id}`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/branches/:id/activity - Get Branch Activity', () => {
    let testBranch: Awaited<ReturnType<typeof createTestBranch>>;

    beforeEach(async () => {
      testBranch = await createTestBranch({
        tenantId: testTenant.id,
      });
    });

    it('OWNER - should allow access (authenticated)', async () => {
      const response = await request(app)
        .get(`/api/branches/${testBranch.id}/activity`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('ADMIN - should allow access (authenticated)', async () => {
      const response = await request(app)
        .get(`/api/branches/${testBranch.id}/activity`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
    });

    it('EDITOR - should allow access (authenticated)', async () => {
      const response = await request(app)
        .get(`/api/branches/${testBranch.id}/activity`)
        .set('Cookie', editorCookie);

      expect(response.status).toBe(200);
    });

    it('VIEWER - should allow access (authenticated)', async () => {
      const response = await request(app)
        .get(`/api/branches/${testBranch.id}/activity`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(200);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).get(`/api/branches/${testBranch.id}/activity`);

      expect(response.status).toBe(401);
    });

    it('Cross-tenant access - should return empty results (200)', async () => {
      const otherTenant = await createTestTenant();
      const otherBranch = await createTestBranch({
        tenantId: otherTenant.id,
      });

      const response = await request(app)
        .get(`/api/branches/${otherBranch.id}/activity`)
        .set('Cookie', ownerCookie);

      // Activity endpoints filter by tenantId, so cross-tenant requests return empty results (200)
      // rather than 404. This is acceptable - tenant isolation is still enforced.
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(0); // Empty results
    });
  });

  describe('POST /api/branches - Create Branch', () => {
    const createBody = {
      branchSlug: 'test-branch',
      branchName: 'Test Branch',
      isActive: true,
    };

    it('OWNER - should allow (has tenant:manage)', async () => {
      const response = await request(app)
        .post('/api/branches')
        .set('Cookie', ownerCookie)
        .send({ ...createBody, branchSlug: 'owner-branch' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.branch.branchName).toBe('Test Branch');
    });

    it('ADMIN - should deny (lacks tenant:manage)', async () => {
      const response = await request(app)
        .post('/api/branches')
        .set('Cookie', adminCookie)
        .send({ ...createBody, branchSlug: 'admin-branch' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('EDITOR - should deny (lacks tenant:manage)', async () => {
      const response = await request(app)
        .post('/api/branches')
        .set('Cookie', editorCookie)
        .send({ ...createBody, branchSlug: 'editor-branch' });

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('VIEWER - should deny (lacks tenant:manage)', async () => {
      const response = await request(app)
        .post('/api/branches')
        .set('Cookie', viewerCookie)
        .send({ ...createBody, branchSlug: 'viewer-branch' });

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('Custom role with permission - should allow', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['tenant:manage'],
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .post('/api/branches')
        .set('Cookie', customCookie)
        .send({ ...createBody, branchSlug: 'custom-branch' });

      expect(response.status).toBe(201);
    });

    it('Custom role without permission - should deny (403)', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'], // Wrong permission
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .post('/api/branches')
        .set('Cookie', customCookie)
        .send({ ...createBody, branchSlug: 'custom-deny-branch' });

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app)
        .post('/api/branches')
        .send(createBody);

      expect(response.status).toBe(401);
      expect(response.body.error?.errorCode).toBe('AUTH_REQUIRED');
    });
  });

  describe('PUT /api/branches/:id - Update Branch', () => {
    let testBranch: Awaited<ReturnType<typeof createTestBranch>>;

    beforeEach(async () => {
      testBranch = await createTestBranch({
        tenantId: testTenant.id,
      });
    });

    const updateBody = {
      branchName: 'Updated Branch Name',
      isActive: false,
    };

    it('OWNER - should allow (has tenant:manage)', async () => {
      const response = await request(app)
        .put(`/api/branches/${testBranch.id}`)
        .set('Cookie', ownerCookie)
        .send(updateBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.branch.branchName).toBe('Updated Branch Name');
    });

    it('ADMIN - should deny (lacks tenant:manage)', async () => {
      const response = await request(app)
        .put(`/api/branches/${testBranch.id}`)
        .set('Cookie', adminCookie)
        .send(updateBody);

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('EDITOR - should deny (lacks tenant:manage)', async () => {
      const response = await request(app)
        .put(`/api/branches/${testBranch.id}`)
        .set('Cookie', editorCookie)
        .send(updateBody);

      expect(response.status).toBe(403);
    });

    it('VIEWER - should deny (lacks tenant:manage)', async () => {
      const response = await request(app)
        .put(`/api/branches/${testBranch.id}`)
        .set('Cookie', viewerCookie)
        .send(updateBody);

      expect(response.status).toBe(403);
    });

    it('Custom role with permission - should allow', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['tenant:manage'],
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .put(`/api/branches/${testBranch.id}`)
        .set('Cookie', customCookie)
        .send(updateBody);

      expect(response.status).toBe(200);
    });

    it('Custom role without permission - should deny (403)', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:write'],
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .put(`/api/branches/${testBranch.id}`)
        .set('Cookie', customCookie)
        .send(updateBody);

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app)
        .put(`/api/branches/${testBranch.id}`)
        .send(updateBody);

      expect(response.status).toBe(401);
    });

    it('Cross-tenant access - should deny (404)', async () => {
      const otherTenant = await createTestTenant();
      const otherBranch = await createTestBranch({
        tenantId: otherTenant.id,
      });

      const response = await request(app)
        .put(`/api/branches/${otherBranch.id}`)
        .set('Cookie', ownerCookie)
        .send(updateBody);

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/branches/:id - Archive Branch', () => {
    let testBranch: Awaited<ReturnType<typeof createTestBranch>>;

    beforeEach(async () => {
      testBranch = await createTestBranch({
        tenantId: testTenant.id,
      });
    });

    it('OWNER - should allow (has tenant:manage)', async () => {
      const response = await request(app)
        .delete(`/api/branches/${testBranch.id}`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('ADMIN - should deny (lacks tenant:manage)', async () => {
      const branch = await createTestBranch({ tenantId: testTenant.id });
      const response = await request(app)
        .delete(`/api/branches/${branch.id}`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('EDITOR - should deny (lacks tenant:manage)', async () => {
      const branch = await createTestBranch({ tenantId: testTenant.id });
      const response = await request(app)
        .delete(`/api/branches/${branch.id}`)
        .set('Cookie', editorCookie);

      expect(response.status).toBe(403);
    });

    it('VIEWER - should deny (lacks tenant:manage)', async () => {
      const response = await request(app)
        .delete(`/api/branches/${testBranch.id}`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
    });

    it('Custom role with permission - should allow', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['tenant:manage'],
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .delete(`/api/branches/${testBranch.id}`)
        .set('Cookie', customCookie);

      expect(response.status).toBe(200);
    });

    it('Custom role without permission - should deny (403)', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:write'],
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .delete(`/api/branches/${testBranch.id}`)
        .set('Cookie', customCookie);

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).delete(`/api/branches/${testBranch.id}`);

      expect(response.status).toBe(401);
    });

    it('Cross-tenant access - should deny (404)', async () => {
      const otherTenant = await createTestTenant();
      const otherBranch = await createTestBranch({
        tenantId: otherTenant.id,
      });

      const response = await request(app)
        .delete(`/api/branches/${otherBranch.id}`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/branches/:id/restore - Restore Archived Branch', () => {
    let archivedBranch: Awaited<ReturnType<typeof createTestBranch>>;

    beforeEach(async () => {
      archivedBranch = await createTestBranch({
        tenantId: testTenant.id,
      });
      // Manually archive the branch
      await prisma.branch.update({
        where: { id: archivedBranch.id },
        data: { isArchived: true, archivedAt: new Date(), archivedByUserId: ownerUser.id },
      });
    });

    it('OWNER - should allow (has tenant:manage)', async () => {
      const response = await request(app)
        .post(`/api/branches/${archivedBranch.id}/restore`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('ADMIN - should deny (lacks tenant:manage)', async () => {
      const branch = await createTestBranch({ tenantId: testTenant.id });
      await prisma.branch.update({
        where: { id: branch.id },
        data: { isArchived: true, archivedAt: new Date(), archivedByUserId: ownerUser.id },
      });
      const response = await request(app)
        .post(`/api/branches/${branch.id}/restore`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('EDITOR - should deny (lacks tenant:manage)', async () => {
      const branch = await createTestBranch({ tenantId: testTenant.id });
      await prisma.branch.update({
        where: { id: branch.id },
        data: { isArchived: true, archivedAt: new Date(), archivedByUserId: ownerUser.id },
      });
      const response = await request(app)
        .post(`/api/branches/${branch.id}/restore`)
        .set('Cookie', editorCookie);

      expect(response.status).toBe(403);
    });

    it('VIEWER - should deny (lacks tenant:manage)', async () => {
      const response = await request(app)
        .post(`/api/branches/${archivedBranch.id}/restore`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
    });

    it('Custom role with permission - should allow', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['tenant:manage'],
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .post(`/api/branches/${archivedBranch.id}/restore`)
        .set('Cookie', customCookie);

      expect(response.status).toBe(200);
    });

    it('Custom role without permission - should deny (403)', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:write'],
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .post(`/api/branches/${archivedBranch.id}/restore`)
        .set('Cookie', customCookie);

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).post(`/api/branches/${archivedBranch.id}/restore`);

      expect(response.status).toBe(401);
    });

    it('Cross-tenant access - should deny (404)', async () => {
      const otherTenant = await createTestTenant();
      const otherBranch = await createTestBranch({
        tenantId: otherTenant.id,
      });
      await prisma.branch.update({
        where: { id: otherBranch.id },
        data: { isArchived: true, archivedAt: new Date(), archivedByUserId: ownerUser.id },
      });

      const response = await request(app)
        .post(`/api/branches/${otherBranch.id}/restore`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(404);
    });
  });
});
