// api-server/__tests__/permissions/stock.permissions.test.ts
import request from 'supertest';
import express, { type Express } from 'express';
import { stockRouter } from '../../src/routes/stockRouter.js';
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
} from '../helpers/factories.js';
import { createSessionCookie } from '../helpers/auth.js';
import { ROLE_DEFS } from '../../src/rbac/catalog.js';
import { receiveStock } from '../../src/services/stockService.js';
import { prismaClientInstance as prisma } from '../../src/db/prismaClient.js';

describe('[RBAC] Stock Permissions', () => {
  let app: Express;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let testProduct: Awaited<ReturnType<typeof createTestProduct>>;
  let testBranch: Awaited<ReturnType<typeof createTestBranch>>;

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
    app.use('/api/stock', stockRouter);
    app.use(standardErrorHandler);
  });

  beforeEach(async () => {
    testTenant = await createTestTenant();
    testProduct = await createTestProduct({ tenantId: testTenant.id });
    testBranch = await createTestBranch({ tenantId: testTenant.id });

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

    // Create UserBranchMembership for all users (required for stock operations)
    await prisma.userBranchMembership.create({
      data: { userId: ownerUser.id, tenantId: testTenant.id, branchId: testBranch.id },
    });
    await prisma.userBranchMembership.create({
      data: { userId: adminUser.id, tenantId: testTenant.id, branchId: testBranch.id },
    });
    await prisma.userBranchMembership.create({
      data: { userId: editorUser.id, tenantId: testTenant.id, branchId: testBranch.id },
    });
    await prisma.userBranchMembership.create({
      data: { userId: viewerUser.id, tenantId: testTenant.id, branchId: testBranch.id },
    });

    // Create initial stock for GET tests
    await receiveStock(
      { currentTenantId: testTenant.id, currentUserId: ownerUser.id },
      {
        branchId: testBranch.id,
        productId: testProduct.id,
        qty: 100,
        unitCostPence: 500,
      }
    );
  });

  describe('GET /api/stock/levels - Get Stock Levels', () => {
    it('OWNER - should allow access (has stock:read)', async () => {
      const response = await request(app)
        .get('/api/stock/levels')
        .query({ branchId: testBranch.id, productId: testProduct.id })
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('ADMIN - should allow access (has stock:read)', async () => {
      const response = await request(app)
        .get('/api/stock/levels')
        .query({ branchId: testBranch.id, productId: testProduct.id })
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('EDITOR - should allow access (has stock:read)', async () => {
      const response = await request(app)
        .get('/api/stock/levels')
        .query({ branchId: testBranch.id, productId: testProduct.id })
        .set('Cookie', editorCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('VIEWER - should allow access (has stock:read)', async () => {
      const response = await request(app)
        .get('/api/stock/levels')
        .query({ branchId: testBranch.id, productId: testProduct.id })
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('Custom role with permission - should allow access', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['stock:read'],
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      // Create branch membership for custom user
      await prisma.userBranchMembership.create({
        data: { userId: customUser.id, tenantId: testTenant.id, branchId: testBranch.id },
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .get('/api/stock/levels')
        .query({ branchId: testBranch.id, productId: testProduct.id })
        .set('Cookie', customCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
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
        .get('/api/stock/levels')
        .query({ branchId: testBranch.id, productId: testProduct.id })
        .set('Cookie', customCookie);

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app)
        .get('/api/stock/levels')
        .query({ branchId: testBranch.id, productId: testProduct.id });

      expect(response.status).toBe(401);
      expect(response.body.error?.errorCode).toBe('AUTH_REQUIRED');
    });

    it('Cross-tenant access - should deny (404)', async () => {
      const otherTenant = await createTestTenant();
      const otherProduct = await createTestProduct({ tenantId: otherTenant.id });
      const otherBranch = await createTestBranch({ tenantId: otherTenant.id });

      const response = await request(app)
        .get('/api/stock/levels')
        .query({ branchId: otherBranch.id, productId: otherProduct.id })
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/stock/ledger - Get Stock Ledger', () => {
    it('OWNER - should allow access (has stock:read)', async () => {
      const response = await request(app)
        .get('/api/stock/ledger')
        .query({ productId: testProduct.id })
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('ADMIN - should allow access (has stock:read)', async () => {
      const response = await request(app)
        .get('/api/stock/ledger')
        .query({ productId: testProduct.id })
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
    });

    it('EDITOR - should allow access (has stock:read)', async () => {
      const response = await request(app)
        .get('/api/stock/ledger')
        .query({ productId: testProduct.id })
        .set('Cookie', editorCookie);

      expect(response.status).toBe(200);
    });

    it('VIEWER - should allow access (has stock:read)', async () => {
      const response = await request(app)
        .get('/api/stock/ledger')
        .query({ productId: testProduct.id })
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(200);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app)
        .get('/api/stock/ledger')
        .query({ productId: testProduct.id });

      expect(response.status).toBe(401);
    });

    it('Cross-tenant access - should deny (404)', async () => {
      const otherTenant = await createTestTenant();
      const otherProduct = await createTestProduct({ tenantId: otherTenant.id });

      const response = await request(app)
        .get('/api/stock/ledger')
        .query({ productId: otherProduct.id })
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/stock/levels/bulk - Get Bulk Stock Levels', () => {
    it('OWNER - should allow access (has stock:read)', async () => {
      const response = await request(app)
        .get('/api/stock/levels/bulk')
        .query({ productId: testProduct.id })
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('ADMIN - should allow access (has stock:read)', async () => {
      const response = await request(app)
        .get('/api/stock/levels/bulk')
        .query({ productId: testProduct.id })
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
    });

    it('EDITOR - should allow access (has stock:read)', async () => {
      const response = await request(app)
        .get('/api/stock/levels/bulk')
        .query({ productId: testProduct.id })
        .set('Cookie', editorCookie);

      expect(response.status).toBe(200);
    });

    it('VIEWER - should allow access (has stock:read)', async () => {
      const response = await request(app)
        .get('/api/stock/levels/bulk')
        .query({ productId: testProduct.id })
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(200);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app)
        .get('/api/stock/levels/bulk')
        .query({ productId: testProduct.id });

      expect(response.status).toBe(401);
    });

    it('Cross-tenant access - should deny (404)', async () => {
      const otherTenant = await createTestTenant();
      const otherProduct = await createTestProduct({ tenantId: otherTenant.id });

      const response = await request(app)
        .get('/api/stock/levels/bulk')
        .query({ productId: otherProduct.id })
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/stock/receive - Receive Stock', () => {
    const receiveBody = {
      branchId: '',
      productId: '',
      qty: 50,
      unitCostPence: 300,
    };

    beforeEach(() => {
      receiveBody.branchId = testBranch.id;
      receiveBody.productId = testProduct.id;
    });

    it('OWNER - should allow (has stock:write)', async () => {
      const response = await request(app)
        .post('/api/stock/receive')
        .set('Cookie', ownerCookie)
        .send(receiveBody);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('ADMIN - should allow (has stock:write)', async () => {
      const response = await request(app)
        .post('/api/stock/receive')
        .set('Cookie', adminCookie)
        .send(receiveBody);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('EDITOR - should deny (lacks stock:write)', async () => {
      const response = await request(app)
        .post('/api/stock/receive')
        .set('Cookie', editorCookie)
        .send(receiveBody);

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('VIEWER - should deny (lacks stock:write)', async () => {
      const response = await request(app)
        .post('/api/stock/receive')
        .set('Cookie', viewerCookie)
        .send(receiveBody);

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('Custom role with permission - should allow', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['stock:read', 'stock:write'],
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      // Create branch membership for custom user
      await prisma.userBranchMembership.create({
        data: { userId: customUser.id, tenantId: testTenant.id, branchId: testBranch.id },
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .post('/api/stock/receive')
        .set('Cookie', customCookie)
        .send(receiveBody);

      expect(response.status).toBe(201);
    });

    it('Custom role without permission - should deny (403)', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['stock:read'], // Missing stock:write
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .post('/api/stock/receive')
        .set('Cookie', customCookie)
        .send(receiveBody);

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app)
        .post('/api/stock/receive')
        .send(receiveBody);

      expect(response.status).toBe(401);
    });

    it('Cross-tenant access - should deny (404)', async () => {
      const otherTenant = await createTestTenant();
      const otherBranch = await createTestBranch({ tenantId: otherTenant.id });
      const otherProduct = await createTestProduct({ tenantId: otherTenant.id });

      const response = await request(app)
        .post('/api/stock/receive')
        .set('Cookie', ownerCookie)
        .send({
          branchId: otherBranch.id,
          productId: otherProduct.id,
          qty: 50,
          unitCostPence: 300,
        });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/stock/adjust - Adjust Stock', () => {
    const adjustBody = {
      branchId: '',
      productId: '',
      qtyDelta: 10,
      unitCostPence: 400,
    };

    beforeEach(() => {
      adjustBody.branchId = testBranch.id;
      adjustBody.productId = testProduct.id;
    });

    it('OWNER - should allow (has stock:write)', async () => {
      const response = await request(app)
        .post('/api/stock/adjust')
        .set('Cookie', ownerCookie)
        .send(adjustBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('ADMIN - should allow (has stock:write)', async () => {
      const response = await request(app)
        .post('/api/stock/adjust')
        .set('Cookie', adminCookie)
        .send(adjustBody);

      expect(response.status).toBe(200);
    });

    it('EDITOR - should deny (lacks stock:write)', async () => {
      const response = await request(app)
        .post('/api/stock/adjust')
        .set('Cookie', editorCookie)
        .send(adjustBody);

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('VIEWER - should deny (lacks stock:write)', async () => {
      const response = await request(app)
        .post('/api/stock/adjust')
        .set('Cookie', viewerCookie)
        .send(adjustBody);

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('Custom role with permission - should allow', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['stock:write'],
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      // Create branch membership for custom user
      await prisma.userBranchMembership.create({
        data: { userId: customUser.id, tenantId: testTenant.id, branchId: testBranch.id },
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .post('/api/stock/adjust')
        .set('Cookie', customCookie)
        .send(adjustBody);

      expect(response.status).toBe(200);
    });

    it('Custom role without permission - should deny (403)', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['stock:read'],
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .post('/api/stock/adjust')
        .set('Cookie', customCookie)
        .send(adjustBody);

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app)
        .post('/api/stock/adjust')
        .send(adjustBody);

      expect(response.status).toBe(401);
    });

    it('Cross-tenant access - should deny (404)', async () => {
      const otherTenant = await createTestTenant();
      const otherBranch = await createTestBranch({ tenantId: otherTenant.id });
      const otherProduct = await createTestProduct({ tenantId: otherTenant.id });

      const response = await request(app)
        .post('/api/stock/adjust')
        .set('Cookie', ownerCookie)
        .send({
          branchId: otherBranch.id,
          productId: otherProduct.id,
          qtyDelta: 10,
          unitCostPence: 400,
        });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/stock/consume - Consume Stock', () => {
    const consumeBody = {
      branchId: '',
      productId: '',
      qty: 10,
    };

    beforeEach(() => {
      consumeBody.branchId = testBranch.id;
      consumeBody.productId = testProduct.id;
    });

    it('OWNER - should allow (has stock:write)', async () => {
      const response = await request(app)
        .post('/api/stock/consume')
        .set('Cookie', ownerCookie)
        .send(consumeBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('ADMIN - should allow (has stock:write)', async () => {
      const response = await request(app)
        .post('/api/stock/consume')
        .set('Cookie', adminCookie)
        .send(consumeBody);

      expect(response.status).toBe(200);
    });

    it('EDITOR - should deny (lacks stock:write)', async () => {
      const response = await request(app)
        .post('/api/stock/consume')
        .set('Cookie', editorCookie)
        .send(consumeBody);

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('VIEWER - should deny (lacks stock:write)', async () => {
      const response = await request(app)
        .post('/api/stock/consume')
        .set('Cookie', viewerCookie)
        .send(consumeBody);

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('Custom role with permission - should allow', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['stock:write'],
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      // Create branch membership for custom user
      await prisma.userBranchMembership.create({
        data: { userId: customUser.id, tenantId: testTenant.id, branchId: testBranch.id },
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .post('/api/stock/consume')
        .set('Cookie', customCookie)
        .send(consumeBody);

      expect(response.status).toBe(200);
    });

    it('Custom role without permission - should deny (403)', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['stock:read'],
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .post('/api/stock/consume')
        .set('Cookie', customCookie)
        .send(consumeBody);

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app)
        .post('/api/stock/consume')
        .send(consumeBody);

      expect(response.status).toBe(401);
    });

    it('Cross-tenant access - should deny (404)', async () => {
      const otherTenant = await createTestTenant();
      const otherBranch = await createTestBranch({ tenantId: otherTenant.id });
      const otherProduct = await createTestProduct({ tenantId: otherTenant.id });

      const response = await request(app)
        .post('/api/stock/consume')
        .set('Cookie', ownerCookie)
        .send({
          branchId: otherBranch.id,
          productId: otherProduct.id,
          qty: 10,
        });

      expect(response.status).toBe(404);
    });
  });
});
