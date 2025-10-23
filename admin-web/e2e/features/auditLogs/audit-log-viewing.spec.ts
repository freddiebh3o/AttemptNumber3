import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS, Factories } from '../../helpers';

// Health check
test.beforeAll(async () => {
  const apiUrl = process.env.VITE_API_BASE_URL || 'http://localhost:4000';
  try {
    const response = await fetch(`${apiUrl}/api/health`);
    if (!response.ok) throw new Error(`API health check failed`);
  } catch (error) {
    console.warn('⚠️  API server may not be running. Tests will fail without it.');
    console.warn('   Start it with: cd api-server && npm run dev:e2e');
  }
});

// Clear cookies
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.describe('Audit Logs - Viewing', () => {
  test.describe('Page Navigation and Load', () => {
    test('should navigate to audit logs page', async ({ page }) => {
      await signIn(page, TEST_USERS.owner);

      // Navigate to audit logs page
      await page.goto(`/${TEST_USERS.owner.tenant}/audit`);
      await page.waitForLoadState('networkidle');

      // Verify page heading
      await expect(page.getByRole('heading', { name: /audit log/i })).toBeVisible();

      // Verify key elements are present
      await expect(page.getByRole('button', { name: /^filters$/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /refresh/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /copy link/i })).toBeVisible();
    });

    test('should display audit log table with columns', async ({ page }) => {
      await signIn(page, TEST_USERS.owner);

      await page.goto(`/${TEST_USERS.owner.tenant}/audit`);
      await page.waitForLoadState('networkidle');

      // Wait for table to load
      await expect(page.locator('table')).toBeVisible();

      // Verify column headers
      await expect(page.getByRole('columnheader', { name: /occurred/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /^actor$/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /^entity$/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /^action$/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /diff/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /correlation/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /^ip$/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /user-agent/i })).toBeVisible();
    });

    test('should display range information', async ({ page }) => {
      await signIn(page, TEST_USERS.owner);

      await page.goto(`/${TEST_USERS.owner.tenant}/audit`);
      await page.waitForLoadState('networkidle');

      // Verify range text is displayed (e.g., "Showing 1–20 of 50")
      // Use the one in the header (not the pagination footer)
      const rangeText = page.getByText(/showing \d+–\d+/i).first();
      await expect(rangeText).toBeVisible();
    });
  });

  test.describe('Filtering', () => {
    test('should filter by entity type', async ({ page }) => {
      await signIn(page, TEST_USERS.owner);

      // Create a product to generate audit events
      const productId = await Factories.product.create(page, {
        productName: `Audit Test Product ${Date.now()}`,
        productSku: `AUDIT-${Date.now()}`,
        productPricePence: 1000,
      });

      try {
        await page.goto(`/${TEST_USERS.owner.tenant}/audit`);
        await page.waitForLoadState('networkidle');

        // Open filters
        await page.getByRole('button', { name: /^filters$/i }).click();

        // Select PRODUCT entity type
        const entityTypeInput = page.getByRole('textbox', { name: /entity type/i });
        await entityTypeInput.click();
        await page.getByRole('option', { name: 'PRODUCT', exact: true }).click();

        // Apply filters
        await page.getByRole('button', { name: /apply filters/i }).click();
        await page.waitForLoadState('networkidle');

        // Verify filter chip is displayed
        await expect(page.getByText(/entity: PRODUCT/i)).toBeVisible();

        // Verify table shows only PRODUCT entities
        const table = page.locator('table');
        await expect(table).toBeVisible();

        // Check that table rows contain PRODUCT entity type
        const firstRow = table.locator('tbody tr').first();
        if (await firstRow.isVisible()) {
          await expect(firstRow.getByText(/PRODUCT/)).toBeVisible();
        }
      } finally {
        await Factories.product.delete(page, productId);
      }
    });

    test('should filter by action type', async ({ page }) => {
      await signIn(page, TEST_USERS.owner);

      // Create a product to generate CREATE audit event
      const productId = await Factories.product.create(page, {
        productName: `Action Filter Test ${Date.now()}`,
        productSku: `ACT-${Date.now()}`,
        productPricePence: 1000,
      });

      try {
        await page.goto(`/${TEST_USERS.owner.tenant}/audit`);
        await page.waitForLoadState('networkidle');

        // Open filters
        await page.getByRole('button', { name: /^filters$/i }).click();

        // Select CREATE action
        const actionInput = page.getByRole('textbox', { name: /^action$/i });
        await actionInput.click();
        await page.getByRole('option', { name: 'CREATE', exact: true }).click();

        // Apply filters
        await page.getByRole('button', { name: /apply filters/i }).click();
        await page.waitForLoadState('networkidle');

        // Verify filter chip is displayed
        await expect(page.getByText(/action: CREATE/i)).toBeVisible();

        // Verify table shows CREATE action badges
        const createBadges = page.locator('table').getByText('CREATE');
        const count = await createBadges.count();
        expect(count).toBeGreaterThan(0);
      } finally {
        await Factories.product.delete(page, productId);
      }
    });

    test('should filter by date range', async ({ page }) => {
      await signIn(page, TEST_USERS.owner);

      // Get today's date and yesterday
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Format as YYYY-MM-DD
      const todayStr = today.toISOString().split('T')[0];
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      // Navigate with URL params (simpler than interacting with date picker)
      await page.goto(`/${TEST_USERS.owner.tenant}/audit?occurredFrom=${yesterdayStr}&occurredTo=${todayStr}`);
      await page.waitForLoadState('networkidle');

      // Verify filter chips are displayed
      await expect(page.getByText(/from: \d{4}-\d{2}-\d{2}/i)).toBeVisible();
      await expect(page.getByText(/to: \d{4}-\d{2}-\d{2}/i)).toBeVisible();

      // Verify URL contains the date params
      expect(page.url()).toContain(`occurredFrom=${yesterdayStr}`);
      expect(page.url()).toContain(`occurredTo=${todayStr}`);
    });

    test('should combine multiple filters', async ({ page }) => {
      await signIn(page, TEST_USERS.owner);

      // Create a product to generate audit events
      const productId = await Factories.product.create(page, {
        productName: `Multi Filter Test ${Date.now()}`,
        productSku: `MFT-${Date.now()}`,
        productPricePence: 1000,
      });

      try {
        await page.goto(`/${TEST_USERS.owner.tenant}/audit`);
        await page.waitForLoadState('networkidle');

        // Open filters
        await page.getByRole('button', { name: /^filters$/i }).click();

        // Select PRODUCT entity type
        const entityTypeInput = page.getByRole('textbox', { name: /entity type/i });
        await entityTypeInput.click();
        await page.getByRole('option', { name: 'PRODUCT', exact: true }).click();

        // Select CREATE action
        const actionInput = page.getByRole('textbox', { name: /^action$/i });
        await actionInput.click();
        await page.getByRole('option', { name: 'CREATE', exact: true }).click();

        // Apply filters
        await page.getByRole('button', { name: /apply filters/i }).click();
        await page.waitForLoadState('networkidle');

        // Verify both filter chips are displayed
        await expect(page.getByText(/entity: PRODUCT/i)).toBeVisible();
        await expect(page.getByText(/action: CREATE/i)).toBeVisible();
      } finally {
        await Factories.product.delete(page, productId);
      }
    });

    test('should clear individual filter chip', async ({ page }) => {
      await signIn(page, TEST_USERS.owner);

      await page.goto(`/${TEST_USERS.owner.tenant}/audit`);
      await page.waitForLoadState('networkidle');

      // Open filters
      await page.getByRole('button', { name: /^filters$/i }).click();

      // Select PRODUCT entity type
      const entityTypeInput = page.getByRole('textbox', { name: /entity type/i });
      await entityTypeInput.click();
      await page.getByRole('option', { name: 'PRODUCT', exact: true }).click();

      // Select CREATE action
      const actionInput = page.getByRole('textbox', { name: /^action$/i });
      await actionInput.click();
      await page.getByRole('option', { name: 'CREATE', exact: true }).click();

      // Apply filters
      await page.getByRole('button', { name: /apply filters/i }).click();
      await page.waitForLoadState('networkidle');

      // Verify both chips are present
      await expect(page.getByText(/entity: PRODUCT/i)).toBeVisible();
      await expect(page.getByText(/action: CREATE/i)).toBeVisible();

      // Clear entity type chip
      const entityChip = page.getByText(/entity: PRODUCT/i);
      await entityChip.locator('..').getByRole('button', { name: /clear/i }).click();
      await page.waitForLoadState('networkidle');

      // Verify entity chip is gone but action chip remains
      await expect(page.getByText(/entity: PRODUCT/i)).not.toBeVisible();
      await expect(page.getByText(/action: CREATE/i)).toBeVisible();
    });

    test('should clear all filters', async ({ page }) => {
      await signIn(page, TEST_USERS.owner);

      await page.goto(`/${TEST_USERS.owner.tenant}/audit`);
      await page.waitForLoadState('networkidle');

      // Open filters
      await page.getByRole('button', { name: /^filters$/i }).click();

      // Select PRODUCT entity type
      const entityTypeInput = page.getByRole('textbox', { name: /entity type/i });
      await entityTypeInput.click();
      await page.getByRole('option', { name: 'PRODUCT', exact: true }).click();

      // Apply filters
      await page.getByRole('button', { name: /apply filters/i }).click();
      await page.waitForLoadState('networkidle');

      // Verify chip is present
      await expect(page.getByText(/entity: PRODUCT/i)).toBeVisible();

      // Click clear all button
      await page.getByRole('button', { name: /clear all/i }).first().click();
      await page.waitForLoadState('networkidle');

      // Verify chip is gone
      await expect(page.getByText(/entity: PRODUCT/i)).not.toBeVisible();
    });

    test('should reset filters using clear button in filter panel', async ({ page }) => {
      await signIn(page, TEST_USERS.owner);

      await page.goto(`/${TEST_USERS.owner.tenant}/audit`);
      await page.waitForLoadState('networkidle');

      // Open filters
      await page.getByRole('button', { name: /^filters$/i }).click();

      // Select PRODUCT entity type
      const entityTypeInput = page.getByRole('textbox', { name: /entity type/i });
      await entityTypeInput.click();
      await page.getByRole('option', { name: 'PRODUCT', exact: true }).click();

      // Click clear in filter panel
      const clearButton = page.getByRole('button', { name: /^clear$/i });
      await clearButton.click();

      // Verify filter is reset in the panel
      const entityTypeSelect = page.getByRole('textbox', { name: /entity type/i });
      await expect(entityTypeSelect).toHaveValue('');

      // Close filters without applying
      await page.getByRole('button', { name: /^filters$/i }).click();
    });
  });

  test.describe('Pagination', () => {
    test('should navigate to next page', async ({ page }) => {
      await signIn(page, TEST_USERS.owner);

      await page.goto(`/${TEST_USERS.owner.tenant}/audit`);
      await page.waitForLoadState('networkidle');

      // Check if Next button is enabled
      const nextButton = page.getByRole('button', { name: /next/i });
      const isNextEnabled = await nextButton.isEnabled();

      if (isNextEnabled) {
        // Click Next
        await nextButton.click();
        await page.waitForLoadState('networkidle');

        // Verify page number changed
        await expect(page.getByText(/page 2/i)).toBeVisible();

        // Verify Prev button is now enabled
        await expect(page.getByRole('button', { name: /prev/i })).toBeEnabled();
      }
    });

    test('should navigate to previous page', async ({ page }) => {
      await signIn(page, TEST_USERS.owner);

      await page.goto(`/${TEST_USERS.owner.tenant}/audit`);
      await page.waitForLoadState('networkidle');

      // Check if Next button is enabled
      const nextButton = page.getByRole('button', { name: /next/i });
      const isNextEnabled = await nextButton.isEnabled();

      if (isNextEnabled) {
        // Go to page 2
        await nextButton.click();
        await page.waitForLoadState('networkidle');
        await expect(page.getByText(/page 2/i)).toBeVisible();

        // Go back to page 1
        await page.getByRole('button', { name: /prev/i }).click();
        await page.waitForLoadState('networkidle');

        // Verify we're back on page 1
        await expect(page.getByText(/page 1/i)).toBeVisible();

        // Verify Prev button is disabled on first page
        await expect(page.getByRole('button', { name: /prev/i })).toBeDisabled();
      }
    });

    test('should maintain filters when navigating pages', async ({ page }) => {
      await signIn(page, TEST_USERS.owner);

      await page.goto(`/${TEST_USERS.owner.tenant}/audit`);
      await page.waitForLoadState('networkidle');

      // Apply a filter
      await page.getByRole('button', { name: /^filters$/i }).click();
      const entityTypeInput = page.getByRole('textbox', { name: /entity type/i });
      await entityTypeInput.click();
      await page.getByRole('option', { name: 'PRODUCT', exact: true }).click();
      await page.getByRole('button', { name: /apply filters/i }).click();
      await page.waitForLoadState('networkidle');

      // Verify filter chip is visible
      await expect(page.getByText(/entity: PRODUCT/i)).toBeVisible();

      // Navigate to next page if possible
      const nextButton = page.getByRole('button', { name: /next/i });
      if (await nextButton.isEnabled()) {
        await nextButton.click();
        await page.waitForLoadState('networkidle');

        // Verify filter chip is still visible on page 2
        await expect(page.getByText(/entity: PRODUCT/i)).toBeVisible();
      }
    });
  });

  test.describe('Details Modal', () => {
    test('should open details modal for event with diff', async ({ page }) => {
      await signIn(page, TEST_USERS.owner);

      // Create and update a product to generate audit events with diff
      const productId = await Factories.product.create(page, {
        productName: `Detail Test Product ${Date.now()}`,
        productSku: `DTL-${Date.now()}`,
        productPricePence: 1000,
      });

      try {
        // Update the product to create an UPDATE event with diff
        await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}`);
        await page.waitForLoadState('networkidle');
        await page.getByLabel(/product name/i).fill('Updated Name for Audit');
        await page.getByRole('button', { name: /save/i }).click();
        await page.waitForLoadState('networkidle');

        // Navigate to audit logs
        await page.goto(`/${TEST_USERS.owner.tenant}/audit`);
        await page.waitForLoadState('networkidle');

        // Find and click "changed" button in table
        const changedButton = page.locator('table').getByRole('button', { name: /changed/i }).first();

        // Only test if there are events with diffs
        if (await changedButton.isVisible()) {
          await changedButton.click();

          // Verify modal is open
          const modal = page.getByRole('dialog');
          await expect(modal).toBeVisible();
          await expect(modal.getByText(/audit event details/i)).toBeVisible();

          // Verify modal sections
          await expect(modal.getByText(/^event id:/i)).toBeVisible();
          await expect(modal.getByText(/^diff$/i)).toBeVisible();
          await expect(modal.getByText(/^before$/i)).toBeVisible();
          await expect(modal.getByText(/^after$/i)).toBeVisible();

          // Verify JSON sections exist
          const preElements = modal.locator('pre');
          expect(await preElements.count()).toBeGreaterThanOrEqual(3);

          // Close modal
          await modal.getByRole('button', { name: /close/i }).click();
          await expect(modal).not.toBeVisible();
        }
      } finally {
        await Factories.product.delete(page, productId);
      }
    });

    test('should copy event ID from details modal', async ({ page }) => {
      await signIn(page, TEST_USERS.owner);

      // Create and update a product
      const productId = await Factories.product.create(page, {
        productName: `Copy ID Test ${Date.now()}`,
        productSku: `CPY-${Date.now()}`,
        productPricePence: 1000,
      });

      try {
        // Update the product
        await page.goto(`/${TEST_USERS.owner.tenant}/products/${productId}`);
        await page.waitForLoadState('networkidle');
        await page.getByLabel(/product name/i).fill('Updated for Copy Test');
        await page.getByRole('button', { name: /save/i }).click();
        await page.waitForLoadState('networkidle');

        // Navigate to audit logs
        await page.goto(`/${TEST_USERS.owner.tenant}/audit`);
        await page.waitForLoadState('networkidle');

        // Open details modal
        const changedButton = page.locator('table').getByRole('button', { name: /changed/i }).first();

        if (await changedButton.isVisible()) {
          await changedButton.click();

          const modal = page.getByRole('dialog');
          await expect(modal).toBeVisible();

          // Click copy button for event ID
          const copyButton = modal.getByRole('button', { name: /copy event id/i });
          await copyButton.click();

          // Verify success notification
          await expect(page.getByText(/event id copied/i)).toBeVisible();
        }
      } finally {
        await Factories.product.delete(page, productId);
      }
    });
  });

  test.describe('Additional Features', () => {
    test('should copy shareable link', async ({ page }) => {
      await signIn(page, TEST_USERS.owner);

      await page.goto(`/${TEST_USERS.owner.tenant}/audit`);
      await page.waitForLoadState('networkidle');

      // Click copy link button
      await page.getByRole('button', { name: /copy link/i }).click();

      // Verify success notification
      await expect(page.getByText(/shareable link copied/i)).toBeVisible();
    });

    test('should refresh audit logs', async ({ page }) => {
      await signIn(page, TEST_USERS.owner);

      await page.goto(`/${TEST_USERS.owner.tenant}/audit`);
      await page.waitForLoadState('networkidle');

      // Click refresh button
      await page.getByRole('button', { name: /refresh/i }).click();
      await page.waitForLoadState('networkidle');

      // Verify page still shows audit logs
      await expect(page.getByRole('heading', { name: /audit log/i })).toBeVisible();
      await expect(page.locator('table')).toBeVisible();
    });

    test('should toggle filters panel', async ({ page }) => {
      await signIn(page, TEST_USERS.owner);

      await page.goto(`/${TEST_USERS.owner.tenant}/audit`);
      await page.waitForLoadState('networkidle');

      const filtersButton = page.getByRole('button', { name: /^filters$/i });

      // Open filters
      await filtersButton.click();
      await expect(page.getByRole('textbox', { name: /entity type/i })).toBeVisible();

      // Close filters
      await filtersButton.click();
      await page.waitForTimeout(500); // Wait for animation
      await expect(page.getByRole('textbox', { name: /entity type/i })).not.toBeVisible();
    });

    test('should show entity links for supported types', async ({ page }) => {
      await signIn(page, TEST_USERS.owner);

      // Create a product to generate audit event
      const productId = await Factories.product.create(page, {
        productName: `Link Test Product ${Date.now()}`,
        productSku: `LNK-${Date.now()}`,
        productPricePence: 1000,
      });

      try {
        await page.goto(`/${TEST_USERS.owner.tenant}/audit`);
        await page.waitForLoadState('networkidle');

        // Filter to show only PRODUCT entities
        await page.getByRole('button', { name: /^filters$/i }).click();
        const entityTypeInput = page.getByRole('textbox', { name: /entity type/i });
        await entityTypeInput.click();
        await page.getByRole('option', { name: 'PRODUCT', exact: true }).click();
        await page.getByRole('button', { name: /apply filters/i }).click();
        await page.waitForLoadState('networkidle');

        // Look for product entity links in table
        const productLinks = page.locator('table').getByRole('link', { name: /PRODUCT/i });

        if (await productLinks.count() > 0) {
          // Verify link is clickable (don't actually click to avoid navigation)
          const firstLink = productLinks.first();
          await expect(firstLink).toBeVisible();

          // Verify link has correct href pattern
          const href = await firstLink.getAttribute('href');
          expect(href).toMatch(/\/products\//);
        }
      } finally {
        await Factories.product.delete(page, productId);
      }
    });

    test('should copy correlation ID', async ({ page }) => {
      await signIn(page, TEST_USERS.owner);

      await page.goto(`/${TEST_USERS.owner.tenant}/audit`);
      await page.waitForLoadState('networkidle');

      // Find first correlation ID copy button
      const copyButtons = page.locator('table').getByRole('button', { name: /copy correlation id/i });

      if (await copyButtons.count() > 0) {
        await copyButtons.first().click();

        // Verify success notification
        await expect(page.getByText(/correlation id copied/i)).toBeVisible();
      }
    });
  });

  test.describe('Permission Tests', () => {
    // NOTE: Based on backend tests (auditLogs.permissions.test.ts), the current implementation
    // allows ALL authenticated users to access audit logs. According to comments in the backend,
    // this should ideally require 'tenant:manage' permission (OWNER/ADMIN only).
    //
    // Current behavior: All roles can access
    // Expected future behavior: Only OWNER/ADMIN (with tenant:manage)
    //
    // Tests below reflect CURRENT implementation while documenting expected behavior.

    test('OWNER can view audit logs', async ({ page }) => {
      await signIn(page, TEST_USERS.owner);

      await page.goto(`/${TEST_USERS.owner.tenant}/audit`);
      await page.waitForLoadState('networkidle');

      // Verify page loads successfully
      await expect(page.getByRole('heading', { name: /audit log/i })).toBeVisible();
      await expect(page.locator('table')).toBeVisible();
    });

    test('ADMIN can view audit logs (current implementation)', async ({ page }) => {
      await signIn(page, TEST_USERS.admin);

      await page.goto(`/${TEST_USERS.admin.tenant}/audit`);
      await page.waitForLoadState('networkidle');

      // Current: ADMIN can access (authenticated)
      // Future: ADMIN should be denied (lacks tenant:manage in RBAC catalog)
      await expect(page.getByRole('heading', { name: /audit log/i })).toBeVisible();
      await expect(page.locator('table')).toBeVisible();
    });
  });

  test.describe('Edge Cases', () => {
    test('should show empty state when no results', async ({ page }) => {
      await signIn(page, TEST_USERS.owner);

      await page.goto(`/${TEST_USERS.owner.tenant}/audit`);
      await page.waitForLoadState('networkidle');

      // Apply a filter that returns no results
      await page.getByRole('button', { name: /^filters$/i }).click();

      // Use entityId filter with a UUID that doesn't exist
      const entityIdInput = page.getByRole('textbox', { name: /entity id/i });
      await entityIdInput.fill('00000000-0000-0000-0000-000000000000');

      await page.getByRole('button', { name: /apply filters/i }).click();
      await page.waitForLoadState('networkidle');

      // Verify empty state - scope to the empty state container
      const emptyState = page.getByText(/no audit events match your filters/i).locator('..');
      await expect(page.getByText(/no audit events match your filters/i)).toBeVisible();
      await expect(page.getByText(/try adjusting your filters/i)).toBeVisible();
      await expect(emptyState.getByRole('button', { name: /clear all filters/i })).toBeVisible();
      await expect(emptyState.getByRole('button', { name: /show filters/i })).toBeVisible();
    });

    test('should handle invalid entity type gracefully', async ({ page }) => {
      await signIn(page, TEST_USERS.owner);

      // Navigate with invalid entity type in URL
      await page.goto(`/${TEST_USERS.owner.tenant}/audit?entityType=INVALID_TYPE`);
      await page.waitForLoadState('networkidle');

      // Page should load without errors, ignoring invalid filter
      await expect(page.getByRole('heading', { name: /audit log/i })).toBeVisible();

      // Filter chip should not appear for invalid type
      await expect(page.getByText(/entity: INVALID_TYPE/i)).not.toBeVisible();
    });

    test('should persist filters in URL', async ({ page }) => {
      await signIn(page, TEST_USERS.owner);

      await page.goto(`/${TEST_USERS.owner.tenant}/audit`);
      await page.waitForLoadState('networkidle');

      // Apply filter
      await page.getByRole('button', { name: /^filters$/i }).click();
      const entityTypeInput = page.getByRole('textbox', { name: /entity type/i });
      await entityTypeInput.click();
      await page.getByRole('option', { name: 'PRODUCT', exact: true }).click();
      await page.getByRole('button', { name: /apply filters/i }).click();
      await page.waitForLoadState('networkidle');

      // Check URL contains filter
      expect(page.url()).toContain('entityType=PRODUCT');

      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Verify filter is still applied
      await expect(page.getByText(/entity: PRODUCT/i)).toBeVisible();
    });
  });
});
