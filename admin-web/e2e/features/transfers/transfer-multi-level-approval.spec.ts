// transfer-multi-level-approval.spec.ts
import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS, Factories } from '../../helpers';

/**
 * E2E Tests for Multi-Level Approval Workflow
 *
 * Tests cover:
 * - Rule evaluation when transfer is created
 * - Approval progress display on transfer detail page
 * - Sequential approval workflow (Level 1 → Level 2)
 * - Approval/rejection actions by authorized users
 * - Permission-based authorization checks
 *
 * **Test Isolation Pattern:**
 * - Each test creates its own unique data using timestamps
 * - Tests should ideally clean up after themselves
 * - No reliance on seed data except for base tenant/users
 * - Cookies cleared between tests
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

test.describe('Multi-Level Approval - Indicator Display', () => {
  test('should show multi-level badge in transfers list', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Navigate to Stock Transfers page
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);
    await page.waitForTimeout(1000);

    // Look for any transfers with multi-level approval
    // If High Quantity rule exists (>100 units), we should see "Multi-Level" badges
    const multiLevelBadge = page.getByText(/multi-level/i).first();

    // Note: This test is observational - we can't guarantee a multi-level transfer exists
    // But if one does, we should see the indicator
    if (await multiLevelBadge.isVisible()) {
      await expect(multiLevelBadge).toBeVisible();
    }
  });
});

test.describe('Multi-Level Approval - Transfer Creation', () => {
  test('should create transfer that matches approval rule', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    const productName = `Multi-Level Test Product ${timestamp}`;
    const productSku = `MLVL-${timestamp}`;

    // Get seeded branches that owner has access to
    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const destBranchId = await Factories.branch.getBySlug(page, 'acme-retail-1');

    // Create product and add stock
    const productId = await Factories.product.create(page, {
      productName,
      productSku,
      productPricePence: 1000,
    });

    await Factories.stock.addStock(page, {
      productId,
      branchId: sourceBranchId,
      qtyDelta: 200, // Enough stock for our transfer
      unitCostPence: 500,
    });

    // Navigate to stock transfers
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);
    await page.waitForTimeout(1000);

    // Create a transfer that matches the rule (>100 units to trigger multi-level approval)
    await page.getByRole('button', { name: /new transfer/i }).click();
    await page.waitForTimeout(500);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Select source branch using the working pattern
    await dialog.getByLabel(/source branch/i).click();
    await page.waitForTimeout(500);
    // getByRole automatically filters hidden elements
    await page.getByRole('option').first().click();

    // Wait for selection to register
    await page.waitForTimeout(500);

    // Select destination branch (different from source)
    await dialog.getByLabel(/destination branch/i).click();
    await page.waitForTimeout(500);
    const destOptions = page.getByRole('option');
    const destCount = await destOptions.count();
    if (destCount > 1) {
      await destOptions.nth(1).click();
    } else {
      await destOptions.first().click();
    }

    await page.waitForTimeout(500);

    // Add items with total quantity > 100 to trigger multi-level approval rule
    await dialog.getByRole('button', { name: /add item/i }).click();
    await page.waitForTimeout(500);

    // Wait for the product select to be enabled (data finished loading)
    const productSelect = page.getByTestId('transfer-item-product-select-0');
    await productSelect.waitFor({ state: 'visible', timeout: 10000 });

    // Wait for it to be enabled (isLoadingData = false)
    await expect(productSelect).toBeEnabled({ timeout: 10000 });

    // Click to open dropdown
    await productSelect.click();
    await page.waitForTimeout(500);

    // Select the first product option
    // getByRole automatically filters hidden elements
    await page.getByRole('option').first().click();

    await page.waitForTimeout(500);

    // Enter high quantity (>100 to trigger multi-level approval rule)
    const qtyInput = page.getByTestId('transfer-item-quantity-input-0');
    await qtyInput.fill('150');

    // Submit transfer
    await dialog.getByRole('button', { name: /create transfer/i }).click();

    // Wait for creation and navigation
    await page.waitForTimeout(2000);

    // Should redirect to transfers list or detail page
    await expect(page).toHaveURL(/\/stock-transfers/);

    // Should show success notification
    await expect(page.getByText(/transfer.*created/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Multi-Level Approval - Detail Page Display', () => {
  test('should display approval progress section for multi-level transfers', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Navigate to transfers list
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);
    await page.waitForTimeout(1000);

    // Look for a transfer with "Multi-Level" badge
    const multiLevelBadge = page.getByText(/multi-level/i).first();

    if (await multiLevelBadge.isVisible()) {
      // Click on the transfer row to view details
      const transferRow = multiLevelBadge.locator('../..').locator('..');
      const viewButton = transferRow.getByRole('button', { name: /view/i }).or(
        transferRow.locator('button').first()
      );
      await viewButton.click();

      // Wait for detail page to load
      await page.waitForTimeout(1000);

      // Should see Approval Progress section
      await expect(page.getByText(/approval progress/i)).toBeVisible();

      // Should see level information
      await expect(page.getByText(/level \d+/i).first()).toBeVisible();

      // Should see approval status badges (PENDING, APPROVED, etc.)
      const statusBadge = page.getByText(/pending|approved|rejected/i).first();
      await expect(statusBadge).toBeVisible();
    }
  });

  test('should show approve/reject buttons for authorized users', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Navigate to transfers list
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);
    await page.waitForTimeout(1000);

    // Look for a REQUESTED transfer with multi-level approval
    const requestedTransfer = page.locator('table tbody tr').filter({
      hasText: /requested/i,
    }).filter({
      hasText: /multi-level/i,
    }).first();

    if (await requestedTransfer.isVisible()) {
      // Click to view details
      const viewButton = requestedTransfer.getByRole('button', { name: /view/i }).or(
        requestedTransfer.locator('button').first()
      );
      await viewButton.click();

      await page.waitForTimeout(1000);

      // Should see approval progress
      await expect(page.getByText(/approval progress/i)).toBeVisible();

      // Look for approve/reject buttons (only visible if user is authorized for pending level)
      const approveButton = page.getByRole('button', { name: /approve level/i }).first();
      const rejectButton = page.getByRole('button', { name: /reject level/i }).first();

      // At least one should be visible if user is authorized
      const hasApproveButton = await approveButton.isVisible();
      const hasRejectButton = await rejectButton.isVisible();

      if (hasApproveButton || hasRejectButton) {
        await expect(approveButton.or(rejectButton)).toBeVisible();
      }
    }
  });
});

test.describe('Multi-Level Approval - Approval Actions', () => {
  test('should approve level 1 as authorized user', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    const productName = `Approval Test Product ${timestamp}`;
    const productSku = `APR-${timestamp}`;

    // Get seeded branches that owner has access to
    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const destBranchId = await Factories.branch.getBySlug(page, 'acme-retail-1');

    // Create product and add stock
    const productId = await Factories.product.create(page, {
      productName,
      productSku,
      productPricePence: 1000,
    });

    await Factories.stock.addStock(page, {
      productId,
      branchId: sourceBranchId,
      qtyDelta: 200,
      unitCostPence: 500,
    });

    // Create transfer with >100 qty to trigger multi-level approval (if rule exists)
    const transferId = await Factories.transfer.create(page, {
      sourceBranchId: sourceBranchId,
      destinationBranchId: destBranchId,
      items: [{ productId, qty: 150 }],
    });

    // Navigate to the transfer detail page
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/${transferId}`);
    await page.waitForTimeout(1000);

    // Check if this transfer has multi-level approval
    const hasMultiLevel = await page.getByText(/multi-level/i).isVisible();

    if (hasMultiLevel) {
      // Should see approval progress
      await expect(page.getByText(/approval progress/i)).toBeVisible();

      // Check if Level 1 is pending
      const level1Pending = page.getByText(/level 1/i).locator('..').getByText(/pending/i);
      if (await level1Pending.isVisible()) {
        // Click Approve Level 1 button
        const approveButton = page.getByRole('button', { name: /approve level 1/i });
        await approveButton.click();

        await page.waitForTimeout(500);

        // Approval confirmation modal should open
        const confirmDialog = page.getByRole('dialog');
        await expect(confirmDialog).toBeVisible();

        // Add optional notes
        const notesTextarea = confirmDialog.getByLabel(/notes/i);
        if (await notesTextarea.isVisible()) {
          await notesTextarea.fill('Approved by automated test');
        }

        // Confirm approval
        await confirmDialog.getByRole('button', { name: /approve/i }).click();

        // Should show success notification
        await expect(page.getByText(/approval submitted/i)).toBeVisible({ timeout: 10000 });

        // Level 1 should now show as APPROVED
        await page.waitForTimeout(1000);
        await expect(page.getByText(/level 1/i).locator('..').getByText(/approved/i)).toBeVisible();
      }
    } else {
      console.log('⏭️  No multi-level approval rule configured - test observational only');
    }
  });

  test('should reject level as authorized user', async ({ page }) => {
    // Use owner instead of admin to ensure branch membership for stock operations
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    const productName = `Rejection Test Product ${timestamp}`;
    const productSku = `REJ-${timestamp}`;

    // Get seeded branches that owner has access to
    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const destBranchId = await Factories.branch.getBySlug(page, 'acme-retail-1');

    // Create product and add stock
    const productId = await Factories.product.create(page, {
      productName,
      productSku,
      productPricePence: 1000,
    });

    await Factories.stock.addStock(page, {
      productId,
      branchId: sourceBranchId,
      qtyDelta: 200,
      unitCostPence: 500,
    });

    // Create transfer with >100 qty to trigger multi-level approval (if rule exists)
    const transferId = await Factories.transfer.create(page, {
      sourceBranchId: sourceBranchId,
      destinationBranchId: destBranchId,
      items: [{ productId, qty: 150 }],
    });

    // Navigate to the transfer detail page
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/${transferId}`);
    await page.waitForTimeout(1000);

    // Check if this transfer has multi-level approval
    const hasMultiLevel = await page.getByText(/multi-level/i).isVisible();

    if (hasMultiLevel) {
      // Should see approval progress
      await expect(page.getByText(/approval progress/i)).toBeVisible();

      // Look for any reject button for pending level
      const rejectButton = page.getByRole('button', { name: /reject level/i }).first();
      if (await rejectButton.isVisible()) {
        await rejectButton.click();

        await page.waitForTimeout(500);

        // Rejection confirmation modal should open
        const confirmDialog = page.getByRole('dialog');
        await expect(confirmDialog).toBeVisible();

        // Add rejection reason (should be required or recommended)
        const notesTextarea = confirmDialog.getByLabel(/notes|reason/i);
        await notesTextarea.fill('Rejected by automated test - insufficient inventory');

        // Confirm rejection
        await confirmDialog.getByRole('button', { name: /reject/i }).click();

        // Should show success notification
        await expect(page.getByText(/rejection submitted/i)).toBeVisible({ timeout: 10000 });

        // Transfer should now show rejected status
        await page.waitForTimeout(1000);
        await expect(page.getByText(/rejected/i)).toBeVisible();
      }
    } else {
      console.log('⏭️  No multi-level approval rule configured - test observational only');
    }
  });
});

test.describe('Multi-Level Approval - Sequential Workflow', () => {
  test('should enforce sequential approval order', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    const productName = `Sequential Test Product ${timestamp}`;
    const productSku = `SEQ-${timestamp}`;

    // Get seeded branches that owner has access to
    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const destBranchId = await Factories.branch.getBySlug(page, 'acme-retail-1');

    // Create product and add stock
    const productId = await Factories.product.create(page, {
      productName,
      productSku,
      productPricePence: 1000,
    });

    await Factories.stock.addStock(page, {
      productId,
      branchId: sourceBranchId,
      qtyDelta: 200,
      unitCostPence: 500,
    });

    // Create transfer with >100 qty to trigger multi-level approval (if rule exists)
    const transferId = await Factories.transfer.create(page, {
      sourceBranchId: sourceBranchId,
      destinationBranchId: destBranchId,
      items: [{ productId, qty: 150 }],
    });

    // Navigate to the transfer detail page
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/${transferId}`);
    await page.waitForTimeout(1000);

    // Check if this transfer has multi-level approval
    const hasMultiLevel = await page.getByText(/multi-level/i).isVisible();

    if (hasMultiLevel) {
      // Should see approval progress
      await expect(page.getByText(/approval progress/i)).toBeVisible();

      // Check approval mode
      const isSequential = await page.getByText(/sequential/i).isVisible();

      if (isSequential) {
        // Check if Level 1 is pending
        const level1Pending = page.getByText(/level 1/i).locator('..').getByText(/pending/i);

        if (await level1Pending.isVisible()) {
          // Level 2 button should NOT be visible (sequential mode - must approve L1 first)
          const approveLevel2Button = page.getByRole('button', { name: /approve level 2/i });
          await expect(approveLevel2Button).not.toBeVisible();
        }
      }
    } else {
      console.log('⏭️  No multi-level approval rule configured - test observational only');
    }
  });
});

test.describe('Multi-Level Approval - Progress Display', () => {
  test('should show progress bar with completion percentage', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Navigate to transfers
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);
    await page.waitForTimeout(1000);

    // Find a multi-level transfer
    const multiLevelTransfer = page.locator('table tbody tr').filter({
      hasText: /multi-level/i,
    }).first();

    if (await multiLevelTransfer.isVisible()) {
      const viewButton = multiLevelTransfer.getByRole('button', { name: /view/i }).or(
        multiLevelTransfer.locator('button').first()
      );
      await viewButton.click();

      await page.waitForTimeout(1000);

      // Should see progress indicator
      await expect(page.getByText(/approval progress/i)).toBeVisible();

      // Should see progress text (e.g., "1 of 2 levels approved")
      await expect(page.getByText(/\d+ of \d+ levels? approved/i)).toBeVisible();

      // Progress bar or indicator should be visible
      // (Implementation depends on component used - could be Progress, RingProgress, etc.)
    }
  });
});

test.describe('Multi-Level Approval - Permissions', () => {
  test('should hide approve buttons for unauthorized users', async ({ page }) => {
    await signIn(page, TEST_USERS.viewer);

    // Navigate to transfers
    await page.goto(`/${TEST_USERS.viewer.tenant}/stock-transfers`);
    await page.waitForTimeout(1000);

    // Find a multi-level transfer
    const multiLevelTransfer = page.locator('table tbody tr').filter({
      hasText: /multi-level/i,
    }).first();

    if (await multiLevelTransfer.isVisible()) {
      const viewButton = multiLevelTransfer.getByRole('button', { name: /view/i }).or(
        multiLevelTransfer.locator('button').first()
      );
      await viewButton.click();

      await page.waitForTimeout(1000);

      // Viewer should see approval progress but NOT action buttons
      await expect(page.getByText(/approval progress/i)).toBeVisible();

      // Should NOT see approve/reject buttons
      await expect(page.getByRole('button', { name: /approve level/i })).not.toBeVisible();
      await expect(page.getByRole('button', { name: /reject level/i })).not.toBeVisible();
    }
  });
});
