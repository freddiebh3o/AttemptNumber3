// admin-web/e2e/transfer-templates.spec.ts
import { test, expect, type Page } from '@playwright/test';

/**
 * E2E Tests for Stock Transfer Templates
 *
 * Tests cover:
 * - Creating templates with name, description, and items
 * - Listing and filtering templates
 * - Duplicating templates
 * - Deleting templates
 * - Using templates to create transfers (pre-fill workflow)
 */

// Test credentials from api-server/prisma/seed.ts
const TEST_USERS = {
  owner: { email: 'owner@acme.test', password: 'Password123!', tenant: 'acme' },
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

  // Wait a bit for auth store to populate with branch memberships
  await page.waitForTimeout(500);
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

// Isolate each test - clear browser state
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.describe('Transfer Templates - List and Navigation', () => {
  test('should navigate to templates page from sidebar', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Click on Stock Management group in sidebar (if collapsed)
    const stockManagementNav = page.getByRole('navigation').getByText(/stock management/i);
    if (await stockManagementNav.isVisible()) {
      await stockManagementNav.click();
    }

    // Click on Transfer Templates link
    await page.getByRole('link', { name: /transfer templates/i }).click();

    // Should navigate to templates page
    await expect(page).toHaveURL(/\/transfer-templates/);
    await expect(page.getByRole('heading', { name: /transfer templates/i })).toBeVisible();
  });

  test('should display templates table', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/transfer-templates`);

    // Wait for page to load
    await page.waitForTimeout(1000);

    // Should show table headers (Mantine Table uses cells for headers, not columnheaders)
    // Use .first() to select header cells when text might appear in data rows too
    await expect(page.getByRole('cell', { name: /^template name$/i }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: /^route$/i }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: /^items$/i }).first()).toBeVisible();
  });

  test('should show New Template button for editors', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);
    await page.goto(`/${TEST_USERS.editor.tenant}/transfer-templates`);

    await expect(page.getByRole('button', { name: /new template/i })).toBeVisible();
  });
});

test.describe('Transfer Templates - Create Template', () => {
  test('should open create template modal', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/transfer-templates`);

    // Click New Template button
    await page.getByRole('button', { name: /new template/i }).click();

    // Modal should open
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/create template/i)).toBeVisible();

    // Should show form fields
    await expect(dialog.getByLabel(/template name/i)).toBeVisible();
    await expect(dialog.getByLabel(/description/i)).toBeVisible();
    await expect(dialog.getByLabel(/source branch/i)).toBeVisible();
    await expect(dialog.getByLabel(/destination branch/i)).toBeVisible();
  });

  test('should create template with products', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/transfer-templates`);

    await page.getByRole('button', { name: /new template/i }).click();

    const dialog = page.getByRole('dialog');

    // Fill in template details
    await dialog.getByLabel(/template name/i).fill('Weekly Restock Template');
    await dialog.getByLabel(/description/i).fill('Standard weekly transfer from warehouse to store');

    // Select source branch
    await dialog.getByLabel(/source branch/i).click();
    await page.waitForTimeout(500);
    const sourceBranchOptions = page.locator('[role="option"]');
    const firstSourceOption = sourceBranchOptions.first();
    await firstSourceOption.click({ force: true });

    // Wait for the selection to register
    await page.waitForTimeout(500);

    // Select destination branch (different from source)
    await dialog.getByLabel(/destination branch/i).click();
    await page.waitForTimeout(500);
    const destBranchOptions = page.locator('[role="option"]');
    const destCount = await destBranchOptions.count();
    if (destCount > 1) {
      await destBranchOptions.nth(1).click({ force: true });
    } else {
      await destBranchOptions.first().click({ force: true });
    }

    await page.waitForTimeout(500);

    // Add a product
    await dialog.getByRole('button', { name: /add product/i }).click();
    await page.waitForTimeout(500);

    // Select first product from the list
    const productSelect = dialog.locator('[role="combobox"]').first();
    await productSelect.click();
    await page.waitForTimeout(500);
    const productOptions = page.locator('[role="option"]');
    await productOptions.first().click({ force: true });

    // Set default quantity
    const qtyInput = dialog.getByLabel(/default quantity/i).first();
    await qtyInput.fill('10');

    // Submit form
    await dialog.getByRole('button', { name: /create template/i }).click();

    // Should show success notification
    await expect(page.getByText(/template created/i)).toBeVisible({ timeout: 10000 });

    // Modal should close
    await expect(dialog).not.toBeVisible();

    // Should see new template in list
    await expect(page.getByText(/weekly restock template/i)).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/transfer-templates`);

    await page.getByRole('button', { name: /new template/i }).click();

    const dialog = page.getByRole('dialog');

    // Try to submit without filling required fields
    await dialog.getByRole('button', { name: /create template/i }).click();

    // Wait a bit for validation to run
    await page.waitForTimeout(500);

    // Should show validation errors (form shouldn't submit)
    await expect(dialog).toBeVisible();
  });
});

