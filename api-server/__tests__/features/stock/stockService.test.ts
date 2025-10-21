// api-server/__tests__/features/stock/stockService.test.ts
import { StockMovementKind } from '@prisma/client';
import {
  receiveStock,
  consumeStock,
  adjustStock,
  getStockLevelsForProductService,
} from '../../../src/services/stockService.js';
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

describe('[ST-006] Stock Service - FIFO', () => {
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let testProduct: Awaited<ReturnType<typeof createTestProduct>>;
  let testBranch: Awaited<ReturnType<typeof createTestBranch>>;

  beforeEach(async () => {

    // Create tenant, user - use factory defaults for unique values
    testTenant = await createTestTenant();
    testUser = await createTestUser();
    testProduct = await createTestProduct({
      tenantId: testTenant.id,
    });
    testBranch = await createTestBranch({
      tenantId: testTenant.id,
    });

    // Create role with stock permissions - use factory default for unique name
    const role = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ['stock:read', 'stock:write', 'stock:allocate'],
    });

    await createTestMembership({
      userId: testUser.id,
      tenantId: testTenant.id,
      roleId: role.id,
    });

    // Add user to branch
    await addUserToBranch(testUser.id, testTenant.id, testBranch.id);
  });

  describe('[AC-006-1] receiveStock - Stock Receipt', () => {
    it('should create a new stock lot and update aggregate qty', async () => {
      const result = await receiveStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 100,
          unitCostPence: 1500, // £15.00
          sourceRef: 'PO-001',
          reason: 'Initial stock',
        }
      );

      expect(result.lot).toBeDefined();
      expect(result.lot.qtyReceived).toBe(100);
      expect(result.lot.qtyRemaining).toBe(100);
      expect(result.lot.unitCostPence).toBe(1500);
      expect(result.lot.sourceRef).toBe('PO-001');

      expect(result.ledger).toBeDefined();
      expect(result.ledger.kind).toBe(StockMovementKind.RECEIPT);
      expect(result.ledger.qtyDelta).toBe(100);

      expect(result.productStock.qtyOnHand).toBe(100);
      expect(result.productStock.qtyAllocated).toBe(0);
    });

    it('should create product stock row if it does not exist', async () => {
      // Ensure no product stock exists
      const before = await prisma.productStock.findUnique({
        where: {
          tenantId_branchId_productId: {
            tenantId: testTenant.id,
            branchId: testBranch.id,
            productId: testProduct.id,
          },
        },
      });
      expect(before).toBeNull();

      await receiveStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 50,
        }
      );

      const after = await prisma.productStock.findUnique({
        where: {
          tenantId_branchId_productId: {
            tenantId: testTenant.id,
            branchId: testBranch.id,
            productId: testProduct.id,
          },
        },
      });
      expect(after).not.toBeNull();
      expect(after?.qtyOnHand).toBe(50);
    });

    it('should accumulate multiple receipts', async () => {
      await receiveStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 100,
          unitCostPence: 1500,
        }
      );

      await receiveStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 50,
          unitCostPence: 1600,
        }
      );

      const levels = await getStockLevelsForProductService({
        currentTenantId: testTenant.id,
        branchId: testBranch.id,
        productId: testProduct.id,
      });

      expect(levels.productStock.qtyOnHand).toBe(150);
      expect(levels.lots).toHaveLength(2);
      expect(levels.lots[0]?.qtyRemaining).toBe(100);
      expect(levels.lots[1]?.qtyRemaining).toBe(50);
    });

    it('should reject qty <= 0', async () => {
      await expect(
        receiveStock(
          { currentTenantId: testTenant.id, currentUserId: testUser.id },
          {
            branchId: testBranch.id,
            productId: testProduct.id,
            qty: 0,
          }
        )
      ).rejects.toThrow('qty must be > 0');

      await expect(
        receiveStock(
          { currentTenantId: testTenant.id, currentUserId: testUser.id },
          {
            branchId: testBranch.id,
            productId: testProduct.id,
            qty: -10,
          }
        )
      ).rejects.toThrow('qty must be > 0');
    });

    it('should reject if branch does not belong to tenant', async () => {
      const otherTenant = await createTestTenant();

      await expect(
        receiveStock(
          { currentTenantId: otherTenant.id, currentUserId: testUser.id },
          {
            branchId: testBranch.id,
            productId: testProduct.id,
            qty: 100,
          }
        )
      ).rejects.toThrow('Branch not found');
    });

    it('should reject if user does not have branch membership', async () => {
      // Remove user from branch
      await prisma.userBranchMembership.deleteMany({
        where: {
          userId: testUser.id,
          branchId: testBranch.id,
        },
      });

      await expect(
        receiveStock(
          { currentTenantId: testTenant.id, currentUserId: testUser.id },
          {
            branchId: testBranch.id,
            productId: testProduct.id,
            qty: 100,
          }
        )
      ).rejects.toThrow('You do not have permission');
    });

    it('should reject if product does not belong to tenant', async () => {
      const otherTenant = await createTestTenant();
      const otherProduct = await createTestProduct({
        tenantId: otherTenant.id,
      });

      await expect(
        receiveStock(
          { currentTenantId: testTenant.id, currentUserId: testUser.id },
          {
            branchId: testBranch.id,
            productId: otherProduct.id,
            qty: 100,
          }
        )
      ).rejects.toThrow('Product not found');
    });
  });

  describe('[AC-006-2] consumeStock - FIFO Consumption', () => {
    it('should consume from oldest lot first (FIFO)', async () => {
      // Receive 3 lots with different dates
      const lot1 = await receiveStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 100,
          occurredAt: '2024-01-01T10:00:00Z',
        }
      );

      const lot2 = await receiveStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 50,
          occurredAt: '2024-01-02T10:00:00Z',
        }
      );

      const lot3 = await receiveStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 75,
          occurredAt: '2024-01-03T10:00:00Z',
        }
      );

      // Consume 120 units (should take all of lot1 + 20 from lot2)
      const result = await consumeStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 120,
          reason: 'Order fulfillment',
        }
      );

      expect(result.affected).toHaveLength(2);
      expect(result.affected[0]?.lotId).toBe(lot1.lot.id);
      expect(result.affected[0]?.take).toBe(100);
      expect(result.affected[1]?.lotId).toBe(lot2.lot.id);
      expect(result.affected[1]?.take).toBe(20);

      expect(result.productStock.qtyOnHand).toBe(105); // 225 - 120

      // Check lot remaining quantities
      const updatedLot1 = await prisma.stockLot.findUnique({
        where: { id: lot1.lot.id },
      });
      expect(updatedLot1?.qtyRemaining).toBe(0);

      const updatedLot2 = await prisma.stockLot.findUnique({
        where: { id: lot2.lot.id },
      });
      expect(updatedLot2?.qtyRemaining).toBe(30); // 50 - 20

      const updatedLot3 = await prisma.stockLot.findUnique({
        where: { id: lot3.lot.id },
      });
      expect(updatedLot3?.qtyRemaining).toBe(75); // Untouched
    });

    it('should create CONSUMPTION ledger entries for each affected lot', async () => {
      await receiveStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 100,
        }
      );

      await consumeStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 30,
          reason: 'Sale',
        }
      );

      const ledgerEntries = await prisma.stockLedger.findMany({
        where: {
          tenantId: testTenant.id,
          branchId: testBranch.id,
          productId: testProduct.id,
          kind: StockMovementKind.CONSUMPTION,
        },
      });

      expect(ledgerEntries).toHaveLength(1);
      expect(ledgerEntries[0]?.qtyDelta).toBe(-30);
      expect(ledgerEntries[0]?.reason).toBe('Sale');
    });

    it('should reject consumption when insufficient stock', async () => {
      await receiveStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 50,
        }
      );

      await expect(
        consumeStock(
          { currentTenantId: testTenant.id, currentUserId: testUser.id },
          {
            branchId: testBranch.id,
            productId: testProduct.id,
            qty: 100, // More than available
          }
        )
      ).rejects.toThrow('Insufficient stock');
    });

    it('should reject qty <= 0', async () => {
      await expect(
        consumeStock(
          { currentTenantId: testTenant.id, currentUserId: testUser.id },
          {
            branchId: testBranch.id,
            productId: testProduct.id,
            qty: 0,
          }
        )
      ).rejects.toThrow('qty must be > 0');
    });

    it('should consume exactly the available qty', async () => {
      await receiveStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 100,
        }
      );

      const result = await consumeStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 100,
        }
      );

      expect(result.productStock.qtyOnHand).toBe(0);

      const lots = await prisma.stockLot.findMany({
        where: {
          tenantId: testTenant.id,
          branchId: testBranch.id,
          productId: testProduct.id,
          qtyRemaining: { gt: 0 },
        },
      });
      expect(lots).toHaveLength(0);
    });
  });

  describe('[AC-006-3] adjustStock - Positive Adjustment', () => {
    it('should create new lot when qtyDelta > 0', async () => {
      const result = await adjustStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qtyDelta: 25,
          unitCostPence: 2000,
          reason: 'Found in storage',
        }
      );

      // Type guard: positive adjustment returns lot
      if ('lot' in result) {
        expect(result.lot).toBeDefined();
        expect(result.lot.qtyReceived).toBe(25);
        expect(result.lot.qtyRemaining).toBe(25);
        expect(result.productStock.qtyOnHand).toBe(25);

        // Check ledger
        const ledger = await prisma.stockLedger.findUnique({
          where: { id: result.ledgerId },
        });
        expect(ledger?.kind).toBe(StockMovementKind.ADJUSTMENT);
        expect(ledger?.qtyDelta).toBe(25);
      } else {
        fail('Expected positive adjustment to return lot');
      }
    });

    it('should accumulate with existing stock', async () => {
      await receiveStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 100,
        }
      );

      await adjustStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qtyDelta: 50,
          unitCostPence: 1800,
        }
      );

      const levels = await getStockLevelsForProductService({
        currentTenantId: testTenant.id,
        branchId: testBranch.id,
        productId: testProduct.id,
      });

      expect(levels.productStock.qtyOnHand).toBe(150);
      expect(levels.lots).toHaveLength(2);
    });
  });

  describe('[AC-006-4] adjustStock - Negative Adjustment (FIFO)', () => {
    it('should consume from oldest lot when qtyDelta < 0', async () => {
      const lot1 = await receiveStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 100,
          occurredAt: '2024-01-01T10:00:00Z',
        }
      );

      const lot2 = await receiveStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 50,
          occurredAt: '2024-01-02T10:00:00Z',
        }
      );

      const result = await adjustStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qtyDelta: -120, // Negative adjustment
          reason: 'Damaged goods',
        }
      );

      // Type guard: negative adjustment returns affected
      if ('affected' in result) {
        expect(result.affected).toHaveLength(2);
        expect(result.affected[0]?.lotId).toBe(lot1.lot.id);
        expect(result.affected[0]?.take).toBe(100);
        expect(result.affected[1]?.lotId).toBe(lot2.lot.id);
        expect(result.affected[1]?.take).toBe(20);

        expect(result.productStock.qtyOnHand).toBe(30);

        // Check ledger entries
        const ledgers = await prisma.stockLedger.findMany({
          where: {
            tenantId: testTenant.id,
            kind: StockMovementKind.ADJUSTMENT,
            qtyDelta: { lt: 0 },
          },
        });
        expect(ledgers).toHaveLength(2);
        expect(ledgers[0]?.qtyDelta).toBe(-100);
        expect(ledgers[1]?.qtyDelta).toBe(-20);
      } else {
        fail('Expected negative adjustment to return affected');
      }
    });

    it('should reject when insufficient stock for negative adjustment', async () => {
      await receiveStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 50,
        }
      );

      await expect(
        adjustStock(
          { currentTenantId: testTenant.id, currentUserId: testUser.id },
          {
            branchId: testBranch.id,
            productId: testProduct.id,
            qtyDelta: -100,
          }
        )
      ).rejects.toThrow('Insufficient stock');
    });

    it('should reject qtyDelta === 0', async () => {
      await expect(
        adjustStock(
          { currentTenantId: testTenant.id, currentUserId: testUser.id },
          {
            branchId: testBranch.id,
            productId: testProduct.id,
            qtyDelta: 0,
          }
        )
      ).rejects.toThrow('qtyDelta must be non-zero');
    });
  });

  describe('[AC-006-5] getStockLevelsForProductService', () => {
    it('should return aggregate and open lots ordered by FIFO', async () => {
      await receiveStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 100,
          occurredAt: '2024-01-03T10:00:00Z', // Newest
        }
      );

      await receiveStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 50,
          occurredAt: '2024-01-01T10:00:00Z', // Oldest
        }
      );

      await receiveStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 75,
          occurredAt: '2024-01-02T10:00:00Z', // Middle
        }
      );

      const levels = await getStockLevelsForProductService({
        currentTenantId: testTenant.id,
        branchId: testBranch.id,
        productId: testProduct.id,
      });

      expect(levels.productStock.qtyOnHand).toBe(225);
      expect(levels.lots).toHaveLength(3);

      // Check FIFO order (oldest first)
      expect(levels.lots[0]?.qtyRemaining).toBe(50); // Oldest
      expect(levels.lots[1]?.qtyRemaining).toBe(75); // Middle
      expect(levels.lots[2]?.qtyRemaining).toBe(100); // Newest
    });

    it('should only return lots with qtyRemaining > 0', async () => {
      await receiveStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 100,
        }
      );

      await receiveStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 50,
        }
      );

      // Consume all of first lot
      await consumeStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 100,
        }
      );

      const levels = await getStockLevelsForProductService({
        currentTenantId: testTenant.id,
        branchId: testBranch.id,
        productId: testProduct.id,
      });

      expect(levels.productStock.qtyOnHand).toBe(50);
      expect(levels.lots).toHaveLength(1);
      expect(levels.lots[0]?.qtyRemaining).toBe(50);
    });

    it('should return zero values when no stock exists', async () => {
      const levels = await getStockLevelsForProductService({
        currentTenantId: testTenant.id,
        branchId: testBranch.id,
        productId: testProduct.id,
      });

      expect(levels.productStock.qtyOnHand).toBe(0);
      expect(levels.productStock.qtyAllocated).toBe(0);
      expect(levels.lots).toHaveLength(0);
    });
  });

  describe('[AC-006-6] Complex FIFO Scenarios', () => {
    it('should handle multiple receipts and consumptions correctly', async () => {
      // Receipt 1
      await receiveStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 100,
          occurredAt: '2024-01-01T10:00:00Z',
        }
      );

      // Consume 30
      await consumeStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 30,
        }
      );

      // Receipt 2
      await receiveStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 50,
          occurredAt: '2024-01-02T10:00:00Z',
        }
      );

      // Consume 80 (should take 70 from lot1, 10 from lot2)
      await consumeStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 80,
        }
      );

      const levels = await getStockLevelsForProductService({
        currentTenantId: testTenant.id,
        branchId: testBranch.id,
        productId: testProduct.id,
      });

      expect(levels.productStock.qtyOnHand).toBe(40); // 100 - 30 + 50 - 80
      expect(levels.lots).toHaveLength(1);
      expect(levels.lots[0]?.qtyRemaining).toBe(40); // Only lot2 remains with 40
    });

    it('should handle mix of receipts, consumptions, and adjustments', async () => {
      // Start with 100
      await receiveStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 100,
        }
      );

      // Adjust up by 25
      await adjustStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qtyDelta: 25,
          unitCostPence: 1500,
        }
      );

      // Consume 50
      await consumeStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 50,
        }
      );

      // Adjust down by 20
      await adjustStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qtyDelta: -20,
        }
      );

      const levels = await getStockLevelsForProductService({
        currentTenantId: testTenant.id,
        branchId: testBranch.id,
        productId: testProduct.id,
      });

      expect(levels.productStock.qtyOnHand).toBe(55); // 100 + 25 - 50 - 20
    });
  });

  describe('[AC-006-7] Multi-Tenant Isolation', () => {
    it('should isolate stock between tenants', async () => {
      // Create second tenant with same setup - use factory defaults
      const tenant2 = await createTestTenant();
      const product2 = await createTestProduct({
        tenantId: tenant2.id,
      });
      const branch2 = await createTestBranch({
        tenantId: tenant2.id,
      });

      // Add stock to tenant 1
      await receiveStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: testProduct.id,
          qty: 100,
        }
      );

      // Check tenant 2 has no stock
      const levels = await getStockLevelsForProductService({
        currentTenantId: tenant2.id,
        branchId: branch2.id,
        productId: product2.id,
      });

      expect(levels.productStock.qtyOnHand).toBe(0);
      expect(levels.lots).toHaveLength(0);
    });
  });
});
