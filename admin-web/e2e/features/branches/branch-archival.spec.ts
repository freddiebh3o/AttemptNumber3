// admin-web/e2e/features/branch-archival.spec.ts
import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS, Factories } from '../../helpers';

/**
 * Branch Archive & Restore Tests
 *
 * Tests cover:
 * - Archive branch from detail page
 * - Restore archived branch
 * - Filter archived branches
 * - Navigate to branch detail via View button
 * - Archived branches accessible via direct URL
 *
 * All tests create their own test data and clean up after themselves.
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

test.describe('Branch Archive Functionality', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('should navigate to branch detail page via View button', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    let branchId: string | undefined;

    try {
      // Create a test branch with unique timestamp
      const timestamp = Date.now();
      const branchName = `View Test Branch ${timestamp}`;

      branchId = await Factories.branch.create(page, {
        branchSlug: `view-test-${timestamp}`,
        branchName: branchName,
        isActive: true,
      });

      // Navigate to branches list
      await page.goto(`/${TEST_USERS.owner.tenant}/branches`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: /all branches/i }).first()).toBeVisible();

      // Wait for table to load
      await page.waitForSelector('table tbody tr');

      // Find our test branch by exact name and click View
      const row = page.locator('table tbody tr').filter({ hasText: branchName });
      const viewButton = row.getByTestId('view-branch-btn');
      await expect(viewButton).toBeVisible();
      await viewButton.click();

      // Should navigate to branch detail page
      await expect(page).toHaveURL(new RegExp(`/branches/${branchId}`));
      await expect(page.getByRole('heading', { name: /edit branch/i })).toBeVisible();
    } finally {
      // Cleanup
      if (branchId) {
        try {
          await Factories.branch.restore(page, branchId);
        } catch (e) {
          // Ignore if not archived
        }
      }
    }
  });

  test('should archive a branch from detail page', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    let branchId: string | undefined;

    try {
      // Create a test branch
      branchId = await Factories.branch.create(page, {
        branchSlug: `archive-test-${Date.now()}`,
        branchName: `Archive Test Branch ${Date.now()}`,
        isActive: true,
      });

      // Navigate to branch detail page
      await page.goto(`/${TEST_USERS.owner.tenant}/branches/${branchId}`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: /edit branch/i })).toBeVisible();

      // Click the archive button
      const archiveButton = page.getByTestId('archive-branch-btn');
      await expect(archiveButton).toBeVisible();
      await archiveButton.click();

      // Confirmation modal should appear
      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible();
      await expect(modal.getByText(/archive branch\?/i)).toBeVisible();
      await expect(modal.getByText(/hidden from your active branch list/i)).toBeVisible();

      // Confirm the archive
      const confirmButton = modal.getByRole('button', { name: /^archive$/i });
      await confirmButton.click();

      // Should show success notification
      await expect(page.getByRole('alert').filter({ hasText: /branch archived/i })).toBeVisible();

      // Modal should close
      await expect(modal).not.toBeVisible();

      // Archived badge should appear
      await expect(page.getByTestId('archived-badge')).toBeVisible();
      await expect(page.getByTestId('archived-badge')).toHaveText('Archived');

      // Archive button should be replaced with Restore button
      await expect(page.getByTestId('archive-branch-btn')).not.toBeVisible();
      await expect(page.getByTestId('restore-btn')).toBeVisible();
    } finally {
      // Cleanup
      if (branchId) {
        try {
          await Factories.branch.restore(page, branchId);
        } catch (e) {
          // Already restored or doesn't exist
        }
      }
    }
  });

  test('should cancel archive confirmation', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    let branchId: string | undefined;

    try {
      // Create a test branch
      branchId = await Factories.branch.create(page, {
        branchSlug: `cancel-test-${Date.now()}`,
        branchName: `Cancel Test Branch ${Date.now()}`,
        isActive: true,
      });

      // Navigate to branch detail page
      await page.goto(`/${TEST_USERS.owner.tenant}/branches/${branchId}`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: /edit branch/i })).toBeVisible();

      // Click the archive button
      await page.getByTestId('archive-branch-btn').click();

      // Modal should appear
      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible();

      // Click Cancel
      const cancelButton = modal.getByRole('button', { name: /cancel/i });
      await cancelButton.click();

      // Modal should close
      await expect(modal).not.toBeVisible();

      // Branch should still be active (no archived badge)
      await expect(page.getByTestId('archived-badge')).not.toBeVisible();

      // Archive button should still be visible
      await expect(page.getByTestId('archive-branch-btn')).toBeVisible();
    } finally {
      // Cleanup
      if (branchId) {
        try {
          await Factories.branch.restore(page, branchId);
        } catch (e) {
          // Ignore
        }
      }
    }
  });

  test('should restore an archived branch', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    let branchId: string | undefined;

    try {
      // Create a test branch
      branchId = await Factories.branch.create(page, {
        branchSlug: `restore-test-${Date.now()}`,
        branchName: `Restore Test Branch ${Date.now()}`,
        isActive: true,
      });

      // Archive it via API
      await Factories.branch.archive(page, branchId);

      // Navigate to archived branch
      await page.goto(`/${TEST_USERS.owner.tenant}/branches/${branchId}`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: /edit branch/i })).toBeVisible();

      // Archived badge should be visible
      await expect(page.getByTestId('archived-badge')).toBeVisible();

      // Click Restore button
      const restoreButton = page.getByTestId('restore-btn');
      await expect(restoreButton).toBeVisible();
      await restoreButton.click();

      // Should show success notification
      await expect(page.getByRole('alert').filter({ hasText: /branch restored/i })).toBeVisible();

      // Archived badge should disappear
      await expect(page.getByTestId('archived-badge')).not.toBeVisible();

      // Restore button should be replaced with Archive button
      await expect(page.getByTestId('restore-btn')).not.toBeVisible();
      await expect(page.getByTestId('archive-branch-btn')).toBeVisible();
    } finally {
      // Cleanup
      if (branchId) {
        try {
          await Factories.branch.restore(page, branchId);
        } catch (e) {
          // Already restored
        }
      }
    }
  });

  test('should filter to show only archived branches', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    let activeBranchId: string | undefined;
    let archivedBranchId: string | undefined;

    try {
      // Create two test branches
      activeBranchId = await Factories.branch.create(page, {
        branchSlug: `active-filter-${Date.now()}`,
        branchName: `Active Filter Branch ${Date.now()}`,
        isActive: true,
      });

      archivedBranchId = await Factories.branch.create(page, {
        branchSlug: `archived-filter-${Date.now()}`,
        branchName: `Archived Filter Branch ${Date.now()}`,
        isActive: true,
      });

      // Archive the second branch
      await Factories.branch.archive(page, archivedBranchId);

      // Go to branches list
      await page.goto(`/${TEST_USERS.owner.tenant}/branches`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: /all branches/i }).first()).toBeVisible();

      // By default, should show only active branches
      await page.waitForSelector('table tbody tr');

      // Open filters
      await page.getByRole('button', { name: /^filters$/i }).click();

      // Select "Archived branches only"
      const archivedFilter = page.getByTestId('archived-filter-select');
      await archivedFilter.click();
      await page.getByRole('option', { name: /archived branches only/i }).click();

      // Apply filters
      await page.getByRole('button', { name: /apply filters/i }).click();

      // Wait for table to update
      await page.waitForSelector('table tbody tr');

      // Should show the archived branch
      await expect(page.getByText('Archived Filter Branch')).toBeVisible();

      // Should not show the active branch
      const activeText = page.getByText('Active Filter Branch');
      await expect(activeText).not.toBeVisible();
    } finally {
      // Cleanup
      if (activeBranchId) {
        try {
          await Factories.branch.restore(page, activeBranchId);
        } catch (e) {
          // Ignore
        }
      }
      if (archivedBranchId) {
        try {
          await Factories.branch.restore(page, archivedBranchId);
        } catch (e) {
          // Ignore
        }
      }
    }
  });

  test('should show archived branches on direct URL access', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    let branchId: string | undefined;

    try {
      // Create and archive a branch
      branchId = await Factories.branch.create(page, {
        branchSlug: `direct-url-${Date.now()}`,
        branchName: `Direct URL Branch ${Date.now()}`,
        isActive: true,
      });

      await Factories.branch.archive(page, branchId);

      // Navigate directly to archived branch URL
      await page.goto(`/${TEST_USERS.owner.tenant}/branches/${branchId}`);
      await page.waitForLoadState('networkidle');

      // Should load the branch page
      await expect(page.getByRole('heading', { name: /edit branch/i })).toBeVisible();

      // Should show archived badge
      await expect(page.getByTestId('archived-badge')).toBeVisible();

      // Should show restore button
      await expect(page.getByTestId('restore-btn')).toBeVisible();
    } finally {
      // Cleanup
      if (branchId) {
        try {
          await Factories.branch.restore(page, branchId);
        } catch (e) {
          // Ignore
        }
      }
    }
  });

  test('should clear archived filter when clicking "Clear" button', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Navigate to branches list
    await page.goto(`/${TEST_USERS.owner.tenant}/branches`);
    await page.waitForLoadState('networkidle');

    // Open filters
    await page.getByRole('button', { name: /^filters$/i }).click();

    // Select "Archived branches only"
    const archivedFilter = page.getByTestId('archived-filter-select');
    await archivedFilter.click();
    await page.getByRole('option', { name: /archived branches only/i }).click();

    // Apply filters
    await page.getByRole('button', { name: /apply filters/i }).click();

    // URL should contain archivedFilter parameter
    await expect(page).toHaveURL(/archivedFilter=archived-only/);

    // Click Clear button
    const filterPanel = page.locator('[id="branches-filter-panel"]');
    const clearButton = filterPanel.getByRole('button', { name: /^clear$/i });
    await clearButton.click();

    // URL should reset to default (active-only)
    await expect(page).toHaveURL(/archivedFilter=active-only/);
  });

  test('Edit button only visible for active branches', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    let branchId: string | undefined;

    try {
      // Create a test branch
      branchId = await Factories.branch.create(page, {
        branchSlug: `edit-test-${Date.now()}`,
        branchName: `Edit Test Branch ${Date.now()}`,
        isActive: true,
      });

      // Navigate to branch detail page
      await page.goto(`/${TEST_USERS.owner.tenant}/branches/${branchId}`);
      await page.waitForLoadState('networkidle');

      // For active branch, Save button should be visible
      await expect(page.getByRole('button', { name: /save/i })).toBeVisible();

      // Archive the branch
      await page.getByTestId('archive-branch-btn').click();
      const modal = page.getByRole('dialog');
      await modal.getByRole('button', { name: /^archive$/i }).click();

      // Wait for archive notification and let it disappear
      await expect(page.getByRole('alert').filter({ hasText: /branch archived/i })).toBeVisible();
      await expect(page.getByRole('alert').filter({ hasText: /branch archived/i })).not.toBeVisible({ timeout: 10000 });

      // For archived branch, Save button should be hidden
      await expect(page.getByRole('button', { name: /save/i })).not.toBeVisible();

      // Restore the branch
      await page.getByTestId('restore-btn').click();

      // Wait for restore notification
      await expect(page.getByRole('alert').filter({ hasText: /branch restored/i })).toBeVisible();

      // Save button should be visible again
      await expect(page.getByRole('button', { name: /save/i })).toBeVisible();
    } finally {
      // Cleanup
      if (branchId) {
        try {
          await Factories.branch.restore(page, branchId);
        } catch (e) {
          // Ignore
        }
      }
    }
  });

  test('should show archived badge in list view', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    let branchId: string | undefined;

    try {
      // Create and archive a branch
      branchId = await Factories.branch.create(page, {
        branchSlug: `badge-test-${Date.now()}`,
        branchName: `Badge Test Branch ${Date.now()}`,
        isActive: true,
      });

      await Factories.branch.archive(page, branchId);

      // Go to list and filter for all branches
      await page.goto(`/${TEST_USERS.owner.tenant}/branches`);
      await page.waitForLoadState('networkidle');

      // Open filters and select "All branches"
      await page.getByRole('button', { name: /^filters$/i }).click();
      const archivedFilter = page.getByTestId('archived-filter-select');
      await archivedFilter.click();
      await page.getByRole('option', { name: /all branches \(active \+ archived\)/i }).click();
      await page.getByRole('button', { name: /apply filters/i }).click();

      await page.waitForSelector('table tbody tr');

      // Find the row with our test branch
      const row = page.locator('table tbody tr', { hasText: 'Badge Test Branch' });

      // Archived badge should be visible in that row
      await expect(row.getByTestId('archived-badge')).toBeVisible();
    } finally {
      // Cleanup
      if (branchId) {
        try {
          await Factories.branch.restore(page, branchId);
        } catch (e) {
          // Ignore
        }
      }
    }
  });
});