test.describe('Transfer Templates - Search and Filter', () => {
  test('should search templates by name', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/transfer-templates`);

    // Wait for table to load
    await page.waitForTimeout(1000);

    // Type in search box
    const searchInput = page.getByPlaceholder(/search by name/i);
    await searchInput.fill('Weekly');

    // Click Apply Filters button to trigger the search
    await page.getByRole('button', { name: /apply filters/i }).click();

    // Wait for URL to update
    await page.waitForTimeout(500);

    // URL should have search parameter
    await expect(page).toHaveURL(/q=Weekly/);
  });

  test('should filter by source branch', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/transfer-templates`);

    await page.waitForTimeout(1000);

    // The filters are inline on the page, not in a dialog
    // Click on the source branch select to open dropdown
    const sourceBranchSelect = page.getByLabel(/source branch/i).first();
    await sourceBranchSelect.click();
    await page.waitForTimeout(300);

    // Wait for options to appear
    await page.waitForSelector('[role="option"]', { state: 'visible' });

    // Get all options - first is "All Branches", we want a real branch
    const options = page.locator('[role="option"]');
    const optionCount = await options.count();

    if (optionCount > 1) {
      // Click the second option (first actual branch, skipping "All Branches")
      const targetOption = options.nth(1);
      await targetOption.scrollIntoViewIfNeeded();
      await targetOption.click({ force: true });
      await page.waitForTimeout(500);

      // Click Apply Filters button
      await page.getByRole('button', { name: /apply filters/i }).click();

      // Wait for URL to update and page to reload
      await page.waitForTimeout(1000);

      // URL should have source branch filter parameter
      await expect(page).toHaveURL(/sourceBranchId=/);
    }
  });
});

test.describe('Transfer Templates - Duplicate Template', () => {
  test('should duplicate existing template', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/transfer-templates`);

    await page.waitForTimeout(1000);

    // Check if there are any templates
    const rowCount = await page.locator('table tbody tr').count();
    if (rowCount > 0) {
      // Click the duplicate button (first template)
      const duplicateButton = page.getByTestId(/^duplicate-template-/).first();
      await duplicateButton.click();

      // Wait for modal animation
      await page.waitForTimeout(500);

      // Duplicate template modal should open with pre-filled data
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(/duplicate transfer template/i)).toBeVisible();

      // Should have pre-filled template name
      const nameInput = dialog.getByLabel(/template name/i);
      await expect(nameInput).toBeVisible();
      const nameValue = await nameInput.inputValue();
      expect(nameValue.length).toBeGreaterThan(0);

      // Modify name to make it unique
      await nameInput.fill(`${nameValue} (Copy)`);

      // Submit the duplicated template
      await dialog.getByRole('button', { name: /duplicate template/i }).click();

      // Should show success notification
      await expect(page.getByText(/template (duplicated|created)/i)).toBeVisible({ timeout: 10000 });

      // Modal should close
      await expect(dialog).not.toBeVisible();
    }
  });
});

test.describe('Transfer Templates - Delete Template', () => {
  test('should delete template with confirmation', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/transfer-templates`);

    await page.waitForTimeout(1000);

    // Check if there are any templates
    const rowCount = await page.locator('table tbody tr').count();
    if (rowCount > 0) {
      // Find first template's action menu
      const firstRow = page.locator('table tbody tr').first();
      const templateName = await firstRow.locator('td').nth(0).textContent();
      const lastCell = firstRow.locator('td').last();
      const actionsButton = lastCell.locator('button[aria-label*="enu"], button[aria-haspopup="menu"]').first();
      await actionsButton.click();

      // Click Delete option
      await page.getByRole('menuitem', { name: /delete/i }).click();

      // Confirmation modal should open
      const confirmDialog = page.getByRole('dialog');
      await expect(confirmDialog).toBeVisible();
      await expect(confirmDialog.getByText(/confirm deletion/i)).toBeVisible();

      // Confirm deletion
      await confirmDialog.getByRole('button', { name: /delete/i }).click();

      // Should show success notification
      await expect(page.getByText(/template deleted/i)).toBeVisible({ timeout: 10000 });

      // Template should be removed from list
      await page.waitForTimeout(500);
      if (templateName) {
        await expect(page.getByText(templateName, { exact: true })).not.toBeVisible();
      }
    }
  });
});

