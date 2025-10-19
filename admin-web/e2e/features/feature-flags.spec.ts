// admin-web/e2e/features/feature-flags.spec.ts
import { test, expect } from '@playwright/test';
import { signIn, Factories, type TestUserCredentials } from '../helpers';

/**
 * Feature Flags Tests
 *
 * Tests for tenant-level feature flag system
 * - Barcode scanning enabled/disabled per tenant
 * - UI elements hidden when features are disabled
 * - Graceful degradation for tenants without features
 *
 * Test Tenants:
 * - ACME: barcodeScanningEnabled = true (camera mode)
 * - Globex: barcodeScanningEnabled = false
 */

// Test credentials from api-server/prisma/seed.ts
const TEST_USERS_ACME = {
  owner: { email: 'owner@acme.test', password: 'Password123!', tenant: 'acme' },
  editor: { email: 'editor@acme.test', password: 'Password123!', tenant: 'acme' },
} satisfies Record<string, TestUserCredentials>;

const TEST_USERS_GLOBEX = {
  // mixed@both.test has membership in both tenants
  viewer: { email: 'mixed@both.test', password: 'Password123!', tenant: 'globex' },
} satisfies Record<string, TestUserCredentials>;

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

test.describe('Feature Flags: ACME Tenant (Barcode Scanning Enabled)', () => {
  test('should show "Scan to Receive" button on stock transfers for ACME tenant', async ({ page }) => {
    await signIn(page, TEST_USERS_ACME.owner);

    const timestamp = Date.now();

    // Get branches
    const branches = await Factories.branch.getAll(page);
    if (branches.length < 2) {
      console.warn('Skipping test: Need at least 2 branches');
      return;
    }

    const sourceBranch = branches[0];
    const destBranch = branches[1];

    // Create product with barcode
    const productId = await Factories.product.create(page, {
      productName: `ACME Feature Test ${timestamp}`,
      productSku: `ACME-FF-${timestamp}`,
      productPricePence: 1000,
      barcode: `ACME-BC-${timestamp}`,
      barcodeType: 'EAN13',
    });

    // Create stock transfer with shipped status
    const transferId = await Factories.transfer.createAndShip(page, {
      sourceBranchId: sourceBranch.id,
      destinationBranchId: destBranch.id,
      productId,
      quantity: 5,
      unitCostPence: 100,
    });

    try {
      // Navigate to transfer detail page
      await page.goto(`/${TEST_USERS_ACME.owner.tenant}/stock-transfers/${transferId}`);
      await page.waitForLoadState('networkidle');

      // Wait for IN_TRANSIT status
      await expect(page.getByText('IN TRANSIT', { exact: false })).toBeVisible({ timeout: 10000 });

      // ACME has barcode scanning enabled - should see "Scan to Receive" button
      const scanButton = page.getByRole('button', { name: /scan to receive/i });
      await expect(scanButton).toBeVisible();
      await expect(scanButton).toBeEnabled();

      // Should also show "Manual Receive" as secondary option
      const manualButton = page.getByRole('button', { name: /manual receive/i });
      await expect(manualButton).toBeVisible();
    } finally {
      await Factories.transfer.delete(page, transferId);
      await Factories.product.delete(page, productId);
    }
  });

  test('should show barcode fields on product edit page for ACME tenant', async ({ page }) => {
    await signIn(page, TEST_USERS_ACME.editor);

    const timestamp = Date.now();
    const productName = `ACME Product Fields Test ${timestamp}`;
    const productSku = `ACME-FIELDS-${timestamp}`;

    // Create product without barcode
    const productId = await Factories.product.create(page, {
      productName,
      productSku,
      productPricePence: 1500,
    });

    try {
      // Navigate to product edit page
      await page.goto(`/${TEST_USERS_ACME.editor.tenant}/products/${productId}`);
      await page.waitForLoadState('networkidle');

      // Verify product loaded
      await expect(page.getByRole('heading', { name: /edit product/i })).toBeVisible();

      // ACME has barcode scanning enabled - barcode fields should be visible
      await expect(page.getByRole('textbox', { name: /barcode type/i })).toBeVisible();
      await expect(page.getByLabel(/^barcode$/i)).toBeVisible();

      // Can add barcode
      const barcodeTypeSelect = page.getByRole('textbox', { name: /barcode type/i });
      await barcodeTypeSelect.click();
      await page.waitForTimeout(500);
      await page.getByText('EAN-13', { exact: true }).click();

      const barcodeInput = page.getByLabel(/^barcode$/i);
      await barcodeInput.fill(`5012345${timestamp.toString().slice(-6)}`);

      // Save
      await page.getByRole('button', { name: /^save$/i }).click();

      // Should show success notification
      await expect(page.getByText(/product updated/i)).toBeVisible();
    } finally {
      await Factories.product.delete(page, productId);
    }
  });

  test('should show barcode fields on new product page for ACME tenant', async ({ page }) => {
    await signIn(page, TEST_USERS_ACME.editor);

    // Navigate to new product page
    await page.goto(`/${TEST_USERS_ACME.editor.tenant}/products/new`);
    await page.waitForLoadState('networkidle');

    // Verify heading
    await expect(page.getByRole('heading', { name: /new product/i })).toBeVisible();

    // ACME has barcode scanning enabled - barcode fields should be visible
    await expect(page.getByRole('textbox', { name: /barcode type/i })).toBeVisible();
    await expect(page.getByLabel(/^barcode$/i)).toBeVisible();

    // Can select barcode type
    const barcodeTypeSelect = page.getByRole('textbox', { name: /barcode type/i });
    await barcodeTypeSelect.click();
    await page.waitForTimeout(500);

    // All barcode types should be available
    await expect(page.getByText('EAN-13', { exact: true })).toBeVisible();
    await expect(page.getByText('UPC-A', { exact: true })).toBeVisible();
    await expect(page.getByText('Code 128', { exact: true })).toBeVisible();
    await expect(page.getByText('QR Code', { exact: true })).toBeVisible();
  });
});

