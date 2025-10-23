/**
 * Tests for Tenant Feature Flags API Routes
 * Tests GET and PUT /api/tenants/:tenantSlug/feature-flags
 *
 * UPDATED: Added validation tests for custom API key requirement
 */

import express from 'express';
import type { Express } from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import { sessionMiddleware } from '../../../src/middleware/sessionMiddleware.js';
import { requestIdMiddleware } from '../../../src/middleware/requestIdMiddleware.js';
import { tenantThemeRouter } from '../../../src/routes/tenantThemeRouter.js';
import { standardErrorHandler } from '../../../src/middleware/errorHandler.js';
import {
  createTestTenant,
  createTestUser,
  createTestRoleWithPermissions,
  createTestMembership,
} from '../../helpers/factories.js';
import { createSessionCookie } from '../../helpers/auth.js';

const prisma = new PrismaClient();

describe('[FEATURE-FLAGS-API] Tenant Feature Flags Routes', () => {
  let app: Express;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let ownerUser: Awaited<ReturnType<typeof createTestUser>>;
  let viewerUser: Awaited<ReturnType<typeof createTestUser>>;
  let ownerCookie: string;
  let viewerCookie: string;

  beforeAll(async () => {
    // Setup Express app with middleware
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(requestIdMiddleware); // Required for idempotency
    app.use(sessionMiddleware);
    app.use('/api/tenants', tenantThemeRouter);
    app.use(standardErrorHandler);

    // Create test tenant
    testTenant = await createTestTenant();

    // Create owner user with theme:manage permission
    ownerUser = await createTestUser();
    const ownerRole = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ['theme:manage'],
    });
    await createTestMembership({
      userId: ownerUser.id,
      tenantId: testTenant.id,
      roleId: ownerRole.id,
    });
    ownerCookie = createSessionCookie(ownerUser.id, testTenant.id);

    // Create viewer user without theme:manage permission
    viewerUser = await createTestUser();
    const viewerRole = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: [],
    });
    await createTestMembership({
      userId: viewerUser.id,
      tenantId: testTenant.id,
      roleId: viewerRole.id,
    });
    viewerCookie = createSessionCookie(viewerUser.id, testTenant.id);
  });

  afterAll(async () => {
    // Cleanup
    if (testTenant) {
      await prisma.userTenantMembership.deleteMany({ where: { tenantId: testTenant.id } });
      await prisma.rolePermission.deleteMany({
        where: { role: { tenantId: testTenant.id } },
      });
      await prisma.role.deleteMany({ where: { tenantId: testTenant.id } });
      await prisma.tenant.delete({ where: { id: testTenant.id } });
    }
    if (ownerUser) {
      await prisma.user.delete({ where: { id: ownerUser.id } });
    }
    if (viewerUser) {
      await prisma.user.delete({ where: { id: viewerUser.id } });
    }
    await prisma.$disconnect();
  });

  describe('GET /api/tenants/:tenantSlug/feature-flags', () => {
    test('should return default flags for tenant with no flags set', async () => {
      const response = await request(app)
        .get(`/api/tenants/${testTenant.tenantSlug}/feature-flags`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        chatAssistantEnabled: false,
        openaiApiKey: null,
        barcodeScanningEnabled: false,
      });
    });

    test('should return existing flags when set', async () => {
      // Set flags
      await prisma.tenant.update({
        where: { id: testTenant.id },
        data: {
          featureFlags: {
            chatAssistantEnabled: true,
            openaiApiKey: 'sk-test-key',
            barcodeScanningEnabled: true,
          },
        },
      });

      const response = await request(app)
        .get(`/api/tenants/${testTenant.tenantSlug}/feature-flags`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({
        chatAssistantEnabled: true,
        openaiApiKey: 'sk-test-key',
        barcodeScanningEnabled: true,
      });

      // Reset for other tests
      await prisma.tenant.update({
        where: { id: testTenant.id },
        data: { featureFlags: {} },
      });
    });

    test('should require authentication', async () => {
      const response = await request(app).get(
        `/api/tenants/${testTenant.tenantSlug}/feature-flags`
      );

      expect(response.status).toBe(401);
    });

    test('should require theme:manage permission', async () => {
      const response = await request(app)
        .get(`/api/tenants/${testTenant.tenantSlug}/feature-flags`)
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(403);
    });

    test('should return 404 for non-existent tenant', async () => {
      const response = await request(app)
        .get('/api/tenants/non-existent-slug/feature-flags')
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/tenants/:tenantSlug/feature-flags', () => {
    test('should reject enabling chat assistant without API key (400)', async () => {
      const response = await request(app)
        .put(`/api/tenants/${testTenant.tenantSlug}/feature-flags`)
        .set('Cookie', ownerCookie)
        .send({ chatAssistantEnabled: true });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.userFacingMessage).toContain(
        'Cannot enable AI Chat Assistant without providing an OpenAI API key'
      );
    });

    test('should allow enabling chat assistant with valid key', async () => {
      const response = await request(app)
        .put(`/api/tenants/${testTenant.tenantSlug}/feature-flags`)
        .set('Cookie', ownerCookie)
        .send({
          chatAssistantEnabled: true,
          openaiApiKey: 'sk-new-test-key-12345',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.chatAssistantEnabled).toBe(true);
      expect(response.body.data.openaiApiKey).toBe('sk-new-test-key-12345');

      // Reset for other tests
      await prisma.tenant.update({
        where: { id: testTenant.id },
        data: { featureFlags: {} },
      });
    });

    test('should allow disabling chat assistant without key', async () => {
      // First set chat enabled with key
      await prisma.tenant.update({
        where: { id: testTenant.id },
        data: {
          featureFlags: {
            chatAssistantEnabled: true,
            openaiApiKey: 'sk-existing-key',
          },
        },
      });

      // Now disable without providing key
      const response = await request(app)
        .put(`/api/tenants/${testTenant.tenantSlug}/feature-flags`)
        .set('Cookie', ownerCookie)
        .send({ chatAssistantEnabled: false });

      expect(response.status).toBe(200);
      expect(response.body.data.chatAssistantEnabled).toBe(false);
      expect(response.body.data.openaiApiKey).toBe('sk-existing-key'); // Unchanged
    });

    test('should validate API key format (must start with sk-)', async () => {
      const response = await request(app)
        .put(`/api/tenants/${testTenant.tenantSlug}/feature-flags`)
        .set('Cookie', ownerCookie)
        .send({ openaiApiKey: 'invalid-key-format' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.userFacingMessage).toContain('Invalid OpenAI API key format');
    });

    test('should allow setting API key to null when chat is disabled', async () => {
      // First set a key
      await prisma.tenant.update({
        where: { id: testTenant.id },
        data: {
          featureFlags: {
            chatAssistantEnabled: false,
            openaiApiKey: 'sk-old-key',
          },
        },
      });

      // Now clear it
      const response = await request(app)
        .put(`/api/tenants/${testTenant.tenantSlug}/feature-flags`)
        .set('Cookie', ownerCookie)
        .send({ openaiApiKey: null });

      expect(response.status).toBe(200);
      expect(response.body.data.openaiApiKey).toBeNull();
    });

    test('should update barcode scanning flag', async () => {
      const response = await request(app)
        .put(`/api/tenants/${testTenant.tenantSlug}/feature-flags`)
        .set('Cookie', ownerCookie)
        .send({ barcodeScanningEnabled: true });

      expect(response.status).toBe(200);
      expect(response.body.data.barcodeScanningEnabled).toBe(true);
    });

    test('should support partial updates', async () => {
      // Set initial state
      await prisma.tenant.update({
        where: { id: testTenant.id },
        data: {
          featureFlags: {
            chatAssistantEnabled: true,
            openaiApiKey: 'sk-existing-key',
            barcodeScanningEnabled: true,
          },
        },
      });

      // Update only barcode scanning
      const response = await request(app)
        .put(`/api/tenants/${testTenant.tenantSlug}/feature-flags`)
        .set('Cookie', ownerCookie)
        .send({ barcodeScanningEnabled: false });

      expect(response.status).toBe(200);
      expect(response.body.data.chatAssistantEnabled).toBe(true); // Unchanged
      expect(response.body.data.openaiApiKey).toBe('sk-existing-key'); // Unchanged
      expect(response.body.data.barcodeScanningEnabled).toBe(false); // Updated
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .put(`/api/tenants/${testTenant.tenantSlug}/feature-flags`)
        .send({ chatAssistantEnabled: true });

      expect(response.status).toBe(401);
    });

    test('should require theme:manage permission', async () => {
      const response = await request(app)
        .put(`/api/tenants/${testTenant.tenantSlug}/feature-flags`)
        .set('Cookie', viewerCookie)
        .send({ chatAssistantEnabled: true });

      expect(response.status).toBe(403);
    });

    test('should return 404 for non-existent tenant', async () => {
      const response = await request(app)
        .put('/api/tenants/non-existent-slug/feature-flags')
        .set('Cookie', ownerCookie)
        .send({ chatAssistantEnabled: true });

      expect(response.status).toBe(404);
    });

    test('should support idempotency', async () => {
      const idempotencyKey = `test-idem-key-${Date.now()}`;
      const requestBody = { chatAssistantEnabled: true, openaiApiKey: 'sk-test-idem-key' };

      // First request
      const response1 = await request(app)
        .put(`/api/tenants/${testTenant.tenantSlug}/feature-flags`)
        .set('Cookie', ownerCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send(requestBody);

      expect(response1.status).toBe(200);
      expect(response1.body.data.chatAssistantEnabled).toBe(true);

      // Small delay to ensure first response is stored
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Second request with same key and same body - should return cached response
      const response2 = await request(app)
        .put(`/api/tenants/${testTenant.tenantSlug}/feature-flags`)
        .set('Cookie', ownerCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send(requestBody); // Same body

      expect(response2.status).toBe(200);
      // Should return original cached response
      expect(response2.body.data.chatAssistantEnabled).toBe(true);
      expect(response2.body.data.openaiApiKey).toBe('sk-test-idem-key');
    });

    test('should prevent cross-tenant access', async () => {
      const otherTenant = await createTestTenant();

      const response = await request(app)
        .put(`/api/tenants/${otherTenant.tenantSlug}/feature-flags`)
        .set('Cookie', ownerCookie) // Owner cookie for testTenant, not otherTenant
        .send({ chatAssistantEnabled: false });

      // Should get 403 because owner doesn't have access to otherTenant
      expect(response.status).toBe(403);

      // Cleanup
      await prisma.tenant.delete({ where: { id: otherTenant.id } });
    });
  });
});
