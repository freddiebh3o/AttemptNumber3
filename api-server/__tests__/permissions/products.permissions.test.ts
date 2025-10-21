// api-server/__tests__/permissions/products.permissions.test.ts
import request from 'supertest';
import express, { type Express } from 'express';
import { productRouter } from '../../src/routes/productRouter.js';
import { sessionMiddleware } from '../../src/middleware/sessionMiddleware.js';
import { standardErrorHandler } from '../../src/middleware/errorHandler.js';
import cookieParser from 'cookie-parser';
import {
  createTestUser,
  createTestTenant,
  createTestProduct,
  createTestRoleWithPermissions,
  createTestMembership,
} from '../helpers/factories.js';
import { createSessionCookie } from '../helpers/auth.js';
import { ROLE_DEFS } from '../../src/rbac/catalog.js';
import { prismaClientInstance as prisma } from '../../src/db/prismaClient.js';

describe('[RBAC] Products Permissions', () => {
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
    app.use('/api/products', productRouter);
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

  describe('GET /api/products - List Products', () => {
    it('OWNER - should allow access (has products:read)', async () => {
      const response = await request(app)
        .get('/api/products')
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('ADMIN - should allow access (has products:read)', async () => {
      const response = await request(app)
        .get('/api/products')
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('EDITOR - should allow access (has products:read)', async () => {
      const response = await request(app)
        .get('/api/products')
        .set('Cookie', editorCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('VIEWER - should allow access (has products:read)', async () => {
      const response = await request(app)
        .get('/api/products')
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('Custom role with permission - should allow access', async () => {
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
        .get('/api/products')
        .set('Cookie', customCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('Custom role without permission - should deny (403)', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['stock:read'], // Wrong permission
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .get('/api/products')
        .set('Cookie', customCookie);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).get('/api/products');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error?.errorCode).toBe('AUTH_REQUIRED');
    });
  });

  describe('GET /api/products/:id - Get Product by ID', () => {
    let testProduct: Awaited<ReturnType<typeof createTestProduct>>;

    beforeEach(async () => {
      testProduct = await createTestProduct({
        tenantId: testTenant.id,
      });
    });

    it('OWNER - should allow access (has products:read)', async () => {
      const response = await request(app)
        .get(`/api/products/${testProduct.id}`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.product.id).toBe(testProduct.id);
    });

    it('ADMIN - should allow access (has products:read)', async () => {
      const response = await request(app)
        .get(`/api/products/${testProduct.id}`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('EDITOR - should allow access (has products:read)', async () => {
      const response = await request(app)
        .get(`/api/products/${testProduct.id}`)
        .set('Cookie', editorCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('VIEWER - should allow access (has products:read)', async () => {
      const response = await request(app)
        .get(`/api/products/${testProduct.id}`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('Custom role with permission - should allow access', async () => {
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
        .get(`/api/products/${testProduct.id}`)
        .set('Cookie', customCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('Custom role without permission - should deny (403)', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['uploads:write'], // Wrong permission
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .get(`/api/products/${testProduct.id}`)
        .set('Cookie', customCookie);

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).get(`/api/products/${testProduct.id}`);

      expect(response.status).toBe(401);
      expect(response.body.error?.errorCode).toBe('AUTH_REQUIRED');
    });

    it('Cross-tenant access - should deny (404)', async () => {
      const otherTenant = await createTestTenant();
      const otherProduct = await createTestProduct({
        tenantId: otherTenant.id,
      });

      const response = await request(app)
        .get(`/api/products/${otherProduct.id}`)
        .set('Cookie', ownerCookie); // Using owner from first tenant

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/products/by-barcode/:barcode - Get Product by Barcode', () => {
    let testProduct: Awaited<ReturnType<typeof createTestProduct>>;

    beforeEach(async () => {
      testProduct = await createTestProduct({
        tenantId: testTenant.id,
        barcode: 'TEST-BARCODE-123',
      });
    });

    it('OWNER - should allow access (has products:read)', async () => {
      const response = await request(app)
        .get('/api/products/by-barcode/TEST-BARCODE-123')
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.product.id).toBe(testProduct.id);
    });

    it('ADMIN - should allow access (has products:read)', async () => {
      const response = await request(app)
        .get('/api/products/by-barcode/TEST-BARCODE-123')
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
    });

    it('EDITOR - should allow access (has products:read)', async () => {
      const response = await request(app)
        .get('/api/products/by-barcode/TEST-BARCODE-123')
        .set('Cookie', editorCookie);

      expect(response.status).toBe(200);
    });

    it('VIEWER - should allow access (has products:read)', async () => {
      const response = await request(app)
        .get('/api/products/by-barcode/TEST-BARCODE-123')
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(200);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).get('/api/products/by-barcode/TEST-BARCODE-123');

      expect(response.status).toBe(401);
    });

    it('Cross-tenant access - should deny (404)', async () => {
      const otherTenant = await createTestTenant();
      await createTestProduct({
        tenantId: otherTenant.id,
        barcode: 'OTHER-BARCODE',
      });

      const response = await request(app)
        .get('/api/products/by-barcode/OTHER-BARCODE')
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/products/:id/activity - Get Product Activity', () => {
    let testProduct: Awaited<ReturnType<typeof createTestProduct>>;

    beforeEach(async () => {
      testProduct = await createTestProduct({
        tenantId: testTenant.id,
      });
    });

    it('OWNER - should allow access (has products:read)', async () => {
      const response = await request(app)
        .get(`/api/products/${testProduct.id}/activity`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('ADMIN - should allow access (has products:read)', async () => {
      const response = await request(app)
        .get(`/api/products/${testProduct.id}/activity`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
    });

    it('EDITOR - should allow access (has products:read)', async () => {
      const response = await request(app)
        .get(`/api/products/${testProduct.id}/activity`)
        .set('Cookie', editorCookie);

      expect(response.status).toBe(200);
    });

    it('VIEWER - should allow access (has products:read)', async () => {
      const response = await request(app)
        .get(`/api/products/${testProduct.id}/activity`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(200);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).get(`/api/products/${testProduct.id}/activity`);

      expect(response.status).toBe(401);
    });

    it('Cross-tenant access - should return empty results (200)', async () => {
      const otherTenant = await createTestTenant();
      const otherProduct = await createTestProduct({
        tenantId: otherTenant.id,
      });

      const response = await request(app)
        .get(`/api/products/${otherProduct.id}/activity`)
        .set('Cookie', ownerCookie);

      // Activity endpoints filter by tenantId, so cross-tenant requests return empty results (200)
      // rather than 404. This is acceptable - tenant isolation is still enforced.
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(0); // Empty results
    });
  });

  describe('POST /api/products - Create Product', () => {
    const createBody = {
      productName: 'Test Widget',
      productSku: 'TEST-001',
      productPricePence: 1500,
    };

    it('OWNER - should allow (has products:write)', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Cookie', ownerCookie)
        .send({ ...createBody, productSku: 'OWNER-001' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.product.productName).toBe('Test Widget');
    });

    it('ADMIN - should allow (has products:write)', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Cookie', adminCookie)
        .send({ ...createBody, productSku: 'ADMIN-001' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('EDITOR - should allow (has products:write)', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Cookie', editorCookie)
        .send({ ...createBody, productSku: 'EDITOR-001' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('VIEWER - should deny (lacks products:write)', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Cookie', viewerCookie)
        .send({ ...createBody, productSku: 'VIEWER-001' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('Custom role with permission - should allow', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read', 'products:write'],
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .post('/api/products')
        .set('Cookie', customCookie)
        .send({ ...createBody, productSku: 'CUSTOM-001' });

      expect(response.status).toBe(201);
    });

    it('Custom role without permission - should deny (403)', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'], // Missing products:write
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .post('/api/products')
        .set('Cookie', customCookie)
        .send({ ...createBody, productSku: 'CUSTOM-DENY-001' });

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app)
        .post('/api/products')
        .send(createBody);

      expect(response.status).toBe(401);
      expect(response.body.error?.errorCode).toBe('AUTH_REQUIRED');
    });
  });

  describe('PUT /api/products/:id - Update Product', () => {
    let testProduct: Awaited<ReturnType<typeof createTestProduct>>;

    beforeEach(async () => {
      testProduct = await createTestProduct({
        tenantId: testTenant.id,
      });
    });

    const updateBody = {
      productName: 'Updated Name',
      productPricePence: 2000,
      currentEntityVersion: 1,
    };

    it('OWNER - should allow (has products:write)', async () => {
      const response = await request(app)
        .put(`/api/products/${testProduct.id}`)
        .set('Cookie', ownerCookie)
        .send(updateBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.product.productName).toBe('Updated Name');
    });

    it('ADMIN - should allow (has products:write)', async () => {
      const product = await createTestProduct({ tenantId: testTenant.id });
      const response = await request(app)
        .put(`/api/products/${product.id}`)
        .set('Cookie', adminCookie)
        .send(updateBody);

      expect(response.status).toBe(200);
    });

    it('EDITOR - should allow (has products:write)', async () => {
      const product = await createTestProduct({ tenantId: testTenant.id });
      const response = await request(app)
        .put(`/api/products/${product.id}`)
        .set('Cookie', editorCookie)
        .send(updateBody);

      expect(response.status).toBe(200);
    });

    it('VIEWER - should deny (lacks products:write)', async () => {
      const response = await request(app)
        .put(`/api/products/${testProduct.id}`)
        .set('Cookie', viewerCookie)
        .send(updateBody);

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('Custom role with permission - should allow', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read', 'products:write'],
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .put(`/api/products/${testProduct.id}`)
        .set('Cookie', customCookie)
        .send(updateBody);

      expect(response.status).toBe(200);
    });

    it('Custom role without permission - should deny (403)', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'], // Missing products:write
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .put(`/api/products/${testProduct.id}`)
        .set('Cookie', customCookie)
        .send(updateBody);

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app)
        .put(`/api/products/${testProduct.id}`)
        .send(updateBody);

      expect(response.status).toBe(401);
    });

    it('Cross-tenant access - should deny (404)', async () => {
      const otherTenant = await createTestTenant();
      const otherProduct = await createTestProduct({
        tenantId: otherTenant.id,
      });

      const response = await request(app)
        .put(`/api/products/${otherProduct.id}`)
        .set('Cookie', ownerCookie)
        .send(updateBody);

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/products/:id - Archive Product', () => {
    let testProduct: Awaited<ReturnType<typeof createTestProduct>>;

    beforeEach(async () => {
      testProduct = await createTestProduct({
        tenantId: testTenant.id,
      });
    });

    it('OWNER - should allow (has products:write)', async () => {
      const response = await request(app)
        .delete(`/api/products/${testProduct.id}`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('ADMIN - should allow (has products:write)', async () => {
      const product = await createTestProduct({ tenantId: testTenant.id });
      const response = await request(app)
        .delete(`/api/products/${product.id}`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
    });

    it('EDITOR - should allow (has products:write)', async () => {
      const product = await createTestProduct({ tenantId: testTenant.id });
      const response = await request(app)
        .delete(`/api/products/${product.id}`)
        .set('Cookie', editorCookie);

      expect(response.status).toBe(200);
    });

    it('VIEWER - should deny (lacks products:write)', async () => {
      const response = await request(app)
        .delete(`/api/products/${testProduct.id}`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('Custom role with permission - should allow', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read', 'products:write'],
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .delete(`/api/products/${testProduct.id}`)
        .set('Cookie', customCookie);

      expect(response.status).toBe(200);
    });

    it('Custom role without permission - should deny (403)', async () => {
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
        .delete(`/api/products/${testProduct.id}`)
        .set('Cookie', customCookie);

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).delete(`/api/products/${testProduct.id}`);

      expect(response.status).toBe(401);
    });

    it('Cross-tenant access - should deny (404)', async () => {
      const otherTenant = await createTestTenant();
      const otherProduct = await createTestProduct({
        tenantId: otherTenant.id,
      });

      const response = await request(app)
        .delete(`/api/products/${otherProduct.id}`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/products/:id/restore - Restore Archived Product', () => {
    let archivedProduct: Awaited<ReturnType<typeof createTestProduct>>;

    beforeEach(async () => {
      archivedProduct = await createTestProduct({
        tenantId: testTenant.id,
      });
      // Manually archive the product
      await prisma.product.update({
        where: { id: archivedProduct.id },
        data: { isArchived: true, archivedAt: new Date(), archivedByUserId: ownerUser.id },
      });
    });

    it('OWNER - should allow (has products:write)', async () => {
      const response = await request(app)
        .post(`/api/products/${archivedProduct.id}/restore`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('ADMIN - should allow (has products:write)', async () => {
      const product = await createTestProduct({ tenantId: testTenant.id });
      await prisma.product.update({
        where: { id: product.id },
        data: { isArchived: true, archivedAt: new Date(), archivedByUserId: ownerUser.id },
      });
      const response = await request(app)
        .post(`/api/products/${product.id}/restore`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
    });

    it('EDITOR - should allow (has products:write)', async () => {
      const product = await createTestProduct({ tenantId: testTenant.id });
      await prisma.product.update({
        where: { id: product.id },
        data: { isArchived: true, archivedAt: new Date(), archivedByUserId: ownerUser.id },
      });
      const response = await request(app)
        .post(`/api/products/${product.id}/restore`)
        .set('Cookie', editorCookie);

      expect(response.status).toBe(200);
    });

    it('VIEWER - should deny (lacks products:write)', async () => {
      const response = await request(app)
        .post(`/api/products/${archivedProduct.id}/restore`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('Custom role with permission - should allow', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read', 'products:write'],
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .post(`/api/products/${archivedProduct.id}/restore`)
        .set('Cookie', customCookie);

      expect(response.status).toBe(200);
    });

    it('Custom role without permission - should deny (403)', async () => {
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
        .post(`/api/products/${archivedProduct.id}/restore`)
        .set('Cookie', customCookie);

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).post(`/api/products/${archivedProduct.id}/restore`);

      expect(response.status).toBe(401);
    });

    it('Cross-tenant access - should deny (404)', async () => {
      const otherTenant = await createTestTenant();
      const otherProduct = await createTestProduct({
        tenantId: otherTenant.id,
      });
      await prisma.product.update({
        where: { id: otherProduct.id },
        data: { isArchived: true, archivedAt: new Date(), archivedByUserId: ownerUser.id },
      });

      const response = await request(app)
        .post(`/api/products/${otherProduct.id}/restore`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(404);
    });
  });
});
