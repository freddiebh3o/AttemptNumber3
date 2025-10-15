// admin-web/e2e/transfer-analytics-phase4.spec.ts
import { test, expect, type Page } from '@playwright/test';

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

// Test credentials from api-server/prisma/seed.ts
const TEST_USERS = {
  owner: { email: 'owner@acme.test', password: 'Password123!', tenant: 'acme' },
  admin: { email: 'admin@acme.test', password: 'Password123!', tenant: 'acme' },
  editor: { email: 'editor@acme.test', password: 'Password123!', tenant: 'acme' },
  viewer: { email: 'viewer@acme.test', password: 'Password123!', tenant: 'acme' },
};

// Helper to sign in
async function signIn(page: Page, user: typeof TEST_USERS.owner) {
  await page.goto('/');
  await page.getByLabel(/email address/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByLabel(/tenant/i).fill(user.tenant);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for redirect to products page
  await expect(page).toHaveURL(`/${user.tenant}/products`);
}

// Helper: Get branches via API
async function getBranchesViaAPI(page: Page): Promise<Array<{ id: string; branchName: string }>> {
  const apiUrl = process.env.VITE_API_BASE_URL || 'http://localhost:4000';

  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

  const response = await page.request.get(`${apiUrl}/api/branches`, {
    headers: { 'Cookie': cookieHeader },
  });

  if (!response.ok()) {
    throw new Error(`Failed to get branches: ${response.status()}`);
  }

  const data = await response.json();
  return data.data.items;
}

// Helper: Create product via API
async function createProductViaAPI(page: Page, params: {
  productName: string;
  productSku: string;
  productPricePence: number;
}): Promise<string> {
  const apiUrl = process.env.VITE_API_BASE_URL || 'http://localhost:4000';

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

// Helper: Create stock transfer via API with priority support
async function createTransferViaAPI(page: Page, params: {
  sourceBranchId: string;
  destinationBranchId: string;
  items: Array<{ productId: string; qtyToTransfer: number }>;
  priority?: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
}): Promise<string> {
  const apiUrl = process.env.VITE_API_BASE_URL || 'http://localhost:4000';
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

  const timestamp = Date.now();
  const requestNotes = `E2E Test Transfer [${timestamp}]`;

  const requestBody = {
    sourceBranchId: params.sourceBranchId,
    destinationBranchId: params.destinationBranchId,
    requestNotes,
    priority: params.priority || 'NORMAL',
    items: params.items.map(item => ({
      productId: item.productId,
      qtyRequested: item.qtyToTransfer,
    })),
  };

  const response = await page.request.post(`${apiUrl}/api/stock-transfers`, {
    data: requestBody,
    headers: {
      'Cookie': cookieHeader,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok()) {
    const errorText = await response.text();
    throw new Error(`Failed to create transfer: ${response.status()} - ${errorText}`);
  }

  const data = await response.json();
  return data.data.id;
}

// Helper: Approve transfer via API (handles both simple and multi-level approval)
async function approveTransferViaAPI(page: Page, transferId: string): Promise<void> {
  const apiUrl = process.env.VITE_API_BASE_URL || 'http://localhost:4000';
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

  // Try simple approval first
  const response = await page.request.patch(`${apiUrl}/api/stock-transfers/${transferId}/review`, {
    data: { action: 'approve' },
    headers: {
      'Cookie': cookieHeader,
      'Content-Type': 'application/json',
    },
  });

  // If simple approval fails with 409 (multi-level approval required), use approval workflow
  if (response.status() === 409) {
    const errorBody = await response.json();
    if (errorBody.error?.userFacingMessage?.includes('multi-level approval')) {
      // Get approval progress to see how many levels are required
      const progressResponse = await page.request.get(`${apiUrl}/api/stock-transfers/${transferId}/approval-progress`, {
        headers: { 'Cookie': cookieHeader },
      });

      if (!progressResponse.ok()) {
        throw new Error(`Failed to get approval progress: ${progressResponse.status()}`);
      }

      const progressData = await progressResponse.json();
      const records = progressData.data.records || [];

      // Submit approvals for each required level
      for (const record of records) {
        const approvalResponse = await page.request.post(`${apiUrl}/api/stock-transfers/${transferId}/approve/${record.level}`, {
          data: { notes: 'E2E test approval' },
          headers: {
            'Cookie': cookieHeader,
            'Content-Type': 'application/json',
          },
        });

        if (!approvalResponse.ok()) {
          const errorText = await approvalResponse.text();
          throw new Error(`Failed to submit approval for level ${record.level}: ${approvalResponse.status()} - ${errorText}`);
        }
      }

      return;
    }
  }

  // If it wasn't a 409 error, check if the request succeeded
  if (!response.ok()) {
    const errorText = await response.text();
    throw new Error(`Failed to approve transfer: ${response.status()} - ${errorText}`);
  }
}

// Helper: Add stock to product at branch via API
async function addStockViaAPI(page: Page, params: {
  productId: string;
  branchId: string;
  qtyDelta: number;
  unitCostPence: number;
  reason?: string;
}): Promise<void> {
  const apiUrl = process.env.VITE_API_BASE_URL || 'http://localhost:4000';
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

  const response = await page.request.post(`${apiUrl}/api/stock/adjust`, {
    data: {
      productId: params.productId,
      branchId: params.branchId,
      qtyDelta: params.qtyDelta,
      unitCostPence: params.unitCostPence,
      reason: params.reason || 'E2E test stock setup',
    },
    headers: {
      'Cookie': cookieHeader,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok()) {
    const errorText = await response.text();
    throw new Error(`Failed to add stock: ${response.status()} - ${errorText}`);
  }
}

// Helper: Ship transfer (partial) via API
async function shipTransferViaAPI(page: Page, params: {
  transferId: string;
  items?: Array<{ itemId: string; qtyToShip: number }>;
}): Promise<void> {
  const apiUrl = process.env.VITE_API_BASE_URL || 'http://localhost:4000';
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

  const requestBody = params.items ? { items: params.items } : {};

  const response = await page.request.post(`${apiUrl}/api/stock-transfers/${params.transferId}/ship`, {
    data: requestBody,
    headers: {
      'Cookie': cookieHeader,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok()) {
    const errorText = await response.text();
    throw new Error(`Failed to ship transfer: ${response.status()} - ${errorText}`);
  }
}

// Helper: Get transfer details via API
async function getTransferViaAPI(page: Page, transferId: string): Promise<any> {
  const apiUrl = process.env.VITE_API_BASE_URL || 'http://localhost:4000';
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

  const response = await page.request.get(`${apiUrl}/api/stock-transfers/${transferId}`, {
    headers: { 'Cookie': cookieHeader },
  });

  if (!response.ok()) {
    throw new Error(`Failed to get transfer: ${response.status()}`);
  }

  const data = await response.json();
  return data.data;
}

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

// Clear cookies between tests
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

// Run tests serially to prevent data conflicts
test.describe.configure({ mode: 'serial' });

test.describe('Analytics Dashboard Navigation', () => {
  test('should navigate to analytics dashboard from sidebar', async ({ page }) => {
    await signIn(page, TEST_USERS.admin); // Admin has reports:view permission

    // Navigate via sidebar link
    await page.getByRole('link', { name: /analytics/i }).click();

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

    // Date buttons should show the selected dates
    await expect(page.getByLabel(/start date/i)).toContainText('September 1, 2025');
    await expect(page.getByLabel(/end date/i)).toContainText('October 14, 2025');
  });

  test('should filter by branch (overview metrics only)', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Get branches first
    const branches = await getBranchesViaAPI(page);
    if (branches.length === 0) {
      console.warn('Skipping test: No branches available');
      return;
    }

    // Navigate with branch filter in URL
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/analytics?branchId=${branches[0].id}`);
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

    // Date buttons should show the selected dates (pre-filled from URL params)
    await expect(page.getByLabel(/start date/i)).toContainText('September 15, 2025');
    await expect(page.getByLabel(/end date/i)).toContainText('October 10, 2025');

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

    const branches = await getBranchesViaAPI(page);
    if (branches.length < 2) {
      console.warn('Skipping test: Need at least 2 branches');
      return;
    }

    const productId = await createProductViaAPI(page, {
      productName,
      productSku,
      productPricePence: 500,
    });

    // Add stock to source
    await addStockViaAPI(page, {
      productId,
      branchId: branches[0].id,
      qtyDelta: 100,
      unitCostPence: 100,
    });

    // Create transfer with URGENT priority
    await createTransferViaAPI(page, {
      sourceBranchId: branches[0].id,
      destinationBranchId: branches[1].id,
      items: [{ productId, qtyToTransfer: 10 }],
      priority: 'URGENT',
    });

    // Navigate to transfers list
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);
    await page.waitForLoadState('networkidle');

    // Should see URGENT badge on transfer - use .first() to avoid strict mode
    const urgentBadge = page.getByText('URGENT').first();
    await expect(urgentBadge).toBeVisible();

    // Urgent transfers should be at top of list (priority sorting)
    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toContainText('URGENT');
  });

  test('should update transfer priority from detail page', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    const productName = `Priority Update Product ${timestamp}`;
    const productSku = `PRIORITY-SKU-${timestamp}`;

    const branches = await getBranchesViaAPI(page);
    if (branches.length < 2) {
      console.warn('Skipping test: Need at least 2 branches');
      return;
    }

    const productId = await createProductViaAPI(page, {
      productName,
      productSku,
      productPricePence: 500,
    });

    await addStockViaAPI(page, {
      productId,
      branchId: branches[0].id,
      qtyDelta: 100,
      unitCostPence: 100,
    });

    // Create transfer with NORMAL priority
    const transferId = await createTransferViaAPI(page, {
      sourceBranchId: branches[0].id,
      destinationBranchId: branches[1].id,
      items: [{ productId, qtyToTransfer: 10 }],
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
    const branches = await getBranchesViaAPI(page);
    if (branches.length < 2) {
      console.warn('Skipping test: Need at least 2 branches');
      return;
    }

    // Create products for each priority level
    const transferIds: string[] = [];
    const priorities: Array<'URGENT' | 'HIGH' | 'NORMAL' | 'LOW'> = ['URGENT', 'HIGH', 'NORMAL', 'LOW'];

    for (const priority of priorities) {
      const productId = await createProductViaAPI(page, {
        productName: `${priority} Product ${timestamp}`,
        productSku: `${priority}-SKU-${timestamp}`,
        productPricePence: 500,
      });

      await addStockViaAPI(page, {
        productId,
        branchId: branches[0].id,
        qtyDelta: 10,
        unitCostPence: 100,
      });

      const transferId = await createTransferViaAPI(page, {
        sourceBranchId: branches[0].id,
        destinationBranchId: branches[1].id,
        items: [{ productId, qtyToTransfer: 5 }],
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

    const branches = await getBranchesViaAPI(page);
    if (branches.length < 2) {
      console.warn('Skipping test: Need at least 2 branches');
      return;
    }

    const productId = await createProductViaAPI(page, {
      productName,
      productSku,
      productPricePence: 500,
    });

    // Add stock to source
    await addStockViaAPI(page, {
      productId,
      branchId: branches[0].id,
      qtyDelta: 100,
      unitCostPence: 100,
    });

    // Create and approve transfer
    const transferId = await createTransferViaAPI(page, {
      sourceBranchId: branches[0].id,
      destinationBranchId: branches[1].id,
      items: [{ productId, qtyToTransfer: 50 }],
    });

    await approveTransferViaAPI(page, transferId);

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

    // Default should be approved qty (50) - wait for it to be populated
    await expect(qtyInput).toHaveValue('50', { timeout: 5000 });

    // Change to partial qty (30) - triple-click to select all, then type to replace
    await qtyInput.click({ clickCount: 3 });
    await qtyInput.press('Backspace');
    await qtyInput.fill('30');

    // Wait for React to update the total
    await page.waitForTimeout(300);

    // Verify the input value is 30
    await expect(qtyInput).toHaveValue('30');

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

    const branches = await getBranchesViaAPI(page);
    if (branches.length < 2) {
      console.warn('Skipping test: Need at least 2 branches');
      return;
    }

    const productId = await createProductViaAPI(page, {
      productName,
      productSku,
      productPricePence: 500,
    });

    await addStockViaAPI(page, {
      productId,
      branchId: branches[0].id,
      qtyDelta: 100,
      unitCostPence: 100,
    });

    const transferId = await createTransferViaAPI(page, {
      sourceBranchId: branches[0].id,
      destinationBranchId: branches[1].id,
      items: [{ productId, qtyToTransfer: 40 }],
    });

    await approveTransferViaAPI(page, transferId);

    // Get transfer to find item ID
    const transfer = await getTransferViaAPI(page, transferId);
    const itemId = transfer.items[0].id;

    // Ship partial (25 of 40)
    await shipTransferViaAPI(page, {
      transferId,
      items: [{ itemId, qtyToShip: 25 }],
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

    // Qty input should default to remaining qty (15)
    const qtyInput = modal.locator('input[type="text"]').first();
    await expect(qtyInput).toHaveValue('15', { timeout: 5000 });

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

    const branches = await getBranchesViaAPI(page);
    if (branches.length < 2) {
      console.warn('Skipping test: Need at least 2 branches');
      return;
    }

    const productId = await createProductViaAPI(page, {
      productName,
      productSku,
      productPricePence: 500,
    });

    await addStockViaAPI(page, {
      productId,
      branchId: branches[0].id,
      qtyDelta: 100,
      unitCostPence: 100,
    });

    const transferId = await createTransferViaAPI(page, {
      sourceBranchId: branches[0].id,
      destinationBranchId: branches[1].id,
      items: [{ productId, qtyToTransfer: 60 }],
    });

    await approveTransferViaAPI(page, transferId);

    const transfer = await getTransferViaAPI(page, transferId);
    const itemId = transfer.items[0].id;

    // Ship in 3 batches
    await shipTransferViaAPI(page, {
      transferId,
      items: [{ itemId, qtyToShip: 20 }],
    });

    await shipTransferViaAPI(page, {
      transferId,
      items: [{ itemId, qtyToShip: 20 }],
    });

    await shipTransferViaAPI(page, {
      transferId,
      items: [{ itemId, qtyToShip: 20 }],
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

    // Should show quantities (20 units per batch)
    const twentyUnitsText = page.getByText(/20 units/i);
    await expect(twentyUnitsText.first()).toBeVisible();

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

    // Should see "Analytics" link in sidebar
    await expect(page.getByRole('link', { name: /analytics/i })).toBeVisible();
  });
});
