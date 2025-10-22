// admin-web/e2e/features/branches/branch-crud.spec.ts
import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS, Factories } from '../../helpers';

/**
 * Branch CRUD Tests
 *
 * Tests cover:
 * - List all branches with table display
 * - Filter branches by name
 * - Sort branches by name
 * - Navigate to create branch page
 * - Create branch with valid data
 * - Validation errors (empty name, duplicate slug)
 * - Edit existing branch
 * - Permission checks (VIEWER vs EDITOR)
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

test.describe('Branch CRUD - List & Navigation', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('should list all branches with table display', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    // Navigate to branches page
    await page.goto(`/${TEST_USERS.admin.tenant}/branches`);
    await page.waitForLoadState('networkidle');

    // Should show branches page heading
    await expect(page.getByRole('heading', { name: /all branches/i }).first()).toBeVisible();

    // Should have a table with branches
    await expect(page.getByTestId('branches-table')).toBeVisible();

    // Should show pagination info
    await expect(page.getByText(/showing \d+–\d+/i).first()).toBeVisible();
  });

  test('should filter branches by name', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    let branchId: string | undefined;

    try {
      // Create a test branch with unique name
      const timestamp = Date.now();
      const branchName = `Filter Test ${timestamp}`;

      branchId = await Factories.branch.create(page, {
        branchSlug: `filter-test-${timestamp}`,
        branchName: branchName,
        isActive: true,
      });

      // Add current user to the branch so they can access it
      await Factories.branch.addCurrentUserToBranch(page, branchId);

      // Navigate to branches list
      await page.goto(`/${TEST_USERS.owner.tenant}/branches`);
      await page.waitForLoadState('networkidle');

      // Open filters panel
      await page.getByTestId('branches-filter-button').click();

      // Wait for search input to be visible after collapse animation
      const searchInput = page.getByTestId('branches-search-input');
      await searchInput.waitFor({ state: 'visible' });

      // Enter search query
      await searchInput.fill(branchName);

      // Apply filters
      await page.getByRole('button', { name: /apply filters/i }).click();
      await page.waitForLoadState('networkidle');

      // Should show our filtered branch in the table (scope to table to avoid matching filter chip)
      const table = page.getByTestId('branches-table');
      await expect(table.getByText(branchName)).toBeVisible();
    } finally {
      // Cleanup
      if (branchId) {
        await Factories.branch.archive(page, branchId);
      }
    }
  });

  test('should sort branches by name', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    await page.goto(`/${TEST_USERS.admin.tenant}/branches`);
    await page.waitForLoadState('networkidle');

    // Find and click the name sort button
    const nameSortButton = page.getByRole('button', { name: /sort by name/i });
    await nameSortButton.click();

    // URL should reflect sorting
    await expect(page).toHaveURL(/sortBy=branchName/);
    await expect(page).toHaveURL(/sortDir=asc/);
  });
});

test.describe('Branch CRUD - Create Branch', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('should navigate to create branch page', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);

    await page.goto(`/${TEST_USERS.admin.tenant}/branches`);
    await page.waitForLoadState('networkidle');

    // Click "New branch" button
    await page.getByTestId('new-branch-button').click();

    // Should navigate to new branch page
    await expect(page).toHaveURL(`/${TEST_USERS.admin.tenant}/branches/new`);
    await expect(page.getByRole('heading', { name: /new branch/i })).toBeVisible();
  });

  test('should create branch with valid data', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    let branchId: string | undefined;

    try {
      // Navigate to create branch page
      await page.goto(`/${TEST_USERS.owner.tenant}/branches/new`);
      await page.waitForLoadState('networkidle');

      // Fill in the form
      await page.getByTestId('branch-slug-input').fill(`e2e-create-${timestamp}`);
      await page.getByTestId('branch-name-input').fill(`E2E Create Test ${timestamp}`);

      // Save
      await page.getByTestId('save-branch-button').click();

      // Should show success notification
      await expect(page.getByText(/branch created/i)).toBeVisible();

      // Should redirect to branch edit page
      await expect(page).toHaveURL(/\/branches\/[a-z0-9-]+/);

      // Extract branch ID from URL for cleanup
      const url = page.url();
      branchId = url.match(/\/branches\/([a-z0-9-]+)/)?.[1];
    } finally {
      // Cleanup
      if (branchId) {
        await Factories.branch.archive(page, branchId);
      }
    }
  });

  test('should show validation error for empty branch name', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    await page.goto(`/${TEST_USERS.owner.tenant}/branches/new`);
    await page.waitForLoadState('networkidle');

    // Fill only slug, leave name empty
    await page.getByTestId('branch-slug-input').fill('test-slug');

    // Try to save
    await page.getByTestId('save-branch-button').click();

    // Should show validation error notification
    await expect(page.getByText(/name is required/i)).toBeVisible();
  });

  test('should show validation error for duplicate branch slug', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    const duplicateSlug = `duplicate-slug-${timestamp}`;
    let branchId: string | undefined;

    try {
      // Create first branch via API
      branchId = await Factories.branch.create(page, {
        branchSlug: duplicateSlug,
        branchName: 'First Branch',
        isActive: true,
      });

      // Add current user to the branch so they can access it
      await Factories.branch.addCurrentUserToBranch(page, branchId);

      // Try to create second branch with same slug via UI
      await page.goto(`/${TEST_USERS.owner.tenant}/branches/new`);
      await page.waitForLoadState('networkidle');

      await page.getByTestId('branch-slug-input').fill(duplicateSlug);
      await page.getByTestId('branch-name-input').fill('Second Branch');

      await page.getByTestId('save-branch-button').click();

      // Should show duplicate slug error
      await expect(page.getByText(/already exists/i)).toBeVisible();
    } finally {
      // Cleanup
      if (branchId) {
        await Factories.branch.archive(page, branchId);
      }
    }
  });
});

test.describe('Branch CRUD - Edit Branch', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('should load existing branch data in edit mode', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    let branchId: string | undefined;

    try {
      const timestamp = Date.now();
      const branchSlug = `edit-test-${timestamp}`;
      const branchName = `Edit Test ${timestamp}`;

      // Create branch via API
      branchId = await Factories.branch.create(page, {
        branchSlug: branchSlug,
        branchName: branchName,
        isActive: true,
      });

      // Add current user to the branch so they can access it
      await Factories.branch.addCurrentUserToBranch(page, branchId);

      // Navigate to edit page
      await page.goto(`/${TEST_USERS.owner.tenant}/branches/${branchId}`);
      await page.waitForLoadState('networkidle');

      // Should show edit heading
      await expect(page.getByRole('heading', { name: /edit branch/i })).toBeVisible();

      // Form should be populated with existing data
      await expect(page.getByTestId('branch-slug-input')).toHaveValue(branchSlug);
      await expect(page.getByTestId('branch-name-input')).toHaveValue(branchName);
      await expect(page.getByTestId('branch-active-switch')).toBeChecked();
    } finally {
      // Cleanup
      if (branchId) {
        await Factories.branch.archive(page, branchId);
      }
    }
  });

  test('should update branch name successfully', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    let branchId: string | undefined;

    try {
      const timestamp = Date.now();
      const originalName = `Update Test ${timestamp}`;
      const updatedName = `${originalName} (Updated)`;

      // Create branch via API
      branchId = await Factories.branch.create(page, {
        branchSlug: `update-test-${timestamp}`,
        branchName: originalName,
        isActive: true,
      });

      // Add current user to the branch so they can access it
      await Factories.branch.addCurrentUserToBranch(page, branchId);

      // Navigate to edit page
      await page.goto(`/${TEST_USERS.owner.tenant}/branches/${branchId}`);
      await page.waitForLoadState('networkidle');

      // Wait for form to be populated
      await expect(page.getByTestId('branch-name-input')).toHaveValue(originalName);

      // Update the name
      await page.getByTestId('branch-name-input').fill(updatedName);

      // Save
      await page.getByTestId('save-branch-button').click();

      // Should show success notification
      await expect(page.getByText(/branch updated/i)).toBeVisible();
    } finally {
      // Cleanup
      if (branchId) {
        await Factories.branch.archive(page, branchId);
      }
    }
  });
});

test.describe('Branch CRUD - Permission Checks', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('viewer cannot access branches page', async ({ page }) => {
    await signIn(page, TEST_USERS.viewer);

    await page.goto(`/${TEST_USERS.viewer.tenant}/branches`);
    await page.waitForLoadState('networkidle');

    // Should show "No access" page for users without branches:manage permission
    await expect(page.getByText(/no access/i)).toBeVisible();
    await expect(page.getByText(/you don't have permission/i)).toBeVisible();
  });
});
