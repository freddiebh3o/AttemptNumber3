// api-server/__tests__/services/chat/branchTools.test.ts
import { branchTools } from '../../../../src/services/chat/tools/branchTools.js';
import { receiveStock } from '../../../../src/services/stockService.js';
import * as transferService from '../../../../src/services/stockTransfers/stockTransferService.js';
import {
  createTestUser,
  createTestTenant,
  createTestProduct,
  createTestBranch,
  createTestRoleWithPermissions,
  createTestMembership,
  addUserToBranch,
} from '../../../helpers/factories.js';

describe('[CHAT-BRANCH-001] AI Chat Branch Tools', () => {
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let branch1: Awaited<ReturnType<typeof createTestBranch>>;
  let branch2: Awaited<ReturnType<typeof createTestBranch>>;
  let branch3: Awaited<ReturnType<typeof createTestBranch>>;
  let product1: Awaited<ReturnType<typeof createTestProduct>>;

  beforeEach(async () => {
    // Create tenant and user
    testTenant = await createTestTenant();
    testUser = await createTestUser();

    // Create branches
    branch1 = await createTestBranch({
      tenantId: testTenant.id,
      name: 'Main Warehouse',
      isActive: true,
    });

    branch2 = await createTestBranch({
      tenantId: testTenant.id,
      name: 'Store A',
      isActive: true,
    });

    branch3 = await createTestBranch({
      tenantId: testTenant.id,
      name: 'Inactive Warehouse',
      isActive: false,
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

    // Create product
    product1 = await createTestProduct({
      tenantId: testTenant.id,
      name: 'Widget Alpha',
      sku: 'WID-001',
      pricePence: 1500,
    });
  });

  describe('[AC-BRANCH-001] listBranches', () => {
    it('should list all active branches', async () => {
      const tools = branchTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.listBranches.execute({
        includeInactive: false,
      });

      expect(result.branches.length).toBeGreaterThanOrEqual(2);
      expect(result.branches.every((b) => b.isActive === true)).toBe(true);
    });

    it('should include inactive branches when requested', async () => {
      const tools = branchTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.listBranches.execute({
        includeInactive: true,
      });

      expect(result.branches.some((b) => b.name === 'Inactive Warehouse')).toBe(true);
    });

    it('should show member count for each branch', async () => {
      const tools = branchTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.listBranches.execute({});

      const mainWarehouse = result.branches.find((b) => b.name === 'Main Warehouse');
      expect(mainWarehouse?.memberCount).toBeGreaterThanOrEqual(1);
    });

    it('should respect limit parameter', async () => {
      const tools = branchTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.listBranches.execute({
        limit: 1,
      });

      expect(result.branches.length).toBeLessThanOrEqual(1);
    });

    it('should cap limit at 20', async () => {
      const tools = branchTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.listBranches.execute({
        limit: 50,
      });

      expect(result.branches.length).toBeLessThanOrEqual(20);
    });

    it('should sort branches by name', async () => {
      const tools = branchTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.listBranches.execute({});

      // Check if branches are sorted alphabetically
      for (let i = 1; i < result.branches.length; i++) {
        const prev = result.branches[i - 1]!.name;
        const curr = result.branches[i]!.name;
        expect(prev.localeCompare(curr)).toBeLessThanOrEqual(0);
      }
    });
  });

  describe('[AC-BRANCH-002] getBranchDetails', () => {
    beforeEach(async () => {
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

      // Create a transfer involving branch1
      await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          sourceBranchId: branch1.id,
          destinationBranchId: branch2.id,
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });
    });

    it('should get branch details by ID', async () => {
      const tools = branchTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getBranchDetails.execute({
        branchId: branch1.id,
      });

      expect(result.id).toBe(branch1.id);
      expect(result.name).toBe('Main Warehouse');
      expect(result.isActive).toBe(true);
    });

    it('should get branch details by name', async () => {
      const tools = branchTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getBranchDetails.execute({
        branchName: 'Main Warehouse',
      });

      expect(result.id).toBe(branch1.id);
      expect(result.name).toBe('Main Warehouse');
    });

    it('should include member count', async () => {
      const tools = branchTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getBranchDetails.execute({
        branchId: branch1.id,
      });

      expect(result.stats.memberCount).toBeGreaterThanOrEqual(1);
    });

    it('should include product count', async () => {
      const tools = branchTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getBranchDetails.execute({
        branchId: branch1.id,
      });

      expect(result.stats.productCount).toBeGreaterThanOrEqual(1);
    });

    it('should include products with stock count', async () => {
      const tools = branchTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getBranchDetails.execute({
        branchId: branch1.id,
      });

      expect(result.stats.productsWithStock).toBeGreaterThanOrEqual(1);
    });

    it('should calculate total stock value', async () => {
      const tools = branchTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getBranchDetails.execute({
        branchId: branch1.id,
      });

      expect(result.stats.totalStockValue).toContain('£');
      // 1000 units * £15.00 = £15,000.00
      expect(result.stats.totalStockValue).toBe('£15000.00');
    });

    it('should show recent transfers (last 30 days)', async () => {
      const tools = branchTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getBranchDetails.execute({
        branchId: branch1.id,
      });

      expect(result.stats.recentTransfers).toBeGreaterThanOrEqual(1);
    });

    it('should return error if branch not found', async () => {
      const tools = branchTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getBranchDetails.execute({
        branchId: 'non-existent-id',
      });

      expect(result.error).toBe('Unable to get branch details');
    });

    it('should return error if neither ID nor name provided', async () => {
      const tools = branchTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getBranchDetails.execute({});

      expect(result.error).toBe('Branch not found');
    });

    it('should handle branch with no stock', async () => {
      const tools = branchTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getBranchDetails.execute({
        branchId: branch2.id,
      });

      expect(result.stats.productsWithStock).toBe(0);
      expect(result.stats.totalStockValue).toBe('£0.00');
    });
  });

  describe('[AC-BRANCH-003] Security - Tenant Isolation', () => {
    it('should not list branches from other tenants', async () => {
      const otherTenant = await createTestTenant();
      const otherBranch = await createTestBranch({
        tenantId: otherTenant.id,
        name: 'Other Tenant Branch',
      });

      const tools = branchTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.listBranches.execute({});

      expect(result.branches.some((b) => b.id === otherBranch.id)).toBe(false);
    });

    it('should not get details for branches from other tenants', async () => {
      const otherTenant = await createTestTenant();
      const otherBranch = await createTestBranch({
        tenantId: otherTenant.id,
      });

      const tools = branchTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getBranchDetails.execute({
        branchId: otherBranch.id,
      });

      expect(result.error).toBe('Unable to get branch details');
    });
  });

  describe('[AC-BRANCH-004] Branch Access - No Permission Required', () => {
    it('should list branches even for users with no branch memberships', async () => {
      // Create user with no branch memberships
      const userWithoutBranches = await createTestUser();
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'],
      });
      await createTestMembership({
        userId: userWithoutBranches.id,
        tenantId: testTenant.id,
        roleId: role.id,
      });

      const tools = branchTools({
        userId: userWithoutBranches.id,
        tenantId: testTenant.id,
      });

      const result = await tools.listBranches.execute({});

      // User should still see branches (no permission required)
      expect(result.branches.length).toBeGreaterThanOrEqual(2);
    });

    it('should get branch details even for users with no branch memberships', async () => {
      // Create user with no branch memberships
      const userWithoutBranches = await createTestUser();
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'],
      });
      await createTestMembership({
        userId: userWithoutBranches.id,
        tenantId: testTenant.id,
        roleId: role.id,
      });

      const tools = branchTools({
        userId: userWithoutBranches.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getBranchDetails.execute({
        branchId: branch1.id,
      });

      // User should still see branch details (no permission required)
      expect(result.id).toBe(branch1.id);
    });
  });

  describe('[AC-BRANCH-005] Pagination', () => {
    it('should indicate if more branches are available', async () => {
      // Create more than 20 branches to test pagination
      for (let i = 0; i < 22; i++) {
        await createTestBranch({
          tenantId: testTenant.id,
          name: `Test Branch ${i}`,
        });
      }

      const tools = branchTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.listBranches.execute({
        limit: 20,
      });

      expect(result.hasMore).toBe(true);
    });
  });
});
