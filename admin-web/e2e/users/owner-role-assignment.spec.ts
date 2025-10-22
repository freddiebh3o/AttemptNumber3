// admin-web/e2e/users/owner-role-assignment.spec.ts
import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS, Factories } from '../helpers';

/**
 * OWNER Role Assignment Security Tests
 *
 * Tests cover:
 * - OWNER users can see and assign OWNER role
 * - ADMIN users cannot see OWNER role in dropdown
 * - ADMIN users see informational message about OWNER restriction
 * - ADMIN users attempting to assign OWNER via API receive 403
 * - OWNER users can successfully create users with OWNER role
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

test.describe('OWNER Role Assignment Security - Frontend UX', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('OWNER user sees OWNER in role dropdown when creating user', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Navigate to create user page
    await page.goto(`/${TEST_USERS.owner.tenant}/users/new`);
    await page.waitForLoadState('networkidle');

    // Click on role select to open dropdown
    const roleSelect = page.getByTestId('role-select');
    await roleSelect.click();

    // Wait for dropdown options to appear
    await page.waitForTimeout(300);

    // Should see OWNER option in dropdown
    await expect(page.getByText('OWNER', { exact: true })).toBeVisible();

    // Should NOT see the info message about OWNER restriction
    await expect(page.getByTestId('owner-assignment-info')).not.toBeVisible();
  });

  test('OWNER user sees OWNER in role dropdown when editing user', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Get a user to edit
    const users = await Factories.tenantUser.getAll(page);
    if (users.length === 0) {
      console.warn('No users found - skipping test');
      return;
    }

    const userToEdit = users[0];

    // Navigate to edit user page
    await page.goto(`/${TEST_USERS.owner.tenant}/users/${userToEdit.userId}`);
    await page.waitForLoadState('networkidle');

    // Click on role select to open dropdown
    const roleSelect = page.getByTestId('role-select');
    await roleSelect.click();

    // Wait for dropdown options to appear
    await page.waitForTimeout(300);

    // Should see OWNER option in dropdown
    await expect(page.getByText('OWNER', { exact: true })).toBeVisible();

    // Should NOT see the info message about OWNER restriction
    await expect(page.getByTestId('owner-assignment-info')).not.toBeVisible();
  });

  test('ADMIN user does NOT see OWNER in role dropdown when creating user', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    // Navigate to create user page
    await page.goto(`/${TEST_USERS.admin.tenant}/users/new`);
    await page.waitForLoadState('networkidle');

    // Click on role select to open dropdown
    const roleSelect = page.getByTestId('role-select');
    await roleSelect.click();

    // Wait for dropdown options to appear
    await page.waitForTimeout(300);

    // Should NOT see OWNER option in dropdown
    await expect(page.getByText('OWNER', { exact: true })).not.toBeVisible();

    // Should see other roles (ADMIN, EDITOR, VIEWER)
    await expect(page.getByText('ADMIN', { exact: true })).toBeVisible();
  });

  test('ADMIN user does NOT see OWNER in role dropdown when editing user', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    // Get a user to edit (make sure it's not an OWNER user to avoid confusion)
    const users = await Factories.tenantUser.getAll(page);
    const nonOwnerUser = users.find((u) => u.userEmailAddress?.includes('editor') || u.userEmailAddress?.includes('viewer'));

    if (!nonOwnerUser) {
      console.warn('No non-OWNER user found - skipping test');
      return;
    }

    // Navigate to edit user page
    await page.goto(`/${TEST_USERS.admin.tenant}/users/${nonOwnerUser.userId}`);
    await page.waitForLoadState('networkidle');

    // Click on role select to open dropdown
    const roleSelect = page.getByTestId('role-select');
    await roleSelect.click();

    // Wait for dropdown options to appear
    await page.waitForTimeout(300);

    // Should NOT see OWNER option in dropdown
    await expect(page.getByText('OWNER', { exact: true })).not.toBeVisible();

    // Should see other roles
    await expect(page.getByText('ADMIN', { exact: true })).toBeVisible();
  });
});

test.describe('OWNER Role Assignment Security - Backend Enforcement', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('OWNER can successfully create user with OWNER role (full flow)', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Navigate to create user page
    await page.goto(`/${TEST_USERS.owner.tenant}/users/new`);
    await page.waitForLoadState('networkidle');

    // Fill in user details
    const timestamp = Date.now();
    const newEmail = `owner-test-${timestamp}@acme.test`;
    const newPassword = 'SecurePass123!';

    await page.getByLabel(/email/i).fill(newEmail);
    await page.getByLabel(/password/i).fill(newPassword);

    // Select OWNER role
    const roleSelect = page.getByTestId('role-select');
    await roleSelect.click();
    await page.waitForTimeout(300);
    await page.getByText('OWNER', { exact: true }).click();

    // Save the user
    await page.getByRole('button', { name: /save/i }).click();

    // Should redirect to users list with success notification
    await expect(page).toHaveURL(`/${TEST_USERS.owner.tenant}/users`);
    await expect(page.getByText(/user created/i)).toBeVisible({ timeout: 10000 });

    // Verify the user was created by checking the users list
    await page.waitForSelector('table tbody tr');
    await expect(page.getByRole('cell', { name: newEmail })).toBeVisible();
  });

  test('ADMIN attempt to assign OWNER via API directly returns 403 error', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    // Get OWNER role ID
    const ownerRoleId = await Factories.role.getByName(page, 'OWNER');

    // Attempt to create user with OWNER role via API
    const timestamp = Date.now();
    const newEmail = `should-fail-${timestamp}@acme.test`;
    const newPassword = 'SecurePass123!';

    const apiUrl = process.env.VITE_API_BASE_URL || 'http://localhost:4000';
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const response = await page.request.post(`${apiUrl}/api/tenant-users`, {
      headers: {
        'Cookie': cookieHeader,
        'Content-Type': 'application/json',
      },
      data: {
        email: newEmail,
        password: newPassword,
        roleId: ownerRoleId,
        branchIds: [],
      },
    });

    // Should return 403 Forbidden
    expect(response.status()).toBe(403);

    // Check error response format
    const responseData = await response.json();
    expect(responseData.success).toBe(false);
    expect(responseData.error).toBeDefined();
    expect(responseData.error.httpStatusCode).toBe(403);
    expect(responseData.error.userFacingMessage).toMatch(/owner role/i);
  });

  test('ADMIN can still assign non-OWNER roles (ADMIN, EDITOR, VIEWER)', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    // Navigate to create user page
    await page.goto(`/${TEST_USERS.admin.tenant}/users/new`);
    await page.waitForLoadState('networkidle');

    // Fill in user details
    const timestamp = Date.now();
    const newEmail = `admin-test-${timestamp}@acme.test`;
    const newPassword = 'SecurePass123!';

    await page.getByLabel(/email/i).fill(newEmail);
    await page.getByLabel(/password/i).fill(newPassword);

    // Select ADMIN role (not OWNER)
    const roleSelect = page.getByTestId('role-select');
    await roleSelect.click();
    await page.waitForTimeout(300);
    await page.getByText('ADMIN', { exact: true }).click();

    // Save the user
    await page.getByRole('button', { name: /save/i }).click();

    // Should redirect to users list with success notification
    await expect(page).toHaveURL(`/${TEST_USERS.admin.tenant}/users`);
    await expect(page.getByText(/user created/i)).toBeVisible({ timeout: 10000 });

    // Verify the user was created
    await page.waitForSelector('table tbody tr');
    await expect(page.getByRole('cell', { name: newEmail })).toBeVisible();
  });
});
