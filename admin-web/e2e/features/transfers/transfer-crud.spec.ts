// transfer-crud.spec.ts
import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS, Factories } from '../../helpers';

/**
 * E2E Tests for Stock Transfer CRUD Operations
 *
 * Tests cover:
 * - Navigating to transfers list
 * - Opening create transfer modal
 * - Creating transfer drafts via modal
 * - Viewing transfer details
 * - Validation errors (missing fields, invalid data)
 * - Permission checks (viewer, editor, admin, owner)
 *
 * NOTE: Transfers are created via MODAL, not a dedicated page
 * NOTE: Advanced workflows (approve, ship, receive) are covered in transfer-reversal.spec.ts
 * NOTE: Editing and deleting are done on the detail page
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

test.describe('Transfer CRUD - Navigation', () => {
  test('should navigate to transfers list page', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    // Navigate via sidebar
    const stockManagementNav = page.getByRole('navigation').getByText(/^stock management$/i);
    await expect(stockManagementNav).toBeVisible();
    await stockManagementNav.click();
    await page.waitForTimeout(300); // Wait for expansion animation

    const transfersLink = page.getByRole('link', { name: /^stock transfers$/i });
    await expect(transfersLink).toBeVisible();
    await transfersLink.click();

    // Should navigate to transfers page
    await expect(page).toHaveURL(/\/stock-transfers$/);
    await expect(page.getByRole('heading', { name: /stock transfers/i }).first()).toBeVisible();
  });

  test('should open create transfer modal', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    await page.goto(`/${TEST_USERS.admin.tenant}/stock-transfers`);
    await page.waitForLoadState('networkidle');

    // Click New Transfer button (requires stock:write permission)
    await page.getByRole('button', { name: /new transfer/i }).click();

    // Should open modal dialog
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/create transfer request/i).first()).toBeVisible();

    // Should show form fields
    await expect(dialog.getByLabel(/source branch/i)).toBeVisible();
    await expect(dialog.getByLabel(/destination branch/i)).toBeVisible();
  });

  test('should display transfers table with columns', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    await page.goto(`/${TEST_USERS.admin.tenant}/stock-transfers`);
    await page.waitForLoadState('networkidle');

    // Verify table headers (Mantine uses cells for headers)
    await expect(page.getByRole('columnheader', { name: /transfer/i }).first()).toBeVisible();
  });
});

test.describe('Transfer CRUD - Create Draft via Modal', () => {
  test('should create transfer draft with basic details', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    const timestamp = Date.now();
    const productName = `Transfer CRUD Product ${timestamp}`;
    const productSku = `TCRUD-${timestamp}`;

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

      // Fill in transfer details - select by branch name (more reliable)
      await dialog.getByLabel(/source branch/i).click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /hq/i }).click();
      await page.waitForTimeout(300);

      await dialog.getByLabel(/destination branch/i).click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /warehouse/i }).click();
      await page.waitForTimeout(300);

      // Add product item
      await dialog.getByRole('button', { name: /add item/i }).click();
      await page.waitForTimeout(500);

      // Select product (scoped to dialog)
      const productSelect = dialog.locator('input[placeholder*="Select product"]').first();
      await productSelect.click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: new RegExp(productName, 'i') }).click();
      await page.waitForTimeout(300);

      // Enter quantity (scoped to dialog)
      const qtyInput = dialog.getByTestId('transfer-item-quantity-input-0').first();
      await qtyInput.fill('10');

      // Save draft
      await dialog.getByRole('button', { name: /create|save/i }).click();

      // Should show success notification
      await expect(page.getByText(/transfer.*created/i)).toBeVisible({ timeout: 10000 });

      // Modal should close
      await expect(dialog).not.toBeVisible();
    } finally {
      // Cleanup
      if (transferId) {
        await Factories.transfer.delete(page, transferId);
      }
      await Factories.product.delete(page, productId);
    }
  });

  test('should add multiple products to transfer via modal', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    const timestamp = Date.now();

    // Setup: Use branches that ADMIN user is already a member of
    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-hq');

    // Create two products with stock at source branch
    const product1Id = await Factories.product.create(page, {
      productName: `Multi Product 1 ${timestamp}`,
      productSku: `MULTI1-${timestamp}`,
      productPricePence: 1000,
    });

    await Factories.stock.addStock(page, {
      productId: product1Id,
      branchId: sourceBranchId,
      qtyDelta: 50,
      unitCostPence: 400,
    });

    const product2Id = await Factories.product.create(page, {
      productName: `Multi Product 2 ${timestamp}`,
      productSku: `MULTI2-${timestamp}`,
      productPricePence: 2000,
    });

    await Factories.stock.addStock(page, {
      productId: product2Id,
      branchId: sourceBranchId,
      qtyDelta: 30,
      unitCostPence: 800,
    });

    let transferId: string | undefined;

    try {
      await page.goto(`/${TEST_USERS.admin.tenant}/stock-transfers`);
      await page.waitForLoadState('networkidle');

      // Open modal
      await page.getByRole('button', { name: /new transfer/i }).click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Select branches by name
      await dialog.getByLabel(/source branch/i).click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /hq/i }).click();
      await page.waitForTimeout(300);

      await dialog.getByLabel(/destination branch/i).click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /warehouse/i }).click();
      await page.waitForTimeout(300);

      // Add first product
      await dialog.getByRole('button', { name: /add item/i }).click();
      await page.waitForTimeout(500);

      let productSelect = dialog.locator('input[placeholder*="Select product"]').first();
      await productSelect.click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: new RegExp(`Multi Product 1 ${timestamp}`, 'i') }).click();
      await page.waitForTimeout(300);

      let qtyInput = dialog.getByTestId('transfer-item-quantity-input-0').first();
      await qtyInput.fill('10');

      // Add second product
      await dialog.getByRole('button', { name: /add item/i }).click();
      await page.waitForTimeout(500);

      productSelect = dialog.locator('input[placeholder*="Select product"]').last();
      await productSelect.click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: new RegExp(`Multi Product 2 ${timestamp}`, 'i') }).click();
      await page.waitForTimeout(300);

      qtyInput = dialog.getByTestId('transfer-item-quantity-input-1').last();
      await qtyInput.fill('5');

      // Save draft
      await dialog.getByRole('button', { name: /create|save/i }).click();
      await expect(page.getByText(/transfer.*created/i)).toBeVisible({ timeout: 10000 });

      // Modal should close
      await expect(dialog).not.toBeVisible();
    } finally {
      if (transferId) {
        await Factories.transfer.delete(page, transferId);
      }
      await Factories.product.delete(page, product1Id);
      await Factories.product.delete(page, product2Id);
    }
  });
});

test.describe('Transfer CRUD - View Transfer', () => {
  test('should view transfer details', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    const timestamp = Date.now();
    const productName = `View Details Product ${timestamp}`;
    const productSku = `VIEW-${timestamp}`;

    // Setup: Use branches that ADMIN user is already a member of
    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-hq');
    const destBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');

    // Create product with stock
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

    const transferId = await Factories.transfer.create(page, {
      sourceBranchId,
      destinationBranchId: destBranchId,
      items: [{ productId, qty: 25 }],
      notes: `Test notes ${timestamp}`,
    });

    try {
      // Navigate to transfer detail page
      await page.goto(`/${TEST_USERS.admin.tenant}/stock-transfers/${transferId}`);
      await page.waitForLoadState('networkidle');

      // Verify transfer details are displayed
      await expect(page.getByText(productName)).toBeVisible();

      // Verify quantity is shown in table cell
      await expect(page.getByRole('cell', { name: '25' })).toBeVisible();

      // Verify source and destination branches are shown
      await expect(page.getByText(/hq/i)).toBeVisible();
      await expect(page.getByText(/warehouse/i)).toBeVisible();
    } finally {
      await Factories.transfer.delete(page, transferId);
      await Factories.product.delete(page, productId);
    }
  });
});

test.describe('Transfer CRUD - Validation', () => {
  test('should show validation error for missing source branch', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    await page.goto(`/${TEST_USERS.admin.tenant}/stock-transfers`);
    await page.waitForLoadState('networkidle');

    // Open modal
    await page.getByRole('button', { name: /new transfer/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByLabel(/destination branch/i).click();
    await page.waitForTimeout(300);
    await page.getByRole('option').first().click();
    await page.waitForTimeout(300);

    // Try to save without source branch
    await dialog.getByRole('button', { name: /create|save/i }).click();

    // Should show validation error
    await expect(page.getByText(/please select a source branch/i)).toBeVisible();
  });

  test('should show validation error for empty product list', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    await page.goto(`/${TEST_USERS.admin.tenant}/stock-transfers`);
    await page.waitForLoadState('networkidle');

    // Open modal
    await page.getByRole('button', { name: /new transfer/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const branches = await Factories.branch.getAll(page);
    if (branches.length < 2) {
      throw new Error('Need at least 2 branches for validation test');
    }

    // Select different branches
    await dialog.getByLabel(/source branch/i).click();
    await page.waitForTimeout(300);
    await page.getByRole('option').first().click();
    await page.waitForTimeout(300);

    await dialog.getByLabel(/destination branch/i).click();
    await page.waitForTimeout(300);
    await page.getByRole('option').nth(1).click();
    await page.waitForTimeout(300);

    // Don't add any products
    // Try to save
    await dialog.getByRole('button', { name: /create|save/i }).click();

    // Should show validation error
    await expect(page.getByText(/at least.*item|product.*required/i)).toBeVisible();
  });
});

test.describe('Transfer CRUD - Permission Checks', () => {
  test('viewer cannot create transfers (no stock:write)', async ({ page }) => {
    await signIn(page, TEST_USERS.viewer);

    await page.goto(`/${TEST_USERS.viewer.tenant}/stock-transfers`);
    await page.waitForLoadState('networkidle');

    // New Transfer button should be disabled or hidden (VIEWER lacks stock:write)
    const newButton = page.getByRole('button', { name: /new transfer/i });
    const isVisible = await newButton.isVisible({ timeout: 2000 }).catch(() => false);

    if (isVisible) {
      // Button exists but should be disabled
      await expect(newButton).toBeDisabled();
    } else {
      // Button is hidden
      await expect(newButton).not.toBeVisible();
    }
  });

  test('editor cannot create transfers (no stock:write, only stock:allocate)', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);

    await page.goto(`/${TEST_USERS.editor.tenant}/stock-transfers`);
    await page.waitForLoadState('networkidle');

    // EDITOR has stock:allocate but NOT stock:write, so button should be disabled
    const newButton = page.getByRole('button', { name: /new transfer/i });
    await expect(newButton).toBeVisible(); // Button exists
    await expect(newButton).toBeDisabled(); // But is disabled
  });

  test('admin can create transfers (has stock:write)', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    await page.goto(`/${TEST_USERS.admin.tenant}/stock-transfers`);
    await page.waitForLoadState('networkidle');

    // ADMIN has stock:write, so button should be enabled
    await expect(page.getByRole('button', { name: /new transfer/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /new transfer/i })).toBeEnabled();

    // Can open create modal
    await page.getByRole('button', { name: /new transfer/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel(/source branch/i)).toBeVisible();
  });

  test('owner can create transfers (has stock:write)', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);
    await page.waitForLoadState('networkidle');

    // OWNER has stock:write, so button should be enabled
    await expect(page.getByRole('button', { name: /new transfer/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /new transfer/i })).toBeEnabled();

    // Can open create modal
    await page.getByRole('button', { name: /new transfer/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel(/source branch/i)).toBeVisible();
  });
});
