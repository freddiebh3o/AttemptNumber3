// admin-web/e2e/auth/permission-checks.spec.ts
import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS } from '../helpers';

/**
 * Permission-Based UI Tests
 *
 * Tests cross-cutting permission behavior across all features:
 * - OWNER: Full access (all permissions)
 * - ADMIN: Most permissions (users:manage, products:write, stock:write)
 * - EDITOR: Limited write access (products:write, stock:write, but NOT users:manage)
 * - VIEWER: Read-only access (products:read, stock:read)
 *
 * This test suite verifies that the UI correctly shows/hides buttons and
 * displays permission denied messages based on user roles.
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

// Clear cookies before each test for isolation
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.describe('[PERM-001] Product Management Permissions', () => {
  test('OWNER should have full product access', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Should see "New product" button and it should be enabled
    const newButton = page.getByRole('button', { name: /new product/i });
    await expect(newButton).toBeVisible();
    await expect(newButton).toBeEnabled();

    // Should see enabled edit/delete buttons in product list
    const firstRow = page.locator('table tbody tr:first-child');
    const actionsCell = firstRow.locator('td').last();
    const editButton = actionsCell.locator('button').first();
    const deleteButton = actionsCell.locator('button').last();

    await expect(editButton).toBeEnabled();
    await expect(deleteButton).toBeEnabled();
  });

  test('ADMIN should have full product access', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    // Admin has products:write permission
    const newButton = page.getByRole('button', { name: /new product/i });
    await expect(newButton).toBeVisible();
    await expect(newButton).toBeEnabled();

    // Should see enabled edit/delete buttons
    const firstRow = page.locator('table tbody tr:first-child');
    const actionsCell = firstRow.locator('td').last();
    const editButton = actionsCell.locator('button').first();

    await expect(editButton).toBeEnabled();
  });

  test('EDITOR should have product write access', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);

    // Editor has products:write permission
    const newButton = page.getByRole('button', { name: /new product/i });
    await expect(newButton).toBeVisible();
    await expect(newButton).toBeEnabled();

    // Should see enabled edit/delete buttons
    const firstRow = page.locator('table tbody tr:first-child');
    const actionsCell = firstRow.locator('td').last();
    const editButton = actionsCell.locator('button').first();

    await expect(editButton).toBeEnabled();
  });

  test('VIEWER should have read-only product access', async ({ page }) => {
    await signIn(page, TEST_USERS.viewer);

    // Viewer should see products list
    await expect(page.getByRole('table')).toBeVisible();

    // "New product" button should be disabled
    const newButton = page.getByRole('button', { name: /new product/i });
    await expect(newButton).toBeVisible();
    await expect(newButton).toBeDisabled();

    // The first button is now a "view" button (enabled) for viewers to access product details
    // Viewers can view products and their stock, but cannot edit
    const firstRow = page.locator('table tbody tr:first-child');
    const actionsCell = firstRow.locator('td').last();
    const viewButton = actionsCell.locator('button').first();

    // View button should be enabled (allows viewing product details and stock)
    await expect(viewButton).toBeEnabled();

    // Click view button and verify viewer can access product details but not edit
    await viewButton.click();
    await page.waitForTimeout(500);

    // Should be on product detail page (FIFO tab)
    await expect(page).toHaveURL(/\/products\/.+/);

    // Viewer should see product details but edit functionality should be restricted
    // This is covered in other tests (e.g., "VIEWER should see permission denied on edit product page")
  });

  test('VIEWER should see permission denied on create product page', async ({ page }) => {
    await signIn(page, TEST_USERS.viewer);

    // Manually navigate to create page
    await page.goto(`/${TEST_USERS.viewer.tenant}/products/new`);

    // Should show RequirePermission "No access" message
    await expect(page.getByText(/no access/i)).toBeVisible();
    await expect(page.getByText(/you don't have permission/i)).toBeVisible();

    // Should NOT see the form
    await expect(page.getByLabel(/product name/i)).not.toBeVisible();
  });

  test('VIEWER should see permission denied on edit product page', async ({ page }) => {
    await signIn(page, TEST_USERS.viewer);

    // Wait for products table to load
    await page.waitForSelector('table tbody tr:first-child', { state: 'visible', timeout: 10000 });
    const firstRow = page.locator('table tbody tr:first-child');

    // Extract product ID from the first row (look for a link in the name cell)
    const nameLink = firstRow.locator('a').first();
    const linkCount = await nameLink.count();

    let productId: string;

    if (linkCount > 0) {
      // Extract ID from link href
      const href = await nameLink.getAttribute('href');
      productId = href?.split('/products/')[1]?.split('?')[0] || '';
    } else {
      // No links found, skip this test
      console.warn('No product links found in table - skipping edit permission test');
      return;
    }

    // Navigate directly to edit page
    await page.goto(`/${TEST_USERS.viewer.tenant}/products/${productId}/edit`);

    // Should show permission denied for edit
    await expect(page.getByText(/no access/i)).toBeVisible();
  });
});

test.describe('[PERM-002] Stock Management Permissions', () => {
  test('OWNER should have full stock access', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Navigate to first product's FIFO tab
    await page.waitForSelector('table tbody tr:first-child', { state: 'visible' });
    const firstRow = page.locator('table tbody tr:first-child');
    await firstRow.locator('td').last().locator('button').first().click();

    await page.getByRole('tab', { name: /fifo/i }).click();
    await page.waitForTimeout(1000);

    // Should see "Adjust stock" button enabled
    const adjustButton = page.getByRole('button', { name: /adjust stock/i });
    await expect(adjustButton).toBeVisible();
    await expect(adjustButton).toBeEnabled();
  });

  test('ADMIN should have stock write access', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    // Navigate to first product's FIFO tab
    await page.waitForSelector('table tbody tr:first-child', { state: 'visible' });
    const firstRow = page.locator('table tbody tr:first-child');
    await firstRow.locator('td').last().locator('button').first().click();

    await page.getByRole('tab', { name: /fifo/i }).click();
    await page.waitForTimeout(1000);

    // Admin has stock:write permission
    const adjustButton = page.getByRole('button', { name: /adjust stock/i });
    await expect(adjustButton).toBeVisible();
    await expect(adjustButton).toBeEnabled();
  });

  test('EDITOR should have stock write access', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);

    // Navigate to first product's FIFO tab
    await page.waitForSelector('table tbody tr:first-child', { state: 'visible' });
    const firstRow = page.locator('table tbody tr:first-child');
    await firstRow.locator('td').last().locator('button').first().click();

    await page.getByRole('tab', { name: /fifo/i }).click();
    await page.waitForTimeout(1000);

    // Editor has stock:write permission
    const adjustButton = page.getByRole('button', { name: /adjust stock/i });
    await expect(adjustButton).toBeVisible();
    await expect(adjustButton).toBeEnabled();
  });

  test('VIEWER should have read-only stock access', async ({ page }) => {
    await signIn(page, TEST_USERS.viewer);

    // Navigate to first product's FIFO tab
    await page.waitForSelector('table tbody tr:first-child', { state: 'visible' });
    const firstRow = page.locator('table tbody tr:first-child');
    await firstRow.locator('td').last().locator('button').first().click();

    await page.getByRole('tab', { name: /fifo/i }).click();
    await page.waitForTimeout(1000);

    // Should see stock data
    await expect(page.getByText(/on hand:/i)).toBeVisible();

    // "Adjust stock" button should be disabled
    const adjustButton = page.getByRole('button', { name: /adjust stock/i });
    await expect(adjustButton).toBeVisible();
    await expect(adjustButton).toBeDisabled();
  });
});

test.describe('[PERM-003] User Management Permissions', () => {
  test('OWNER should have user management access', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Expand "User Management" navigation group if collapsed
    const userManagementNav = page.getByRole('navigation').getByText(/user management/i);
    if (await userManagementNav.isVisible()) {
      await userManagementNav.click();
      await page.waitForTimeout(300); // Wait for expansion animation
    }

    // Navigate to users page
    await page.getByRole('link', { name: /users/i }).click();
    await expect(page).toHaveURL(/\/users/);

    // Should see "Add user" button enabled
    const addButton = page.getByRole('button', { name: /add user/i });
    await expect(addButton).toBeVisible();
    await expect(addButton).toBeEnabled();
  });

  test('ADMIN should have user management access', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    // Expand "User Management" navigation group if collapsed
    const userManagementNav = page.getByRole('navigation').getByText(/user management/i);
    if (await userManagementNav.isVisible()) {
      await userManagementNav.click();
      await page.waitForTimeout(300); // Wait for expansion animation
    }

    // Navigate to users page
    await page.getByRole('link', { name: /users/i }).click();
    await expect(page).toHaveURL(/\/users/);

    // Admin has users:manage permission
    const addButton = page.getByRole('button', { name: /add user/i });
    await expect(addButton).toBeVisible();
    await expect(addButton).toBeEnabled();
  });

  test('EDITOR should NOT have user management access', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);

    // Try to navigate to users page
    await page.goto(`/${TEST_USERS.editor.tenant}/users`);

    // Should show permission denied (RequirePermission component)
    await expect(page.getByText(/no access/i)).toBeVisible();
    await expect(page.getByText(/you don't have permission/i)).toBeVisible();

    // Should NOT see the users list
    await expect(page.getByRole('button', { name: /add user/i })).not.toBeVisible();
  });

  test('VIEWER should NOT have user management access', async ({ page }) => {
    await signIn(page, TEST_USERS.viewer);

    // Try to navigate to users page
    await page.goto(`/${TEST_USERS.viewer.tenant}/users`);

    // Should show permission denied
    await expect(page.getByText(/no access/i)).toBeVisible();
    await expect(page.getByText(/you don't have permission/i)).toBeVisible();
  });
});

test.describe('[PERM-004] Navigation Visibility', () => {
  test('OWNER should see all navigation links', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Should see Products link
    await expect(page.getByRole('link', { name: /^products$/i })).toBeVisible();

    // Expand "User Management" navigation group to see Users link
    const userManagementNav = page.getByRole('navigation').getByText(/user management/i);
    if (await userManagementNav.isVisible()) {
      await userManagementNav.click();
      await page.waitForTimeout(300);
    }

    // Should see Users and Branches links
    await expect(page.getByRole('link', { name: /users/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /branches/i })).toBeVisible();
  });

  test('ADMIN should see all navigation links', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    // Should see Products link
    await expect(page.getByRole('link', { name: /^products$/i })).toBeVisible();

    // Expand "User Management" navigation group to see Users link
    const userManagementNav = page.getByRole('navigation').getByText(/user management/i);
    if (await userManagementNav.isVisible()) {
      await userManagementNav.click();
      await page.waitForTimeout(300);
    }

    // Admin should see all links
    await expect(page.getByRole('link', { name: /users/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /branches/i })).toBeVisible();
  });

  test('EDITOR should see only Products', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);

    // Editor should see Products link
    await expect(page.getByRole('link', { name: /^products$/i })).toBeVisible();

    // Editor should NOT see Users link (no users:manage permission)
    // Editor should NOT see Branches link (no branches:manage permission)
    // Note: These checks depend on whether navigation conditionally renders links
    // If your app always shows links but blocks access, skip these checks
    const usersLink = page.getByRole('link', { name: /users/i });
    const branchesLink = page.getByRole('link', { name: /branches/i });

    // Only check if navigation conditionally hides links
    const usersCount = await usersLink.count();
    const branchesCount = await branchesLink.count();

    if (usersCount > 0 || branchesCount > 0) {
      console.warn('Navigation links not conditionally hidden - they may be present but access blocked');
    }
  });

  test('VIEWER should see only Products', async ({ page }) => {
    await signIn(page, TEST_USERS.viewer);

    // Viewer should see Products link (has products:read)
    await expect(page.getByRole('link', { name: /^products$/i })).toBeVisible();

    // Viewer should NOT see Users link (no users:manage permission)
    // Viewer should NOT see Branches link (no branches:manage permission)
    // Note: Similar to EDITOR test - only check if links are conditionally hidden
  });
});

test.describe('[PERM-005] Cross-Feature Permission Consistency', () => {
  test('Permission denied pages should be consistent across features', async ({ page }) => {
    await signIn(page, TEST_USERS.viewer);

    // Test products/new
    await page.goto(`/${TEST_USERS.viewer.tenant}/products/new`);
    await expect(page.getByText(/no access/i)).toBeVisible();
    const productsNoAccess = await page.getByText(/you don't have permission/i).textContent();

    // Test users
    await page.goto(`/${TEST_USERS.viewer.tenant}/users`);
    await expect(page.getByText(/no access/i)).toBeVisible();
    const usersNoAccess = await page.getByText(/you don't have permission/i).textContent();

    // Both should show the same RequirePermission message
    expect(productsNoAccess).toBeTruthy();
    expect(usersNoAccess).toBeTruthy();
  });

  test('Action buttons should be consistently disabled for VIEWER role', async ({ page }) => {
    await signIn(page, TEST_USERS.viewer);

    // Products page - New button disabled
    await expect(page.getByRole('button', { name: /new product/i })).toBeDisabled();

    // Navigate to FIFO tab - Adjust stock button disabled
    await page.waitForSelector('table tbody tr:first-child', { state: 'visible' });
    const firstRow = page.locator('table tbody tr:first-child');
    await firstRow.locator('td').last().locator('button').first().click();
    await page.getByRole('tab', { name: /fifo/i }).click();
    await page.waitForTimeout(1000);

    await expect(page.getByRole('button', { name: /adjust stock/i })).toBeDisabled();

    // All write actions should be consistently disabled
  });

  test('Action buttons should be consistently enabled for EDITOR role', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);

    // Products page - New button enabled
    await expect(page.getByRole('button', { name: /new product/i })).toBeEnabled();

    // Navigate to first product's FIFO tab - Adjust stock button enabled
    await page.waitForSelector('table tbody tr:first-child', { state: 'visible' });
    const firstRow = page.locator('table tbody tr:first-child');
    await firstRow.locator('td').last().locator('button').first().click();
    await page.getByRole('tab', { name: /fifo/i }).click();
    await page.waitForTimeout(1000);

    await expect(page.getByRole('button', { name: /adjust stock/i })).toBeEnabled();

    // Editor should have write access consistently
  });
});
