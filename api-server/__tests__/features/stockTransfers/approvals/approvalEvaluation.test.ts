// api-server/__tests__/features/stockTransfers/approvals/approvalEvaluation.test.ts
import { evaluateApprovalRules } from '../../../../src/services/stockTransfers/approvalEvaluationService.js';
import { createApprovalRule } from '../../../../src/services/stockTransfers/approvalRulesService.js';
import {
  createTestUser,
  createTestTenant,
  createTestBranch,
  createTestProduct,
  createTestRoleWithPermissions,
} from '../../../helpers/factories.js';
import { ApprovalRuleConditionType, ApprovalMode, ApprovalStatus } from '@prisma/client';
import { prismaClientInstance as prisma } from '../../../../src/db/prismaClient.js';

describe('[APPROVAL-EVAL-SVC] Approval Evaluation Service', () => {
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let sourceBranch: Awaited<ReturnType<typeof createTestBranch>>;
  let destinationBranch: Awaited<ReturnType<typeof createTestBranch>>;
  let product: Awaited<ReturnType<typeof createTestProduct>>;
  let approverRole: Awaited<ReturnType<typeof createTestRoleWithPermissions>>;

  beforeEach(async () => {
    testTenant = await createTestTenant();
    testUser = await createTestUser();
    sourceBranch = await createTestBranch({ tenantId: testTenant.id });
    destinationBranch = await createTestBranch({ tenantId: testTenant.id });
    product = await createTestProduct({
      tenantId: testTenant.id,
      pricePence: 10000, // £100
    });
    approverRole = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ['stock:write'],
    });
  });

  describe('evaluateApprovalRules - Evaluate Transfer Against Rules', () => {
    it('should return no match when no rules exist', async () => {
      const transfer = {
        id: 'transfer-1',
        tenantId: testTenant.id,
        sourceBranchId: sourceBranch.id,
        destinationBranchId: destinationBranch.id,
        items: [
          {
            productId: product.id,
            qtyRequested: 10,
            product: {
              productPricePence: 10000,
            },
          },
        ],
      };

      const result = await evaluateApprovalRules({ transfer });

      expect(result.matched).toBe(false);
      expect(result.rule).toBeUndefined();
      expect(result.approvalRecords).toBeUndefined();
    });

    it('should match transfer requiring approval (quantity threshold)', async () => {
      await createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'High Quantity Rule',
          conditions: [
            {
              conditionType: 'TOTAL_QTY_THRESHOLD',
              threshold: 50,
            },
          ],
          levels: [
            {
              level: 1,
              name: 'Manager Approval',
              requiredRoleId: approverRole.id,
            },
          ],
        },
      });

      // Create actual transfer in database
      const transfer = await prisma.stockTransfer.create({
        data: {
          tenantId: testTenant.id,
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          transferNumber: `TR-${Date.now()}-QTY`,
          status: 'REQUESTED',
          requestedByUserId: testUser.id,
          items: {
            create: [
              {
                productId: product.id,
                qtyRequested: 100, // Exceeds threshold
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

      const result = await evaluateApprovalRules({ transfer });

      expect(result.matched).toBe(true);
      expect(result.rule).toBeDefined();
      expect(result.rule?.name).toBe('High Quantity Rule');
      expect(result.approvalRecords).toBeDefined();
      expect(result.approvalRecords?.length).toBe(1);
      expect(result.approvalRecords?.[0]?.status).toBe('PENDING');
    });

    it('should match transfer requiring approval (value threshold)', async () => {
      await createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'High Value Rule',
          conditions: [
            {
              conditionType: 'TOTAL_VALUE_THRESHOLD',
              threshold: 50000, // £500 in pence
            },
          ],
          levels: [
            {
              level: 1,
              name: 'Finance Approval',
              requiredRoleId: approverRole.id,
            },
          ],
        },
      });

      // Create actual transfer in database
      const transfer = await prisma.stockTransfer.create({
        data: {
          tenantId: testTenant.id,
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          transferNumber: `TR-${Date.now()}-VAL`,
          status: 'REQUESTED',
          requestedByUserId: testUser.id,
          items: {
            create: [
              {
                productId: product.id,
                qtyRequested: 100,
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

      const result = await evaluateApprovalRules({ transfer });

      expect(result.matched).toBe(true);
      expect(result.rule?.name).toBe('High Value Rule');
    });

    it('should match transfer requiring approval (branch-specific)', async () => {
      await createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Branch-Specific Rule',
          conditions: [
            {
              conditionType: 'SOURCE_BRANCH',
              branchId: sourceBranch.id,
            },
          ],
          levels: [
            {
              level: 1,
              name: 'Branch Manager',
              requiredRoleId: approverRole.id,
            },
          ],
        },
      });

      // Create actual transfer in database
      const transfer = await prisma.stockTransfer.create({
        data: {
          tenantId: testTenant.id,
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          transferNumber: `TR-${Date.now()}-BRANCH`,
          status: 'REQUESTED',
          requestedByUserId: testUser.id,
          items: {
            create: [
              {
                productId: product.id,
                qtyRequested: 10,
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

      const result = await evaluateApprovalRules({ transfer });

      expect(result.matched).toBe(true);
      expect(result.rule?.name).toBe('Branch-Specific Rule');
    });

    it('should create sequential approval levels', async () => {
      const role2 = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['stock:write'],
      });

      await createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Multi-Level Sequential',
          approvalMode: 'SEQUENTIAL',
          conditions: [
            {
              conditionType: 'TOTAL_VALUE_THRESHOLD',
              threshold: 10000,
            },
          ],
          levels: [
            {
              level: 1,
              name: 'Supervisor',
              requiredRoleId: approverRole.id,
            },
            {
              level: 2,
              name: 'Manager',
              requiredRoleId: role2.id,
            },
          ],
        },
      });

      // Create actual transfer in database
      const transfer = await prisma.stockTransfer.create({
        data: {
          tenantId: testTenant.id,
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          transferNumber: `TR-${Date.now()}-SEQ`,
          status: 'REQUESTED',
          requestedByUserId: testUser.id,
          items: {
            create: [
              {
                productId: product.id,
                qtyRequested: 100,
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

      const result = await evaluateApprovalRules({ transfer });

      expect(result.matched).toBe(true);
      expect(result.rule?.approvalMode).toBe('SEQUENTIAL');
      expect(result.approvalRecords?.length).toBe(2);
      expect(result.approvalRecords?.[0]?.level).toBe(1);
      expect(result.approvalRecords?.[1]?.level).toBe(2);
    });

    it('should create concurrent approval levels', async () => {
      const role2 = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['stock:write'],
      });

      await createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Multi-Level Concurrent',
          approvalMode: 'PARALLEL',
          conditions: [
            {
              conditionType: 'TOTAL_VALUE_THRESHOLD',
              threshold: 10000,
            },
          ],
          levels: [
            {
              level: 1,
              name: 'Manager A',
              requiredRoleId: approverRole.id,
            },
            {
              level: 2,
              name: 'Manager B',
              requiredRoleId: role2.id,
            },
          ],
        },
      });

      // Create actual transfer in database
      const transfer = await prisma.stockTransfer.create({
        data: {
          tenantId: testTenant.id,
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          transferNumber: `TR-${Date.now()}-PARA`,
          status: 'REQUESTED',
          requestedByUserId: testUser.id,
          items: {
            create: [
              {
                productId: product.id,
                qtyRequested: 100,
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

      const result = await evaluateApprovalRules({ transfer });

      expect(result.matched).toBe(true);
      expect(result.rule?.approvalMode).toBe('PARALLEL');
      expect(result.approvalRecords?.length).toBe(2);
    });

    it('should match highest priority rule when multiple rules match', async () => {
      await createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'Low Priority Rule',
          priority: 1,
          conditions: [
            {
              conditionType: 'TOTAL_VALUE_THRESHOLD',
              threshold: 10000,
            },
          ],
          levels: [
            {
              level: 1,
              name: 'Approver',
              requiredRoleId: approverRole.id,
            },
          ],
        },
      });

      await createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'High Priority Rule',
          priority: 10,
          conditions: [
            {
              conditionType: 'TOTAL_VALUE_THRESHOLD',
              threshold: 10000,
            },
          ],
          levels: [
            {
              level: 1,
              name: 'Senior Approver',
              requiredRoleId: approverRole.id,
            },
          ],
        },
      });

      // Create actual transfer in database
      const transfer = await prisma.stockTransfer.create({
        data: {
          tenantId: testTenant.id,
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          transferNumber: `TR-${Date.now()}-PRIO`,
          status: 'REQUESTED',
          requestedByUserId: testUser.id,
          items: {
            create: [
              {
                productId: product.id,
                qtyRequested: 100,
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

      const result = await evaluateApprovalRules({ transfer });

      expect(result.matched).toBe(true);
      expect(result.rule?.name).toBe('High Priority Rule');
    });

    it('should not match when transfer below all thresholds', async () => {
      await createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'High Threshold Rule',
          conditions: [
            {
              conditionType: 'TOTAL_VALUE_THRESHOLD',
              threshold: 1000000, // £10,000
            },
          ],
          levels: [
            {
              level: 1,
              name: 'Approver',
              requiredRoleId: approverRole.id,
            },
          ],
        },
      });

      const transfer = {
        id: 'transfer-low',
        tenantId: testTenant.id,
        sourceBranchId: sourceBranch.id,
        destinationBranchId: destinationBranch.id,
        items: [
          {
            productId: product.id,
            qtyRequested: 1,
            product: {
              productPricePence: 10000, // Only £100
            },
          },
        ],
      };

      const result = await evaluateApprovalRules({ transfer });

      expect(result.matched).toBe(false);
    });

    it('should support user-specific approval levels', async () => {
      await createApprovalRule({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'User-Specific Rule',
          conditions: [
            {
              conditionType: 'TOTAL_VALUE_THRESHOLD',
              threshold: 10000,
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

      // Create actual transfer in database
      const transfer = await prisma.stockTransfer.create({
        data: {
          tenantId: testTenant.id,
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          transferNumber: `TR-${Date.now()}-USER`,
          status: 'REQUESTED',
          requestedByUserId: testUser.id,
          items: {
            create: [
              {
                productId: product.id,
                qtyRequested: 100,
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

      const result = await evaluateApprovalRules({ transfer });

      expect(result.matched).toBe(true);
      expect(result.approvalRecords?.[0]?.requiredUserId).toBe(testUser.id);
    });
  });
});
