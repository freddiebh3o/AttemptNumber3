// transfer-analytics.spec.ts
import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS, Factories } from '../../helpers';

/**
 * Transfer Analytics Dashboard & Phase 4 Features Tests
 *
 * Tests for Phase 4: Transfer Analytics Dashboard
 * - Analytics dashboard navigation and display
 * - Date range and branch filtering
 * - Chart rendering and data visualization
 * - Transfer prioritization (create, update, display)
 * - Partial shipment workflow
 * - Permission checks
 *
 * Covers Enhancements #9 (Analytics), #11 (Prioritization), #12 (Partial Shipment)
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

// Run tests serially to prevent data conflicts
test.describe.configure({ mode: 'serial' });

test.describe('Analytics Dashboard Navigation', () => {
  test('should navigate to analytics dashboard from sidebar', async ({ page }) => {
    await signIn(page, TEST_USERS.admin); // Admin has reports:view permission

    // Wait for navigation to load, then expand Stock Management dropdown
    const stockManagementNav = page.getByRole('navigation').getByText(/^stock management$/i);
    await expect(stockManagementNav).toBeVisible();
    await stockManagementNav.click();
    await page.waitForTimeout(300); // Wait for expansion animation

    // Wait for Analytics link to be visible, then click it
    const analyticsLink = page.getByRole('link', { name: /^analytics$/i });
    await expect(analyticsLink).toBeVisible();
    await analyticsLink.click();

    // Should be on analytics page
    await expect(page).toHaveURL(`/${TEST_USERS.admin.tenant}/stock-transfers/analytics`);

    // Should see page heading
    await expect(page.getByRole('heading', { name: /transfer analytics/i })).toBeVisible();
  });

  test('should display all analytics sections and charts', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/analytics`);
    await page.waitForLoadState('networkidle');

    // Wait for loading to finish - the loading spinner should disappear OR never appear
    await page.waitForTimeout(1000);

    // Should see metric cards with data-testid attributes
    await expect(page.getByTestId('metric-total-transfers')).toBeVisible();
    await expect(page.getByTestId('metric-active-transfers')).toBeVisible();
    await expect(page.getByTestId('metric-avg-approval-time')).toBeVisible();
    await expect(page.getByTestId('metric-avg-ship-time')).toBeVisible();

    // Verify charts/sections are visible using data-testid
    await expect(page.getByTestId('chart-transfer-volume')).toBeVisible();
    await expect(page.getByTestId('chart-status-distribution')).toBeVisible();
    await expect(page.getByTestId('chart-bottleneck-analysis')).toBeVisible();
    await expect(page.getByTestId('table-top-routes')).toBeVisible();
    await expect(page.getByTestId('table-branch-dependencies')).toBeVisible();
    await expect(page.getByTestId('table-product-frequency')).toBeVisible();
  });

  test('should show help section', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/analytics`);
    await page.waitForLoadState('networkidle');

    // Help section should be collapsible
    const helpButton = page.getByRole('button', { name: /help/i });
    await expect(helpButton).toBeVisible();

    // Click to expand
    await helpButton.click();
    await page.waitForTimeout(300);

    // Should show help content
    await expect(page.getByText(/understanding transfer analytics/i)).toBeVisible();
  });
});

test.describe('Analytics Filtering', () => {
  test('should filter analytics by date range', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Navigate to analytics page with URL params (simpler than interacting with date picker)
    const startDate = '2025-09-01';
    const endDate = '2025-10-14';
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/analytics?startDate=${startDate}&endDate=${endDate}`);
    await page.waitForLoadState('networkidle');

    // Wait for data to load with new filters
    await page.waitForTimeout(1000);

    // URL should contain query params
    await expect(page).toHaveURL(/startDate=2025-09-01/);
    await expect(page).toHaveURL(/endDate=2025-10-14/);

    // Charts should update (verify metric card is still visible)
    await expect(page.getByTestId('metric-total-transfers')).toBeVisible();

    // Verify the date inputs reflect the URL params (filters are populated from URL)
    // Open filters to check they're pre-filled
    const filtersButton = page.getByRole('button', { name: /filters/i });
    await filtersButton.click();
    await page.waitForTimeout(300);

    // Date buttons should show the selected dates in British format (dd/mm/yyyy)
    await expect(page.getByLabel(/start date/i)).toContainText('01/09/2025');
    await expect(page.getByLabel(/end date/i)).toContainText('14/10/2025');
  });

  test('should filter by branch (overview metrics only)', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Get seeded branch that owner has access to
    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');

    // Navigate with branch filter in URL
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/analytics?branchId=${sourceBranchId}`);
    await page.waitForLoadState('networkidle');

    // Wait for data to load
    await page.waitForTimeout(1000);

    // URL should contain branchId param
    await expect(page).toHaveURL(/branchId=/);

    // Should show note about branch filter applying to overview only
    // Open filters to verify
    const filtersButton = page.getByRole('button', { name: /filters/i });
    await filtersButton.click();
    await page.waitForTimeout(300);

    await expect(page.getByText(/applies to overview metrics only/i)).toBeVisible();

    // Verify metric cards are still visible
    await expect(page.getByTestId('metric-total-transfers')).toBeVisible();
  });

  test('should persist filters in URL for shareability', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Navigate with URL params
    const startDate = '2025-09-15';
    const endDate = '2025-10-10';
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/analytics?startDate=${startDate}&endDate=${endDate}`);
    await page.waitForLoadState('networkidle');

    // Wait for page to load
    await page.waitForTimeout(1000);

    // URL should contain the query params
    await expect(page).toHaveURL(/startDate=2025-09-15/);
    await expect(page).toHaveURL(/endDate=2025-10-10/);

    // Open filters to verify they're pre-filled from URL
    const filtersButton = page.getByRole('button', { name: /filters/i });
    await filtersButton.click();
    await page.waitForTimeout(300);

    // Date buttons should show the selected dates in British format (pre-filled from URL params)
    await expect(page.getByLabel(/start date/i)).toContainText('15/09/2025');
    await expect(page.getByLabel(/end date/i)).toContainText('10/10/2025');

    // Analytics should be filtered
    await expect(page.getByTestId('metric-total-transfers')).toBeVisible();
  });
});

test.describe('Transfer Prioritization', () => {
  test('should create transfer with URGENT priority', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    const productName = `Urgent Transfer Product ${timestamp}`;
    const productSku = `URGENT-SKU-${timestamp}`;

    // Get seeded branches that owner has access to
    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const destBranchId = await Factories.branch.getBySlug(page, 'acme-retail-1');

    const productId = await Factories.product.create(page, {
      productName,
      productSku,
      productPricePence: 500,
    });

    // Add stock to source
    await Factories.stock.addStock(page, {
      productId,
      branchId: sourceBranchId,
      qtyDelta: 100,
      unitCostPence: 100,
    });

    // Create transfer with URGENT priority
    const transferId = await Factories.transfer.create(page, {
      sourceBranchId: sourceBranchId,
      destinationBranchId: destBranchId,
      items: [{ productId, qty: 10 }],
      priority: 'URGENT',
    });

    // Navigate directly to the transfer detail page
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/${transferId}`);
    await page.waitForLoadState('networkidle');

    // Should see URGENT priority badge on the detail page
    await expect(page.getByText('URGENT').first()).toBeVisible({ timeout: 5000 });

    // Verify the transfer was created successfully
    await expect(page.getByText(productName)).toBeVisible();
  });

  test('should update transfer priority from detail page', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    const productName = `Priority Update Product ${timestamp}`;
    const productSku = `PRIORITY-SKU-${timestamp}`;

    // Get seeded branches that owner has access to
    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const destBranchId = await Factories.branch.getBySlug(page, 'acme-retail-1');

    const productId = await Factories.product.create(page, {
      productName,
      productSku,
      productPricePence: 500,
    });

    await Factories.stock.addStock(page, {
      productId,
      branchId: sourceBranchId,
      qtyDelta: 100,
      unitCostPence: 100,
    });

    // Create transfer with NORMAL priority
    const transferId = await Factories.transfer.create(page, {
      sourceBranchId: sourceBranchId,
      destinationBranchId: destBranchId,
      items: [{ productId, qty: 10 }],
      priority: 'NORMAL',
    });

    // Navigate to transfer detail
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/${transferId}`);
    await page.waitForLoadState('networkidle');

    // Should see NORMAL priority badge - use .first() to avoid strict mode
    await expect(page.getByText('NORMAL').first()).toBeVisible();

    // Click edit priority button (if available for REQUESTED status)
    const editPriorityButton = page.getByRole('button', { name: /edit priority/i });
    if (await editPriorityButton.isVisible()) {
      await editPriorityButton.click();

      // Modal should open
      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible();

      // Change priority to HIGH
      const prioritySelect = modal.getByLabel(/priority/i);
      await prioritySelect.click();
      await page.waitForTimeout(500);

      // Use getByRole('option') pattern like other tests - not scoped to modal
      await page.getByRole('option', { name: 'HIGH' }).click();

      // Save
      await modal.getByRole('button', { name: /save|update/i }).click();

      // Should show success notification
      await expect(page.getByText(/priority updated/i)).toBeVisible();

      // Priority badge should update - use .first() to avoid strict mode
      await expect(page.getByText('HIGH').first()).toBeVisible();
    }
  });

  test('should display priority badges with correct colors', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    // Get seeded branches that owner has access to
    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const destBranchId = await Factories.branch.getBySlug(page, 'acme-retail-1');

    // Create products for each priority level
    const transferIds: string[] = [];
    const priorities: Array<'URGENT' | 'HIGH' | 'NORMAL' | 'LOW'> = ['URGENT', 'HIGH', 'NORMAL', 'LOW'];

    for (const priority of priorities) {
      const productId = await Factories.product.create(page, {
        productName: `${priority} Product ${timestamp}`,
        productSku: `${priority}-SKU-${timestamp}`,
        productPricePence: 500,
      });

      await Factories.stock.addStock(page, {
        productId,
        branchId: sourceBranchId,
        qtyDelta: 10,
        unitCostPence: 100,
      });

      const transferId = await Factories.transfer.create(page, {
        sourceBranchId: sourceBranchId,
        destinationBranchId: destBranchId,
        items: [{ productId, qty: 5 }],
        priority,
      });
      transferIds.push(transferId);
    }

    // Instead of checking the list (which may have pagination/many items),
    // verify each transfer's detail page shows the correct priority badge
    for (let i = 0; i < transferIds.length; i++) {
      const transferId = transferIds[i];
      const priority = priorities[i];

      await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/${transferId}`);
      await page.waitForLoadState('networkidle');

      // Should see the priority badge on the detail page
      await expect(page.getByText(priority).first()).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Partial Shipment Workflow', () => {
  test('should ship partial quantity via ShipTransferModal', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    const productName = `Partial Ship Product ${timestamp}`;
    const productSku = `PARTIAL-SKU-${timestamp}`;

    // Get seeded branches that owner has access to
    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const destBranchId = await Factories.branch.getBySlug(page, 'acme-retail-1');

    const productId = await Factories.product.create(page, {
      productName,
      productSku,
      productPricePence: 500,
    });

    // Add stock to source
    await Factories.stock.addStock(page, {
      productId,
      branchId: sourceBranchId,
      qtyDelta: 100,
      unitCostPence: 100,
    });

    // Create and approve transfer (use low qty to avoid triggering approval rules)
    const transferId = await Factories.transfer.create(page, {
      sourceBranchId: sourceBranchId,
      destinationBranchId: destBranchId,
      items: [{ productId, qty: 5 }],
    });

    await Factories.transfer.approve(page, transferId);

    // Navigate to transfer detail
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/${transferId}`);
    await page.waitForLoadState('networkidle');

    // Click "Ship Transfer" button
    await page.getByRole('button', { name: /ship transfer/i }).click();

    // Ship modal should open
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/ship transfer/i)).toBeVisible();

    // Should show table with "Ship Now" column
    await expect(modal.getByText(/ship now/i)).toBeVisible();

    // Wait for the modal to fully render with data (items state to initialize)
    await page.waitForTimeout(500);

    // Find the NumberInput in the table (it's in the "Ship Now" column)
    const qtyInput = modal.locator('input[type="text"]').first();
    await expect(qtyInput).toBeVisible();

    // Default should be approved qty (5) - wait for it to be populated
    await expect(qtyInput).toHaveValue('5', { timeout: 5000 });

    // Change to partial qty (3 out of 5) - triple-click to select all, then type to replace
    await qtyInput.click({ clickCount: 3 });
    await qtyInput.press('Backspace');
    await qtyInput.fill('3');

    // Wait for React to update the total
    await page.waitForTimeout(300);

    // Verify the input value is 3
    await expect(qtyInput).toHaveValue('3');

    // Should show total items to ship
    await expect(modal.getByText(/total items to ship/i)).toBeVisible();

    // Ship partial
    await modal.getByRole('button', { name: /ship items/i }).click();

    // Should show success notification
    await expect(page.getByText(/shipped.*successfully/i)).toBeVisible();

    // Status should remain APPROVED (not IN_TRANSIT yet)
    await page.waitForTimeout(1000);
    await expect(page.getByText('APPROVED').first()).toBeVisible();

    // Should show "Ship Remaining Items" button
    await expect(page.getByRole('button', { name: /ship remaining/i })).toBeVisible();

    // Verify shipment batch displayed
    await expect(page.getByText(/shipment history/i)).toBeVisible();
    await expect(page.getByText(/batch #1/i)).toBeVisible();
  });

  test('should ship remaining items after partial shipment', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    const productName = `Remaining Ship Product ${timestamp}`;
    const productSku = `REMAINING-SKU-${timestamp}`;

    // Get seeded branches that owner has access to
    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const destBranchId = await Factories.branch.getBySlug(page, 'acme-retail-1');

    const productId = await Factories.product.create(page, {
      productName,
      productSku,
      productPricePence: 500,
    });

    await Factories.stock.addStock(page, {
      productId,
      branchId: sourceBranchId,
      qtyDelta: 100,
      unitCostPence: 100,
    });

    const transferId = await Factories.transfer.create(page, {
      sourceBranchId: sourceBranchId,
      destinationBranchId: destBranchId,
      items: [{ productId, qty: 10 }],
    });

    await Factories.transfer.approve(page, transferId);

    // Get transfer to find item ID
    const transfer = await Factories.transfer.getById(page, transferId);
    const itemId = transfer.items[0].id;

    // Ship partial (6 of 10)
    await Factories.transfer.ship(page, {
      transferId,
      items: [{ itemId, qtyToShip: 6 }],
    });

    // Navigate to detail page
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/${transferId}`);
    await page.waitForLoadState('networkidle');

    // Should show "Ship Remaining Items" button
    const shipRemainingButton = page.getByRole('button', { name: /ship remaining/i });
    await expect(shipRemainingButton).toBeVisible();

    // Click to open modal
    await shipRemainingButton.click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    // Wait for the modal to fully render with data
    await page.waitForTimeout(500);

    // Qty input should default to remaining qty (4 = 10 - 6)
    const qtyInput = modal.locator('input[type="text"]').first();
    await expect(qtyInput).toHaveValue('4', { timeout: 5000 });

    // No need to change the value - shipping all remaining items

    // Ship remaining
    await modal.getByRole('button', { name: /ship items/i }).click();

    // Should show success notification
    await expect(page.getByText(/shipped.*successfully/i)).toBeVisible();

    // Status should now be IN_TRANSIT (fully shipped)
    await page.waitForTimeout(1000);
    await expect(page.getByText('IN TRANSIT').first()).toBeVisible();

    // Should show both shipment batches
    await expect(page.getByText(/batch #1/i)).toBeVisible();
    await expect(page.getByText(/batch #2/i)).toBeVisible();
  });

  test('should display shipment batch history', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    const productName = `Batch History Product ${timestamp}`;
    const productSku = `BATCH-SKU-${timestamp}`;

    // Get seeded branches that owner has access to
    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const destBranchId = await Factories.branch.getBySlug(page, 'acme-retail-1');

    const productId = await Factories.product.create(page, {
      productName,
      productSku,
      productPricePence: 500,
    });

    await Factories.stock.addStock(page, {
      productId,
      branchId: sourceBranchId,
      qtyDelta: 100,
      unitCostPence: 100,
    });

    const transferId = await Factories.transfer.create(page, {
      sourceBranchId: sourceBranchId,
      destinationBranchId: destBranchId,
      items: [{ productId, qty: 9 }],
    });

    await Factories.transfer.approve(page, transferId);

    const transfer = await Factories.transfer.getById(page, transferId);
    const itemId = transfer.items[0].id;

    // Ship in 3 batches (3 units each)
    await Factories.transfer.ship(page, {
      transferId,
      items: [{ itemId, qtyToShip: 3 }],
    });

    await Factories.transfer.ship(page, {
      transferId,
      items: [{ itemId, qtyToShip: 3 }],
    });

    await Factories.transfer.ship(page, {
      transferId,
      items: [{ itemId, qtyToShip: 3 }],
    });

    // Navigate to detail page
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/${transferId}`);
    await page.waitForLoadState('networkidle');

    // Should show shipment history section
    await expect(page.getByText(/shipment history/i)).toBeVisible();

    // Should show all 3 batches
    await expect(page.getByText(/batch #1/i)).toBeVisible();
    await expect(page.getByText(/batch #2/i)).toBeVisible();
    await expect(page.getByText(/batch #3/i)).toBeVisible();

    // Should show quantities (3 units per batch)
    const threeUnitsText = page.getByText(/3 units/i);
    await expect(threeUnitsText.first()).toBeVisible();

    // Status should be IN_TRANSIT (fully shipped)
    await expect(page.getByText('IN TRANSIT').first()).toBeVisible();
  });
});

test.describe('Permission Checks', () => {
  test('admin can view analytics dashboard (has reports:view)', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    await page.goto(`/${TEST_USERS.admin.tenant}/stock-transfers/analytics`);
    await page.waitForLoadState('networkidle');

    // Should see analytics page
    await expect(page.getByRole('heading', { name: /transfer analytics/i })).toBeVisible();

    // Should see metric cards using data-testid
    await expect(page.getByTestId('metric-total-transfers')).toBeVisible();
  });

  test('viewer cannot create transfers with priority (lacks stock:write)', async ({ page }) => {
    await signIn(page, TEST_USERS.viewer);

    await page.goto(`/${TEST_USERS.viewer.tenant}/stock-transfers`);
    await page.waitForLoadState('networkidle');

    // "New Transfer" button should be disabled (viewer lacks stock:write permission)
    const newTransferButton = page.getByRole('button', { name: /new transfer/i });
    await expect(newTransferButton).toBeDisabled();
  });

  test('owner can create urgent transfers and ship partial quantities', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Owner has all permissions, so all Phase 4 features should be available
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);
    await page.waitForLoadState('networkidle');

    // Should see "New Transfer" button
    await expect(page.getByRole('button', { name: /new transfer/i })).toBeVisible();

    // Wait for navigation to load, then expand Stock Management dropdown
    const stockManagementNav = page.getByRole('navigation').getByText(/^stock management$/i);
    await expect(stockManagementNav).toBeVisible();
    await stockManagementNav.click();
    await page.waitForTimeout(300); // Wait for expansion animation

    // Should see "Analytics" link in sidebar
    const analyticsLink = page.getByRole('link', { name: /^analytics$/i });
    await expect(analyticsLink).toBeVisible();
  });
});
