// admin-web/e2e/products/product-archive.spec.ts
import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS, Factories, SELECTORS } from '../../helpers';

/**
 * Product Archive & Restore Tests (Refactored)
 *
 * Tests cover:
 * - Archive product from detail page
 * - Restore archived product
 * - Filter archived products
 * - Permission-based archive/restore visibility
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

test.describe('Product Archive Functionality', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('should archive a product from detail page', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    let productId: string | undefined;

    try {
      // Create a test product
      productId = await Factories.product.create(page, {
        productName: 'Test Archive Product',
        productSku: `ARCHIVE-${Date.now()}`,
        productPricePence: 1000,
      });


      // Navigate to product detail page
      await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}`);
      await page.waitForLoadState('networkidle');

      // Wait for page to load
      await expect(page.getByRole('heading', { name: /edit product/i })).toBeVisible();

      // Click the archive button
      const archiveButton = page.getByTestId(SELECTORS.PRODUCT.ARCHIVE_BUTTON);
      await expect(archiveButton).toBeVisible();
      await archiveButton.click();

      // Confirmation modal should appear
      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible();
      await expect(modal.getByText(/archive product\?/i)).toBeVisible();
      await expect(modal.getByText(/hidden from your active product list/i)).toBeVisible();

      // Confirm the archive
      const confirmButton = modal.getByRole('button', { name: /^archive$/i });
      await confirmButton.click();

      // Should show success notification
      await expect(page.getByRole('alert')).toContainText(/product archived/i);

      // Modal should close
      await expect(modal).not.toBeVisible();

      // Archived badge should appear
      await expect(page.getByTestId(SELECTORS.PRODUCT.ARCHIVED_BADGE)).toBeVisible();
      await expect(page.getByTestId(SELECTORS.PRODUCT.ARCHIVED_BADGE)).toHaveText('Archived');

      // Archive button should be replaced with Restore button
      await expect(page.getByTestId(SELECTORS.PRODUCT.ARCHIVE_BUTTON)).not.toBeVisible();
      await expect(page.getByTestId(SELECTORS.PRODUCT.RESTORE_BUTTON)).toBeVisible();
    } finally {
      // Cleanup
      if (productId) {
        await Factories.product.delete(page, productId);
      }
    }
  });

  test('should cancel archive confirmation', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    let productId: string | undefined;

    try {
      // Create a test product
      productId = await Factories.product.create(page, {
        productName: 'Test Cancel Archive',
        productSku: `CANCEL-${Date.now()}`,
        productPricePence: 1500,
      });

      // Navigate to product detail page
      await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: /edit product/i })).toBeVisible();

      // Click the archive button
      await page.getByTestId(SELECTORS.PRODUCT.ARCHIVE_BUTTON).click();

      // Modal should appear
      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible();

      // Click Cancel
      const cancelButton = modal.getByRole('button', { name: /cancel/i });
      await cancelButton.click();

      // Modal should close
      await expect(modal).not.toBeVisible();

      // Product should still be active (no archived badge)
      await expect(page.getByTestId(SELECTORS.PRODUCT.ARCHIVED_BADGE)).not.toBeVisible();

      // Archive button should still be visible
      await expect(page.getByTestId(SELECTORS.PRODUCT.ARCHIVE_BUTTON)).toBeVisible();
    } finally {
      if (productId) {
        await Factories.product.delete(page, productId);
      }
    }
  });

  test('should restore an archived product', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    let productId: string | undefined;

    try {
      // Create a product
      productId = await Factories.product.create(page, {
        productName: 'Test Restore Product',
        productSku: `RESTORE-${Date.now()}`,
        productPricePence: 2000,
      });

      // Archive it
      await Factories.product.archive(page, productId);

      // Navigate to archived product
      await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: /edit product/i })).toBeVisible();

      // Archived badge should be visible
      await expect(page.getByTestId(SELECTORS.PRODUCT.ARCHIVED_BADGE)).toBeVisible();

      // Click Restore button
      const restoreButton = page.getByTestId(SELECTORS.PRODUCT.RESTORE_BUTTON);
      await expect(restoreButton).toBeVisible();
      await restoreButton.click();

      // Should show success notification
      await expect(page.getByRole('alert')).toContainText(/product restored/i);

      // Archived badge should disappear
      await expect(page.getByTestId(SELECTORS.PRODUCT.ARCHIVED_BADGE)).not.toBeVisible();

      // Restore button should be replaced with Archive button
      await expect(page.getByTestId(SELECTORS.PRODUCT.RESTORE_BUTTON)).not.toBeVisible();
      await expect(page.getByTestId(SELECTORS.PRODUCT.ARCHIVE_BUTTON)).toBeVisible();
    } finally {
      if (productId) {
        await Factories.product.delete(page, productId);
      }
    }
  });

  test('should filter to show only archived products', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const productIds: string[] = [];

    try {
      // Create two products
      const activeId = await Factories.product.create(page, {
        productName: 'Active Product',
        productSku: `ACTIVE-${Date.now()}`,
        productPricePence: 1000,
      });
      productIds.push(activeId);

      const archivedId = await Factories.product.create(page, {
        productName: 'Archived Product',
        productSku: `ARCHIVED-${Date.now()}`,
        productPricePence: 2000,
      });
      productIds.push(archivedId);

      // Archive the second product
      await Factories.product.archive(page, archivedId);

      // Go to products page
      await page.goto(`/${TEST_USERS.owner.tenant}/products`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: /all products/i }).first()).toBeVisible();

      // By default, should show only active products (wait for table to stabilize)
      await page.waitForSelector('table tbody tr');

      // Verify default filter is active (no-archived is the default)
      // Check that NO archived badges are visible in the table
      const archivedBadges = await page.getByTestId(SELECTORS.PRODUCT.ARCHIVED_BADGE).count();
      expect(archivedBadges).toBe(0);

      // Open filters
      await page.getByRole('button', { name: /^filters$/i }).click();

      // Select "Archived products only"
      const archivedFilter = page.getByTestId('archived-filter-select');
      await archivedFilter.click();
      await page.getByRole('option', { name: /archived products only/i }).click();

      // Apply filters
      await page.getByRole('button', { name: /apply filters/i }).click();

      // Wait for table to update
      await page.waitForSelector('table tbody tr');

      // Should now show only archived products (check for archived badges)
      const archivedBadgesAfterFilter = await page.getByTestId(SELECTORS.PRODUCT.ARCHIVED_BADGE).count();
      expect(archivedBadgesAfterFilter).toBeGreaterThan(0);

      // All visible rows should have an archived badge
      const rowCount = await page.locator('table tbody tr').count();
      expect(archivedBadgesAfterFilter).toBe(rowCount);
    } finally {
      for (const id of productIds) {
        await Factories.product.delete(page, id);
      }
    }
  });

  test('should filter to show all products (active + archived)', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const productIds: string[] = [];

    try {
      // Create two products
      const activeId = await Factories.product.create(page, {
        productName: 'Active Both',
        productSku: `ACTIVE-BOTH-${Date.now()}`,
        productPricePence: 1000,
      });
      productIds.push(activeId);

      const archivedId = await Factories.product.create(page, {
        productName: 'Archived Both',
        productSku: `ARCHIVED-BOTH-${Date.now()}`,
        productPricePence: 2000,
      });
      productIds.push(archivedId);

      // Archive the second product
      await Factories.product.archive(page, archivedId);

      // Go to products page
      await page.goto(`/${TEST_USERS.owner.tenant}/products`);

      // Open filters
      await page.getByRole('button', { name: /^filters$/i }).click();

      // Select "All products (active + archived)"
      const archivedFilter = page.getByTestId('archived-filter-select');
      await archivedFilter.click();
      await page.getByRole('option', { name: /all products \(active \+ archived\)/i }).click();

      // Apply filters
      await page.getByRole('button', { name: /apply filters/i }).click();

      // Wait for table to update
      await page.waitForSelector('table tbody tr');

      // Should show both products
      await expect(page.getByRole('cell', { name: 'Active Both' }).first()).toBeVisible();
      await expect(page.getByRole('cell', { name: 'Archived Both' }).first()).toBeVisible();

      // Archived badge should be visible on the archived product
      const archivedBadge = page.getByTestId(SELECTORS.PRODUCT.ARCHIVED_BADGE).first();
      await expect(archivedBadge).toBeVisible();
    } finally {
      for (const id of productIds) {
        await Factories.product.delete(page, id);
      }
    }
  });

  test('should show archived products on direct URL access', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    let productId: string | undefined;

    try {
      // Create and archive a product
      productId = await Factories.product.create(page, {
        productName: 'Direct Access Archived',
        productSku: `DIRECT-${Date.now()}`,
        productPricePence: 3000,
      });

      await Factories.product.archive(page, productId);

      // Navigate directly to archived product URL
      await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}`);
      await page.waitForLoadState('networkidle');

      // Should load the product page
      await expect(page.getByRole('heading', { name: /edit product/i })).toBeVisible();

      // Should show archived badge
      await expect(page.getByTestId(SELECTORS.PRODUCT.ARCHIVED_BADGE)).toBeVisible();

      // Should show restore button
      await expect(page.getByTestId(SELECTORS.PRODUCT.RESTORE_BUTTON)).toBeVisible();
    } finally {
      if (productId) {
        await Factories.product.delete(page, productId);
      }
    }
  });

  test('VIEWER should not see archive or restore buttons', async ({ page }) => {
    await signIn(page, TEST_USERS.viewer);

    let productId: string | undefined;

    try {
      // Switch to OWNER to create and archive a product
      await page.context().clearCookies();
      await signIn(page, TEST_USERS.owner);

      productId = await Factories.product.create(page, {
        productName: 'Viewer Test Product',
        productSku: `VIEWER-${Date.now()}`,
        productPricePence: 1500,
      });

      // Sign back in as VIEWER
      await page.context().clearCookies();
      await signIn(page, TEST_USERS.viewer);

      // Navigate to product detail page
      await page.goto(`/${TEST_USERS.viewer.tenant}/products/${productId}`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: /edit product/i })).toBeVisible();

      // Archive button should not be visible (viewer lacks products:write)
      await expect(page.getByTestId(SELECTORS.PRODUCT.ARCHIVE_BUTTON)).not.toBeVisible();

      // Now archive it as OWNER
      await page.context().clearCookies();
      await signIn(page, TEST_USERS.owner);

      await Factories.product.archive(page, productId);

      // Sign back in as VIEWER
      await page.context().clearCookies();
      await signIn(page, TEST_USERS.viewer);

      // Navigate to archived product
      await page.goto(`/${TEST_USERS.viewer.tenant}/products/${productId}`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: /edit product/i })).toBeVisible();

      // Should see archived badge
      await expect(page.getByTestId(SELECTORS.PRODUCT.ARCHIVED_BADGE)).toBeVisible();

      // Restore button should not be visible
      await expect(page.getByTestId(SELECTORS.PRODUCT.RESTORE_BUTTON)).not.toBeVisible();
    } finally {
      if (productId) {
        // Cleanup as OWNER
        await page.context().clearCookies();
        await signIn(page, TEST_USERS.owner);
        await Factories.product.delete(page, productId);
      }
    }
  });

  test('should clear archived filter when clicking "Clear" button', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Go to products page
    await page.goto(`/${TEST_USERS.owner.tenant}/products`);

    // Open filters
    await page.getByRole('button', { name: /^filters$/i }).click();

    // Select "Archived products only"
    const archivedFilter = page.getByTestId('archived-filter-select');
    await archivedFilter.click();
    await page.getByRole('option', { name: /archived products only/i }).click();

    // Apply filters
    await page.getByRole('button', { name: /apply filters/i }).click();

    // URL should contain archivedFilter parameter
    await expect(page).toHaveURL(/archivedFilter=only-archived/);


    // Click Clear button (this should reset and apply filters automatically)
    const filterPanel = page.locator('[id="products-filter-panel"]');
    const clearButton = filterPanel.getByRole('button', { name: /^clear$/i });
    await clearButton.click();

    // URL should reset to default (no-archived)
    await expect(page).toHaveURL(/archivedFilter=no-archived/);
  });
});
