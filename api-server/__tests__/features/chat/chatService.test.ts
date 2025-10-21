// api-server/__tests__/services/chat.test.ts
import * as chatService from '../../../src/services/chat/chatService.js';
import * as transferService from '../../../src/services/stockTransfers/stockTransferService.js';
import { receiveStock } from '../../../src/services/stockService.js';
import { transferTools } from '../../../src/services/chat/tools/transferTools.js';
import { buildSystemMessage } from '../../../src/services/chat/promptBuilder.js';
import {
  createTestUser,
  createTestTenant,
  createTestProduct,
  createTestBranch,
  createTestRoleWithPermissions,
  createTestMembership,
  addUserToBranch,
} from '../../helpers/factories.js';
import { prismaClientInstance as prisma } from '../../../src/db/prismaClient.js';
import type { Response } from 'express';

describe('[CHAT-001] AI Chat Service', () => {
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let ownerUser: Awaited<ReturnType<typeof createTestUser>>;
  let viewerUser: Awaited<ReturnType<typeof createTestUser>>;
  let sourceBranch: Awaited<ReturnType<typeof createTestBranch>>;
  let destinationBranch: Awaited<ReturnType<typeof createTestBranch>>;
  let product1: Awaited<ReturnType<typeof createTestProduct>>;
  let product2: Awaited<ReturnType<typeof createTestProduct>>;

  beforeEach(async () => {
    // Create tenant
    testTenant = await createTestTenant();

    // Create users with different roles
    ownerUser = await createTestUser();
    viewerUser = await createTestUser();

    // Create branches
    sourceBranch = await createTestBranch({
      tenantId: testTenant.id,
    });
    destinationBranch = await createTestBranch({
      tenantId: testTenant.id,
    });

    // Create products
    product1 = await createTestProduct({
      tenantId: testTenant.id,
    });
    product2 = await createTestProduct({
      tenantId: testTenant.id,
    });

    // Create roles
    const ownerRole = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ['stock:read', 'stock:write', 'products:read', 'products:write'],
    });

    const viewerRole = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ['stock:read', 'products:read'],
    });

    // Add users to tenant
    await createTestMembership({
      userId: ownerUser.id,
      tenantId: testTenant.id,
      roleId: ownerRole.id,
    });
    await createTestMembership({
      userId: viewerUser.id,
      tenantId: testTenant.id,
      roleId: viewerRole.id,
    });

    // Add owner to both branches
    await addUserToBranch(ownerUser.id, testTenant.id, sourceBranch.id);
    await addUserToBranch(ownerUser.id, testTenant.id, destinationBranch.id);

    // Add viewer only to destination branch
    await addUserToBranch(viewerUser.id, testTenant.id, destinationBranch.id);

    // Add stock to source branch
    await receiveStock(
      { currentTenantId: testTenant.id, currentUserId: ownerUser.id },
      {
        branchId: sourceBranch.id,
        productId: product1.id,
        qty: 1000,
        unitCostPence: 1200,
      }
    );
  });

  describe('[AC-CHAT-001] System Message Builder', () => {
    it('should include user context in system message', () => {
      const systemMessage = buildSystemMessage({
        userName: 'test@example.com',
        userRole: 'OWNER',
        permissions: ['stock:read', 'stock:write'],
        branchMemberships: [
          { branchId: sourceBranch.id, branchName: 'Main Warehouse' },
        ],
        tenantId: testTenant.id,
      });

      expect(systemMessage).toContain('test@example.com');
      expect(systemMessage).toContain('OWNER');
      expect(systemMessage).toContain('stock:read');
      expect(systemMessage).toContain('Main Warehouse');
    });

    it('should include security rules', () => {
      const systemMessage = buildSystemMessage({
        userName: 'test@example.com',
        permissions: [],
        branchMemberships: [],
        tenantId: testTenant.id,
      });

      expect(systemMessage).toContain('IMPORTANT SECURITY RULES');
      expect(systemMessage).toContain('branch memberships');
      expect(systemMessage).toContain('NEVER bypass permission checks');
    });

    it('should handle user with no branch memberships', () => {
      const systemMessage = buildSystemMessage({
        userName: 'test@example.com',
        permissions: [],
        branchMemberships: [],
        tenantId: testTenant.id,
      });

      expect(systemMessage).toContain('None');
    });

    it('should include optional role when provided', () => {
      const systemMessage = buildSystemMessage({
        userName: 'test@example.com',
        userRole: 'ADMIN',
        permissions: [],
        branchMemberships: [],
        tenantId: testTenant.id,
      });

      expect(systemMessage).toContain('ADMIN');
    });
  });

  describe('[AC-CHAT-002] Transfer Tools - searchTransfers', () => {
    beforeEach(async () => {
      // Create some test transfers
      await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: ownerUser.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          requestNotes: 'Urgent transfer',
          priority: 'URGENT',
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });

      await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: ownerUser.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          requestNotes: 'Normal transfer',
          priority: 'NORMAL',
          items: [{ productId: product2.id, qtyRequested: 50 }],
        },
      });
    });

    it('should list transfers for user with branch access', async () => {
      const tools = transferTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.searchTransfers.execute({});

      expect(result.transfers.length).toBeGreaterThan(0);
      expect(result.count).toBeGreaterThan(0);
    });

    it('should filter by status', async () => {
      const tools = transferTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.searchTransfers.execute({
        status: 'REQUESTED',
      });

      expect(result.transfers.every((t) => t.status === 'REQUESTED')).toBe(true);
    });

    it('should filter by priority', async () => {
      const tools = transferTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.searchTransfers.execute({
        priority: 'URGENT',
      });

      expect(result.transfers.every((t) => t.priority === 'URGENT')).toBe(true);
    });

    it('should filter by direction (inbound)', async () => {
      const tools = transferTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.searchTransfers.execute({
        branchId: destinationBranch.id,
        direction: 'inbound',
      });

      expect(result.transfers.every((t) => t.destinationBranch !== 'Unknown')).toBe(true);
    });

    it('should filter by direction (outbound)', async () => {
      const tools = transferTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.searchTransfers.execute({
        branchId: sourceBranch.id,
        direction: 'outbound',
      });

      expect(result.transfers.every((t) => t.sourceBranch !== 'Unknown')).toBe(true);
    });

    it('should limit results (max 10)', async () => {
      const tools = transferTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.searchTransfers.execute({
        limit: 20, // Request 20, but should cap at 10
      });

      expect(result.transfers.length).toBeLessThanOrEqual(10);
    });

    it('should only show transfers for branches user is member of', async () => {
      // Create a third branch that owner is NOT a member of
      const thirdBranch = await createTestBranch({
        tenantId: testTenant.id,
      });

      // Create a third user who is only member of thirdBranch
      const thirdUser = await createTestUser();
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['stock:read', 'stock:write'],
      });
      await createTestMembership({
        userId: thirdUser.id,
        tenantId: testTenant.id,
        roleId: role.id,
      });
      await addUserToBranch(thirdUser.id, testTenant.id, thirdBranch.id);
      await addUserToBranch(thirdUser.id, testTenant.id, sourceBranch.id);

      // Add stock to thirdBranch
      await receiveStock(
        { currentTenantId: testTenant.id, currentUserId: thirdUser.id },
        {
          branchId: thirdBranch.id,
          productId: product1.id,
          qty: 500,
          unitCostPence: 1200,
        }
      );

      // Create transfer from thirdBranch to sourceBranch
      await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: thirdUser.id,
        data: {
          sourceBranchId: thirdBranch.id,
          destinationBranchId: sourceBranch.id,
          items: [{ productId: product1.id, qtyRequested: 50 }],
        },
      });

      // Owner should NOT see this transfer (not member of thirdBranch)
      const tools = transferTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.searchTransfers.execute({});

      // Owner should only see transfers where they are member of source OR destination
      // They are member of sourceBranch and destinationBranch, but NOT thirdBranch
      result.transfers.forEach((t) => {
        const isOwnerBranch =
          t.sourceBranch === sourceBranch.branchName ||
          t.sourceBranch === destinationBranch.branchName ||
          t.destinationBranch === sourceBranch.branchName ||
          t.destinationBranch === destinationBranch.branchName;
        expect(isOwnerBranch).toBe(true);
      });
    });
  });

  describe('[AC-CHAT-003] Transfer Tools - getTransferDetails', () => {
    it('should get transfer details by ID', async () => {
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: ownerUser.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          requestNotes: 'Test notes',
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });

      const tools = transferTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getTransferDetails.execute({
        transferId: transfer.id,
      });

      expect(result.transferNumber).toBe(transfer.transferNumber);
      expect(result.status).toBe('REQUESTED');
      expect(result.items).toHaveLength(1);
    });

    it('should get transfer details by transfer number', async () => {
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: ownerUser.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });

      const tools = transferTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getTransferDetails.execute({
        transferNumber: transfer.transferNumber,
      });

      expect(result.transferNumber).toBe(transfer.transferNumber);
    });

    it('should return error if transfer not found', async () => {
      const tools = transferTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getTransferDetails.execute({
        transferId: 'non-existent-id',
      });

      expect(result.error).toBeDefined();
      expect(result.message).toContain('not found');
    });

    it('should return error if user does not have access', async () => {
      // Create two branches that ownerUser is NOT a member of
      const thirdBranch = await createTestBranch({
        tenantId: testTenant.id,
      });
      const fourthBranch = await createTestBranch({
        tenantId: testTenant.id,
      });

      const thirdUser = await createTestUser();
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['stock:read', 'stock:write'],
      });
      await createTestMembership({
        userId: thirdUser.id,
        tenantId: testTenant.id,
        roleId: role.id,
      });
      await addUserToBranch(thirdUser.id, testTenant.id, thirdBranch.id);
      await addUserToBranch(thirdUser.id, testTenant.id, fourthBranch.id);

      // Add stock
      await receiveStock(
        { currentTenantId: testTenant.id, currentUserId: thirdUser.id },
        {
          branchId: thirdBranch.id,
          productId: product1.id,
          qty: 500,
          unitCostPence: 1200,
        }
      );

      // Create transfer between branches owner is NOT a member of
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: thirdUser.id,
        data: {
          sourceBranchId: thirdBranch.id,
          destinationBranchId: fourthBranch.id,
          items: [{ productId: product1.id, qtyRequested: 50 }],
        },
      });

      // Owner tries to access (not member of either branch)
      const tools = transferTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getTransferDetails.execute({
        transferId: transfer.id,
      });

      expect(result.error).toBeDefined();
      expect(result.message).toContain('permission');
    });
  });

  describe('[AC-CHAT-004] Transfer Tools - getApprovalStatus', () => {
    it('should return status for non-multi-level transfer', async () => {
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: ownerUser.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });

      const tools = transferTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getApprovalStatus.execute({
        transferId: transfer.id,
      });

      expect(result.requiresMultiLevelApproval).toBe(false);
      expect(result.status).toBe('REQUESTED');
      expect(result.message).toContain('simple approval');
    });

    it('should return error if transfer not found', async () => {
      const tools = transferTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getApprovalStatus.execute({
        transferId: 'non-existent-id',
      });

      expect(result.error).toBeDefined();
    });

    it('should return error if user does not have access', async () => {
      // Create transfer that viewer can't access (not member of source branch)
      const thirdBranch = await createTestBranch({
        tenantId: testTenant.id,
      });
      const thirdUser = await createTestUser();
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['stock:read', 'stock:write'],
      });
      await createTestMembership({
        userId: thirdUser.id,
        tenantId: testTenant.id,
        roleId: role.id,
      });
      await addUserToBranch(thirdUser.id, testTenant.id, thirdBranch.id);
      await addUserToBranch(thirdUser.id, testTenant.id, sourceBranch.id);

      await receiveStock(
        { currentTenantId: testTenant.id, currentUserId: thirdUser.id },
        {
          branchId: thirdBranch.id,
          productId: product1.id,
          qty: 500,
          unitCostPence: 1200,
        }
      );

      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: thirdUser.id,
        data: {
          sourceBranchId: thirdBranch.id,
          destinationBranchId: sourceBranch.id,
          items: [{ productId: product1.id, qtyRequested: 50 }],
        },
      });

      // Viewer tries to access (not member of thirdBranch)
      const tools = transferTools({
        userId: viewerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getApprovalStatus.execute({
        transferId: transfer.id,
      });

      expect(result.error).toBeDefined();
    });
  });

  describe('[AC-CHAT-005] Security - Branch Membership Filtering', () => {
    it('should filter transfers to only user branch memberships', async () => {
      // viewerUser is only member of destinationBranch
      const tools = transferTools({
        userId: viewerUser.id,
        tenantId: testTenant.id,
      });

      // Create transfer from source to destination
      await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: ownerUser.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });

      const result = await tools.searchTransfers.execute({});

      // viewerUser should see this transfer (member of destination)
      expect(result.count).toBeGreaterThan(0);
    });

    it('should not show transfers for branches user is not member of', async () => {
      // Create another branch and transfer
      const thirdBranch = await createTestBranch({
        tenantId: testTenant.id,
      });
      const fourthBranch = await createTestBranch({
        tenantId: testTenant.id,
      });

      const thirdUser = await createTestUser();
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['stock:read', 'stock:write'],
      });
      await createTestMembership({
        userId: thirdUser.id,
        tenantId: testTenant.id,
        roleId: role.id,
      });
      await addUserToBranch(thirdUser.id, testTenant.id, thirdBranch.id);
      await addUserToBranch(thirdUser.id, testTenant.id, fourthBranch.id);

      await receiveStock(
        { currentTenantId: testTenant.id, currentUserId: thirdUser.id },
        {
          branchId: thirdBranch.id,
          productId: product1.id,
          qty: 500,
          unitCostPence: 1200,
        }
      );

      // Create transfer between thirdBranch and fourthBranch
      await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: thirdUser.id,
        data: {
          sourceBranchId: thirdBranch.id,
          destinationBranchId: fourthBranch.id,
          items: [{ productId: product1.id, qtyRequested: 50 }],
        },
      });

      // viewerUser should NOT see this (not member of either branch)
      const tools = transferTools({
        userId: viewerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.searchTransfers.execute({});

      // Verify all transfers are for branches viewer is member of
      result.transfers.forEach((t) => {
        const isRelevant =
          t.sourceBranch === destinationBranch.branchName ||
          t.destinationBranch === destinationBranch.branchName;
        expect(isRelevant).toBe(true);
      });
    });
  });

  describe('[AC-CHAT-006] Security - Tenant Isolation', () => {
    it('should not show transfers from other tenants', async () => {
      // Create another tenant
      const otherTenant = await createTestTenant();
      const otherUser = await createTestUser();
      const otherBranch1 = await createTestBranch({
        tenantId: otherTenant.id,
      });
      const otherBranch2 = await createTestBranch({
        tenantId: otherTenant.id,
      });

      const role = await createTestRoleWithPermissions({
        tenantId: otherTenant.id,
        permissionKeys: ['stock:read', 'stock:write'],
      });

      await createTestMembership({
        userId: otherUser.id,
        tenantId: otherTenant.id,
        roleId: role.id,
      });
      await addUserToBranch(otherUser.id, otherTenant.id, otherBranch1.id);
      await addUserToBranch(otherUser.id, otherTenant.id, otherBranch2.id);

      // Create product in other tenant
      const otherProduct = await createTestProduct({
        tenantId: otherTenant.id,
      });

      await receiveStock(
        { currentTenantId: otherTenant.id, currentUserId: otherUser.id },
        {
          branchId: otherBranch1.id,
          productId: otherProduct.id,
          qty: 500,
          unitCostPence: 1200,
        }
      );

      // Create transfer in other tenant
      await transferService.createStockTransfer({
        tenantId: otherTenant.id,
        userId: otherUser.id,
        data: {
          sourceBranchId: otherBranch1.id,
          destinationBranchId: otherBranch2.id,
          items: [{ productId: otherProduct.id, qtyRequested: 50 }],
        },
      });

      // ownerUser should NOT see transfers from other tenant
      const tools = transferTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.searchTransfers.execute({});

      // Verify all transfers belong to testTenant
      const otherTenantTransfers = result.transfers.filter(
        (t) => !t.sourceBranch.includes(sourceBranch.branchName.substring(0, 10))
      );
      expect(otherTenantTransfers.length).toBe(0);
    });
  });
});
