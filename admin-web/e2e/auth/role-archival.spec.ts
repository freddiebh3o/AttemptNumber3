import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS, Factories } from '../helpers';

// Health check (required)
test.beforeAll(async () => {
  const apiUrl = process.env.VITE_API_BASE_URL || 'http://localhost:4000';
  try {
    const response = await fetch(`${apiUrl}/api/health`);
    if (!response.ok) throw new Error(`API health check failed`);
  } catch (error) {
    console.warn('⚠️  API server may not be running. Tests will fail without it.');
    console.warn('   Start it with: cd api-server && npm run dev');
  }
});

// Clear cookies (required)
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.describe('Role Archival', () => {
  test('should archive custom role from detail page with confirmation modal', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Create a test role using factory
    const timestamp = Date.now();
    const roleId = await Factories.role.create(page, {
      name: `Test Role ${timestamp}`,
      description: 'Test role for archival',
      permissionKeys: ['products:read'],
    });

    try {
      // Navigate to role detail page
      await page.goto(`/acme/roles/${roleId}`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: /edit role/i })).toBeVisible();

      // Click archive button
      const archiveBtn = page.getByTestId('archive-role-btn');
      await expect(archiveBtn).toBeVisible();
      await archiveBtn.click();

      // Verify modal appears
      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible();
      await expect(modal.getByText(/are you sure you want to archive this role/i)).toBeVisible();

      // Confirm archive
      await modal.getByRole('button', { name: /archive/i }).click();

      // Wait for success notification
      await expect(page.getByText(/role archived successfully/i)).toBeVisible({ timeout: 10000 });

      // Verify archived badge appears
      await expect(page.getByTestId('archived-badge')).toBeVisible();

      // Verify archive button is hidden and restore button is visible
      await expect(page.getByTestId('archive-role-btn')).not.toBeVisible();
      await expect(page.getByTestId('restore-role-btn')).toBeVisible();

      // Verify save button is disabled
      const saveBtn = page.getByRole('button', { name: /save/i });
      await expect(saveBtn).toBeDisabled();
    } finally {
      // Cleanup: Delete the role via factory
      await Factories.role.delete(page, roleId);
    }
  });

  test('should cancel archive confirmation modal (verify no changes)', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Create a test role
    const timestamp = Date.now();
    const roleId = await Factories.role.create(page, {
      name: `Test Role ${timestamp}`,
      description: 'Test role for cancel',
      permissionKeys: ['products:read'],
    });

    try {
      // Navigate to role detail page
      await page.goto(`/acme/roles/${roleId}`);
      await page.waitForLoadState('networkidle');

      // Click archive button
      await page.getByTestId('archive-role-btn').click();

      // Verify modal appears
      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible();

      // Click cancel
      await modal.getByRole('button', { name: /cancel/i }).click();

      // Verify modal closes
      await expect(modal).not.toBeVisible();

      // Verify role is still active (no archived badge)
      await expect(page.getByTestId('archived-badge')).not.toBeVisible();

      // Verify archive button still visible
      await expect(page.getByTestId('archive-role-btn')).toBeVisible();
    } finally {
      // Cleanup
      await Factories.role.delete(page, roleId);
    }
  });

  test('should restore archived role from detail page', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Create a test role
    const timestamp = Date.now();
    const roleId = await Factories.role.create(page, {
      name: `Test Role ${timestamp}`,
      description: 'Test role for restore',
      permissionKeys: ['products:read'],
    });

    try {
      // Navigate to role detail page
      await page.goto(`/acme/roles/${roleId}`);
      await page.waitForLoadState('networkidle');

      // Archive the role first
      await page.getByTestId('archive-role-btn').click();
      const modal = page.getByRole('dialog');
      await modal.getByRole('button', { name: /archive/i }).click();
      await expect(page.getByText(/role archived successfully/i)).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId('archived-badge')).toBeVisible();

      // Now restore it
      const restoreBtn = page.getByTestId('restore-role-btn');
      await expect(restoreBtn).toBeVisible();
      await restoreBtn.click();

      // Wait for success notification
      await expect(page.getByText(/role restored successfully/i)).toBeVisible({ timeout: 10000 });

      // Verify archived badge is gone
      await expect(page.getByTestId('archived-badge')).not.toBeVisible();

      // Verify restore button is hidden and archive button is visible
      await expect(page.getByTestId('restore-role-btn')).not.toBeVisible();
      await expect(page.getByTestId('archive-role-btn')).toBeVisible();

      // Verify save button is enabled
      const saveBtn = page.getByRole('button', { name: /save/i });
      await expect(saveBtn).toBeEnabled();
    } finally {
      // Cleanup
      await Factories.role.delete(page, roleId);
    }
  });

  test('should filter to show only archived roles', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto('/acme/roles');
    await page.waitForLoadState('networkidle');

    // Open filters
    await page.getByRole('button', { name: /filters/i }).click();
    await page.waitForTimeout(300); // Wait for filter panel to expand

    // Change archived filter to "archived-only"
    const archiveFilterSelect = page.getByTestId('role-archived-filter-select');
    await archiveFilterSelect.click();
    await page.getByText('Archived roles only', { exact: true }).click();

    // Apply filters
    await page.getByRole('button', { name: /apply filters/i }).click();

    // Wait for URL to update
    await page.waitForURL(/archivedFilter=archived-only/, { timeout: 5000 });

    // Verify URL has archivedFilter=archived-only
    await expect(page).toHaveURL(/archivedFilter=archived-only/);

    // Verify active filter chip shows (scope to the chip badge, not the select dropdown)
    await expect(page.locator('.mantine-Badge-label').filter({ hasText: /Archived roles only/i })).toBeVisible();
  });

  test('should filter to show all roles (active + archived)', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto('/acme/roles');
    await page.waitForLoadState('networkidle');

    // Open filters
    await page.getByRole('button', { name: /filters/i }).click();
    await page.waitForTimeout(300);

    // Change archived filter to "all"
    const archiveFilterSelect = page.getByTestId('role-archived-filter-select');
    await archiveFilterSelect.click();
    await page.getByText('All roles (active + archived)', { exact: true }).click();

    // Apply filters
    await page.getByRole('button', { name: /apply filters/i }).click();

    // Wait for URL to update
    await page.waitForURL(/archivedFilter=all/, { timeout: 5000 });

    // Verify URL has archivedFilter=all
    await expect(page).toHaveURL(/archivedFilter=all/);

    // Verify active filter chip shows (scope to the chip badge, not the select dropdown)
    await expect(page.locator('.mantine-Badge-label').filter({ hasText: /All roles \(active \+ archived\)/i })).toBeVisible();
  });

  test('should show archived badge in list view for archived roles', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Create and archive a role
    const timestamp = Date.now();
    const roleName = `Test Role ${timestamp}`;
    const roleId = await Factories.role.create(page, {
      name: roleName,
      description: 'Test role for badge',
      permissionKeys: ['products:read'],
    });

    try {
      // Navigate to role and archive it
      await page.goto(`/acme/roles/${roleId}`);
      await page.waitForLoadState('networkidle');

      // Archive it
      await page.getByTestId('archive-role-btn').click();
      const modal = page.getByRole('dialog');
      await modal.getByRole('button', { name: /archive/i }).click();
      await expect(page.getByText(/role archived successfully/i)).toBeVisible({ timeout: 10000 });

      // Navigate to roles list with archived filter
      await page.goto('/acme/roles?archivedFilter=all');
      await page.waitForLoadState('networkidle');

      // Find the role in the table and verify it has archived badge
      const roleRow = page.locator('table tbody tr').filter({ hasText: roleName });
      await expect(roleRow.getByTestId('role-archived-badge')).toBeVisible();
    } finally {
      // Cleanup
      await Factories.role.delete(page, roleId);
    }
  });

  test('should verify system roles cannot be archived (button hidden)', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto('/acme/roles');
    await page.waitForLoadState('networkidle');

    // Click on OWNER role (a system role)
    const ownerRoleLink = page.locator('table tbody tr').filter({ hasText: 'OWNER' }).getByRole('link').first();
    await ownerRoleLink.click();

    await expect(page).toHaveURL(/\/roles\/.+/);

    // Verify system badge is visible
    await expect(page.getByTestId('system-badge')).toBeVisible();

    // Verify archive button is NOT visible (system roles cannot be archived)
    await expect(page.getByTestId('archive-role-btn')).not.toBeVisible();

    // Verify restore button is also not visible
    await expect(page.getByTestId('restore-role-btn')).not.toBeVisible();
  });

  test('should verify VIEWER role cannot access roles page', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Create a custom role as owner first
    const timestamp = Date.now();
    const roleId = await Factories.role.create(page, {
      name: `Test Role ${timestamp}`,
      description: 'Test role for viewer check',
      permissionKeys: ['products:read'],
    });

    try {
      // Now sign in as viewer
      await signIn(page, TEST_USERS.viewer);

      // Viewer shouldn't have access to roles page at all (roles:manage permission required)
      await page.goto('/acme/roles');
      await page.waitForLoadState('networkidle');

      // Verify viewer cannot access the page (should show permission error or redirect)
      // This test verifies RBAC is working correctly
      await expect(page.getByText(/you don't have permission/i).or(page.getByText(/unauthorized/i))).toBeVisible();
    } finally {
      // Cleanup as owner
      await signIn(page, TEST_USERS.owner);
      await Factories.role.delete(page, roleId);
    }
  });

  test('should verify archived role is read-only (cannot edit)', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Create and archive a role
    const timestamp = Date.now();
    const roleId = await Factories.role.create(page, {
      name: `Test Role ${timestamp}`,
      description: 'Test role for read-only check',
      permissionKeys: ['products:read'],
    });

    try {
      // Navigate to role and archive it
      await page.goto(`/acme/roles/${roleId}`);
      await page.waitForLoadState('networkidle');

      // Archive it
      await page.getByTestId('archive-role-btn').click();
      const modal = page.getByRole('dialog');
      await modal.getByRole('button', { name: /archive/i }).click();
      await expect(page.getByText(/role archived successfully/i)).toBeVisible({ timeout: 10000 });

      // Verify save button is disabled
      const saveBtn = page.getByRole('button', { name: /save/i });
      await expect(saveBtn).toBeDisabled();
    } finally {
      // Cleanup
      await Factories.role.delete(page, roleId);
    }
  });

  test('should clear archive filter and reset to default (active only)', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto('/acme/roles');
    await page.waitForLoadState('networkidle');

    // Open filters and set to "all"
    await page.getByRole('button', { name: /filters/i }).click();
    await page.waitForTimeout(300);

    const archiveFilterSelect = page.getByTestId('role-archived-filter-select');
    await archiveFilterSelect.click();
    await page.getByText('All roles (active + archived)', { exact: true }).click();

    // Apply filters
    await page.getByRole('button', { name: /apply filters/i }).click();

    // Wait for URL to update
    await page.waitForURL(/archivedFilter=all/, { timeout: 5000 });

    // Verify filter chip appears (scope to the chip badge)
    await expect(page.locator('.mantine-Badge-label').filter({ hasText: /All roles \(active \+ archived\)/i })).toBeVisible();

    // Click clear all filters (be specific to avoid the chip's clear button)
    await page.getByRole('button', { name: /clear all filters/i }).click();

    // Wait for URL to update to active-only
    await page.waitForURL(/archivedFilter=active-only/, { timeout: 5000 });

    // Verify URL resets to active-only
    await expect(page).toHaveURL(/archivedFilter=active-only/);

    // Verify filter chip is gone (scope to the chip badge)
    await expect(page.locator('.mantine-Badge-label').filter({ hasText: /All roles \(active \+ archived\)/i })).not.toBeVisible();
  });
});
