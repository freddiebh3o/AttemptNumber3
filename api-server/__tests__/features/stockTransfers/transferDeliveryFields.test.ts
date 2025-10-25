// api-server/__tests__/features/stockTransfers/transferDeliveryFields.test.ts
import request from 'supertest';
import express, { type Express } from 'express';
import { stockTransfersRouter } from '../../../src/routes/stockTransfersRouter.js';
import { sessionMiddleware } from '../../../src/middleware/sessionMiddleware.js';
import { standardErrorHandler } from '../../../src/middleware/errorHandler.js';
import cookieParser from 'cookie-parser';
import {
  createTestUser,
  createTestTenant,
  createTestBranch,
  createTestProduct,
  createTestRoleWithPermissions,
  createTestMembership,
  addUserToBranch,
} from '../../helpers/factories.js';
import { createSessionCookie } from '../../helpers/auth.js';
import { ROLE_DEFS } from '../../../src/rbac/catalog.js';
import { prismaClientInstance as prisma } from '../../../src/db/prismaClient.js';

describe('[TRANSFER-DELIVERY] Stock Transfer Delivery Fields', () => {
  let app: Express;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let sourceBranch: Awaited<ReturnType<typeof createTestBranch>>;
  let destBranch: Awaited<ReturnType<typeof createTestBranch>>;
  let testProduct: Awaited<ReturnType<typeof createTestProduct>>;
  let sessionCookie: string;

  beforeAll(async () => {
    // Setup Express app
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(sessionMiddleware);
    app.use('/api/stock-transfers', stockTransfersRouter);
    app.use(standardErrorHandler);
  });

  beforeEach(async () => {
    // Create fresh test data for each test
    testTenant = await createTestTenant();
    testUser = await createTestUser();

    // Create OWNER role with all permissions
    const role = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ROLE_DEFS.OWNER, // Has all permissions
    });

    await createTestMembership({
      userId: testUser.id,
      tenantId: testTenant.id,
      roleId: role.id,
    });

    // Create branches
    sourceBranch = await createTestBranch({
      tenantId: testTenant.id,
      name: 'Source Warehouse',
    });

    destBranch = await createTestBranch({
      tenantId: testTenant.id,
      name: 'Destination Store',
    });

    // Create product
    testProduct = await createTestProduct({
      tenantId: testTenant.id,
      name: 'Test Product',
    });

    // Create branch memberships
    await addUserToBranch(
      testUser.id,
      testTenant.id,
      destBranch.id
    );

    await addUserToBranch(
      testUser.id,
      testTenant.id,
      sourceBranch.id
    );

    sessionCookie = createSessionCookie(testUser.id, testTenant.id);
  });

  describe('POST /api/stock-transfers - Create with Delivery Fields', () => {
    it('should create transfer with expected delivery date and order notes', async () => {
      const expectedDeliveryDate = new Date();
      expectedDeliveryDate.setDate(expectedDeliveryDate.getDate() + 7); // 7 days from now

      const response = await request(app)
        .post('/api/stock-transfers')
        .set('Cookie', sessionCookie)
        .send({
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destBranch.id,
          expectedDeliveryDate: expectedDeliveryDate.toISOString(),
          orderNotes: 'Urgent delivery required for promotion',
          items: [
            {
              productId: testProduct.id,
              qtyRequested: 50,
            },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.expectedDeliveryDate).toBeDefined();
      expect(response.body.data.orderNotes).toBe('Urgent delivery required for promotion');

      // Verify in database
      const transfer = await prisma.stockTransfer.findUnique({
        where: { id: response.body.data.id },
      });

      expect(transfer).toBeDefined();
      expect(transfer?.expectedDeliveryDate).toBeDefined();
      expect(transfer?.orderNotes).toBe('Urgent delivery required for promotion');
    });

    it('should create transfer with only expected delivery date (no order notes)', async () => {
      const expectedDeliveryDate = new Date();
      expectedDeliveryDate.setDate(expectedDeliveryDate.getDate() + 3);

      const response = await request(app)
        .post('/api/stock-transfers')
        .set('Cookie', sessionCookie)
        .send({
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destBranch.id,
          expectedDeliveryDate: expectedDeliveryDate.toISOString(),
          items: [
            {
              productId: testProduct.id,
              qtyRequested: 25,
            },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.expectedDeliveryDate).toBeDefined();
      expect(response.body.data.orderNotes).toBeNull();
    });

    it('should create transfer with only order notes (no expected delivery date)', async () => {
      const response = await request(app)
        .post('/api/stock-transfers')
        .set('Cookie', sessionCookie)
        .send({
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destBranch.id,
          orderNotes: 'Standard shipping acceptable',
          items: [
            {
              productId: testProduct.id,
              qtyRequested: 10,
            },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.expectedDeliveryDate).toBeNull();
      expect(response.body.data.orderNotes).toBe('Standard shipping acceptable');
    });

    it('should create transfer without delivery fields (backward compatibility)', async () => {
      const response = await request(app)
        .post('/api/stock-transfers')
        .set('Cookie', sessionCookie)
        .send({
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destBranch.id,
          items: [
            {
              productId: testProduct.id,
              qtyRequested: 15,
            },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.expectedDeliveryDate).toBeNull();
      expect(response.body.data.orderNotes).toBeNull();
    });

    it('should reject order notes exceeding max length (2000 chars)', async () => {
      const longNotes = 'A'.repeat(2001); // 2001 characters

      const response = await request(app)
        .post('/api/stock-transfers')
        .set('Cookie', sessionCookie)
        .send({
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destBranch.id,
          orderNotes: longNotes,
          items: [
            {
              productId: testProduct.id,
              qtyRequested: 10,
            },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error?.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should accept order notes at max length (2000 chars)', async () => {
      const maxLengthNotes = 'A'.repeat(2000); // Exactly 2000 characters

      const response = await request(app)
        .post('/api/stock-transfers')
        .set('Cookie', sessionCookie)
        .send({
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destBranch.id,
          orderNotes: maxLengthNotes,
          items: [
            {
              productId: testProduct.id,
              qtyRequested: 10,
            },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.orderNotes).toBe(maxLengthNotes);
    });
  });

  describe('GET /api/stock-transfers - Filter by Expected Delivery Date', () => {
    beforeEach(async () => {
      // Create transfers with different delivery dates
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nextMonth = new Date(today);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      // Transfer 1: Tomorrow
      await request(app)
        .post('/api/stock-transfers')
        .set('Cookie', sessionCookie)
        .send({
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destBranch.id,
          expectedDeliveryDate: tomorrow.toISOString(),
          orderNotes: 'Delivery tomorrow',
          items: [{ productId: testProduct.id, qtyRequested: 10 }],
        });

      // Transfer 2: Next week
      await request(app)
        .post('/api/stock-transfers')
        .set('Cookie', sessionCookie)
        .send({
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destBranch.id,
          expectedDeliveryDate: nextWeek.toISOString(),
          orderNotes: 'Delivery next week',
          items: [{ productId: testProduct.id, qtyRequested: 20 }],
        });

      // Transfer 3: Next month
      await request(app)
        .post('/api/stock-transfers')
        .set('Cookie', sessionCookie)
        .send({
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destBranch.id,
          expectedDeliveryDate: nextMonth.toISOString(),
          orderNotes: 'Delivery next month',
          items: [{ productId: testProduct.id, qtyRequested: 30 }],
        });

      // Transfer 4: No expected delivery date
      await request(app)
        .post('/api/stock-transfers')
        .set('Cookie', sessionCookie)
        .send({
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destBranch.id,
          orderNotes: 'No specific delivery date',
          items: [{ productId: testProduct.id, qtyRequested: 5 }],
        });
    });

    it('should filter transfers by expected delivery date range', async () => {
      const today = new Date();
      const twoDaysFromNow = new Date(today);
      twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
      const tenDaysFromNow = new Date(today);
      tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);

      const response = await request(app)
        .get('/api/stock-transfers')
        .set('Cookie', sessionCookie)
        .query({
          expectedDeliveryDateFrom: twoDaysFromNow.toISOString().split('T')[0],
          expectedDeliveryDateTo: tenDaysFromNow.toISOString().split('T')[0],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items.length).toBeGreaterThan(0);

      // Should include transfer with delivery next week
      const hasNextWeekTransfer = response.body.data.items.some(
        (t: any) => t.orderNotes === 'Delivery next week'
      );
      expect(hasNextWeekTransfer).toBe(true);

      // Should NOT include transfer with delivery tomorrow
      const hasTomorrowTransfer = response.body.data.items.some(
        (t: any) => t.orderNotes === 'Delivery tomorrow'
      );
      expect(hasTomorrowTransfer).toBe(false);

      // Should NOT include transfer with delivery next month
      const hasNextMonthTransfer = response.body.data.items.some(
        (t: any) => t.orderNotes === 'Delivery next month'
      );
      expect(hasNextMonthTransfer).toBe(false);
    });

    it('should filter transfers by expected delivery date from (no to date)', async () => {
      const today = new Date();
      const fiveDaysFromNow = new Date(today);
      fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);

      const response = await request(app)
        .get('/api/stock-transfers')
        .set('Cookie', sessionCookie)
        .query({
          expectedDeliveryDateFrom: fiveDaysFromNow.toISOString().split('T')[0],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Should include transfers with delivery next week and next month
      const relevantTransfers = response.body.data.items.filter(
        (t: any) =>
          t.orderNotes === 'Delivery next week' || t.orderNotes === 'Delivery next month'
      );
      expect(relevantTransfers.length).toBeGreaterThan(0);

      // Should NOT include transfer with delivery tomorrow
      const hasTomorrowTransfer = response.body.data.items.some(
        (t: any) => t.orderNotes === 'Delivery tomorrow'
      );
      expect(hasTomorrowTransfer).toBe(false);
    });

    it('should filter transfers by expected delivery date to (no from date)', async () => {
      const today = new Date();
      const fiveDaysFromNow = new Date(today);
      fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);

      const response = await request(app)
        .get('/api/stock-transfers')
        .set('Cookie', sessionCookie)
        .query({
          expectedDeliveryDateTo: fiveDaysFromNow.toISOString().split('T')[0],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Should include transfer with delivery tomorrow
      const hasTomorrowTransfer = response.body.data.items.some(
        (t: any) => t.orderNotes === 'Delivery tomorrow'
      );
      expect(hasTomorrowTransfer).toBe(true);

      // Should NOT include transfer with delivery next month
      const hasNextMonthTransfer = response.body.data.items.some(
        (t: any) => t.orderNotes === 'Delivery next month'
      );
      expect(hasNextMonthTransfer).toBe(false);
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should not allow access to transfers with delivery fields from different tenant', async () => {
      const otherTenant = await createTestTenant();
      const otherBranch = await createTestBranch({
        tenantId: otherTenant.id,
        name: 'Other Tenant Branch',
      });
      const otherProduct = await createTestProduct({
        tenantId: otherTenant.id,
      });

      // Create transfer in other tenant with delivery fields
      const otherTransfer = await prisma.stockTransfer.create({
        data: {
          tenantId: otherTenant.id,
          transferNumber: `TRF-TEST-${Date.now()}`,
          sourceBranchId: otherBranch.id,
          destinationBranchId: otherBranch.id,
          status: 'REQUESTED',
          requestedByUserId: testUser.id,
          expectedDeliveryDate: new Date(),
          orderNotes: 'Should not be visible',
          items: {
            create: [
              {
                productId: otherProduct.id,
                qtyRequested: 10,
              },
            ],
          },
        },
      });

      // Attempt to get other tenant's transfer
      const response = await request(app)
        .get(`/api/stock-transfers/${otherTransfer.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
    });
  });
});