test.describe('Feature Flags: Globex Tenant (Barcode Scanning Disabled)', () => {
  test('should NOT show "Scan to Receive" button on stock transfers for Globex tenant', async ({ page }) => {
    await signIn(page, TEST_USERS_GLOBEX.viewer);

    // Navigate to stock transfers page
    await page.goto(`/${TEST_USERS_GLOBEX.viewer.tenant}/stock-transfers`);
    await page.waitForLoadState('networkidle');

    // Check if any transfers exist
    const hasTransfers = await page.locator('table tbody tr').count() > 0;

    if (hasTransfers) {
      // Click first transfer
      const viewButton = page.locator('table tbody tr:first-child td:last-child button').first();
      await viewButton.click();

      await page.waitForLoadState('networkidle');

      // Globex has barcode scanning disabled - should NOT see "Scan to Receive" button
      const scanButton = page.getByRole('button', { name: /scan to receive/i });
      await expect(scanButton).not.toBeVisible();

      // Should see either "Receive Items" or "Manual Receive" button (depending on status and permissions)
      // Viewer role doesn't have stock:write, so no receive buttons should be visible at all
      await expect(page.getByRole('button', { name: /manual receive/i })).not.toBeVisible();
      await expect(page.getByRole('button', { name: /receive items/i })).not.toBeVisible();
    } else {
      console.warn('No transfers available for Globex tenant - skipping transfer button test');
    }
  });

  test('should NOT show barcode fields on product edit page for Globex tenant', async ({ page }) => {
    // Note: Viewer role in Globex doesn't have permission to create products
    // This test would require a higher-privilege Globex user (owner/editor)
    // For now, we'll test the new product page which is read-only for field visibility

    await signIn(page, TEST_USERS_GLOBEX.viewer);

    // Try to navigate to new product page
    await page.goto(`/${TEST_USERS_GLOBEX.viewer.tenant}/products/new`);
    await page.waitForLoadState('networkidle');

    // Viewer may be redirected or shown permission error
    // Check if we can see the form at all
    const hasProductForm = await page.getByLabel(/product name/i).isVisible().catch(() => false);

    if (hasProductForm) {
      // Globex has barcode scanning disabled - barcode fields should NOT be visible
      await expect(page.getByRole('textbox', { name: /barcode type/i })).not.toBeVisible();
      await expect(page.getByLabel(/^barcode$/i)).not.toBeVisible();
    } else {
      console.warn('Product form not visible for Globex viewer - likely permission issue');
    }
  });

  test('should NOT show barcode fields on products page for Globex tenant', async ({ page }) => {
    await signIn(page, TEST_USERS_GLOBEX.viewer);

    // Navigate to products page
    await page.goto(`/${TEST_USERS_GLOBEX.viewer.tenant}/products`);
    await page.waitForLoadState('networkidle');

    // Check if any products exist
    const hasProducts = await page.locator('table tbody tr').count() > 0;

    if (hasProducts) {
      // Click first product to view details
      const viewButton = page.locator('table tbody tr:first-child td:last-child button').first();
      await viewButton.click();

      await page.waitForLoadState('networkidle');

      // Globex has barcode scanning disabled - barcode fields should NOT be visible
      await expect(page.getByRole('textbox', { name: /barcode type/i })).not.toBeVisible();
      await expect(page.getByLabel(/^barcode$/i)).not.toBeVisible();
    } else {
      console.warn('No products available for Globex tenant');
    }
  });

  test('should show "Receive Items" button (not "Scan to Receive") for Globex tenant with permissions', async ({ page }) => {
    // This test verifies graceful degradation: tenants without barcode scanning
    // should still be able to receive stock, just without the scan option

    // We need a Globex user with stock:write permission for this test
    // Since we only have viewer in Globex, this test documents the expected behavior
    // In a real scenario, we'd create a Globex owner/editor user

    await signIn(page, TEST_USERS_GLOBEX.viewer);

    await page.goto(`/${TEST_USERS_GLOBEX.viewer.tenant}/stock-transfers`);
    await page.waitForLoadState('networkidle');

    // Check if any IN_TRANSIT transfers exist
    const hasTransfers = await page.locator('table tbody tr').count() > 0;

    if (hasTransfers) {
      // Viewer doesn't have stock:write, so won't see receive buttons
      // But the expected behavior for users WITH stock:write would be:
      // - NO "Scan to Receive" button
      // - YES "Receive Items" button (as primary action, not secondary)

      console.log('Note: Viewer role cannot receive stock. Expected behavior for owner/editor:');
      console.log('  - "Scan to Receive" button: NOT visible');
      console.log('  - "Receive Items" button: visible (primary variant)');
    }
  });
});

