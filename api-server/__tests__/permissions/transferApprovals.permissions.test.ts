// api-server/__tests__/permissions/transferApprovals.permissions.test.ts
import request from 'supertest';
import express, { type Express } from 'express';
import { transferApprovalRulesRouter } from '../../src/routes/transferApprovalRulesRouter.js';
import { sessionMiddleware } from '../../src/middleware/sessionMiddleware.js';
import { standardErrorHandler } from '../../src/middleware/errorHandler.js';
import cookieParser from 'cookie-parser';
import {
  createTestUser,
  createTestTenant,
  createTestBranch,
  createTestRoleWithPermissions,
  createTestMembership,
} from '../helpers/factories.js';
import { createSessionCookie } from '../helpers/auth.js';
import { ROLE_DEFS } from '../../src/rbac/catalog.js';
import { prismaClientInstance as prisma } from '../../src/db/prismaClient.js';

describe('[RBAC] Transfer Approval Rules Permissions', () => {
  let app: Express;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;

  let ownerUser: Awaited<ReturnType<typeof createTestUser>>;
  let adminUser: Awaited<ReturnType<typeof createTestUser>>;
  let editorUser: Awaited<ReturnType<typeof createTestUser>>;
  let viewerUser: Awaited<ReturnType<typeof createTestUser>>;

  let ownerCookie: string;
  let adminCookie: string;
  let editorCookie: string;
  let viewerCookie: string;

  let testBranch: any;
  let testRule: any;
  let ownerRole: any;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(sessionMiddleware);
    app.use('/api/approval-rules', transferApprovalRulesRouter);
    app.use(standardErrorHandler);
  });

  beforeEach(async () => {
    testTenant = await createTestTenant();

    ownerUser = await createTestUser();
    adminUser = await createTestUser();
    editorUser = await createTestUser();
    viewerUser = await createTestUser();

    ownerRole = await createTestRoleWithPermissions({
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

    await createTestMembership({ userId: ownerUser.id, tenantId: testTenant.id, roleId: ownerRole.id });
    await createTestMembership({ userId: adminUser.id, tenantId: testTenant.id, roleId: adminRole.id });
    await createTestMembership({ userId: editorUser.id, tenantId: testTenant.id, roleId: editorRole.id });
    await createTestMembership({ userId: viewerUser.id, tenantId: testTenant.id, roleId: viewerRole.id });

    testBranch = await createTestBranch({ tenantId: testTenant.id });

    testRule = await prisma.transferApprovalRule.create({
      data: {
        tenantId: testTenant.id,
        name: `Rule ${Date.now()}`,
        conditions: {
          create: [{
            conditionType: 'TOTAL_QTY_THRESHOLD',
            threshold: 10000,
          }],
        },
      },
    });

    ownerCookie = createSessionCookie(ownerUser.id, testTenant.id);
    adminCookie = createSessionCookie(adminUser.id, testTenant.id);
    editorCookie = createSessionCookie(editorUser.id, testTenant.id);
    viewerCookie = createSessionCookie(viewerUser.id, testTenant.id);
  });

  // NOTE: Approval rules require both stock:write AND tenant:manage permissions (OWNER only)

  describe('GET /api/approval-rules - List Approval Rules', () => {
    it('OWNER - should allow (has stock:write + tenant:manage)', async () => {
      const response = await request(app)
        .get('/api/approval-rules')
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('ADMIN - should allow (has stock:read)', async () => {
      const response = await request(app)
        .get('/api/approval-rules')
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('EDITOR - should allow (has stock:read)', async () => {
      const response = await request(app)
        .get('/api/approval-rules')
        .set('Cookie', editorCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('VIEWER - should allow (has stock:read)', async () => {
      const response = await request(app)
        .get('/api/approval-rules')
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).get('/api/approval-rules');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/approval-rules/:id - Get Approval Rule by ID', () => {
    it('OWNER - should allow (has permissions)', async () => {
      const response = await request(app)
        .get(`/api/approval-rules/${testRule.id}`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(testRule.id);
    });

    it('ADMIN - should allow (has stock:read)', async () => {
      const response = await request(app)
        .get(`/api/approval-rules/${testRule.id}`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).get(`/api/approval-rules/${testRule.id}`);
      expect(response.status).toBe(401);
    });

    it('Cross-tenant - should return 404', async () => {
      const otherTenant = await createTestTenant();
      const otherRule = await prisma.transferApprovalRule.create({
        data: {
          tenantId: otherTenant.id,
          name: `Other Rule ${Date.now()}`,
          conditions: {
            create: [{
              conditionType: 'TOTAL_QTY_THRESHOLD',
              threshold: 10000,
            }],
          },
        },
      });

      const response = await request(app)
        .get(`/api/approval-rules/${otherRule.id}`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/approval-rules - Create Approval Rule', () => {
    it('OWNER - should allow (has stock:write)', async () => {
      const response = await request(app)
        .post('/api/approval-rules')
        .set('Cookie', ownerCookie)
        .send({
          name: 'New Rule',
          conditions: [
            {
              conditionType: 'TOTAL_VALUE_THRESHOLD',
              threshold: 20000,
            },
          ],
          levels: [
            {
              level: 1,
              name: 'Manager Approval',
              requiredRoleId: ownerRole.id,
            },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('ADMIN - should allow (has stock:write)', async () => {
      const response = await request(app)
        .post('/api/approval-rules')
        .set('Cookie', adminCookie)
        .send({
          name: 'Admin Rule',
          conditions: [
            {
              conditionType: 'TOTAL_QTY_THRESHOLD',
              threshold: 100,
            },
          ],
          levels: [
            {
              level: 1,
              name: 'Admin Approval',
              requiredRoleId: ownerRole.id,
            },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('EDITOR - should deny (lacks both permissions)', async () => {
      const response = await request(app)
        .post('/api/approval-rules')
        .set('Cookie', editorCookie)
        .send({
          name: 'New Rule',
          triggerThresholdValuePence: 20000,
          conditions: [],
        });

      expect(response.status).toBe(403);
    });

    it('VIEWER - should deny (lacks both permissions)', async () => {
      const response = await request(app)
        .post('/api/approval-rules')
        .set('Cookie', viewerCookie)
        .send({
          name: 'New Rule',
          triggerThresholdValuePence: 20000,
          conditions: [],
        });

      expect(response.status).toBe(403);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app)
        .post('/api/approval-rules')
        .send({
          name: 'New Rule',
          triggerThresholdValuePence: 20000,
          conditions: [],
        });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/approval-rules/:id - Delete Approval Rule', () => {
    it('OWNER - should allow (has permissions)', async () => {
      const response = await request(app)
        .delete(`/api/approval-rules/${testRule.id}`)
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
    });

    it('ADMIN - should allow (has stock:write)', async () => {
      const rule = await prisma.transferApprovalRule.create({
        data: {
          tenantId: testTenant.id,
          name: `Delete Rule ${Date.now()}`,
          conditions: {
            create: [{
              conditionType: 'TOTAL_QTY_THRESHOLD',
              threshold: 10000,
            }],
          },
        },
      });

      const response = await request(app)
        .delete(`/api/approval-rules/${rule.id}`)
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app)
        .delete(`/api/approval-rules/${testRule.id}`);

      expect(response.status).toBe(401);
    });
  });
});
