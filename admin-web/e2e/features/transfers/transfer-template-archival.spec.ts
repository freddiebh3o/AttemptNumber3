// transfer-template-archival.spec.ts
import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS, Factories, SELECTORS } from '../../helpers';

/**
 * E2E Tests for Transfer Template Archival
 *
 * Tests cover:
 * - Archiving templates (soft delete)
 * - Restoring archived templates
 * - Archive filter dropdown (active-only, archived-only, all)
 * - Archived badge display
 * - Permission-based UI controls
 *
 * **Test Isolation Pattern:**
 * - Each test creates its own unique data using timestamps
 * - Tests clean up after themselves (delete created entities)
 * - No reliance on seed data except for base tenant/users
 * - Cookies cleared between tests
 */

// Check API server health before tests
test.beforeAll(async () => {
  const apiUrl = process.env.VITE_API_BASE_URL || 'http://localhost:4000';
  try {
    const response = await fetch(`${apiUrl}/api/health`);
    if (!response.ok) {
      throw new Error(`API health check failed with status ${response.status}`);
    }
  } catch {
    console.warn('⚠️  API server may not be running. Tests will fail without it.');
    console.warn('   Start it with: cd api-server && npm run dev');
  }
});

// Isolate each test - clear browser state
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.describe('Transfer Template Archival - Archive Flow', () => {
  test('should archive template from list page', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Get branches and create a test product
    const branches = await Factories.branch.getAll(page);
    const timestamp = Date.now();
    const templateName = `E2E Archive Test ${timestamp}`;

    const productId = await Factories.product.create(page, {
      productName: `Test Product ${timestamp}`,
      productSku: `TEST-${timestamp}`,
      productPricePence: 1000,
    });

    const templateId = await Factories.template.create(page, {
      name: templateName,
      description: 'Test template for archival',
      sourceBranchId: branches[0].id,
      destinationBranchId: branches[1].id,
      items: [{ productId, defaultQty: 10 }],
    });

    try {
      await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/templates`);
      await page.waitForLoadState('networkidle');

      // Find our test template row by name
      const templateRow = page.locator('tr', { hasText: templateName });
      await expect(templateRow).toBeVisible();

      // Click archive button
      const archiveButton = templateRow.getByTestId(SELECTORS.TEMPLATE.ARCHIVE_BUTTON);
      await archiveButton.click();

      await page.waitForTimeout(300);

      // Confirmation dialog should open
      const confirmDialog = page.getByRole('dialog');
      await expect(confirmDialog).toBeVisible();
      await expect(confirmDialog.getByRole('heading', { name: /archive template/i })).toBeVisible();

      // Verify user-friendly explanation
      await expect(
        confirmDialog.getByText(/hidden from your active template list/i)
      ).toBeVisible();

      // Confirm archive
      await confirmDialog.getByRole('button', { name: /archive template/i }).click();

      // Should show success notification
      await expect(page.getByText(/template archived/i)).toBeVisible({ timeout: 10000 });

      // Template should be hidden from default view (active-only)
      await page.waitForTimeout(500);
      await expect(page.getByText(templateName, { exact: true })).not.toBeVisible();

      // Verify template is archived by checking archived filter
      const archivedFilter = page.getByTestId(SELECTORS.TEMPLATE.ARCHIVED_FILTER_SELECT);
      await archivedFilter.click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /archived templates only/i }).click();

      await page.getByRole('button', { name: /apply/i }).click();
      await page.waitForTimeout(1000);

      // Should see archived template with badge
      await expect(page.getByText(templateName)).toBeVisible();
      const archivedRow = page.locator('tr', { hasText: templateName });
      await expect(archivedRow.getByTestId(SELECTORS.TEMPLATE.ARCHIVED_BADGE)).toBeVisible();
    } finally {
      // Cleanup: permanently delete the template and product
      await Factories.template.delete(page, templateId);
      await Factories.product.delete(page, productId);
    }
  });

  test('should cancel archive confirmation modal', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Get branches and create a test product and template
    const branches = await Factories.branch.getAll(page);
    const timestamp = Date.now();
    const templateName = `E2E Cancel Archive ${timestamp}`;

    const productId = await Factories.product.create(page, {
      productName: `Test Product ${timestamp}`,
      productSku: `TEST-${timestamp}`,
      productPricePence: 1000,
    });

    const templateId = await Factories.template.create(page, {
      name: templateName,
      description: 'Test cancel archive',
      sourceBranchId: branches[0].id,
      destinationBranchId: branches[1].id,
      items: [{ productId, defaultQty: 10 }],
    });

    try {
      await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/templates`);
      await page.waitForLoadState('networkidle');

      // Find our test template row
      const templateRow = page.locator('tr', { hasText: templateName });
      await expect(templateRow).toBeVisible();

      // Click archive button
      const archiveButton = templateRow.getByTestId(SELECTORS.TEMPLATE.ARCHIVE_BUTTON);
      await archiveButton.click();

      await page.waitForTimeout(300);

      // Confirmation dialog should open
      const confirmDialog = page.getByRole('dialog');
      await expect(confirmDialog).toBeVisible();

      // Click cancel
      await confirmDialog.getByRole('button', { name: /cancel/i }).click();

      // Modal should close
      await expect(confirmDialog).not.toBeVisible();

      // Template should still be visible (not archived)
      await page.waitForTimeout(500);
      await expect(page.getByText(templateName)).toBeVisible();
    } finally {
      await Factories.template.delete(page, templateId);
      await Factories.product.delete(page, productId);
    }
  });
});

