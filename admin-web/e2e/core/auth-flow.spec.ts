// [ST-002] Authentication Flow E2E acceptance tests
/**
 * Tests the complete authentication flow including:
 * - Sign-in with valid/invalid credentials
 * - Redirect to products page after successful sign-in
 * - Session persistence across page reloads
 * - Sign-out functionality
 * - Protected route access control
 *
 * IMPORTANT: These tests require the API server to be running.
 * Before running these tests, start the API server:
 *   cd api-server && npm run dev
 *
 * Then run these tests from admin-web:
 *   cd admin-web && npm run test:accept -- auth-flow.spec.ts
 */
import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS, SELECTORS } from '../helpers';

// Check API server health before tests
test.beforeAll(async () => {
  const apiUrl = process.env.VITE_API_BASE_URL || 'http://localhost:4000';
  try {
    const response = await fetch(`${apiUrl}/api/health`);
    if (!response.ok) {
      throw new Error(`API health check failed: ${response.status}`);
    }
  } catch (error) {
    console.warn(
      '⚠️  API server may not be running. Please start it with: cd api-server && npm run dev'
    );
    // Note: We don't throw here to allow tests to run and show more descriptive failures
  }
});

// Clear cookies before each test for isolation
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.describe('[ST-002] Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start at sign-in page
    await page.goto('/');
  });

  test.describe('[AC-002-1] Sign-In with Valid Credentials', () => {
    test('should redirect to products page after successful sign-in', async ({ page }) => {
      // Use shared signIn helper
      await signIn(page, TEST_USERS.owner);

      // Should redirect to /:tenantSlug/products (already verified by signIn helper)
      // Additional verification: Should show products page content
      await expect(page.getByRole('heading', { name: /all products/i }).first()).toBeVisible();
    });

    test('should show sign-out button in navigation after sign-in', async ({ page }) => {
      // Sign in using shared helper
      await signIn(page, TEST_USERS.admin);

      // Should show sign-out button in header (note: data-testid not yet added to sign-out button)
      await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
    });
  });

  test.describe('[AC-002-2] Sign-In with Invalid Credentials', () => {
    test('should show error notification for incorrect password', async ({ page }) => {
      // Fill in form with invalid password using data-testid
      await page.getByTestId(SELECTORS.AUTH.EMAIL_INPUT).fill(TEST_USERS.owner.email);
      await page.getByTestId(SELECTORS.AUTH.PASSWORD_INPUT).fill('WrongPassword123!');
      await page.getByTestId(SELECTORS.AUTH.TENANT_INPUT).fill(TEST_USERS.owner.tenant);

      // Submit form
      await page.getByTestId(SELECTORS.AUTH.SIGN_IN_BUTTON).click();

      // Should show error notification (Mantine notifications appear as role="alert")
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByText(/sign-in failed/i)).toBeVisible();

      // Should remain on sign-in page
      await expect(page).toHaveURL('/');
    });

    test('should show error notification for non-existent user', async ({ page }) => {
      // Fill in form with non-existent email using data-testid
      await page.getByTestId(SELECTORS.AUTH.EMAIL_INPUT).fill('nonexistent@example.com');
      await page.getByTestId(SELECTORS.AUTH.PASSWORD_INPUT).fill('Password123!');
      await page.getByTestId(SELECTORS.AUTH.TENANT_INPUT).fill('acme');

      // Submit form
      await page.getByTestId(SELECTORS.AUTH.SIGN_IN_BUTTON).click();

      // Should show error notification
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByText(/sign-in failed/i)).toBeVisible();

      // Should remain on sign-in page
      await expect(page).toHaveURL('/');
    });

    test('should show error notification for wrong tenant', async ({ page }) => {
      // Fill in form with valid user but wrong tenant using data-testid
      await page.getByTestId(SELECTORS.AUTH.EMAIL_INPUT).fill(TEST_USERS.owner.email);
      await page.getByTestId(SELECTORS.AUTH.PASSWORD_INPUT).fill(TEST_USERS.owner.password);
      await page.getByTestId(SELECTORS.AUTH.TENANT_INPUT).fill('nonexistent-tenant');

      // Submit form
      await page.getByTestId(SELECTORS.AUTH.SIGN_IN_BUTTON).click();

      // Should show error notification
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByText(/sign-in failed/i)).toBeVisible();

      // Should remain on sign-in page
      await expect(page).toHaveURL('/');
    });
  });

  test.describe('[AC-002-3] Session Persistence', () => {
    test('should maintain session after page reload', async ({ page }) => {
      // Sign in using shared helper
      await signIn(page, TEST_USERS.editor);

      // Reload the page
      await page.reload();

      // Should still be on products page (not redirected to sign-in)
      await expect(page).toHaveURL(`/${TEST_USERS.editor.tenant}/products`);
      await expect(page.getByRole('heading', { name: /all products/i }).first()).toBeVisible();
    });

    test('should navigate to different pages while authenticated', async ({ page }) => {
      // Sign in as owner (has all permissions)
      await signIn(page, TEST_USERS.owner);

      // Navigate to users page (requires users:manage permission)
      await page.goto(`/${TEST_USERS.owner.tenant}/users`);
      await expect(page).toHaveURL(`/${TEST_USERS.owner.tenant}/users`);
      // Use first() to handle multiple headings with same text
      await expect(page.getByRole('heading', { name: /users/i }).first()).toBeVisible();

      // Navigate back to products page
      await page.goto(`/${TEST_USERS.owner.tenant}/products`);
      await expect(page).toHaveURL(`/${TEST_USERS.owner.tenant}/products`);
      await expect(page.getByRole('heading', { name: /all products/i }).first()).toBeVisible();
    });
  });

  test.describe('[AC-002-4] Sign-Out Flow', () => {
    test('should sign out and redirect to sign-in page', async ({ page }) => {
      // Sign in using shared helper
      await signIn(page, TEST_USERS.viewer);

      // Click sign out button (it's a button, not a menu item)
      // Note: data-testid not yet added to sign-out button
      await page.getByRole('button', { name: /sign out/i }).click();

      // Should redirect to sign-in page (note: it's /sign-in not /)
      await expect(page).toHaveURL('/sign-in');
      await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    });

    test('should not access protected pages after sign-out', async ({ page }) => {
      // Sign in using shared helper
      await signIn(page, TEST_USERS.editor);

      // Click sign out button
      await page.getByRole('button', { name: /sign out/i }).click();

      // Wait for redirect to sign-in page
      await expect(page).toHaveURL('/sign-in');

      // Try to access products page directly after sign-out
      await page.goto(`/${TEST_USERS.editor.tenant}/products`);

      // With the new 401 handler, should be automatically redirected back to sign-in
      // (because the session is expired, API returns 401, and the handler redirects)
      // The URL may include query params like ?reason=session_expired
      await expect(page).toHaveURL(/\/sign-in/);
      await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();

      // Should NOT show the actual products content
      await expect(page.getByRole('heading', { name: /all products/i })).not.toBeVisible();
    });
  });

  test.describe('[AC-002-5] Protected Route Access', () => {
    test('should redirect to sign-in when accessing protected route without authentication', async ({ page }) => {
      // Try to access products page directly without signing in
      await page.goto('/acme/products');

      // Should be redirected to sign-in page
      // The URL may include query params like ?reason=unauthorized
      await expect(page).toHaveURL(/\/sign-in/);
      await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();

      // Should NOT show the actual products content
      await expect(page.getByRole('heading', { name: /all products/i })).not.toBeVisible();
    });

    test('should redirect to sign-in when accessing user management without authentication', async ({ page }) => {
      // Try to access users page directly without signing in
      await page.goto('/acme/users');

      // Should be redirected to sign-in page
      // The URL may include query params like ?reason=unauthorized
      await expect(page).toHaveURL(/\/sign-in/);
      await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();

      // Should NOT show the actual users content
      await expect(page.getByRole('heading', { name: /users/i })).not.toBeVisible();
    });

    test('should allow access to protected routes after authentication', async ({ page }) => {
      // Sign in using shared helper
      await signIn(page, TEST_USERS.admin);

      // Now try to access users page (admin has users:manage permission)
      await page.goto(`/${TEST_USERS.admin.tenant}/users`);

      // Should successfully access the page
      await expect(page).toHaveURL(`/${TEST_USERS.admin.tenant}/users`);
      await expect(page.getByRole('heading', { name: /users/i }).first()).toBeVisible();
    });
  });
});