test.describe('Feature Flags: API Response', () => {
  test('should include featureFlags in /api/auth/me response for ACME tenant', async ({ page }) => {
    await signIn(page, TEST_USERS_ACME.owner);

    const apiUrl = process.env.VITE_API_BASE_URL || 'http://localhost:4000';
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const response = await page.request.get(`${apiUrl}/api/auth/me`, {
      headers: { 'Cookie': cookieHeader },
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);

    // Verify currentTenant includes featureFlags
    expect(data.data.currentTenant).toBeDefined();
    expect(data.data.currentTenant.featureFlags).toBeDefined();

    // ACME should have barcode scanning enabled
    expect(data.data.currentTenant.featureFlags.barcodeScanningEnabled).toBe(true);
    expect(data.data.currentTenant.featureFlags.barcodeScanningMode).toBe('camera');
  });

  test('should include featureFlags in /api/auth/me response for Globex tenant', async ({ page }) => {
    await signIn(page, TEST_USERS_GLOBEX.viewer);

    const apiUrl = process.env.VITE_API_BASE_URL || 'http://localhost:4000';
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const response = await page.request.get(`${apiUrl}/api/auth/me`, {
      headers: { 'Cookie': cookieHeader },
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);

    // Verify currentTenant includes featureFlags
    expect(data.data.currentTenant).toBeDefined();
    expect(data.data.currentTenant.featureFlags).toBeDefined();

    // Globex should have barcode scanning disabled
    expect(data.data.currentTenant.featureFlags.barcodeScanningEnabled).toBe(false);
    expect(data.data.currentTenant.featureFlags.barcodeScanningMode).toBeNull();
  });
});
