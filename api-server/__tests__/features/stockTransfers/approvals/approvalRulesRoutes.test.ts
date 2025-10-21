// api-server/__tests__/features/stockTransfers/approvals/approvalRulesRoutes.test.ts
import request from 'supertest';
import express, { type Express } from 'express';
import { transferApprovalRulesRouter } from '../../../../src/routes/transferApprovalRulesRouter.js';
import { sessionMiddleware } from '../../../../src/middleware/sessionMiddleware.js';
import { standardErrorHandler } from '../../../../src/middleware/errorHandler.js';
import cookieParser from 'cookie-parser';
import {
  createTestUser,
  createTestTenant,
  createTestBranch,
  createTestRoleWithPermissions,
  createTestMembership,
} from '../../../helpers/factories.js';
import { createSessionCookie } from '../../../helpers/auth.js';
import { ROLE_DEFS } from '../../../../src/rbac/catalog.js';
import { createApprovalRule } from '../../../../src/services/stockTransfers/approvalRulesService.js';
import { ApprovalRuleConditionType } from '@prisma/client';

describe('[APPROVAL-RULES-API] Approval Rules API Routes', () => {
  let app: Express;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let testBranch: Awaited<ReturnType<typeof createTestBranch>>;
  let approverRole: Awaited<ReturnType<typeof createTestRoleWithPermissions>>;
  let sessionCookie: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(sessionMiddleware);
    app.use('/api/transfer-approval-rules', transferApprovalRulesRouter);
    app.use(standardErrorHandler);
  });

  beforeEach(async () => {
    testTenant = await createTestTenant();
    testUser = await createTestUser();
    testBranch = await createTestBranch({ tenantId: testTenant.id });

    // Use ADMIN role (has stock:write permission)
    // EDITOR lacks stock:write permission!
    const role = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ROLE_DEFS.ADMIN,
    });

    approverRole = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ['stock:write'],
    });

    await createTestMembership({
      userId: testUser.id,
      tenantId: testTenant.id,
      roleId: role.id,
    });

    sessionCookie = createSessionCookie(testUser.id, testTenant.id);
  });

  describe('GET /api/transfer-approval-rules - List Approval Rules', () => {
    it('should list approval rules with stock:read permission', async () => {
      await createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Test Rule',
          conditions: [
            {
              conditionType: ApprovalRuleConditionType.TOTAL_VALUE_THRESHOLD,
              threshold: 10000,
            },
          ],
          levels: [
            {
              level: 1,
              name: 'Manager',
              requiredRoleId: approverRole.id,
            },
          ],
        },
      });

      const response = await request(app)
        .get('/api/transfer-approval-rules')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeDefined();
      expect(response.body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    it('should reject without authentication', async () => {
      const response = await request(app).get('/api/transfer-approval-rules');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should allow VIEWER with stock:read permission to list rules', async () => {
      // VIEWER has stock:read permission, so should succeed
      const viewerUser = await createTestUser();
      const viewerRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ROLE_DEFS.VIEWER,
      });

      await createTestMembership({
        userId: viewerUser.id,
        tenantId: testTenant.id,
        roleId: viewerRole.id,
      });

      const viewerCookie = createSessionCookie(viewerUser.id, testTenant.id);

      const response = await request(app)
        .get('/api/transfer-approval-rules')
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/transfer-approval-rules/:ruleId - Get Approval Rule', () => {
    it('should get approval rule by ID', async () => {
      const rule = await createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Get Test Rule',
          conditions: [
            {
              conditionType: ApprovalRuleConditionType.TOTAL_VALUE_THRESHOLD,
              threshold: 5000,
            },
          ],
          levels: [
            {
              level: 1,
              name: 'Manager',
              requiredRoleId: approverRole.id,
            },
          ],
        },
      });

      const response = await request(app)
        .get(`/api/transfer-approval-rules/${rule.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(rule.id);
      expect(response.body.data.name).toBe('Get Test Rule');
    });

    it('should return 404 for non-existent rule', async () => {
      const response = await request(app)
        .get('/api/transfer-approval-rules/non-existent-id')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
    });

    it('should reject without authentication', async () => {
      const rule = await createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Test',
          conditions: [
            {
              conditionType: ApprovalRuleConditionType.TOTAL_VALUE_THRESHOLD,
              threshold: 1000,
            },
          ],
          levels: [
            {
              level: 1,
              name: 'Manager',
              requiredRoleId: approverRole.id,
            },
          ],
        },
      });

      const response = await request(app).get(`/api/transfer-approval-rules/${rule.id}`);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/transfer-approval-rules - Create Approval Rule', () => {
    it('should create approval rule with valid data', async () => {
      const response = await request(app)
        .post('/api/transfer-approval-rules')
        .set('Cookie', sessionCookie)
        .send({
          name: 'High Value Approval',
          description: 'Requires approval for transfers over £1000',
          conditions: [
            {
              conditionType: 'TOTAL_VALUE_THRESHOLD',
              threshold: 100000,
            },
          ],
          levels: [
            {
              level: 1,
              name: 'Manager Approval',
              requiredRoleId: approverRole.id,
            },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('High Value Approval');
      expect(response.body.data.conditions.length).toBe(1);
      expect(response.body.data.levels.length).toBe(1);
    });

    it('should validate request body schema', async () => {
      const response = await request(app)
        .post('/api/transfer-approval-rules')
        .set('Cookie', sessionCookie)
        .send({
          name: '',  // Empty name (invalid)
          conditions: [],  // Empty conditions (invalid)
          levels: [],  // Empty levels (invalid)
        });

      expect(response.status).toBe(400);
      expect(response.body.error?.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should reject without stock:write permission', async () => {
      const viewerUser = await createTestUser();
      const viewerRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ROLE_DEFS.VIEWER,
      });

      await createTestMembership({
        userId: viewerUser.id,
        tenantId: testTenant.id,
        roleId: viewerRole.id,
      });

      const viewerCookie = createSessionCookie(viewerUser.id, testTenant.id);

      const response = await request(app)
        .post('/api/transfer-approval-rules')
        .set('Cookie', viewerCookie)
        .send({
          name: 'Test',
          conditions: [
            {
              conditionType: 'TOTAL_VALUE_THRESHOLD',
              threshold: 1000,
            },
          ],
          levels: [
            {
              level: 1,
              name: 'Manager',
              requiredRoleId: approverRole.id,
            },
          ],
        });

      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /api/transfer-approval-rules/:ruleId - Update Approval Rule', () => {
    it('should update approval rule with valid data', async () => {
      const rule = await createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Original Name',
          conditions: [
            {
              conditionType: ApprovalRuleConditionType.TOTAL_VALUE_THRESHOLD,
              threshold: 1000,
            },
          ],
          levels: [
            {
              level: 1,
              name: 'Manager',
              requiredRoleId: approverRole.id,
            },
          ],
        },
      });

      const response = await request(app)
        .patch(`/api/transfer-approval-rules/${rule.id}`)
        .set('Cookie', sessionCookie)
        .send({
          name: 'Updated Name',
          description: 'Updated description',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Updated Name');
    });

    it('should reject without authentication', async () => {
      const rule = await createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Test',
          conditions: [
            {
              conditionType: ApprovalRuleConditionType.TOTAL_VALUE_THRESHOLD,
              threshold: 1000,
            },
          ],
          levels: [
            {
              level: 1,
              name: 'Manager',
              requiredRoleId: approverRole.id,
            },
          ],
        },
      });

      const response = await request(app)
        .patch(`/api/transfer-approval-rules/${rule.id}`)
        .send({ name: 'Hacked' });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/transfer-approval-rules/:ruleId - Archive Approval Rule', () => {
    it('should archive approval rule with stock:write permission', async () => {
      const rule = await createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'To Archive',
          conditions: [
            {
              conditionType: ApprovalRuleConditionType.TOTAL_VALUE_THRESHOLD,
              threshold: 1000,
            },
          ],
          levels: [
            {
              level: 1,
              name: 'Manager',
              requiredRoleId: approverRole.id,
            },
          ],
        },
      });

      const response = await request(app)
        .delete(`/api/transfer-approval-rules/${rule.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject without authentication', async () => {
      const rule = await createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Test',
          conditions: [
            {
              conditionType: ApprovalRuleConditionType.TOTAL_VALUE_THRESHOLD,
              threshold: 1000,
            },
          ],
          levels: [
            {
              level: 1,
              name: 'Manager',
              requiredRoleId: approverRole.id,
            },
          ],
        },
      });

      const response = await request(app).delete(`/api/transfer-approval-rules/${rule.id}`);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/transfer-approval-rules/:ruleId/restore - Restore Approval Rule', () => {
    it('should restore archived approval rule', async () => {
      const rule = await createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'To Restore',
          conditions: [
            {
              conditionType: ApprovalRuleConditionType.TOTAL_VALUE_THRESHOLD,
              threshold: 1000,
            },
          ],
          levels: [
            {
              level: 1,
              name: 'Manager',
              requiredRoleId: approverRole.id,
            },
          ],
        },
      });

      // Archive it first
      await request(app)
        .delete(`/api/transfer-approval-rules/${rule.id}`)
        .set('Cookie', sessionCookie);

      // Now restore
      const response = await request(app)
        .post(`/api/transfer-approval-rules/${rule.id}/restore`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Response Format', () => {
    it('should return standard envelope format', async () => {
      const response = await request(app)
        .post('/api/transfer-approval-rules')
        .set('Cookie', sessionCookie)
        .send({
          name: 'Envelope Test',
          conditions: [
            {
              conditionType: 'TOTAL_VALUE_THRESHOLD',
              threshold: 1000,
            },
          ],
          levels: [
            {
              level: 1,
              name: 'Manager',
              requiredRoleId: approverRole.id,
            },
          ],
        });

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('error');
      expect(response.body.success).toBe(true);
      expect(response.body.error).toBeNull();
    });
  });
});
