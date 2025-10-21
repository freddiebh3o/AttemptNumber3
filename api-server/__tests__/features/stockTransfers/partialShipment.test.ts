/**
 * Partial Shipment Tests
 * Tests for partial shipment functionality with batch tracking
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { PrismaClient, StockTransferStatus, AuditAction } from '@prisma/client';
import {
  createStockTransfer,
  reviewStockTransfer,
  shipStockTransfer,
} from '../../../src/services/stockTransfers/stockTransferService';
import { receiveStock } from '../../../src/services/stockService';
import {
  createTestTenant,
  createTestUser,
  createTestBranch,
  createTestProduct,
  createTestRoleWithPermissions,
  addUserToTenant,
  addUserToBranch,
} from '../../helpers/factories';
import { ROLE_DEFS } from '../../../src/rbac/catalog';

const prisma = new PrismaClient();

describe('Partial Shipment', () => {
  let tenantId: string;
  let userId: string;
  let sourceBranchId: string;
  let destBranchId: string;
  let productId: string;

  beforeAll(async () => {
    // Create test tenant
    const tenant = await createTestTenant();
    tenantId = tenant.id;

    // Create user with OWNER role
    const user = await createTestUser();
    userId = user.id;

    const role = await createTestRoleWithPermissions({
      tenantId,
      permissionKeys: ROLE_DEFS.OWNER,
    });
    await addUserToTenant(userId, tenantId, role.id);

    // Create branches
    const sourceBranch = await createTestBranch({ tenantId, name: 'Source' });
    sourceBranchId = sourceBranch.id;
    await addUserToBranch(userId, tenantId, sourceBranchId);

    const destBranch = await createTestBranch({ tenantId, name: 'Dest' });
    destBranchId = destBranch.id;
    await addUserToBranch(userId, tenantId, destBranchId);

    // Create product
    const product = await createTestProduct({ tenantId, pricePence: 1000 });
    productId = product.id;

    // Add stock to source branch (for shipments)
    await receiveStock(
      { currentTenantId: tenantId, currentUserId: userId },
      {
        branchId: sourceBranchId,
        productId,
        qty: 10000, // Enough for all tests (increased from 500)
        unitCostPence: 1000,
        occurredAt: new Date().toISOString(),
      }
    );
  });

  describe('shipStockTransfer with items array', () => {
    test('should ship all items when no items array provided (backward compatible)', async () => {
      // Create and approve transfer
      const transfer = await createStockTransfer({
        tenantId,
        userId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          items: [{ productId, qtyRequested: 50 }],
        },
      });

      await reviewStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        decision: 'APPROVE',
      });

      // Ship without items array (backward compatible)
      const shipped = await shipStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
      });

      expect(shipped.status).toBe(StockTransferStatus.IN_TRANSIT);
      expect(shipped.items[0].qtyShipped).toBe(50);
    });

    test('should ship partial quantities when items array provided', async () => {
      // Create and approve transfer
      const transfer = await createStockTransfer({
        tenantId,
        userId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          items: [{ productId, qtyRequested: 100 }],
        },
      });

      await reviewStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        decision: 'APPROVE',
      });

      const itemId = transfer.items[0].id;

      // Ship partial (70 of 100)
      const shipped = await shipStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        items: [{ itemId, qtyToShip: 70 }],
      });

      expect(shipped.status).toBe(StockTransferStatus.APPROVED); // Still APPROVED (not fully shipped)
      expect(shipped.items[0].qtyShipped).toBe(70);
      expect(shipped.items[0].qtyApproved).toBe(100);
    });

    test('should validate qtyToShip <= (qtyApproved - qtyShipped)', async () => {
      // Create and approve transfer
      const transfer = await createStockTransfer({
        tenantId,
        userId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          items: [{ productId, qtyRequested: 100 }],
        },
      });

      await reviewStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        decision: 'APPROVE',
      });

      const itemId = transfer.items[0].id;

      // Try to ship more than approved
      await expect(
        shipStockTransfer({
          tenantId,
          userId,
          transferId: transfer.id,
          items: [{ itemId, qtyToShip: 150 }], // More than 100 approved
        })
      ).rejects.toThrow();
    });

    test('should validate sufficient stock available', async () => {
      // Create a product with limited stock
      const limitedProduct = await createTestProduct({ tenantId, pricePence: 500 });

      // Add only 30 units of stock
      await receiveStock(
        { currentTenantId: tenantId, currentUserId: userId },
        {
          branchId: sourceBranchId,
          productId: limitedProduct.id,
          qty: 30,
          unitCostPence: 500,
          occurredAt: new Date().toISOString(),
        }
      );

      // Create and approve transfer for 100 units
      const transfer = await createStockTransfer({
        tenantId,
        userId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          items: [{ productId: limitedProduct.id, qtyRequested: 100 }],
        },
      });

      await reviewStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        decision: 'APPROVE',
      });

      const itemId = transfer.items[0].id;

      // Try to ship 50 (but only 30 available)
      await expect(
        shipStockTransfer({
          tenantId,
          userId,
          transferId: transfer.id,
          items: [{ itemId, qtyToShip: 50 }],
        })
      ).rejects.toThrow();
    });

    test('should reject qtyToShip = 0', async () => {
      // Create and approve transfer
      const transfer = await createStockTransfer({
        tenantId,
        userId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          items: [{ productId, qtyRequested: 50 }],
        },
      });

      await reviewStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        decision: 'APPROVE',
      });

      const itemId = transfer.items[0].id;

      // Try to ship 0 units
      await expect(
        shipStockTransfer({
          tenantId,
          userId,
          transferId: transfer.id,
          items: [{ itemId, qtyToShip: 0 }],
        })
      ).rejects.toThrow();
    });

    test('should reject qtyToShip > qtyApproved', async () => {
      // Create and approve transfer
      const transfer = await createStockTransfer({
        tenantId,
        userId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          items: [{ productId, qtyRequested: 50 }],
        },
      });

      await reviewStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        decision: 'APPROVE',
      });

      const itemId = transfer.items[0].id;

      // Try to ship more than approved
      await expect(
        shipStockTransfer({
          tenantId,
          userId,
          transferId: transfer.id,
          items: [{ itemId, qtyToShip: 60 }], // > 50 approved
        })
      ).rejects.toThrow();
    });

    test('should create shipment batch records in JSON field', async () => {
      // Create and approve transfer
      const transfer = await createStockTransfer({
        tenantId,
        userId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          items: [{ productId, qtyRequested: 100 }],
        },
      });

      await reviewStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        decision: 'APPROVE',
      });

      const itemId = transfer.items[0].id;

      // Ship partial
      const shipped = await shipStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        items: [{ itemId, qtyToShip: 70 }],
      });

      // Check shipment batches
      const item = shipped.items[0];
      expect(item.shipmentBatches).toBeDefined();
      expect(Array.isArray(item.shipmentBatches)).toBe(true);
      expect(item.shipmentBatches).toHaveLength(1);

      const batch = (item.shipmentBatches as any[])[0];
      expect(batch.batchNumber).toBe(1);
      expect(batch.qty).toBe(70);
      expect(batch.shippedByUserId).toBe(userId);
      expect(batch.shippedAt).toBeDefined();
      expect(Array.isArray(batch.lotsConsumed)).toBe(true);
    });

    test('should support multiple shipments (accumulative qtyShipped)', async () => {
      // Create and approve transfer
      const transfer = await createStockTransfer({
        tenantId,
        userId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          items: [{ productId, qtyRequested: 100 }],
        },
      });

      await reviewStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        decision: 'APPROVE',
      });

      const itemId = transfer.items[0].id;

      // First shipment: 40 units
      const shipped1 = await shipStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        items: [{ itemId, qtyToShip: 40 }],
      });

      expect(shipped1.items[0].qtyShipped).toBe(40);
      expect(shipped1.status).toBe(StockTransferStatus.APPROVED); // Still partial

      // Second shipment: 30 units
      const shipped2 = await shipStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        items: [{ itemId, qtyToShip: 30 }],
      });

      expect(shipped2.items[0].qtyShipped).toBe(70); // Accumulative
      expect(shipped2.status).toBe(StockTransferStatus.APPROVED); // Still partial

      // Third shipment: 30 units (completes the transfer)
      const shipped3 = await shipStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        items: [{ itemId, qtyToShip: 30 }],
      });

      expect(shipped3.items[0].qtyShipped).toBe(100); // All shipped
      expect(shipped3.status).toBe(StockTransferStatus.IN_TRANSIT); // Now fully shipped
    });

    test('should transition to IN_TRANSIT when all items fully shipped', async () => {
      // Create and approve transfer
      const transfer = await createStockTransfer({
        tenantId,
        userId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          items: [{ productId, qtyRequested: 50 }],
        },
      });

      await reviewStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        decision: 'APPROVE',
      });

      const itemId = transfer.items[0].id;

      // Ship all approved quantity
      const shipped = await shipStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        items: [{ itemId, qtyToShip: 50 }],
      });

      expect(shipped.status).toBe(StockTransferStatus.IN_TRANSIT);
      expect(shipped.items[0].qtyShipped).toBe(50);
    });

    test('should stay APPROVED when partial shipment', async () => {
      // Create and approve transfer
      const transfer = await createStockTransfer({
        tenantId,
        userId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          items: [{ productId, qtyRequested: 100 }],
        },
      });

      await reviewStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        decision: 'APPROVE',
      });

      const itemId = transfer.items[0].id;

      // Ship partial
      const shipped = await shipStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        items: [{ itemId, qtyToShip: 60 }],
      });

      expect(shipped.status).toBe(StockTransferStatus.APPROVED); // NOT IN_TRANSIT
      expect(shipped.items[0].qtyShipped).toBe(60);
      expect(shipped.items[0].qtyApproved).toBe(100);
    });

    test('should create CONSUMPTION ledger entries', async () => {
      // Create and approve transfer
      const transfer = await createStockTransfer({
        tenantId,
        userId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          items: [{ productId, qtyRequested: 50 }],
        },
      });

      await reviewStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        decision: 'APPROVE',
      });

      const itemId = transfer.items[0].id;

      // Ship partial
      await shipStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        items: [{ itemId, qtyToShip: 50 }],
      });

      // Check ledger (note: other tests also consume from this product, so we check >= not exact match)
      const ledgerEntries = await prisma.stockLedger.findMany({
        where: {
          tenantId,
          branchId: sourceBranchId,
          productId,
          kind: 'CONSUMPTION',
        },
      });

      expect(ledgerEntries.length).toBeGreaterThan(0);
      const totalConsumed = ledgerEntries.reduce((sum, entry) => sum + Math.abs(entry.qtyDelta), 0);
      expect(totalConsumed).toBeGreaterThanOrEqual(50); // At least 50 from this test, but may include other tests' consumption
    });

    test('should create TRANSFER_SHIP_PARTIAL audit event', async () => {
      // Create and approve transfer
      const transfer = await createStockTransfer({
        tenantId,
        userId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          items: [{ productId, qtyRequested: 100 }],
        },
      });

      await reviewStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        decision: 'APPROVE',
      });

      const itemId = transfer.items[0].id;

      // Ship partial
      await shipStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        items: [{ itemId, qtyToShip: 70 }],
      });

      // Check audit event
      const auditEvents = await prisma.auditEvent.findMany({
        where: {
          entityId: transfer.id,
          action: AuditAction.TRANSFER_SHIP_PARTIAL,
        },
      });

      expect(auditEvents.length).toBeGreaterThan(0);
    });

    test('should consume stock using FIFO across multiple batches', async () => {
      // Create product for this test
      const testProduct = await createTestProduct({ tenantId, pricePence: 500 });

      // Add stock in 2 lots (different dates)
      const lot1Date = new Date('2025-01-01');
      const lot2Date = new Date('2025-01-10');

      await receiveStock(
        { currentTenantId: tenantId, currentUserId: userId },
        {
          branchId: sourceBranchId,
          productId: testProduct.id,
          qty: 50,
          unitCostPence: 400,
          occurredAt: lot1Date.toISOString(),
        }
      );

      await receiveStock(
        { currentTenantId: tenantId, currentUserId: userId },
        {
          branchId: sourceBranchId,
          productId: testProduct.id,
          qty: 60,
          unitCostPence: 500,
          occurredAt: lot2Date.toISOString(),
        }
      );

      // Create and approve transfer
      const transfer = await createStockTransfer({
        tenantId,
        userId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          items: [{ productId: testProduct.id, qtyRequested: 80 }],
        },
      });

      await reviewStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        decision: 'APPROVE',
      });

      const itemId = transfer.items[0].id;

      // Ship 80 units (should drain lot1 completely and 30 from lot2)
      const shipped = await shipStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        items: [{ itemId, qtyToShip: 80 }],
      });

      // Check lots consumed (stored in the shipment batch)
      const item = shipped.items[0];
      expect(item.shipmentBatches).toBeDefined();
      expect(Array.isArray(item.shipmentBatches)).toBe(true);
      expect((item.shipmentBatches as any[]).length).toBe(1); // One shipment batch

      const batch = (item.shipmentBatches as any[])[0];
      expect(batch.lotsConsumed).toBeDefined();
      expect(Array.isArray(batch.lotsConsumed)).toBe(true);
      expect(batch.lotsConsumed.length).toBe(2); // Consumed from 2 lots

      // First lot should be fully consumed (50 units)
      const firstLot = batch.lotsConsumed[0];
      expect(firstLot.qty).toBe(50);

      // Second lot should be partially consumed (30 units)
      const secondLot = batch.lotsConsumed[1];
      expect(secondLot.qty).toBe(30);
    });

    test('should calculate weighted average cost across batches', async () => {
      // Create product for this test
      const testProduct = await createTestProduct({ tenantId, pricePence: 500 });

      // Add stock with different costs
      await receiveStock(
        { currentTenantId: tenantId, currentUserId: userId },
        {
          branchId: sourceBranchId,
          productId: testProduct.id,
          qty: 50,
          unitCostPence: 400,
          occurredAt: new Date().toISOString(),
        }
      );

      await receiveStock(
        { currentTenantId: tenantId, currentUserId: userId },
        {
          branchId: sourceBranchId,
          productId: testProduct.id,
          qty: 50,
          unitCostPence: 600,
          occurredAt: new Date().toISOString(),
        }
      );

      // Create and approve transfer
      const transfer = await createStockTransfer({
        tenantId,
        userId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          items: [{ productId: testProduct.id, qtyRequested: 80 }],
        },
      });

      await reviewStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        decision: 'APPROVE',
      });

      const itemId = transfer.items[0].id;

      // Ship in 2 batches
      await shipStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        items: [{ itemId, qtyToShip: 50 }], // All from first lot (400p)
      });

      const shipped2 = await shipStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        items: [{ itemId, qtyToShip: 30 }], // 30 from second lot (600p)
      });

      // Weighted avg = (50*400 + 30*600) / 80 = (20000 + 18000) / 80 = 475
      const item = shipped2.items[0];
      expect(item.avgUnitCostPence).toBeDefined();
      expect(item.avgUnitCostPence).toBeGreaterThan(400);
      expect(item.avgUnitCostPence).toBeLessThan(600);
    });

    test('should track batch numbers sequentially', async () => {
      // Create and approve transfer
      const transfer = await createStockTransfer({
        tenantId,
        userId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          items: [{ productId, qtyRequested: 100 }],
        },
      });

      await reviewStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        decision: 'APPROVE',
      });

      const itemId = transfer.items[0].id;

      // Ship in 3 batches
      const shipped1 = await shipStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        items: [{ itemId, qtyToShip: 30 }],
      });

      const shipped2 = await shipStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        items: [{ itemId, qtyToShip: 30 }],
      });

      const shipped3 = await shipStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        items: [{ itemId, qtyToShip: 40 }],
      });

      // Check batch numbers
      const batches3 = (shipped3.items[0].shipmentBatches as any[]);
      expect(batches3).toHaveLength(3);
      expect(batches3[0].batchNumber).toBe(1);
      expect(batches3[1].batchNumber).toBe(2);
      expect(batches3[2].batchNumber).toBe(3);
    });
  });

  describe('shipment batch tracking', () => {
    test('should store batch metadata (qty, timestamp, user, lots)', async () => {
      // Create and approve transfer
      const transfer = await createStockTransfer({
        tenantId,
        userId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          items: [{ productId, qtyRequested: 50 }],
        },
      });

      await reviewStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        decision: 'APPROVE',
      });

      const itemId = transfer.items[0].id;

      // Ship
      const shipped = await shipStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        items: [{ itemId, qtyToShip: 50 }],
      });

      const batch = (shipped.items[0].shipmentBatches as any[])[0];
      expect(batch).toHaveProperty('batchNumber');
      expect(batch).toHaveProperty('qty');
      expect(batch).toHaveProperty('shippedAt');
      expect(batch).toHaveProperty('shippedByUserId');
      expect(batch).toHaveProperty('lotsConsumed');
      expect(Array.isArray(batch.lotsConsumed)).toBe(true);
    });

    test('should increment batch numbers correctly', async () => {
      // Create and approve transfer
      const transfer = await createStockTransfer({
        tenantId,
        userId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          items: [{ productId, qtyRequested: 100 }],
        },
      });

      await reviewStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        decision: 'APPROVE',
      });

      const itemId = transfer.items[0].id;

      // Multiple shipments
      await shipStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        items: [{ itemId, qtyToShip: 25 }],
      });

      await shipStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        items: [{ itemId, qtyToShip: 25 }],
      });

      const shipped3 = await shipStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        items: [{ itemId, qtyToShip: 50 }],
      });

      const batches = (shipped3.items[0].shipmentBatches as any[]);
      expect(batches[0].batchNumber).toBe(1);
      expect(batches[1].batchNumber).toBe(2);
      expect(batches[2].batchNumber).toBe(3);
    });

    test('should preserve previous batches when adding new batch', async () => {
      // Create and approve transfer
      const transfer = await createStockTransfer({
        tenantId,
        userId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          items: [{ productId, qtyRequested: 100 }],
        },
      });

      await reviewStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        decision: 'APPROVE',
      });

      const itemId = transfer.items[0].id;

      // First batch
      const shipped1 = await shipStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        items: [{ itemId, qtyToShip: 40 }],
      });

      const batch1 = (shipped1.items[0].shipmentBatches as any[])[0];

      // Second batch
      const shipped2 = await shipStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        items: [{ itemId, qtyToShip: 60 }],
      });

      const batches2 = (shipped2.items[0].shipmentBatches as any[]);
      expect(batches2).toHaveLength(2);

      // First batch should still exist with same data
      expect(batches2[0].batchNumber).toBe(batch1.batchNumber);
      expect(batches2[0].qty).toBe(batch1.qty);
    });
  });

  describe('edge cases', () => {
    test('should handle shipping exact approved quantity in single batch', async () => {
      // Create and approve transfer
      const transfer = await createStockTransfer({
        tenantId,
        userId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          items: [{ productId, qtyRequested: 50 }],
        },
      });

      await reviewStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        decision: 'APPROVE',
      });

      const itemId = transfer.items[0].id;

      // Ship exact approved quantity
      const shipped = await shipStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        items: [{ itemId, qtyToShip: 50 }],
      });

      expect(shipped.status).toBe(StockTransferStatus.IN_TRANSIT);
      expect(shipped.items[0].qtyShipped).toBe(50);
    });

    test('should handle shipping 1 unit at a time across many batches', async () => {
      // Create and approve transfer
      const transfer = await createStockTransfer({
        tenantId,
        userId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          items: [{ productId, qtyRequested: 5 }],
        },
      });

      await reviewStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        decision: 'APPROVE',
      });

      const itemId = transfer.items[0].id;

      // Ship 1 unit at a time (5 batches)
      for (let i = 0; i < 5; i++) {
        await shipStockTransfer({
          tenantId,
          userId,
          transferId: transfer.id,
          items: [{ itemId, qtyToShip: 1 }],
        });
      }

      // Get final state
      const finalTransfer = await prisma.stockTransfer.findUnique({
        where: { id: transfer.id },
        include: { items: true },
      });

      expect(finalTransfer!.status).toBe(StockTransferStatus.IN_TRANSIT);
      expect(finalTransfer!.items[0].qtyShipped).toBe(5);
      expect((finalTransfer!.items[0].shipmentBatches as any[]).length).toBe(5);
    });

    test('should reject shipment if no stock available', async () => {
      // Create product with NO stock
      const noStockProduct = await createTestProduct({ tenantId, pricePence: 500 });

      // Create and approve transfer
      const transfer = await createStockTransfer({
        tenantId,
        userId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          items: [{ productId: noStockProduct.id, qtyRequested: 50 }],
        },
      });

      await reviewStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        decision: 'APPROVE',
      });

      const itemId = transfer.items[0].id;

      // Try to ship (should fail - no stock)
      await expect(
        shipStockTransfer({
          tenantId,
          userId,
          transferId: transfer.id,
          items: [{ itemId, qtyToShip: 50 }],
        })
      ).rejects.toThrow();
    });

    test('should handle transfer with multiple products (mixed partial/full)', async () => {
      const productA = await createTestProduct({ tenantId, pricePence: 500 });
      const productB = await createTestProduct({ tenantId, pricePence: 800 });

      // Add stock for both
      await receiveStock(
        { currentTenantId: tenantId, currentUserId: userId },
        {
          branchId: sourceBranchId,
          productId: productA.id,
          qty: 100,
          unitCostPence: 500,
          occurredAt: new Date().toISOString(),
        }
      );

      await receiveStock(
        { currentTenantId: tenantId, currentUserId: userId },
        {
          branchId: sourceBranchId,
          productId: productB.id,
          qty: 100,
          unitCostPence: 800,
          occurredAt: new Date().toISOString(),
        }
      );

      // Create and approve transfer with 2 products
      const transfer = await createStockTransfer({
        tenantId,
        userId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          items: [
            { productId: productA.id, qtyRequested: 50 },
            { productId: productB.id, qtyRequested: 80 },
          ],
        },
      });

      await reviewStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        decision: 'APPROVE',
      });

      const itemAId = transfer.items.find(i => i.productId === productA.id)!.id;
      const itemBId = transfer.items.find(i => i.productId === productB.id)!.id;

      // Ship A fully, B partially
      const shipped = await shipStockTransfer({
        tenantId,
        userId,
        transferId: transfer.id,
        items: [
          { itemId: itemAId, qtyToShip: 50 }, // Full
          { itemId: itemBId, qtyToShip: 60 }, // Partial
        ],
      });

      // Should still be APPROVED (not all items fully shipped)
      expect(shipped.status).toBe(StockTransferStatus.APPROVED);

      const itemA = shipped.items.find(i => i.productId === productA.id)!;
      const itemB = shipped.items.find(i => i.productId === productB.id)!;

      expect(itemA.qtyShipped).toBe(50);
      expect(itemB.qtyShipped).toBe(60);
    });
  });
});
