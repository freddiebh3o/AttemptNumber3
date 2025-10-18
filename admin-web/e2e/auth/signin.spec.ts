// [ST-001][AC-001] Sign-in page E2E acceptance tests
import { test, expect } from '@playwright/test';
import { SELECTORS } from '../helpers';

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

test.describe('[ST-001] Sign-in Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('[AC-001-1] should display email input field', async ({ page }) => {
    // Primary: Use data-testid for reliable selection
    const emailInput = page.getByTestId(SELECTORS.AUTH.EMAIL_INPUT);
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('type', 'email');
  });

  test('[AC-001-2] should display password input field', async ({ page }) => {
    // Primary: Use data-testid for reliable selection
    const passwordInput = page.getByTestId(SELECTORS.AUTH.PASSWORD_INPUT);
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('[AC-001-3] should display tenant input field', async ({ page }) => {
    // Primary: Use data-testid for reliable selection
    const tenantInput = page.getByTestId(SELECTORS.AUTH.TENANT_INPUT);
    await expect(tenantInput).toBeVisible();
  });

  test('[AC-001-4] should display sign-in button', async ({ page }) => {
    // Primary: Use data-testid for reliable selection
    const signInButton = page.getByTestId(SELECTORS.AUTH.SIGN_IN_BUTTON);
    await expect(signInButton).toBeVisible();
    await expect(signInButton).toBeEnabled();
  });

  test('[AC-001-5] should have all required fields marked', async ({ page }) => {
    const emailInput = page.getByTestId(SELECTORS.AUTH.EMAIL_INPUT);
    const passwordInput = page.getByTestId(SELECTORS.AUTH.PASSWORD_INPUT);
    const tenantInput = page.getByTestId(SELECTORS.AUTH.TENANT_INPUT);

    // Check HTML5 required attribute
    await expect(emailInput).toHaveAttribute('required');
    await expect(passwordInput).toHaveAttribute('required');
    await expect(tenantInput).toHaveAttribute('required');
  });

  test('[AC-001-6] should show page title', async ({ page }) => {
    const title = page.getByRole('heading', { name: /multi-tenant admin.*sign in/i });
    await expect(title).toBeVisible();
  });

  test('[AC-001-7] form validation: cannot submit with empty fields', async ({ page }) => {
    const signInButton = page.getByTestId(SELECTORS.AUTH.SIGN_IN_BUTTON);

    // Try to submit empty form
    await signInButton.click();

    // Browser should prevent submission (HTML5 validation)
    // Check we're still on the sign-in page
    await expect(page).toHaveURL('/');
  });
});
