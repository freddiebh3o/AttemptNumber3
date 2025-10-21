// api-server/__tests__/permissions/transferTemplates.permissions.test.ts
import request from 'supertest';
import express, { type Express } from 'express';
import { stockTransferTemplatesRouter } from '../../src/routes/stockTransferTemplatesRouter.js';
import { sessionMiddleware } from '../../src/middleware/sessionMiddleware.js';
import { standardErrorHandler } from '../../src/middleware/errorHandler.js';
import cookieParser from 'cookie-parser';
import {
  createTestUser,
  createTestTenant,
  createTestBranch,
  createTestProduct,
  createTestRoleWithPermissions,
  createTestMembership,
} from '../helpers/factories.js';
import { createSessionCookie } from '../helpers/auth.js';
import { ROLE_DEFS } from '../../src/rbac/catalog.js';
import { prismaClientInstance as prisma } from '../../src/db/prismaClient.js';

describe('[RBAC] Transfer Templates Permissions', () => {
  let app: Express;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;

  let ownerUser: Awaited<ReturnType<typeof createTestUser>>;
  let editorUser: Awaited<ReturnType<typeof createTestUser>>;
  let viewerUser: Awaited<ReturnType<typeof createTestUser>>;

  let ownerCookie: string;
  let editorCookie: string;
  let viewerCookie: string;

  let sourceBranch: any;
  let destBranch: any;
  let testProduct: any;
  let testTemplate: any;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(sessionMiddleware);
    app.use('/api/transfer-templates', stockTransferTemplatesRouter);
    app.use(standardErrorHandler);
  });

  beforeEach(async () => {
    testTenant = await createTestTenant();

    ownerUser = await createTestUser();
    editorUser = await createTestUser();
    viewerUser = await createTestUser();

    const ownerRole = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ROLE_DEFS.OWNER,
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
    await createTestMembership({ userId: editorUser.id, tenantId: testTenant.id, roleId: editorRole.id });
    await createTestMembership({ userId: viewerUser.id, tenantId: testTenant.id, roleId: viewerRole.id });

    sourceBranch = await createTestBranch({ tenantId: testTenant.id });
    destBranch = await createTestBranch({ tenantId: testTenant.id });
    testProduct = await createTestProduct({ tenantId: testTenant.id });

    testTemplate = await prisma.stockTransferTemplate.create({
      data: {
        tenantId: testTenant.id,
        name: `Template ${Date.now()}`,
        sourceBranchId: sourceBranch.id,
        destinationBranchId: destBranch.id,
        items: {
          create: [{
            productId: testProduct.id,
            defaultQty: 10,
          }],
        },
        createdByUserId: ownerUser.id,
      },
      include: { items: true },
    });

    ownerCookie = createSessionCookie(ownerUser.id, testTenant.id);
    editorCookie = createSessionCookie(editorUser.id, testTenant.id);
    viewerCookie = createSessionCookie(viewerUser.id, testTenant.id);
  });

  describe('GET /api/transfer-templates - List Templates', () => {
    it('OWNER - should allow (has stock:read)', async () => {
      const response = await request(app)
        .get('/api/transfer-templates')
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('VIEWER - should allow (has stock:read)', async () => {
      const response = await request(app)
        .get('/api/transfer-templates')
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(200);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).get('/api/transfer-templates');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/transfer-templates/:id - Get Template by ID', () => {
    it('OWNER - should allow (has stock:read)', async () => {
      const response = await request(app)
        .get(`/api/transfer-templates/${testTemplate.id}`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(testTemplate.id);
    });

    it('VIEWER - should allow (has stock:read)', async () => {
      const response = await request(app)
        .get(`/api/transfer-templates/${testTemplate.id}`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(200);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).get(`/api/transfer-templates/${testTemplate.id}`);
      expect(response.status).toBe(401);
    });

    it('Cross-tenant - should return 404', async () => {
      const otherTenant = await createTestTenant();
      const otherBranch = await createTestBranch({ tenantId: otherTenant.id });
      const otherTemplate = await prisma.stockTransferTemplate.create({
        data: {
          tenantId: otherTenant.id,
          name: `Other Template ${Date.now()}`,
          sourceBranchId: otherBranch.id,
          destinationBranchId: otherBranch.id,
          createdByUserId: ownerUser.id,
        },
      });

      const response = await request(app)
        .get(`/api/transfer-templates/${otherTemplate.id}`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/transfer-templates - Create Template', () => {
    it('OWNER - should allow (has stock:write)', async () => {
      const response = await request(app)
        .post('/api/transfer-templates')
        .set('Cookie', ownerCookie)
        .send({
          name: 'New Template',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destBranch.id,
          items: [{ productId: testProduct.id, defaultQty: 5 }],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('EDITOR - should deny (lacks stock:write)', async () => {
      const response = await request(app)
        .post('/api/transfer-templates')
        .set('Cookie', editorCookie)
        .send({
          name: 'New Template',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destBranch.id,
          items: [{ productId: testProduct.id, qty: 5 }],
        });

      expect(response.status).toBe(403);
    });

    it('VIEWER - should deny (lacks stock:write)', async () => {
      const response = await request(app)
        .post('/api/transfer-templates')
        .set('Cookie', viewerCookie)
        .send({
          name: 'New Template',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destBranch.id,
          items: [{ productId: testProduct.id, qty: 5 }],
        });

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app)
        .post('/api/transfer-templates')
        .send({
          name: 'New Template',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destBranch.id,
          items: [{ productId: testProduct.id, qty: 5 }],
        });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/transfer-templates/:id - Delete Template', () => {
    it('OWNER - should allow (has stock:write)', async () => {
      const response = await request(app)
        .delete(`/api/transfer-templates/${testTemplate.id}`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
    });

    it('EDITOR - should deny (lacks stock:write)', async () => {
      const template = await prisma.stockTransferTemplate.create({
        data: {
          tenantId: testTenant.id,
          name: `Delete Template ${Date.now()}`,
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destBranch.id,
          createdByUserId: ownerUser.id,
        },
      });

      const response = await request(app)
        .delete(`/api/transfer-templates/${template.id}`)
        .set('Cookie', editorCookie);

      expect(response.status).toBe(403);
    });

    it('VIEWER - should deny (lacks stock:write)', async () => {
      const template = await prisma.stockTransferTemplate.create({
        data: {
          tenantId: testTenant.id,
          name: `Delete Template ${Date.now()}`,
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destBranch.id,
          createdByUserId: ownerUser.id,
        },
      });

      const response = await request(app)
        .delete(`/api/transfer-templates/${template.id}`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app)
        .delete(`/api/transfer-templates/${testTemplate.id}`);

      expect(response.status).toBe(401);
    });
  });
});
