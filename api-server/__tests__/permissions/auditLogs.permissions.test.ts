// api-server/__tests__/permissions/auditLogs.permissions.test.ts
import request from 'supertest';
import express, { type Express } from 'express';
import { auditLoggerRouter } from '../../src/routes/auditLoggerRouter.js';
import { sessionMiddleware } from '../../src/middleware/sessionMiddleware.js';
import { standardErrorHandler } from '../../src/middleware/errorHandler.js';
import cookieParser from 'cookie-parser';
import {
  createTestUser,
  createTestTenant,
  createTestRoleWithPermissions,
  createTestMembership,
} from '../helpers/factories.js';
import { createSessionCookie } from '../helpers/auth.js';
import { ROLE_DEFS } from '../../src/rbac/catalog.js';
import { prismaClientInstance as prisma } from '../../src/db/prismaClient.js';

describe('[RBAC] Audit Logs Permissions', () => {
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

  // Test audit event
  let testAuditEvent: any;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(sessionMiddleware);
    app.use('/api/audit', auditLoggerRouter);
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

    // Create a test audit event
    testAuditEvent = await prisma.auditEvent.create({
      data: {
        tenantId: testTenant.id,
        entityType: 'PRODUCT',
        entityId: 'test-product-id',
        action: 'CREATE',
        actorUserId: ownerUser.id,
        beforeJson: { test: 'data' },
        afterJson: { test: 'data' },
        diffJson: { test: 'data' },
      },
    });
  });

  // NOTE: The current audit logger router implementation does NOT use requirePermission middleware.
  // It only checks for authentication via requireTenant() helper.
  // According to PRD, these endpoints SHOULD require tenant:manage permission.
  // Tests below reflect CURRENT implementation (authentication-only).
  // TODO: Add requirePermission('tenant:manage') to audit router endpoints.

  describe('GET /api/audit/events - List Audit Events', () => {
    it('OWNER - should allow access (authenticated)', async () => {
      const response = await request(app)
        .get('/api/audit/events')
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeDefined();
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it('ADMIN - should allow access (authenticated)', async () => {
      const response = await request(app)
        .get('/api/audit/events')
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('EDITOR - should allow access (authenticated) [SHOULD BE DENIED]', async () => {
      // NOTE: Current implementation allows any authenticated user
      // PRD expects: EDITOR should be denied (lacks tenant:manage)
      const response = await request(app)
        .get('/api/audit/events')
        .set('Cookie', editorCookie);

      expect(response.status).toBe(200);
      // TODO: When tenant:manage is added, this should be 403
    });

    it('VIEWER - should allow access (authenticated) [SHOULD BE DENIED]', async () => {
      // NOTE: Current implementation allows any authenticated user
      // PRD expects: VIEWER should be denied (lacks tenant:manage)
      const response = await request(app)
        .get('/api/audit/events')
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(200);
      // TODO: When tenant:manage is added, this should be 403
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).get('/api/audit/events');

      expect(response.status).toBe(401);
    });

    it('Cross-tenant access - should return empty results', async () => {
      const otherTenant = await createTestTenant();
      const otherUser = await createTestUser();
      const otherRole = await createTestRoleWithPermissions({
        tenantId: otherTenant.id,
        permissionKeys: ROLE_DEFS.OWNER,
      });
      await createTestMembership({
        userId: otherUser.id,
        tenantId: otherTenant.id,
        roleId: otherRole.id,
      });

      // Create audit event in other tenant
      await prisma.auditEvent.create({
        data: {
          tenantId: otherTenant.id,
          entityType: 'PRODUCT',
          entityId: 'other-product-id',
          action: 'CREATE',
          actorUserId: otherUser.id,
          beforeJson: { test: 'other' },
          afterJson: { test: 'other' },
          diffJson: { test: 'other' },
        },
      });

      const response = await request(app)
        .get('/api/audit/events')
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.items).toBeDefined();
      // Should only see events from current tenant
      const otherTenantEvents = response.body.data.items.filter(
        (e: any) => e.entityId === 'other-product-id'
      );
      expect(otherTenantEvents.length).toBe(0);
    });

    it('Query filters - entityType filter', async () => {
      const response = await request(app)
        .get('/api/audit/events?entityType=PRODUCT')
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.items.every((e: any) => e.entityType === 'PRODUCT')).toBe(true);
    });

    it('Query filters - action filter', async () => {
      const response = await request(app)
        .get('/api/audit/events?action=CREATE')
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.items.every((e: any) => e.action === 'CREATE')).toBe(true);
    });

    it('Query filters - actorUserId filter', async () => {
      const response = await request(app)
        .get(`/api/audit/events?actorUserId=${ownerUser.id}`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.items.every((e: any) => e.actorUserId === ownerUser.id)).toBe(true);
    });
  });

  describe('GET /api/audit/events/:id - Get Audit Event by ID', () => {
    it('OWNER - should allow access (authenticated)', async () => {
      const response = await request(app)
        .get(`/api/audit/events/${testAuditEvent.id}`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(testAuditEvent.id);
    });

    it('ADMIN - should allow access (authenticated)', async () => {
      const response = await request(app)
        .get(`/api/audit/events/${testAuditEvent.id}`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
    });

    it('EDITOR - should allow access (authenticated) [SHOULD BE DENIED]', async () => {
      // NOTE: Current implementation allows any authenticated user
      const response = await request(app)
        .get(`/api/audit/events/${testAuditEvent.id}`)
        .set('Cookie', editorCookie);

      expect(response.status).toBe(200);
      // TODO: When tenant:manage is added, this should be 403
    });

    it('VIEWER - should allow access (authenticated) [SHOULD BE DENIED]', async () => {
      // NOTE: Current implementation allows any authenticated user
      const response = await request(app)
        .get(`/api/audit/events/${testAuditEvent.id}`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(200);
      // TODO: When tenant:manage is added, this should be 403
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).get(`/api/audit/events/${testAuditEvent.id}`);

      expect(response.status).toBe(401);
    });

    it('Non-existent event - should return 404', async () => {
      const response = await request(app)
        .get('/api/audit/events/non-existent-id')
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(404);
      expect(response.body.error?.errorCode).toBe('RESOURCE_NOT_FOUND');
    });

    it('Cross-tenant access - should return 404', async () => {
      const otherTenant = await createTestTenant();
      const otherUser = await createTestUser();
      const otherRole = await createTestRoleWithPermissions({
        tenantId: otherTenant.id,
        permissionKeys: ROLE_DEFS.OWNER,
      });
      await createTestMembership({
        userId: otherUser.id,
        tenantId: otherTenant.id,
        roleId: otherRole.id,
      });

      // Create audit event in other tenant
      const otherEvent = await prisma.auditEvent.create({
        data: {
          tenantId: otherTenant.id,
          entityType: 'PRODUCT',
          entityId: 'other-product-id',
          action: 'CREATE',
          actorUserId: otherUser.id,
          beforeJson: { test: 'other' },
          afterJson: { test: 'other' },
          diffJson: { test: 'other' },
        },
      });

      const response = await request(app)
        .get(`/api/audit/events/${otherEvent.id}`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/audit/entities/:entityType/:entityId - Get Entity Audit Events', () => {
    it('OWNER - should allow access (authenticated)', async () => {
      const response = await request(app)
        .get('/api/audit/entities/PRODUCT/test-product-id')
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeDefined();
    });

    it('ADMIN - should allow access (authenticated)', async () => {
      const response = await request(app)
        .get('/api/audit/entities/PRODUCT/test-product-id')
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
    });

    it('EDITOR - should allow access (authenticated) [SHOULD BE DENIED]', async () => {
      // NOTE: Current implementation allows any authenticated user
      const response = await request(app)
        .get('/api/audit/entities/PRODUCT/test-product-id')
        .set('Cookie', editorCookie);

      expect(response.status).toBe(200);
      // TODO: When tenant:manage is added, this should be 403
    });

    it('VIEWER - should allow access (authenticated) [SHOULD BE DENIED]', async () => {
      // NOTE: Current implementation allows any authenticated user
      const response = await request(app)
        .get('/api/audit/entities/PRODUCT/test-product-id')
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(200);
      // TODO: When tenant:manage is added, this should be 403
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).get('/api/audit/entities/PRODUCT/test-product-id');

      expect(response.status).toBe(401);
    });

    it('Invalid entityType - should return 400', async () => {
      const response = await request(app)
        .get('/api/audit/entities/INVALID_TYPE/test-id')
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(400);
      expect(response.body.error?.errorCode).toBe('BAD_REQUEST');
    });

    it('Cross-tenant access - should return empty results', async () => {
      const otherTenant = await createTestTenant();
      const otherUser = await createTestUser();
      const otherRole = await createTestRoleWithPermissions({
        tenantId: otherTenant.id,
        permissionKeys: ROLE_DEFS.OWNER,
      });
      await createTestMembership({
        userId: otherUser.id,
        tenantId: otherTenant.id,
        roleId: otherRole.id,
      });

      // Create audit event in other tenant
      await prisma.auditEvent.create({
        data: {
          tenantId: otherTenant.id,
          entityType: 'PRODUCT',
          entityId: 'cross-tenant-product',
          action: 'CREATE',
          actorUserId: otherUser.id,
          beforeJson: { test: 'other' },
          afterJson: { test: 'other' },
          diffJson: { test: 'other' },
        },
      });

      const response = await request(app)
        .get('/api/audit/entities/PRODUCT/cross-tenant-product')
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.items.length).toBe(0);
    });
  });

  // NOTE: Current Implementation Gap
  // ================================
  // The audit logger router does NOT enforce tenant:manage permission.
  // It only checks for authentication (any authenticated user can access).
  //
  // Expected behavior (based on PRD):
  // - OWNER: should allow (has tenant:manage) ✅
  // - ADMIN: should deny (lacks tenant:manage) ❌
  // - EDITOR: should deny (lacks tenant:manage) ❌
  // - VIEWER: should deny (lacks tenant:manage) ❌
  //
  // Current behavior:
  // - All authenticated users: allowed ⚠️
  //
  // TODO: Add requirePermission('tenant:manage') middleware to:
  // - GET /api/audit/events
  // - GET /api/audit/events/:id
  // - GET /api/audit/entities/:entityType/:entityId
  //
  // This would change expected test results:
  // - ADMIN, EDITOR, VIEWER should receive 403 instead of 200
});
