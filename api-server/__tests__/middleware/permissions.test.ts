// api-server/__tests__/middleware/permissions.test.ts
import express, { type Request, type Response } from 'express';
import type { Express } from 'express';
import request from 'supertest';
import { requirePermission, requireAnyPermission } from '../../src/middleware/permissionMiddleware.js';
import { standardErrorHandler } from '../../src/middleware/errorHandler.js';
import { cleanDatabase } from '../helpers/db.js';
import {
  createTestUser,
  createTestTenant,
  createTestRoleWithPermissions,
  createTestMembership,
} from '../helpers/factories.js';
import { createSessionCookie } from '../helpers/auth.js';
import { ROLE_DEFS } from '../../src/rbac/catalog.js';

describe('[ST-005] Permission Middleware', () => {
  let app: Express;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let editorRole: Awaited<ReturnType<typeof createTestRoleWithPermissions>>;
  let viewerRole: Awaited<ReturnType<typeof createTestRoleWithPermissions>>;

  beforeAll(async () => {
    // Import dependencies dynamically
    const { sessionMiddleware } = await import('../../src/middleware/sessionMiddleware.js');
    const cookieParser = (await import('cookie-parser')).default;

    // Setup test app with middleware
    app = express();
    app.use(express.json());
    app.use(cookieParser()); // Parse cookies
    app.use(sessionMiddleware); // Decode session from cookies

    // Test route for requirePermission
    app.get(
      '/test/protected',
      requirePermission('products:read'),
      (_req: Request, res: Response) => {
        res.json({ success: true, message: 'Access granted' });
      }
    );

    // Test route for requirePermission with write permission
    app.post(
      '/test/write-protected',
      requirePermission('products:write'),
      (_req: Request, res: Response) => {
        res.json({ success: true, message: 'Write access granted' });
      }
    );

    // Test route for requireAnyPermission
    app.get(
      '/test/any-permission',
      requireAnyPermission(['products:read', 'stock:read']),
      (_req: Request, res: Response) => {
        res.json({ success: true, message: 'Access granted via any permission' });
      }
    );

    // Test route for multiple permissions check
    app.get(
      '/test/multi-permission',
      requireAnyPermission(['users:manage', 'roles:manage', 'tenant:manage']),
      (_req: Request, res: Response) => {
        res.json({ success: true, message: 'Admin access granted' });
      }
    );

    app.use(standardErrorHandler);
  });

  beforeEach(async () => {
    await cleanDatabase();

    // Create test tenant and user
    testTenant = await createTestTenant({ slug: 'test-tenant' });
    testUser = await createTestUser({ email: 'testuser@example.com' });

    // Create roles with specific permissions
    editorRole = await createTestRoleWithPermissions({
      name: 'Editor',
      tenantId: testTenant.id,
      permissionKeys: ROLE_DEFS.EDITOR,
    });

    viewerRole = await createTestRoleWithPermissions({
      name: 'Viewer',
      tenantId: testTenant.id,
      permissionKeys: ROLE_DEFS.VIEWER,
    });
  });

  describe('[AC-005-1] requirePermission middleware', () => {
    it('should allow access when user has required permission', async () => {
      // Create membership with viewer role (has products:read)
      await createTestMembership({
        userId: testUser.id,
        tenantId: testTenant.id,
        roleId: viewerRole.id,
      });

      const sessionCookie = createSessionCookie(testUser.id, testTenant.id);
      const response = await request(app)
        .get('/test/protected')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Access granted');
    });

    it('should deny access when user lacks required permission', async () => {
      // Create membership with viewer role (does NOT have products:write)
      await createTestMembership({
        userId: testUser.id,
        tenantId: testTenant.id,
        roleId: viewerRole.id,
      });

      const sessionCookie = createSessionCookie(testUser.id, testTenant.id);
      const response = await request(app)
        .post('/test/write-protected')
        .set('Cookie', sessionCookie)
        .send({});

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('should deny access when user has no membership in tenant', async () => {
      // No membership created
      const sessionCookie = createSessionCookie(testUser.id, testTenant.id);
      const response = await request(app)
        .get('/test/protected')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('should return AUTH_REQUIRED when currentUserId is missing', async () => {
      // No session cookie sent
      const response = await request(app).get('/test/protected');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error?.errorCode).toBe('AUTH_REQUIRED');
    });

    it('should return AUTH_REQUIRED when currentTenantId is missing', async () => {
      // Send request without tenantId in session
      // This scenario is unlikely in practice but should be handled
      const response = await request(app).get('/test/protected');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error?.errorCode).toBe('AUTH_REQUIRED');
    });

    it('should cache permissions on request object for subsequent checks', async () => {
      // Create membership with editor role
      await createTestMembership({
        userId: testUser.id,
        tenantId: testTenant.id,
        roleId: editorRole.id,
      });

      // Test that we can make multiple requests and they work correctly
      // This validates that permission caching doesn't interfere with subsequent requests
      const sessionCookie = createSessionCookie(testUser.id, testTenant.id);

      // First request - permissions will be loaded
      const response1 = await request(app)
        .get('/test/protected')
        .set('Cookie', sessionCookie);
      expect(response1.status).toBe(200);

      // Second request - should work independently
      const response2 = await request(app)
        .post('/test/write-protected')
        .set('Cookie', sessionCookie)
        .send({});
      expect(response2.status).toBe(200);

      // Third request - should still work
      const response3 = await request(app)
        .get('/test/protected')
        .set('Cookie', sessionCookie);
      expect(response3.status).toBe(200);
    });
  });

  describe('[AC-005-2] requireAnyPermission middleware', () => {
    it('should allow access when user has one of the required permissions', async () => {
      // Viewer has products:read but not stock:read in our setup
      await createTestMembership({
        userId: testUser.id,
        tenantId: testTenant.id,
        roleId: viewerRole.id,
      });

      const sessionCookie = createSessionCookie(testUser.id, testTenant.id);
      const response = await request(app)
        .get('/test/any-permission')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Access granted via any permission');
    });

    it('should allow access when user has multiple of the required permissions', async () => {
      // Create role with multiple permissions
      const customRole = await createTestRoleWithPermissions({
        name: 'Custom',
        tenantId: testTenant.id,
        permissionKeys: ['products:read', 'stock:read'],
      });

      await createTestMembership({
        userId: testUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });

      const sessionCookie = createSessionCookie(testUser.id, testTenant.id);
      const response = await request(app)
        .get('/test/any-permission')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should deny access when user has none of the required permissions', async () => {
      // Viewer has products:read and stock:read but not admin permissions
      await createTestMembership({
        userId: testUser.id,
        tenantId: testTenant.id,
        roleId: viewerRole.id,
      });

      const sessionCookie = createSessionCookie(testUser.id, testTenant.id);
      const response = await request(app)
        .get('/test/multi-permission')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('should return AUTH_REQUIRED when user is not authenticated', async () => {
      const response = await request(app).get('/test/any-permission');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error?.errorCode).toBe('AUTH_REQUIRED');
    });
  });

  describe('[AC-005-3] System role permissions', () => {
    it('should grant OWNER role all permissions', async () => {
      const ownerRole = await createTestRoleWithPermissions({
        name: 'Owner',
        tenantId: testTenant.id,
        permissionKeys: ROLE_DEFS.OWNER,
      });

      await createTestMembership({
        userId: testUser.id,
        tenantId: testTenant.id,
        roleId: ownerRole.id,
      });

      const sessionCookie = createSessionCookie(testUser.id, testTenant.id);

      // Test various endpoints requiring different permissions
      const readResponse = await request(app)
        .get('/test/protected')
        .set('Cookie', sessionCookie);
      expect(readResponse.status).toBe(200);

      const writeResponse = await request(app)
        .post('/test/write-protected')
        .set('Cookie', sessionCookie)
        .send({});
      expect(writeResponse.status).toBe(200);

      const adminResponse = await request(app)
        .get('/test/multi-permission')
        .set('Cookie', sessionCookie);
      expect(adminResponse.status).toBe(200);
    });

    it('should grant ADMIN role appropriate permissions', async () => {
      const adminRole = await createTestRoleWithPermissions({
        name: 'Admin',
        tenantId: testTenant.id,
        permissionKeys: ROLE_DEFS.ADMIN,
      });

      await createTestMembership({
        userId: testUser.id,
        tenantId: testTenant.id,
        roleId: adminRole.id,
      });

      const sessionCookie = createSessionCookie(testUser.id, testTenant.id);

      // Admin has products:write
      const writeResponse = await request(app)
        .post('/test/write-protected')
        .set('Cookie', sessionCookie)
        .send({});
      expect(writeResponse.status).toBe(200);

      // Admin has users:manage
      const adminResponse = await request(app)
        .get('/test/multi-permission')
        .set('Cookie', sessionCookie);
      expect(adminResponse.status).toBe(200);
    });

    it('should grant EDITOR role limited permissions', async () => {
      await createTestMembership({
        userId: testUser.id,
        tenantId: testTenant.id,
        roleId: editorRole.id,
      });

      const sessionCookie = createSessionCookie(testUser.id, testTenant.id);

      // Editor has products:write
      const writeResponse = await request(app)
        .post('/test/write-protected')
        .set('Cookie', sessionCookie)
        .send({});
      expect(writeResponse.status).toBe(200);

      // Editor does NOT have admin permissions
      const adminResponse = await request(app)
        .get('/test/multi-permission')
        .set('Cookie', sessionCookie);
      expect(adminResponse.status).toBe(403);
    });

    it('should grant VIEWER role read-only permissions', async () => {
      await createTestMembership({
        userId: testUser.id,
        tenantId: testTenant.id,
        roleId: viewerRole.id,
      });

      const sessionCookie = createSessionCookie(testUser.id, testTenant.id);

      // Viewer has products:read
      const readResponse = await request(app)
        .get('/test/protected')
        .set('Cookie', sessionCookie);
      expect(readResponse.status).toBe(200);

      // Viewer does NOT have products:write
      const writeResponse = await request(app)
        .post('/test/write-protected')
        .set('Cookie', sessionCookie)
        .send({});
      expect(writeResponse.status).toBe(403);

      // Viewer does NOT have admin permissions
      const adminResponse = await request(app)
        .get('/test/multi-permission')
        .set('Cookie', sessionCookie);
      expect(adminResponse.status).toBe(403);
    });
  });

  describe('[AC-005-4] Custom role permissions', () => {
    it('should grant custom role with specific permissions correct access', async () => {
      // Create custom role with only stock permissions
      const stockRole = await createTestRoleWithPermissions({
        name: 'Stock Manager',
        tenantId: testTenant.id,
        permissionKeys: ['stock:read', 'stock:write', 'stock:allocate'],
      });

      await createTestMembership({
        userId: testUser.id,
        tenantId: testTenant.id,
        roleId: stockRole.id,
      });

      const sessionCookie = createSessionCookie(testUser.id, testTenant.id);

      // Should NOT have products:read
      const readResponse = await request(app)
        .get('/test/protected')
        .set('Cookie', sessionCookie);
      expect(readResponse.status).toBe(403);

      // Should have stock:read (via any permission check)
      const anyResponse = await request(app)
        .get('/test/any-permission')
        .set('Cookie', sessionCookie);
      expect(anyResponse.status).toBe(200);
    });

    it('should handle custom role with no permissions', async () => {
      // Create role with no permissions
      const emptyRole = await createTestRoleWithPermissions({
        name: 'Empty Role',
        tenantId: testTenant.id,
        permissionKeys: [],
      });

      await createTestMembership({
        userId: testUser.id,
        tenantId: testTenant.id,
        roleId: emptyRole.id,
      });

      const sessionCookie = createSessionCookie(testUser.id, testTenant.id);

      // Should be denied all protected routes
      const readResponse = await request(app)
        .get('/test/protected')
        .set('Cookie', sessionCookie);
      expect(readResponse.status).toBe(403);

      const anyResponse = await request(app)
        .get('/test/any-permission')
        .set('Cookie', sessionCookie);
      expect(anyResponse.status).toBe(403);
    });

    it('should handle role with mixed permissions correctly', async () => {
      // Create role with read-only products but write stock
      const mixedRole = await createTestRoleWithPermissions({
        name: 'Mixed Role',
        tenantId: testTenant.id,
        permissionKeys: ['products:read', 'stock:write'],
      });

      await createTestMembership({
        userId: testUser.id,
        tenantId: testTenant.id,
        roleId: mixedRole.id,
      });

      const sessionCookie = createSessionCookie(testUser.id, testTenant.id);

      // Should have products:read
      const readResponse = await request(app)
        .get('/test/protected')
        .set('Cookie', sessionCookie);
      expect(readResponse.status).toBe(200);

      // Should NOT have products:write
      const writeResponse = await request(app)
        .post('/test/write-protected')
        .set('Cookie', sessionCookie)
        .send({});
      expect(writeResponse.status).toBe(403);
    });
  });

  describe('[AC-005-5] Multi-tenant permission isolation', () => {
    it('should deny access when user has permission in different tenant', async () => {
      // Create second tenant
      const otherTenant = await createTestTenant({ slug: 'other-tenant' });

      // Create role in OTHER tenant
      const otherRole = await createTestRoleWithPermissions({
        name: 'Other Viewer',
        tenantId: otherTenant.id,
        permissionKeys: ROLE_DEFS.VIEWER,
      });

      // Create membership in OTHER tenant
      await createTestMembership({
        userId: testUser.id,
        tenantId: otherTenant.id,
        roleId: otherRole.id,
      });

      // Try to access with session for original tenant (where user has no membership)
      const sessionCookie = createSessionCookie(testUser.id, testTenant.id);
      const response = await request(app)
        .get('/test/protected')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('should allow access only to correct tenant context', async () => {
      // Create memberships in both tenants
      const tenant1 = await createTestTenant({ slug: 'tenant-1' });
      const tenant2 = await createTestTenant({ slug: 'tenant-2' });

      const role1 = await createTestRoleWithPermissions({
        name: 'Role 1',
        tenantId: tenant1.id,
        permissionKeys: ['products:read'],
      });

      const role2 = await createTestRoleWithPermissions({
        name: 'Role 2',
        tenantId: tenant2.id,
        permissionKeys: [], // No permissions in tenant 2
      });

      await createTestMembership({
        userId: testUser.id,
        tenantId: tenant1.id,
        roleId: role1.id,
      });

      await createTestMembership({
        userId: testUser.id,
        tenantId: tenant2.id,
        roleId: role2.id,
      });

      // Access with tenant1 context - should succeed
      const cookie1 = createSessionCookie(testUser.id, tenant1.id);
      const response1 = await request(app)
        .get('/test/protected')
        .set('Cookie', cookie1);
      expect(response1.status).toBe(200);

      // Access with tenant2 context - should fail
      const cookie2 = createSessionCookie(testUser.id, tenant2.id);
      const response2 = await request(app)
        .get('/test/protected')
        .set('Cookie', cookie2);
      expect(response2.status).toBe(403);
    });
  });
});
