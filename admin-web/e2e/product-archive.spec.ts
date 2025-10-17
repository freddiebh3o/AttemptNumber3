// admin-web/e2e/product-archive.spec.ts
import { test, expect, type Page } from '@playwright/test';

const TEST_USERS = {
  owner: { email: 'owner@acme.test', password: 'Password123!', tenant: 'acme' },
  viewer: { email: 'viewer@acme.test', password: 'Password123!', tenant: 'acme' },
};

async function signIn(page: Page, user: typeof TEST_USERS.owner) {
  await page.goto('/');
  await page.getByLabel(/email address/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByLabel(/tenant/i).fill(user.tenant);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(`/${user.tenant}/products`);
}

async function createProductViaAPI(page: Page, params: {
  productName: string;
  productSku: string;
  productPricePence: number;
}): Promise<string> {
  const apiUrl = process.env.VITE_API_BASE_URL || 'http://localhost:4000';

  // Get cookies from page context for authentication
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

  const response = await page.request.post(`${apiUrl}/api/products`, {
    data: params,
    headers: {
      'Cookie': cookieHeader,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok()) {
    const errorText = await response.text();
    throw new Error(`Failed to create product: ${response.status()} - ${errorText}`);
  }

  const data = await response.json();
  return data.data.product.id;
}

async function deleteProductViaAPI(page: Page, productId: string): Promise<void> {
  const apiUrl = process.env.VITE_API_BASE_URL || 'http://localhost:4000';

  // Get cookies from page context for authentication
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

  await page.request.delete(`${apiUrl}/api/products/${productId}`, {
    headers: {
      'Cookie': cookieHeader,
    },
  });
}

test.describe('Product Archive Functionality', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('should archive a product from detail page', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    let productId: string | undefined;

    try {
      // Create a test product
      productId = await createProductViaAPI(page, {
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
      const archiveButton = page.getByTestId('archive-product-btn');
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
      await expect(page.getByTestId('archived-badge')).toBeVisible();
      await expect(page.getByTestId('archived-badge')).toHaveText('Archived');

      // Archive button should be replaced with Restore button
      await expect(page.getByTestId('archive-product-btn')).not.toBeVisible();
      await expect(page.getByTestId('restore-btn')).toBeVisible();
    } finally {
      // Cleanup
      if (productId) {
        await deleteProductViaAPI(page, productId);
      }
    }
  });

  test('should cancel archive confirmation', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    let productId: string | undefined;

    try {
      // Create a test product
      productId = await createProductViaAPI(page, {
        productName: 'Test Cancel Archive',
        productSku: `CANCEL-${Date.now()}`,
        productPricePence: 1500,
      });

      // Navigate to product detail page
      await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: /edit product/i })).toBeVisible();

      // Click the archive button
      await page.getByTestId('archive-product-btn').click();

      // Modal should appear
      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible();

      // Click Cancel
      const cancelButton = modal.getByRole('button', { name: /cancel/i });
      await cancelButton.click();

      // Modal should close
      await expect(modal).not.toBeVisible();

      // Product should still be active (no archived badge)
      await expect(page.getByTestId('archived-badge')).not.toBeVisible();

      // Archive button should still be visible
      await expect(page.getByTestId('archive-product-btn')).toBeVisible();
    } finally {
      if (productId) {
        await deleteProductViaAPI(page, productId);
      }
    }
  });

  test('should restore an archived product', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    let productId: string | undefined;

    try {
      // Create and archive a product
      productId = await createProductViaAPI(page, {
        productName: 'Test Restore Product',
        productSku: `RESTORE-${Date.now()}`,
        productPricePence: 2000,
      });

      // Archive it via API
      await deleteProductViaAPI(page, productId);

      // Navigate to archived product
      await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: /edit product/i })).toBeVisible();

      // Archived badge should be visible
      await expect(page.getByTestId('archived-badge')).toBeVisible();

      // Click Restore button
      const restoreButton = page.getByTestId('restore-btn');
      await expect(restoreButton).toBeVisible();
      await restoreButton.click();

      // Should show success notification
      await expect(page.getByRole('alert')).toContainText(/product restored/i);

      // Archived badge should disappear
      await expect(page.getByTestId('archived-badge')).not.toBeVisible();

      // Restore button should be replaced with Archive button
      await expect(page.getByTestId('restore-btn')).not.toBeVisible();
      await expect(page.getByTestId('archive-product-btn')).toBeVisible();
    } finally {
      if (productId) {
        await deleteProductViaAPI(page, productId);
      }
    }
  });

  test('should filter to show only archived products', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const productIds: string[] = [];

    try {
      // Create two products
      const activeId = await createProductViaAPI(page, {
        productName: 'Active Product',
        productSku: `ACTIVE-${Date.now()}`,
        productPricePence: 1000,
      });
      productIds.push(activeId);

      const archivedId = await createProductViaAPI(page, {
        productName: 'Archived Product',
        productSku: `ARCHIVED-${Date.now()}`,
        productPricePence: 2000,
      });
      productIds.push(archivedId);

      // Archive the second product
      await deleteProductViaAPI(page, archivedId);

      // Go to products page
      await page.goto(`/${TEST_USERS.owner.tenant}/products`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: /all products/i }).first()).toBeVisible();

      // By default, should show only active products (wait for table to stabilize)
      await page.waitForSelector('table tbody tr');

      // Verify default filter is active (no-archived is the default)
      // Check that NO archived badges are visible in the table
      const archivedBadges = await page.getByTestId('archived-badge').count();
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
      const archivedBadgesAfterFilter = await page.getByTestId('archived-badge').count();
      expect(archivedBadgesAfterFilter).toBeGreaterThan(0);

      // All visible rows should have an archived badge
      const rowCount = await page.locator('table tbody tr').count();
      expect(archivedBadgesAfterFilter).toBe(rowCount);
    } finally {
      for (const id of productIds) {
        await deleteProductViaAPI(page, id);
      }
    }
  });

  test('should filter to show all products (active + archived)', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const productIds: string[] = [];

    try {
      // Create two products
      const activeId = await createProductViaAPI(page, {
        productName: 'Active Both',
        productSku: `ACTIVE-BOTH-${Date.now()}`,
        productPricePence: 1000,
      });
      productIds.push(activeId);

      const archivedId = await createProductViaAPI(page, {
        productName: 'Archived Both',
        productSku: `ARCHIVED-BOTH-${Date.now()}`,
        productPricePence: 2000,
      });
      productIds.push(archivedId);

      // Archive the second product
      await deleteProductViaAPI(page, archivedId);

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
      const archivedBadge = page.getByTestId('archived-badge').first();
      await expect(archivedBadge).toBeVisible();
    } finally {
      for (const id of productIds) {
        await deleteProductViaAPI(page, id);
      }
    }
  });

  test('should show archived products on direct URL access', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    let productId: string | undefined;

    try {
      // Create and archive a product
      productId = await createProductViaAPI(page, {
        productName: 'Direct Access Archived',
        productSku: `DIRECT-${Date.now()}`,
        productPricePence: 3000,
      });

      await deleteProductViaAPI(page, productId);

      // Navigate directly to archived product URL
      await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}`);
      await page.waitForLoadState('networkidle');

      // Should load the product page
      await expect(page.getByRole('heading', { name: /edit product/i })).toBeVisible();

      // Should show archived badge
      await expect(page.getByTestId('archived-badge')).toBeVisible();

      // Should show restore button
      await expect(page.getByTestId('restore-btn')).toBeVisible();
    } finally {
      if (productId) {
        await deleteProductViaAPI(page, productId);
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

      productId = await createProductViaAPI(page, {
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
      await expect(page.getByTestId('archive-product-btn')).not.toBeVisible();

      // Now archive it as OWNER
      await page.context().clearCookies();
      await signIn(page, TEST_USERS.owner);

      await deleteProductViaAPI(page, productId);

      // Sign back in as VIEWER
      await page.context().clearCookies();
      await signIn(page, TEST_USERS.viewer);

      // Navigate to archived product
      await page.goto(`/${TEST_USERS.viewer.tenant}/products/${productId}`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: /edit product/i })).toBeVisible();

      // Should see archived badge
      await expect(page.getByTestId('archived-badge')).toBeVisible();

      // Restore button should not be visible
      await expect(page.getByTestId('restore-btn')).not.toBeVisible();
    } finally {
      if (productId) {
        // Cleanup as OWNER
        await page.context().clearCookies();
        await signIn(page, TEST_USERS.owner);
        await deleteProductViaAPI(page, productId);
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
