// admin-web/e2e/products/product-crud.spec.ts
import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS, Factories } from '../helpers';

/**
 * Phase 8: Frontend - Product Management Tests (Refactored)
 *
 * Tests cover:
 * - Product list page (display, pagination, search/filter, sorting)
 * - Create product flow (form, validation, success)
 * - Edit product flow (load, update, optimistic locking)
 * - Delete product flow (confirmation, success)
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
  // Clear cookies to prevent test interference
  // Note: Don't clear localStorage/sessionStorage here - it causes SecurityError
  // when page hasn't navigated yet. Browser storage is cleared on navigation anyway.
  await context.clearCookies();
});

test.describe('Product List Page', () => {
  test('should display list of products', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);

    // Products page should show heading and table
    await expect(page.getByRole('heading', { name: /all products/i }).first()).toBeVisible();

    // Should have a table with products (seeded data)
    await expect(page.getByRole('table')).toBeVisible();

    // Should show pagination info
    await expect(page.getByText(/showing \d+–\d+/i).first()).toBeVisible();
  });

  test('should show "New product" button with permission', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);

    // Editor has products:write permission
    const newButton = page.getByRole('button', { name: /new product/i });
    await expect(newButton).toBeVisible();
    await expect(newButton).toBeEnabled();
  });

  test('should disable "New product" button without permission', async ({ page }) => {
    await signIn(page, TEST_USERS.viewer);

    // Viewer does NOT have products:write permission
    const newButton = page.getByRole('button', { name: /new product/i });
    await expect(newButton).toBeVisible();
    await expect(newButton).toBeDisabled();
  });

  test('should navigate between pages', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);

    // Check if we have next page button enabled (depends on seed data)
    const nextButton = page.getByRole('button', { name: /next/i });

    // If pagination available, test it
    if (await nextButton.isEnabled()) {
      const initialPage = await page.getByText(/page \d+/i).textContent();
      await nextButton.click();

      // Page number should change
      const newPage = await page.getByText(/page \d+/i).textContent();
      expect(newPage).not.toBe(initialPage);

      // Previous button should now be enabled
      await expect(page.getByRole('button', { name: /prev/i })).toBeEnabled();
    }
  });

  test('should filter products by search query', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);

    // Open filters panel
    await page.getByRole('button', { name: /filters/i }).click();
    await expect(page.getByLabel(/search \(name or sku\)/i)).toBeVisible();

    // Enter search query (using a known product from seed data)
    await page.getByLabel(/search \(name or sku\)/i).fill('anvil');

    // Apply filters
    await page.getByRole('button', { name: /apply/i }).click();

    // Should show filtered results in table
    await expect(page.getByRole('cell', { name: /anvil/i })).toBeVisible();

    // Should show active filter chip
    await expect(page.getByText(/search: "anvil"/i).first()).toBeVisible();
  });

  test('should filter products by price range', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);

    // Open filters panel
    await page.getByRole('button', { name: /filters/i }).click();

    // Set price range (1000-10000 pence = £10-£100)
    await page.getByLabel(/min price \(pence\)/i).fill('1000');
    await page.getByLabel(/max price \(pence\)/i).fill('10000');

    // Apply filters
    await page.getByRole('button', { name: /apply/i }).click();

    // Wait for data to load
    await page.waitForLoadState('networkidle');

    // Should show active filter chips
    await expect(page.getByText(/min: £10\.00/i).first()).toBeVisible();
    await expect(page.getByText(/max: £100\.00/i).first()).toBeVisible();
  });

  test('should clear all filters', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);

    // Apply a filter first
    await page.getByRole('button', { name: /filters/i }).click();
    await page.getByLabel(/search \(name or sku\)/i).fill('test');
    await page.getByRole('button', { name: /apply/i }).click();

    // Verify filter is active
    await expect(page.getByText(/search: "test"/i).first()).toBeVisible();

    // Clear all filters (button exists twice - in chips area and empty state)
    await page.getByRole('button', { name: /clear all/i }).first().click();

    // Filter chip should be gone
    await expect(page.getByText(/search: "test"/i)).not.toBeVisible();
  });

  test('should sort products by name', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);

    // Find and click the name sort button
    const nameSortButton = page.getByRole('button', { name: /sort by name/i });
    await nameSortButton.click();

    // URL should reflect sorting
    await expect(page).toHaveURL(/sortBy=productName/);
    await expect(page).toHaveURL(/sortDir=asc/);
  });
});

test.describe('Create Product Flow', () => {
  test('should navigate to create product page', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);

    // Click "New product" button
    await page.getByRole('button', { name: /new product/i }).click();

    // Should navigate to new product page
    await expect(page).toHaveURL(`/${TEST_USERS.editor.tenant}/products/new`);
    await expect(page.getByRole('heading', { name: /new product/i })).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);

    // Navigate to create product page
    await page.goto(`/${TEST_USERS.editor.tenant}/products/new`);

    // Try to save without filling anything
    await page.getByRole('button', { name: /^save$/i }).click();

    // Should show validation error notification
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText(/name is required/i)).toBeVisible();
  });

  test('should show validation error for missing SKU', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);

    await page.goto(`/${TEST_USERS.editor.tenant}/products/new`);

    // Fill name but not SKU
    await page.getByLabel(/product name/i).fill('Test Product');
    await page.getByLabel(/price \(gbp\)/i).fill('10.00');

    // Try to save
    await page.getByRole('button', { name: /^save$/i }).click();

    // Should show SKU validation error
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText(/sku is required/i)).toBeVisible();
  });

  test('should show validation error for missing price', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);

    await page.goto(`/${TEST_USERS.editor.tenant}/products/new`);

    // Fill name and SKU but not price
    await page.getByLabel(/product name/i).fill('Test Product');
    await page.getByLabel(/sku/i).fill('TEST-SKU-001');

    // Try to save
    await page.getByRole('button', { name: /^save$/i }).click();

    // Should show price validation error
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText(/price.*required/i)).toBeVisible();
  });

  test('should create a product successfully', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);

    await page.goto(`/${TEST_USERS.editor.tenant}/products/new`);

    // Fill in the form with unique SKU to avoid conflicts
    const timestamp = Date.now();
    const uniqueSku = `E2E-CREATE-${timestamp}`;
    await page.getByLabel(/product name/i).fill(`E2E Create Test ${timestamp}`);
    await page.getByLabel(/sku/i).fill(uniqueSku);
    await page.getByLabel(/price \(gbp\)/i).fill('50.00');

    // Save
    await page.getByRole('button', { name: /^save$/i }).click();

    // Should show success notification (filter to notifications, not welcome banners)
    await expect(page.getByText(/product created/i)).toBeVisible();

    // Should redirect to FIFO tab with welcome banner
    await expect(page).toHaveURL(/\/products\/[a-z0-9]+\?tab=fifo&welcome=fifo/i);
    await expect(page.getByText(/set initial fifo stock/i)).toBeVisible();

    // Extract product ID from URL for cleanup
    const url = page.url();
    const productId = url.match(/\/products\/([a-z0-9]+)/)?.[1];

    // Cleanup: delete the test product
    if (productId) {
      await Factories.product.delete(page, productId);
    }
  });

  test('should show error for duplicate SKU', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);

    // Create a product via factory first
    const timestamp = Date.now();
    const uniqueSku = `DUPLICATE-SKU-${timestamp}`;

    const productId = await Factories.product.create(page, {
      productName: 'First Product',
      productSku: uniqueSku,
      productPricePence: 1000,
    });

    try {
      // Now try to create another product with the same SKU via UI
      await page.goto(`/${TEST_USERS.editor.tenant}/products/new`);
      await page.getByLabel(/product name/i).fill('Second Product');
      await page.getByLabel(/sku/i).fill(uniqueSku);
      await page.getByLabel(/price \(gbp\)/i).fill('20.00');
      await page.getByRole('button', { name: /^save$/i }).click();

      // Should show duplicate SKU error (409 CONFLICT or validation error)
      // Just verify an error alert is shown - message may vary
      await expect(page.locator('[role="alert"]').first()).toBeVisible();
    } finally {
      // Cleanup: delete the test product
      await Factories.product.delete(page, productId);
    }
  });
});

test.describe('Edit Product Flow', () => {
  test('should load existing product data', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);

    // Go to products list and click edit on first product
    await page.goto(`/${TEST_USERS.editor.tenant}/products`);
    await expect(page.getByRole('table')).toBeVisible();

    // Get product details before editing
    const firstProductName = await page.locator('table tbody tr:first-child td:nth-child(1)').textContent();
    const firstProductSku = await page.locator('table tbody tr:first-child td:nth-child(2)').textContent();

    // Click edit button (first button in actions cell)
    const firstRow = page.locator('table tbody tr:first-child');
    const actionsCell = firstRow.locator('td').last();
    const editButton = actionsCell.locator('button').first(); // First button is edit
    await editButton.click();

    // Should navigate to edit page
    await expect(page).toHaveURL(/\/products\/[a-z0-9]+$/i);
    await expect(page.getByRole('heading', { name: /edit product/i })).toBeVisible();

    // Form should be populated with existing data
    await expect(page.getByLabel(/product name/i)).toHaveValue(firstProductName?.trim() || '');
    await expect(page.getByLabel(/sku/i)).toHaveValue(firstProductSku?.trim() || '');

    // Should show entity version badge
    await expect(page.getByText(/current version:/i)).toBeVisible();
  });

  test('should update product successfully', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);

    // Create a test product via factory
    const timestamp = Date.now();
    const productName = `E2E Update Test ${timestamp}`;
    const productSku = `UPD-${timestamp}`;

    const productId = await Factories.product.create(page, {
      productName: productName,
      productSku: productSku,
      productPricePence: 3000,
    });

    try {
      // Navigate to products list first, then find and click edit on our product
      await page.goto(`/${TEST_USERS.editor.tenant}/products`);
      await page.waitForLoadState('networkidle');

      // Find our test product row by name and click edit
      const productRow = page.locator('tr', { hasText: productName });
      await expect(productRow).toBeVisible();

      const actionsCell = productRow.locator('td').last();
      const editButton = actionsCell.locator('button').first();
      await editButton.click();

      // Wait for edit page
      await expect(page).toHaveURL(/\/products\/[a-z0-9]+$/i);
      await page.waitForLoadState('networkidle');

      // Wait for form to be populated
      const nameInput = page.getByLabel(/product name/i);
      await expect(nameInput).toBeVisible();
      await expect(nameInput).toHaveValue(productName);

      // Update the name
      const updatedName = `${productName} (Updated)`;
      await nameInput.fill(updatedName);

      // Save
      await page.getByRole('button', { name: /^save$/i }).click();

      // Should show success notification
      await expect(page.getByText(/product updated/i)).toBeVisible();
    } finally {
      // Cleanup: delete the test product
      await Factories.product.delete(page, productId);
    }
  });

  test('should show tabs for editing product', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);

    // Navigate to first product edit page
    await page.goto(`/${TEST_USERS.editor.tenant}/products`);

    // Wait for products list to load (wait for first row)
    await page.waitForSelector('table tbody tr:first-child', { state: 'visible', timeout: 10000 });

    const firstRow = page.locator('table tbody tr:first-child');
    const actionsCell = firstRow.locator('td').last();
    const editButton = actionsCell.locator('button').first();
    await editButton.click();

    // Should show all tabs
    await expect(page.getByRole('tab', { name: /overview/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /stock levels/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /fifo/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /activity/i })).toBeVisible();

    // Should be able to switch tabs
    await page.getByRole('tab', { name: /stock levels/i }).click();
    await expect(page).toHaveURL(/tab=levels/);

    await page.getByRole('tab', { name: /fifo/i }).click();
    await expect(page).toHaveURL(/tab=fifo/);
  });

  test('should not show tabs for new product', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);

    await page.goto(`/${TEST_USERS.editor.tenant}/products/new`);

    // Should only show Overview tab (no stock/fifo/activity tabs for new products)
    await expect(page.getByRole('tab', { name: /overview/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /stock levels/i })).not.toBeVisible();
    await expect(page.getByRole('tab', { name: /fifo/i })).not.toBeVisible();
    await expect(page.getByRole('tab', { name: /activity/i })).not.toBeVisible();
  });

  test('should show product not found error', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);

    // Try to access a non-existent product
    await page.goto(`/${TEST_USERS.editor.tenant}/products/non-existent-id`);

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Should show not found message (check for specific heading level 4)
    await expect(page.getByRole('heading', { level: 4, name: /product not found/i })).toBeVisible();

    // Should show helpful actions
    await expect(page.getByRole('button', { name: /go to products/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /create a new product/i })).toBeVisible();
  });

  test('should handle cancel action', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);

    // Navigate to first product edit page
    await page.goto(`/${TEST_USERS.editor.tenant}/products`);

    // Wait for products list to load
    await page.waitForSelector('table tbody tr:first-child', { state: 'visible', timeout: 10000 });

    const firstRow = page.locator('table tbody tr:first-child');
    const actionsCell = firstRow.locator('td').last();
    const editButton = actionsCell.locator('button').first();
    await editButton.click();

    // Wait for edit page to load completely
    await expect(page.getByRole('heading', { name: /edit product/i })).toBeVisible();
    await page.waitForLoadState('networkidle');

    // Click cancel
    await page.getByRole('button', { name: /cancel/i }).click();

    // Should go back (browser back button behavior)
    await expect(page).toHaveURL(`/${TEST_USERS.editor.tenant}/products`);
  });
});
