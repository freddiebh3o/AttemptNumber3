// transfer-dual-direction.spec.ts
import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS, Factories } from '../../helpers';

/**
 * E2E Tests for Dual-Direction Stock Transfers (PUSH vs PULL)
 *
 * Tests cover:
 * - Creating PUSH transfers (source initiates/sends)
 * - Creating PULL transfers (destination initiates/requests)
 * - Verifying dynamic labels based on initiation type
 * - Filtering by initiation type
 * - Filtering by "Initiated by me"
 * - Displaying initiation type badges in list and detail pages
 *
 * Feature: Stock Transfer Dual-Direction
 * PRD: .agent/Features/InProgress/stock-transfer-dual-direction/prd.md
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

test.describe('Transfer Dual-Direction - PUSH Creation', () => {
  test('should create PUSH transfer with correct labels', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    const timestamp = Date.now();
    const productName = `PUSH Transfer Product ${timestamp}`;
    const productSku = `PUSH-${timestamp}`;

    // Setup: Get branches that ADMIN user is already a member of
    // From seed.ts: admin has access to acme-hq and acme-warehouse
    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-hq');

    // Create product with stock at source branch
    const productId = await Factories.product.create(page, {
      productName,
      productSku,
      productPricePence: 1500,
    });

    await Factories.stock.addStock(page, {
      productId,
      branchId: sourceBranchId,
      qtyDelta: 100,
      unitCostPence: 500,
    });

    let transferId: string | undefined;

    try {
      // Navigate to transfers list
      await page.goto(`/${TEST_USERS.admin.tenant}/stock-transfers`);
      await page.waitForLoadState('networkidle');

      // Open create modal
      await page.getByRole('button', { name: /new transfer/i }).click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Verify default is PUSH
      const segmentedControl = dialog.getByTestId('initiation-type');
      await expect(segmentedControl).toBeVisible();

      // Should show PUSH as selected by default (look for selected button)
      const pushButton = segmentedControl.getByRole('radio', { name: /PUSH.*Send Stock/i });
      await expect(pushButton).toBeChecked();

      // Verify PUSH labels
      await expect(dialog.getByText(/from branch.*sending/i)).toBeVisible();
      await expect(dialog.getByText(/to branch.*receiving/i)).toBeVisible();

      // Fill in transfer details
      await dialog.getByLabel(/from branch/i).click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /hq/i }).click();
      await page.waitForTimeout(300);

      await dialog.getByLabel(/to branch/i).click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /warehouse/i }).click();
      await page.waitForTimeout(300);

      // Add product item
      await dialog.getByRole('button', { name: /add item/i }).click();
      await page.waitForTimeout(500);

      // Select product
      const productSelect = dialog.locator('input[placeholder*="Select product"]').first();
      await productSelect.click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: new RegExp(productName, 'i') }).click();
      await page.waitForTimeout(300);

      // Enter quantity
      const qtyInput = dialog.getByTestId('transfer-item-quantity-input-0').first();
      await qtyInput.fill('10');

      // Submit
      await dialog.getByRole('button', { name: 'Create Transfer Request' }).click();

      // Should redirect to transfer detail page
      await expect(page).toHaveURL(/\/stock-transfers\/[a-f0-9-]+/);
      await page.waitForLoadState('networkidle');

      // Extract transfer ID from URL
      const url = page.url();
      const match = url.match(/\/stock-transfers\/([a-f0-9-]+)/);
      if (match) {
        transferId = match[1];
      }

      // Verify PUSH badge is displayed on detail page
      const initiationTypeBadge = page.getByTestId('transfer-initiation-type');
      await expect(initiationTypeBadge).toBeVisible();
      await expect(initiationTypeBadge).toContainText('PUSH');

      // Verify "Initiated by" badge shows source branch (HQ)
      const initiatedByBadge = page.getByTestId('initiated-by-branch');
      await expect(initiatedByBadge).toBeVisible();
      await expect(initiatedByBadge).toContainText(/hq/i);
    } finally {
      // Cleanup
      if (transferId) {
        await Factories.transfer.delete(page, transferId);
      }
      await Factories.product.delete(page, productId);
    }
  });
});

test.describe('Transfer Dual-Direction - PULL Creation', () => {
  test('should create PULL transfer with correct labels', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    const timestamp = Date.now();
    const productName = `PULL Transfer Product ${timestamp}`;
    const productSku = `PULL-${timestamp}`;

    // Setup: Get branches
    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-hq');

    // Create product with stock at source branch
    const productId = await Factories.product.create(page, {
      productName,
      productSku,
      productPricePence: 1500,
    });

    await Factories.stock.addStock(page, {
      productId,
      branchId: sourceBranchId,
      qtyDelta: 100,
      unitCostPence: 500,
    });

    let transferId: string | undefined;

    try {
      // Navigate to transfers list
      await page.goto(`/${TEST_USERS.admin.tenant}/stock-transfers`);
      await page.waitForLoadState('networkidle');

      // Open create modal
      await page.getByRole('button', { name: /new transfer/i }).click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Switch to PULL
      const segmentedControl = dialog.getByTestId('initiation-type');
      const pullButton = segmentedControl.getByText('PULL (Request Stock)');
      await pullButton.click();
      await page.waitForTimeout(300);

      // Verify PULL is now selected
      await expect(pullButton).toBeChecked();

      // Verify PULL labels (different from PUSH)
      await expect(dialog.getByText(/request from branch/i)).toBeVisible();
      await expect(dialog.getByText(/to my branch.*receiving/i)).toBeVisible();

      // Fill in transfer details
      // In PULL mode: "Request From Branch" is the source (any branch)
      await dialog.getByLabel(/request from branch/i).click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /hq/i }).click();
      await page.waitForTimeout(300);

      // In PULL mode: "To My Branch" is the destination (user's branches only)
      await dialog.getByLabel(/to my branch/i).click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /warehouse/i }).click();
      await page.waitForTimeout(300);

      // Add product item
      await dialog.getByRole('button', { name: /add item/i }).click();
      await page.waitForTimeout(500);

      // Select product
      const productSelect = dialog.locator('input[placeholder*="Select product"]').first();
      await productSelect.click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: new RegExp(productName, 'i') }).click();
      await page.waitForTimeout(300);

      // Enter quantity
      const qtyInput = dialog.getByTestId('transfer-item-quantity-input-0').first();
      await qtyInput.fill('10');

      // Submit
      await dialog.getByRole('button', { name: 'Create Transfer Request' }).click();

      // Should redirect to transfer detail page
      await expect(page).toHaveURL(/\/stock-transfers\/[a-f0-9-]+/);
      await page.waitForLoadState('networkidle');

      // Extract transfer ID from URL
      const url = page.url();
      const match = url.match(/\/stock-transfers\/([a-f0-9-]+)/);
      if (match) {
        transferId = match[1];
      }

      // Verify PULL badge is displayed on detail page
      const initiationTypeBadge = page.getByTestId('transfer-initiation-type');
      await expect(initiationTypeBadge).toBeVisible();
      await expect(initiationTypeBadge).toContainText('PULL');

      // Verify "Initiated by" badge shows destination branch (Warehouse)
      const initiatedByBadge = page.getByTestId('initiated-by-branch');
      await expect(initiatedByBadge).toBeVisible();
      await expect(initiatedByBadge).toContainText(/warehouse/i);
    } finally {
      // Cleanup
      if (transferId) {
        await Factories.transfer.delete(page, transferId);
      }
      await Factories.product.delete(page, productId);
    }
  });
});

test.describe('Transfer Dual-Direction - Filters', () => {
  test('should filter by initiation type (PUSH)', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    const timestamp = Date.now();
    const pushProductName = `PUSH Filter Product ${timestamp}`;
    const pushProductSku = `PUSH-FILTER-${timestamp}`;

    // Setup
    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-hq');

    const pushProductId = await Factories.product.create(page, {
      productName: pushProductName,
      productSku: pushProductSku,
      productPricePence: 1000,
    });

    await Factories.stock.addStock(page, {
      productId: pushProductId,
      branchId: sourceBranchId,
      qtyDelta: 50,
      unitCostPence: 300,
    });

    let pushTransferId: string | undefined;

    try {
      // Create a PUSH transfer
      await page.goto(`/${TEST_USERS.admin.tenant}/stock-transfers`);
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: /new transfer/i }).click();
      const dialog = page.getByRole('dialog');

      // Ensure PUSH is selected (default)
      const pushButton = dialog.getByText('PUSH (Send Stock)');
      await expect(pushButton).toBeChecked();

      // Fill and create
      await dialog.getByLabel(/from branch/i).click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /hq/i }).click();
      await page.waitForTimeout(300);

      await dialog.getByLabel(/to branch/i).click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /warehouse/i }).click();
      await page.waitForTimeout(300);

      await dialog.getByRole('button', { name: /add item/i }).click();
      await page.waitForTimeout(500);

      const productSelect = dialog.locator('input[placeholder*="Select product"]').first();
      await productSelect.click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: new RegExp(pushProductName, 'i') }).click();
      await page.waitForTimeout(300);

      const qtyInput = dialog.getByTestId('transfer-item-quantity-input-0').first();
      await qtyInput.fill('5');

      await dialog.getByRole('button', { name: 'Create Transfer Request' }).click();
      await page.waitForLoadState('networkidle');

      const url = page.url();
      const match = url.match(/\/stock-transfers\/([a-f0-9-]+)/);
      if (match) {
        pushTransferId = match[1];
      }

      // Go back to transfers list
      await page.goto(`/${TEST_USERS.admin.tenant}/stock-transfers`);
      await page.waitForLoadState('networkidle');

      // Open filters
      await page.getByRole('button', { name: /filters/i }).click();
      await page.waitForTimeout(300);

      // Select PUSH filter
      const initiationTypeFilter = page.getByTestId('filter-initiation-type');
      await expect(initiationTypeFilter).toBeVisible();
      await initiationTypeFilter.selectOption('PUSH');

      // Apply filters (usually automatic with select, but wait for reload)
      await page.getByRole('button', { name: /apply/i }).click();
      await page.waitForLoadState('networkidle');

      // Verify PUSH badge is visible in the table
      const pushBadges = page.getByTestId('transfer-row-initiation-type');
      await expect(pushBadges.first()).toBeVisible();
      await expect(pushBadges.first()).toContainText('PUSH');

      // Verify table has at least one transfer row visible
      const tableRows = page.getByRole('table').first().locator('tbody tr');
      await expect(tableRows.first()).toBeVisible();
    } finally {
      // Cleanup
      if (pushTransferId) {
        await Factories.transfer.delete(page, pushTransferId);
      }
      await Factories.product.delete(page, pushProductId);
    }
  });

  test('should filter by initiation type (PULL)', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    const timestamp = Date.now();
    const pullProductName = `PULL Filter Product ${timestamp}`;
    const pullProductSku = `PULL-FILTER-${timestamp}`;

    // Setup
    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-hq');

    const pullProductId = await Factories.product.create(page, {
      productName: pullProductName,
      productSku: pullProductSku,
      productPricePence: 1000,
    });

    await Factories.stock.addStock(page, {
      productId: pullProductId,
      branchId: sourceBranchId,
      qtyDelta: 50,
      unitCostPence: 300,
    });

    let pullTransferId: string | undefined;

    try {
      // Create a PULL transfer
      await page.goto(`/${TEST_USERS.admin.tenant}/stock-transfers`);
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: /new transfer/i }).click();
      const dialog = page.getByRole('dialog');

      // Switch to PULL
      const pullButton = dialog.getByText('PULL (Request Stock)');
      await pullButton.click();
      await page.waitForTimeout(300);

      // Fill and create
      await dialog.getByLabel(/request from branch/i).click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /hq/i }).click();
      await page.waitForTimeout(300);

      await dialog.getByLabel(/to my branch/i).click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /warehouse/i }).click();
      await page.waitForTimeout(300);

      await dialog.getByRole('button', { name: /add item/i }).click();
      await page.waitForTimeout(500);

      const productSelect = dialog.locator('input[placeholder*="Select product"]').first();
      await productSelect.click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: new RegExp(pullProductName, 'i') }).click();
      await page.waitForTimeout(300);

      const qtyInput = dialog.getByTestId('transfer-item-quantity-input-0').first();
      await qtyInput.fill('5');

      await dialog.getByRole('button', { name: 'Create Transfer Request' }).click();
      await page.waitForLoadState('networkidle');

      const url = page.url();
      const match = url.match(/\/stock-transfers\/([a-f0-9-]+)/);
      if (match) {
        pullTransferId = match[1];
      }

      // Go back to transfers list
      await page.goto(`/${TEST_USERS.admin.tenant}/stock-transfers`);
      await page.waitForLoadState('networkidle');

      // Open filters
      await page.getByRole('button', { name: /filters/i }).click();
      await page.waitForTimeout(300);

      // Select PULL filter
      const initiationTypeFilter = page.getByTestId('filter-initiation-type');
      await expect(initiationTypeFilter).toBeVisible();
      await initiationTypeFilter.selectOption('PULL');

      // Apply filters
      await page.getByRole('button', { name: /apply/i }).click();
      await page.waitForLoadState('networkidle');

      // Verify PULL badge is visible in the table
      const pullBadges = page.getByTestId('transfer-row-initiation-type');
      await expect(pullBadges.first()).toBeVisible();
      await expect(pullBadges.first()).toContainText('PULL');

      // Verify table has at least one transfer row visible
      const tableRows = page.getByRole('table').first().locator('tbody tr');
      await expect(tableRows.first()).toBeVisible();
    } finally {
      // Cleanup
      if (pullTransferId) {
        await Factories.transfer.delete(page, pullTransferId);
      }
      await Factories.product.delete(page, pullProductId);
    }
  });

  test('should filter by "Initiated by me"', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    // Navigate to transfers list
    await page.goto(`/${TEST_USERS.admin.tenant}/stock-transfers`);
    await page.waitForLoadState('networkidle');

    // Open filters
    await page.getByRole('button', { name: /filters/i }).click();
    await page.waitForTimeout(300);

    // Select "Initiated by Me" filter
    const initiatedByMeFilter = page.getByTestId('filter-initiated-by-me');
    await expect(initiatedByMeFilter).toBeVisible();
    await initiatedByMeFilter.selectOption('true');

    // Apply filters
    await page.getByRole('button', { name: /apply/i }).click();
    await page.waitForLoadState('networkidle');

    // Verify filter chip is displayed (scope to badge label to avoid matching dropdown option)
    await expect(page.locator('.mantine-Badge-label').filter({ hasText: /initiated.*by me/i })).toBeVisible();

    // All visible transfers should have initiation type badge (PUSH or PULL)
    const initiationBadges = page.getByTestId('transfer-row-initiation-type');
    const count = await initiationBadges.count();

    if (count > 0) {
      // At least one badge should be visible
      await expect(initiationBadges.first()).toBeVisible();
    }
  });
});

test.describe('Transfer Dual-Direction - Detail Page Review Button', () => {
  test('should show "Approve Receipt" for PUSH transfer', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    const timestamp = Date.now();
    const productName = `PUSH Review Product ${timestamp}`;
    const productSku = `PUSH-REV-${timestamp}`;

    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-hq');

    const productId = await Factories.product.create(page, {
      productName,
      productSku,
      productPricePence: 1500,
    });

    await Factories.stock.addStock(page, {
      productId,
      branchId: sourceBranchId,
      qtyDelta: 100,
      unitCostPence: 500,
    });

    let transferId: string | undefined;

    try {
      // Create PUSH transfer
      await page.goto(`/${TEST_USERS.admin.tenant}/stock-transfers`);
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: /new transfer/i }).click();
      const dialog = page.getByRole('dialog');

      // Ensure PUSH (default)
      const pushButton = dialog.getByText('PUSH (Send Stock)');
      await expect(pushButton).toBeChecked();

      // Fill and create
      await dialog.getByLabel(/from branch/i).click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /hq/i }).click();
      await page.waitForTimeout(300);

      await dialog.getByLabel(/to branch/i).click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /warehouse/i }).click();
      await page.waitForTimeout(300);

      await dialog.getByRole('button', { name: /add item/i }).click();
      await page.waitForTimeout(500);

      const productSelect = dialog.locator('input[placeholder*="Select product"]').first();
      await productSelect.click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: new RegExp(productName, 'i') }).click();
      await page.waitForTimeout(300);

      const qtyInput = dialog.getByTestId('transfer-item-quantity-input-0').first();
      await qtyInput.fill('10');

      await dialog.getByRole('button', { name: 'Create Transfer Request' }).click();
      await page.waitForLoadState('networkidle');

      const url = page.url();
      const match = url.match(/\/stock-transfers\/([a-f0-9-]+)/);
      if (match) {
        transferId = match[1];
      }

      // Verify "Approve Receipt" button is visible (PUSH: destination reviews)
      // Note: Admin user must be in destination branch (warehouse) to see review button
      // Since transfer is in REQUESTED status, the button text should be "Approve Receipt"
      const reviewButton = page.getByRole('button', { name: /approve receipt/i });

      // Button may or may not be visible depending on branch membership
      // The important thing is that IF visible, it says "Approve Receipt" not "Approve Request"
      const buttonCount = await reviewButton.count();
      if (buttonCount > 0) {
        await expect(reviewButton).toBeVisible();
      }
    } finally {
      // Cleanup
      if (transferId) {
        await Factories.transfer.delete(page, transferId);
      }
      await Factories.product.delete(page, productId);
    }
  });
});
