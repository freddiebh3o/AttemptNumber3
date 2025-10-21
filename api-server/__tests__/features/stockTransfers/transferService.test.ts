// api-server/__tests__/services/stockTransfers.test.ts
import { StockTransferStatus } from '@prisma/client';
import * as transferService from '../../../src/services/stockTransfers/stockTransferService.js';
import { receiveStock } from '../../../src/services/stockService.js';
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

describe('[ST-007] Stock Transfer Service', () => {
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let userDestination: Awaited<ReturnType<typeof createTestUser>>;
  let userSource: Awaited<ReturnType<typeof createTestUser>>;
  let sourceBranch: Awaited<ReturnType<typeof createTestBranch>>;
  let destinationBranch: Awaited<ReturnType<typeof createTestBranch>>;
  let product1: Awaited<ReturnType<typeof createTestProduct>>;
  let product2: Awaited<ReturnType<typeof createTestProduct>>;

  beforeEach(async () => {

    // Create tenant - use factory default for unique slug
    testTenant = await createTestTenant();

    // Create users - use factory defaults for unique emails
    userDestination = await createTestUser();
    userSource = await createTestUser();

    // Create branches - use factory defaults for unique names/slugs
    sourceBranch = await createTestBranch({
      tenantId: testTenant.id,
    });
    destinationBranch = await createTestBranch({
      tenantId: testTenant.id,
    });

    // Create products - use factory defaults for unique names/SKUs
    product1 = await createTestProduct({
      tenantId: testTenant.id,
    });
    product2 = await createTestProduct({
      tenantId: testTenant.id,
    });

    // Create role with permissions - use factory default for unique name
    const role = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ['stock:read', 'stock:write'],
    });

    // Add users to tenant
    await createTestMembership({
      userId: userDestination.id,
      tenantId: testTenant.id,
      roleId: role.id,
    });
    await createTestMembership({
      userId: userSource.id,
      tenantId: testTenant.id,
      roleId: role.id,
    });

    // Add users to both branches (needed for reversals which go in opposite direction)
    await addUserToBranch(userDestination.id, testTenant.id, destinationBranch.id);
    await addUserToBranch(userDestination.id, testTenant.id, sourceBranch.id);
    await addUserToBranch(userSource.id, testTenant.id, sourceBranch.id);
    await addUserToBranch(userSource.id, testTenant.id, destinationBranch.id);

    // Pre-create ProductStock rows to prevent upsert race conditions when tests run in parallel
    await prisma.productStock.createMany({
      data: [
        {
          tenantId: testTenant.id,
          branchId: sourceBranch.id,
          productId: product1.id,
          qtyOnHand: 0,
          qtyAllocated: 0,
        },
        {
          tenantId: testTenant.id,
          branchId: sourceBranch.id,
          productId: product2.id,
          qtyOnHand: 0,
          qtyAllocated: 0,
        },
      ],
      skipDuplicates: true,
    });

    // Add stock to source branch for testing
    await receiveStock(
      { currentTenantId: testTenant.id, currentUserId: userSource.id },
      {
        branchId: sourceBranch.id,
        productId: product1.id,
        qty: 1000,
        unitCostPence: 1200,
      }
    );
    await receiveStock(
      { currentTenantId: testTenant.id, currentUserId: userSource.id },
      {
        branchId: sourceBranch.id,
        productId: product2.id,
        qty: 500,
        unitCostPence: 2500,
      }
    );
  });

  describe('[AC-007-1] generateTransferNumber', () => {
    it('should generate transfer number with correct format', async () => {
      const transferNumber = await transferService.generateTransferNumber(testTenant.id);
      const year = new Date().getFullYear();
      expect(transferNumber).toMatch(new RegExp(`^TRF-${year}-\\d{4}$`));
    });

    it('should increment transfer numbers', async () => {
      const num1 = await transferService.generateTransferNumber(testTenant.id);
      await prisma.stockTransfer.create({
        data: {
          tenantId: testTenant.id,
          transferNumber: num1,
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          status: StockTransferStatus.REQUESTED,
          requestedByUserId: userDestination.id,
          requestedAt: new Date(),
        },
      });

      const num2 = await transferService.generateTransferNumber(testTenant.id);
      expect(num2).not.toBe(num1);

      const [, , suffix1] = num1.split('-');
      const [, , suffix2] = num2.split('-');
      // Allow for other tests running in parallel - just verify num2 is greater than num1
      expect(parseInt(suffix2!)).toBeGreaterThan(parseInt(suffix1!));
    });
  });

  describe('[AC-007-2] createStockTransfer', () => {
    it('should create transfer request with REQUESTED status', async () => {
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          requestNotes: 'Need stock for store',
          items: [
            { productId: product1.id, qtyRequested: 100 },
            { productId: product2.id, qtyRequested: 50 },
          ],
        },
      });

      expect(transfer.status).toBe(StockTransferStatus.REQUESTED);
      expect(transfer.sourceBranchId).toBe(sourceBranch.id);
      expect(transfer.destinationBranchId).toBe(destinationBranch.id);
      expect(transfer.requestedByUserId).toBe(userDestination.id);
      expect(transfer.requestNotes).toBe('Need stock for store');
      expect(transfer.items).toHaveLength(2);
      expect(transfer.items[0]?.qtyRequested).toBe(100);
      expect(transfer.items[1]?.qtyRequested).toBe(50);
      expect(transfer.transferNumber).toMatch(/^TRF-\d{4}-\d{4}$/);
    });

    it('should reject if source and destination are the same', async () => {
      await expect(
        transferService.createStockTransfer({
          tenantId: testTenant.id,
          userId: userDestination.id,
          data: {
            sourceBranchId: sourceBranch.id,
            destinationBranchId: sourceBranch.id,
            items: [{ productId: product1.id, qtyRequested: 100 }],
          },
        })
      ).rejects.toThrow('Source and destination branches must be different');
    });

    it('should reject if user is not member of destination branch', async () => {
      // Create a third user who is only member of source branch
      const userOnlySource = await createTestUser();
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['stock:read', 'stock:write'],
      });
      await createTestMembership({
        userId: userOnlySource.id,
        tenantId: testTenant.id,
        roleId: role.id,
      });
      // Only add to source branch, NOT destination
      await addUserToBranch(userOnlySource.id, testTenant.id, sourceBranch.id);

      await expect(
        transferService.createStockTransfer({
          tenantId: testTenant.id,
          userId: userOnlySource.id, // User only in source branch
          data: {
            sourceBranchId: sourceBranch.id,
            destinationBranchId: destinationBranch.id,
            items: [{ productId: product1.id, qtyRequested: 100 }],
          },
        })
      ).rejects.toThrow('You do not have permission for this action');
    });

    it('should reject if no items provided', async () => {
      await expect(
        transferService.createStockTransfer({
          tenantId: testTenant.id,
          userId: userDestination.id,
          data: {
            sourceBranchId: sourceBranch.id,
            destinationBranchId: destinationBranch.id,
            items: [],
          },
        })
      ).rejects.toThrow('Transfer must include at least one item');
    });
  });

  describe('[AC-007-3] reviewStockTransfer - Approve', () => {
    it('should approve transfer and set qtyApproved', async () => {
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [
            { productId: product1.id, qtyRequested: 100 },
            { productId: product2.id, qtyRequested: 50 },
          ],
        },
      });

      const reviewed = await transferService.reviewStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
        action: 'approve',
        reviewNotes: 'Approved, stock available',
        approvedItems: [
          { itemId: transfer.items[0]!.id, qtyApproved: 80 }, // Partial approval
          { itemId: transfer.items[1]!.id, qtyApproved: 50 },
        ],
      });

      expect(reviewed.status).toBe(StockTransferStatus.APPROVED);
      expect(reviewed.reviewedByUserId).toBe(userSource.id);
      expect(reviewed.reviewNotes).toBe('Approved, stock available');
      expect(reviewed.items[0]?.qtyApproved).toBe(80);
      expect(reviewed.items[1]?.qtyApproved).toBe(50);
      expect(reviewed.reviewedAt).toBeDefined();
    });

    it('should default qtyApproved to qtyRequested if not provided', async () => {
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });

      const reviewed = await transferService.reviewStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
        action: 'approve',
      });

      expect(reviewed.items[0]?.qtyApproved).toBe(100); // Defaults to requested
    });

    it('should reject if user is not member of source branch', async () => {
      // Create a third user who is only member of destination branch
      const userOnlyDestination = await createTestUser();
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['stock:read', 'stock:write'],
      });
      await createTestMembership({
        userId: userOnlyDestination.id,
        tenantId: testTenant.id,
        roleId: role.id,
      });
      // Only add to destination branch, NOT source
      await addUserToBranch(userOnlyDestination.id, testTenant.id, destinationBranch.id);

      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });

      await expect(
        transferService.reviewStockTransfer({
          tenantId: testTenant.id,
          userId: userOnlyDestination.id, // User only in destination branch
          transferId: transfer.id,
          action: 'approve',
        })
      ).rejects.toThrow('You do not have permission for this action');
    });

    it('should reject if transfer is not in REQUESTED status', async () => {
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });

      // Approve it first
      await transferService.reviewStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
        action: 'approve',
      });

      // Try to approve again
      await expect(
        transferService.reviewStockTransfer({
          tenantId: testTenant.id,
          userId: userSource.id,
          transferId: transfer.id,
          action: 'approve',
        })
      ).rejects.toThrow('REQUESTED');
    });
  });

  describe('[AC-007-4] reviewStockTransfer - Reject', () => {
    it('should reject transfer with reason', async () => {
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });

      const rejected = await transferService.reviewStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
        action: 'reject',
        reviewNotes: 'Insufficient stock at source',
      });

      expect(rejected.status).toBe(StockTransferStatus.REJECTED);
      expect(rejected.reviewedByUserId).toBe(userSource.id);
      expect(rejected.reviewNotes).toBe('Insufficient stock at source');
      expect(rejected.reviewedAt).toBeDefined();
    });
  });

  describe('[AC-007-5] shipStockTransfer - FIFO Integration', () => {
    it('should ship transfer and consume stock using FIFO', async () => {
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

      expect(shipped.status).toBe(StockTransferStatus.IN_TRANSIT);
      expect(shipped.shippedByUserId).toBe(userSource.id);
      expect(shipped.shippedAt).toBeDefined();
      expect(shipped.items[0]?.qtyShipped).toBe(100);
      expect(shipped.items[0]?.avgUnitCostPence).toBe(1200); // Cost from stock lot
      expect(shipped.items[0]?.lotsConsumed).toBeDefined();

      // Verify stock consumed at source
      const sourceStock = await prisma.productStock.findUnique({
        where: {
          tenantId_branchId_productId: {
            tenantId: testTenant.id,
            branchId: sourceBranch.id,
            productId: product1.id,
          },
        },
      });
      expect(sourceStock?.qtyOnHand).toBe(900); // 1000 - 100
    });

    it('should create CONSUMPTION ledger entries with transfer number', async () => {
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

      const ledgerEntries = await prisma.stockLedger.findMany({
        where: {
          tenantId: testTenant.id,
          branchId: sourceBranch.id,
          productId: product1.id,
          reason: { contains: transfer.transferNumber },
        },
      });

      expect(ledgerEntries.length).toBeGreaterThan(0);
      expect(ledgerEntries[0]?.reason).toContain(transfer.transferNumber);
    });

    it('should reject if insufficient stock at source', async () => {
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 2000 }], // More than available
        },
      });

      await transferService.reviewStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
        action: 'approve',
      });

      await expect(
        transferService.shipStockTransfer({
          tenantId: testTenant.id,
          userId: userSource.id,
          transferId: transfer.id,
        })
      ).rejects.toThrow('Insufficient stock');
    });

    it('should reject if transfer is not APPROVED', async () => {
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });

      await expect(
        transferService.shipStockTransfer({
          tenantId: testTenant.id,
          userId: userSource.id,
          transferId: transfer.id,
        })
      ).rejects.toThrow('APPROVED');
    });
  });

  describe('[AC-007-6] receiveStockTransfer', () => {
    it('should receive transfer and create stock lots at destination', async () => {
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

      const received = await transferService.receiveStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
        receivedItems: [{ itemId: shipped.items[0]!.id, qtyReceived: 100 }],
      });

      expect(received.status).toBe(StockTransferStatus.COMPLETED);
      expect(received.completedAt).toBeDefined();
      expect(received.items[0]?.qtyReceived).toBe(100);

      // Verify stock added to destination with correct cost
      const destStock = await prisma.productStock.findUnique({
        where: {
          tenantId_branchId_productId: {
            tenantId: testTenant.id,
            branchId: destinationBranch.id,
            productId: product1.id,
          },
        },
      });
      expect(destStock?.qtyOnHand).toBe(100);

      // Verify stock lot has correct cost
      const destLots = await prisma.stockLot.findMany({
        where: {
          tenantId: testTenant.id,
          branchId: destinationBranch.id,
          productId: product1.id,
        },
      });
      expect(destLots).toHaveLength(1);
      expect(destLots[0]?.unitCostPence).toBe(1200); // Cost from source
    });

    it('should support partial receipt', async () => {
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

      // Receive only 60 units
      const partialReceived = await transferService.receiveStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
        receivedItems: [{ itemId: shipped.items[0]!.id, qtyReceived: 60 }],
      });

      expect(partialReceived.status).toBe(StockTransferStatus.PARTIALLY_RECEIVED);
      expect(partialReceived.items[0]?.qtyReceived).toBe(60);
      expect(partialReceived.completedAt).toBeNull();

      // Receive remaining 40 units
      const fullyReceived = await transferService.receiveStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
        receivedItems: [{ itemId: shipped.items[0]!.id, qtyReceived: 40 }],
      });

      expect(fullyReceived.status).toBe(StockTransferStatus.COMPLETED);
      expect(fullyReceived.items[0]?.qtyReceived).toBe(100);
      expect(fullyReceived.completedAt).toBeDefined();
    });

    it('should reject if receiving more than shipped', async () => {
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

      await expect(
        transferService.receiveStockTransfer({
          tenantId: testTenant.id,
          userId: userDestination.id,
          transferId: transfer.id,
          receivedItems: [{ itemId: shipped.items[0]!.id, qtyReceived: 150 }],
        })
      ).rejects.toThrow('Cannot receive');
    });

    it('should reject if user is not member of destination branch', async () => {
      // Create a third user who is only member of source branch
      const userOnlySource = await createTestUser();
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['stock:read', 'stock:write'],
      });
      await createTestMembership({
        userId: userOnlySource.id,
        tenantId: testTenant.id,
        roleId: role.id,
      });
      // Only add to source branch, NOT destination
      await addUserToBranch(userOnlySource.id, testTenant.id, sourceBranch.id);

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

      await expect(
        transferService.receiveStockTransfer({
          tenantId: testTenant.id,
          userId: userOnlySource.id, // User only in source branch, not destination
          transferId: transfer.id,
          receivedItems: [{ itemId: shipped.items[0]!.id, qtyReceived: 100 }],
        })
      ).rejects.toThrow('You do not have permission for this action');
    });
  });

  describe('[AC-007-7] cancelStockTransfer', () => {
    it('should cancel transfer in REQUESTED status', async () => {
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });

      await transferService.cancelStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
      });

      const cancelled = await prisma.stockTransfer.findUnique({
        where: { id: transfer.id },
      });

      expect(cancelled?.status).toBe(StockTransferStatus.CANCELLED);
    });

    it('should reject cancellation if not in REQUESTED status', async () => {
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

      await expect(
        transferService.cancelStockTransfer({
          tenantId: testTenant.id,
          userId: userDestination.id,
          transferId: transfer.id,
        })
      ).rejects.toThrow('Only transfers in REQUESTED status can be cancelled');
    });
  });

  describe('[AC-007-8] listStockTransfers', () => {
    it('should list transfers by direction (inbound/outbound)', async () => {
      // Create transfer from warehouse to retail
      await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });

      // List inbound transfers for destination branch
      const inbound = await transferService.listStockTransfers({
        tenantId: testTenant.id,
        userId: userDestination.id,
        filters: {
          branchId: destinationBranch.id,
          direction: 'inbound',
        },
      });

      expect(inbound.items).toHaveLength(1);
      expect(inbound.items[0]?.destinationBranchId).toBe(destinationBranch.id);

      // List outbound transfers for source branch
      const outbound = await transferService.listStockTransfers({
        tenantId: testTenant.id,
        userId: userSource.id,
        filters: {
          branchId: sourceBranch.id,
          direction: 'outbound',
        },
      });

      expect(outbound.items).toHaveLength(1);
      expect(outbound.items[0]?.sourceBranchId).toBe(sourceBranch.id);
    });

    it('should filter by status', async () => {
      const transfer1 = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });

      const transfer2 = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product2.id, qtyRequested: 50 }],
        },
      });

      await transferService.reviewStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer1.id,
        action: 'approve',
      });

      // List REQUESTED only
      const requested = await transferService.listStockTransfers({
        tenantId: testTenant.id,
        userId: userDestination.id,
        filters: { status: 'REQUESTED' },
      });

      expect(requested.items).toHaveLength(1);
      expect(requested.items[0]?.id).toBe(transfer2.id);

      // List APPROVED only
      const approved = await transferService.listStockTransfers({
        tenantId: testTenant.id,
        userId: userSource.id,
        filters: { status: 'APPROVED' },
      });

      expect(approved.items).toHaveLength(1);
      expect(approved.items[0]?.id).toBe(transfer1.id);
    });
  });

  describe('[AC-007-9] reverseStockTransfer', () => {
    it('should reverse completed transfer and create new transfer in opposite direction', async () => {
      // Create and complete a transfer
      const originalTransfer = await transferService.createStockTransfer({
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
        transferId: originalTransfer.id,
        action: 'approve',
      });

      await transferService.shipStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: originalTransfer.id,
      });

      const completed = await transferService.receiveStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: originalTransfer.id,
        receivedItems: [{ itemId: originalTransfer.items[0]!.id, qtyReceived: 100 }],
      });

      // Reverse the transfer - userDestination initiates from destination branch
      const reversalTransfer = await transferService.reverseStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: completed.id,
        reversalReason: 'Damaged goods',
      });

      // Reversal transfer should have swapped source/destination
      expect(reversalTransfer.sourceBranchId).toBe(completed.destinationBranchId);
      expect(reversalTransfer.destinationBranchId).toBe(completed.sourceBranchId);
      expect(reversalTransfer.isReversal).toBe(true);
      expect(reversalTransfer.reversalOfId).toBe(completed.id);
      expect(reversalTransfer.reversalReason).toBe('Damaged goods');
      expect(reversalTransfer.status).toBe(StockTransferStatus.COMPLETED);

      // Original transfer should be marked as reversed
      const updatedOriginal = await prisma.stockTransfer.findUnique({
        where: { id: completed.id },
      });
      expect(updatedOriginal?.reversedById).toBe(reversalTransfer.id);

      // Stock should be returned to original source
      const sourceStock = await prisma.productStock.findUnique({
        where: {
          tenantId_branchId_productId: {
            tenantId: testTenant.id,
            branchId: sourceBranch.id,
            productId: product1.id,
          },
        },
      });
      // Original: 1000, Shipped: -100, Reversed: +100 = 1000
      expect(sourceStock?.qtyOnHand).toBe(1000);
    });

    it('should preserve FIFO cost during reversal', async () => {
      // Get the original lot BEFORE transfer (created in beforeEach: 1000 units at 1200 pence)
      const originalLots = await prisma.stockLot.findMany({
        where: {
          tenantId: testTenant.id,
          branchId: sourceBranch.id,
          productId: product1.id,
        },
      });

      expect(originalLots).toHaveLength(1);
      const originalLot = originalLots[0]!;
      expect(originalLot.qtyRemaining).toBe(1000);
      expect(originalLot.unitCostPence).toBe(1200);

      // Create and complete a transfer
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

      const avgCost = shipped.items[0]?.avgUnitCostPence;
      expect(avgCost).toBe(1200); // Should be the original cost

      await transferService.receiveStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
        receivedItems: [{ itemId: transfer.items[0]!.id, qtyReceived: 100 }],
      });

      // Verify lot was consumed (should have 900 remaining)
      const lotAfterShip = await prisma.stockLot.findUnique({
        where: { id: originalLot.id },
      });
      expect(lotAfterShip?.qtyRemaining).toBe(900);

      // Reverse the transfer - userDestination initiates from destination branch
      const reversal = await transferService.reverseStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
        reversalReason: 'Return to sender',
      });

      // Reversal should preserve cost
      expect(reversal.items[0]?.avgUnitCostPence).toBe(avgCost);

      // The ORIGINAL lot should be restored (quantity increased back to 1000)
      const restoredLot = await prisma.stockLot.findUnique({
        where: { id: originalLot.id },
      });

      expect(restoredLot?.qtyRemaining).toBe(1000); // Back to original quantity
      expect(restoredLot?.unitCostPence).toBe(1200); // Cost preserved
    });

    it('should reject reversing non-COMPLETED transfer', async () => {
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });

      await expect(
        transferService.reverseStockTransfer({
          tenantId: testTenant.id,
          userId: userSource.id,
          transferId: transfer.id,
        })
      ).rejects.toThrow('Only completed transfers can be reversed');
    });

    it('should reject reversing already-reversed transfer', async () => {
      // Create and complete a transfer
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 50 }],
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
        receivedItems: [{ itemId: transfer.items[0]!.id, qtyReceived: 50 }],
      });

      // Reverse it once - userDestination initiates from destination branch
      await transferService.reverseStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
      });

      // Try to reverse again
      await expect(
        transferService.reverseStockTransfer({
          tenantId: testTenant.id,
          userId: userDestination.id,
          transferId: transfer.id,
        })
      ).rejects.toThrow('Transfer has already been reversed');
    });

    it('should reject if user is not member of destination branch', async () => {
      // Create a third user who is only member of source branch
      const userOnlySource = await createTestUser();
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['stock:read', 'stock:write'],
      });
      await createTestMembership({
        userId: userOnlySource.id,
        tenantId: testTenant.id,
        roleId: role.id,
      });
      // Only add to source branch, NOT destination
      await addUserToBranch(userOnlySource.id, testTenant.id, sourceBranch.id);

      // Create and complete a transfer
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 50 }],
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
        receivedItems: [{ itemId: transfer.items[0]!.id, qtyReceived: 50 }],
      });

      // Try to reverse from userOnlySource (not allowed - not member of destination branch)
      await expect(
        transferService.reverseStockTransfer({
          tenantId: testTenant.id,
          userId: userOnlySource.id, // User only in source branch, not destination
          transferId: transfer.id,
        })
      ).rejects.toThrow('You do not have permission for this action');
    });

    it('should create audit event for reversal', async () => {
      // Create and complete a transfer
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 30 }],
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
        receivedItems: [{ itemId: transfer.items[0]!.id, qtyReceived: 30 }],
      });

      // Reverse the transfer - userDestination initiates from destination branch
      await transferService.reverseStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
        reversalReason: 'Test reversal',
        auditContext: {
          ip: '127.0.0.1',
          userAgent: 'test',
          correlationId: 'test-correlation',
        },
      });

      // Check for TRANSFER_REVERSE audit event
      const auditEvents = await prisma.auditEvent.findMany({
        where: {
          tenantId: testTenant.id,
          action: 'TRANSFER_REVERSE',
          entityType: 'STOCK_TRANSFER',
          entityId: transfer.id,
        },
      });

      expect(auditEvents).toHaveLength(1);
      expect(auditEvents[0]?.actorUserId).toBe(userDestination.id);
    });
  });
});
