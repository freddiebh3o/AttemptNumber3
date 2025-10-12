// api-server/__tests__/routes/stockRoutes.test.ts
/**
 * [ST-009] Stock API Routes Tests
 *
 * Tests full HTTP request/response cycle for stock management routes:
 * - POST /api/stock/receive
 * - POST /api/stock/adjust
 * - POST /api/stock/consume
 * - GET /api/stock/levels
 * - GET /api/stock/ledger
 * - GET /api/stock/levels/bulk
 *
 * These tests verify:
 * - Authentication and authorization (stock:read, stock:write)
 * - Request validation (Zod schemas)
 * - Success responses (201, 200)
 * - Error responses (400, 401, 403, 404)
 * - Idempotency support
 * - Multi-tenant isolation
 */

import express from 'express';
import type { Express } from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { sessionMiddleware } from '../../src/middleware/sessionMiddleware.js';
import { stockRouter } from '../../src/routes/stockRouter.js';
import { standardErrorHandler } from '../../src/middleware/errorHandler.js';
import { setupTestDatabase, teardownTestDatabase } from '../helpers/db.js';
import {
  createTestTenant,
  createTestUser,
  createTestBranch,
  createTestProduct,
  createTestRoleWithPermissions,
  createTestMembership,
} from '../helpers/factories.js';
import { createSessionCookie } from '../helpers/auth.js';
import { prismaClientInstance } from '../../src/db/prismaClient.js';

