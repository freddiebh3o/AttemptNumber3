// api-server/__tests__/features/stockTransfers/approvals/approvalRulesService.test.ts
import {
  createApprovalRule,
  listApprovalRules,
  getApprovalRule,
  updateApprovalRule,
  deleteApprovalRule,
  restoreApprovalRule,
} from '../../../../src/services/stockTransfers/approvalRulesService.js';
import {
  createTestUser,
  createTestTenant,
  createTestBranch,
  createTestRoleWithPermissions,
} from '../../../helpers/factories.js';
import { prismaClientInstance as prisma } from '../../../../src/db/prismaClient.js';
import { ApprovalMode, ApprovalRuleConditionType } from '@prisma/client';

describe('[APPROVAL-RULES-SVC] Approval Rules Service', () => {
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let testBranch: Awaited<ReturnType<typeof createTestBranch>>;
  let testRole: Awaited<ReturnType<typeof createTestRoleWithPermissions>>;

  beforeEach(async () => {
    testTenant = await createTestTenant();
    testUser = await createTestUser();
    testBranch = await createTestBranch({ tenantId: testTenant.id });
    testRole = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ['stock:write'],
    });
  });

  describe('createApprovalRule - Create Approval Rule', () => {
    it('should create approval rule with conditions and levels', async () => {
      const result = await createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'High Value Approval',
          description: 'Requires approval for transfers over £1000',
          conditions: [
            {
              conditionType: ApprovalRuleConditionType.TOTAL_VALUE_THRESHOLD,
              threshold: 100000, // £1000 in pence
            },
          ],
          levels: [
            {
              level: 1,
              name: 'Manager Approval',
              requiredRoleId: testRole.id,
            },
          ],
        },
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('High Value Approval');
      expect(result.conditions.length).toBe(1);
      expect(result.levels.length).toBe(1);
      expect(result.isActive).toBe(true);
    });

    it('should create approval rule with multiple conditions', async () => {
      const result = await createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Complex Rule',
          conditions: [
            {
              conditionType: ApprovalRuleConditionType.TOTAL_QTY_THRESHOLD,
              threshold: 100,
            },
            {
              conditionType: ApprovalRuleConditionType.SOURCE_BRANCH,
              branchId: testBranch.id,
            },
          ],
          levels: [
            {
              level: 1,
              name: 'Level 1',
              requiredRoleId: testRole.id,
            },
          ],
        },
      });

      expect(result.conditions.length).toBe(2);
    });

    it('should create approval rule with multiple levels (sequential)', async () => {
      const role2 = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['stock:write'],
      });

      const result = await createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Multi-Level Approval',
          approvalMode: ApprovalMode.SEQUENTIAL,
          conditions: [
            {
              conditionType: ApprovalRuleConditionType.TOTAL_VALUE_THRESHOLD,
              threshold: 50000,
            },
          ],
          levels: [
            {
              level: 1,
              name: 'Supervisor',
              requiredRoleId: testRole.id,
            },
            {
              level: 2,
              name: 'Manager',
              requiredRoleId: role2.id,
            },
          ],
        },
      });

      expect(result.levels.length).toBe(2);
      expect(result.approvalMode).toBe(ApprovalMode.SEQUENTIAL);
    });

    it('should create approval rule with user-specific approval', async () => {
      const result = await createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'User-Specific Approval',
          conditions: [
            {
              conditionType: ApprovalRuleConditionType.TOTAL_QTY_THRESHOLD,
              threshold: 50,
            },
          ],
          levels: [
            {
              level: 1,
              name: 'Specific User',
              requiredUserId: testUser.id,
            },
          ],
        },
      });

      expect(result.levels[0]?.requiredUserId).toBe(testUser.id);
    });

    it('should create audit log entry', async () => {
      const result = await createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Audited Rule',
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
              requiredRoleId: testRole.id,
            },
          ],
        },
      });

      const auditEntry = await prisma.auditEvent.findFirst({
        where: {
          entityId: result.id,
          action: 'APPROVAL_RULE_CREATE',
        },
      });

      expect(auditEntry).toBeDefined();
      expect(auditEntry?.actorUserId).toBe(testUser.id);
    });

    it('should reject rule with no conditions', async () => {
      await expect(
        createApprovalRule({
          tenantId: testTenant.id,
          userId: testUser.id,
          data: {
            name: 'Invalid Rule',
            conditions: [],
            levels: [
              {
                level: 1,
                name: 'Manager',
                requiredRoleId: testRole.id,
              },
            ],
          },
        })
      ).rejects.toThrow('at least one condition');
    });

    it('should reject rule with no levels', async () => {
      await expect(
        createApprovalRule({
          tenantId: testTenant.id,
          userId: testUser.id,
          data: {
            name: 'Invalid Rule',
            conditions: [
              {
                conditionType: ApprovalRuleConditionType.TOTAL_VALUE_THRESHOLD,
                threshold: 1000,
              },
            ],
            levels: [],
          },
        })
      ).rejects.toThrow('at least one approval level');
    });

    it('should reject levels that are not sequential', async () => {
      await expect(
        createApprovalRule({
          tenantId: testTenant.id,
          userId: testUser.id,
          data: {
            name: 'Invalid Levels',
            conditions: [
              {
                conditionType: ApprovalRuleConditionType.TOTAL_VALUE_THRESHOLD,
                threshold: 1000,
              },
            ],
            levels: [
              {
                level: 1,
                name: 'Level 1',
                requiredRoleId: testRole.id,
              },
              {
                level: 3, // Skip level 2
                name: 'Level 3',
                requiredRoleId: testRole.id,
              },
            ],
          },
        })
      ).rejects.toThrow('sequential');
    });

    it('should support multi-tenant isolation', async () => {
      const tenant2 = await createTestTenant();
      const role2 = await createTestRoleWithPermissions({
        tenantId: tenant2.id,
        permissionKeys: ['stock:write'],
      });

      const rule1 = await createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Tenant 1 Rule',
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
              requiredRoleId: testRole.id,
            },
          ],
        },
      });

      const rule2 = await createApprovalRule({
        tenantId: tenant2.id,
        userId: testUser.id,
        data: {
          name: 'Tenant 2 Rule',
          conditions: [
            {
              conditionType: ApprovalRuleConditionType.TOTAL_VALUE_THRESHOLD,
              threshold: 2000,
            },
          ],
          levels: [
            {
              level: 1,
              name: 'Manager',
              requiredRoleId: role2.id,
            },
          ],
        },
      });

      expect(rule1.tenantId).toBe(testTenant.id);
      expect(rule2.tenantId).toBe(tenant2.id);
    });
  });

  describe('listApprovalRules - List Approval Rules', () => {
    it('should list approval rules for tenant', async () => {
      await createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Rule 1',
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
              requiredRoleId: testRole.id,
            },
          ],
        },
      });

      const result = await listApprovalRules({
        tenantId: testTenant.id,
      });

      expect(result.items).toBeDefined();
      expect(result.items.length).toBeGreaterThanOrEqual(1);
    });

    it('should support multi-tenant isolation in listing', async () => {
      const tenant2 = await createTestTenant();

      await createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Tenant 1 Rule',
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
              requiredRoleId: testRole.id,
            },
          ],
        },
      });

      const result = await listApprovalRules({
        tenantId: tenant2.id,
      });

      expect(result.items.length).toBe(0);
    });
  });

  describe('getApprovalRuleById - Get Approval Rule', () => {
    it('should get approval rule by ID with conditions and levels', async () => {
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
              requiredRoleId: testRole.id,
            },
          ],
        },
      });

      const result = await getApprovalRule({
        tenantId: testTenant.id,
        ruleId: rule.id,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(rule.id);
      expect(result.name).toBe('Get Test Rule');
      expect(result.conditions).toBeDefined();
      expect(result.levels).toBeDefined();
    });

    it('should throw not found for non-existent rule', async () => {
      await expect(
        getApprovalRule({
          tenantId: testTenant.id,
          ruleId: 'non-existent-id',
        })
      ).rejects.toThrow('not found');
    });

    it('should not allow access to other tenant rules', async () => {
      const tenant2 = await createTestTenant();
      const role2 = await createTestRoleWithPermissions({
        tenantId: tenant2.id,
        permissionKeys: ['stock:write'],
      });

      const otherRule = await createApprovalRule({
        tenantId: tenant2.id,
        userId: testUser.id,
        data: {
          name: 'Other Tenant Rule',
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
              requiredRoleId: role2.id,
            },
          ],
        },
      });

      await expect(
        getApprovalRule({
          tenantId: testTenant.id,
          ruleId: otherRule.id,
        })
      ).rejects.toThrow('not found');
    });
  });

  describe('updateApprovalRule - Update Approval Rule', () => {
    it('should update approval rule name and description', async () => {
      const rule = await createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Original Name',
          description: 'Original description',
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
              requiredRoleId: testRole.id,
            },
          ],
        },
      });

      const result = await updateApprovalRule({
        tenantId: testTenant.id,
        ruleId: rule.id,
        userId: testUser.id,
        data: {
          name: 'Updated Name',
          description: 'Updated description',
        },
      });

      expect(result.name).toBe('Updated Name');
      expect(result.description).toBe('Updated description');
    });

    it('should create audit log entry for update', async () => {
      const rule = await createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Test Rule',
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
              requiredRoleId: testRole.id,
            },
          ],
        },
      });

      await updateApprovalRule({
        tenantId: testTenant.id,
        ruleId: rule.id,
        userId: testUser.id,
        data: {
          name: 'Updated',
        },
      });

      const auditEntry = await prisma.auditEvent.findFirst({
        where: {
          entityId: rule.id,
          action: 'APPROVAL_RULE_UPDATE',
        },
      });

      expect(auditEntry).toBeDefined();
    });
  });

  describe('archiveApprovalRule - Archive Approval Rule', () => {
    it('should archive approval rule', async () => {
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
              requiredRoleId: testRole.id,
            },
          ],
        },
      });

      const result = await deleteApprovalRule({
        tenantId: testTenant.id,
        ruleId: rule.id,
        userId: testUser.id,
      });

      expect(result.archivedAt).not.toBeNull();
    });
  });

  describe('restoreApprovalRule - Restore Approval Rule', () => {
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
              requiredRoleId: testRole.id,
            },
          ],
        },
      });

      await deleteApprovalRule({
        tenantId: testTenant.id,
        ruleId: rule.id,
        userId: testUser.id,
      });

      const result = await restoreApprovalRule({
        tenantId: testTenant.id,
        ruleId: rule.id,
        userId: testUser.id,
      });

      expect(result.archivedAt).toBeNull();
    });
  });
});
