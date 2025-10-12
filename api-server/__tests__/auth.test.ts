// [ST-003][AC-003] Authentication acceptance tests
import request from 'supertest';
import type { Express } from 'express';
import { createConfiguredExpressApplicationInstance } from '../src/app.js';
import {
  setupTestDatabase,
  teardownTestDatabase,
  cleanDatabase,
  prisma,
} from './helpers/db.js';
import {
  createTestUser,
  createTestTenant,
  createTestRole,
  addUserToTenant,
  getPermissionsByKeys,
} from './helpers/factories.js';
import {
  extractSessionCookie,
  decodeSessionToken,
  createSessionCookie,
} from './helpers/auth.js';
import { TEST_USERS, TEST_TENANTS } from './fixtures/testData.js';

describe('[ST-003] Authentication', () => {
  let app: Express;

  beforeAll(async () => {
    await setupTestDatabase();
    const { expressApplicationInstance } = createConfiguredExpressApplicationInstance();
    app = expressApplicationInstance;
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('[AC-003-1] POST /api/auth/sign-in', () => {
    it('should successfully sign in with valid credentials', async () => {
      // Arrange: Create test user, tenant, and membership
      const user = await createTestUser({
        email: TEST_USERS.admin.email,
        password: TEST_USERS.admin.password,
      });

      const tenant = await createTestTenant({
        name: TEST_TENANTS.acme.name,
        slug: TEST_TENANTS.acme.slug,
      });

      const permissions = await getPermissionsByKeys(['products:read']);
      const role = await createTestRole({
        tenantId: tenant.id,
        permissionIds: permissions.map((p) => p.id),
      });

      await addUserToTenant(user.id, tenant.id, role.id);

      // Act: Sign in
      const response = await request(app)
        .post('/api/auth/sign-in')
        .send({
          email: TEST_USERS.admin.email,
          password: TEST_USERS.admin.password,
          tenantSlug: TEST_TENANTS.acme.slug,
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          isSignedIn: true,
        },
      });

      // Verify session cookie is set
      const sessionToken = extractSessionCookie(response);
      expect(sessionToken).toBeTruthy();

      // Verify token payload
      const decoded = decodeSessionToken(sessionToken!);
      expect(decoded.currentUserId).toBe(user.id);
      expect(decoded.currentTenantId).toBe(tenant.id);
    });

    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/sign-in')
        .send({
          email: 'nonexistent@test.com',
          password: 'somepassword',
          tenantSlug: 'some-tenant',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should return 400 for invalid password', async () => {
      // Arrange
      const user = await createTestUser({
        email: TEST_USERS.admin.email,
        password: TEST_USERS.admin.password,
      });

      const tenant = await createTestTenant({
        slug: TEST_TENANTS.acme.slug,
      });

      const permissions = await getPermissionsByKeys(['products:read']);
      const role = await createTestRole({
        tenantId: tenant.id,
        permissionIds: permissions.map((p) => p.id),
      });

      await addUserToTenant(user.id, tenant.id, role.id);

      // Act: Try to sign in with wrong password
      const response = await request(app)
        .post('/api/auth/sign-in')
        .send({
          email: TEST_USERS.admin.email,
          password: 'wrongpassword123',
          tenantSlug: TEST_TENANTS.acme.slug,
        });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 when user is not a member of the tenant', async () => {
      // Arrange: Create user and tenant but NO membership
      const user = await createTestUser({
        email: TEST_USERS.admin.email,
        password: TEST_USERS.admin.password,
      });

      await createTestTenant({
        slug: TEST_TENANTS.acme.slug,
      });

      // Act: Try to sign in
      const response = await request(app)
        .post('/api/auth/sign-in')
        .send({
          email: TEST_USERS.admin.email,
          password: TEST_USERS.admin.password,
          tenantSlug: TEST_TENANTS.acme.slug,
        });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for missing tenant slug', async () => {
      const response = await request(app)
        .post('/api/auth/sign-in')
        .send({
          email: TEST_USERS.admin.email,
          password: TEST_USERS.admin.password,
          // tenantSlug missing
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for password shorter than 8 characters', async () => {
      const response = await request(app)
        .post('/api/auth/sign-in')
        .send({
          email: TEST_USERS.admin.email,
          password: 'short',
          tenantSlug: TEST_TENANTS.acme.slug,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('[AC-003-2] POST /api/auth/sign-out', () => {
    it('should clear session cookie', async () => {
      // Arrange: Create a valid session
      const user = await createTestUser();
      const tenant = await createTestTenant();
      const permissions = await getPermissionsByKeys(['products:read']);
      const role = await createTestRole({
        tenantId: tenant.id,
        permissionIds: permissions.map((p) => p.id),
      });
      await addUserToTenant(user.id, tenant.id, role.id);

      // Act: Sign out with valid session cookie
      const sessionCookie = createSessionCookie(user.id, tenant.id);
      const response = await request(app)
        .post('/api/auth/sign-out')
        .set('Cookie', sessionCookie);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          isSignedIn: false,
        },
      });

      // Verify cookie is cleared (Set-Cookie header with Max-Age=0 or expires in past)
      const setCookie = response.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      if (setCookie) {
        const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
        expect(cookieStr).toMatch(/Max-Age=0|expires=/i);
      }
    });

    it('should succeed even without a session cookie', async () => {
      // Act: Sign out without session
      const response = await request(app).post('/api/auth/sign-out');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          isSignedIn: false,
        },
      });
    });
  });

  describe('[AC-003-3] GET /api/auth/me', () => {
    it('should return current user info for authenticated user', async () => {
      // Arrange
      const user = await createTestUser({
        email: TEST_USERS.admin.email,
      });

      const tenant = await createTestTenant({
        slug: TEST_TENANTS.acme.slug,
      });

      const permissions = await getPermissionsByKeys([
        'products:read',
        'products:write',
      ]);
      const role = await createTestRole({
        name: 'Admin',
        tenantId: tenant.id,
        permissionIds: permissions.map((p) => p.id),
      });

      await addUserToTenant(user.id, tenant.id, role.id);

      // Act: Get /me with valid session
      const sessionCookie = createSessionCookie(user.id, tenant.id);
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', sessionCookie);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        user: {
          id: user.id,
          userEmailAddress: TEST_USERS.admin.email,
        },
        currentTenant: {
          tenantId: tenant.id,
          tenantSlug: TEST_TENANTS.acme.slug,
          role: {
            name: 'Admin',
            tenantId: tenant.id,
          },
        },
        permissionsCurrentTenant: expect.arrayContaining([
          'products:read',
          'products:write',
        ]),
      });
    });

    it('should return 401 for unauthenticated request', async () => {
      // Act: Request without session cookie
      const response = await request(app).get('/api/auth/me');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatchObject({
        errorCode: 'AUTH_REQUIRED',
      });
    });

    it('should return 401 for invalid session token', async () => {
      // Act: Request with malformed token
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', 'mt_session=invalid-token');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('[AC-003-4] POST /api/auth/switch-tenant', () => {
    it('should switch to another tenant where user is a member', async () => {
      // Arrange: User is member of two tenants
      const user = await createTestUser();

      const tenant1 = await createTestTenant({
        slug: 'tenant-one',
      });
      const tenant2 = await createTestTenant({
        slug: 'tenant-two',
      });

      const permissions = await getPermissionsByKeys(['products:read']);

      const role1 = await createTestRole({
        tenantId: tenant1.id,
        permissionIds: permissions.map((p) => p.id),
      });
      const role2 = await createTestRole({
        tenantId: tenant2.id,
        permissionIds: permissions.map((p) => p.id),
      });

      await addUserToTenant(user.id, tenant1.id, role1.id);
      await addUserToTenant(user.id, tenant2.id, role2.id);

      // Act: Switch from tenant1 to tenant2
      const sessionCookie = createSessionCookie(user.id, tenant1.id);
      const response = await request(app)
        .post('/api/auth/switch-tenant')
        .set('Cookie', sessionCookie)
        .send({
          tenantSlug: 'tenant-two',
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          hasSwitchedTenant: true,
        },
      });

      // Verify new session cookie points to tenant2
      const newToken = extractSessionCookie(response);
      expect(newToken).toBeTruthy();
      const decoded = decodeSessionToken(newToken!);
      expect(decoded.currentTenantId).toBe(tenant2.id);
    });

    it('should return 403 when user is not a member of target tenant', async () => {
      // Arrange: User is only member of tenant1
      const user = await createTestUser();
      const tenant1 = await createTestTenant({ slug: 'tenant-one' });
      const tenant2 = await createTestTenant({ slug: 'tenant-two' });

      const permissions = await getPermissionsByKeys(['products:read']);
      const role1 = await createTestRole({
        tenantId: tenant1.id,
        permissionIds: permissions.map((p) => p.id),
      });

      await addUserToTenant(user.id, tenant1.id, role1.id);
      // Note: User is NOT a member of tenant2

      // Act: Try to switch to tenant2
      const sessionCookie = createSessionCookie(user.id, tenant1.id);
      const response = await request(app)
        .post('/api/auth/switch-tenant')
        .set('Cookie', sessionCookie)
        .send({
          tenantSlug: 'tenant-two',
        });

      // Assert
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatchObject({
        errorCode: 'PERMISSION_DENIED',
      });
    });

    it('should return 404 when target tenant does not exist', async () => {
      // Arrange
      const user = await createTestUser();
      const tenant = await createTestTenant();
      const permissions = await getPermissionsByKeys(['products:read']);
      const role = await createTestRole({
        tenantId: tenant.id,
        permissionIds: permissions.map((p) => p.id),
      });
      await addUserToTenant(user.id, tenant.id, role.id);

      // Act: Try to switch to non-existent tenant
      const sessionCookie = createSessionCookie(user.id, tenant.id);
      const response = await request(app)
        .post('/api/auth/switch-tenant')
        .set('Cookie', sessionCookie)
        .send({
          tenantSlug: 'non-existent-tenant',
        });

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      // Act: Try to switch tenant without session
      const response = await request(app)
        .post('/api/auth/switch-tenant')
        .send({
          tenantSlug: 'some-tenant',
        });

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
