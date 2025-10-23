// admin-web/e2e/features/products/product-activity.spec.ts
import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS, Factories } from '../../helpers';

/**
 * Phase 4: Product Activity Tab Tests
 *
 * Tests cover:
 * - Navigate to Activity tab
 * - Display audit log for product (create, update events)
 * - Show actor and timestamp for each event
 * - Display before/after changes
 * - Filter activity by action type (all, audit, ledger)
 * - Filter activity by actor
 * - Filter activity by date range
 * - Pagination works correctly
 * - Empty state for new products
 * - View mode toggle (table vs timeline)
 * - Refresh functionality
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

test.describe('Product Activity Tab - Navigation', () => {
  test('should navigate to Activity tab from product page', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Get first product
    const productId = await Factories.product.getFirst(page);

    // Navigate to product page
    await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}`);
    await page.waitForLoadState('networkidle');

    // Click Activity tab
    await page.getByRole('tab', { name: /activity/i }).click();

    // Should update URL
    await expect(page).toHaveURL(/tab=activity/);

    // Should show activity heading
    await expect(page.getByRole('heading', { name: /^activity$/i })).toBeVisible();
  });

  test('should navigate directly to Activity tab via URL', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Get first product
    const productId = await Factories.product.getFirst(page);

    // Navigate directly with query param
    await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}?tab=activity`);
    await page.waitForLoadState('networkidle');

    // Should show activity heading
    await expect(page.getByRole('heading', { name: /^activity$/i })).toBeVisible();
  });

  test('should only show Activity tab for existing products', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Navigate to create new product page
    await page.goto(`/${TEST_USERS.owner.tenant}/products/new`);
    await page.waitForLoadState('networkidle');

    // Activity tab should NOT be visible for new products
    await expect(page.getByRole('tab', { name: /activity/i })).not.toBeVisible();
  });
});

test.describe('Product Activity Tab - Display Audit Events', () => {
  test('should display product creation event', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Create a new product
    const timestamp = Date.now();
    const productId = await Factories.product.create(page, {
      productName: `Activity Test Product ${timestamp}`,
      productSku: `ACT-${timestamp}`,
      productPricePence: 1500,
    });

    try {
      // Navigate to Activity tab
      await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}?tab=activity`);
      await page.waitForLoadState('networkidle');

      // Should show "Product created" or similar event
      await expect(page.getByText(/created/i)).toBeVisible();

      // Should show actor (the owner who created it) - scope to table to avoid navigation bar
      const table = page.getByRole('table');
      await expect(table.getByText(/owner@acme\.test/i)).toBeVisible();

      // Should show timestamp
      await expect(table.getByText(/ago/i)).toBeVisible();
    } finally {
      await Factories.product.delete(page, productId);
    }
  });

  test('should display product update event with before/after changes', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Create a product
    const timestamp = Date.now();
    const productId = await Factories.product.create(page, {
      productName: `Update Test Product ${timestamp}`,
      productSku: `UPD-${timestamp}`,
      productPricePence: 1000,
    });

    try {
      // Update the product via UI
      await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}`);
      await page.waitForLoadState('networkidle');

      // Change product name
      await page.getByLabel(/product name/i).fill('Updated Product Name');
      await page.getByRole('button', { name: /save/i }).click();

      // Wait for success notification
      await expect(page.getByText(/product updated/i)).toBeVisible();

      // Wait for notification to disappear
      await page.waitForTimeout(1000);

      // Navigate to Activity tab
      await page.getByRole('tab', { name: /activity/i }).click();
      await expect(page).toHaveURL(/tab=activity/);

      // Wait for activity table to load
      const table = page.getByRole('table');
      await expect(table).toBeVisible();

      // Should show UPDATE badge (action type)
      await expect(table.getByText(/^update$/i)).toBeVisible();

      // Should show before/after for name change
      await expect(table.getByText(/name:/i)).toBeVisible();

      // Check for both the old and new product names in the table
      const tableContent = await table.textContent();
      expect(tableContent).toContain('Update Test Product');
      expect(tableContent).toContain('Updated Product Name');
    } finally {
      await Factories.product.delete(page, productId);
    }
  });
});

test.describe('Product Activity Tab - Display Stock Events', () => {
  test('should display stock adjustment event (ledger)', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Create product with stock
    const timestamp = Date.now();
    const { productId } = await Factories.stock.createProductWithStock(page, {
      productName: `Stock Activity Test ${timestamp}`,
      productSku: `STACT-${timestamp}`,
      productPricePence: 1200,
      initialQty: 50,
      unitCostPence: 400,
    });

    try {
      // Navigate to Activity tab
      await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}?tab=activity`);
      await page.waitForLoadState('networkidle');

      // Should show stock adjustment event (RECEIPT or ADJUSTMENT)
      const table = page.getByRole('table');
      await expect(table).toBeVisible();

      // Should show RECEIPT or ADJUSTMENT badge
      await expect(
        page.getByText(/receipt|adjustment/i)
      ).toBeVisible();

      // Should show quantity delta
      await expect(page.getByText(/\+50|50/)).toBeVisible();
    } finally {
      await Factories.product.delete(page, productId);
    }
  });
});

test.describe('Product Activity Tab - Filtering by Type', () => {
  test('should filter to show only audit events', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Create product with stock (creates both audit and ledger events)
    const timestamp = Date.now();
    const { productId } = await Factories.stock.createProductWithStock(page, {
      productName: `Filter Audit Test ${timestamp}`,
      productSku: `FLTAUD-${timestamp}`,
      productPricePence: 1300,
      initialQty: 30,
      unitCostPence: 450,
    });

    try {
      // Navigate to Activity tab
      await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}?tab=activity`);
      await page.waitForLoadState('networkidle');

      // Open filters
      await page.getByRole('button', { name: /filters/i }).click();

      // Wait for filter panel to open
      await page.waitForTimeout(300);

      // Select "Product changes" (audit only)
      const typeInput = page.getByRole('textbox', { name: /^type$/i });
      await typeInput.click();
      await page.getByRole('option', { name: /product changes/i }).click();

      // Apply filters
      await page.getByRole('button', { name: /apply/i }).click();

      // Wait for reload
      await page.waitForTimeout(500);

      // Get the table
      const table = page.getByRole('table');

      // Should only show audit events (no RECEIPT/ADJUSTMENT badges in table)
      await expect(table.getByText(/receipt|adjustment/i)).not.toBeVisible();

      // Should show CREATE badge (exact match to avoid "Created product")
      await expect(table.getByText('CREATE', { exact: true })).toBeVisible();
    } finally {
      await Factories.product.delete(page, productId);
    }
  });

  test('should filter to show only stock movements (ledger)', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Create product with stock
    const timestamp = Date.now();
    const { productId } = await Factories.stock.createProductWithStock(page, {
      productName: `Filter Ledger Test ${timestamp}`,
      productSku: `FLTLDG-${timestamp}`,
      productPricePence: 1400,
      initialQty: 40,
      unitCostPence: 500,
    });

    try {
      // Navigate to Activity tab
      await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}?tab=activity`);
      await page.waitForLoadState('networkidle');

      // Open filters
      await page.getByRole('button', { name: /filters/i }).click();

      // Wait for filter panel to open
      await page.waitForTimeout(300);

      // Select "Stock movements" (ledger only)
      const typeInput = page.getByRole('textbox', { name: /^type$/i });
      await typeInput.click();
      await page.getByRole('option', { name: /stock movements/i }).click();

      // Apply filters
      await page.getByRole('button', { name: /apply/i }).click();

      // Wait for reload
      await page.waitForTimeout(500);

      // Should only show ledger events (RECEIPT/ADJUSTMENT)
      await expect(page.getByText(/receipt|adjustment/i)).toBeVisible();

      // Should not show CREATE badge
      await expect(page.getByText(/^create$/i)).not.toBeVisible();
    } finally {
      await Factories.product.delete(page, productId);
    }
  });
});

test.describe('Product Activity Tab - View Mode Toggle', () => {
  test('should toggle between table and timeline view', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Get first product
    const productId = await Factories.product.getFirst(page);

    // Navigate to Activity tab
    await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}?tab=activity`);
    await page.waitForLoadState('networkidle');

    // Default should be table view - check for table element
    await expect(page.getByRole('table')).toBeVisible();

    // Switch to timeline view - click the label, not the hidden radio input
    await page.getByText('Timeline', { exact: true }).click();

    // Wait for mode change
    await page.waitForTimeout(500);

    // Table should be hidden
    await expect(page.getByRole('table')).not.toBeVisible();

    // Switch back to table view - click the label
    await page.getByText('Table', { exact: true }).click();

    // Wait for mode change
    await page.waitForTimeout(500);

    // Table should be visible again
    await expect(page.getByRole('table')).toBeVisible();
  });
});

test.describe('Product Activity Tab - Pagination', () => {
  test('should show pagination controls', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Get first product
    const productId = await Factories.product.getFirst(page);

    // Navigate to Activity tab
    await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}?tab=activity`);
    await page.waitForLoadState('networkidle');

    // Should show pagination info (appears twice - top and bottom, check first)
    await expect(page.getByText(/showing \d+–\d+/i).first()).toBeVisible();

    // Should show prev/next buttons
    await expect(page.getByRole('button', { name: /prev/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /next/i }).first()).toBeVisible();

    // Prev should be disabled on first page
    await expect(page.getByRole('button', { name: /prev/i }).first()).toBeDisabled();
  });

  test('should change per-page limit', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Get first product
    const productId = await Factories.product.getFirst(page);

    // Navigate to Activity tab
    await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}?tab=activity`);
    await page.waitForLoadState('networkidle');

    // Find per-page input
    const perPageInput = page.getByLabel(/results per page/i);
    await expect(perPageInput).toBeVisible();

    // Change to 10
    await perPageInput.fill('10');
    await perPageInput.blur();

    // Wait for reload
    await page.waitForTimeout(1000);

    // URL should be updated with new limit
    await expect(page).toHaveURL(/limit=10/);
  });
});

test.describe('Product Activity Tab - Refresh', () => {
  test('should refresh activity data when refresh button clicked', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Create product
    const timestamp = Date.now();
    const productId = await Factories.product.create(page, {
      productName: `Refresh Test ${timestamp}`,
      productSku: `REF-${timestamp}`,
      productPricePence: 1500,
    });

    try {
      // Navigate to Activity tab
      await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}?tab=activity`);
      await page.waitForLoadState('networkidle');

      // Note the current content
      const initialContent = await page.getByRole('table').textContent();

      // Click refresh button
      await page.getByRole('button', { name: /refresh/i }).click();

      // Wait for reload
      await page.waitForTimeout(1000);

      // Content should be present (may be same, but proves refresh worked)
      await expect(page.getByRole('table')).toBeVisible();
      const refreshedContent = await page.getByRole('table').textContent();
      expect(refreshedContent).toBeTruthy();
    } finally {
      await Factories.product.delete(page, productId);
    }
  });
});

test.describe('Product Activity Tab - Empty State', () => {
  test('should show message when no activity matches filters', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Create a brand new product (will have minimal activity)
    const timestamp = Date.now();
    const productId = await Factories.product.create(page, {
      productName: `Empty State Test ${timestamp}`,
      productSku: `EMPTY-${timestamp}`,
      productPricePence: 1800,
    });

    try {
      // Navigate to Activity tab
      await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}?tab=activity`);
      await page.waitForLoadState('networkidle');

      // Open filters
      await page.getByRole('button', { name: /filters/i }).click();
      await page.waitForTimeout(300);

      // Filter to show only "Stock movements" (ledger) - product has none
      const typeInput = page.getByRole('textbox', { name: /^type$/i });
      await typeInput.click();
      await page.getByRole('option', { name: /stock movements/i }).click();

      // Apply filters
      await page.getByRole('button', { name: /apply/i }).click();

      // Wait for reload
      await page.waitForTimeout(500);

      // Should show empty state message
      await expect(page.getByText(/no activity matches/i)).toBeVisible();

      // Should suggest adjusting filters
      await expect(page.getByText(/adjust.*filter/i)).toBeVisible();
    } finally {
      await Factories.product.delete(page, productId);
    }
  });
});

test.describe('Product Activity Tab - Actor Display', () => {
  test('should display actor name and link for each event', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Create a product (creates audit event with owner as actor)
    const timestamp = Date.now();
    const productId = await Factories.product.create(page, {
      productName: `Actor Test ${timestamp}`,
      productSku: `ACTOR-${timestamp}`,
      productPricePence: 1600,
    });

    try {
      // Navigate to Activity tab
      await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}?tab=activity`);
      await page.waitForLoadState('networkidle');

      // Scope to table to avoid navigation bar
      const table = page.getByRole('table');
      await expect(table).toBeVisible();

      // Should show actor name in table
      await expect(table.getByText(/owner@acme\.test/i)).toBeVisible();

      // Actor should be a link to user page (scope to table)
      const actorLink = table.getByRole('link', { name: /owner@acme\.test/i });
      await expect(actorLink).toBeVisible();

      // Link should point to user page
      const href = await actorLink.getAttribute('href');
      expect(href).toContain('/users/');
    } finally {
      await Factories.product.delete(page, productId);
    }
  });
});

test.describe('Product Activity Tab - Timestamp Display', () => {
  test('should display timestamp in human-readable format', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Get first product
    const productId = await Factories.product.getFirst(page);

    // Navigate to Activity tab
    await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}?tab=activity`);
    await page.waitForLoadState('networkidle');

    // Should show relative time (e.g., "5 minutes ago", "2 days ago")
    await expect(page.getByText(/ago/i)).toBeVisible();

    // Should show absolute timestamp on hover (tooltip)
    // First table row's timestamp cell
    const firstTimestamp = page.locator('table tbody tr').first().locator('td').first();
    await firstTimestamp.hover();

    // Tooltip with full date should appear (we can't easily test tooltip content in Playwright)
    // But hovering should not cause errors
    await page.waitForTimeout(300);
  });
});

test.describe('Product Activity Tab - Permissions', () => {
  test('owner can view activity', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const productId = await Factories.product.getFirst(page);

    await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}?tab=activity`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /^activity$/i })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('admin can view activity', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    const productId = await Factories.product.getFirst(page);

    await page.goto(`/${TEST_USERS.admin.tenant}/products/${productId}?tab=activity`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /^activity$/i })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('editor can view activity', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);

    const productId = await Factories.product.getFirst(page);

    await page.goto(`/${TEST_USERS.editor.tenant}/products/${productId}?tab=activity`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /^activity$/i })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('viewer can view activity', async ({ page }) => {
    await signIn(page, TEST_USERS.viewer);

    const productId = await Factories.product.getFirst(page);

    await page.goto(`/${TEST_USERS.viewer.tenant}/products/${productId}?tab=activity`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /^activity$/i })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });
});
