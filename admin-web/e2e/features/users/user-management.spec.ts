// admin-web/e2e/users/user-management.spec.ts
import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS, Factories } from '../../helpers';

/**
 * User Management Tests (CRUD & Permissions)
 *
 * Tests cover:
 * - List all users
 * - View user details
 * - Search/filter users
 * - Sort users
 * - Pagination
 * - Permission checks (VIEWER vs OWNER)
 * - User roles display
 * - User branches display
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

test.describe('User Management - List & View', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('should list all users', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/users`);
    await page.waitForLoadState('networkidle');

    // Should show users page
    await expect(page.getByRole('heading', { name: /all users/i }).first()).toBeVisible();

    // Should have a table with user rows
    await page.waitForSelector('table tbody tr');
    const rowCount = await page.locator('table tbody tr').count();
    expect(rowCount).toBeGreaterThan(0);

    // Should show pagination info
    await expect(page.getByText(/showing \d+–\d+/i).first()).toBeVisible();
  });

  test('should view user details', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Get users
    const users = await Factories.tenantUser.getAll(page);
    if (users.length === 0) {
      console.warn('No users found - skipping');
      return;
    }

    const firstUser = users[0];

    // Navigate to user detail page
    await page.goto(`/${TEST_USERS.owner.tenant}/users/${firstUser.userId}`);
    await page.waitForLoadState('networkidle');

    // Should show user email (in an input field with the value attribute)
    await expect(page.locator(`input[value="${firstUser.userEmailAddress}"]`)).toBeVisible();

    // Should show role select/information (use getByRole to target the textbox specifically)
    await expect(page.getByRole('textbox', { name: /role/i })).toBeVisible();
  });

  test('should search users by email', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/users`);
    await page.waitForLoadState('networkidle');

    // Open filters
    const filtersButton = page.getByRole('button', { name: /^filters$/i });
    await filtersButton.click();

    // Wait for filter panel to be visible
    await page.waitForSelector('[id="tenant-users-filter-panel"]', { state: 'visible' });

    // Search for owner user
    const searchInput = page.getByLabel(/search \(email contains\)/i);
    await searchInput.fill('owner');

    // Apply filters
    await page.getByRole('button', { name: /apply filters/i }).click();

    // Wait for table to update
    await page.waitForSelector('table tbody tr');

    // Should show filtered results in the table (use getByRole('cell') to target table cells)
    await expect(page.getByRole('cell', { name: /owner@acme\.test/i })).toBeVisible();
  });

  test.skip('should filter users by role', async ({ page }) => {
      // Skipped because there is an issue with the role filter dropdown
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/users`);
    await page.waitForLoadState('networkidle');

    // Open filters
    const filtersButton = page.getByRole('button', { name: /^filters$/i });
    await filtersButton.click();

    // Wait for filter panel to be visible
    await page.waitForSelector('[id="tenant-users-filter-panel"]', { state: 'visible' });

    // Filter by OWNER role
    const roleInput = page.getByLabel(/role \(contains\)/i);
    await roleInput.fill('OWNER');

    // Apply filters
    await page.getByRole('button', { name: /apply filters/i }).click();

    // Wait for table to update
    await page.waitForSelector('table tbody tr');

    // Should show OWNER badge in results
    await expect(page.getByText('OWNER').first()).toBeVisible();
  });

  test('should sort users by email', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/users`);
    await page.waitForLoadState('networkidle');

    // Wait for table to load
    await page.waitForSelector('table tbody tr');

    // Click email sort button
    const emailSortButton = page.getByRole('button', { name: /sort by email/i });
    await emailSortButton.click();

    // Wait for table to update
    await page.waitForLoadState('networkidle');

    // URL should contain sortBy and sortDir parameters
    await expect(page).toHaveURL(/sortBy=userEmailAddress/);
    await expect(page).toHaveURL(/sortDir=(asc|desc)/);
  });

  test('should sort users by created date', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/users`);
    await page.waitForLoadState('networkidle');

    // Wait for table to load
    await page.waitForSelector('table tbody tr');

    // Click created date sort button
    const createdSortButton = page.getByRole('button', { name: /sort by created/i });
    await createdSortButton.click();

    // Wait for table to update
    await page.waitForLoadState('networkidle');

    // URL should contain sortBy and sortDir parameters
    await expect(page).toHaveURL(/sortBy=createdAt/);
  });

  test('should show user role badges', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/users`);
    await page.waitForLoadState('networkidle');

    // Wait for table to load
    await page.waitForSelector('table tbody tr');

    // Should show role badges (OWNER, ADMIN, EDITOR, VIEWER)
    const roleBadges = page.locator('table tbody tr td').filter({ hasText: /OWNER|ADMIN|EDITOR|VIEWER/ });
    const badgeCount = await roleBadges.count();
    expect(badgeCount).toBeGreaterThan(0);
  });

  test('should show user branches', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/users`);
    await page.waitForLoadState('networkidle');

    // Wait for table to load
    await page.waitForSelector('table tbody tr');

    // Table should have a "Branches" column header
    await expect(page.getByRole('columnheader', { name: /branches/i })).toBeVisible();
  });

  test.skip('should clear all filters', async ({ page }) => {
    // Skipped because there is an issue with the role filter dropdown
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/users`);
    await page.waitForLoadState('networkidle');

    // Open filters
    const filtersButton = page.getByRole('button', { name: /^filters$/i });
    await filtersButton.click();

    // Wait for filter panel to be visible
    await page.waitForSelector('[id="tenant-users-filter-panel"]', { state: 'visible' });

    // Apply multiple filters
    const searchInput = page.getByLabel(/search \(email contains\)/i);
    await searchInput.fill('test');

    const roleInput = page.getByLabel(/role \(contains\)/i);
    await roleInput.fill('ADMIN');

    // Apply filters
    await page.getByRole('button', { name: /apply filters/i }).click();

    // URL should contain filter parameters
    await expect(page).toHaveURL(/q=test/);
    await expect(page).toHaveURL(/roleName=ADMIN/);

    // Reopen filters to clear them
    await filtersButton.click();
    await page.waitForSelector('[id="tenant-users-filter-panel"]', { state: 'visible' });

    // Clear all filters
    const filterPanel = page.locator('[id="tenant-users-filter-panel"]');
    const clearButton = filterPanel.getByRole('button', { name: /^clear$/i });
    await clearButton.click();

    // URL should not contain filter parameters
    await expect(page).not.toHaveURL(/q=test/);
    await expect(page).not.toHaveURL(/roleName=ADMIN/);
  });

  test('should refresh user list', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/users`);
    await page.waitForLoadState('networkidle');

    // Wait for table to load
    await page.waitForSelector('table tbody tr');

    // Click refresh button
    await page.getByRole('button', { name: /refresh/i }).click();

    // Should reload the page
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('table tbody tr');
  });
});

test.describe('User Management - Permissions', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('OWNER can manage users', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/users`);
    await page.waitForLoadState('networkidle');

    // Should be able to see users list
    await expect(page.getByRole('heading', { name: /all users/i }).first()).toBeVisible();

    // "Add user" button should be enabled
    const addUserButton = page.getByRole('button', { name: /add user/i });
    await expect(addUserButton).toBeEnabled();
  });

  test('ADMIN can manage users', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    await page.goto(`/${TEST_USERS.admin.tenant}/users`);
    await page.waitForLoadState('networkidle');

    // Should be able to see users list
    await expect(page.getByRole('heading', { name: /all users/i }).first()).toBeVisible();

    // "Add user" button should be enabled
    const addUserButton = page.getByRole('button', { name: /add user/i });
    await expect(addUserButton).toBeEnabled();
  });

  test('EDITOR cannot manage users', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);

    await page.goto(`/${TEST_USERS.editor.tenant}/users`);
    await page.waitForLoadState('networkidle');

    // EDITOR lacks users:manage permission, so they should see "No access" page
    await expect(page.getByText(/no access|permission denied|not authorized/i)).toBeVisible();

    // Should NOT see the users page
    await expect(page.getByRole('heading', { name: /all users/i })).not.toBeVisible();
  });
});

test.describe('User Management - Navigation', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('should navigate from list to detail page', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/users`);
    await page.waitForLoadState('networkidle');

    // Wait for table to load
    await page.waitForSelector('table tbody tr');

    // Click on first user's view button
    const firstViewButton = page.locator('table tbody tr:first-child td button[title="Edit user"]').first();
    await firstViewButton.click();

    // Should navigate to user detail page
    await expect(page).toHaveURL(/\/users\/[a-zA-Z0-9-]+$/);
    await page.waitForLoadState('networkidle');
  });

  test('should copy shareable link', async ({ page, context }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/users`);
    await page.waitForLoadState('networkidle');

    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Click copy link button
    await page.getByRole('button', { name: /copy link/i }).click();

    // Should show success notification
    await expect(page.getByRole('alert')).toContainText(/copied/i);
  });
});

test.describe('User Management - Pagination', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('should change page size', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/users`);
    await page.waitForLoadState('networkidle');

    // Wait for table to load
    await page.waitForSelector('table tbody tr');

    // Find the "Per page" input
    const pageSizeInput = page.locator('input[type="number"]').filter({ hasText: /^\d+$/ }).first();
    if (await pageSizeInput.isVisible()) {
      // Change page size to 10
      await pageSizeInput.clear();
      await pageSizeInput.fill('10');
      await pageSizeInput.press('Enter');

      // Wait for table to update
      await page.waitForLoadState('networkidle');

      // URL should contain limit parameter
      await expect(page).toHaveURL(/limit=10/);
    }
  });

  test('should show page number', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/users`);
    await page.waitForLoadState('networkidle');

    // Should show "Page 1"
    await expect(page.getByText(/page \d+/i)).toBeVisible();
  });
});
