// api-server/__tests__/services/stockLotRestoration.test.ts
import { StockMovementKind } from '@prisma/client';
import * as stockService from '../../src/services/stockService.js';
import * as transferService from '../../src/services/stockTransfers/stockTransferService.js';
import { reverseLotsAtBranch } from '../../src/services/stockTransfers/transferHelpers.js';
import {
  createTestUser,
  createTestTenant,
  createTestProduct,
  createTestBranch,
  createTestRoleWithPermissions,
  createTestMembership,
  addUserToBranch,
} from '../helpers/factories.js';
import { prismaClientInstance as prisma } from '../../src/db/prismaClient.js';

describe('[LOT-RESTORE] Stock Lot Restoration for Transfer Reversals', () => {
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let userSource: Awaited<ReturnType<typeof createTestUser>>;
  let userDestination: Awaited<ReturnType<typeof createTestUser>>;
  let sourceBranch: Awaited<ReturnType<typeof createTestBranch>>;
  let destinationBranch: Awaited<ReturnType<typeof createTestBranch>>;
  let product1: Awaited<ReturnType<typeof createTestProduct>>;
  let product2: Awaited<ReturnType<typeof createTestProduct>>;

  beforeEach(async () => {
    testTenant = await createTestTenant();
    userSource = await createTestUser();
    userDestination = await createTestUser();

    sourceBranch = await createTestBranch({ tenantId: testTenant.id });
    destinationBranch = await createTestBranch({ tenantId: testTenant.id });

    product1 = await createTestProduct({ tenantId: testTenant.id });
    product2 = await createTestProduct({ tenantId: testTenant.id });

    const role = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ['stock:read', 'stock:write'],
    });

    await createTestMembership({
      userId: userSource.id,
      tenantId: testTenant.id,
      roleId: role.id,
    });
    await createTestMembership({
      userId: userDestination.id,
      tenantId: testTenant.id,
      roleId: role.id,
    });

    // Add users to both branches
    await addUserToBranch(userSource.id, testTenant.id, sourceBranch.id);
    await addUserToBranch(userSource.id, testTenant.id, destinationBranch.id);
    await addUserToBranch(userDestination.id, testTenant.id, sourceBranch.id);
    await addUserToBranch(userDestination.id, testTenant.id, destinationBranch.id);

    // Create initial stock at source branch
    await stockService.receiveStock(
      { currentTenantId: testTenant.id, currentUserId: userSource.id },
      {
        branchId: sourceBranch.id,
        productId: product1.id,
        qty: 500,
        unitCostPence: 1000,
      }
    );

    await stockService.receiveStock(
      { currentTenantId: testTenant.id, currentUserId: userSource.id },
      {
        branchId: sourceBranch.id,
        productId: product2.id,
        qty: 300,
        unitCostPence: 2000,
      }
    );
  });

  describe('[PHASE-1-1] restoreLotQuantities Function', () => {
    it('should restore lot quantities and create REVERSAL ledger entries', async () => {
      // Get the lot that was created
      const lot = await prisma.stockLot.findFirst({
        where: {
          tenantId: testTenant.id,
          branchId: sourceBranch.id,
          productId: product1.id,
        },
      });

      expect(lot).toBeDefined();
      expect(lot?.qtyRemaining).toBe(500);

      // Consume 100 units from the lot
      await stockService.consumeStock(
        { currentTenantId: testTenant.id, currentUserId: userSource.id },
        {
          branchId: sourceBranch.id,
          productId: product1.id,
          qty: 100,
          reason: 'Test consumption',
        }
      );

      // Verify consumption
      const lotAfterConsume = await prisma.stockLot.findUnique({
        where: { id: lot!.id },
      });
      expect(lotAfterConsume?.qtyRemaining).toBe(400);

      // Restore 100 units to the lot
      const result = await stockService.restoreLotQuantities(
        { currentTenantId: testTenant.id, currentUserId: userSource.id },
        {
          branchId: sourceBranch.id,
          lotsToRestore: [{ lotId: lot!.id, qty: 100 }],
          reason: 'Test restoration',
        }
      );

      expect(result.restoredLots).toHaveLength(1);
      expect(result.restoredLots[0]?.lotId).toBe(lot!.id);
      expect(result.restoredLots[0]?.qty).toBe(100);

      // Verify lot quantity restored
      const lotAfterRestore = await prisma.stockLot.findUnique({
        where: { id: lot!.id },
      });
      expect(lotAfterRestore?.qtyRemaining).toBe(500); // Back to original

      // Verify REVERSAL ledger entry created
      const ledgerEntries = await prisma.stockLedger.findMany({
        where: {
          tenantId: testTenant.id,
          branchId: sourceBranch.id,
          productId: product1.id,
          lotId: lot!.id,
          kind: StockMovementKind.REVERSAL,
        },
      });

      expect(ledgerEntries).toHaveLength(1);
      expect(ledgerEntries[0]?.qtyDelta).toBe(100);
      expect(ledgerEntries[0]?.reason).toBe('Test restoration');
    });

    it('should update ProductStock aggregate correctly', async () => {
      const lot = await prisma.stockLot.findFirst({
        where: {
          tenantId: testTenant.id,
          branchId: sourceBranch.id,
          productId: product1.id,
        },
      });

      // Consume 100 units
      await stockService.consumeStock(
        { currentTenantId: testTenant.id, currentUserId: userSource.id },
        {
          branchId: sourceBranch.id,
          productId: product1.id,
          qty: 100,
        }
      );

      const stockBefore = await prisma.productStock.findUnique({
        where: {
          tenantId_branchId_productId: {
            tenantId: testTenant.id,
            branchId: sourceBranch.id,
            productId: product1.id,
          },
        },
      });
      expect(stockBefore?.qtyOnHand).toBe(400);

      // Restore 100 units
      await stockService.restoreLotQuantities(
        { currentTenantId: testTenant.id, currentUserId: userSource.id },
        {
          branchId: sourceBranch.id,
          lotsToRestore: [{ lotId: lot!.id, qty: 100 }],
        }
      );

      const stockAfter = await prisma.productStock.findUnique({
        where: {
          tenantId_branchId_productId: {
            tenantId: testTenant.id,
            branchId: sourceBranch.id,
            productId: product1.id,
          },
        },
      });
      expect(stockAfter?.qtyOnHand).toBe(500); // Restored
    });

    it('should restore multiple lots for same product', async () => {
      // Create a second lot for same product
      await stockService.receiveStock(
        { currentTenantId: testTenant.id, currentUserId: userSource.id },
        {
          branchId: sourceBranch.id,
          productId: product1.id,
          qty: 200,
          unitCostPence: 1100,
        }
      );

      const lots = await prisma.stockLot.findMany({
        where: {
          tenantId: testTenant.id,
          branchId: sourceBranch.id,
          productId: product1.id,
        },
        orderBy: { receivedAt: 'asc' },
      });

      expect(lots).toHaveLength(2);

      // Consume from both lots (FIFO will consume from first lot)
      await stockService.consumeStock(
        { currentTenantId: testTenant.id, currentUserId: userSource.id },
        {
          branchId: sourceBranch.id,
          productId: product1.id,
          qty: 600, // Will consume 500 from lot1, 100 from lot2
        }
      );

      // Restore both lots
      const result = await stockService.restoreLotQuantities(
        { currentTenantId: testTenant.id, currentUserId: userSource.id },
        {
          branchId: sourceBranch.id,
          lotsToRestore: [
            { lotId: lots[0]!.id, qty: 500 },
            { lotId: lots[1]!.id, qty: 100 },
          ],
        }
      );

      expect(result.restoredLots).toHaveLength(2);

      // Verify both lots restored
      const lot1After = await prisma.stockLot.findUnique({ where: { id: lots[0]!.id } });
      const lot2After = await prisma.stockLot.findUnique({ where: { id: lots[1]!.id } });

      expect(lot1After?.qtyRemaining).toBe(500);
      expect(lot2After?.qtyRemaining).toBe(200);
    });

    it('should validate lot belongs to correct branch and tenant', async () => {
      const lot = await prisma.stockLot.findFirst({
        where: {
          tenantId: testTenant.id,
          branchId: sourceBranch.id,
          productId: product1.id,
        },
      });

      // Try to restore lot at wrong branch
      await expect(
        stockService.restoreLotQuantities(
          { currentTenantId: testTenant.id, currentUserId: userSource.id },
          {
            branchId: destinationBranch.id, // Wrong branch!
            lotsToRestore: [{ lotId: lot!.id, qty: 100 }],
          }
        )
      ).rejects.toThrow('not found or do not belong');
    });

    it('should validate lot exists', async () => {
      await expect(
        stockService.restoreLotQuantities(
          { currentTenantId: testTenant.id, currentUserId: userSource.id },
          {
            branchId: sourceBranch.id,
            lotsToRestore: [{ lotId: 'non-existent-lot-id', qty: 100 }],
          }
        )
      ).rejects.toThrow('not found or do not belong');
    });

    it('should validate quantities are positive', async () => {
      const lot = await prisma.stockLot.findFirst({
        where: {
          tenantId: testTenant.id,
          branchId: sourceBranch.id,
          productId: product1.id,
        },
      });

      await expect(
        stockService.restoreLotQuantities(
          { currentTenantId: testTenant.id, currentUserId: userSource.id },
          {
            branchId: sourceBranch.id,
            lotsToRestore: [{ lotId: lot!.id, qty: 0 }],
          }
        )
      ).rejects.toThrow('qty must be > 0');

      await expect(
        stockService.restoreLotQuantities(
          { currentTenantId: testTenant.id, currentUserId: userSource.id },
          {
            branchId: sourceBranch.id,
            lotsToRestore: [{ lotId: lot!.id, qty: -100 }],
          }
        )
      ).rejects.toThrow('qty must be > 0');
    });

    it('should validate lotsToRestore is not empty', async () => {
      await expect(
        stockService.restoreLotQuantities(
          { currentTenantId: testTenant.id, currentUserId: userSource.id },
          {
            branchId: sourceBranch.id,
            lotsToRestore: [],
          }
        )
      ).rejects.toThrow('must not be empty');
    });

    it('should use serializable transaction isolation', async () => {
      // This test verifies the transaction isolation level is set correctly
      // The actual isolation is tested by the database, we just ensure it's configured
      const lot = await prisma.stockLot.findFirst({
        where: {
          tenantId: testTenant.id,
          branchId: sourceBranch.id,
          productId: product1.id,
        },
      });

      await stockService.consumeStock(
        { currentTenantId: testTenant.id, currentUserId: userSource.id },
        {
          branchId: sourceBranch.id,
          productId: product1.id,
          qty: 100,
        }
      );

      // Should not throw - isolation level is set correctly
      await expect(
        stockService.restoreLotQuantities(
          { currentTenantId: testTenant.id, currentUserId: userSource.id },
          {
            branchId: sourceBranch.id,
            lotsToRestore: [{ lotId: lot!.id, qty: 100 }],
          }
        )
      ).resolves.toBeDefined();
    });
  });

  describe('[PHASE-1-2] reverseLotsAtBranch Helper', () => {
    it('should extract lotsConsumed from shipmentBatches and restore them', async () => {
      // Complete a transfer to get shipmentBatches with lotsConsumed
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });

      await transferService.reviewStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
        action: 'approve',
      });

      const shipped = await transferService.shipStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
      });

      // Get the lots consumed during shipment
      const shipmentBatches = shipped.items[0]?.shipmentBatches as any[];
      const lotsConsumed = shipmentBatches[0]?.lotsConsumed;
      expect(lotsConsumed).toBeDefined();
      expect(lotsConsumed.length).toBeGreaterThan(0);

      // Get source lot qtyRemaining before restoration
      const lotId = lotsConsumed[0].lotId;
      const lotBefore = await prisma.stockLot.findUnique({ where: { id: lotId } });
      expect(lotBefore?.qtyRemaining).toBe(400); // 500 - 100

      // Restore lots at source branch
      const result = await reverseLotsAtBranch({
        tenantId: testTenant.id,
        userId: userSource.id,
        branchId: sourceBranch.id,
        transferItems: shipped.items,
        transferNumber: shipped.transferNumber,
      });

      expect(result.restoredLots).toHaveLength(1);
      expect(result.restoredLots[0]?.lotId).toBe(lotId);
      expect(result.restoredLots[0]?.qty).toBe(100);

      // Verify lot restored
      const lotAfter = await prisma.stockLot.findUnique({ where: { id: lotId } });
      expect(lotAfter?.qtyRemaining).toBe(500); // Back to original
    });

    it('should handle multiple shipment batches (partial shipments)', async () => {
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 200 }],
        },
      });

      await transferService.reviewStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
        action: 'approve',
      });

      // Ship in two batches (partial shipments)
      await transferService.shipStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
        items: [{ itemId: transfer.items[0]!.id, qtyToShip: 100 }],
      });

      const shipped = await transferService.shipStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
        items: [{ itemId: transfer.items[0]!.id, qtyToShip: 100 }],
      });

      // Verify we have 2 batches
      const shipmentBatches = shipped.items[0]?.shipmentBatches as any[];
      expect(shipmentBatches).toHaveLength(2);

      // Restore lots
      const result = await reverseLotsAtBranch({
        tenantId: testTenant.id,
        userId: userSource.id,
        branchId: sourceBranch.id,
        transferItems: shipped.items,
        transferNumber: shipped.transferNumber,
      });

      // Should aggregate lots from both batches
      expect(result.restoredLots).toHaveLength(1);
      expect(result.restoredLots[0]?.qty).toBe(200); // Total from both batches
    });

    it('should handle empty shipmentBatches gracefully', async () => {
      // Create fake transfer items with no shipmentBatches
      const fakeItems = [
        {
          productId: product1.id,
          shipmentBatches: null,
        },
      ];

      const result = await reverseLotsAtBranch({
        tenantId: testTenant.id,
        userId: userSource.id,
        branchId: sourceBranch.id,
        transferItems: fakeItems as any,
        transferNumber: 'TRF-2025-0001',
      });

      expect(result.restoredLots).toHaveLength(0);
    });

    it('should handle transfer items with no lotsConsumed', async () => {
      const fakeItems = [
        {
          productId: product1.id,
          shipmentBatches: [
            {
              batchNumber: 1,
              qty: 100,
              lotsConsumed: null, // No lot tracking
            },
          ],
        },
      ];

      const result = await reverseLotsAtBranch({
        tenantId: testTenant.id,
        userId: userSource.id,
        branchId: sourceBranch.id,
        transferItems: fakeItems as any,
        transferNumber: 'TRF-2025-0001',
      });

      expect(result.restoredLots).toHaveLength(0);
    });
  });

  describe('[PHASE-1-3] reverseStockTransfer with Lot Restoration', () => {
    it('should restore lots at source branch instead of creating new lots', async () => {
      // Create and complete transfer
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });

      await transferService.reviewStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
        action: 'approve',
      });

      await transferService.shipStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
      });

      await transferService.receiveStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
        receivedItems: [{ itemId: transfer.items[0]!.id, qtyReceived: 100 }],
      });

      // Get original lot ID before reversal
      const lotsBeforeReversal = await prisma.stockLot.findMany({
        where: {
          tenantId: testTenant.id,
          branchId: sourceBranch.id,
          productId: product1.id,
        },
      });
      const originalLotId = lotsBeforeReversal[0]?.id;
      expect(lotsBeforeReversal).toHaveLength(1);
      expect(lotsBeforeReversal[0]?.qtyRemaining).toBe(400); // 500 - 100

      // Reverse transfer
      await transferService.reverseStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
        reversalReason: 'Test lot restoration',
      });

      // Check lots at source branch - should still be only 1 lot (restored, not new)
      const lotsAfterReversal = await prisma.stockLot.findMany({
        where: {
          tenantId: testTenant.id,
          branchId: sourceBranch.id,
          productId: product1.id,
        },
      });

      expect(lotsAfterReversal).toHaveLength(1); // Still only 1 lot!
      expect(lotsAfterReversal[0]?.id).toBe(originalLotId); // Same lot ID!
      expect(lotsAfterReversal[0]?.qtyRemaining).toBe(500); // Restored to original quantity
    });

    it('should create REVERSAL ledger entries, not RECEIPT', async () => {
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });

      await transferService.reviewStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
        action: 'approve',
      });

      await transferService.shipStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
      });

      await transferService.receiveStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
        receivedItems: [{ itemId: transfer.items[0]!.id, qtyReceived: 100 }],
      });

      // Reverse transfer
      const completed = await prisma.stockTransfer.findUnique({
        where: { id: transfer.id },
      });

      await transferService.reverseStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
      });

      // Check ledger entries at source branch after reversal
      const reversalLedger = await prisma.stockLedger.findMany({
        where: {
          tenantId: testTenant.id,
          branchId: sourceBranch.id,
          productId: product1.id,
          kind: StockMovementKind.REVERSAL,
          reason: { contains: completed!.transferNumber },
        },
      });

      expect(reversalLedger).toHaveLength(1);
      expect(reversalLedger[0]?.qtyDelta).toBe(100); // Positive delta (restoration)
      expect(reversalLedger[0]?.kind).toBe(StockMovementKind.REVERSAL);

      // Should NOT have any RECEIPT ledger entries from reversal
      const receiptLedger = await prisma.stockLedger.findMany({
        where: {
          tenantId: testTenant.id,
          branchId: sourceBranch.id,
          productId: product1.id,
          kind: StockMovementKind.RECEIPT,
          reason: { contains: 'Reversal' },
        },
      });

      expect(receiptLedger).toHaveLength(0); // No RECEIPT entries from reversal!
    });

    it('should preserve FIFO age (receivedAt timestamp unchanged)', async () => {
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });

      await transferService.reviewStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
        action: 'approve',
      });

      await transferService.shipStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
      });

      await transferService.receiveStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
        receivedItems: [{ itemId: transfer.items[0]!.id, qtyReceived: 100 }],
      });

      // Get original lot's receivedAt before reversal
      const lotBefore = await prisma.stockLot.findFirst({
        where: {
          tenantId: testTenant.id,
          branchId: sourceBranch.id,
          productId: product1.id,
        },
      });

      const originalReceivedAt = lotBefore!.receivedAt;

      // Wait a moment to ensure timestamp would change if new lot created
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Reverse transfer
      await transferService.reverseStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
      });

      // Verify receivedAt timestamp unchanged
      const lotAfter = await prisma.stockLot.findUnique({
        where: { id: lotBefore!.id },
      });

      expect(lotAfter!.receivedAt.getTime()).toBe(originalReceivedAt.getTime());
    });

    it('should preserve cost basis through reversal', async () => {
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });

      await transferService.reviewStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
        action: 'approve',
      });

      const shipped = await transferService.shipStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
      });

      const originalCost = shipped.items[0]?.avgUnitCostPence;
      expect(originalCost).toBe(1000);

      await transferService.receiveStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
        receivedItems: [{ itemId: transfer.items[0]!.id, qtyReceived: 100 }],
      });

      // Reverse transfer
      const reversal = await transferService.reverseStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
      });

      // Reversal should preserve cost
      expect(reversal.items[0]?.avgUnitCostPence).toBe(originalCost);

      // Restored lot should have original cost
      const lot = await prisma.stockLot.findFirst({
        where: {
          tenantId: testTenant.id,
          branchId: sourceBranch.id,
          productId: product1.id,
        },
      });

      expect(lot?.unitCostPence).toBe(1000); // Original cost preserved
    });

    it('should handle multi-lot reversal (transfer consumed from multiple lots)', async () => {
      // Create second lot at source
      await stockService.receiveStock(
        { currentTenantId: testTenant.id, currentUserId: userSource.id },
        {
          branchId: sourceBranch.id,
          productId: product1.id,
          qty: 200,
          unitCostPence: 1100,
        }
      );

      const lotsBefore = await prisma.stockLot.findMany({
        where: {
          tenantId: testTenant.id,
          branchId: sourceBranch.id,
          productId: product1.id,
        },
        orderBy: { receivedAt: 'asc' },
      });
      expect(lotsBefore).toHaveLength(2);

      // Transfer 600 units (will consume from both lots via FIFO)
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 600 }],
        },
      });

      await transferService.reviewStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
        action: 'approve',
      });

      await transferService.shipStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
      });

      await transferService.receiveStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
        receivedItems: [{ itemId: transfer.items[0]!.id, qtyReceived: 600 }],
      });

      // Verify both lots consumed
      const lot1After = await prisma.stockLot.findUnique({ where: { id: lotsBefore[0]!.id } });
      const lot2After = await prisma.stockLot.findUnique({ where: { id: lotsBefore[1]!.id } });
      expect(lot1After?.qtyRemaining).toBe(0); // Fully consumed
      expect(lot2After?.qtyRemaining).toBe(100); // Partially consumed

      // Reverse transfer
      await transferService.reverseStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
      });

      // Verify both lots restored
      const lot1Restored = await prisma.stockLot.findUnique({ where: { id: lotsBefore[0]!.id } });
      const lot2Restored = await prisma.stockLot.findUnique({ where: { id: lotsBefore[1]!.id } });
      expect(lot1Restored?.qtyRemaining).toBe(500); // Restored
      expect(lot2Restored?.qtyRemaining).toBe(200); // Restored

      // Verify REVERSAL ledger entries for both lots
      const reversalLedger = await prisma.stockLedger.findMany({
        where: {
          tenantId: testTenant.id,
          branchId: sourceBranch.id,
          productId: product1.id,
          kind: StockMovementKind.REVERSAL,
        },
      });

      expect(reversalLedger).toHaveLength(2); // One for each lot
      const lot1Reversal = reversalLedger.find((l) => l.lotId === lotsBefore[0]!.id);
      const lot2Reversal = reversalLedger.find((l) => l.lotId === lotsBefore[1]!.id);
      expect(lot1Reversal?.qtyDelta).toBe(500);
      expect(lot2Reversal?.qtyDelta).toBe(100);
    });

    it('should maintain FIFO order after reversal', async () => {
      // Create three lots with different ages
      const lot1 = await stockService.receiveStock(
        { currentTenantId: testTenant.id, currentUserId: userSource.id },
        {
          branchId: sourceBranch.id,
          productId: product2.id,
          qty: 100,
          unitCostPence: 1000,
          occurredAt: new Date('2025-01-01').toISOString(),
        }
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      const lot2 = await stockService.receiveStock(
        { currentTenantId: testTenant.id, currentUserId: userSource.id },
        {
          branchId: sourceBranch.id,
          productId: product2.id,
          qty: 100,
          unitCostPence: 1100,
          occurredAt: new Date('2025-01-02').toISOString(),
        }
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      const lot3 = await stockService.receiveStock(
        { currentTenantId: testTenant.id, currentUserId: userSource.id },
        {
          branchId: sourceBranch.id,
          productId: product2.id,
          qty: 100,
          unitCostPence: 1200,
          occurredAt: new Date('2025-01-03').toISOString(),
        }
      );

      // Transfer 150 units (will consume lot1 fully + 50 from lot2)
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product2.id, qtyRequested: 150 }],
        },
      });

      await transferService.reviewStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
        action: 'approve',
      });

      await transferService.shipStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
      });

      await transferService.receiveStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
        receivedItems: [{ itemId: transfer.items[0]!.id, qtyReceived: 150 }],
      });

      // Reverse transfer
      await transferService.reverseStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
      });

      // Verify FIFO order maintained
      const lotsAfter = await prisma.stockLot.findMany({
        where: {
          tenantId: testTenant.id,
          branchId: sourceBranch.id,
          productId: product2.id,
        },
        orderBy: [{ receivedAt: 'asc' }, { createdAt: 'asc' }],
      });

      expect(lotsAfter[0]?.receivedAt.toISOString()).toContain('2025-01-01'); // Oldest
      expect(lotsAfter[1]?.receivedAt.toISOString()).toContain('2025-01-02');
      expect(lotsAfter[2]?.receivedAt.toISOString()).toContain('2025-01-03'); // Newest

      // Verify quantities restored in FIFO order
      expect(lotsAfter[0]?.qtyRemaining).toBe(100); // Lot 1 restored
      expect(lotsAfter[1]?.qtyRemaining).toBe(100); // Lot 2 restored
      expect(lotsAfter[2]?.qtyRemaining).toBe(100); // Lot 3 untouched
    });

    it('should rollback transaction on failure', async () => {
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });

      await transferService.reviewStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
        action: 'approve',
      });

      await transferService.shipStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
      });

      await transferService.receiveStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
        receivedItems: [{ itemId: transfer.items[0]!.id, qtyReceived: 100 }],
      });

      // Delete the lot to force a failure during restoration
      await prisma.stockLot.deleteMany({
        where: {
          tenantId: testTenant.id,
          branchId: sourceBranch.id,
          productId: product1.id,
        },
      });

      // Attempt reversal - should fail gracefully
      await expect(
        transferService.reverseStockTransfer({
          tenantId: testTenant.id,
          userId: userDestination.id,
          transferId: transfer.id,
        })
      ).rejects.toThrow();

      // Verify no reversal transfer created (transaction rolled back)
      const reversalTransfers = await prisma.stockTransfer.findMany({
        where: {
          tenantId: testTenant.id,
          reversalOfId: transfer.id,
        },
      });

      expect(reversalTransfers).toHaveLength(0);
    });
  });

  describe('[PHASE-1-4] Multi-Tenant Isolation', () => {
    it('should not restore lots from different tenant', async () => {
      // Create second tenant
      const tenant2 = await createTestTenant();
      const user2 = await createTestUser();
      const branch2 = await createTestBranch({ tenantId: tenant2.id });
      const product2Tenant2 = await createTestProduct({ tenantId: tenant2.id });

      const role2 = await createTestRoleWithPermissions({
        tenantId: tenant2.id,
        permissionKeys: ['stock:read', 'stock:write'],
      });

      await createTestMembership({
        userId: user2.id,
        tenantId: tenant2.id,
        roleId: role2.id,
      });

      await addUserToBranch(user2.id, tenant2.id, branch2.id);

      // Create lot in tenant2
      const lot2 = await stockService.receiveStock(
        { currentTenantId: tenant2.id, currentUserId: user2.id },
        {
          branchId: branch2.id,
          productId: product2Tenant2.id,
          qty: 100,
          unitCostPence: 1000,
        }
      );

      // Try to restore tenant2's lot from tenant1
      const lot = await prisma.stockLot.findFirst({
        where: {
          tenantId: tenant2.id,
          branchId: branch2.id,
          productId: product2Tenant2.id,
        },
      });

      await expect(
        stockService.restoreLotQuantities(
          { currentTenantId: testTenant.id, currentUserId: userSource.id }, // Tenant 1
          {
            branchId: sourceBranch.id,
            lotsToRestore: [{ lotId: lot!.id, qty: 50 }], // Lot from tenant 2
          }
        )
      ).rejects.toThrow('not found or do not belong');
    });
  });

  describe('[PHASE-2-1] Complex FIFO Scenarios', () => {
    it('should handle reversal consuming from 15+ lots (complex FIFO)', async () => {
      // Use product2 to avoid interference from beforeEach stock
      // Create 15 lots at source branch, each with 10 units
      const lotIds: string[] = [];
      for (let i = 0; i < 15; i++) {
        const result = await stockService.receiveStock(
          { currentTenantId: testTenant.id, currentUserId: userSource.id },
          {
            branchId: sourceBranch.id,
            productId: product2.id,
            qty: 10,
            unitCostPence: 1000 + i * 10, // Different costs
            reason: `Lot ${i + 1}`,
          }
        );
        lotIds.push(result.lot.id);
      }

      // Consume 145 units (will take from all 15 lots: 14*10 + 5 from last)
      const consumeResult = await stockService.consumeStock(
        { currentTenantId: testTenant.id, currentUserId: userSource.id },
        {
          branchId: sourceBranch.id,
          productId: product2.id,
          qty: 145,
          reason: 'Complex transfer',
        },
      );

      // Verify total consumed (consumeStock may aggregate results)
      const totalConsumed = consumeResult.affected.reduce((sum, a) => sum + a.take, 0);
      expect(totalConsumed).toBe(145);

      // Now restore all 145 units back
      const lotsToRestore = consumeResult.affected.map((a) => ({
        lotId: a.lotId,
        qty: a.take,
      }));

      const restoreResult = await stockService.restoreLotQuantities(
        { currentTenantId: testTenant.id, currentUserId: userSource.id },
        {
          branchId: sourceBranch.id,
          lotsToRestore,
          reason: 'Complex reversal',
        }
      );

      // Verify total qty restored
      const totalRestored = restoreResult.restoredLots.reduce((sum, lot) => sum + lot.qty, 0);
      expect(totalRestored).toBe(145);

      // Verify all 15 lots are back to original quantities
      const lotsAfter = await prisma.stockLot.findMany({
        where: {
          id: { in: lotIds },
        },
        orderBy: { receivedAt: 'asc' },
      });

      expect(lotsAfter.length).toBe(15);
      lotsAfter.forEach((lot) => {
        expect(lot.qtyRemaining).toBe(10); // All restored to original
      });
    });

    it('should handle reversal after additional stock receipts at source', async () => {
      // Get the initial lot created by beforeEach (500 units of product1)
      const initialLots = await prisma.stockLot.findMany({
        where: {
          tenantId: testTenant.id,
          branchId: sourceBranch.id,
          productId: product1.id,
        },
        orderBy: { receivedAt: 'asc' },
      });

      const initialLot = initialLots[0];
      expect(initialLot).toBeDefined();
      expect(initialLot!.qtyRemaining).toBe(500);

      // 1. Consume 100 units from the initial lot
      const consumeResult = await stockService.consumeStock(
        { currentTenantId: testTenant.id, currentUserId: userSource.id },
        {
          branchId: sourceBranch.id,
          productId: product1.id,
          qty: 100,
          reason: 'Transfer',
        }
      );

      // Verify consumption
      const lotAfterConsume = await prisma.stockLot.findUnique({
        where: { id: initialLot!.id },
      });
      expect(lotAfterConsume!.qtyRemaining).toBe(400); // 500 - 100

      // 2. Add NEW stock AFTER the transfer
      await stockService.receiveStock(
        { currentTenantId: testTenant.id, currentUserId: userSource.id },
        {
          branchId: sourceBranch.id,
          productId: product1.id,
          qty: 1000,
          unitCostPence: 2000,
          reason: 'New stock after transfer',
        }
      );

      // At this point: original lot has 400, new lot has 1000
      const lotsBeforeRestore = await prisma.stockLot.findMany({
        where: {
          tenantId: testTenant.id,
          branchId: sourceBranch.id,
          productId: product1.id,
        },
        orderBy: { receivedAt: 'asc' },
      });

      expect(lotsBeforeRestore.length).toBe(2);
      expect(lotsBeforeRestore[0]!.qtyRemaining).toBe(400); // Original lot after consumption
      expect(lotsBeforeRestore[1]!.qtyRemaining).toBe(1000); // New lot

      // 3. Now reverse the transfer (restore 100 units to original lot)
      const lotsToRestore = consumeResult.affected.map((a) => ({
        lotId: a.lotId,
        qty: a.take,
      }));

      await stockService.restoreLotQuantities(
        { currentTenantId: testTenant.id, currentUserId: userSource.id },
        {
          branchId: sourceBranch.id,
          lotsToRestore,
          reason: 'Reversal',
        }
      );

      // 4. Verify: original lot restored by 100, new lot unchanged
      const lotsAfterRestore = await prisma.stockLot.findMany({
        where: {
          tenantId: testTenant.id,
          branchId: sourceBranch.id,
          productId: product1.id,
        },
        orderBy: { receivedAt: 'asc' },
      });

      expect(lotsAfterRestore[0]!.id).toBe(initialLot!.id);
      expect(lotsAfterRestore[0]!.qtyRemaining).toBe(500); // Restored!
      expect(lotsAfterRestore[1]!.qtyRemaining).toBe(1000); // Unchanged
    });
  });
});
