// admin-web/e2e/features/transfers/transfer-partial-shipment.spec.ts
import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS, Factories } from '../../helpers';

/**
 * Phase 4: Transfer Batch Shipment & Receiving Tests
 *
 * Tests cover the batch workflow for stock transfers:
 * - Ship in multiple batches (status: APPROVED until all shipped → IN_TRANSIT)
 * - Receive in multiple batches (status: PARTIALLY_RECEIVED → COMPLETED)
 * - Multiple products with independent batch states
 * - Validation: Cannot ship/receive more than approved/shipped
 *
 * Based on backend tests in:
 * api-server/__tests__/features/stockTransfers/partialShipment.test.ts
 */

// Check API server health before tests
test.beforeAll(async () => {
  const apiUrl = process.env.VITE_API_BASE_URL || 'http://localhost:4000';
  try {
    const response = await fetch(`${apiUrl}/api/health`);
    if (!response.ok) {
      throw new Error(`API health check failed with status ${response.status}`);
    }
  } catch (error) {
    console.warn('⚠️  API server may not be running. Tests will fail without it.');
    console.warn('   Start it with: cd api-server && npm run dev:e2e');
  }
});

// Isolate each test - clear browser state
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.describe('Transfer Batch Workflow - Single Product', () => {
  test('should support batch shipping then batch receiving', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();

    // Setup branches and product
    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const destBranchId = await Factories.branch.getBySlug(page, 'acme-retail-1');

    const productId = await Factories.product.create(page, {
      productName: `Batch Product ${timestamp}`,
      productSku: `BATCH-${timestamp}`,
      productPricePence: 500, // £5 (low price to avoid approval rules)
    });

    await Factories.stock.addStock(page, {
      productId,
      branchId: sourceBranchId,
      qtyDelta: 20,
      unitCostPence: 300,
    });

    try {
      // Create and approve transfer (10 units, low value to avoid approval rules)
      const transferId = await Factories.transfer.create(page, {
        sourceBranchId,
        destinationBranchId: destBranchId,
        items: [{ productId, qty: 10 }], // 10 × £5 = £50 (under £100 threshold)
      });

      await Factories.transfer.approve(page, transferId);

      const transfer = await Factories.transfer.getById(page, transferId);
      const itemId = transfer.items[0].id;

      // BATCH 1: Ship 6 units - status stays APPROVED (not all shipped yet)
      await Factories.transfer.ship(page, {
        transferId,
        items: [{ itemId, qtyToShip: 6 }],
      });

      let updatedTransfer = await Factories.transfer.getById(page, transferId);
      expect(updatedTransfer.status).toBe('APPROVED'); // Still APPROVED
      expect(updatedTransfer.items[0].qtyShipped).toBe(6);

      // BATCH 2: Ship remaining 4 units - status becomes IN_TRANSIT (all shipped)
      await Factories.transfer.ship(page, {
        transferId,
        items: [{ itemId, qtyToShip: 4 }],
      });

      updatedTransfer = await Factories.transfer.getById(page, transferId);
      expect(updatedTransfer.status).toBe('IN_TRANSIT'); // Now IN_TRANSIT
      expect(updatedTransfer.items[0].qtyShipped).toBe(10);

      // BATCH 3: Receive 7 out of 10 - status becomes PARTIALLY_RECEIVED
      await Factories.transfer.receive(page, {
        transferId,
        items: [{ itemId, qtyReceived: 7 }],
      });

      updatedTransfer = await Factories.transfer.getById(page, transferId);
      expect(updatedTransfer.status).toBe('PARTIALLY_RECEIVED');
      expect(updatedTransfer.items[0].qtyReceived).toBe(7);

      // BATCH 4: Receive remaining 3 - status becomes COMPLETED
      await Factories.transfer.receive(page, {
        transferId,
        items: [{ itemId, qtyReceived: 3 }],
      });

      updatedTransfer = await Factories.transfer.getById(page, transferId);
      expect(updatedTransfer.status).toBe('COMPLETED');
      expect(updatedTransfer.items[0].qtyReceived).toBe(10);

      // Verify final stock at destination
      await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}?tab=levels`);
      await page.waitForLoadState('networkidle');

      const retailRow = page.getByRole('row', { name: /retail.*1/i });
      await expect(retailRow).toContainText('10'); // All 10 units received

      // Clean up
      await Factories.product.delete(page, productId);
    } catch (error) {
      await Factories.product.delete(page, productId);
      throw error;
    }
  });
});

test.describe('Transfer Batch Workflow - Multiple Products', () => {
  test('should handle independent batch states per product', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();

    // Setup branches
    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const destBranchId = await Factories.branch.getBySlug(page, 'acme-retail-1');

    // Create two products with LOW prices to avoid approval rules
    const product1Id = await Factories.product.create(page, {
      productName: `Multi Product 1 ${timestamp}`,
      productSku: `MULTI1-${timestamp}`,
      productPricePence: 500, // £5
    });

    const product2Id = await Factories.product.create(page, {
      productName: `Multi Product 2 ${timestamp}`,
      productSku: `MULTI2-${timestamp}`,
      productPricePence: 600, // £6
    });

    // Add stock at source
    await Factories.stock.addStock(page, {
      productId: product1Id,
      branchId: sourceBranchId,
      qtyDelta: 20,
      unitCostPence: 300,
    });

    await Factories.stock.addStock(page, {
      productId: product2Id,
      branchId: sourceBranchId,
      qtyDelta: 20,
      unitCostPence: 400,
    });

    try {
      // Create transfer with both products (low qty to avoid approval rules)
      const transferId = await Factories.transfer.create(page, {
        sourceBranchId,
        destinationBranchId: destBranchId,
        items: [
          { productId: product1Id, qty: 10 }, // 10 × £5 = £50
          { productId: product2Id, qty: 8 },  // 8 × £6 = £48
        ],                                     // Total: £98 (under £100 threshold)
      });

      await Factories.transfer.approve(page, transferId);

      const transfer = await Factories.transfer.getById(page, transferId);
      const item1Id = transfer.items[0].id;
      const item2Id = transfer.items[1].id;

      // Ship product 1 partially (6 out of 10), product 2 fully (8 out of 8)
      await Factories.transfer.ship(page, {
        transferId,
        items: [
          { itemId: item1Id, qtyToShip: 6 },
          { itemId: item2Id, qtyToShip: 8 },
        ],
      });

      let updatedTransfer = await Factories.transfer.getById(page, transferId);
      expect(updatedTransfer.status).toBe('APPROVED'); // Still APPROVED (product 1 not fully shipped)

      // Ship remaining product 1 units (4 out of 4)
      await Factories.transfer.ship(page, {
        transferId,
        items: [{ itemId: item1Id, qtyToShip: 4 }],
      });

      updatedTransfer = await Factories.transfer.getById(page, transferId);
      expect(updatedTransfer.status).toBe('IN_TRANSIT'); // Now IN_TRANSIT (all items fully shipped)

      // Receive both products fully
      await Factories.transfer.receive(page, {
        transferId,
        items: [
          { itemId: item1Id, qtyReceived: 10 },
          { itemId: item2Id, qtyReceived: 8 },
        ],
      });

      updatedTransfer = await Factories.transfer.getById(page, transferId);
      expect(updatedTransfer.status).toBe('COMPLETED');

      // Verify stock at destination
      await page.goto(`/${TEST_USERS.owner.tenant}/products/${product1Id}?tab=levels`);
      await page.waitForLoadState('networkidle');

      const retailRow = page.getByRole('row', { name: /retail.*1/i });
      await expect(retailRow).toContainText('10');

      // Clean up
      await Factories.product.delete(page, product1Id);
      await Factories.product.delete(page, product2Id);
    } catch (error) {
      await Factories.product.delete(page, product1Id);
      await Factories.product.delete(page, product2Id);
      throw error;
    }
  });
});

test.describe('Transfer Batch Workflow - Validation', () => {
  test('should prevent shipping more than approved quantity', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();

    // Setup
    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const destBranchId = await Factories.branch.getBySlug(page, 'acme-retail-1');

    const productId = await Factories.product.create(page, {
      productName: `Validation Product ${timestamp}`,
      productSku: `VAL-${timestamp}`,
      productPricePence: 500, // £5 (low price to avoid approval rules)
    });

    await Factories.stock.addStock(page, {
      productId,
      branchId: sourceBranchId,
      qtyDelta: 20,
      unitCostPence: 300,
    });

    try {
      // Create and approve transfer requesting 10 (low qty to avoid approval rules)
      const transferId = await Factories.transfer.create(page, {
        sourceBranchId,
        destinationBranchId: destBranchId,
        items: [{ productId, qty: 10 }], // 10 × £5 = £50 (under £100 threshold)
      });

      await Factories.transfer.approve(page, transferId);

      const transfer = await Factories.transfer.getById(page, transferId);
      const itemId = transfer.items[0].id;

      // Attempt to ship 12 (more than approved 10) - should fail
      let errorOccurred = false;
      try {
        await Factories.transfer.ship(page, {
          transferId,
          items: [{ itemId, qtyToShip: 12 }],
        });
      } catch (error: any) {
        errorOccurred = true;
        expect(error.message).toContain('Failed to ship transfer');
      }

      expect(errorOccurred).toBe(true);

      // Clean up
      await Factories.product.delete(page, productId);
    } catch (error) {
      await Factories.product.delete(page, productId);
      throw error;
    }
  });

  test('should prevent receiving more than shipped quantity', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();

    // Setup
    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const destBranchId = await Factories.branch.getBySlug(page, 'acme-retail-1');

    const productId = await Factories.product.create(page, {
      productName: `Receive Validation Product ${timestamp}`,
      productSku: `RVAL-${timestamp}`,
      productPricePence: 500, // £5
    });

    await Factories.stock.addStock(page, {
      productId,
      branchId: sourceBranchId,
      qtyDelta: 20,
      unitCostPence: 300,
    });

    try {
      // Create, approve, and ship 10 units
      const transferId = await Factories.transfer.create(page, {
        sourceBranchId,
        destinationBranchId: destBranchId,
        items: [{ productId, qty: 10 }],
      });

      await Factories.transfer.approve(page, transferId);

      const transfer = await Factories.transfer.getById(page, transferId);
      const itemId = transfer.items[0].id;

      await Factories.transfer.ship(page, {
        transferId,
        items: [{ itemId, qtyToShip: 10 }],
      });

      // Attempt to receive 12 (more than shipped 10) - should fail
      let errorOccurred = false;
      try {
        await Factories.transfer.receive(page, {
          transferId,
          items: [{ itemId, qtyReceived: 12 }],
        });
      } catch (error: any) {
        errorOccurred = true;
        expect(error.message).toContain('Failed to receive transfer');
      }

      expect(errorOccurred).toBe(true);

      // Clean up
      await Factories.product.delete(page, productId);
    } catch (error) {
      await Factories.product.delete(page, productId);
      throw error;
    }
  });
});
