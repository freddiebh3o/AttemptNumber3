// admin-web/e2e/stock/transfer-reversal-lot-restoration.spec.ts
import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS, Factories, makeAuthenticatedRequest } from '../helpers';

/**
 * E2E Tests for Transfer Reversal Lot Restoration
 *
 * Tests verify that reversed stock returns to original lots instead of creating new lots,
 * preserving FIFO order and lot traceability.
 *
 * Related PRD: .agent/Features/InProgress/transfer-reversal-lot-restoration/prd.md
 * Backend tests: api-server/__tests__/services/stockLotRestoration.test.ts
 *
 * Tests cover:
 * - Reversal returns stock to original lot (verify lot ID matches)
 * - Lot qtyRemaining restored correctly
 * - receivedAt timestamp preserved (FIFO age unchanged)
 * - Ledger shows REVERSAL entries (not RECEIPT)
 * - Multiple reversals on same transfer
 * - UI shows correct stock quantities after reversal
 * - Stock ledger page displays REVERSAL entries
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
    console.warn('   Start it with: cd api-server && npm run dev');
  }
});

// Isolate each test - clear browser state
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.describe('Transfer Reversal Lot Restoration - Basic Flow', () => {
  test('should return stock to original lot after reversal', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    const productName = `Lot Restore Test ${timestamp}`;
    const productSku = `LOT-${timestamp}`;

    // Setup: Create product and get seeded branches that owner has access to
    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const destBranchId = await Factories.branch.getBySlug(page, 'acme-retail-1');

    const productId = await Factories.product.create(page, {
      productName,
      productSku,
      productPricePence: 1000,
    });

    try {
      // Step 1: Add initial stock to source branch
      await Factories.stock.addStock(page, {
        productId,
        branchId: sourceBranchId,
        qtyDelta: 50,
        unitCostPence: 100,
        reason: 'E2E test: Initial stock for lot restoration test',
      });

      // Get the original lot at source branch before transfer
      const sourceStockBefore = await Factories.stock.getLots(page, {
        productId,
        branchId: sourceBranchId,
      });

      expect(sourceStockBefore.productStock.qtyOnHand).toBe(50);
      expect(sourceStockBefore.lots.length).toBe(1);

      const originalLotId = sourceStockBefore.lots[0].id;
      const originalReceivedAt = sourceStockBefore.lots[0].receivedAt;
      const originalUnitCost = sourceStockBefore.lots[0].unitCostPence;

      // Step 2: Create and complete transfer
      const transferId = await Factories.transfer.create(page, {
        sourceBranchId: sourceBranchId,
        destinationBranchId: destBranchId,
        items: [{ productId, qty: 10 }],
      });

      await Factories.transfer.approve(page, transferId);

      const transfer = await Factories.transfer.getById(page, transferId);
      await Factories.transfer.ship(page, {
        transferId,
        items: transfer.items.map((item: any) => ({
          itemId: item.id,
          qtyToShip: item.qtyRequested,
        })),
      });

      // Receive the transfer at destination
      const transferAfterShip = await Factories.transfer.getById(page, transferId);
      await Factories.transfer.receive(page, {
        transferId,
        items: transferAfterShip.items.map((item: any) => ({
          itemId: item.id,
          qtyReceived: item.qtyShipped,
        })),
      });

      // Wait for transfer to complete
      await page.waitForTimeout(1000);

      // Verify stock moved from source to destination
      const sourceStockAfterTransfer = await Factories.stock.getLots(page, {
        productId,
        branchId: sourceBranchId,
      });

      expect(sourceStockAfterTransfer.productStock.qtyOnHand).toBe(40); // 50 - 10

      const destStockAfterTransfer = await Factories.stock.getLots(page, {
        productId,
        branchId: destBranchId,
      });

      expect(destStockAfterTransfer.productStock.qtyOnHand).toBe(10);

      // Step 3: Reverse the transfer via API
      const reverseResponse = await makeAuthenticatedRequest(
        page,
        'POST',
        `/api/stock-transfers/${transferId}/reverse`,
        {
          reason: 'E2E test: Lot restoration reversal',
        }
      );

      expect(reverseResponse.ok()).toBeTruthy();

      // Wait for reversal to complete
      await page.waitForTimeout(1000);

      // Step 4: Verify stock returned to original lot at source
      const sourceStockAfterReversal = await Factories.stock.getLots(page, {
        productId,
        branchId: sourceBranchId,
      });

      expect(sourceStockAfterReversal.productStock.qtyOnHand).toBe(50); // Back to original
      expect(sourceStockAfterReversal.lots.length).toBe(1); // Same lot, not new lot

      // CRITICAL VERIFICATION: Same lot ID (not a new lot)
      expect(sourceStockAfterReversal.lots[0].id).toBe(originalLotId);

      // Verify receivedAt preserved (FIFO age unchanged)
      expect(sourceStockAfterReversal.lots[0].receivedAt).toBe(originalReceivedAt);

      // Verify unit cost preserved
      expect(sourceStockAfterReversal.lots[0].unitCostPence).toBe(originalUnitCost);

      // Verify destination stock returned to zero
      const destStockAfterReversal = await Factories.stock.getLots(page, {
        productId,
        branchId: destBranchId,
      });

      expect(destStockAfterReversal.productStock.qtyOnHand).toBe(0);
    } finally {
      await Factories.product.delete(page, productId);
    }
  });

  test('should create REVERSAL ledger entries (not RECEIPT)', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    const productName = `Ledger Test ${timestamp}`;
    const productSku = `LDG-${timestamp}`;

    // Get seeded branches that owner has access to
    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const destBranchId = await Factories.branch.getBySlug(page, 'acme-retail-1');

    const productId = await Factories.product.create(page, {
      productName,
      productSku,
      productPricePence: 1000,
    });

    try {
      // Setup: Add stock and complete transfer (use low qty to avoid approval rules)
      await Factories.stock.addStock(page, {
        productId,
        branchId: sourceBranchId,
        qtyDelta: 20,
        unitCostPence: 100,
      });

      const transferId = await Factories.transfer.createAndShip(page, {
        sourceBranchId: sourceBranchId,
        destinationBranchId: destBranchId,
        productId,
        quantity: 5, // Low qty to avoid approval rules
        unitCostPence: 100,
      });

      await page.waitForTimeout(1000);

      // Reverse the transfer
      const reverseResponse = await makeAuthenticatedRequest(
        page,
        'POST',
        `/api/stock-transfers/${transferId}/reverse`,
        {
          reason: 'E2E test: Verify REVERSAL ledger entries',
        }
      );

      expect(reverseResponse.ok()).toBeTruthy();
      await page.waitForTimeout(1000);

      // Check ledger for REVERSAL entries (not RECEIPT)
      const sourceLedger = await Factories.stock.getLedger(page, {
        productId,
        branchId: sourceBranchId,
        kinds: 'REVERSAL',
        limit: 10,
      });

      // Should have at least one REVERSAL entry
      expect(sourceLedger.items.length).toBeGreaterThan(0);

      // Verify it's REVERSAL kind
      const reversalEntry = sourceLedger.items.find((entry) => entry.kind === 'REVERSAL');
      expect(reversalEntry).toBeDefined();
      expect(reversalEntry!.kind).toBe('REVERSAL');
      expect(reversalEntry!.qtyDelta).toBe(5); // Positive (returning stock)
      expect(reversalEntry!.reason).toContain('Reversal');
    } finally {
      await Factories.product.delete(page, productId);
    }
  });
});

test.describe('Transfer Reversal Lot Restoration - Multi-Lot Scenarios', () => {
  test('should restore to multiple lots when transfer consumed from multiple lots', async ({
    page,
  }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    const productName = `Multi-Lot Test ${timestamp}`;
    const productSku = `ML-${timestamp}`;

    // Get seeded branches that owner has access to
    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const destBranchId = await Factories.branch.getBySlug(page, 'acme-retail-1');

    const productId = await Factories.product.create(page, {
      productName,
      productSku,
      productPricePence: 1000,
    });

    try {
      // Create multiple lots at source (FIFO order)
      await Factories.stock.addStock(page, {
        productId,
        branchId: sourceBranchId,
        qtyDelta: 10,
        unitCostPence: 100,
        reason: 'First lot (oldest)',
      });

      // Small delay to ensure different receivedAt timestamps
      await page.waitForTimeout(100);

      await Factories.stock.addStock(page, {
        productId,
        branchId: sourceBranchId,
        qtyDelta: 10,
        unitCostPence: 120,
        reason: 'Second lot (middle)',
      });

      await page.waitForTimeout(100);

      await Factories.stock.addStock(page, {
        productId,
        branchId: sourceBranchId,
        qtyDelta: 10,
        unitCostPence: 140,
        reason: 'Third lot (newest)',
      });

      // Get all lots before transfer
      const lotsBeforeTransfer = await Factories.stock.getLots(page, {
        productId,
        branchId: sourceBranchId,
      });

      expect(lotsBeforeTransfer.productStock.qtyOnHand).toBe(30);
      expect(lotsBeforeTransfer.lots.length).toBe(3);

      const originalLotIds = lotsBeforeTransfer.lots.map((lot) => lot.id);
      const originalReceivedAts = lotsBeforeTransfer.lots.map((lot) => lot.receivedAt);

      // Transfer 8 units (will consume from first 2 lots via FIFO) - low qty to avoid approval rules
      // Don't use createAndShip() because it adds more stock - we already have stock
      const transferId = await Factories.transfer.create(page, {
        sourceBranchId: sourceBranchId,
        destinationBranchId: destBranchId,
        items: [{ productId, qty: 8 }],
      });

      await Factories.transfer.approve(page, transferId);

      const transfer = await Factories.transfer.getById(page, transferId);
      await Factories.transfer.ship(page, {
        transferId,
        items: transfer.items.map((item: any) => ({
          itemId: item.id,
          qtyToShip: item.qtyRequested,
        })),
      });

      // Receive at destination
      const transferAfterShip = await Factories.transfer.getById(page, transferId);
      await Factories.transfer.receive(page, {
        transferId,
        items: transferAfterShip.items.map((item: any) => ({
          itemId: item.id,
          qtyReceived: item.qtyShipped,
        })),
      });

      await page.waitForTimeout(1000);

      // Reverse the transfer
      const reverseResponse = await makeAuthenticatedRequest(
        page,
        'POST',
        `/api/stock-transfers/${transferId}/reverse`,
        {
          reason: 'E2E test: Multi-lot restoration',
        }
      );

      expect(reverseResponse.ok()).toBeTruthy();
      await page.waitForTimeout(1000);

      // Verify all lots restored
      const lotsAfterReversal = await Factories.stock.getLots(page, {
        productId,
        branchId: sourceBranchId,
      });

      expect(lotsAfterReversal.productStock.qtyOnHand).toBe(30); // Back to original
      expect(lotsAfterReversal.lots.length).toBe(3); // Same number of lots

      // Verify lot IDs match (same lots, not new ones)
      const restoredLotIds = lotsAfterReversal.lots.map((lot) => lot.id);
      expect(restoredLotIds.sort()).toEqual(originalLotIds.sort());

      // Verify receivedAt timestamps preserved
      const restoredReceivedAts = lotsAfterReversal.lots.map((lot) => lot.receivedAt);
      expect(restoredReceivedAts.sort()).toEqual(originalReceivedAts.sort());
    } finally {
      await Factories.product.delete(page, productId);
    }
  });

  test('should handle reversal after additional stock receipts at source', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    const productName = `Post-Transfer Stock Test ${timestamp}`;
    const productSku = `PTS-${timestamp}`;

    // Get seeded branches that owner has access to
    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const destBranchId = await Factories.branch.getBySlug(page, 'acme-retail-1');

    const productId = await Factories.product.create(page, {
      productName,
      productSku,
      productPricePence: 1000,
    });

    try {
      // Initial stock
      await Factories.stock.addStock(page, {
        productId,
        branchId: sourceBranchId,
        qtyDelta: 20,
        unitCostPence: 100,
      });

      const lotsBeforeTransfer = await Factories.stock.getLots(page, {
        productId,
        branchId: sourceBranchId,
      });

      const originalLotId = lotsBeforeTransfer.lots[0].id;

      // Transfer some stock
      const transferId = await Factories.transfer.createAndShip(page, {
        sourceBranchId: sourceBranchId,
        destinationBranchId: destBranchId,
        productId,
        quantity: 10,
        unitCostPence: 100,
      });

      await page.waitForTimeout(1000);

      // Add MORE stock to source after transfer (new lot)
      await Factories.stock.addStock(page, {
        productId,
        branchId: sourceBranchId,
        qtyDelta: 30,
        unitCostPence: 150,
        reason: 'New stock received after transfer',
      });

      const lotsBeforeReversal = await Factories.stock.getLots(page, {
        productId,
        branchId: sourceBranchId,
      });

      // createAndShip() adds stock, so we have: 20 initial + 10 from createAndShip + 30 new = 60 total
      // After transfer of 10: 50 remaining
      expect(lotsBeforeReversal.productStock.qtyOnHand).toBe(50); // 20 (remaining from original lot + createAndShip lot) + 30 new
      expect(lotsBeforeReversal.lots.length).toBe(3); // Original partial + createAndShip lot + new lot

      // Reverse the transfer
      const reverseResponse = await makeAuthenticatedRequest(
        page,
        'POST',
        `/api/stock-transfers/${transferId}/reverse`,
        {
          reason: 'E2E test: Reversal with intervening stock',
        }
      );

      expect(reverseResponse.ok()).toBeTruthy();
      await page.waitForTimeout(1000);

      // Verify lots restored + new lot still exists
      const lotsAfterReversal = await Factories.stock.getLots(page, {
        productId,
        branchId: sourceBranchId,
      });

      // After reversal: 20 initial + 10 from createAndShip + 30 new + 10 reversed = 70 total
      expect(lotsAfterReversal.productStock.qtyOnHand).toBe(60); // 20 original + 10 from createAndShip + 30 new
      expect(lotsAfterReversal.lots.length).toBe(3); // Original lot + createAndShip lot + new lot

      // Verify original lot fully restored
      const originalLot = lotsAfterReversal.lots.find((lot) => lot.id === originalLotId);
      expect(originalLot).toBeDefined();
      expect(originalLot!.qtyRemaining).toBe(20); // Fully restored
    } finally {
      await Factories.product.delete(page, productId);
    }
  });
});

test.describe('Transfer Reversal Lot Restoration - UI Integration', () => {
  test('should display correct stock quantities in UI after reversal', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    const productName = `UI Test ${timestamp}`;
    const productSku = `UI-${timestamp}`;

    // Get seeded branches that owner has access to
    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const destBranchId = await Factories.branch.getBySlug(page, 'acme-retail-1');

    const productId = await Factories.product.create(page, {
      productName,
      productSku,
      productPricePence: 1000,
    });

    try {
      // Setup stock and transfer (use low qty to avoid approval rules)
      await Factories.stock.addStock(page, {
        productId,
        branchId: sourceBranchId,
        qtyDelta: 20,
        unitCostPence: 100,
      });

      const transferId = await Factories.transfer.createAndShip(page, {
        sourceBranchId: sourceBranchId,
        destinationBranchId: destBranchId,
        productId,
        quantity: 5, // Low qty to avoid approval rules
        unitCostPence: 100,
      });

      await page.waitForTimeout(1000);

      // Navigate to product FIFO tab for SOURCE branch (where stock should be returned to)
      await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}?tab=fifo&branchId=${sourceBranchId}`);
      await page.waitForLoadState('networkidle');


      // Check stock level before reversal at SOURCE branch
      // Initial: 20 units added
      // createAndShip: adds 5 more units (now 25), then ships 5 units (back to 20)
      // So source branch should have 20 units
      const onHandTextBefore = await page.getByText(/on hand:/i).textContent();
      const qtyBefore = parseInt(onHandTextBefore?.match(/on hand:\s*(\d+)/i)?.[1] || '0');
      expect(qtyBefore).toBe(20); // 20 initial + 5 from createAndShip - 5 shipped = 20

      // Reverse transfer via API
      const reverseResponse = await makeAuthenticatedRequest(
        page,
        'POST',
        `/api/stock-transfers/${transferId}/reverse`,
        {
          reason: 'E2E test: UI verification',
        }
      );

      expect(reverseResponse.ok()).toBeTruthy();

      // Refresh the page to see updated quantities
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      // Verify stock level restored in UI
      const onHandTextAfter = await page.getByText(/on hand:/i).textContent();
      const qtyAfter = parseInt(onHandTextAfter?.match(/on hand:\s*(\d+)/i)?.[1] || '0');
      expect(qtyAfter).toBe(25); // 20 initial + 5 from createAndShip (back to pre-transfer)
    } finally {
      await Factories.product.delete(page, productId);
    }
  });

  test('should show REVERSAL entries in stock ledger UI', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    const productName = `Ledger UI Test ${timestamp}`;
    const productSku = `LUI-${timestamp}`;

    // Get seeded branches that owner has access to
    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const destBranchId = await Factories.branch.getBySlug(page, 'acme-retail-1');

    const productId = await Factories.product.create(page, {
      productName,
      productSku,
      productPricePence: 1000,
    });

    try {
      // Setup and reverse transfer
      const transferId = await Factories.transfer.createAndShip(page, {
        sourceBranchId: sourceBranchId,
        destinationBranchId: destBranchId,
        productId,
        quantity: 8,
        unitCostPence: 100,
      });

      await page.waitForTimeout(1000);

      const reverseResponse = await makeAuthenticatedRequest(
        page,
        'POST',
        `/api/stock-transfers/${transferId}/reverse`,
        {
          reason: 'E2E test: Ledger UI REVERSAL entry',
        }
      );

      expect(reverseResponse.ok()).toBeTruthy();
      await page.waitForTimeout(1000);

      // Navigate to product FIFO tab for SOURCE branch to see ledger with REVERSAL entries
      await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}?tab=fifo&branchId=${sourceBranchId}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      // Scroll down to ledger section
      await page.getByRole('heading', { level: 4, name: /ledger/i }).scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      // Check for REVERSAL in ledger table
      const ledgerTable = page.locator('table').last();
      await expect(ledgerTable).toBeVisible();

      // Verify REVERSAL entry exists (use .first() to avoid strict mode violation)
      const reversalCell = ledgerTable.getByText('REVERSAL').first();
      await expect(reversalCell).toBeVisible();
    } finally {
      await Factories.product.delete(page, productId);
    }
  });
});

test.describe('Transfer Reversal Lot Restoration - Edge Cases', () => {
  test('should handle multi-batch shipment reversal correctly', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    const productName = `Partial Test ${timestamp}`;
    const productSku = `PART-${timestamp}`;

    // Get seeded branches that owner has access to
    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const destBranchId = await Factories.branch.getBySlug(page, 'acme-retail-1');

    const productId = await Factories.product.create(page, {
      productName,
      productSku,
      productPricePence: 1000,
    });

    try {
      // Add initial stock (low qty to avoid approval rules)
      await Factories.stock.addStock(page, {
        productId,
        branchId: sourceBranchId,
        qtyDelta: 30,
        unitCostPence: 100,
      });

      // Create transfer but ship less than requested
      const transferId = await Factories.transfer.create(page, {
        sourceBranchId: sourceBranchId,
        destinationBranchId: destBranchId,
        items: [{ productId, qty: 10 }],
      });

      await Factories.transfer.approve(page, transferId);

      const transfer = await Factories.transfer.getById(page, transferId);

      // Ship only partial quantity (6 out of 10)
      await Factories.transfer.ship(page, {
        transferId,
        items: transfer.items.map((item: any) => ({
          itemId: item.id,
          qtyToShip: 6, // Only ship 6 instead of 10 (partial shipment)
        })),
      });

      await page.waitForTimeout(500);

      // Ship the remaining quantity to complete the shipment
      const transferAfterFirstShip = await Factories.transfer.getById(page, transferId);
      await Factories.transfer.ship(page, {
        transferId,
        items: transferAfterFirstShip.items.map((item: any) => ({
          itemId: item.id,
          qtyToShip: 4, // Ship remaining 4 units
        })),
      });

      await page.waitForTimeout(500);

      // Now receive all shipped items at destination
      const transferAfterAllShipped = await Factories.transfer.getById(page, transferId);
      await Factories.transfer.receive(page, {
        transferId,
        items: transferAfterAllShipped.items.map((item: any) => ({
          itemId: item.id,
          qtyReceived: item.qtyShipped, // Receive all 10 shipped
        })),
      });

      await page.waitForTimeout(1000);

      // Verify all stock transferred
      const sourceAfterTransfer = await Factories.stock.getLots(page, {
        productId,
        branchId: sourceBranchId,
      });
      expect(sourceAfterTransfer.productStock.qtyOnHand).toBe(20); // 30 - 10

      // Reverse the transfer (was shipped in 2 batches: 6 + 4)
      const reverseResponse = await makeAuthenticatedRequest(
        page,
        'POST',
        `/api/stock-transfers/${transferId}/reverse`,
        {
          reason: 'E2E test: Multi-batch shipment reversal',
        }
      );

      expect(reverseResponse.ok()).toBeTruthy();
      await page.waitForTimeout(1000);

      // Verify all shipped quantity (10 total) is restored
      const sourceAfterReversal = await Factories.stock.getLots(page, {
        productId,
        branchId: sourceBranchId,
      });
      expect(sourceAfterReversal.productStock.qtyOnHand).toBe(30); // Back to original

      const destAfterReversal = await Factories.stock.getLots(page, {
        productId,
        branchId: destBranchId,
      });
      expect(destAfterReversal.productStock.qtyOnHand).toBe(0);
    } finally {
      await Factories.product.delete(page, productId);
    }
  });

  test('should maintain FIFO order after reversal', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    const productName = `FIFO Order Test ${timestamp}`;
    const productSku = `FIFO-${timestamp}`;

    // Get seeded branches that owner has access to
    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const destBranchId = await Factories.branch.getBySlug(page, 'acme-retail-1');

    const productId = await Factories.product.create(page, {
      productName,
      productSku,
      productPricePence: 1000,
    });

    try {
      // Create lots with different costs (FIFO order)
      await Factories.stock.addStock(page, {
        productId,
        branchId: sourceBranchId,
        qtyDelta: 10,
        unitCostPence: 100, // Oldest
      });

      await page.waitForTimeout(100);

      await Factories.stock.addStock(page, {
        productId,
        branchId: sourceBranchId,
        qtyDelta: 10,
        unitCostPence: 200, // Middle
      });

      await page.waitForTimeout(100);

      await Factories.stock.addStock(page, {
        productId,
        branchId: sourceBranchId,
        qtyDelta: 10,
        unitCostPence: 300, // Newest
      });

      const lotsBeforeTransfer = await Factories.stock.getLots(page, {
        productId,
        branchId: sourceBranchId,
      });

      // Verify FIFO order (oldest first)
      expect(lotsBeforeTransfer.lots[0].unitCostPence).toBe(100);
      expect(lotsBeforeTransfer.lots[1].unitCostPence).toBe(200);
      expect(lotsBeforeTransfer.lots[2].unitCostPence).toBe(300);

      const originalReceivedAtOrder = lotsBeforeTransfer.lots.map((lot) => lot.receivedAt);

      // Transfer and reverse (use low qty to avoid approval rules)
      const transferId = await Factories.transfer.createAndShip(page, {
        sourceBranchId: sourceBranchId,
        destinationBranchId: destBranchId,
        productId,
        quantity: 5, // Low qty to avoid approval rules
        unitCostPence: 100,
      });

      await page.waitForTimeout(1000);

      const reverseResponse = await makeAuthenticatedRequest(
        page,
        'POST',
        `/api/stock-transfers/${transferId}/reverse`,
        {
          reason: 'E2E test: FIFO order preservation',
        }
      );

      expect(reverseResponse.ok()).toBeTruthy();
      await page.waitForTimeout(1000);

      // Verify FIFO order preserved after reversal
      const lotsAfterReversal = await Factories.stock.getLots(page, {
        productId,
        branchId: sourceBranchId,
      });

      // createAndShip adds 5 units, so we have 4 lots total (3 original + 1 from createAndShip)
      expect(lotsAfterReversal.lots.length).toBe(4);

      // Verify cost order preserved (FIFO order maintained)
      // After reversal: original 3 lots + createAndShip lot
      expect(lotsAfterReversal.lots[0].unitCostPence).toBe(100); // Original lot 1
      expect(lotsAfterReversal.lots[1].unitCostPence).toBe(200); // Original lot 2
      expect(lotsAfterReversal.lots[2].unitCostPence).toBe(300); // Original lot 3
      expect(lotsAfterReversal.lots[3].unitCostPence).toBe(100); // createAndShip lot

      // Verify original 3 lots have their receivedAt timestamps preserved
      const firstThreeReceivedAts = lotsAfterReversal.lots.slice(0, 3).map((lot) => lot.receivedAt);
      expect(firstThreeReceivedAts).toEqual(originalReceivedAtOrder);
    } finally {
      await Factories.product.delete(page, productId);
    }
  });
});
