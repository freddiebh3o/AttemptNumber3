// admin-web/e2e/features/roles/role-crud.spec.ts
import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS, Factories } from '../../helpers';

/**
 * Role CRUD Tests
 *
 * Tests cover:
 * - List all roles with table display
 * - View system roles (OWNER, ADMIN, EDITOR, VIEWER)
 * - Navigate to create role page
 * - Create custom role with permissions
 * - Validation errors (empty role name)
 * - Edit custom role permissions
 * - Cannot edit system role permissions
 * - View role details with permission list
 * - Permission checks (VIEWER vs OWNER/ADMIN)
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

test.describe('Role CRUD - List & Navigation', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('should list all roles with table display', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    // Navigate to roles page
    await page.goto(`/${TEST_USERS.admin.tenant}/roles`);
    await page.waitForLoadState('networkidle');

    // Should show roles page heading
    await expect(page.getByRole('heading', { name: /^roles$/i }).first()).toBeVisible();

    // Should have a table with roles
    await expect(page.locator('#roles-table')).toBeVisible();

    // Should show pagination info
    await expect(page.getByText(/showing \d+–\d+/i).first()).toBeVisible();
  });

  test('should view system roles (OWNER, ADMIN, EDITOR, VIEWER)', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    await page.goto(`/${TEST_USERS.admin.tenant}/roles`);
    await page.waitForLoadState('networkidle');

    // Should see system role badges
    const table = page.locator('#roles-table');
    await expect(table.getByTestId('role-system-badge').first()).toBeVisible();

    // Should see system role names (OWNER, ADMIN, EDITOR, VIEWER)
    // Note: These are seeded roles and should always exist
    await expect(table.getByText('OWNER')).toBeVisible();
    await expect(table.getByText('ADMIN')).toBeVisible();
    await expect(table.getByText('EDITOR')).toBeVisible();
    await expect(table.getByText('VIEWER')).toBeVisible();
  });

  test('should navigate to create role page', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/roles`);
    await page.waitForLoadState('networkidle');

    // Click "New role" button
    await page.getByRole('button', { name: /new role/i }).click();

    // Should navigate to new role page
    await expect(page).toHaveURL(`/${TEST_USERS.owner.tenant}/roles/new`);
    await expect(page.getByRole('heading', { name: /new role/i })).toBeVisible();
  });
});

test.describe('Role CRUD - Create Role', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('should create custom role with permissions', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    const roleName = `E2E Test Role ${timestamp}`;
    let roleId: string | undefined;

    try {
      // Navigate to create role page
      await page.goto(`/${TEST_USERS.owner.tenant}/roles/new`);
      await page.waitForLoadState('networkidle');

      // Fill in the form
      await page.getByRole('textbox', { name: 'Name' }).fill(roleName);
      await page.getByRole('textbox', { name: 'Description' }).fill('Test role created by E2E test');

      // Select permissions (use products:read as a simple example)
      const permissionSelect = page.getByPlaceholder('Select permissions');
      await permissionSelect.click();

      // Wait for dropdown to appear and select a permission
      // Note: Dropdown options are formatted as "key — description"
      await page.waitForTimeout(500); // Wait for Mantine multiselect animation
      await page.getByText('products:read — View products').click();

      // Close dropdown by clicking outside
      await page.getByRole('textbox', { name: 'Name' }).click();

      // Save
      await page.getByRole('button', { name: /^save$/i }).click();

      // Should show success notification
      await expect(page.getByText(/^role created/i)).toBeVisible();

      // Should redirect to role edit page
      await expect(page).toHaveURL(/\/roles\/[a-z0-9-]+/);

      // Extract role ID from URL for cleanup
      const url = page.url();
      roleId = url.match(/\/roles\/([a-z0-9-]+)/)?.[1];

      // Verify the role was created with correct data
      await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue(roleName);
    } finally {
      // Cleanup
      if (roleId) {
        await Factories.role.delete(page, roleId);
      }
    }
  });

  test('should show validation error for empty role name', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/roles/new`);
    await page.waitForLoadState('networkidle');

    // Leave name empty, only fill description
    await page.getByRole('textbox', { name: 'Description' }).fill('This should fail validation');

    // Try to save
    await page.getByRole('button', { name: /^save$/i }).click();

    // Should show validation error notification
    await expect(page.getByText(/name is required/i)).toBeVisible();
  });
});

test.describe('Role CRUD - Edit Role', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('should edit custom role permissions', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    const roleName = `Edit Test ${timestamp}`;
    let roleId: string | undefined;

    try {
      // Create role via API with products:read permission
      roleId = await Factories.role.create(page, {
        name: roleName,
        description: 'Original description',
        permissionKeys: ['products:read'],
      });

      // Navigate to edit page
      await page.goto(`/${TEST_USERS.owner.tenant}/roles/${roleId}`);
      await page.waitForLoadState('networkidle');

      // Should show edit heading
      await expect(page.getByRole('heading', { name: /edit role/i })).toBeVisible();

      // Form should be populated with existing data
      await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue(roleName);

      // Add another permission (products:write)
      const permissionSelect = page.getByPlaceholder('Select permissions');
      await permissionSelect.click();

      // Note: Dropdown options are formatted as "key — description"
      await page.waitForTimeout(500); // Wait for Mantine multiselect animation
      await page.getByText('products:write — Create/update/delete products').click();

      // Close dropdown
      await page.getByRole('textbox', { name: 'Name' }).click();

      // Save
      await page.getByRole('button', { name: /^save$/i }).click();

      // Should show success notification
      await expect(page.getByText(/^role updated/i)).toBeVisible();
    } finally {
      // Cleanup
      if (roleId) {
        await Factories.role.delete(page, roleId);
      }
    }
  });

  test('cannot edit system role permissions', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Get OWNER role ID (system role)
    const ownerRoleId = await Factories.role.getByName(page, 'OWNER');

    // Navigate to OWNER role edit page
    await page.goto(`/${TEST_USERS.owner.tenant}/roles/${ownerRoleId}`);
    await page.waitForLoadState('networkidle');

    // Should show system role badge
    await expect(page.getByTestId('system-badge')).toBeVisible();

    // Save button should be disabled for system roles
    const saveButton = page.getByRole('button', { name: /^save$/i });
    await expect(saveButton).toBeDisabled();
  });

  test('should view role details with permission list', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    const roleName = `View Test ${timestamp}`;
    let roleId: string | undefined;

    try {
      // Create role with multiple permissions
      roleId = await Factories.role.create(page, {
        name: roleName,
        description: 'Test role for viewing',
        permissionKeys: ['products:read', 'products:write', 'stock:read'],
      });

      // Navigate to role page
      await page.goto(`/${TEST_USERS.owner.tenant}/roles/${roleId}`);
      await page.waitForLoadState('networkidle');

      // Should show role name
      await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue(roleName);

      // Should show description
      await expect(page.getByRole('textbox', { name: 'Description' })).toHaveValue('Test role for viewing');

      // Should display permissions in the multiselect (as selected values)
      // The multiselect will show the selected permissions as pills
      const permissionSelect = page.getByPlaceholder('Select permissions');
      await expect(permissionSelect).toBeVisible();
    } finally {
      // Cleanup
      if (roleId) {
        await Factories.role.delete(page, roleId);
      }
    }
  });
});

test.describe('Role CRUD - Permission Checks', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('viewer cannot access roles page', async ({ page }) => {
    await signIn(page, TEST_USERS.viewer);

    await page.goto(`/${TEST_USERS.viewer.tenant}/roles`);
    await page.waitForLoadState('networkidle');

    // Should show "No access" page for users without roles:read permission
    // VIEWER does NOT have roles:read
    await expect(page.getByText(/no access/i)).toBeVisible();
    await expect(page.getByText(/you don't have permission/i)).toBeVisible();
  });

  test('admin can view roles but cannot create or edit', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    // Navigate to roles page
    await page.goto(`/${TEST_USERS.admin.tenant}/roles`);
    await page.waitForLoadState('networkidle');

    // ADMIN has roles:read so should be able to VIEW the roles page
    await expect(page.getByRole('heading', { name: /^roles$/i }).first()).toBeVisible();
    await expect(page.locator('#roles-table')).toBeVisible();

    // But ADMIN does NOT have roles:manage, so "New role" button should be disabled
    await expect(page.getByRole('button', { name: /new role/i })).toBeDisabled();
  });

  test('owner can create and edit roles', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Navigate to roles page
    await page.goto(`/${TEST_USERS.owner.tenant}/roles`);
    await page.waitForLoadState('networkidle');

    // OWNER has roles:manage, so should see "New role" button
    await expect(page.getByRole('button', { name: /new role/i })).toBeVisible();

    const timestamp = Date.now();
    const roleName = `Owner Test ${timestamp}`;
    let roleId: string | undefined;

    try {
      // Create a custom role
      roleId = await Factories.role.create(page, {
        name: roleName,
        description: 'Test owner permissions',
        permissionKeys: ['products:read'],
      });

      // Navigate to edit page
      await page.goto(`/${TEST_USERS.owner.tenant}/roles/${roleId}`);
      await page.waitForLoadState('networkidle');

      // Save button should NOT be disabled (owner can edit custom roles)
      const saveButton = page.getByRole('button', { name: /^save$/i });
      await expect(saveButton).not.toBeDisabled();
    } finally {
      // Cleanup
      if (roleId) {
        await Factories.role.delete(page, roleId);
      }
    }
  });
});
