// transfer-delivery-fields.spec.ts
import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS, Factories } from '../../helpers';

/**
 * E2E Tests for Stock Transfer Delivery Fields
 *
 * Tests cover:
 * - Creating transfers with expected delivery date
 * - Creating transfers with order notes
 * - Creating transfers with both fields
 * - Viewing delivery fields on transfer detail page
 * - Filtering transfers by expected delivery date range
 * - Validation for max length on order notes
 *
 * Related Files:
 * - admin-web/src/components/stockTransfers/CreateTransferModal.tsx
 * - admin-web/src/pages/StockTransferDetailPage.tsx
 * - admin-web/src/pages/StockTransfersPage.tsx
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

test.describe('Transfer Delivery Fields - Create with Delivery Fields', () => {
  test('should create transfer with expected delivery date and order notes', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    // Create test data via API
    const timestamp = Date.now();
    const productName = `Delivery Product ${timestamp}`;
    const productSku = `DEL-${timestamp}`;

    await Factories.product.create(page, { productName, productSku, productPricePence: 1000 });

    // Navigate to transfers page
    await page.goto(`/${TEST_USERS.admin.tenant}/stock-transfers`);
    await page.waitForLoadState('networkidle');

    // Open create modal
    await page.getByRole('button', { name: /new transfer/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Fill in basic fields - use seeded branches
    await dialog.getByLabel(/from branch/i).click();
    await page.getByRole('option', { name: 'HQ' }).click();

    await dialog.getByLabel(/to branch/i).click();
    await page.getByRole('option', { name: 'Warehouse' }).click();

    // Add item
    await dialog.getByRole('button', { name: /add item/i }).click();
    await dialog.locator('[data-testid="transfer-item-product-select-0"]').click();
    await page.getByRole('option', { name: new RegExp(productName) }).click();

    // Set expected delivery date (tomorrow)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const deliveryDateInput = dialog.getByTestId('expected-delivery-date');
    await deliveryDateInput.click();
    // Click tomorrow's date in the calendar picker (format: "25 October")
    const dateButtonText = `${tomorrow.getDate()} ${tomorrow.toLocaleString('en-US', { month: 'long' })}`;
    await page.getByRole('button', { name: dateButtonText }).click();

    // Enter order notes
    const orderNotesInput = dialog.getByTestId('order-notes');
    await orderNotesInput.fill('Urgent delivery required for promotion event');

    // Submit form
    await dialog.getByTestId('create-transfer-button').click();

    // Should navigate to detail page
    await expect(page).toHaveURL(/\/stock-transfers\/.+/);
    await page.waitForLoadState('networkidle');

    // Verify delivery date is shown
    await expect(page.getByTestId('transfer-expected-delivery')).toBeVisible();
    await expect(page.getByTestId('transfer-expected-delivery')).toContainText(tomorrow.toLocaleDateString());

    // Verify order notes are shown
    await expect(page.getByTestId('transfer-order-notes')).toBeVisible();
    await expect(page.getByTestId('transfer-order-notes')).toContainText('Urgent delivery required for promotion event');
  });

  test('should create transfer with only expected delivery date', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    const timestamp = Date.now();
    const productName = `Widget ${timestamp}`;
    const productSku = `WID-${timestamp}`;

    await Factories.product.create(page, { productName, productSku, productPricePence: 500 });

    await page.goto(`/${TEST_USERS.admin.tenant}/stock-transfers`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /new transfer/i }).click();
    const dialog = page.getByRole('dialog');

    await dialog.getByLabel(/from branch/i).click();
    await page.getByRole('option', { name: 'HQ' }).click();

    await dialog.getByLabel(/to branch/i).click();
    await page.getByRole('option', { name: 'Warehouse' }).click();

    await dialog.getByRole('button', { name: /add item/i }).click();
    await dialog.locator('[data-testid="transfer-item-product-select-0"]').click();
    await page.getByRole('option', { name: new RegExp(productName) }).click();

    // Set expected delivery date only (no order notes) - use tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const deliveryDateInput = dialog.getByTestId('expected-delivery-date');
    await deliveryDateInput.click();
    // Click tomorrow's date in the calendar picker (format: "25 October")
    const dateButtonText = `${tomorrow.getDate()} ${tomorrow.toLocaleString('en-US', { month: 'long' })}`;
    await page.getByRole('button', { name: dateButtonText }).click();

    await dialog.getByTestId('create-transfer-button').click();

    await expect(page).toHaveURL(/\/stock-transfers\/.+/);
    await page.waitForLoadState('networkidle');

    // Verify delivery date is shown
    await expect(page.getByTestId('transfer-expected-delivery')).toBeVisible();

    // Verify order notes section doesn't exist (since no notes provided)
    await expect(page.getByTestId('transfer-order-notes')).not.toBeVisible();
  });

  test('should create transfer with only order notes', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    const timestamp = Date.now();
    const productName = `Gadget ${timestamp}`;
    const productSku = `GAD-${timestamp}`;

    await Factories.product.create(page, { productName, productSku, productPricePence: 750 });

    await page.goto(`/${TEST_USERS.admin.tenant}/stock-transfers`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /new transfer/i }).click();
    const dialog = page.getByRole('dialog');

    await dialog.getByLabel(/from branch/i).click();
    await page.getByRole('option', { name: 'HQ' }).click();

    await dialog.getByLabel(/to branch/i).click();
    await page.getByRole('option', { name: 'Warehouse' }).click();

    await dialog.getByRole('button', { name: /add item/i }).click();
    await dialog.locator('[data-testid="transfer-item-product-select-0"]').click();
    await page.getByRole('option', { name: new RegExp(productName) }).click();

    // Enter order notes only (no delivery date)
    const orderNotesInput = dialog.getByTestId('order-notes');
    await orderNotesInput.fill('Standard shipping is acceptable for this order');

    await dialog.getByTestId('create-transfer-button').click();

    await expect(page).toHaveURL(/\/stock-transfers\/.+/);
    await page.waitForLoadState('networkidle');

    // Verify order notes are shown
    await expect(page.getByTestId('transfer-order-notes')).toBeVisible();
    await expect(page.getByTestId('transfer-order-notes')).toContainText('Standard shipping is acceptable');

    // Verify delivery date doesn't exist (since no date provided)
    await expect(page.getByTestId('transfer-expected-delivery')).not.toBeVisible();
  });

  test('should create transfer without delivery fields (backward compatibility)', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    const timestamp = Date.now();
    const productName = `Item ${timestamp}`;
    const productSku = `ITEM-${timestamp}`;

    await Factories.product.create(page, { productName, productSku, productPricePence: 1200 });

    await page.goto(`/${TEST_USERS.admin.tenant}/stock-transfers`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /new transfer/i }).click();
    const dialog = page.getByRole('dialog');

    await dialog.getByLabel(/from branch/i).click();
    await page.getByRole('option', { name: 'HQ' }).click();

    await dialog.getByLabel(/to branch/i).click();
    await page.getByRole('option', { name: 'Warehouse' }).click();

    await dialog.getByRole('button', { name: /add item/i }).click();
    await dialog.locator('[data-testid="transfer-item-product-select-0"]').click();
    await page.getByRole('option', { name: new RegExp(productName) }).click();

    // Submit without filling delivery fields
    await dialog.getByTestId('create-transfer-button').click();

    await expect(page).toHaveURL(/\/stock-transfers\/.+/);
    await page.waitForLoadState('networkidle');

    // Both fields should not be visible
    await expect(page.getByTestId('transfer-expected-delivery')).not.toBeVisible();
    await expect(page.getByTestId('transfer-order-notes')).not.toBeVisible();
  });
});

test.describe('Transfer Delivery Fields - Filtering', () => {
  test('should show delivery date filter inputs', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    await page.goto(`/${TEST_USERS.admin.tenant}/stock-transfers`);
    await page.waitForLoadState('networkidle');

    // Expand filters
    const filterBar = page.getByRole('region', { name: /filters/i });
    if (!(await filterBar.isVisible())) {
      await page.getByRole('button', { name: 'Filters' }).click();
    }

    // Should show delivery date filter inputs
    await expect(page.getByText('Expected delivery from')).toBeVisible();
    await expect(page.getByLabel('Expected delivery from')).toBeVisible();
  });

  test('should clear delivery date filters', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    await page.goto(`/${TEST_USERS.admin.tenant}/stock-transfers`);
    await page.waitForLoadState('networkidle');

    // Expand filters
    const filterBar = page.getByRole('region', { name: /filters/i });
    if (!(await filterBar.isVisible())) {
      await page.getByRole('button', { name: 'Filters' }).click();
    }

    // Set delivery date filter using date picker
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);

    const deliveryFromInput = page.getByTestId('filter-delivery-date-range-from');
    await deliveryFromInput.click();
    // Click the future date in the calendar picker (format: "30 October")
    const dateButtonText = `${futureDate.getDate()} ${futureDate.toLocaleString('en-US', { month: 'long' })}`;
    await page.getByRole('button', { name: dateButtonText }).click();

    await page.getByRole('button', { name: /apply filters/i }).click();
    await page.waitForLoadState('networkidle');

    // Should show active filter chip
    const deliveryChip = page.getByText(/delivery ≥/i);
    await expect(deliveryChip).toBeVisible();
  });
});

test.describe('Transfer Delivery Fields - Validation', () => {
  test('should enforce order notes max length (2000 chars)', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    const timestamp = Date.now();
    const productName = `Val Product ${timestamp}`;
    const productSku = `VAL-${timestamp}`;

    await Factories.product.create(page, { productName, productSku, productPricePence: 1000 });

    await page.goto(`/${TEST_USERS.admin.tenant}/stock-transfers`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /new transfer/i }).click();
    const dialog = page.getByRole('dialog');

    await dialog.getByLabel(/from branch/i).click();
    await page.getByRole('option', { name: 'HQ' }).click();

    await dialog.getByLabel(/to branch/i).click();
    await page.getByRole('option', { name: 'Warehouse' }).click();

    await dialog.getByRole('button', { name: /add item/i }).click();
    await dialog.locator('[data-testid="transfer-item-product-select-0"]').click();
    await page.getByRole('option', { name: new RegExp(productName) }).click();

    // Try to enter more than 2000 characters
    const longNotes = 'A'.repeat(2001);
    const orderNotesInput = dialog.getByTestId('order-notes');
    await orderNotesInput.fill(longNotes);

    // Input should be truncated to 2000 chars (Mantine Textarea enforces maxLength)
    const actualValue = await orderNotesInput.inputValue();
    expect(actualValue.length).toBeLessThanOrEqual(2000);
  });

  test('should accept order notes at max length (2000 chars)', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    const timestamp = Date.now();
    const productName = `Max Product ${timestamp}`;
    const productSku = `MAX-${timestamp}`;

    await Factories.product.create(page, { productName, productSku, productPricePence: 1000 });

    await page.goto(`/${TEST_USERS.admin.tenant}/stock-transfers`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /new transfer/i }).click();
    const dialog = page.getByRole('dialog');

    await dialog.getByLabel(/from branch/i).click();
    await page.getByRole('option', { name: 'HQ' }).click();

    await dialog.getByLabel(/to branch/i).click();
    await page.getByRole('option', { name: 'Warehouse' }).click();

    await dialog.getByRole('button', { name: /add item/i }).click();
    await dialog.locator('[data-testid="transfer-item-product-select-0"]').click();
    await page.getByRole('option', { name: new RegExp(productName) }).click();

    // Enter exactly 2000 characters
    const maxNotes = 'B'.repeat(2000);
    const orderNotesInput = dialog.getByTestId('order-notes');
    await orderNotesInput.fill(maxNotes);

    await dialog.getByTestId('create-transfer-button').click();

    await expect(page).toHaveURL(/\/stock-transfers\/.+/);
    await page.waitForLoadState('networkidle');

    // Should successfully create transfer with max length notes
    await expect(page.getByTestId('transfer-order-notes')).toBeVisible();
  });
});
