// api-server/__tests__/features/branches/branchRoutes.test.ts
import request from 'supertest';
import express, { type Express } from 'express';
import { branchRouter } from '../../../src/routes/branchRouter.js';
import { sessionMiddleware } from '../../../src/middleware/sessionMiddleware.js';
import { standardErrorHandler } from '../../../src/middleware/errorHandler.js';
import cookieParser from 'cookie-parser';
import {
  createTestUser,
  createTestTenant,
  createTestBranch,
  createTestRoleWithPermissions,
  createTestMembership,
} from '../../helpers/factories.js';
import { createSessionCookie } from '../../helpers/auth.js';
import { ROLE_DEFS } from '../../../src/rbac/catalog.js';

describe('[BRANCH-API] Branch API Routes', () => {
  let app: Express;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let sessionCookie: string;

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
    testUser = await createTestUser();

    // Use OWNER role since branch routes require tenant:manage permission
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

  describe('GET /api/branches - List Branches', () => {
    it('should list branches with authentication', async () => {
      await createTestBranch({ tenantId: testTenant.id, name: 'Branch 1' });
      await createTestBranch({ tenantId: testTenant.id, name: 'Branch 2' });

      const response = await request(app)
        .get('/api/branches')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeDefined();
      expect(response.body.data.items.length).toBeGreaterThanOrEqual(2);
    });

    it('should support pagination query params', async () => {
      await createTestBranch({ tenantId: testTenant.id });
      await createTestBranch({ tenantId: testTenant.id });

      const response = await request(app)
        .get('/api/branches?limit=1&includeTotal=true')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.items.length).toBe(1);
      expect(response.body.data.pageInfo.hasNextPage).toBe(true);
      expect(response.body.data.pageInfo.totalCount).toBeDefined();
    });

    it('should support search query', async () => {
      await createTestBranch({
        tenantId: testTenant.id,
        name: 'Warehouse Alpha',
      });

      const response = await request(app)
        .get('/api/branches?q=warehouse')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    it('should reject without authentication', async () => {
      const response = await request(app).get('/api/branches');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/branches/:branchId - Get Branch by ID', () => {
    it('should get branch by ID', async () => {
      const branch = await createTestBranch({
        tenantId: testTenant.id,
        name: 'Test Branch',
      });

      const response = await request(app)
        .get(`/api/branches/${branch.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.branch.id).toBe(branch.id);
      expect(response.body.data.branch.branchName).toBe('Test Branch');
    });

    it('should return 404 for non-existent branch', async () => {
      const response = await request(app)
        .get('/api/branches/non-existent-id')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
      expect(response.body.error?.errorCode).toBe('RESOURCE_NOT_FOUND');
    });

    it('should not allow access to other tenant branches', async () => {
      const otherTenant = await createTestTenant();
      const otherBranch = await createTestBranch({ tenantId: otherTenant.id });

      const response = await request(app)
        .get(`/api/branches/${otherBranch.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
    });

    it('should reject without authentication', async () => {
      const branch = await createTestBranch({ tenantId: testTenant.id });

      const response = await request(app).get(`/api/branches/${branch.id}`);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/branches - Create Branch', () => {
    it('should create branch with valid data', async () => {
      const response = await request(app)
        .post('/api/branches')
        .set('Cookie', sessionCookie)
        .send({
          branchSlug: 'new-warehouse',
          branchName: 'New Warehouse',
          isActive: true,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.branch).toBeDefined();
      expect(response.body.data.branch.branchSlug).toBe('new-warehouse');
      expect(response.body.data.branch.branchName).toBe('New Warehouse');
    });

    it('should validate request body with Zod', async () => {
      const response = await request(app)
        .post('/api/branches')
        .set('Cookie', sessionCookie)
        .send({
          branchSlug: 'INVALID SLUG',
          branchName: '',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error?.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should reject without tenant:manage permission', async () => {
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
        .post('/api/branches')
        .set('Cookie', viewerCookie)
        .send({
          branchSlug: 'test-branch',
          branchName: 'Test Branch',
        });

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('should reject without authentication', async () => {
      const response = await request(app)
        .post('/api/branches')
        .send({
          branchSlug: 'test',
          branchName: 'Test',
        });

      expect(response.status).toBe(401);
    });

    it('should support idempotency', async () => {
      const idempotencyKey = 'test-branch-key-123';
      const requestBody = {
        branchSlug: 'idempotent-branch',
        branchName: 'Idempotent Branch',
      };

      const response1 = await request(app)
        .post('/api/branches')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send(requestBody);

      expect(response1.status).toBe(201);
      const branchId = response1.body.data.branch.id;

      const response2 = await request(app)
        .post('/api/branches')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send(requestBody);

      expect(response2.status).toBe(201);
      expect(response2.body.data.branch.id).toBe(branchId);
    });
  });

  describe('PUT /api/branches/:branchId - Update Branch', () => {
    it('should update branch name', async () => {
      const branch = await createTestBranch({ tenantId: testTenant.id });

      const response = await request(app)
        .put(`/api/branches/${branch.id}`)
        .set('Cookie', sessionCookie)
        .send({
          branchName: 'Updated Name',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.branch.branchName).toBe('Updated Name');
    });

    it('should update branch slug', async () => {
      const branch = await createTestBranch({ tenantId: testTenant.id });

      const response = await request(app)
        .put(`/api/branches/${branch.id}`)
        .set('Cookie', sessionCookie)
        .send({
          branchSlug: 'new-slug',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.branch.branchSlug).toBe('new-slug');
    });

    it('should validate request body', async () => {
      const branch = await createTestBranch({ tenantId: testTenant.id });

      const response = await request(app)
        .put(`/api/branches/${branch.id}`)
        .set('Cookie', sessionCookie)
        .send({
          branchSlug: 'INVALID SLUG',
        });

      expect(response.status).toBe(400);
      expect(response.body.error?.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent branch', async () => {
      const response = await request(app)
        .put('/api/branches/non-existent-id')
        .set('Cookie', sessionCookie)
        .send({
          branchName: 'Updated',
        });

      expect(response.status).toBe(404);
    });

    it('should reject without tenant:manage permission', async () => {
      const branch = await createTestBranch({ tenantId: testTenant.id });

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
        .put(`/api/branches/${branch.id}`)
        .set('Cookie', viewerCookie)
        .send({
          branchName: 'Hacked',
        });

      expect(response.status).toBe(403);
    });

    it('should reject without authentication', async () => {
      const branch = await createTestBranch({ tenantId: testTenant.id });

      const response = await request(app)
        .put(`/api/branches/${branch.id}`)
        .send({
          branchName: 'Updated',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/branches/:branchId - Archive Branch', () => {
    it('should archive branch', async () => {
      const branch = await createTestBranch({ tenantId: testTenant.id });

      const response = await request(app)
        .delete(`/api/branches/${branch.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent branch', async () => {
      const response = await request(app)
        .delete('/api/branches/non-existent-id')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
    });

    it('should reject without tenant:manage permission', async () => {
      const branch = await createTestBranch({ tenantId: testTenant.id });

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
        .delete(`/api/branches/${branch.id}`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
    });

    it('should reject without authentication', async () => {
      const branch = await createTestBranch({ tenantId: testTenant.id });

      const response = await request(app).delete(`/api/branches/${branch.id}`);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/branches/:branchId/restore - Restore Branch', () => {
    it('should restore archived branch', async () => {
      const branch = await createTestBranch({ tenantId: testTenant.id });

      await request(app)
        .delete(`/api/branches/${branch.id}`)
        .set('Cookie', sessionCookie);

      const response = await request(app)
        .post(`/api/branches/${branch.id}/restore`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject without tenant:manage permission', async () => {
      const branch = await createTestBranch({ tenantId: testTenant.id });

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
        .post(`/api/branches/${branch.id}/restore`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
    });

    it('should reject without authentication', async () => {
      const branch = await createTestBranch({ tenantId: testTenant.id });

      const response = await request(app).post(
        `/api/branches/${branch.id}/restore`
      );

      expect(response.status).toBe(401);
    });
  });

  describe('Response Envelope Format', () => {
    it('should return standard success envelope', async () => {
      const response = await request(app)
        .get('/api/branches')
        .set('Cookie', sessionCookie);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('error', null);
    });

    it('should return standard error envelope', async () => {
      const response = await request(app)
        .get('/api/branches/non-existent-id')
        .set('Cookie', sessionCookie);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('errorCode');
      expect(response.body.error).toHaveProperty('httpStatusCode');
      expect(response.body.error).toHaveProperty('userFacingMessage');
    });
  });
});
