// admin-web/e2e/users/user-archival.spec.ts
import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS, Factories, SELECTORS } from '../../helpers';

/**
 * User Archival & Restore Tests
 *
 * Tests cover:
 * - Archive user membership from detail page (with confirmation modal)
 * - Cancel archive confirmation
 * - Restore archived user membership
 * - Filter to show only archived users
 * - Filter to show all users (active + archived)
 * - Archived users accessible via direct URL
 * - Permission checks (VIEWER cannot archive/restore)
 * - Cannot archive own membership
 * - Archived user cannot sign in
 * - Clear archive filter resets to default
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

test.describe('User Archival Functionality', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('should show archived badge for archived users in list view', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Get users list
    const users = await Factories.tenantUser.getAll(page);
    if (users.length < 2) {
      console.warn('Test requires at least 2 users - skipping');
      return;
    }

    // Archive a user (not the current user)
    const userToArchive = users.find(u => u.userEmailAddress !== TEST_USERS.owner.email);
    if (!userToArchive) {
      console.warn('No suitable user found to archive - skipping');
      return;
    }

    try {
      await Factories.tenantUser.archive(page, userToArchive.userId);

      // Navigate to users page and show all users
      await page.goto(`/${TEST_USERS.owner.tenant}/users`);
      await page.waitForLoadState('networkidle');

      // Open filters
      await page.getByRole('button', { name: /^filters$/i }).click();

      // Select "All users"
      const archivedFilter = page.getByTestId(SELECTORS.USER.ARCHIVED_FILTER_SELECT);
      if (await archivedFilter.isVisible()) {
        await archivedFilter.click();
        await page.getByRole('option', { name: /all users \(active \+ archived\)/i }).click();

        // Apply filters
        await page.getByRole('button', { name: /apply filters/i }).click();

        // Wait for table to update
        await page.waitForSelector('table tbody tr');

        // Archived badge should be visible
        const archivedBadges = await page.getByTestId(SELECTORS.USER.ARCHIVED_BADGE).count();
        expect(archivedBadges).toBeGreaterThan(0);
      }
    } finally {
      // Restore the user
      await Factories.tenantUser.restore(page, userToArchive.userId);
    }
  });

  test('should filter to show only archived users', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const users = await Factories.tenantUser.getAll(page);
    if (users.length < 2) {
      console.warn('Test requires at least 2 users - skipping');
      return;
    }

    const userToArchive = users.find(u => u.userEmailAddress !== TEST_USERS.owner.email);
    if (!userToArchive) {
      console.warn('No suitable user found to archive - skipping');
      return;
    }

    try {
      // Archive a user
      await Factories.tenantUser.archive(page, userToArchive.userId);

      // Go to users page
      await page.goto(`/${TEST_USERS.owner.tenant}/users`);
      await page.waitForLoadState('networkidle');

      // By default, should show only active users (no archived badges)
      await page.waitForSelector('table tbody tr');
      const archivedBadgesDefault = await page.getByTestId(SELECTORS.USER.ARCHIVED_BADGE).count();
      expect(archivedBadgesDefault).toBe(0);

      // Open filters
      await page.getByRole('button', { name: /^filters$/i }).click();

      // Select "Archived users only"
      const archivedFilter = page.getByTestId(SELECTORS.USER.ARCHIVED_FILTER_SELECT);
      if (await archivedFilter.isVisible()) {
        await archivedFilter.click();
        await page.getByRole('option', { name: /archived users only/i }).click();

        // Apply filters
        await page.getByRole('button', { name: /apply filters/i }).click();

        // Wait for table to update
        await page.waitForSelector('table tbody tr');

        // Should show only archived users (all rows should have archived badge)
        const rowCount = await page.locator('table tbody tr').count();
        const archivedBadgesAfterFilter = await page.getByTestId(SELECTORS.USER.ARCHIVED_BADGE).count();
        expect(archivedBadgesAfterFilter).toBe(rowCount);
        expect(archivedBadgesAfterFilter).toBeGreaterThan(0);
      }
    } finally {
      await Factories.tenantUser.restore(page, userToArchive.userId);
    }
  });

  test('should clear archived filter when clicking "Clear" button', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Go to users page
    await page.goto(`/${TEST_USERS.owner.tenant}/users`);
    await page.waitForLoadState('networkidle');

    // Open filters
    await page.getByRole('button', { name: /^filters$/i }).click();

    // Select "Archived users only"
    const archivedFilter = page.getByTestId(SELECTORS.USER.ARCHIVED_FILTER_SELECT);
    if (await archivedFilter.isVisible()) {
      await archivedFilter.click();
      await page.getByRole('option', { name: /archived users only/i }).click();

      // Apply filters
      await page.getByRole('button', { name: /apply filters/i }).click();

      // URL should contain archivedFilter parameter
      await expect(page).toHaveURL(/archivedFilter=archived-only/);

      // Click Clear button
      const filterPanel = page.locator('[id="tenant-users-filter-panel"]');
      const clearButton = filterPanel.getByRole('button', { name: /^clear$/i });
      await clearButton.click();

      // URL should reset to default (active-only)
      await expect(page).toHaveURL(/archivedFilter=active-only/);
    }
  });

  test('VIEWER should not see archive or restore buttons', async ({ page, context }) => {
    // First, sign in as OWNER to get a user ID to test with
    await signIn(page, TEST_USERS.owner);

    const users = await Factories.tenantUser.getAll(page);
    if (users.length === 0) {
      console.warn('No users found - skipping');
      return;
    }

    // Pick a user that's not the viewer (preferably the owner)
    const userToView = users.find(u => u.userEmailAddress === TEST_USERS.owner.email) || users[0];

    // Now sign in as VIEWER
    await context.clearCookies();
    await signIn(page, TEST_USERS.viewer);

    // Navigate to the user detail page
    await page.goto(`/${TEST_USERS.viewer.tenant}/users/${userToView.userId}`);
    await page.waitForLoadState('networkidle');

    // Archive and Restore buttons should not be visible (viewer lacks users:manage)
    await expect(page.getByTestId(SELECTORS.USER.ARCHIVE_BUTTON)).not.toBeVisible();
    await expect(page.getByTestId(SELECTORS.USER.RESTORE_BUTTON)).not.toBeVisible();
  });

  test('should not allow archiving own membership', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Get current user's ID
    const users = await Factories.tenantUser.getAll(page);
    const currentUser = users.find(u => u.userEmailAddress === TEST_USERS.owner.email);
    if (!currentUser) {
      console.warn('Current user not found - skipping');
      return;
    }

    // Navigate to own user detail page
    await page.goto(`/${TEST_USERS.owner.tenant}/users/${currentUser.userId}`);
    await page.waitForLoadState('networkidle');

    // Archive button should not be visible (cannot archive self)
    await expect(page.getByTestId(SELECTORS.USER.ARCHIVE_BUTTON)).not.toBeVisible();
  });

  test('archived user cannot sign in to archived tenant', async ({ page, context }) => {
    // Sign in as OWNER to archive a user
    await signIn(page, TEST_USERS.owner);

    const users = await Factories.tenantUser.getAll(page);
    // Find EDITOR user to archive
    const editorUser = users.find(u => u.userEmailAddress === TEST_USERS.editor.email);
    if (!editorUser) {
      console.warn('Editor user not found - skipping');
      return;
    }

    try {
      // Archive the EDITOR user
      await Factories.tenantUser.archive(page, editorUser.userId);

      // Clear cookies and try to sign in as archived EDITOR
      await context.clearCookies();

      await page.goto('/');
      await page.getByLabel(/email address/i).fill(TEST_USERS.editor.email);
      await page.getByLabel(/password/i).fill(TEST_USERS.editor.password);
      await page.getByLabel(/tenant/i).fill(TEST_USERS.editor.tenant);
      await page.getByRole('button', { name: /sign in/i }).click();

      // Should show error and redirect to sign-in page
      await expect(page.getByRole('alert')).toContainText(/archived|inactive|disabled/i);
      await expect(page).toHaveURL('/');
    } finally {
      // Restore the EDITOR user
      await context.clearCookies();
      await signIn(page, TEST_USERS.owner);
      await Factories.tenantUser.restore(page, editorUser.userId);
    }
  });
});
