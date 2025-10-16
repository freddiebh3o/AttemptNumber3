// api-server/__tests__/routes/chatRoutes.test.ts
import request from 'supertest';
import express, { type Express } from 'express';
import { chatRouter } from '../../src/routes/chatRouter.js';
import { sessionMiddleware } from '../../src/middleware/sessionMiddleware.js';
import { standardErrorHandler } from '../../src/middleware/errorHandler.js';
import cookieParser from 'cookie-parser';
import * as transferService from '../../src/services/stockTransfers/stockTransferService.js';
import { receiveStock } from '../../src/services/stockService.js';
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

describe('[CHAT-ROUTES-001] POST /api/chat', () => {
  let app: Express;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let sessionCookie: string;
  let sourceBranch: Awaited<ReturnType<typeof createTestBranch>>;
  let destinationBranch: Awaited<ReturnType<typeof createTestBranch>>;
  let product: Awaited<ReturnType<typeof createTestProduct>>;

  beforeAll(async () => {
    // Setup Express app with chat router
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(sessionMiddleware);
    app.use('/api/chat', chatRouter);
    app.use(standardErrorHandler);
  });

  beforeEach(async () => {
    // Create tenant
    testTenant = await createTestTenant();

    // Create user
    testUser = await createTestUser();

    // Create branches
    sourceBranch = await createTestBranch({
      tenantId: testTenant.id,
    });
    destinationBranch = await createTestBranch({
      tenantId: testTenant.id,
    });

    // Create product
    product = await createTestProduct({
      tenantId: testTenant.id,
    });

    // Create role
    const role = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ['stock:read', 'stock:write'],
    });

    // Add user to tenant
    await createTestMembership({
      userId: testUser.id,
      tenantId: testTenant.id,
      roleId: role.id,
    });

    // Add user to branches
    await addUserToBranch(testUser.id, testTenant.id, sourceBranch.id);
    await addUserToBranch(testUser.id, testTenant.id, destinationBranch.id);

    // Add stock
    await receiveStock(
      { currentTenantId: testTenant.id, currentUserId: testUser.id },
      {
        branchId: sourceBranch.id,
        productId: product.id,
        qty: 1000,
        unitCostPence: 1200,
      }
    );

    // Create some transfers for testing
    await transferService.createStockTransfer({
      tenantId: testTenant.id,
      userId: testUser.id,
      data: {
        sourceBranchId: sourceBranch.id,
        destinationBranchId: destinationBranch.id,
        requestNotes: 'Test transfer',
        items: [{ productId: product.id, qtyRequested: 100 }],
      },
    });

    // Create session cookie
    sessionCookie = createSessionCookie(testUser.id, testTenant.id);
  });

  describe('[AC-CHAT-ROUTES-001] Authentication', () => {
    it('should reject request without authentication', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({
          messages: [
            {
              role: 'user',
              parts: [{ type: 'text', text: 'Show me my transfers' }],
            },
          ],
        });

      expect(response.status).toBe(401);
    });

    it('should accept request with valid session', async () => {
      const response = await request(app)
        .post('/api/chat')
        .set('Cookie', sessionCookie)
        .send({
          messages: [
            {
              role: 'user',
              parts: [{ type: 'text', text: 'Show me my transfers' }],
            },
          ],
        });

      // Should not be 401 (authenticated)
      // NOTE: Response might be 200 or stream-related status
      expect(response.status).not.toBe(401);
    });
  });

  describe('[AC-CHAT-ROUTES-002] Request Validation', () => {
    it('should reject request without messages array', async () => {
      const response = await request(app)
        .post('/api/chat')
        .set('Cookie', sessionCookie)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should reject request with non-array messages', async () => {
      const response = await request(app)
        .post('/api/chat')
        .set('Cookie', sessionCookie)
        .send({
          messages: 'not an array',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.errorCode).toBe('VALIDATION_ERROR');
      expect(response.body.error.userFacingMessage).toContain('array');
    });

    it('should accept valid messages array', async () => {
      const response = await request(app)
        .post('/api/chat')
        .set('Cookie', sessionCookie)
        .send({
          messages: [
            {
              role: 'user',
              parts: [{ type: 'text', text: 'Hello' }],
            },
          ],
        });

      // Should not be 400 (validation passed)
      expect(response.status).not.toBe(400);
    });
  });

  describe('[AC-CHAT-ROUTES-003] Streaming Response', () => {
    it('should return streaming response for valid request', async () => {
      const response = await request(app)
        .post('/api/chat')
        .set('Cookie', sessionCookie)
        .send({
          messages: [
            {
              role: 'user',
              parts: [{ type: 'text', text: 'Show me my transfers' }],
            },
          ],
        });

      // Streaming responses typically return 200
      // NOTE: This is a basic check - actual streaming is handled by AI SDK
      expect(response.status).toBe(200);
    });
  });

  describe('[AC-CHAT-ROUTES-004] Error Handling', () => {
    it('should handle errors gracefully', async () => {
      // Send malformed message that might cause internal error
      const response = await request(app)
        .post('/api/chat')
        .set('Cookie', sessionCookie)
        .send({
          messages: [
            {
              role: 'user',
              parts: null, // Invalid parts
            },
          ],
        });

      // Should return error response (not crash)
      expect([400, 500]).toContain(response.status);
    });
  });
});
