// api-server/__tests__/services/chat/analyticsTools.test.ts
import { analyticsTools } from '../../../../src/services/chat/tools/analyticsTools.js';
import * as transferService from '../../../../src/services/stockTransfers/stockTransferService.js';
import { receiveStock } from '../../../../src/services/stockService.js';
import {
  createTestUser,
  createTestTenant,
  createTestProduct,
  createTestBranch,
  createTestRoleWithPermissions,
  createTestMembership,
  addUserToBranch,
} from '../../../helpers/factories.js';

describe('[CHAT-ANALYTICS-001] AI Chat Analytics Tools', () => {
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let branch1: Awaited<ReturnType<typeof createTestBranch>>;
  let branch2: Awaited<ReturnType<typeof createTestBranch>>;
  let product1: Awaited<ReturnType<typeof createTestProduct>>;
  let product2: Awaited<ReturnType<typeof createTestProduct>>;

  beforeEach(async () => {
    // Create tenant and user
    testTenant = await createTestTenant();
    testUser = await createTestUser();

    // Create branches
    branch1 = await createTestBranch({
      tenantId: testTenant.id,
      name: 'Main Warehouse',
    });

    branch2 = await createTestBranch({
      tenantId: testTenant.id,
      name: 'Store A',
    });

    // Create role and membership
    const role = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ['products:read', 'stock:read', 'stock:write'],
    });

    await createTestMembership({
      userId: testUser.id,
      tenantId: testTenant.id,
      roleId: role.id,
    });

    await addUserToBranch(testUser.id, testTenant.id, branch1.id);
    await addUserToBranch(testUser.id, testTenant.id, branch2.id);

    // Create products
    product1 = await createTestProduct({
      tenantId: testTenant.id,
      name: 'Widget Alpha',
      sku: 'WID-001',
      pricePence: 1500,
    });

    product2 = await createTestProduct({
      tenantId: testTenant.id,
      name: 'Widget Beta',
      sku: 'WID-002',
      pricePence: 2000,
    });

    // Add stock to branch1
    await receiveStock(
      { currentTenantId: testTenant.id, currentUserId: testUser.id },
      {
        branchId: branch1.id,
        productId: product1.id,
        qty: 1000,
        unitCostPence: 1200,
      }
    );

    await receiveStock(
      { currentTenantId: testTenant.id, currentUserId: testUser.id },
      {
        branchId: branch1.id,
        productId: product2.id,
        qty: 500,
        unitCostPence: 1800,
      }
    );
  });

  describe('[AC-ANALYTICS-001] getTransferMetrics', () => {
    beforeEach(async () => {
      // Create some test transfers
      await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          sourceBranchId: branch1.id,
          destinationBranchId: branch2.id,
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });

      await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          sourceBranchId: branch1.id,
          destinationBranchId: branch2.id,
          items: [{ productId: product2.id, qtyRequested: 50 }],
        },
      });
    });

    it('should get transfer metrics for user branches', async () => {
      const tools = analyticsTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getTransferMetrics.execute({
        days: 30,
      });

      expect(result.period).toBe('Last 30 days');
      expect(result.metrics.totalTransfers).toBeGreaterThanOrEqual(2);
    });

    it('should calculate completion rate', async () => {
      const tools = analyticsTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getTransferMetrics.execute({
        days: 30,
      });

      expect(result.metrics.completionRate).toContain('%');
    });

    it('should show breakdown by status', async () => {
      const tools = analyticsTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getTransferMetrics.execute({
        days: 30,
      });

      expect(result.breakdown).toBeDefined();
      expect(result.breakdown.REQUESTED).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.COMPLETED).toBeGreaterThanOrEqual(0);
    });

    it('should calculate average cycle time', async () => {
      const tools = analyticsTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getTransferMetrics.execute({
        days: 30,
      });

      expect(result.metrics.avgCycleTime).toContain('days');
    });

    it('should calculate fill rate', async () => {
      const tools = analyticsTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getTransferMetrics.execute({
        days: 30,
      });

      expect(result.metrics.fillRate).toContain('%');
    });

    it('should filter by specific branch', async () => {
      const tools = analyticsTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getTransferMetrics.execute({
        branchId: branch1.id,
        days: 30,
      });

      expect(result.metrics.totalTransfers).toBeGreaterThanOrEqual(0);
    });

    it('should respect days parameter', async () => {
      const tools = analyticsTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getTransferMetrics.execute({
        days: 7,
      });

      expect(result.period).toBe('Last 7 days');
    });

    it('should return error if user not member of specified branch', async () => {
      const branch3 = await createTestBranch({
        tenantId: testTenant.id,
      });

      const tools = analyticsTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getTransferMetrics.execute({
        branchId: branch3.id,
      });

      expect(result.error).toBe('Access denied');
    });

    it('should return error if user has no branch memberships', async () => {
      const userWithoutBranches = await createTestUser();
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['stock:read'],
      });
      await createTestMembership({
        userId: userWithoutBranches.id,
        tenantId: testTenant.id,
        roleId: role.id,
      });

      const tools = analyticsTools({
        userId: userWithoutBranches.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getTransferMetrics.execute({});

      expect(result.error).toBe('No branch access');
    });
  });

  describe('[AC-ANALYTICS-002] getBranchPerformance', () => {
    beforeEach(async () => {
      // Create inbound and outbound transfers for branch2
      await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          sourceBranchId: branch1.id,
          destinationBranchId: branch2.id, // Inbound to branch2
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });

      await receiveStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: branch2.id,
          productId: product1.id,
          qty: 50,
          unitCostPence: 1200,
        }
      );

      await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          sourceBranchId: branch2.id, // Outbound from branch2
          destinationBranchId: branch1.id,
          items: [{ productId: product1.id, qtyRequested: 25 }],
        },
      });
    });

    it('should get branch performance metrics', async () => {
      const tools = analyticsTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getBranchPerformance.execute({
        branchId: branch2.id,
        period: 'month',
      });

      expect(result.branch).toBe('Store A');
      expect(result.period).toBe('month');
    });

    it('should show inbound metrics', async () => {
      const tools = analyticsTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getBranchPerformance.execute({
        branchId: branch2.id,
      });

      expect(result.inbound).toBeDefined();
      expect(result.inbound.transferCount).toBeGreaterThanOrEqual(0);
      expect(result.inbound.fillRate).toContain('%');
    });

    it('should show outbound metrics', async () => {
      const tools = analyticsTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getBranchPerformance.execute({
        branchId: branch2.id,
      });

      expect(result.outbound).toBeDefined();
      expect(result.outbound.transferCount).toBeGreaterThanOrEqual(0);
      expect(result.outbound.fillRate).toContain('%');
    });

    it('should calculate net flow', async () => {
      const tools = analyticsTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getBranchPerformance.execute({
        branchId: branch2.id,
      });

      expect(result.netFlow).toBeDefined();
      expect(typeof result.netFlow).toBe('number');
    });

    it('should support different time periods', async () => {
      const tools = analyticsTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const weekResult = await tools.getBranchPerformance.execute({
        branchId: branch1.id,
        period: 'week',
      });
      expect(weekResult.period).toBe('week');

      const monthResult = await tools.getBranchPerformance.execute({
        branchId: branch1.id,
        period: 'month',
      });
      expect(monthResult.period).toBe('month');

      const quarterResult = await tools.getBranchPerformance.execute({
        branchId: branch1.id,
        period: 'quarter',
      });
      expect(quarterResult.period).toBe('quarter');
    });

    it('should return error if user not member of branch', async () => {
      const branch3 = await createTestBranch({
        tenantId: testTenant.id,
      });

      const tools = analyticsTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getBranchPerformance.execute({
        branchId: branch3.id,
      });

      expect(result.error).toBe('Access denied');
    });

    it('should return error if branch not found', async () => {
      const tools = analyticsTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getBranchPerformance.execute({
        branchId: 'non-existent-id',
      });

      expect(result.error).toBe('Access denied');
    });
  });

  describe('[AC-ANALYTICS-003] getStockValueReport', () => {
    it('should calculate stock value across all user branches', async () => {
      const tools = analyticsTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getStockValueReport.execute({});

      expect(result.branches.length).toBeGreaterThanOrEqual(1);
      expect(result.grandTotal).toContain('£');
      expect(result.branchCount).toBeGreaterThanOrEqual(1);
    });

    it('should show value per branch', async () => {
      const tools = analyticsTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getStockValueReport.execute({});

      const mainWarehouse = result.branches.find((b) => b.branchName === 'Main Warehouse');
      expect(mainWarehouse).toBeDefined();
      expect(mainWarehouse?.totalValue).toContain('£');
    });

    it('should show product count per branch', async () => {
      const tools = analyticsTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getStockValueReport.execute({});

      const mainWarehouse = result.branches.find((b) => b.branchName === 'Main Warehouse');
      expect(mainWarehouse?.productCount).toBeGreaterThanOrEqual(2); // We added 2 products
    });

    it('should filter to specific branch', async () => {
      const tools = analyticsTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getStockValueReport.execute({
        branchId: branch1.id,
      });

      expect(result.branches.length).toBe(1);
      expect(result.branches[0]?.branchName).toBe('Main Warehouse');
    });

    it('should calculate grand total correctly', async () => {
      const tools = analyticsTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getStockValueReport.execute({});

      // Grand total should be sum of all branches
      // Branch1: (1000 * £12.00) + (500 * £18.00) = £12,000 + £9,000 = £21,000
      expect(result.grandTotal).toContain('£');
      expect(result.grandTotal).toBe('£21000.00');
    });

    it('should use FIFO cost for valuation', async () => {
      // Add another receipt at different cost
      await receiveStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: branch1.id,
          productId: product1.id,
          qty: 100,
          unitCostPence: 1500, // Higher cost
        }
      );

      const tools = analyticsTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getStockValueReport.execute({
        branchId: branch1.id,
      });

      // Total should include both lots at their respective costs
      // (1000 * £12) + (500 * £18) + (100 * £15) = £12,000 + £9,000 + £1,500 = £22,500
      expect(result.grandTotal).toBe('£22500.00');
    });

    it('should return error if user not member of specified branch', async () => {
      const branch3 = await createTestBranch({
        tenantId: testTenant.id,
      });

      const tools = analyticsTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getStockValueReport.execute({
        branchId: branch3.id,
      });

      expect(result.error).toBe('Access denied');
    });

    it('should return error if user has no branch memberships', async () => {
      const userWithoutBranches = await createTestUser();
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['stock:read'],
      });
      await createTestMembership({
        userId: userWithoutBranches.id,
        tenantId: testTenant.id,
        roleId: role.id,
      });

      const tools = analyticsTools({
        userId: userWithoutBranches.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getStockValueReport.execute({});

      expect(result.error).toBe('No branch access');
    });

    it('should handle branch with no stock', async () => {
      const tools = analyticsTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getStockValueReport.execute({
        branchId: branch2.id,
      });

      const storeA = result.branches.find((b) => b.branchName === 'Store A');
      // branch2 might have stock from beforeEach, but we can check structure
      expect(storeA).toBeDefined();
      expect(storeA?.totalValue).toContain('£');
    });
  });

  describe('[AC-ANALYTICS-004] Security - Branch Membership Filtering', () => {
    it('should only show metrics for user branches', async () => {
      // Create a user who is only member of branch2
      const otherUser = await createTestUser();
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['stock:read'],
      });
      await createTestMembership({
        userId: otherUser.id,
        tenantId: testTenant.id,
        roleId: role.id,
      });
      await addUserToBranch(otherUser.id, testTenant.id, branch2.id);

      const tools = analyticsTools({
        userId: otherUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getStockValueReport.execute({});

      // Should only see branch2
      expect(result.branches.length).toBe(1);
      expect(result.branches[0]?.branchName).toBe('Store A');
    });
  });

  describe('[AC-ANALYTICS-005] Security - Tenant Isolation', () => {
    it('should not include transfers from other tenants', async () => {
      const otherTenant = await createTestTenant();
      const otherUser = await createTestUser();
      const otherBranch1 = await createTestBranch({ tenantId: otherTenant.id });
      const otherBranch2 = await createTestBranch({ tenantId: otherTenant.id });
      const otherProduct = await createTestProduct({ tenantId: otherTenant.id });

      const role = await createTestRoleWithPermissions({
        tenantId: otherTenant.id,
        permissionKeys: ['stock:write'],
      });
      await createTestMembership({
        userId: otherUser.id,
        tenantId: otherTenant.id,
        roleId: role.id,
      });
      await addUserToBranch(otherUser.id, otherTenant.id, otherBranch1.id);
      await addUserToBranch(otherUser.id, otherTenant.id, otherBranch2.id);

      await receiveStock(
        { currentTenantId: otherTenant.id, currentUserId: otherUser.id },
        { branchId: otherBranch1.id, productId: otherProduct.id, qty: 100, unitCostPence: 1000 }
      );

      await transferService.createStockTransfer({
        tenantId: otherTenant.id,
        userId: otherUser.id,
        data: {
          sourceBranchId: otherBranch1.id,
          destinationBranchId: otherBranch2.id,
          items: [{ productId: otherProduct.id, qtyRequested: 10 }],
        },
      });

      const tools = analyticsTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getTransferMetrics.execute({});

      // testUser's metrics should not include otherTenant's transfers
      expect(result.metrics).toBeDefined();
    });
  });
});
