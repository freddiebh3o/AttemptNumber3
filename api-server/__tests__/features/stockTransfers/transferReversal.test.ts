// api-server/__tests__/features/stockTransfers/transferReversal.test.ts
import {
  createStockTransfer,
  reviewStockTransfer,
  shipStockTransfer,
  receiveStockTransfer,
  reverseStockTransfer,
  getStockTransfer,
} from '../../../src/services/stockTransfers/stockTransferService.js';
import {
  createTestTenant,
  createTestUser,
  createTestProduct,
  createTestBranch,
  createTestMembership,
  createTestRoleWithPermissions,
} from '../../helpers/factories.js';
import { prismaClientInstance as prisma } from '../../../src/db/prismaClient.js';
import { receiveStock } from '../../../src/services/stockService.js';
import { ROLE_DEFS } from '../../../src/rbac/catalog.js';

describe('[TRANSFER-REVERSAL] Stock Transfer Reversal Linking', () => {
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let sourceBranch: Awaited<ReturnType<typeof createTestBranch>>;
  let destBranch: Awaited<ReturnType<typeof createTestBranch>>;
  let product: Awaited<ReturnType<typeof createTestProduct>>;

  beforeEach(async () => {
    // Create test data
    testTenant = await createTestTenant();
    testUser = await createTestUser();

    // Create OWNER role with all permissions
    const ownerRole = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ROLE_DEFS.OWNER,
    });

    // Create membership
    await createTestMembership({
      userId: testUser.id,
      tenantId: testTenant.id,
      roleId: ownerRole.id,
    });

    // Create branches
    sourceBranch = await createTestBranch({
      tenantId: testTenant.id,
      name: 'Warehouse A',
    });

    destBranch = await createTestBranch({
      tenantId: testTenant.id,
      name: 'Store B',
    });

    // Create branch memberships
    await prisma.userBranchMembership.create({
      data: {
        userId: testUser.id,
        tenantId: testTenant.id,
        branchId: sourceBranch.id,
      },
    });

    await prisma.userBranchMembership.create({
      data: {
        userId: testUser.id,
        tenantId: testTenant.id,
        branchId: destBranch.id,
      },
    });

    // Create product
    product = await createTestProduct({
      tenantId: testTenant.id,
      name: 'Test Widget',
      sku: `WIDGET-${Date.now()}`,
      pricePence: 1000,
    });

    // Add stock at source branch
    await receiveStock(
      { currentTenantId: testTenant.id, currentUserId: testUser.id },
      {
        branchId: sourceBranch.id,
        productId: product.id,
        qty: 100,
        unitCostPence: 500,
        reason: 'Initial stock',
      }
    );
  });

  describe('Bidirectional Reversal Link Creation', () => {
    it('should create bidirectional link when reversing a transfer', async () => {
      // Step 1: Create and complete a transfer
      const transfer = await createStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destBranch.id,
          items: [{ productId: product.id, qtyRequested: 10 }],
        },
      });

      await reviewStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: transfer.id,
        action: 'approve',
      });

      await shipStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: transfer.id,
      });

      await receiveStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: transfer.id,
        receivedItems: [{ itemId: transfer.items[0]?.id ?? '', qtyReceived: 10 }],
      });

      // Step 2: Reverse the transfer
      const reversal = await reverseStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: transfer.id,
        reversalReason: 'Damaged goods',
      });

      // Step 3: Verify bidirectional link - reversal points to original
      expect(reversal.reversalOfId).toBe(transfer.id);
      expect(reversal.isReversal).toBe(true);

      // Step 4: Verify bidirectional link - original points to reversal
      const updatedOriginal = await prisma.stockTransfer.findUnique({
        where: { id: transfer.id },
        select: { reversedByTransferId: true },
      });

      expect(updatedOriginal?.reversedByTransferId).toBe(reversal.id);
    });

    it('should load reversal relationships when getting transfer', async () => {
      // Create and complete a transfer
      const transfer = await createStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destBranch.id,
          items: [{ productId: product.id, qtyRequested: 10 }],
        },
      });

      await reviewStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: transfer.id,
        action: 'approve',
      });

      await shipStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: transfer.id,
      });

      await receiveStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: transfer.id,
        receivedItems: [{ itemId: transfer.items[0]?.id ?? '', qtyReceived: 10 }],
      });

      // Reverse the transfer
      const reversal = await reverseStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: transfer.id,
        reversalReason: 'Wrong shipment',
      });

      // Get original transfer - should include reversedBy relation
      const originalWithRelations = await getStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: transfer.id,
      });

      expect(originalWithRelations.reversedBy).toBeDefined();
      expect(originalWithRelations.reversedBy?.id).toBe(reversal.id);
      expect(originalWithRelations.reversedBy?.transferNumber).toBe(reversal.transferNumber);

      // Get reversal transfer - should include reversalOf relation
      const reversalWithRelations = await getStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: reversal.id,
      });

      expect(reversalWithRelations.reversalOf).toBeDefined();
      expect(reversalWithRelations.reversalOf?.id).toBe(transfer.id);
      expect(reversalWithRelations.reversalOf?.transferNumber).toBe(transfer.transferNumber);
    });
  });

  describe('Reversal Reason Propagation', () => {
    it('should propagate reversal reason to orderNotes with transfer number prefix', async () => {
      // Create and complete a transfer
      const transfer = await createStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destBranch.id,
          items: [{ productId: product.id, qtyRequested: 10 }],
        },
      });

      await reviewStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: transfer.id,
        action: 'approve',
      });

      await shipStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: transfer.id,
      });

      await receiveStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: transfer.id,
        receivedItems: [{ itemId: transfer.items[0]?.id ?? '', qtyReceived: 10 }],
      });

      // Reverse with reason
      const reversalReason = 'Items were damaged during shipping';
      const reversal = await reverseStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: transfer.id,
        reversalReason,
      });

      // Verify reason is stored in reversalReason field
      expect(reversal.reversalReason).toBe(reversalReason);

      // Verify reason is propagated to orderNotes with prefix
      expect(reversal.orderNotes).toBe(`Reversal of ${transfer.transferNumber}: ${reversalReason}`);
    });

    it('should handle reversal without reason (null orderNotes)', async () => {
      // Create and complete a transfer
      const transfer = await createStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destBranch.id,
          items: [{ productId: product.id, qtyRequested: 10 }],
        },
      });

      await reviewStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: transfer.id,
        action: 'approve',
      });

      await shipStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: transfer.id,
      });

      await receiveStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: transfer.id,
        receivedItems: [{ itemId: transfer.items[0]?.id ?? '', qtyReceived: 10 }],
      });

      // Reverse without reason
      const reversal = await reverseStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: transfer.id,
      });

      // Verify reason is null
      expect(reversal.reversalReason).toBeNull();

      // Verify orderNotes is null when no reason provided
      expect(reversal.orderNotes).toBeNull();
    });

    it('should make reversal reason visible on both transfers when queried', async () => {
      // Create and complete a transfer
      const transfer = await createStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destBranch.id,
          items: [{ productId: product.id, qtyRequested: 10 }],
        },
      });

      await reviewStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: transfer.id,
        action: 'approve',
      });

      await shipStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: transfer.id,
      });

      await receiveStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: transfer.id,
        receivedItems: [{ itemId: transfer.items[0]?.id ?? '', qtyReceived: 10 }],
      });

      // Reverse with reason
      const reversalReason = 'Quality control failure';
      await reverseStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: transfer.id,
        reversalReason,
      });

      // Get original transfer with relations
      const originalWithRelations = await getStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: transfer.id,
      });

      // Reversal reason should be accessible via reversedBy relation
      expect(originalWithRelations.reversedBy?.reversalReason).toBe(reversalReason);

      // Get reversal transfer
      const reversalTransfer = await getStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: originalWithRelations.reversedBy!.id,
      });

      // Reversal reason should be in reversalReason field
      expect(reversalTransfer.reversalReason).toBe(reversalReason);

      // Reversal reason should also be in orderNotes with prefix
      expect(reversalTransfer.orderNotes).toContain(reversalReason);
      expect(reversalTransfer.orderNotes).toContain(transfer.transferNumber);
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should not allow access to reversal from different tenant', async () => {
      // Create second tenant
      const tenant2 = await createTestTenant();
      const user2 = await createTestUser();

      const role2 = await createTestRoleWithPermissions({
        tenantId: tenant2.id,
        permissionKeys: ROLE_DEFS.OWNER,
      });

      await createTestMembership({
        userId: user2.id,
        tenantId: tenant2.id,
        roleId: role2.id,
      });

      // Create and complete a transfer for tenant 1
      const transfer = await createStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destBranch.id,
          items: [{ productId: product.id, qtyRequested: 10 }],
        },
      });

      await reviewStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: transfer.id,
        action: 'approve',
      });

      await shipStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: transfer.id,
      });

      await receiveStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: transfer.id,
        receivedItems: [{ itemId: transfer.items[0]?.id ?? '', qtyReceived: 10 }],
      });

      const reversal = await reverseStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: transfer.id,
        reversalReason: 'Test reversal',
      });

      // Attempt to access reversal from tenant 2 - should fail
      await expect(
        getStockTransfer({
          tenantId: tenant2.id, // Different tenant
          userId: user2.id,
          transferId: reversal.id,
        })
      ).rejects.toThrow('not found');
    });
  });

  describe('Edge Cases', () => {
    it('should prevent double reversal', async () => {
      // Create and complete a transfer
      const transfer = await createStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destBranch.id,
          items: [{ productId: product.id, qtyRequested: 10 }],
        },
      });

      await reviewStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: transfer.id,
        action: 'approve',
      });

      await shipStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: transfer.id,
      });

      await receiveStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: transfer.id,
        receivedItems: [{ itemId: transfer.items[0]?.id ?? '', qtyReceived: 10 }],
      });

      // First reversal - should succeed
      await reverseStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: transfer.id,
        reversalReason: 'First reversal',
      });

      // Second reversal - should fail
      await expect(
        reverseStockTransfer({
          tenantId: testTenant.id,
          userId: testUser.id,
          transferId: transfer.id,
          reversalReason: 'Second reversal',
        })
      ).rejects.toThrow('already been reversed');
    });

    it('should handle reversal of reversal (chain integrity)', async () => {
      // Create and complete original transfer
      const original = await createStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destBranch.id,
          items: [{ productId: product.id, qtyRequested: 10 }],
        },
      });

      await reviewStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: original.id,
        action: 'approve',
      });

      await shipStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: original.id,
      });

      await receiveStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: original.id,
        receivedItems: [{ itemId: original.items[0]?.id ?? '', qtyReceived: 10 }],
      });

      // First reversal
      const reversal1 = await reverseStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: original.id,
        reversalReason: 'First reversal',
      });

      // Add stock back at dest branch (where reversal consumed from)
      await receiveStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: destBranch.id,
          productId: product.id,
          qty: 20,
          unitCostPence: 500,
          reason: 'Restock for second reversal',
        }
      );

      // Second reversal (reversal of reversal) - should succeed
      const reversal2 = await reverseStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        transferId: reversal1.id,
        reversalReason: 'Second reversal',
      });

      // Verify chain integrity
      expect(reversal1.reversalOfId).toBe(original.id); // reversal1 points to original
      expect(reversal2.reversalOfId).toBe(reversal1.id); // reversal2 points to reversal1

      // Verify bidirectional links
      const updatedOriginal = await prisma.stockTransfer.findUnique({
        where: { id: original.id },
        select: { reversedByTransferId: true },
      });
      expect(updatedOriginal?.reversedByTransferId).toBe(reversal1.id);

      const updatedReversal1 = await prisma.stockTransfer.findUnique({
        where: { id: reversal1.id },
        select: { reversedByTransferId: true },
      });
      expect(updatedReversal1?.reversedByTransferId).toBe(reversal2.id);
    });
  });
});
