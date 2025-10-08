// [ST-001][AC-001] Sign-in page E2E acceptance tests
import { test, expect } from '@playwright/test';

test.describe('[ST-001] Sign-in Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('[AC-001-1] should display email input field', async ({ page }) => {
    const emailInput = page.getByLabel(/email address/i);
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('type', 'email');
  });

  test('[AC-001-2] should display password input field', async ({ page }) => {
    const passwordInput = page.getByLabel(/password/i);
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('[AC-001-3] should display tenant input field', async ({ page }) => {
    const tenantInput = page.getByLabel(/tenant/i);
    await expect(tenantInput).toBeVisible();
  });

  test('[AC-001-4] should display sign-in button', async ({ page }) => {
    const signInButton = page.getByRole('button', { name: /sign in/i });
    await expect(signInButton).toBeVisible();
    await expect(signInButton).toBeEnabled();
  });

  test('[AC-001-5] should have all required fields marked', async ({ page }) => {
    const emailInput = page.getByLabel(/email address/i);
    const passwordInput = page.getByLabel(/password/i);
    const tenantInput = page.getByLabel(/tenant/i);

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
    const signInButton = page.getByRole('button', { name: /sign in/i });

    // Try to submit empty form
    await signInButton.click();

    // Browser should prevent submission (HTML5 validation)
    // Check we're still on the sign-in page
    await expect(page).toHaveURL('/');
  });
});
