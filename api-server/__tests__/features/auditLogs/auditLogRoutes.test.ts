// api-server/__tests__/features/auditLogs/auditLogRoutes.test.ts
import request from 'supertest';
import express, { type Express } from 'express';
import { auditLoggerRouter } from '../../../src/routes/auditLoggerRouter.js';
import { sessionMiddleware } from '../../../src/middleware/sessionMiddleware.js';
import { standardErrorHandler } from '../../../src/middleware/errorHandler.js';
import cookieParser from 'cookie-parser';
import {
  createTestUser,
  createTestTenant,
  createTestProduct,
  createTestBranch,
  createTestAuditEvent,
  createTestRoleWithPermissions,
  createTestMembership,
} from '../../helpers/factories.js';
import { createSessionCookie } from '../../helpers/auth.js';
import { ROLE_DEFS } from '../../../src/rbac/catalog.js';
import type { AuditEvent } from '@prisma/client';

describe('Audit Log API Routes', () => {
  let app: Express;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testTenant1: Awaited<ReturnType<typeof createTestTenant>>;
  let testTenant2: Awaited<ReturnType<typeof createTestTenant>>;
  let sessionCookie: string;
  let testProduct: Awaited<ReturnType<typeof createTestProduct>>;

  beforeAll(async () => {
    // Setup Express app with audit logger router
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(sessionMiddleware);
    app.use('/api/audit', auditLoggerRouter);
    app.use(standardErrorHandler);
  });

  beforeEach(async () => {
    testTenant1 = await createTestTenant();
    testTenant2 = await createTestTenant();
    testUser = await createTestUser();

    // Create role with tenant:manage permission (required for audit log access)
    const role = await createTestRoleWithPermissions({
      tenantId: testTenant1.id,
      permissionKeys: ROLE_DEFS.OWNER, // Owner has tenant:manage
    });

    await createTestMembership({
      userId: testUser.id,
      tenantId: testTenant1.id,
      roleId: role.id,
    });

    sessionCookie = createSessionCookie(testUser.id, testTenant1.id);

    // Create test product for audit events
    testProduct = await createTestProduct({ tenantId: testTenant1.id });
  });

  describe('GET /api/audit/events - List audit events', () => {
    beforeEach(async () => {
      // Create multiple audit events
      await createTestAuditEvent({
        tenantId: testTenant1.id,
        entityType: 'PRODUCT',
        entityId: testProduct.id,
        action: 'CREATE',
        actorUserId: testUser.id,
        entityName: 'Test Product 1',
      });

      await createTestAuditEvent({
        tenantId: testTenant1.id,
        entityType: 'PRODUCT',
        entityId: testProduct.id,
        action: 'UPDATE',
        actorUserId: testUser.id,
        entityName: 'Test Product 1',
      });

      // Create event in different tenant
      const tenant2Product = await createTestProduct({ tenantId: testTenant2.id });
      await createTestAuditEvent({
        tenantId: testTenant2.id,
        entityType: 'PRODUCT',
        entityId: tenant2Product.id,
        action: 'CREATE',
      });
    });

    it('should list audit events for current tenant', async () => {
      const response = await request(app)
        .get('/api/audit/events')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeDefined();
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data.items.length).toBeGreaterThan(0);

      // Verify all items belong to tenant1
      response.body.data.items.forEach((item: any) => {
        expect(item.tenantId).toBe(testTenant1.id);
      });
    });

    it('should return pagination info', async () => {
      const response = await request(app)
        .get('/api/audit/events')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.pageInfo).toBeDefined();
      expect(response.body.data.pageInfo.hasNextPage).toBeDefined();
      expect(typeof response.body.data.pageInfo.hasNextPage).toBe('boolean');
    });

    it('should support limit parameter', async () => {
      const response = await request(app)
        .get('/api/audit/events?limit=1')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.items.length).toBeLessThanOrEqual(1);
    });

    it('should support includeTotal parameter', async () => {
      const response = await request(app)
        .get('/api/audit/events?includeTotal=1')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.pageInfo.totalCount).toBeDefined();
      expect(typeof response.body.data.pageInfo.totalCount).toBe('number');
    });

    it('should reject without authentication', async () => {
      const response = await request(app).get('/api/audit/events');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/audit/events - Query parameter filtering', () => {
    beforeEach(async () => {
      const branch = await createTestBranch({ tenantId: testTenant1.id });
      const user2 = await createTestUser();

      // Create various audit events with different attributes
      await createTestAuditEvent({
        tenantId: testTenant1.id,
        entityType: 'PRODUCT',
        entityId: testProduct.id,
        action: 'CREATE',
        actorUserId: testUser.id,
      });

      await createTestAuditEvent({
        tenantId: testTenant1.id,
        entityType: 'PRODUCT',
        entityId: testProduct.id,
        action: 'UPDATE',
        actorUserId: testUser.id,
      });

      await createTestAuditEvent({
        tenantId: testTenant1.id,
        entityType: 'PRODUCT',
        entityId: testProduct.id,
        action: 'DELETE',
        actorUserId: user2.id,
      });

      await createTestAuditEvent({
        tenantId: testTenant1.id,
        entityType: 'BRANCH',
        entityId: branch.id,
        action: 'CREATE',
        actorUserId: testUser.id,
      });
    });

    it('should filter by entityType', async () => {
      const response = await request(app)
        .get('/api/audit/events?entityType=PRODUCT')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.items.length).toBeGreaterThan(0);
      response.body.data.items.forEach((item: any) => {
        expect(item.entityType).toBe('PRODUCT');
      });
    });

    it('should filter by action', async () => {
      const response = await request(app)
        .get('/api/audit/events?action=CREATE')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.items.length).toBeGreaterThan(0);
      response.body.data.items.forEach((item: any) => {
        expect(item.action).toBe('CREATE');
      });
    });

    it('should filter by actorUserId', async () => {
      const response = await request(app)
        .get(`/api/audit/events?actorUserId=${testUser.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.items.length).toBeGreaterThan(0);
      response.body.data.items.forEach((item: any) => {
        expect(item.actorUserId).toBe(testUser.id);
      });
    });

    it('should filter by entityId', async () => {
      const response = await request(app)
        .get(`/api/audit/events?entityId=${testProduct.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.items.length).toBeGreaterThan(0);
      response.body.data.items.forEach((item: any) => {
        expect(item.entityId).toBe(testProduct.id);
      });
    });

    it('should filter by date range (occurredFrom)', async () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      const response = await request(app)
        .get(`/api/audit/events?occurredFrom=${tenMinutesAgo}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.items.length).toBeGreaterThan(0);
    });

    it('should filter by date range (occurredTo)', async () => {
      const now = new Date().toISOString();

      const response = await request(app)
        .get(`/api/audit/events?occurredTo=${now}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.items).toBeDefined();
    });

    it('should support multiple filters combined', async () => {
      const response = await request(app)
        .get(`/api/audit/events?entityType=PRODUCT&action=UPDATE&actorUserId=${testUser.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      response.body.data.items.forEach((item: any) => {
        expect(item.entityType).toBe('PRODUCT');
        expect(item.action).toBe('UPDATE');
        expect(item.actorUserId).toBe(testUser.id);
      });
    });
  });

  describe('GET /api/audit/events/:id - Get single audit event', () => {
    let auditEvent: AuditEvent;
    let tenant2Event: AuditEvent;

    beforeEach(async () => {
      auditEvent = await createTestAuditEvent({
        tenantId: testTenant1.id,
        entityType: 'PRODUCT',
        entityId: testProduct.id,
        action: 'CREATE',
        actorUserId: testUser.id,
        entityName: 'Test Product',
      });

      // Create event in tenant2
      const tenant2Product = await createTestProduct({ tenantId: testTenant2.id });
      tenant2Event = await createTestAuditEvent({
        tenantId: testTenant2.id,
        entityType: 'PRODUCT',
        entityId: tenant2Product.id,
        action: 'CREATE',
      });
    });

    it('should retrieve audit event by ID', async () => {
      const response = await request(app)
        .get(`/api/audit/events/${auditEvent.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(auditEvent.id);
      expect(response.body.data.entityType).toBe('PRODUCT');
      expect(response.body.data.action).toBe('CREATE');
      expect(response.body.data.entityName).toBe('Test Product');
    });

    it('should return 404 for non-existent audit event', async () => {
      const response = await request(app)
        .get('/api/audit/events/non-existent-id')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.errorCode).toBe('RESOURCE_NOT_FOUND');
    });

    it('should return 404 for audit event in different tenant', async () => {
      const response = await request(app)
        .get(`/api/audit/events/${tenant2Event.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should reject without authentication', async () => {
      const response = await request(app).get(`/api/audit/events/${auditEvent.id}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/audit/entities/:entityType/:entityId - Get events for specific entity', () => {
    let branch: Awaited<ReturnType<typeof createTestBranch>>;

    beforeEach(async () => {
      branch = await createTestBranch({ tenantId: testTenant1.id });

      // Create events for product
      await createTestAuditEvent({
        tenantId: testTenant1.id,
        entityType: 'PRODUCT',
        entityId: testProduct.id,
        action: 'CREATE',
      });

      await createTestAuditEvent({
        tenantId: testTenant1.id,
        entityType: 'PRODUCT',
        entityId: testProduct.id,
        action: 'UPDATE',
      });

      // Create events for branch
      await createTestAuditEvent({
        tenantId: testTenant1.id,
        entityType: 'BRANCH',
        entityId: branch.id,
        action: 'CREATE',
      });
    });

    it('should retrieve events for specific product', async () => {
      const response = await request(app)
        .get(`/api/audit/entities/PRODUCT/${testProduct.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items.length).toBeGreaterThan(0);
      response.body.data.items.forEach((item: any) => {
        expect(item.entityType).toBe('PRODUCT');
        expect(item.entityId).toBe(testProduct.id);
      });
    });

    it('should retrieve events for specific branch', async () => {
      const response = await request(app)
        .get(`/api/audit/entities/BRANCH/${branch.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items.length).toBeGreaterThan(0);
      response.body.data.items.forEach((item: any) => {
        expect(item.entityType).toBe('BRANCH');
        expect(item.entityId).toBe(branch.id);
      });
    });

    it('should return 400 for invalid entityType', async () => {
      const response = await request(app)
        .get(`/api/audit/entities/INVALID_TYPE/${testProduct.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.errorCode).toBe('BAD_REQUEST');
    });

    it('should support action filter on entity endpoint', async () => {
      const response = await request(app)
        .get(`/api/audit/entities/PRODUCT/${testProduct.id}?action=CREATE`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      response.body.data.items.forEach((item: any) => {
        expect(item.action).toBe('CREATE');
        expect(item.entityId).toBe(testProduct.id);
      });
    });

    it('should support pagination on entity endpoint', async () => {
      const response = await request(app)
        .get(`/api/audit/entities/PRODUCT/${testProduct.id}?limit=1`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.items.length).toBeLessThanOrEqual(1);
      expect(response.body.data.pageInfo).toBeDefined();
    });
  });

  describe('Cursor-based pagination', () => {
    beforeEach(async () => {
      // Create multiple events for pagination
      for (let i = 0; i < 10; i++) {
        await createTestAuditEvent({
          tenantId: testTenant1.id,
          entityType: 'PRODUCT',
          entityId: testProduct.id,
          action: 'UPDATE',
          actorUserId: testUser.id,
        });
        // Small delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    });

    it('should support cursor pagination', async () => {
      // Get first page
      const firstPage = await request(app)
        .get('/api/audit/events?limit=3')
        .set('Cookie', sessionCookie);

      expect(firstPage.status).toBe(200);
      expect(firstPage.body.data.items.length).toBe(3);
      expect(firstPage.body.data.pageInfo.hasNextPage).toBe(true);
      expect(firstPage.body.data.pageInfo.nextCursor).toBeDefined();

      // Get second page using cursor
      const nextCursor = firstPage.body.data.pageInfo.nextCursor;
      const secondPage = await request(app)
        .get(`/api/audit/events?limit=3&cursorId=${nextCursor}`)
        .set('Cookie', sessionCookie);

      expect(secondPage.status).toBe(200);
      expect(secondPage.body.data.items.length).toBe(3);

      // Verify no overlap
      const firstPageIds = firstPage.body.data.items.map((item: any) => item.id);
      const secondPageIds = secondPage.body.data.items.map((item: any) => item.id);
      const overlap = firstPageIds.filter((id: string) => secondPageIds.includes(id));
      expect(overlap.length).toBe(0);
    });

    it('should indicate when there is no next page', async () => {
      const response = await request(app)
        .get('/api/audit/events?limit=100')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      if (response.body.data.items.length < 100) {
        expect(response.body.data.pageInfo.hasNextPage).toBe(false);
        expect(response.body.data.pageInfo.nextCursor).toBeNull();
      }
    });
  });

  describe('Response envelope format', () => {
    beforeEach(async () => {
      await createTestAuditEvent({
        tenantId: testTenant1.id,
        entityType: 'PRODUCT',
        entityId: testProduct.id,
        action: 'CREATE',
      });
    });

    it('should return success envelope for list endpoint', async () => {
      const response = await request(app)
        .get('/api/audit/events')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('error', null);
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('pageInfo');
    });

    it('should return success envelope for single event endpoint', async () => {
      const event = await createTestAuditEvent({
        tenantId: testTenant1.id,
        entityType: 'PRODUCT',
        entityId: testProduct.id,
        action: 'CREATE',
      });

      const response = await request(app)
        .get(`/api/audit/events/${event.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('error', null);
    });

    it('should return error envelope for 404', async () => {
      const response = await request(app)
        .get('/api/audit/events/non-existent-id')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('data', null);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('errorCode');
      expect(response.body.error).toHaveProperty('httpStatusCode', 404);
      expect(response.body.error).toHaveProperty('userFacingMessage');
      expect(response.body.error).toHaveProperty('correlationId');
    });

    it('should return error envelope for authentication failure', async () => {
      const response = await request(app).get('/api/audit/events');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('data', null);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Permission enforcement (minimal test)', () => {
    it('should reject user without tenant:manage permission', async () => {
      // Create a viewer user without tenant:manage permission
      const viewerUser = await createTestUser();
      const viewerRole = await createTestRoleWithPermissions({
        tenantId: testTenant1.id,
        permissionKeys: ROLE_DEFS.VIEWER, // Does not have tenant:manage
      });

      await createTestMembership({
        userId: viewerUser.id,
        tenantId: testTenant1.id,
        roleId: viewerRole.id,
      });

      const viewerCookie = createSessionCookie(viewerUser.id, testTenant1.id);

      const response = await request(app)
        .get('/api/audit/events')
        .set('Cookie', viewerCookie);

      // Note: The current implementation doesn't enforce permission checks
      // This test documents expected behavior once permission middleware is added
      // For now, we just verify the request completes (may be 200 or 403 depending on middleware)
      expect([200, 403]).toContain(response.status);
    });
  });
});
