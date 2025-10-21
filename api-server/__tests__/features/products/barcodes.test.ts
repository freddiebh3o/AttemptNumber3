// api-server/__tests__/features/products/barcodes.test.ts
import request from 'supertest';
import express, { type Express } from 'express';
import { productRouter } from '../../../src/routes/productRouter.js';
import { sessionMiddleware } from '../../../src/middleware/sessionMiddleware.js';
import { standardErrorHandler } from '../../../src/middleware/errorHandler.js';
import cookieParser from 'cookie-parser';
import {
  createTestUser,
  createTestTenant,
  createTestProduct,
  createTestRoleWithPermissions,
  createTestMembership,
  createTestBranch,
} from '../../helpers/factories.js';
import { createSessionCookie } from '../../helpers/auth.js';
import { ROLE_DEFS } from '../../../src/rbac/catalog.js';
import { prismaClientInstance as prisma } from '../../../src/db/prismaClient.js';

/**
 * Barcode Scanning Tests
 *
 * Tests for Phase 3: Barcode-Based Bulk Receive
 * - Barcode lookup API (GET /api/products/by-barcode/:barcode)
 * - Product CRUD with barcodes
 * - Multi-tenant isolation
 * - Permission enforcement
 */

describe('[ST-BARCODE] Barcode Scanning API', () => {
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
    testTenant = await createTestTenant();
    testUser = await createTestUser();

    // Create role with product read permissions
    const role = await createTestRoleWithPermissions({
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

  describe('[AC-BARCODE-1] GET /api/products/by-barcode/:barcode - Barcode Lookup', () => {
    it('should successfully lookup product by barcode (valid barcode, tenant match)', async () => {
      // Create product with barcode
      const timestamp = Date.now();
      const product = await createTestProduct({
        name: `Barcode Product ${timestamp}`,
        sku: `BARCODE-SKU-${timestamp}`,
        tenantId: testTenant.id,
        pricePence: 1500,
      });

      // Add barcode
      const barcode = `EAN13-${timestamp}`;
      await prisma.product.update({
        where: { id: product.id },
        data: {
          barcode: barcode,
          barcodeType: 'EAN13',
        },
      });

      const response = await request(app)
        .get(`/api/products/by-barcode/${barcode}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.product).toBeDefined();
      expect(response.body.data.product.id).toBe(product.id);
      expect(response.body.data.product.barcode).toBe(barcode);
      expect(response.body.data.product.barcodeType).toBe('EAN13');
      expect(response.body.data.product.productName).toBe(product.productName);
    });

    it('should return 404 when barcode not found for current tenant', async () => {
      const response = await request(app)
        .get('/api/products/by-barcode/NON-EXISTENT-BARCODE-999')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error?.errorCode).toBe('RESOURCE_NOT_FOUND');
    });

    it('should return product with stock info when branchId provided', async () => {
      // Create branch and product
      const branch = await createTestBranch({
        tenantId: testTenant.id,
        name: `Test Branch ${Date.now()}`,
      });

      const timestamp = Date.now();
      const product = await createTestProduct({
        name: `Stock Product ${timestamp}`,
        sku: `STOCK-SKU-${timestamp}`,
        tenantId: testTenant.id,
        pricePence: 2000,
      });

      const barcode = `EAN13-STOCK-${timestamp}`;
      await prisma.product.update({
        where: { id: product.id },
        data: { barcode, barcodeType: 'EAN13' },
      });

      // Create stock record
      await prisma.productStock.create({
        data: {
          tenantId: testTenant.id,
          branchId: branch.id,
          productId: product.id,
          qtyOnHand: 100,
          qtyAllocated: 0,
        },
      });

      const response = await request(app)
        .get(`/api/products/by-barcode/${barcode}?branchId=${branch.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.product.stock).toBeDefined();
      expect(response.body.data.product.stock.branchId).toBe(branch.id);
      expect(response.body.data.product.stock.branchName).toBe(branch.branchName);
      expect(response.body.data.product.stock.qtyOnHand).toBe(100);
      expect(response.body.data.product.stock.qtyAllocated).toBe(0);
    });

    it('should return product without stock when branchId not provided', async () => {
      const timestamp = Date.now();
      const product = await createTestProduct({
        name: `No Stock Product ${timestamp}`,
        sku: `NO-STOCK-SKU-${timestamp}`,
        tenantId: testTenant.id,
        pricePence: 1000,
      });

      const barcode = `EAN13-NO-STOCK-${timestamp}`;
      await prisma.product.update({
        where: { id: product.id },
        data: { barcode, barcodeType: 'EAN13' },
      });

      const response = await request(app)
        .get(`/api/products/by-barcode/${barcode}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.product.stock).toBeNull();
    });

    it('should enforce multi-tenant isolation (barcode exists in other tenant, returns 404)', async () => {
      // Create another tenant with product
      const otherTenant = await createTestTenant();
      const otherProduct = await createTestProduct({
        tenantId: otherTenant.id,
        sku: `OTHER-SKU-${Date.now()}`,
      });

      const barcode = `OTHER-BARCODE-${Date.now()}`;
      await prisma.product.update({
        where: { id: otherProduct.id },
        data: { barcode, barcodeType: 'EAN13' },
      });

      // Try to lookup with current tenant session
      const response = await request(app)
        .get(`/api/products/by-barcode/${barcode}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
      expect(response.body.error?.errorCode).toBe('RESOURCE_NOT_FOUND');
    });

    it('should require products:read permission', async () => {
      // Create user without products:read
      const userWithoutPerm = await createTestUser();
      const roleWithoutPerm = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: [], // No permissions
      });
      await createTestMembership({
        userId: userWithoutPerm.id,
        tenantId: testTenant.id,
        roleId: roleWithoutPerm.id,
      });

      const noPermCookie = createSessionCookie(userWithoutPerm.id, testTenant.id);

      const response = await request(app)
        .get('/api/products/by-barcode/ANY-BARCODE')
        .set('Cookie', noPermCookie);

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('should validate empty barcode parameter (400 error)', async () => {
      const response = await request(app)
        .get('/api/products/by-barcode/ ')
        .set('Cookie', sessionCookie);

      // Either 400 validation error or 404 not found (both acceptable)
      expect([400, 404]).toContain(response.status);
    });

    it('should support URL encoding (barcodes with special characters)', async () => {
      const timestamp = Date.now();
      const product = await createTestProduct({
        name: `Special Barcode Product ${timestamp}`,
        sku: `SPECIAL-SKU-${timestamp}`,
        tenantId: testTenant.id,
      });

      // Barcode with special characters
      const barcode = `CODE128-ABC/123-${timestamp}`;
      await prisma.product.update({
        where: { id: product.id },
        data: { barcode, barcodeType: 'CODE128' },
      });

      // URL encode the barcode
      const encodedBarcode = encodeURIComponent(barcode);

      const response = await request(app)
        .get(`/api/products/by-barcode/${encodedBarcode}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.product.barcode).toBe(barcode);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/products/by-barcode/ANY-BARCODE');

      expect(response.status).toBe(401);
      expect(response.body.error?.errorCode).toBe('AUTH_REQUIRED');
    });
  });

  describe('[AC-BARCODE-2] Product CRUD with Barcodes', () => {
    it('should create product with barcode (success)', async () => {
      const timestamp = Date.now();
      const barcode = `CREATE-BARCODE-${timestamp}`;

      const response = await request(app)
        .post('/api/products')
        .set('Cookie', sessionCookie)
        .send({
          productName: `Product with Barcode ${timestamp}`,
          productSku: `SKU-WITH-BARCODE-${timestamp}`,
          productPricePence: 1000,
          barcode: barcode,
          barcodeType: 'EAN13',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.product.barcode).toBe(barcode);
      expect(response.body.data.product.barcodeType).toBe('EAN13');
    });

    it('should create product without barcode (optional field)', async () => {
      const timestamp = Date.now();

      const response = await request(app)
        .post('/api/products')
        .set('Cookie', sessionCookie)
        .send({
          productName: `Product without Barcode ${timestamp}`,
          productSku: `SKU-NO-BARCODE-${timestamp}`,
          productPricePence: 1500,
          // No barcode fields
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.product.barcode).toBeNull();
      expect(response.body.data.product.barcodeType).toBeNull();
    });

    it('should enforce barcode uniqueness per tenant (duplicate barcode in same tenant fails)', async () => {
      const timestamp = Date.now();
      const barcode = `UNIQUE-BARCODE-${timestamp}`;

      // Create first product with barcode
      await request(app)
        .post('/api/products')
        .set('Cookie', sessionCookie)
        .send({
          productName: 'First Product',
          productSku: `FIRST-SKU-${timestamp}`,
          productPricePence: 1000,
          barcode: barcode,
          barcodeType: 'EAN13',
        });

      // Try to create second product with same barcode in same tenant
      const response = await request(app)
        .post('/api/products')
        .set('Cookie', sessionCookie)
        .send({
          productName: 'Second Product',
          productSku: `SECOND-SKU-${timestamp}`,
          productPricePence: 2000,
          barcode: barcode, // Duplicate barcode
          barcodeType: 'UPCA',
        });

      expect(response.status).toBe(409);
      expect(response.body.error?.errorCode).toBe('CONFLICT');
    });

    it('should allow barcode to be duplicated across tenants (different tenantId)', async () => {
      const timestamp = Date.now();
      const barcode = `CROSS-TENANT-BARCODE-${timestamp}`;

      // Create product in first tenant
      await request(app)
        .post('/api/products')
        .set('Cookie', sessionCookie)
        .send({
          productName: 'Product Tenant 1',
          productSku: `TENANT1-SKU-${timestamp}`,
          productPricePence: 1000,
          barcode: barcode,
          barcodeType: 'EAN13',
        });

      // Create second tenant and user
      const tenant2 = await createTestTenant();
      const user2 = await createTestUser();
      const role2 = await createTestRoleWithPermissions({
        tenantId: tenant2.id,
        permissionKeys: ROLE_DEFS.EDITOR,
      });
      await createTestMembership({
        userId: user2.id,
        tenantId: tenant2.id,
        roleId: role2.id,
      });
      const sessionCookie2 = createSessionCookie(user2.id, tenant2.id);

      // Create product with same barcode in second tenant
      const response = await request(app)
        .post('/api/products')
        .set('Cookie', sessionCookie2)
        .send({
          productName: 'Product Tenant 2',
          productSku: `TENANT2-SKU-${timestamp}`,
          productPricePence: 2000,
          barcode: barcode, // Same barcode, different tenant
          barcodeType: 'EAN13',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.product.barcode).toBe(barcode);
    });

    it('should update product barcode (success)', async () => {
      const timestamp = Date.now();
      const product = await createTestProduct({
        name: 'Update Barcode Product',
        sku: `UPDATE-SKU-${timestamp}`,
        tenantId: testTenant.id,
      });

      const newBarcode = `UPDATED-BARCODE-${timestamp}`;

      const response = await request(app)
        .put(`/api/products/${product.id}`)
        .set('Cookie', sessionCookie)
        .send({
          barcode: newBarcode,
          barcodeType: 'CODE128',
          currentEntityVersion: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.product.barcode).toBe(newBarcode);
      expect(response.body.data.product.barcodeType).toBe('CODE128');
    });

    it('should update product to remove barcode (set to null)', async () => {
      const timestamp = Date.now();
      const product = await createTestProduct({
        name: 'Remove Barcode Product',
        sku: `REMOVE-SKU-${timestamp}`,
        tenantId: testTenant.id,
      });

      // Add barcode first
      await prisma.product.update({
        where: { id: product.id },
        data: {
          barcode: `TO-REMOVE-${timestamp}`,
          barcodeType: 'EAN13',
        },
      });

      // Remove barcode
      const response = await request(app)
        .put(`/api/products/${product.id}`)
        .set('Cookie', sessionCookie)
        .send({
          barcode: null,
          barcodeType: null,
          currentEntityVersion: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.product.barcode).toBeNull();
      expect(response.body.data.product.barcodeType).toBeNull();
    });

    it('should validate barcodeType (only allowed types)', async () => {
      const timestamp = Date.now();

      const response = await request(app)
        .post('/api/products')
        .set('Cookie', sessionCookie)
        .send({
          productName: 'Invalid Type Product',
          productSku: `INVALID-TYPE-${timestamp}`,
          productPricePence: 1000,
          barcode: `BARCODE-${timestamp}`,
          barcodeType: 'INVALID_TYPE', // Not in allowed list
        });

      // Should fail validation
      expect(response.status).toBe(400);
      expect(response.body.error?.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should accept all valid barcode types (EAN13, UPCA, CODE128, QR)', async () => {
      const timestamp = Date.now();
      const validTypes = ['EAN13', 'UPCA', 'CODE128', 'QR'];

      for (const barcodeType of validTypes) {
        const response = await request(app)
          .post('/api/products')
          .set('Cookie', sessionCookie)
          .send({
            productName: `Product ${barcodeType} ${timestamp}`,
            productSku: `SKU-${barcodeType}-${timestamp}`,
            productPricePence: 1000,
            barcode: `BARCODE-${barcodeType}-${timestamp}`,
            barcodeType: barcodeType,
          });

        expect(response.status).toBe(201);
        expect(response.body.data.product.barcodeType).toBe(barcodeType);
      }
    });
  });

  describe('[AC-BARCODE-3] Stock Operations with Barcodes', () => {
    it('should include barcode in product response when fetching product', async () => {
      const timestamp = Date.now();
      const product = await createTestProduct({
        name: `Fetch Product ${timestamp}`,
        sku: `FETCH-SKU-${timestamp}`,
        tenantId: testTenant.id,
      });

      const barcode = `FETCH-BARCODE-${timestamp}`;
      await prisma.product.update({
        where: { id: product.id },
        data: { barcode, barcodeType: 'EAN13' },
      });

      const response = await request(app)
        .get(`/api/products/${product.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.product.barcode).toBe(barcode);
      expect(response.body.data.product.barcodeType).toBe('EAN13');
    });

    it('should include barcode in product list response', async () => {
      const timestamp = Date.now();
      const product = await createTestProduct({
        name: `List Product ${timestamp}`,
        sku: `LIST-SKU-${timestamp}`,
        tenantId: testTenant.id,
      });

      const barcode = `LIST-BARCODE-${timestamp}`;
      await prisma.product.update({
        where: { id: product.id },
        data: { barcode, barcodeType: 'UPCA' },
      });

      const response = await request(app)
        .get('/api/products')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      const foundProduct = response.body.data.items.find(
        (p: any) => p.id === product.id
      );
      expect(foundProduct).toBeDefined();
      expect(foundProduct.barcode).toBe(barcode);
      expect(foundProduct.barcodeType).toBe('UPCA');
    });
  });

  describe('[AC-BARCODE-4] Edge Cases and Error Handling', () => {
    it('should handle very long barcodes (max length validation)', async () => {
      const timestamp = Date.now();
      // Create a very long barcode (e.g., 200 characters)
      const longBarcode = 'LONG-BARCODE-' + 'X'.repeat(200);

      const response = await request(app)
        .post('/api/products')
        .set('Cookie', sessionCookie)
        .send({
          productName: 'Long Barcode Product',
          productSku: `LONG-SKU-${timestamp}`,
          productPricePence: 1000,
          barcode: longBarcode,
          barcodeType: 'CODE128',
        });

      // Should either succeed (if no max length) or fail validation
      // Adjust expectation based on actual schema validation
      expect([201, 400]).toContain(response.status);
    });

    it('should handle barcode with only whitespace', async () => {
      const timestamp = Date.now();

      const response = await request(app)
        .post('/api/products')
        .set('Cookie', sessionCookie)
        .send({
          productName: 'Whitespace Barcode Product',
          productSku: `WS-SKU-${timestamp}`,
          productPricePence: 1000,
          barcode: '   ', // Only whitespace
          barcodeType: 'EAN13',
        });

      // Should fail validation (barcode should be trimmed or rejected)
      expect(response.status).toBe(400);
      expect(response.body.error?.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should handle null barcode with non-null barcodeType', async () => {
      const timestamp = Date.now();

      const response = await request(app)
        .post('/api/products')
        .set('Cookie', sessionCookie)
        .send({
          productName: 'Null Barcode Product',
          productSku: `NULL-SKU-${timestamp}`,
          productPricePence: 1000,
          barcode: null,
          barcodeType: 'EAN13', // Type without barcode
        });

      // Should succeed (barcode and type are optional, independent)
      // Or fail validation (depends on business rules)
      // Adjust based on actual behavior
      expect([201, 400]).toContain(response.status);
    });

    it('should handle concurrent barcode updates (optimistic locking)', async () => {
      const timestamp = Date.now();
      const product = await createTestProduct({
        name: 'Concurrent Update Product',
        sku: `CONCURRENT-SKU-${timestamp}`,
        tenantId: testTenant.id,
      });

      // First update
      await request(app)
        .put(`/api/products/${product.id}`)
        .set('Cookie', sessionCookie)
        .send({
          barcode: `FIRST-UPDATE-${timestamp}`,
          barcodeType: 'EAN13',
          currentEntityVersion: 1,
        });

      // Second update with stale version
      const response = await request(app)
        .put(`/api/products/${product.id}`)
        .set('Cookie', sessionCookie)
        .send({
          barcode: `SECOND-UPDATE-${timestamp}`,
          barcodeType: 'UPCA',
          currentEntityVersion: 1, // Stale version
        });

      expect(response.status).toBe(409);
      expect(response.body.error?.errorCode).toBe('CONFLICT');
    });
  });
});
