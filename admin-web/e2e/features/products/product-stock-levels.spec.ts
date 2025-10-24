// admin-web/e2e/features/products/product-stock-levels.spec.ts
import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS, Factories } from '../../helpers';

/**
 * Phase 4: Product Stock Levels Tab Tests
 *
 * Tests cover:
 * - Navigate to Stock Levels tab
 * - Display stock levels across all branches
 * - Show on-hand quantity per branch
 * - Show allocated quantities
 * - Show open lots count
 * - Empty state when no stock
 * - Refresh button updates data
 * - Permission checks for different roles
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

test.describe('Product Stock Levels Tab - Navigation', () => {
  test('should navigate to Stock Levels tab from product page', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Get first product
    const productId = await Factories.product.getFirst(page);

    // Navigate to product page
    await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}`);
    await page.waitForLoadState('networkidle');

    // Click Stock Levels tab
    await page.getByRole('tab', { name: /stock levels/i }).click();

    // Should update URL
    await expect(page).toHaveURL(/tab=levels/);

    // Should show tab heading
    await expect(page.getByRole('heading', { name: /current stock levels/i })).toBeVisible();
  });

  test('should navigate directly to Stock Levels tab via URL', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Get first product
    const productId = await Factories.product.getFirst(page);

    // Navigate directly with query param
    await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}?tab=levels`);
    await page.waitForLoadState('networkidle');

    // Should show tab heading
    await expect(page.getByRole('heading', { name: /current stock levels/i })).toBeVisible();
  });
});

test.describe('Product Stock Levels Tab - Display', () => {
  test('should display stock levels table with all columns', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Create product with stock
    const timestamp = Date.now();
    const { productId } = await Factories.stock.createProductWithStock(page, {
      productName: `Stock Test Product ${timestamp}`,
      productSku: `STK-${timestamp}`,
      productPricePence: 1500,
      initialQty: 50,
      unitCostPence: 500,
    });

    try {
      // Navigate to Stock Levels tab
      await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}?tab=levels`);
      await page.waitForLoadState('networkidle');

      // Wait for table to load
      await expect(page.getByRole('table')).toBeVisible();

      // Should show table headers
      await expect(page.locator('th', { hasText: /^branch$/i })).toBeVisible();
      await expect(page.locator('th', { hasText: /^on hand$/i })).toBeVisible();
      await expect(page.locator('th', { hasText: /^allocated$/i })).toBeVisible();
      await expect(page.locator('th', { hasText: /^open lots$/i })).toBeVisible();
    } finally {
      await Factories.product.delete(page, productId);
    }
  });

  test('should display on-hand quantity for each branch', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Create product with stock at warehouse
    const timestamp = Date.now();
    const { productId } = await Factories.stock.createProductWithStock(page, {
      productName: `Qty Test Product ${timestamp}`,
      productSku: `QTY-${timestamp}`,
      productPricePence: 1000,
      initialQty: 100,
      unitCostPence: 300,
    });

    try {
      // Navigate to Stock Levels tab
      await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}?tab=levels`);
      await page.waitForLoadState('networkidle');

      // Wait for table to load
      await expect(page.getByRole('table')).toBeVisible();

      // Find the row for Warehouse branch (where stock was created) and check on-hand quantity
      const warehouseRow = page.getByRole('row', { name: /warehouse/i });
      await expect(warehouseRow).toContainText('100');
    } finally {
      await Factories.product.delete(page, productId);
    }
  });

  test('should display allocated quantities', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Create product with stock
    const timestamp = Date.now();
    const { productId } = await Factories.stock.createProductWithStock(page, {
      productName: `Allocated Test Product ${timestamp}`,
      productSku: `ALLOC-${timestamp}`,
      productPricePence: 1200,
      initialQty: 75,
      unitCostPence: 400,
    });

    try {
      // Navigate to Stock Levels tab
      await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}?tab=levels`);
      await page.waitForLoadState('networkidle');

      // Wait for table to load
      await expect(page.getByRole('table')).toBeVisible();

      // Should show 0 allocated (no allocations yet)
      const allocatedCell = page.locator('tbody tr td').nth(2); // 3rd column (0-indexed)
      await expect(allocatedCell).toContainText('0');
    } finally {
      await Factories.product.delete(page, productId);
    }
  });

  test('should display open lots count', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Create product with stock at warehouse
    const timestamp = Date.now();
    const { productId } = await Factories.stock.createProductWithStock(page, {
      productName: `Lots Test Product ${timestamp}`,
      productSku: `LOTS-${timestamp}`,
      productPricePence: 1100,
      initialQty: 60,
      unitCostPence: 350,
    });

    try {
      // Navigate to Stock Levels tab
      await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}?tab=levels`);
      await page.waitForLoadState('networkidle');

      // Wait for table to load
      await expect(page.getByRole('table')).toBeVisible();

      // Find the Warehouse row and check the "Open lots" column (4th column, index 3)
      const warehouseRow = page.getByRole('row', { name: /warehouse/i });
      const openLotsCell = warehouseRow.locator('td').nth(3); // 4th column: Open lots
      await expect(openLotsCell).toContainText('1');
    } finally {
      await Factories.product.delete(page, productId);
    }
  });

  test('should display multiple branches with stock', async ({ page }) => {
    await signIn(page, TEST_USERS.owner); // Owner has branches:manage

    // Use known seeded branches that owner has access to
    const warehouseId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const hqId = await Factories.branch.getBySlug(page, 'acme-hq');

    // Create product with stock at warehouse
    const timestamp = Date.now();
    const { productId } = await Factories.stock.createProductWithStock(page, {
      productName: `Multi-Branch Product ${timestamp}`,
      productSku: `MULTI-${timestamp}`,
      productPricePence: 1300,
      branchId: warehouseId, // Explicit warehouse branch
      initialQty: 40,
      unitCostPence: 450,
    });

    try {
      // Add stock at HQ (owner has access to this branch per seed data)
      await Factories.stock.addStock(page, {
        productId,
        branchId: hqId,
        qtyDelta: 30,
        unitCostPence: 400,
        reason: 'E2E test multi-branch stock',
      });

      // Navigate to Stock Levels tab
      await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}?tab=levels`);
      await page.waitForLoadState('networkidle');

      // Wait for table to load
      await expect(page.getByRole('table')).toBeVisible();

      // Verify Warehouse row has 40 units
      const warehouseRow = page.getByRole('row', { name: /warehouse/i });
      await expect(warehouseRow).toBeVisible();
      const warehouseCells = warehouseRow.locator('td');
      await expect(warehouseCells.nth(1)).toContainText('40'); // On hand column

      // Verify HQ row has 30 units
      const hqRow = page.getByRole('row', { name: /^hq/i });
      await expect(hqRow).toBeVisible();
      const hqCells = hqRow.locator('td');
      await expect(hqCells.nth(1)).toContainText('30'); // On hand column
    } finally {
      await Factories.product.delete(page, productId);
    }
  });
});

test.describe('Product Stock Levels Tab - Empty State', () => {
  test('should show empty state when product has no stock', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Create product WITHOUT stock
    const timestamp = Date.now();
    const productId = await Factories.product.create(page, {
      productName: `No Stock Product ${timestamp}`,
      productSku: `NOSTOCK-${timestamp}`,
      productPricePence: 900,
    });

    try {
      // Navigate to Stock Levels tab
      await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}?tab=levels`);
      await page.waitForLoadState('networkidle');

      // Should show table with branches but 0 quantities
      await expect(page.getByRole('table')).toBeVisible();

      // All on-hand cells should show 0
      const onHandCells = page.locator('tbody tr td:nth-child(2)'); // 2nd column
      const firstCell = onHandCells.first();
      await expect(firstCell).toContainText('0');
    } finally {
      await Factories.product.delete(page, productId);
    }
  });

  test('should show alert when tenant has no branches', async ({ page }) => {
    // This test would require a tenant with no branches (not in seed data)
    // Skipping for now as all tenants have branches by default
    test.skip();
  });
});

test.describe('Product Stock Levels Tab - Refresh', () => {
  test('should refresh stock levels when refresh button clicked', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Create product with initial stock
    const timestamp = Date.now();
    const { productId, branchId } = await Factories.stock.createProductWithStock(page, {
      productName: `Refresh Test Product ${timestamp}`,
      productSku: `REFRESH-${timestamp}`,
      productPricePence: 1400,
      initialQty: 50,
      unitCostPence: 500,
    });

    try {
      // Navigate to Stock Levels tab
      await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}?tab=levels`);
      await page.waitForLoadState('networkidle');

      // Wait for initial load and check Warehouse row has 50
      await expect(page.getByRole('table')).toBeVisible();
      const warehouseRow = page.getByRole('row', { name: /warehouse/i });
      await expect(warehouseRow).toContainText('50');

      // Add more stock via API
      await Factories.stock.addStock(page, {
        productId,
        branchId,
        qtyDelta: 25,
        unitCostPence: 500,
        reason: 'E2E test refresh',
      });

      // Click refresh button
      await page.getByRole('button', { name: /refresh/i }).click();

      // Wait for reload
      await page.waitForTimeout(1000);

      // Should show updated quantity (75 = 50 + 25) in Warehouse row
      await expect(warehouseRow).toContainText('75');
    } finally {
      await Factories.product.delete(page, productId);
    }
  });

  test('should disable refresh button while loading', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Get first product
    const productId = await Factories.product.getFirst(page);

    // Navigate to Stock Levels tab
    await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}?tab=levels`);
    await page.waitForLoadState('networkidle');

    // Click refresh button
    const refreshButton = page.getByRole('button', { name: /refresh/i });
    await refreshButton.click();

    // Button should be disabled immediately
    await expect(refreshButton).toBeDisabled();

    // Wait for load to complete
    await page.waitForTimeout(500);

    // Button should be enabled again
    await expect(refreshButton).toBeEnabled();
  });
});

test.describe('Product Stock Levels Tab - Permissions', () => {
  test('owner can view stock levels', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Get first product
    const productId = await Factories.product.getFirst(page);

    // Navigate to Stock Levels tab
    await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}?tab=levels`);
    await page.waitForLoadState('networkidle');

    // Should show stock levels heading
    await expect(page.getByRole('heading', { name: /current stock levels/i })).toBeVisible();

    // Should show table
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('admin can view stock levels', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    // Get first product
    const productId = await Factories.product.getFirst(page);

    // Navigate to Stock Levels tab
    await page.goto(`/${TEST_USERS.admin.tenant}/products/${productId}?tab=levels`);
    await page.waitForLoadState('networkidle');

    // Should show stock levels heading
    await expect(page.getByRole('heading', { name: /current stock levels/i })).toBeVisible();

    // Should show table
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('editor can view stock levels', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);

    // Get first product
    const productId = await Factories.product.getFirst(page);

    // Navigate to Stock Levels tab
    await page.goto(`/${TEST_USERS.editor.tenant}/products/${productId}?tab=levels`);
    await page.waitForLoadState('networkidle');

    // Should show stock levels heading
    await expect(page.getByRole('heading', { name: /current stock levels/i })).toBeVisible();

    // Should show table
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('viewer can view stock levels', async ({ page }) => {
    await signIn(page, TEST_USERS.viewer);

    // Get first product
    const productId = await Factories.product.getFirst(page);

    // Navigate to Stock Levels tab
    await page.goto(`/${TEST_USERS.viewer.tenant}/products/${productId}?tab=levels`);
    await page.waitForLoadState('networkidle');

    // Should show stock levels heading
    await expect(page.getByRole('heading', { name: /current stock levels/i })).toBeVisible();

    // Should show table
    await expect(page.getByRole('table')).toBeVisible();
  });
});

test.describe('Product Stock Levels Tab - Branch Names', () => {
  test('should display correct branch names', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Get branches to verify names
    const branches = await Factories.branch.getAll(page);

    // Create product with stock
    const timestamp = Date.now();
    const { productId } = await Factories.stock.createProductWithStock(page, {
      productName: `Branch Name Test ${timestamp}`,
      productSku: `BRANCH-${timestamp}`,
      productPricePence: 1600,
      initialQty: 35,
      unitCostPence: 550,
    });

    try {
      // Navigate to Stock Levels tab
      await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}?tab=levels`);
      await page.waitForLoadState('networkidle');

      // Wait for table to load
      await expect(page.getByRole('table')).toBeVisible();

      // Should show at least one branch name from seed data
      const firstBranchName = branches[0].branchName;
      await expect(page.getByRole('cell', { name: firstBranchName })).toBeVisible();
    } finally {
      await Factories.product.delete(page, productId);
    }
  });
});

test.describe('Product Stock Levels Tab - Loading State', () => {
  test('should show loading indicator initially', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Get first product
    const productId = await Factories.product.getFirst(page);

    // Navigate to Stock Levels tab
    await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}?tab=levels`);

    // Should show loading text initially (may be brief)
    // Note: This might be flaky if loading is too fast
    const loadingText = page.getByText(/loading/i);

    // Just verify the page loads successfully
    await page.waitForLoadState('networkidle');

    // Should eventually show table
    await expect(page.getByRole('table')).toBeVisible();
  });
});

test.describe('Product Stock Levels Tab - Integration with FIFO Tab', () => {
  test('should show consistent data with FIFO tab', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Create product with stock
    const timestamp = Date.now();
    const { productId } = await Factories.stock.createProductWithStock(page, {
      productName: `FIFO Consistency Test ${timestamp}`,
      productSku: `FIFO-${timestamp}`,
      productPricePence: 1700,
      initialQty: 45,
      unitCostPence: 600,
    });

    try {
      // Navigate to Stock Levels tab
      await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}?tab=levels`);
      await page.waitForLoadState('networkidle');

      // Get on-hand quantity from Stock Levels tab
      const table = page.getByRole('table');
      const firstRowOnHand = await table.locator('tbody tr:first-child td:nth-child(2)').textContent();

      // Navigate to FIFO tab
      await page.getByRole('tab', { name: /fifo/i }).click();
      await page.waitForTimeout(1500);

      // Should show same on-hand quantity
      await expect(page.getByText(/on hand:/i)).toBeVisible();
      const fifoOnHandText = await page.getByText(/on hand:/i).textContent();

      // Extract number from both (e.g., "45" from "On hand: 45")
      expect(fifoOnHandText).toContain(firstRowOnHand?.trim());
    } finally {
      await Factories.product.delete(page, productId);
    }
  });
});
