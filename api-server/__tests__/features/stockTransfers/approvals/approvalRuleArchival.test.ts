// api-server/__tests__/services/approvalRuleArchival.test.ts
import { ApprovalMode, ApprovalRuleConditionType } from '@prisma/client';
import * as approvalRulesService from '../../../../src/services/stockTransfers/approvalRulesService.js';
import * as approvalEvaluationService from '../../../../src/services/stockTransfers/approvalEvaluationService.js';
import {
  createTestUser,
  createTestTenant,
  createTestProduct,
  createTestBranch,
  createTestRoleWithPermissions,
  createTestMembership,
} from '../../../helpers/factories.js';
import { prismaClientInstance as prisma } from '../../../../src/db/prismaClient.js';

describe('[APPROVAL-RULE-ARCHIVAL] Approval Rule Archival Tests', () => {
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testBranch: Awaited<ReturnType<typeof createTestBranch>>;
  let testRole: Awaited<ReturnType<typeof createTestRoleWithPermissions>>;

  beforeEach(async () => {
    // Create tenant
    testTenant = await createTestTenant();

    // Create user
    testUser = await createTestUser();

    // Create branch
    testBranch = await createTestBranch({
      tenantId: testTenant.id,
    });

    // Create role with permissions
    testRole = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ['stock:read', 'stock:write'],
    });

    // Add user to tenant
    await createTestMembership({
      userId: testUser.id,
      tenantId: testTenant.id,
      roleId: testRole.id,
    });
  });

  describe('[ARA-001] Archive Approval Rule', () => {
    it('should successfully archive an approval rule', async () => {
      // Create a test rule
      const rule = await approvalRulesService.createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Test High-Value Approval Rule',
          description: 'Test rule for archival',
          isActive: true,
          approvalMode: ApprovalMode.SEQUENTIAL,
          priority: 1,
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
              requiredRoleId: testRole.id,
            },
          ],
        },
      });

      // Archive the rule
      const archived = await approvalRulesService.deleteApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        ruleId: rule.id,
      });

      // Verify archived state
      expect(archived.isArchived).toBe(true);
      expect(archived.archivedAt).toBeTruthy();
      expect(archived.archivedByUserId).toBe(testUser.id);
      expect(archived.isActive).toBe(true); // isActive state should be preserved
    });

    it('should fail to archive already archived rule', async () => {
      // Create and archive a rule
      const rule = await approvalRulesService.createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Test Rule for Double Archive',
          isActive: true,
          conditions: [
            {
              conditionType: ApprovalRuleConditionType.TOTAL_QTY_THRESHOLD,
              threshold: 100,
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

      await approvalRulesService.deleteApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        ruleId: rule.id,
      });

      // Try to archive again
      await expect(
        approvalRulesService.deleteApprovalRule({
          tenantId: testTenant.id,
          userId: testUser.id,
          ruleId: rule.id,
        })
      ).rejects.toThrow('already archived');
    });

    it('should preserve isActive state when archiving inactive rule', async () => {
      // Create an inactive rule
      const rule = await approvalRulesService.createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Inactive Rule for Archival',
          isActive: false,
          conditions: [
            {
              conditionType: ApprovalRuleConditionType.TOTAL_QTY_THRESHOLD,
              threshold: 50,
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

      // Archive the rule
      const archived = await approvalRulesService.deleteApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        ruleId: rule.id,
      });

      // Verify archived and inactive
      expect(archived.isArchived).toBe(true);
      expect(archived.isActive).toBe(false);
    });
  });

  describe('[ARA-002] Restore Approval Rule', () => {
    it('should successfully restore an archived rule', async () => {
      // Create and archive a rule
      const rule = await approvalRulesService.createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Rule for Restoration Test',
          isActive: true,
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

      await approvalRulesService.deleteApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        ruleId: rule.id,
      });

      // Restore the rule
      const restored = await approvalRulesService.restoreApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        ruleId: rule.id,
      });

      // Verify restored state
      expect(restored.isArchived).toBe(false);
      expect(restored.archivedAt).toBeNull();
      expect(restored.archivedByUserId).toBeNull();
      expect(restored.isActive).toBe(true); // Original isActive state restored
    });

    it('should fail to restore non-archived rule', async () => {
      // Create a rule
      const rule = await approvalRulesService.createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Active Rule for Invalid Restore',
          isActive: true,
          conditions: [
            {
              conditionType: ApprovalRuleConditionType.TOTAL_QTY_THRESHOLD,
              threshold: 100,
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

      // Try to restore active rule
      await expect(
        approvalRulesService.restoreApprovalRule({
          tenantId: testTenant.id,
          userId: testUser.id,
          ruleId: rule.id,
        })
      ).rejects.toThrow('not archived');
    });

    it('should restore rule to original isActive state (inactive)', async () => {
      // Create an inactive rule
      const rule = await approvalRulesService.createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Inactive Rule Restore Test',
          isActive: false,
          conditions: [
            {
              conditionType: ApprovalRuleConditionType.TOTAL_QTY_THRESHOLD,
              threshold: 75,
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

      // Archive the rule
      await approvalRulesService.deleteApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        ruleId: rule.id,
      });

      // Restore the rule
      const restored = await approvalRulesService.restoreApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        ruleId: rule.id,
      });

      // Verify restored and still inactive
      expect(restored.isArchived).toBe(false);
      expect(restored.isActive).toBe(false);
    });
  });

  describe('[ARA-003] List Rules with Archive Filter', () => {
    let activeRule: Awaited<ReturnType<typeof approvalRulesService.createApprovalRule>>;
    let inactiveRule: Awaited<ReturnType<typeof approvalRulesService.createApprovalRule>>;
    let archivedActiveRule: Awaited<ReturnType<typeof approvalRulesService.createApprovalRule>>;
    let archivedInactiveRule: Awaited<ReturnType<typeof approvalRulesService.createApprovalRule>>;

    beforeEach(async () => {
      // Create active rule
      activeRule = await approvalRulesService.createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Active Rule',
          isActive: true,
          conditions: [{ conditionType: ApprovalRuleConditionType.TOTAL_QTY_THRESHOLD, threshold: 10 }],
          levels: [{ level: 1, name: 'Manager', requiredRoleId: testRole.id }],
        },
      });

      // Create inactive rule
      inactiveRule = await approvalRulesService.createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Inactive Rule',
          isActive: false,
          conditions: [{ conditionType: ApprovalRuleConditionType.TOTAL_QTY_THRESHOLD, threshold: 20 }],
          levels: [{ level: 1, name: 'Manager', requiredRoleId: testRole.id }],
        },
      });

      // Create and archive active rule
      const tempActive = await approvalRulesService.createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Archived Active Rule',
          isActive: true,
          conditions: [{ conditionType: ApprovalRuleConditionType.TOTAL_QTY_THRESHOLD, threshold: 30 }],
          levels: [{ level: 1, name: 'Manager', requiredRoleId: testRole.id }],
        },
      });
      archivedActiveRule = await approvalRulesService.deleteApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        ruleId: tempActive.id,
      });

      // Create and archive inactive rule
      const tempInactive = await approvalRulesService.createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Archived Inactive Rule',
          isActive: false,
          conditions: [{ conditionType: ApprovalRuleConditionType.TOTAL_QTY_THRESHOLD, threshold: 40 }],
          levels: [{ level: 1, name: 'Manager', requiredRoleId: testRole.id }],
        },
      });
      archivedInactiveRule = await approvalRulesService.deleteApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        ruleId: tempInactive.id,
      });
    });

    it('should return only active (non-archived) rules by default', async () => {
      const result = await approvalRulesService.listApprovalRules({
        tenantId: testTenant.id,
      });

      expect(result.items).toHaveLength(2);
      expect(result.items.every((r) => !r.isArchived)).toBe(true);
      const ruleIds = result.items.map((r) => r.id);
      expect(ruleIds).toContain(activeRule.id);
      expect(ruleIds).toContain(inactiveRule.id);
    });

    it('should return only active (non-archived) rules with archivedFilter=active-only', async () => {
      const result = await approvalRulesService.listApprovalRules({
        tenantId: testTenant.id,
        filters: { archivedFilter: 'active-only' },
      });

      expect(result.items).toHaveLength(2);
      expect(result.items.every((r) => !r.isArchived)).toBe(true);
    });

    it('should return only archived rules with archivedFilter=archived-only', async () => {
      const result = await approvalRulesService.listApprovalRules({
        tenantId: testTenant.id,
        filters: { archivedFilter: 'archived-only' },
      });

      expect(result.items).toHaveLength(2);
      expect(result.items.every((r) => r.isArchived)).toBe(true);
      const ruleIds = result.items.map((r) => r.id);
      expect(ruleIds).toContain(archivedActiveRule.id);
      expect(ruleIds).toContain(archivedInactiveRule.id);
    });

    it('should return all rules (active + archived) with archivedFilter=all', async () => {
      const result = await approvalRulesService.listApprovalRules({
        tenantId: testTenant.id,
        filters: { archivedFilter: 'all' },
      });

      expect(result.items).toHaveLength(4);
      const ruleIds = result.items.map((r) => r.id);
      expect(ruleIds).toContain(activeRule.id);
      expect(ruleIds).toContain(inactiveRule.id);
      expect(ruleIds).toContain(archivedActiveRule.id);
      expect(ruleIds).toContain(archivedInactiveRule.id);
    });
  });

  describe('[ARA-004] Get Archived Rule', () => {
    it('should allow fetching archived rule by ID', async () => {
      // Create and archive a rule
      const rule = await approvalRulesService.createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Rule for Get Test',
          isActive: true,
          conditions: [{ conditionType: ApprovalRuleConditionType.TOTAL_QTY_THRESHOLD, threshold: 100 }],
          levels: [{ level: 1, name: 'Manager', requiredRoleId: testRole.id }],
        },
      });

      await approvalRulesService.deleteApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        ruleId: rule.id,
      });

      // Fetch archived rule
      const fetched = await approvalRulesService.getApprovalRule({
        tenantId: testTenant.id,
        ruleId: rule.id,
      });

      expect(fetched.isArchived).toBe(true);
      expect(fetched.id).toBe(rule.id);
    });
  });

  describe('[ARA-005] Rule Evaluation Excludes Archived Rules', () => {
    it('should not evaluate archived rules in approval workflow', async () => {
      // Create two rules: one active, one archived
      const activeRule = await approvalRulesService.createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Active Rule for Evaluation',
          isActive: true,
          priority: 1,
          conditions: [{ conditionType: ApprovalRuleConditionType.TOTAL_QTY_THRESHOLD, threshold: 50 }],
          levels: [{ level: 1, name: 'Manager', requiredRoleId: testRole.id }],
        },
      });

      const ruleToArchive = await approvalRulesService.createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Archived Rule for Evaluation',
          isActive: true,
          priority: 10, // Higher priority (would be evaluated first if not archived)
          conditions: [{ conditionType: ApprovalRuleConditionType.TOTAL_QTY_THRESHOLD, threshold: 50 }],
          levels: [{ level: 1, name: 'Director', requiredRoleId: testRole.id }],
        },
      });

      // Archive the high-priority rule
      await approvalRulesService.deleteApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        ruleId: ruleToArchive.id,
      });

      // Create product and branches for testing evaluation
      const product = await createTestProduct({ tenantId: testTenant.id });
      const destinationBranch = await createTestBranch({ tenantId: testTenant.id });

      // Create a real transfer in the database
      const transfer = await prisma.stockTransfer.create({
        data: {
          tenantId: testTenant.id,
          transferNumber: 'TRF-TEST-001',
          sourceBranchId: testBranch.id,
          destinationBranchId: destinationBranch.id,
          requestedByUserId: testUser.id,
          status: 'REQUESTED',
          items: {
            create: [
              {
                productId: product.id,
                qtyRequested: 100, // Exceeds threshold of 50
              },
            ],
          },
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  productPricePence: true,
                },
              },
            },
          },
        },
      });

      // Evaluate rules
      const evaluation = await approvalEvaluationService.evaluateApprovalRules({
        transfer: transfer as any,
      });

      // Should match the active rule, not the archived one
      expect(evaluation.matched).toBe(true);
      expect(evaluation.rule?.name).toBe('Active Rule for Evaluation');
      expect(evaluation.rule?.id).toBe(activeRule.id);
    });
  });

  describe('[ARA-006] Multi-Tenant Isolation', () => {
    it('should not allow archiving rules from other tenants', async () => {
      // Create second tenant and user
      const tenant2 = await createTestTenant();
      const user2 = await createTestUser();
      const role2 = await createTestRoleWithPermissions({
        tenantId: tenant2.id,
        permissionKeys: ['stock:write'],
      });
      await createTestMembership({
        userId: user2.id,
        tenantId: tenant2.id,
        roleId: role2.id,
      });

      // Create rule in tenant1
      const rule = await approvalRulesService.createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Tenant 1 Rule',
          isActive: true,
          conditions: [{ conditionType: ApprovalRuleConditionType.TOTAL_QTY_THRESHOLD, threshold: 10 }],
          levels: [{ level: 1, name: 'Manager', requiredRoleId: testRole.id }],
        },
      });

      // Try to archive from tenant2
      await expect(
        approvalRulesService.deleteApprovalRule({
          tenantId: tenant2.id,
          userId: user2.id,
          ruleId: rule.id,
        })
      ).rejects.toThrow('not found');
    });

    it('should not allow restoring rules from other tenants', async () => {
      // Create second tenant and user
      const tenant2 = await createTestTenant();
      const user2 = await createTestUser();
      const role2 = await createTestRoleWithPermissions({
        tenantId: tenant2.id,
        permissionKeys: ['stock:write'],
      });
      await createTestMembership({
        userId: user2.id,
        tenantId: tenant2.id,
        roleId: role2.id,
      });

      // Create and archive rule in tenant1
      const rule = await approvalRulesService.createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Tenant 1 Archived Rule',
          isActive: true,
          conditions: [{ conditionType: ApprovalRuleConditionType.TOTAL_QTY_THRESHOLD, threshold: 10 }],
          levels: [{ level: 1, name: 'Manager', requiredRoleId: testRole.id }],
        },
      });

      await approvalRulesService.deleteApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        ruleId: rule.id,
      });

      // Try to restore from tenant2
      await expect(
        approvalRulesService.restoreApprovalRule({
          tenantId: tenant2.id,
          userId: user2.id,
          ruleId: rule.id,
        })
      ).rejects.toThrow('not found');
    });
  });
});
