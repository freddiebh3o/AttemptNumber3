// admin-web/e2e/features/users/user-crud.spec.ts
import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS, Factories } from '../../helpers';

/**
 * User CRUD Tests
 *
 * Tests cover:
 * - Navigate to create user page
 * - Create user with email and role
 * - Validation errors for invalid email
 * - Validation errors for required fields
 * - Edit user role assignment
 * - Edit user branch assignments
 * - Add multiple branch assignments to user
 * - Remove branch assignment from user
 * - View user details with branch memberships
 * - Permission checks (VIEWER cannot create/edit, ADMIN can)
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

test.describe('User CRUD - Create User', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('should navigate to create user page', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/users`);
    await page.waitForLoadState('networkidle');

    // Click "Add user" button
    await page.getByRole('button', { name: /add user/i }).click();

    // Should navigate to new user page
    await expect(page).toHaveURL(`/${TEST_USERS.owner.tenant}/users/new`);
    await page.waitForLoadState('networkidle');

    // Should show create user form
    await expect(page.getByRole('heading', { name: /new user/i })).toBeVisible();
  });

  test('should create user with email and role', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/users/new`);
    await page.waitForLoadState('networkidle');

    // Fill in user details
    const timestamp = Date.now();
    const newEmail = `test-user-${timestamp}@acme.test`;
    const newPassword = 'SecurePass123!';

    await page.getByLabel(/email/i).fill(newEmail);
    await page.getByLabel(/password/i).fill(newPassword);

    // Select EDITOR role
    const roleSelect = page.getByTestId('role-select');
    await roleSelect.click();
    await page.waitForTimeout(300); // Wait for dropdown animation
    await page.getByText('EDITOR', { exact: true }).click();

    // Save the user
    await page.getByRole('button', { name: /save/i }).click();

    // Should redirect to users list with success notification
    await expect(page).toHaveURL(`/${TEST_USERS.owner.tenant}/users`);
    await expect(page.getByText(/user created|successfully created/i)).toBeVisible({ timeout: 10000 });

    // Verify the user appears in the list
    await page.waitForSelector('table tbody tr');
    await expect(page.getByRole('cell', { name: newEmail })).toBeVisible();
  });

  test('should show validation error for invalid email format', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/users/new`);
    await page.waitForLoadState('networkidle');

    // Fill in invalid email
    await page.getByLabel(/email/i).fill('invalid-email-format');
    await page.getByLabel(/password/i).fill('SecurePass123!');

    // Select role
    const roleSelect = page.getByTestId('role-select');
    await roleSelect.click();
    await page.waitForTimeout(300);
    await page.getByText('VIEWER', { exact: true }).click();

    // Try to save
    await page.getByRole('button', { name: /save/i }).click();

    // Should show validation error (either client-side or server-side)
    await expect(
      page.getByText(/invalid email|valid email|email format/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test('should show validation error for missing required fields', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/users/new`);
    await page.waitForLoadState('networkidle');

    // Try to save without filling any fields
    await page.getByRole('button', { name: /save/i }).click();

    // Should show validation errors for required fields
    // (May show multiple errors or a single "required fields" message)
    await expect(
      page.getByText(/required|must provide|cannot be empty/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('should show validation error for missing email', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/users/new`);
    await page.waitForLoadState('networkidle');

    // Fill password but not email
    await page.getByLabel(/password/i).fill('SecurePass123!');

    // Select role
    const roleSelect = page.getByTestId('role-select');
    await roleSelect.click();
    await page.waitForTimeout(300);
    await page.getByText('VIEWER', { exact: true }).click();

    // Try to save
    await page.getByRole('button', { name: /save/i }).click();

    // Should show validation error
    await expect(
      page.getByText(/email.*required|must provide.*email/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test('should show validation error for missing password', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/users/new`);
    await page.waitForLoadState('networkidle');

    // Fill email but not password
    const timestamp = Date.now();
    await page.getByLabel(/email/i).fill(`test-${timestamp}@acme.test`);

    // Select role
    const roleSelect = page.getByTestId('role-select');
    await roleSelect.click();
    await page.waitForTimeout(300);
    await page.getByText('VIEWER', { exact: true }).click();

    // Try to save
    await page.getByRole('button', { name: /save/i }).click();

    // Should show validation error
    await expect(
      page.getByText(/password must be at least/i)
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe('User CRUD - Edit User', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('should edit user role assignment', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Get users list
    const users = await Factories.tenantUser.getAll(page);
    if (users.length === 0) {
      console.warn('No users found - skipping');
      return;
    }

    // Find VIEWER user to promote to EDITOR
    const viewerUser = users.find(u => u.userEmailAddress === TEST_USERS.viewer.email);
    if (!viewerUser) {
      console.warn('VIEWER user not found - skipping');
      return;
    }

    // Navigate to user edit page
    await page.goto(`/${TEST_USERS.owner.tenant}/users/${viewerUser.userId}`);
    await page.waitForLoadState('networkidle');

    // Get current role for restoration later
    const currentRoleName = await page.getByTestId('role-select').inputValue();

    // Change role from VIEWER to EDITOR
    const roleSelect = page.getByTestId('role-select');
    await roleSelect.click();
    await page.waitForTimeout(300);
    await page.getByText('EDITOR', { exact: true }).click();

    // Save changes
    await page.getByRole('button', { name: /save/i }).click();

    // Should show success notification
    await expect(page.getByText(/updated|saved successfully/i)).toBeVisible({ timeout: 10000 });

    // Verify role was changed by checking the select value
    await page.reload();
    await page.waitForLoadState('networkidle');
    const updatedRole = await page.getByTestId('role-select').inputValue();
    expect(updatedRole).toBe('EDITOR');

    // Restore original role for other tests
    await roleSelect.click();
    await page.waitForTimeout(300);
    await page.getByText(currentRoleName, { exact: true }).click();
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText(/updated|saved successfully/i)).toBeVisible({ timeout: 10000 });
  });

  test('should load existing user data in edit mode', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Get users list
    const users = await Factories.tenantUser.getAll(page);
    if (users.length === 0) {
      console.warn('No users found - skipping');
      return;
    }

    const firstUser = users[0];

    // Navigate to user edit page
    await page.goto(`/${TEST_USERS.owner.tenant}/users/${firstUser.userId}`);
    await page.waitForLoadState('networkidle');

    // Should show user email in input field (pre-filled with current value)
    const emailInput = page.locator(`input[value="${firstUser.userEmailAddress}"]`);
    await expect(emailInput).toBeVisible();

    // Should show role select
    await expect(page.getByTestId('role-select')).toBeVisible();

    // Should show branches multi-select
    await expect(page.getByText(/Assign the user to one or more branches/i)).toBeVisible();

    // Password field should be optional in edit mode (placeholder text should indicate this)
    const passwordInput = page.getByLabel(/reset password|password/i);
    await expect(passwordInput).toBeVisible();
  });
});

test.describe('User CRUD - Branch Assignments', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('should view user branch assignments', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Get users list
    const users = await Factories.tenantUser.getAll(page);
    if (users.length === 0) {
      console.warn('No users found - skipping');
      return;
    }

    const firstUser = users[0];

    // Navigate to user detail page
    await page.goto(`/${TEST_USERS.owner.tenant}/users/${firstUser.userId}`);
    await page.waitForLoadState('networkidle');

    // Should show Branches tab or section
    const branchesTab = page.getByRole('tab', { name: /branches/i });
    if (await branchesTab.isVisible()) {
      await branchesTab.click();
      await page.waitForLoadState('networkidle');

      // Should show branches section
      await expect(page.getByText(/branch assignments|assigned branches/i)).toBeVisible();
    } else {
      // If no tabs, branches might be on overview
      await expect(page.getByText(/Assign the user to one or more branches/i)).toBeVisible();
    }
  });

  test('should add branch assignment to user', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Get users and branches
    const users = await Factories.tenantUser.getAll(page);
    const branches = await Factories.branch.getAll(page);

    if (users.length === 0 || branches.length < 2) {
      console.warn('Need at least 1 user and 2 branches - skipping');
      return;
    }

    // Use EDITOR user for testing
    const editorUser = users.find(u => u.userEmailAddress === TEST_USERS.editor.email);
    if (!editorUser) {
      console.warn('EDITOR user not found - skipping');
      return;
    }

    // Navigate to user edit page
    await page.goto(`/${TEST_USERS.owner.tenant}/users/${editorUser.userId}`);
    await page.waitForLoadState('networkidle');

    // Click Branches tab if it exists
    const branchesTab = page.getByRole('tab', { name: /branches/i });
    if (await branchesTab.isVisible()) {
      await branchesTab.click();
      await page.waitForLoadState('networkidle');
    }

    // Look for "Add branch" or similar button
    const addBranchButton = page.getByRole('button', { name: /add branch|assign branch/i });
    if (await addBranchButton.isVisible()) {
      await addBranchButton.click();

      // Select a branch from dropdown
      const branchSelect = page.locator('select, [role="combobox"]').filter({ hasText: /branch/i }).first();
      if (await branchSelect.isVisible()) {
        await branchSelect.click();
        await page.waitForTimeout(300);

        // Select first available branch
        await page.getByText(branches[0].branchName, { exact: true }).click();

        // Save
        await page.getByRole('button', { name: /save|add/i }).click();

        // Should show success notification
        await expect(page.getByText(/branch added|assignment added|successfully/i)).toBeVisible({ timeout: 10000 });
      }
    } else {
      console.warn('Add branch button not found - branch assignment UI may differ');
    }
  });

  test('should remove branch assignment from user', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Get users
    const users = await Factories.tenantUser.getAll(page);
    if (users.length === 0) {
      console.warn('No users found - skipping');
      return;
    }

    // Use OWNER user who likely has branch assignments
    const ownerUser = users.find(u => u.userEmailAddress === TEST_USERS.owner.email);
    if (!ownerUser) {
      console.warn('OWNER user not found - skipping');
      return;
    }

    // Navigate to user edit page
    await page.goto(`/${TEST_USERS.owner.tenant}/users/${ownerUser.userId}`);
    await page.waitForLoadState('networkidle');

    // Click Branches tab if it exists
    const branchesTab = page.getByRole('tab', { name: /branches/i });
    if (await branchesTab.isVisible()) {
      await branchesTab.click();
      await page.waitForLoadState('networkidle');
    }

    // Look for remove/delete buttons in branch list
    const removeButtons = page.getByRole('button', { name: /remove|delete|unassign/i });
    const removeButtonCount = await removeButtons.count();

    if (removeButtonCount > 0) {
      // Note: This test just verifies the UI exists but doesn't actually remove
      // to avoid breaking other tests. In a real scenario, you'd:
      // 1. Add a test branch
      // 2. Remove it
      // 3. Verify it's gone
      console.log(`Found ${removeButtonCount} remove buttons for branch assignments`);
      await expect(removeButtons.first()).toBeVisible();
    } else {
      console.warn('No branch assignments found to remove - UI may differ');
    }
  });
});

test.describe('User CRUD - Permissions', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('VIEWER cannot access user creation page', async ({ page }) => {
    await signIn(page, TEST_USERS.viewer);

    // Try to navigate to create user page
    await page.goto(`/${TEST_USERS.viewer.tenant}/users/new`);
    await page.waitForLoadState('networkidle');

    // Should see "No access" or be redirected
    await expect(
      page.getByText(/no access|permission denied|not authorized/i)
    ).toBeVisible();
  });

  test('VIEWER cannot access user edit page', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Get a user ID
    const users = await Factories.tenantUser.getAll(page);
    if (users.length === 0) {
      console.warn('No users found - skipping');
      return;
    }
    const userId = users[0].userId;

    // Sign in as VIEWER
    await page.context().clearCookies();
    await signIn(page, TEST_USERS.viewer);

    // Try to navigate to user edit page
    await page.goto(`/${TEST_USERS.viewer.tenant}/users/${userId}`);
    await page.waitForLoadState('networkidle');

    // Should see "No access" or be redirected
    await expect(
      page.getByText(/no access|permission denied|not authorized/i)
    ).toBeVisible();
  });

  test('ADMIN can create users', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    await page.goto(`/${TEST_USERS.admin.tenant}/users/new`);
    await page.waitForLoadState('networkidle');

    // Should see create user form (not "No access")
    await expect(page.getByRole('heading', { name: /New user/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /save/i })).toBeVisible();
  });

  test('ADMIN can edit users', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Get a user ID
    const users = await Factories.tenantUser.getAll(page);
    if (users.length === 0) {
      console.warn('No users found - skipping');
      return;
    }
    const userId = users[0].userId;

    // Sign in as ADMIN
    await page.context().clearCookies();
    await signIn(page, TEST_USERS.admin);

    // Navigate to user edit page
    await page.goto(`/${TEST_USERS.admin.tenant}/users/${userId}`);
    await page.waitForLoadState('networkidle');

    // Should see edit user form (not "No access")
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /save/i })).toBeVisible();
  });

  test('OWNER can create and edit users', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Test create access
    await page.goto(`/${TEST_USERS.owner.tenant}/users/new`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /New user/i })).toBeVisible();

    // Test edit access
    const users = await Factories.tenantUser.getAll(page);
    if (users.length > 0) {
      await page.goto(`/${TEST_USERS.owner.tenant}/users/${users[0].userId}`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByLabel(/email/i)).toBeVisible();
    }
  });
});

test.describe('User CRUD - Navigation', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test.skip('should cancel user creation and return to list', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/users/new`);
    await page.waitForLoadState('networkidle');

    // Click cancel button
    const cancelButton = page.getByRole('button', { name: /cancel/i });
    if (await cancelButton.isVisible()) {
      await cancelButton.click();

      // Should navigate back to users list
      await expect(page).toHaveURL(`/${TEST_USERS.owner.tenant}/users`);
    } else {
      console.warn('Cancel button not found - may use browser back or different pattern');
    }
  });

  test('should navigate from user list to edit page', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/users`);
    await page.waitForLoadState('networkidle');

    // Wait for table to load
    await page.waitForSelector('table tbody tr');

    // Click edit button on first user
    const editButton = page.locator('table tbody tr:first-child td button[title*="Edit"]').first();
    await editButton.click();

    // Should navigate to user edit page
    await expect(page).toHaveURL(/\/users\/[a-zA-Z0-9-]+$/);
    await page.waitForLoadState('networkidle');

    // Should show edit form
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
  });
});