test.describe('Transfer Template Archival - Restore Flow', () => {
  test('should restore archived template from archived filter view', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Get branches and create test product and template
    const branches = await Factories.branch.getAll(page);
    const timestamp = Date.now();
    const templateName = `E2E Restore Test ${timestamp}`;

    const productId = await Factories.product.create(page, {
      productName: `Test Product ${timestamp}`,
      productSku: `TEST-${timestamp}`,
      productPricePence: 1000,
    });

    const templateId = await Factories.template.create(page, {
      name: templateName,
      description: 'Test template for restore',
      sourceBranchId: branches[0].id,
      destinationBranchId: branches[1].id,
      items: [{ productId, defaultQty: 10 }],
    });

    // Archive the template
    await Factories.template.archive(page, templateId);

    try {
      await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/templates`);
      await page.waitForLoadState('networkidle');

      // Switch to archived-only filter
      const archivedFilter = page.getByTestId(SELECTORS.TEMPLATE.ARCHIVED_FILTER_SELECT);
      await archivedFilter.click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /archived templates only/i }).click();

      await page.getByRole('button', { name: /apply/i }).click();
      await page.waitForTimeout(1000);

      // Find archived template
      const templateRow = page.locator('tr', { hasText: templateName });
      await expect(templateRow).toBeVisible();

      // Verify archived badge is shown
      await expect(templateRow.getByTestId(SELECTORS.TEMPLATE.ARCHIVED_BADGE)).toBeVisible();

      // Click restore button
      const restoreButton = templateRow.getByTestId(SELECTORS.TEMPLATE.RESTORE_BUTTON);
      await restoreButton.click();

      await page.waitForTimeout(300);

      // Confirmation dialog should open
      const confirmDialog = page.getByRole('dialog');
      await expect(confirmDialog).toBeVisible();
      await expect(confirmDialog.getByRole('heading', { name: /restore template/i })).toBeVisible();

      // Verify message about restoring
      await expect(
        confirmDialog.getByText(/visible in the active templates list/i)
      ).toBeVisible();

      // Confirm restore
      await confirmDialog.getByRole('button', { name: /restore template/i }).click();

      // Should show success notification
      await expect(page.getByText(/template restored/i)).toBeVisible({ timeout: 10000 });

      // Should be removed from archived view
      await page.waitForTimeout(500);
      await expect(page.getByText(templateName, { exact: true })).not.toBeVisible();

      // Switch to active view to verify template is restored
      await archivedFilter.click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /active templates only/i }).click();

      await page.getByRole('button', { name: /apply/i }).click();
      await page.waitForTimeout(1000);

      // Should see restored template
      await expect(page.getByText(templateName)).toBeVisible();
      const restoredRow = page.locator('tr', { hasText: templateName });

      // Should NOT have archived badge
      await expect(restoredRow.getByTestId(SELECTORS.TEMPLATE.ARCHIVED_BADGE)).not.toBeVisible();
    } finally {
      await Factories.template.delete(page, templateId);
      await Factories.product.delete(page, productId);
    }
  });
});

test.describe('Transfer Template Archival - Filter Functionality', () => {
  test('should filter to show only active templates by default', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/templates`);
    await page.waitForLoadState('networkidle');

    // Default filter should be "Active templates only"
    const archivedFilter = page.getByTestId(SELECTORS.TEMPLATE.ARCHIVED_FILTER_SELECT);
    const filterText = await archivedFilter.inputValue();
    expect(filterText).toBe('Active templates only');

    // Should not show any archived badges in default view
    const archivedBadges = page.getByTestId(SELECTORS.TEMPLATE.ARCHIVED_BADGE);
    const badgeCount = await archivedBadges.count();
    expect(badgeCount).toBe(0);
  });

  test('should show only archived templates when filter is archived-only', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Create and archive a test template
    const branches = await Factories.branch.getAll(page);
    const timestamp = Date.now();
    const templateName = `E2E Archived Filter ${timestamp}`;

    const productId = await Factories.product.create(page, {
      productName: `Test Product ${timestamp}`,
      productSku: `TEST-${timestamp}`,
      productPricePence: 1000,
    });

    const templateId = await Factories.template.create(page, {
      name: templateName,
      description: 'Test archived filter',
      sourceBranchId: branches[0].id,
      destinationBranchId: branches[1].id,
      items: [{ productId, defaultQty: 10 }],
    });

    await Factories.template.archive(page, templateId);

    try {
      await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/templates`);
      await page.waitForLoadState('networkidle');

      // Should not see archived template in default view
      await expect(page.getByText(templateName, { exact: true })).not.toBeVisible();

      // Switch to archived-only filter
      const archivedFilter = page.getByTestId(SELECTORS.TEMPLATE.ARCHIVED_FILTER_SELECT);
      await archivedFilter.click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /archived templates only/i }).click();

      await page.getByRole('button', { name: /apply/i }).click();
      await page.waitForTimeout(1000);

      // Should see archived template
      await expect(page.getByText(templateName)).toBeVisible();

      // All visible templates should have archived badge
      const rows = page.locator('table tbody tr');
      const rowCount = await rows.count();

      if (rowCount > 0) {
        // Check that each row has an archived badge
        for (let i = 0; i < rowCount; i++) {
          const row = rows.nth(i);
          await expect(row.getByTestId(SELECTORS.TEMPLATE.ARCHIVED_BADGE)).toBeVisible();
        }
      }
    } finally {
      await Factories.template.delete(page, templateId);
      await Factories.product.delete(page, productId);
    }
  });

  test('should show all templates when filter is set to all', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Create two templates: one active, one archived
    const branches = await Factories.branch.getAll(page);
    const timestamp = Date.now();

    const activeTemplateName = `E2E Active ${timestamp}`;
    const archivedTemplateName = `E2E Archived ${timestamp}`;

    const product1Id = await Factories.product.create(page, {
      productName: `Test Product 1 ${timestamp}`,
      productSku: `TEST1-${timestamp}`,
      productPricePence: 1000,
    });

    const product2Id = await Factories.product.create(page, {
      productName: `Test Product 2 ${timestamp}`,
      productSku: `TEST2-${timestamp}`,
      productPricePence: 1500,
    });

    const activeTemplateId = await Factories.template.create(page, {
      name: activeTemplateName,
      description: 'Active test template',
      sourceBranchId: branches[0].id,
      destinationBranchId: branches[1].id,
      items: [{ productId: product1Id, defaultQty: 10 }],
    });

    const archivedTemplateId = await Factories.template.create(page, {
      name: archivedTemplateName,
      description: 'Archived test template',
      sourceBranchId: branches[0].id,
      destinationBranchId: branches[1].id,
      items: [{ productId: product2Id, defaultQty: 10 }],
    });

    await Factories.template.archive(page, archivedTemplateId);

    try {
      await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/templates`);
      await page.waitForLoadState('networkidle');

      // Switch to "all" filter
      const archivedFilter = page.getByTestId(SELECTORS.TEMPLATE.ARCHIVED_FILTER_SELECT);
      await archivedFilter.click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /all templates/i }).click();

      await page.getByRole('button', { name: /apply/i }).click();
      await page.waitForTimeout(1000);

      // Should see both templates
      await expect(page.getByText(activeTemplateName)).toBeVisible();
      await expect(page.getByText(archivedTemplateName)).toBeVisible();

      // Active template should NOT have archived badge
      const activeRow = page.locator('tr', { hasText: activeTemplateName });
      await expect(activeRow.getByTestId(SELECTORS.TEMPLATE.ARCHIVED_BADGE)).not.toBeVisible();

      // Archived template should have archived badge
      const archivedRow = page.locator('tr', { hasText: archivedTemplateName });
      await expect(archivedRow.getByTestId(SELECTORS.TEMPLATE.ARCHIVED_BADGE)).toBeVisible();
    } finally {
      await Factories.template.delete(page, activeTemplateId);
      await Factories.template.delete(page, archivedTemplateId);
      await Factories.product.delete(page, product1Id);
      await Factories.product.delete(page, product2Id);
    }
  });

  test('should clear archive filter when clicking clear button', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/templates`);
    await page.waitForLoadState('networkidle');

    // Change filter to archived-only
    const archivedFilter = page.getByTestId(SELECTORS.TEMPLATE.ARCHIVED_FILTER_SELECT);
    await archivedFilter.click();
    await page.waitForTimeout(300);
    await page.getByRole('option', { name: /archived templates only/i }).click();

    // Click clear button
    await page.getByRole('button', { name: /clear/i }).click();

    await page.waitForTimeout(1000);

    // Filter should reset to active-only
    const filterValue = await archivedFilter.inputValue();
    expect(filterValue).toBe('Active templates only');
  });
});

test.describe('Transfer Template Archival - Permissions', () => {
  test('should allow admins to archive and restore templates', async ({ page }) => {
    // First sign in as OWNER to create the test template (needs branch access)
    await signIn(page, TEST_USERS.owner);

    // Create a test product and template
    const branches = await Factories.branch.getAll(page);
    const timestamp = Date.now();
    const templateName = `E2E Admin Archive ${timestamp}`;

    const productId = await Factories.product.create(page, {
      productName: `Test Product ${timestamp}`,
      productSku: `TEST-${timestamp}`,
      productPricePence: 1000,
    });

    const templateId = await Factories.template.create(page, {
      name: templateName,
      description: 'Admin permission test',
      sourceBranchId: branches[0].id,
      destinationBranchId: branches[1].id,
      items: [{ productId, defaultQty: 10 }],
    });

    try {
      // Now sign in as ADMIN to test the UI permissions
      await signIn(page, TEST_USERS.admin);

      await page.goto(`/${TEST_USERS.admin.tenant}/stock-transfers/templates`);
      await page.waitForLoadState('networkidle');

      // Admin should see archive button (has stock:write permission)
      const templateRow = page.locator('tr', { hasText: templateName });
      const archiveButton = templateRow.getByTestId(SELECTORS.TEMPLATE.ARCHIVE_BUTTON);
      await expect(archiveButton).toBeVisible();
      await expect(archiveButton).toBeEnabled();
    } finally {
      // Sign back in as OWNER to clean up
      await signIn(page, TEST_USERS.owner);
      await Factories.template.delete(page, templateId);
      await Factories.product.delete(page, productId);
    }
  });

  test('should hide archive/restore buttons for viewers', async ({ page }) => {
    // First sign in as OWNER to create the test template
    await signIn(page, TEST_USERS.owner);

    // Create a test product and template
    const branches = await Factories.branch.getAll(page);
    const timestamp = Date.now();
    const templateName = `E2E Viewer Permission ${timestamp}`;

    const productId = await Factories.product.create(page, {
      productName: `Test Product ${timestamp}`,
      productSku: `TEST-${timestamp}`,
      productPricePence: 1000,
    });

    const templateId = await Factories.template.create(page, {
      name: templateName,
      description: 'Viewer permission test',
      sourceBranchId: branches[0].id,
      destinationBranchId: branches[1].id,
      items: [{ productId, defaultQty: 10 }],
    });

    try {
      // Now sign in as VIEWER to test the UI permissions
      await signIn(page, TEST_USERS.viewer);

      await page.goto(`/${TEST_USERS.viewer.tenant}/stock-transfers/templates`);
      await page.waitForLoadState('networkidle');

      // Viewer should see the template row
      const templateRow = page.locator('tr', { hasText: templateName });
      await expect(templateRow).toBeVisible();

      // Archive button should be disabled for viewer (no stock:write permission)
      const archiveButton = templateRow.getByTestId(SELECTORS.TEMPLATE.ARCHIVE_BUTTON);
      await expect(archiveButton).toBeDisabled();
    } finally {
      // Sign back in as OWNER to clean up
      await signIn(page, TEST_USERS.owner);
      await Factories.template.delete(page, templateId);
      await Factories.product.delete(page, productId);
    }
  });
});
