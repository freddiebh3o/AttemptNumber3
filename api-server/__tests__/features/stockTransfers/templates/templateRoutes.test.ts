// api-server/__tests__/features/stockTransfers/templates/templateRoutes.test.ts
import request from 'supertest';
import express, { type Express } from 'express';
import { stockTransferTemplatesRouter } from '../../../../src/routes/stockTransferTemplatesRouter.js';
import { sessionMiddleware } from '../../../../src/middleware/sessionMiddleware.js';
import { standardErrorHandler } from '../../../../src/middleware/errorHandler.js';
import cookieParser from 'cookie-parser';
import {
  createTestUser,
  createTestTenant,
  createTestBranch,
  createTestProduct,
  createTestRoleWithPermissions,
  createTestMembership,
} from '../../../helpers/factories.js';
import { createSessionCookie } from '../../../helpers/auth.js';
import { ROLE_DEFS } from '../../../../src/rbac/catalog.js';
import * as templateService from '../../../../src/services/stockTransfers/templateService.js';

describe('[TEMPLATE-API] Stock Transfer Template API Routes', () => {
  let app: Express;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let sourceBranch: Awaited<ReturnType<typeof createTestBranch>>;
  let destinationBranch: Awaited<ReturnType<typeof createTestBranch>>;
  let product1: Awaited<ReturnType<typeof createTestProduct>>;
  let product2: Awaited<ReturnType<typeof createTestProduct>>;
  let sessionCookie: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(sessionMiddleware);
    app.use('/api/stock-transfer-templates', stockTransferTemplatesRouter);
    app.use(standardErrorHandler);
  });

  beforeEach(async () => {
    testTenant = await createTestTenant();
    testUser = await createTestUser();

    // Use ADMIN role (has stock:read and stock:write permissions)
    const role = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ROLE_DEFS.ADMIN,
    });

    await createTestMembership({
      userId: testUser.id,
      tenantId: testTenant.id,
      roleId: role.id,
    });

    sourceBranch = await createTestBranch({ tenantId: testTenant.id });
    destinationBranch = await createTestBranch({ tenantId: testTenant.id });
    product1 = await createTestProduct({ tenantId: testTenant.id });
    product2 = await createTestProduct({ tenantId: testTenant.id });

    sessionCookie = createSessionCookie(testUser.id, testTenant.id);
  });

  describe('GET /api/stock-transfer-templates - List Templates', () => {
    it('should list templates with stock:read permission', async () => {
      await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Weekly Restock',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, defaultQty: 10 }],
        },
      });

      const response = await request(app)
        .get('/api/stock-transfer-templates')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeDefined();
      expect(response.body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    it('should support query filtering by source branch', async () => {
      await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Source Filter Test',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, defaultQty: 5 }],
        },
      });

      const response = await request(app)
        .get(`/api/stock-transfer-templates?sourceBranchId=${sourceBranch.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    it('should reject without authentication', async () => {
      const response = await request(app).get('/api/stock-transfer-templates');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should allow VIEWER with stock:read permission to list templates', async () => {
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
        .get('/api/stock-transfer-templates')
        .set('Cookie', viewerCookie);

      // VIEWER has stock:read permission, so should be able to list templates
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/stock-transfer-templates/:templateId - Get Template', () => {
    it('should get template by ID with stock:read permission', async () => {
      const template = await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Get Test Template',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, defaultQty: 15 }],
        },
      });

      const response = await request(app)
        .get(`/api/stock-transfer-templates/${template.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(template.id);
      expect(response.body.data.name).toBe('Get Test Template');
    });

    it('should return 404 for non-existent template', async () => {
      const response = await request(app)
        .get('/api/stock-transfer-templates/non-existent-id')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
    });

    it('should reject without authentication', async () => {
      const template = await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Auth Test',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, defaultQty: 10 }],
        },
      });

      const response = await request(app).get(`/api/stock-transfer-templates/${template.id}`);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/stock-transfer-templates - Create Template', () => {
    it('should create template with valid data', async () => {
      const response = await request(app)
        .post('/api/stock-transfer-templates')
        .set('Cookie', sessionCookie)
        .send({
          name: 'Monthly Transfer',
          description: 'Monthly stock replenishment',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [
            { productId: product1.id, defaultQty: 20 },
            { productId: product2.id, defaultQty: 30 },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Monthly Transfer');
      expect(response.body.data.items.length).toBe(2);
    });

    it('should validate request body schema', async () => {
      const response = await request(app)
        .post('/api/stock-transfer-templates')
        .set('Cookie', sessionCookie)
        .send({
          name: '',  // Empty name (invalid)
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [],  // Empty items (invalid)
        });

      expect(response.status).toBe(400);
      expect(response.body.error?.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should reject without stock:write permission', async () => {
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
        .post('/api/stock-transfer-templates')
        .set('Cookie', viewerCookie)
        .send({
          name: 'Test',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, defaultQty: 10 }],
        });

      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /api/stock-transfer-templates/:templateId - Update Template', () => {
    it('should update template with valid data', async () => {
      const template = await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Original Name',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, defaultQty: 10 }],
        },
      });

      const response = await request(app)
        .patch(`/api/stock-transfer-templates/${template.id}`)
        .set('Cookie', sessionCookie)
        .send({
          name: 'Updated Name',
          description: 'Updated description',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Updated Name');
    });

    it('should reject without stock:write permission', async () => {
      const template = await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Test',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, defaultQty: 10 }],
        },
      });

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
        .patch(`/api/stock-transfer-templates/${template.id}`)
        .set('Cookie', viewerCookie)
        .send({ name: 'Hacked' });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/stock-transfer-templates/:templateId - Archive Template', () => {
    it('should archive template with stock:write permission', async () => {
      const template = await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'To Be Archived',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, defaultQty: 10 }],
        },
      });

      const response = await request(app)
        .delete(`/api/stock-transfer-templates/${template.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject without authentication', async () => {
      const template = await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Test',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, defaultQty: 10 }],
        },
      });

      const response = await request(app).delete(`/api/stock-transfer-templates/${template.id}`);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/stock-transfer-templates/:templateId/duplicate - Duplicate Template', () => {
    it('should duplicate template with new name', async () => {
      const template = await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Original Template',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, defaultQty: 10 }],
        },
      });

      const response = await request(app)
        .post(`/api/stock-transfer-templates/${template.id}/duplicate`)
        .set('Cookie', sessionCookie)
        .send({ newName: 'Duplicated Template' });

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Duplicated Template');
      expect(response.body.data.id).not.toBe(template.id);
    });

    it('should reject without stock:write permission', async () => {
      const template = await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Test',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, defaultQty: 10 }],
        },
      });

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
        .post(`/api/stock-transfer-templates/${template.id}/duplicate`)
        .set('Cookie', viewerCookie)
        .send({ newName: 'Copy' });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/stock-transfer-templates/:templateId/restore - Restore Template', () => {
    it('should restore archived template', async () => {
      const template = await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'To Restore',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, defaultQty: 10 }],
        },
      });

      // Archive it first
      await templateService.deleteTransferTemplate({
        tenantId: testTenant.id,
        templateId: template.id,
        userId: testUser.id,
      });

      // Now restore it
      const response = await request(app)
        .post(`/api/stock-transfer-templates/${template.id}/restore`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject without authentication', async () => {
      const template = await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Test',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, defaultQty: 10 }],
        },
      });

      const response = await request(app).post(`/api/stock-transfer-templates/${template.id}/restore`);

      expect(response.status).toBe(401);
    });
  });

  describe('Response Format', () => {
    it('should return standard envelope format', async () => {
      const response = await request(app)
        .post('/api/stock-transfer-templates')
        .set('Cookie', sessionCookie)
        .send({
          name: 'Envelope Test',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, defaultQty: 10 }],
        });

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('error');
      expect(response.body.success).toBe(true);
      expect(response.body.error).toBeNull();
    });
  });
});