test.describe('Transfer Templates - Use Template to Create Transfer', () => {
  test('should open template selector from transfers page', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);

    // Click Use Template button (scope to main page, not in a dialog)
    await page.locator('#root').getByRole('button', { name: /use template/i }).click();

    // Wait for modal animation to complete
    await page.waitForTimeout(500);

    // Template selector modal should open - use heading for more specific match
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /select transfer template/i })).toBeVisible();
  });

  test('should filter templates in selector', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);

    await page.locator('#root').getByRole('button', { name: /use template/i }).click();

    const dialog = page.getByRole('dialog');

    // Type in search
    const searchInput = dialog.getByPlaceholder(/search/i);
    await searchInput.fill('Weekly');

    await page.waitForTimeout(500);

    // Should filter visible templates (if any match)
    // Note: Actual filtering depends on what templates exist in the database
  });

  test('should create transfer from template', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // First, ensure we have a template
    await page.goto(`/${TEST_USERS.owner.tenant}/transfer-templates`);
    await page.waitForTimeout(1000);

    // Check if templates exist, if not create one
    const hasTemplates = await page.locator('table tbody tr').count() > 0;

    if (!hasTemplates) {
      // Create a template first
      await page.getByRole('button', { name: /new template/i }).click();
      const createDialog = page.getByRole('dialog');

      await createDialog.getByLabel(/template name/i).fill('E2E Test Template');
      await createDialog.getByLabel(/description/i).fill('Template for E2E testing');

      await createDialog.getByLabel(/source branch/i).click();
      await page.waitForTimeout(300);
      await page.locator('[role="option"]').first().click();

      await page.waitForTimeout(300);
      await createDialog.getByLabel(/destination branch/i).click();
      await page.waitForTimeout(300);
      const destOptions = page.locator('[role="option"]');
      const destCount = await destOptions.count();
      if (destCount > 1) {
        await destOptions.nth(1).click();
      } else {
        await destOptions.first().click();
      }

      await page.waitForTimeout(300);
      await createDialog.getByRole('button', { name: /add product/i }).click();
      await page.waitForTimeout(300);

      const productSelect = createDialog.locator('[role="combobox"]').first();
      await productSelect.click();
      await page.waitForTimeout(300);
      await page.locator('[role="option"]').first().click();

      const qtyInput = createDialog.getByLabel(/default quantity/i).first();
      await qtyInput.fill('5');

      await createDialog.getByRole('button', { name: /create template/i }).click();
      await expect(page.getByText(/template created/i)).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(500);
    }

    // Now go to transfers page and use the template
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);
    await page.locator('#root').getByRole('button', { name: /use template/i }).click();

    const selectDialog = page.getByRole('dialog');
    await expect(selectDialog).toBeVisible();

    // Wait for templates to load
    await page.waitForTimeout(1000);

    // Click on first template card using test ID
    const firstTemplate = selectDialog.getByTestId(/^template-card-/).first();
    await firstTemplate.click();

    // Wait for selection to register
    await page.waitForTimeout(300);

    // Click "Use Template" button using test ID
    await selectDialog.getByTestId('use-template-button').click();

    // Wait for the create transfer modal to appear (don't wait for select modal to close)
    await page.waitForTimeout(1000);

    // Get the create transfer modal by looking for the specific heading
    const createDialog = page.getByRole('dialog').filter({ hasText: /create transfer request/i });
    await expect(createDialog).toBeVisible();

    // Source and destination should be pre-filled (can't easily verify values, but fields should exist)
    await expect(createDialog.getByLabel(/source branch/i)).toBeVisible();
    await expect(createDialog.getByLabel(/destination branch/i)).toBeVisible();

    // Items should be pre-populated (check for items section)
    await expect(createDialog.getByText(/items/i)).toBeVisible();

    // Submit the transfer using test ID
    await createDialog.getByTestId('create-transfer-button').click();

    // Should redirect - either to detail page or back to list
    await page.waitForTimeout(2000);

    // Check that we're no longer on the create modal and are on a stock transfers page
    await expect(page).toHaveURL(/\/stock-transfers/);

    // Verify we can see the stock transfers page heading (use exact match to avoid multiple matches)
    await expect(page.getByRole('heading', { name: 'Stock Transfers', exact: true })).toBeVisible();
  });
});

test.describe('Transfer Templates - Permissions', () => {
  test('should hide New Template button for viewers', async ({ page }) => {
    await signIn(page, TEST_USERS.viewer);
    await page.goto(`/${TEST_USERS.viewer.tenant}/transfer-templates`);

    // Viewer should not see New Template button (stock:write permission required)
    await expect(page.getByRole('button', { name: /new template/i })).not.toBeVisible();
  });

  test('should hide action menus for viewers', async ({ page }) => {
    await signIn(page, TEST_USERS.viewer);
    await page.goto(`/${TEST_USERS.viewer.tenant}/transfer-templates`);

    await page.waitForTimeout(1000);

    // Viewer should not see Actions button (stock:write permission required)
    await expect(page.getByRole('button', { name: /actions/i })).not.toBeVisible();
  });
});
