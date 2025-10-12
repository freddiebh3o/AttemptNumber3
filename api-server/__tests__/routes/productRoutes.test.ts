// api-server/__tests__/routes/productRoutes.test.ts
import request from 'supertest';
import express, { type Express } from 'express';
import { productRouter } from '../../src/routes/productRouter.js';
import { sessionMiddleware } from '../../src/middleware/sessionMiddleware.js';
import { standardErrorHandler } from '../../src/middleware/errorHandler.js';
import cookieParser from 'cookie-parser';
import { cleanDatabase } from '../helpers/db.js';
import {
  createTestUser,
  createTestTenant,
  createTestProduct,
  createTestRoleWithPermissions,
  createTestMembership,
} from '../helpers/factories.js';
import { createSessionCookie } from '../helpers/auth.js';
import { ROLE_DEFS } from '../../src/rbac/catalog.js';

describe('[ST-008] Product API Routes', () => {
  let app: Express;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let sessionCookie: string;

  beforeAll(async () => {
    // Setup Express app with product router
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(sessionMiddleware);
    app.use('/api/products', productRouter);
    app.use(standardErrorHandler);
  });

  beforeEach(async () => {
    await cleanDatabase();

    testTenant = await createTestTenant({ slug: 'route-test-tenant' });
    testUser = await createTestUser({ email: 'route@test.com' });

    // Create role with full product permissions
    const role = await createTestRoleWithPermissions({
      name: 'Product Manager',
      tenantId: testTenant.id,
      permissionKeys: ROLE_DEFS.EDITOR, // Has products:read and products:write
    });

    await createTestMembership({
      userId: testUser.id,
      tenantId: testTenant.id,
      roleId: role.id,
    });

    sessionCookie = createSessionCookie(testUser.id, testTenant.id);
  });

  describe('[AC-008-1] POST /api/products - Create Product', () => {
    it('should create product with valid data', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Cookie', sessionCookie)
        .send({
          productName: 'Test Widget',
          productSku: 'WIDGET-001',
          productPricePence: 1500,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.product).toBeDefined();
      expect(response.body.data.product.productName).toBe('Test Widget');
      expect(response.body.data.product.productSku).toBe('WIDGET-001');
      expect(response.body.data.product.productPricePence).toBe(1500);
      expect(response.body.data.product.entityVersion).toBe(1);
    });

    it('should reject without authentication', async () => {
      const response = await request(app)
        .post('/api/products')
        .send({
          productName: 'Test',
          productSku: 'TEST-001',
          productPricePence: 1000,
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject without products:write permission', async () => {
      // Create user with read-only permissions
      const viewer = await createTestUser({ email: 'viewer@test.com' });
      const viewerRole = await createTestRoleWithPermissions({
        name: 'Viewer',
        tenantId: testTenant.id,
        permissionKeys: ROLE_DEFS.VIEWER, // Only has products:read
      });
      await createTestMembership({
        userId: viewer.id,
        tenantId: testTenant.id,
        roleId: viewerRole.id,
      });

      const viewerCookie = createSessionCookie(viewer.id, testTenant.id);

      const response = await request(app)
        .post('/api/products')
        .set('Cookie', viewerCookie)
        .send({
          productName: 'Test',
          productSku: 'TEST-001',
          productPricePence: 1000,
        });

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Cookie', sessionCookie)
        .send({
          productName: '', // Empty name
          productSku: 'invalid sku', // Invalid SKU format
          productPricePence: -100, // Negative price
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error?.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should reject duplicate SKU', async () => {
      // Create first product
      await request(app)
        .post('/api/products')
        .set('Cookie', sessionCookie)
        .send({
          productName: 'First',
          productSku: 'DUPE-001',
          productPricePence: 1000,
        });

      // Try to create second with same SKU
      const response = await request(app)
        .post('/api/products')
        .set('Cookie', sessionCookie)
        .send({
          productName: 'Second',
          productSku: 'DUPE-001',
          productPricePence: 2000,
        });

      expect(response.status).toBe(409);
      expect(response.body.error?.errorCode).toBe('CONFLICT');
    });

    it('should support idempotency with Idempotency-Key header', async () => {
      const idempotencyKey = 'test-key-123';
      const requestBody = {
        productName: 'Idempotent Product',
        productSku: 'IDEMP-001',
        productPricePence: 1500,
      };

      // First request
      const response1 = await request(app)
        .post('/api/products')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send(requestBody);

      expect(response1.status).toBe(201);
      const productId = response1.body.data.product.id;

      // Small delay to ensure first response is stored
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Second request with same key and same body - should return same response
      const response2 = await request(app)
        .post('/api/products')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send(requestBody);

      expect(response2.status).toBe(201);
      expect(response2.body.data.product.id).toBe(productId);
      expect(response2.body.data.product.productName).toBe('Idempotent Product'); // Original data
    });
  });

  describe('[AC-008-2] GET /api/products/:productId - Get Product', () => {
    it('should get product by ID', async () => {
      const product = await createTestProduct({
        name: 'Get Test Product',
        sku: 'GET-001',
        tenantId: testTenant.id,
        pricePence: 2500,
      });

      const response = await request(app)
        .get(`/api/products/${product.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.product.id).toBe(product.id);
      expect(response.body.data.product.productName).toBe('Get Test Product');
      expect(response.body.data.product.productPricePence).toBe(2500);
    });

    it('should return 404 for non-existent product', async () => {
      const response = await request(app)
        .get('/api/products/non-existent-id')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
      expect(response.body.error?.errorCode).toBe('RESOURCE_NOT_FOUND');
    });

    it('should reject without authentication', async () => {
      const product = await createTestProduct({
        name: 'Test',
        sku: 'TEST-001',
        tenantId: testTenant.id,
      });

      const response = await request(app).get(`/api/products/${product.id}`);

      expect(response.status).toBe(401);
    });

    it('should not allow access to other tenant products', async () => {
      const otherTenant = await createTestTenant({ slug: 'other-tenant' });
      const otherProduct = await createTestProduct({
        name: 'Other Product',
        sku: 'OTHER-001',
        tenantId: otherTenant.id,
      });

      const response = await request(app)
        .get(`/api/products/${otherProduct.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
    });
  });

  describe('[AC-008-3] GET /api/products - List Products', () => {
    beforeEach(async () => {
      // Create test products
      await createTestProduct({
        name: 'Widget A',
        sku: 'WIDGET-A',
        tenantId: testTenant.id,
        pricePence: 1000,
      });
      await createTestProduct({
        name: 'Widget B',
        sku: 'WIDGET-B',
        tenantId: testTenant.id,
        pricePence: 2000,
      });
      await createTestProduct({
        name: 'Gadget C',
        sku: 'GADGET-C',
        tenantId: testTenant.id,
        pricePence: 1500,
      });
    });

    it('should list all products', async () => {
      const response = await request(app)
        .get('/api/products')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(3);
      expect(response.body.data.pageInfo).toBeDefined();
    });

    it('should support pagination with limit', async () => {
      const response = await request(app)
        .get('/api/products?limit=2')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.items).toHaveLength(2);
      expect(response.body.data.pageInfo.hasNextPage).toBe(true);
      expect(response.body.data.pageInfo.nextCursor).toBeDefined();
    });

    it('should support cursor pagination', async () => {
      const page1 = await request(app)
        .get('/api/products?limit=2')
        .set('Cookie', sessionCookie);

      const cursor = page1.body.data.pageInfo.nextCursor;

      const page2 = await request(app)
        .get(`/api/products?limit=2&cursorId=${cursor}`)
        .set('Cookie', sessionCookie);

      expect(page2.status).toBe(200);
      expect(page2.body.data.items).toHaveLength(1);
      expect(page2.body.data.pageInfo.hasNextPage).toBe(false);
    });

    it('should filter by search query', async () => {
      const response = await request(app)
        .get('/api/products?q=Widget')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.items).toHaveLength(2);
    });

    it('should filter by price range', async () => {
      const response = await request(app)
        .get('/api/products?minPricePence=1500&maxPricePence=2000')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.items).toHaveLength(2);
    });

    it('should sort by name ascending', async () => {
      const response = await request(app)
        .get('/api/products?sortBy=productName&sortDir=asc')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.items[0]?.productName).toBe('Gadget C');
      expect(response.body.data.items[1]?.productName).toBe('Widget A');
    });

    it('should include total count when requested', async () => {
      const response = await request(app)
        .get('/api/products?includeTotal=true')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.pageInfo.totalCount).toBe(3);
    });

    it('should reject without authentication', async () => {
      const response = await request(app).get('/api/products');

      expect(response.status).toBe(401);
    });
  });

  describe('[AC-008-4] PUT /api/products/:productId - Update Product', () => {
    it('should update product with correct entityVersion', async () => {
      const product = await createTestProduct({
        name: 'Original Name',
        sku: 'UPDATE-001',
        tenantId: testTenant.id,
        pricePence: 1000,
      });

      const response = await request(app)
        .put(`/api/products/${product.id}`)
        .set('Cookie', sessionCookie)
        .send({
          productName: 'Updated Name',
          productPricePence: 1500,
          currentEntityVersion: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.product.productName).toBe('Updated Name');
      expect(response.body.data.product.productPricePence).toBe(1500);
      expect(response.body.data.product.entityVersion).toBe(2);
    });

    it('should reject update with stale entityVersion', async () => {
      const product = await createTestProduct({
        name: 'Original',
        sku: 'STALE-001',
        tenantId: testTenant.id,
      });

      // First update
      await request(app)
        .put(`/api/products/${product.id}`)
        .set('Cookie', sessionCookie)
        .send({
          productName: 'First Update',
          currentEntityVersion: 1,
        });

      // Second update with stale version
      const response = await request(app)
        .put(`/api/products/${product.id}`)
        .set('Cookie', sessionCookie)
        .send({
          productName: 'Second Update',
          currentEntityVersion: 1, // Stale
        });

      expect(response.status).toBe(409);
      expect(response.body.error?.errorCode).toBe('CONFLICT');
    });

    it('should support partial updates', async () => {
      const product = await createTestProduct({
        name: 'Original Name',
        sku: 'PARTIAL-001',
        tenantId: testTenant.id,
        pricePence: 1000,
      });

      // Update only name
      const response = await request(app)
        .put(`/api/products/${product.id}`)
        .set('Cookie', sessionCookie)
        .send({
          productName: 'New Name',
          currentEntityVersion: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.product.productName).toBe('New Name');
      expect(response.body.data.product.productPricePence).toBe(1000); // Unchanged
    });

    it('should reject without authentication', async () => {
      const product = await createTestProduct({
        name: 'Test',
        sku: 'TEST-001',
        tenantId: testTenant.id,
      });

      const response = await request(app)
        .put(`/api/products/${product.id}`)
        .send({
          productName: 'Updated',
          currentEntityVersion: 1,
        });

      expect(response.status).toBe(401);
    });

    it('should reject without products:write permission', async () => {
      const viewer = await createTestUser({ email: 'viewer2@test.com' });
      const viewerRole = await createTestRoleWithPermissions({
        name: 'Viewer',
        tenantId: testTenant.id,
        permissionKeys: ['products:read'],
      });
      await createTestMembership({
        userId: viewer.id,
        tenantId: testTenant.id,
        roleId: viewerRole.id,
      });

      const product = await createTestProduct({
        name: 'Test',
        sku: 'TEST-002',
        tenantId: testTenant.id,
      });

      const viewerCookie = createSessionCookie(viewer.id, testTenant.id);

      const response = await request(app)
        .put(`/api/products/${product.id}`)
        .set('Cookie', viewerCookie)
        .send({
          productName: 'Updated',
          currentEntityVersion: 1,
        });

      expect(response.status).toBe(403);
    });

    it('should validate request body', async () => {
      const product = await createTestProduct({
        name: 'Test',
        sku: 'TEST-003',
        tenantId: testTenant.id,
      });

      const response = await request(app)
        .put(`/api/products/${product.id}`)
        .set('Cookie', sessionCookie)
        .send({
          productPricePence: -100, // Invalid negative price
          currentEntityVersion: 1,
        });

      expect(response.status).toBe(400);
      expect(response.body.error?.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('[AC-008-5] DELETE /api/products/:productId - Delete Product', () => {
    it('should delete product', async () => {
      const product = await createTestProduct({
        name: 'To Delete',
        sku: 'DELETE-001',
        tenantId: testTenant.id,
      });

      const response = await request(app)
        .delete(`/api/products/${product.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.hasDeletedProduct).toBe(true);

      // Verify product is deleted
      const getResponse = await request(app)
        .get(`/api/products/${product.id}`)
        .set('Cookie', sessionCookie);

      expect(getResponse.status).toBe(404);
    });

    it('should return 404 for non-existent product', async () => {
      const response = await request(app)
        .delete('/api/products/non-existent-id')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
    });

    it('should reject without authentication', async () => {
      const product = await createTestProduct({
        name: 'Test',
        sku: 'TEST-004',
        tenantId: testTenant.id,
      });

      const response = await request(app).delete(`/api/products/${product.id}`);

      expect(response.status).toBe(401);
    });

    it('should reject without products:write permission', async () => {
      const viewer = await createTestUser({ email: 'viewer3@test.com' });
      const viewerRole = await createTestRoleWithPermissions({
        name: 'Viewer',
        tenantId: testTenant.id,
        permissionKeys: ['products:read'],
      });
      await createTestMembership({
        userId: viewer.id,
        tenantId: testTenant.id,
        roleId: viewerRole.id,
      });

      const product = await createTestProduct({
        name: 'Test',
        sku: 'TEST-005',
        tenantId: testTenant.id,
      });

      const viewerCookie = createSessionCookie(viewer.id, testTenant.id);

      const response = await request(app)
        .delete(`/api/products/${product.id}`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
    });
  });
});
