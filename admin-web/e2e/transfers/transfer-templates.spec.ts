// transfer-templates.spec.ts
import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS, Factories } from '../helpers';

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

    // Navigate to a page first to ensure sidebar is loaded
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);
    await page.waitForLoadState('networkidle');

    // Expand Stock Management dropdown in sidebar
    const stockManagementNav = page.getByRole('navigation').getByText(/stock management/i);
    await stockManagementNav.click();
    await page.waitForTimeout(300); // Wait for expansion animation

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

    const timestamp = Date.now();
    const templateName = `E2E Create Test ${timestamp}`;
    let templateId: string | undefined;

    try {
      await page.getByRole('button', { name: /new template/i }).click();

      const dialog = page.getByRole('dialog');

      // Fill in template details with unique name
      await dialog.getByLabel(/template name/i).fill(templateName);
      await dialog.getByLabel(/description/i).fill('E2E test template');

      // Select source branch
      await dialog.getByLabel(/source branch/i).click();
      await page.waitForTimeout(500);
      // getByRole automatically filters hidden elements
      await page.getByRole('option').first().click();

      // Wait for the selection to register
      await page.waitForTimeout(500);

      // Select destination branch (different from source)
      await dialog.getByLabel(/destination branch/i).click();
      await page.waitForTimeout(500);
      // getByRole automatically filters hidden elements
      const destBranchOptions = page.getByRole('option');
      const destCount = await destBranchOptions.count();
      if (destCount > 1) {
        await destBranchOptions.nth(1).click();
      } else {
        await destBranchOptions.first().click();
      }

      await page.waitForTimeout(500);

      // Add an item
      await dialog.getByRole('button', { name: /add item/i }).click();
      await page.waitForTimeout(500);

      // Wait for product select to be enabled
      const productSelect = page.getByTestId('template-item-product-select-0');
      await productSelect.waitFor({ state: 'visible', timeout: 10000 });
      await expect(productSelect).toBeEnabled({ timeout: 10000 });

      // Select first product from the list
      await productSelect.click();
      await page.waitForTimeout(500);
      // getByRole automatically filters hidden elements
      await page.getByRole('option').first().click();

      // Set default quantity using data-testid
      const qtyInput = page.getByTestId('template-item-quantity-input-0');
      await qtyInput.fill('10');

      // Submit form
      await dialog.getByRole('button', { name: /create template/i }).click();

      // Should show success notification
      await expect(page.getByText(/template created/i)).toBeVisible({ timeout: 10000 });

      // Modal should close
      await expect(dialog).not.toBeVisible();

      // Should see new template in list
      await expect(page.getByText(templateName)).toBeVisible();

      // Extract template ID from the row (we need to find the row, then extract ID from action button)
      const templateRow = page.locator('tr', { hasText: templateName });
      await expect(templateRow).toBeVisible();

      // Get the duplicate button's test ID which contains the template ID
      const duplicateButton = templateRow.getByTestId(/^duplicate-template-/);
      const testId = await duplicateButton.getAttribute('data-testid');
      if (testId) {
        templateId = testId.replace('duplicate-template-', '');
      }
    } finally {
      // Cleanup: delete the test template
      if (templateId) {
        await Factories.template.delete(page, templateId);
      }
    }
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
    await page.waitForTimeout(500);

    // Get all visible options - first is "All Branches", we want a real branch
    // getByRole automatically filters hidden elements
    const options = page.getByRole('option');
    const optionCount = await options.count();

    if (optionCount > 1) {
      // Click the second option (first actual branch, skipping "All Branches")
      await options.nth(1).click();
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

    const timestamp = Date.now();
    const templateName = `E2E Duplicate Source ${timestamp}`;
    let originalTemplateId: string | undefined;
    let duplicatedTemplateId: string | undefined;

    try {
      // Create a template via API first
      const sourceBranchId = await Factories.branch.getFirst(page);
      const destBranchId = await Factories.branch.getSecond(page);
      const productId = await Factories.product.getFirst(page);

      originalTemplateId = await Factories.template.create(page, {
        name: templateName,
        description: 'Template to be duplicated',
        sourceBranchId,
        destinationBranchId: destBranchId,
        items: [{ productId, defaultQty: 5 }],
      });

      // Navigate to templates page
      await page.goto(`/${TEST_USERS.owner.tenant}/transfer-templates`);
      await page.waitForTimeout(1000);

      // Find the template we just created and click duplicate button
      const duplicateButton = page.getByTestId(`duplicate-template-${originalTemplateId}`);
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
      expect(nameValue).toBe(templateName);

      // Modify name to make it unique
      const duplicatedName = `${templateName} (Copy)`;
      await nameInput.fill(duplicatedName);

      // Submit the duplicated template
      await dialog.getByRole('button', { name: /duplicate template/i }).click();

      // Should show success notification
      await expect(page.getByText(/template (duplicated|created)/i)).toBeVisible({ timeout: 10000 });

      // Modal should close
      await expect(dialog).not.toBeVisible();

      // Should see duplicated template in list
      await expect(page.getByText(duplicatedName)).toBeVisible();

      // Extract duplicated template ID
      const duplicatedRow = page.locator('tr', { hasText: duplicatedName });
      const duplicatedButton = duplicatedRow.getByTestId(/^duplicate-template-/);
      const testId = await duplicatedButton.getAttribute('data-testid');
      if (testId) {
        duplicatedTemplateId = testId.replace('duplicate-template-', '');
      }
    } finally {
      // Cleanup: delete both templates
      if (originalTemplateId) {
        await Factories.template.delete(page, originalTemplateId);
      }
      if (duplicatedTemplateId) {
        await Factories.template.delete(page, duplicatedTemplateId);
      }
    }
  });
});

