// api-server/__tests__/permissions/stockTransfers.permissions.test.ts
import request from 'supertest';
import express, { type Express } from 'express';
import { stockTransfersRouter } from '../../src/routes/stockTransfersRouter.js';
import { sessionMiddleware } from '../../src/middleware/sessionMiddleware.js';
import { standardErrorHandler } from '../../src/middleware/errorHandler.js';
import cookieParser from 'cookie-parser';
import {
  createTestUser,
  createTestTenant,
  createTestProduct,
  createTestBranch,
  createTestRoleWithPermissions,
  createTestMembership,
  addUserToBranch,
} from '../helpers/factories.js';
import { createSessionCookie } from '../helpers/auth.js';
import { ROLE_DEFS } from '../../src/rbac/catalog.js';
import { prismaClientInstance as prisma } from '../../src/db/prismaClient.js';
import { receiveStock } from '../../src/services/stockService.js';

describe('[RBAC] Stock Transfers Permissions', () => {
  let app: Express;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;

  // Users for each role
  let ownerUser: Awaited<ReturnType<typeof createTestUser>>;
  let editorUser: Awaited<ReturnType<typeof createTestUser>>;
  let viewerUser: Awaited<ReturnType<typeof createTestUser>>;

  // Session cookies
  let ownerCookie: string;
  let editorCookie: string;
  let viewerCookie: string;

  // Test resources
  let sourceBranch: any;
  let destBranch: any;
  let testProduct: any;
  let testTransfer: any;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(sessionMiddleware);
    app.use('/api/stock-transfers', stockTransfersRouter);
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

    // Add branch memberships for all users
    await addUserToBranch(ownerUser.id, testTenant.id, sourceBranch.id);
    await addUserToBranch(ownerUser.id, testTenant.id, destBranch.id);
    await addUserToBranch(editorUser.id, testTenant.id, sourceBranch.id);
    await addUserToBranch(editorUser.id, testTenant.id, destBranch.id);
    await addUserToBranch(viewerUser.id, testTenant.id, sourceBranch.id);
    await addUserToBranch(viewerUser.id, testTenant.id, destBranch.id);

    // Receive stock at source branch
    await receiveStock(
      { currentTenantId: testTenant.id, currentUserId: ownerUser.id },
      {
        branchId: sourceBranch.id,
        productId: testProduct.id,
        qty: 100,
        unitCostPence: 1000,
      }
    );

    // Create a test transfer
    testTransfer = await prisma.stockTransfer.create({
      data: {
        tenantId: testTenant.id,
        sourceBranchId: sourceBranch.id,
        destinationBranchId: destBranch.id,
        transferNumber: `TR-${Date.now()}`,
        status: 'REQUESTED',
        requestedByUserId: ownerUser.id,
        items: {
          create: [{
            productId: testProduct.id,
            qtyRequested: 10,
          }],
        },
      },
      include: { items: true },
    });

    ownerCookie = createSessionCookie(ownerUser.id, testTenant.id);
    editorCookie = createSessionCookie(editorUser.id, testTenant.id);
    viewerCookie = createSessionCookie(viewerUser.id, testTenant.id);
  });

  describe('GET /api/stock-transfers - List Transfers', () => {
    it('OWNER - should allow (has stock:read)', async () => {
      const response = await request(app)
        .get('/api/stock-transfers')
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('EDITOR - should allow (has stock:read)', async () => {
      const response = await request(app)
        .get('/api/stock-transfers')
        .set('Cookie', editorCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('VIEWER - should allow (has stock:read)', async () => {
      const response = await request(app)
        .get('/api/stock-transfers')
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(200);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).get('/api/stock-transfers');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/stock-transfers/:id - Get Transfer by ID', () => {
    it('OWNER - should allow (has stock:read)', async () => {
      const response = await request(app)
        .get(`/api/stock-transfers/${testTransfer.id}`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(testTransfer.id);
    });

    it('VIEWER - should allow (has stock:read)', async () => {
      const response = await request(app)
        .get(`/api/stock-transfers/${testTransfer.id}`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(200);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).get(`/api/stock-transfers/${testTransfer.id}`);
      expect(response.status).toBe(401);
    });

    it('Cross-tenant - should return 404', async () => {
      const otherTenant = await createTestTenant();
      const otherBranch = await createTestBranch({ tenantId: otherTenant.id });
      const otherTransfer = await prisma.stockTransfer.create({
        data: {
          tenantId: otherTenant.id,
          sourceBranchId: otherBranch.id,
          destinationBranchId: otherBranch.id,
          transferNumber: `TR-OTHER-${Date.now()}`,
          status: 'REQUESTED',
          requestedByUserId: ownerUser.id,
        },
      });

      const response = await request(app)
        .get(`/api/stock-transfers/${otherTransfer.id}`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/stock-transfers - Create Transfer', () => {
    const requestBody = {
      sourceBranchId: '',
      destinationBranchId: '',
      items: [{ productId: '', qtyRequested: 5 }],
    };

    it('OWNER - should allow (has stock:write)', async () => {
      const response = await request(app)
        .post('/api/stock-transfers')
        .set('Cookie', ownerCookie)
        .send({
          ...requestBody,
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destBranch.id,
          items: [{ productId: testProduct.id, qtyRequested: 5 }],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('EDITOR - should deny (lacks stock:write)', async () => {
      const response = await request(app)
        .post('/api/stock-transfers')
        .set('Cookie', editorCookie)
        .send({
          ...requestBody,
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destBranch.id,
          items: [{ productId: testProduct.id, qtyRequested: 5 }],
        });

      expect(response.status).toBe(403);
    });

    it('VIEWER - should deny (lacks stock:write)', async () => {
      const response = await request(app)
        .post('/api/stock-transfers')
        .set('Cookie', viewerCookie)
        .send({
          ...requestBody,
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destBranch.id,
          items: [{ productId: testProduct.id, qtyRequested: 5 }],
        });

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app)
        .post('/api/stock-transfers')
        .send({
          ...requestBody,
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destBranch.id,
          items: [{ productId: testProduct.id, qtyRequested: 5 }],
        });

      expect(response.status).toBe(401);
    });
  });

  // NOTE: Stock transfers require branch membership in addition to role permissions
  // Tests above assume branch memberships are created
  // Full permission matrix: stock:read for list/get, stock:write for create/update/actions
});