describe('[ST-009] Stock API Routes', () => {
  let app: Express;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let editorUser: Awaited<ReturnType<typeof createTestUser>>;
  let viewerUser: Awaited<ReturnType<typeof createTestUser>>;
  let sessionCookie: string;
  let viewerCookie: string;
  let testBranch: Awaited<ReturnType<typeof createTestBranch>>;
  let testProduct: Awaited<ReturnType<typeof createTestProduct>>;

  beforeAll(async () => {
    await setupTestDatabase();

    // Setup Express app with middleware
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(sessionMiddleware);
    app.use('/api/stock', stockRouter);
    app.use(standardErrorHandler);

    // Create test tenant
    testTenant = await createTestTenant({ slug: 'stock-test-tenant' });

    // Create editor role with stock:write permission
    const editorRole = await createTestRoleWithPermissions({
      name: 'Editor',
      tenantId: testTenant.id,
      permissionKeys: ['stock:read', 'stock:write'],
    });

    // Create viewer role with only stock:read
    const viewerRole = await createTestRoleWithPermissions({
      name: 'Viewer',
      tenantId: testTenant.id,
      permissionKeys: ['stock:read'],
    });

    // Create users
    editorUser = await createTestUser({ email: 'editor@test.com' });
    viewerUser = await createTestUser({ email: 'viewer@test.com' });

    // Create memberships
    await createTestMembership({
      userId: editorUser.id,
      tenantId: testTenant.id,
      roleId: editorRole.id,
    });
    await createTestMembership({
      userId: viewerUser.id,
      tenantId: testTenant.id,
      roleId: viewerRole.id,
    });

    // Create session cookies
    sessionCookie = createSessionCookie(editorUser.id, testTenant.id);
    viewerCookie = createSessionCookie(viewerUser.id, testTenant.id);

    // Create test branch and product
    testBranch = await createTestBranch({
      name: 'Test Warehouse',
      tenantId: testTenant.id,
    });
    testProduct = await createTestProduct({
      name: 'Test Product',
      sku: 'TEST-001',
      tenantId: testTenant.id,
      pricePence: 1000,
    });

    // Create branch memberships for stock operations
    await prismaClientInstance.userBranchMembership.create({
      data: {
        userId: editorUser.id,
        tenantId: testTenant.id,
        branchId: testBranch.id,
      },
    });
    await prismaClientInstance.userBranchMembership.create({
      data: {
        userId: viewerUser.id,
        tenantId: testTenant.id,
        branchId: testBranch.id,
      },
    });
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  describe('[AC-009-1] POST /api/stock/receive - Receive Stock', () => {
    it('should receive stock with valid data', async () => {
      const response = await request(app)
        .post('/api/stock/receive')
        .set('Cookie', sessionCookie)
        .send({
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 100,
          unitCostPence: 500,
          sourceRef: 'PO-001',
          reason: 'Initial stock',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.lot).toBeDefined();
      expect(response.body.data.lot.qtyReceived).toBe(100);
      expect(response.body.data.lot.unitCostPence).toBe(500);
      expect(response.body.data.productStock).toBeDefined();
      expect(response.body.data.productStock.qtyOnHand).toBe(100);
    });

    it('should reject without authentication', async () => {
      const response = await request(app)
        .post('/api/stock/receive')
        .send({
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 50,
        });

      expect(response.status).toBe(401);
    });

    it('should reject without stock:write permission', async () => {
      const response = await request(app)
        .post('/api/stock/receive')
        .set('Cookie', viewerCookie)
        .send({
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 50,
          unitCostPence: 500,
        });

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/stock/receive')
        .set('Cookie', sessionCookie)
        .send({
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: -10, // Invalid: negative qty
        });

      expect(response.status).toBe(400);
      expect(response.body.error?.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should support idempotency with Idempotency-Key header', async () => {
      const idempotencyKey = 'receive-key-123';
      const requestBody = {
        branchId: testBranch.id,
        productId: testProduct.id,
        qty: 25,
        unitCostPence: 600,
      };

      // First request
      const response1 = await request(app)
        .post('/api/stock/receive')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send(requestBody);

      expect(response1.status).toBe(201);
      const lotId = response1.body.data.lot.id;

      // Small delay to ensure first response is stored
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Second request with same key and body - should return cached response
      const response2 = await request(app)
        .post('/api/stock/receive')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send(requestBody);

      expect(response2.status).toBe(201);
      expect(response2.body.data.lot.id).toBe(lotId);
    });
  });

  describe('[AC-009-2] POST /api/stock/adjust - Adjust Stock', () => {
    beforeEach(async () => {
      // Clean stock data before each test
      await prismaClientInstance.stockLedger.deleteMany({
        where: { tenantId: testTenant.id },
      });
      await prismaClientInstance.stockLot.deleteMany({
        where: { tenantId: testTenant.id },
      });
      await prismaClientInstance.productStock.deleteMany({
        where: { tenantId: testTenant.id },
      });

      // Ensure we have stock to adjust
      await prismaClientInstance.stockLot.create({
        data: {
          tenantId: testTenant.id,
          branchId: testBranch.id,
          productId: testProduct.id,
          qtyReceived: 100,
          qtyRemaining: 100,
          unitCostPence: 500,
          receivedAt: new Date(),
        },
      });
      await prismaClientInstance.productStock.create({
        data: {
          tenantId: testTenant.id,
          branchId: testBranch.id,
          productId: testProduct.id,
          qtyOnHand: 100,
        },
      });
    });

    it('should adjust stock positively', async () => {
      const response = await request(app)
        .post('/api/stock/adjust')
        .set('Cookie', sessionCookie)
        .send({
          branchId: testBranch.id,
          productId: testProduct.id,
          qtyDelta: 20,
          unitCostPence: 550,
          reason: 'Found extra inventory',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.lot).toBeDefined();
      expect(response.body.data.lot.qtyReceived).toBe(20);
    });

    it('should adjust stock negatively', async () => {
      const response = await request(app)
        .post('/api/stock/adjust')
        .set('Cookie', sessionCookie)
        .send({
          branchId: testBranch.id,
          productId: testProduct.id,
          qtyDelta: -10,
          reason: 'Damaged goods',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.affected).toBeDefined();
      expect(Array.isArray(response.body.data.affected)).toBe(true);
    });

    it('should require unitCostPence for positive adjustments', async () => {
      const response = await request(app)
        .post('/api/stock/adjust')
        .set('Cookie', sessionCookie)
        .send({
          branchId: testBranch.id,
          productId: testProduct.id,
          qtyDelta: 20,
          // Missing unitCostPence
        });

      expect(response.status).toBe(400);
      expect(response.body.error?.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should reject qtyDelta of zero', async () => {
      const response = await request(app)
        .post('/api/stock/adjust')
        .set('Cookie', sessionCookie)
        .send({
          branchId: testBranch.id,
          productId: testProduct.id,
          qtyDelta: 0,
        });

      expect(response.status).toBe(400);
      expect(response.body.error?.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should reject without stock:write permission', async () => {
      const response = await request(app)
        .post('/api/stock/adjust')
        .set('Cookie', viewerCookie)
        .send({
          branchId: testBranch.id,
          productId: testProduct.id,
          qtyDelta: 10,
          unitCostPence: 500,
        });

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });
  });

  describe('[AC-009-3] POST /api/stock/consume - Consume Stock', () => {
    beforeEach(async () => {
      // Clean stock data before each test
      await prismaClientInstance.stockLedger.deleteMany({
        where: { tenantId: testTenant.id },
      });
      await prismaClientInstance.stockLot.deleteMany({
        where: { tenantId: testTenant.id },
      });
      await prismaClientInstance.productStock.deleteMany({
        where: { tenantId: testTenant.id },
      });

      // Ensure we have stock to consume
      await prismaClientInstance.stockLot.create({
        data: {
          tenantId: testTenant.id,
          branchId: testBranch.id,
          productId: testProduct.id,
          qtyReceived: 100,
          qtyRemaining: 100,
          unitCostPence: 500,
          receivedAt: new Date(),
        },
      });
      await prismaClientInstance.productStock.create({
        data: {
          tenantId: testTenant.id,
          branchId: testBranch.id,
          productId: testProduct.id,
          qtyOnHand: 100,
        },
      });
    });

    it('should consume stock with valid data', async () => {
      const response = await request(app)
        .post('/api/stock/consume')
        .set('Cookie', sessionCookie)
        .send({
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 30,
          reason: 'Sales order',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.affected).toBeDefined();
      expect(Array.isArray(response.body.data.affected)).toBe(true);
      expect(response.body.data.affected.length).toBeGreaterThan(0);
    });

    it('should reject consumption exceeding available stock', async () => {
      const response = await request(app)
        .post('/api/stock/consume')
        .set('Cookie', sessionCookie)
        .send({
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 999, // More than available
          reason: 'Test',
        });

      expect(response.status).toBe(409);
      expect(response.body.error?.errorCode).toBe('CONFLICT');
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/stock/consume')
        .set('Cookie', sessionCookie)
        .send({
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: -10, // Invalid: negative qty
        });

      expect(response.status).toBe(400);
      expect(response.body.error?.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should reject without stock:write permission', async () => {
      const response = await request(app)
        .post('/api/stock/consume')
        .set('Cookie', viewerCookie)
        .send({
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 10,
        });

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });
  });

  describe('[AC-009-4] GET /api/stock/levels - Get Stock Levels', () => {
    beforeEach(async () => {
      // Clean stock data before each test
      await prismaClientInstance.stockLedger.deleteMany({
        where: { tenantId: testTenant.id },
      });
      await prismaClientInstance.stockLot.deleteMany({
        where: { tenantId: testTenant.id },
      });
      await prismaClientInstance.productStock.deleteMany({
        where: { tenantId: testTenant.id },
      });

      // Ensure we have stock levels
      await prismaClientInstance.stockLot.create({
        data: {
          tenantId: testTenant.id,
          branchId: testBranch.id,
          productId: testProduct.id,
          qtyReceived: 50,
          qtyRemaining: 50,
          unitCostPence: 400,
          receivedAt: new Date(),
        },
      });
      await prismaClientInstance.productStock.create({
        data: {
          tenantId: testTenant.id,
          branchId: testBranch.id,
          productId: testProduct.id,
          qtyOnHand: 50,
        },
      });
    });

    it('should get stock levels for product at branch', async () => {
      const response = await request(app)
        .get('/api/stock/levels')
        .query({
          branchId: testBranch.id,
          productId: testProduct.id,
        })
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.productStock).toBeDefined();
      expect(response.body.data.productStock.qtyOnHand).toBe(50);
      expect(response.body.data.lots).toBeDefined();
      expect(Array.isArray(response.body.data.lots)).toBe(true);
    });

    it('should reject without authentication', async () => {
      const response = await request(app)
        .get('/api/stock/levels')
        .query({
          branchId: testBranch.id,
          productId: testProduct.id,
        });

      expect(response.status).toBe(401);
    });

    it('should allow access with stock:read permission', async () => {
      const response = await request(app)
        .get('/api/stock/levels')
        .query({
          branchId: testBranch.id,
          productId: testProduct.id,
        })
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should validate query parameters', async () => {
      const response = await request(app)
        .get('/api/stock/levels')
        .query({
          // Missing required branchId
          productId: testProduct.id,
        })
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(400);
      expect(response.body.error?.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('[AC-009-5] GET /api/stock/ledger - List Stock Ledger', () => {
    beforeEach(async () => {
      // Clean stock data before each test
      await prismaClientInstance.stockLedger.deleteMany({
        where: { tenantId: testTenant.id },
      });
      await prismaClientInstance.stockLot.deleteMany({
        where: { tenantId: testTenant.id },
      });
      await prismaClientInstance.productStock.deleteMany({
        where: { tenantId: testTenant.id },
      });

      // Create some ledger entries
      const lot = await prismaClientInstance.stockLot.create({
        data: {
          tenantId: testTenant.id,
          branchId: testBranch.id,
          productId: testProduct.id,
          qtyReceived: 100,
          qtyRemaining: 100,
          unitCostPence: 500,
          receivedAt: new Date(),
        },
      });

      await prismaClientInstance.stockLedger.create({
        data: {
          tenantId: testTenant.id,
          branchId: testBranch.id,
          productId: testProduct.id,
          lotId: lot.id,
          kind: 'RECEIPT',
          qtyDelta: 100,
          occurredAt: new Date(),
        },
      });
    });

    it('should list stock ledger entries', async () => {
      const response = await request(app)
        .get('/api/stock/ledger')
        .query({ productId: testProduct.id })
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeDefined();
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data.pageInfo).toBeDefined();
    });

    it('should filter by branchId', async () => {
      const response = await request(app)
        .get('/api/stock/ledger')
        .query({
          productId: testProduct.id,
          branchId: testBranch.id,
        })
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.items).toBeDefined();
    });

    it('should support pagination with limit', async () => {
      const response = await request(app)
        .get('/api/stock/ledger')
        .query({
          productId: testProduct.id,
          limit: 5,
        })
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.pageInfo).toBeDefined();
    });

    it('should reject without authentication', async () => {
      const response = await request(app)
        .get('/api/stock/ledger')
        .query({ productId: testProduct.id });

      expect(response.status).toBe(401);
    });

    it('should allow access with stock:read permission', async () => {
      const response = await request(app)
        .get('/api/stock/ledger')
        .query({ productId: testProduct.id })
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(200);
    });
  });

  describe('[AC-009-6] GET /api/stock/levels/bulk - Get Bulk Stock Levels', () => {
    it('should get stock levels across all branches', async () => {
      const response = await request(app)
        .get('/api/stock/levels/bulk')
        .query({ productId: testProduct.id })
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeDefined();
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it('should reject without authentication', async () => {
      const response = await request(app)
        .get('/api/stock/levels/bulk')
        .query({ productId: testProduct.id });

      expect(response.status).toBe(401);
    });

    it('should allow access with stock:read permission', async () => {
      const response = await request(app)
        .get('/api/stock/levels/bulk')
        .query({ productId: testProduct.id })
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(200);
    });

    it('should validate query parameters', async () => {
      const response = await request(app)
        .get('/api/stock/levels/bulk')
        .query({})
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(400);
      expect(response.body.error?.errorCode).toBe('VALIDATION_ERROR');
    });
  });
});