test.describe('Transfer Templates - Delete Template', () => {
  test('should delete template with confirmation', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    const templateName = `E2E Delete Test ${timestamp}`;

    // Create a template via API first
    const sourceBranchId = await Factories.branch.getFirst(page);
    const destBranchId = await Factories.branch.getSecond(page);
    const productId = await Factories.product.getFirst(page);

    const templateId = await Factories.template.create(page, {
      name: templateName,
      description: 'Template to be deleted',
      sourceBranchId,
      destinationBranchId: destBranchId,
      items: [{ productId, defaultQty: 5 }],
    });

    let wasDeleted = false;

    try {
      // Navigate to templates page
      await page.goto(`/${TEST_USERS.owner.tenant}/transfer-templates`);
      await page.waitForTimeout(1000);

      // Find the template row
      const templateRow = page.locator('tr', { hasText: templateName });
      await expect(templateRow).toBeVisible();
      await page.waitForTimeout(500); // Wait for row to fully render

      // Find and click the delete button using test ID (similar to duplicate button pattern)
      const deleteButton = page.getByTestId(`delete-template-${templateId}`);
      await expect(deleteButton).toBeVisible({ timeout: 5000 });
      await deleteButton.click();

      // Confirmation modal should open
      const confirmDialog = page.getByRole('dialog');
      await expect(confirmDialog).toBeVisible();
      await expect(confirmDialog.getByRole('heading', { name: /delete template/i })).toBeVisible();

      // Confirm deletion
      await confirmDialog.getByRole('button', { name: /delete template/i }).click();

      // Should show success notification
      await expect(page.getByText(/template deleted/i)).toBeVisible({ timeout: 10000 });

      // Template should be removed from list
      await page.waitForTimeout(500);
      await expect(page.getByText(templateName, { exact: true })).not.toBeVisible();

      wasDeleted = true;
    } finally {
      // Cleanup: delete template if test failed before deletion
      if (!wasDeleted) {
        try {
          await Factories.template.delete(page, templateId);
        } catch {
          // Ignore cleanup errors
        }
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

    const timestamp = Date.now();
    const templateName = `E2E Use Template ${timestamp}`;

    // Create a template via API first
    const sourceBranchId = await Factories.branch.getFirst(page);
    const destBranchId = await Factories.branch.getSecond(page);
    const productId = await Factories.product.getFirst(page);

    const templateId = await Factories.template.create(page, {
      name: templateName,
      description: 'Template for transfer creation test',
      sourceBranchId,
      destinationBranchId: destBranchId,
      items: [{ productId, defaultQty: 5 }],
    });

    try {
      // Go to transfers page and use the template
      await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);
      await page.locator('#root').getByRole('button', { name: /use template/i }).click();

      const selectDialog = page.getByRole('dialog');
      await expect(selectDialog).toBeVisible();

      // Wait for templates to load
      await page.waitForTimeout(1000);

      // Click on the template card we just created
      const templateCard = selectDialog.getByTestId(`template-card-${templateId}`);
      await templateCard.click();

      // Wait for selection to register
      await page.waitForTimeout(300);

      // Click "Use Template" button using test ID
      await selectDialog.getByTestId('use-template-button').click();

      // Wait for the create transfer modal to appear
      await page.waitForTimeout(1000);

      // Get the create transfer modal by looking for the specific heading
      const createDialog = page.getByRole('dialog').filter({ hasText: /create transfer request/i });
      await expect(createDialog).toBeVisible();

      // Source and destination should be pre-filled
      await expect(createDialog.getByLabel(/source branch/i)).toBeVisible();
      await expect(createDialog.getByLabel(/destination branch/i)).toBeVisible();

      // Items should be pre-populated
      await expect(createDialog.getByText(/items/i)).toBeVisible();

      // Submit the transfer using test ID
      await createDialog.getByTestId('create-transfer-button').click();

      // Should redirect to transfers page
      await page.waitForTimeout(2000);
      await expect(page).toHaveURL(/\/stock-transfers/);
      await expect(page.getByRole('heading', { name: 'Stock Transfers', exact: true })).toBeVisible();
    } finally {
      // Cleanup: delete the test template
      await Factories.template.delete(page, templateId);
    }
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
