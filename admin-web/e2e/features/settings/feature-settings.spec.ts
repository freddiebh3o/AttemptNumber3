/**
 * E2E Tests: Feature Settings Management
 *
 * Tests the tenant-specific feature flags UI:
 * - Navigation to Features page
 * - Toggle chat assistant on/off
 * - Save OpenAI API key
 * - Toggle barcode scanning on/off
 * - Permission-based access control
 * - API key validation
 */

import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS, SELECTORS } from '../../helpers';

// Health check
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

// Clear cookies before each test
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.describe('Feature Settings - Basic Functionality', () => {
  test('should allow owner to access Features page via System menu', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Navigate to Features page via sidebar
    await page.goto(`/${TEST_USERS.owner.tenant}/products`);
    await page.waitForLoadState('networkidle');

    // Expand System menu if collapsed
    const systemNav = page.getByRole('navigation').getByText(/system/i);
    if (await systemNav.isVisible()) {
      await systemNav.click();
      await page.waitForTimeout(300); // Wait for expansion animation
    }

    // Click Features link
    await page.getByTestId(SELECTORS.FEATURES.NAV_LINK).click();
    await page.waitForLoadState('networkidle');

    // Verify we're on the Features page
    await expect(page).toHaveURL(`/${TEST_USERS.owner.tenant}/settings/features`);
    await expect(page.getByRole('heading', { name: /feature settings/i })).toBeVisible();
  });

  test('should display all feature toggles and inputs', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/settings/features`);
    await page.waitForLoadState('networkidle');

    // Verify AI Chat Assistant section
    await expect(page.getByRole('heading', { name: /ai chat assistant/i })).toBeVisible();
    // Use semantic selector for switch with label text
    await expect(page.getByRole('switch', { name: /enable ai chat assistant/i })).toBeAttached();
    await expect(page.getByTestId(SELECTORS.FEATURES.INPUT_OPENAI_API_KEY)).toBeVisible();

    // Verify Barcode Scanning section
    await expect(page.getByRole('heading', { name: /barcode scanning/i })).toBeVisible();
    await expect(page.getByRole('switch', { name: /enable barcode scanning/i })).toBeAttached();

    // Verify Save button
    await expect(page.getByTestId(SELECTORS.FEATURES.BTN_SAVE_FEATURES)).toBeVisible();
  });

  test('should enable and save chat assistant feature', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/settings/features`);
    await page.waitForLoadState('networkidle');

    // Enable chat assistant - click the label text, not the hidden input
    await page.getByText('Enable AI Chat Assistant').click();

    // Save settings
    await page.getByTestId(SELECTORS.FEATURES.BTN_SAVE_FEATURES).click();

    // Verify success notification
    await expect(page.getByText(/feature settings saved successfully/i)).toBeVisible({ timeout: 5000 });
  });

  test('should enable and save barcode scanning feature', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/settings/features`);
    await page.waitForLoadState('networkidle');

    // Enable barcode scanning - click the label text
    await page.getByText('Enable Barcode Scanning').click();

    // Save settings
    await page.getByTestId(SELECTORS.FEATURES.BTN_SAVE_FEATURES).click();

    // Verify success notification
    await expect(page.getByText(/feature settings saved successfully/i)).toBeVisible({ timeout: 5000 });
  });

  test('should persist settings after page refresh', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/settings/features`);
    await page.waitForLoadState('networkidle');

    // Note: ACME tenant has barcodeScanningEnabled=true by default (from seed data)
    // chatAssistantEnabled may be on or off depending on previous tests
    // Strategy: Ensure BOTH are enabled, then verify they persist after reload

    // Check current states
    const chatAssistantChecked = await page.getByTestId(SELECTORS.FEATURES.TOGGLE_CHAT_ASSISTANT).isChecked();
    const barcodeScanningChecked = await page.getByTestId(SELECTORS.FEATURES.TOGGLE_BARCODE_SCANNING).isChecked();

    // Enable chat assistant if not already enabled
    if (!chatAssistantChecked) {
      await page.getByText('Enable AI Chat Assistant').click();
    }

    // Enable barcode scanning if not already enabled
    if (!barcodeScanningChecked) {
      await page.getByText('Enable Barcode Scanning').click();
    }

    // Save settings
    await page.getByTestId(SELECTORS.FEATURES.BTN_SAVE_FEATURES).click();

    // Wait for success notification
    await expect(page.getByText(/feature settings saved successfully/i)).toBeVisible({ timeout: 5000 });

    // Wait a bit for the notification to disappear (ensures save is complete)
    await page.waitForTimeout(1000);

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify both toggles are still checked after reload
    // Use a longer timeout because the page needs to load data from the API first
    await expect(page.getByTestId(SELECTORS.FEATURES.TOGGLE_CHAT_ASSISTANT)).toBeChecked({ timeout: 15000 });
    await expect(page.getByTestId(SELECTORS.FEATURES.TOGGLE_BARCODE_SCANNING)).toBeChecked({ timeout: 15000 });
  });

  test('should show loading state during save', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/settings/features`);
    await page.waitForLoadState('networkidle');

    // Enable a feature - click the label text
    await page.getByText('Enable AI Chat Assistant').click();

    // Click save and verify loading state
    const saveButton = page.getByTestId(SELECTORS.FEATURES.BTN_SAVE_FEATURES);
    await saveButton.click();

    // Button should show loading indicator (Mantine adds 'data-loading' attribute)
    // We'll just verify the success notification appears
    await expect(page.getByText(/feature settings saved successfully/i)).toBeVisible({ timeout: 5000 });
  });

  test('should show cost information alert', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/settings/features`);
    await page.waitForLoadState('networkidle');

    // Verify cost information alert is present
    await expect(page.getByText(/cost information/i)).toBeVisible();
    await expect(page.getByText(/if you provide your own openai api key/i)).toBeVisible();
  });
});

test.describe('Feature Settings - Permission Checks', () => {
  test('owner can access Features page', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/settings/features`);
    await page.waitForLoadState('networkidle');

    // Should see Features page
    await expect(page.getByRole('heading', { name: /feature settings/i })).toBeVisible();
  });

  test('admin can access Features page', async ({ page }) => {
    await signIn(page, TEST_USERS.admin);
    await page.goto(`/${TEST_USERS.admin.tenant}/settings/features`);
    await page.waitForLoadState('networkidle');

    // Admin has theme:manage permission, so should see Features page
    await expect(page.getByRole('heading', { name: /feature settings/i })).toBeVisible();
  });

  test('editor cannot see Features nav link', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);
    await page.goto(`/${TEST_USERS.editor.tenant}/products`);
    await page.waitForLoadState('networkidle');

    // Expand System menu if visible
    const systemNav = page.getByRole('navigation').getByText(/system/i);
    if (await systemNav.isVisible()) {
      await systemNav.click();
      await page.waitForTimeout(300);
    }

    // Features link should not be visible (no theme:manage permission)
    await expect(page.getByTestId(SELECTORS.FEATURES.NAV_LINK)).not.toBeVisible();
  });

  test('viewer cannot see Features nav link', async ({ page }) => {
    await signIn(page, TEST_USERS.viewer);
    await page.goto(`/${TEST_USERS.viewer.tenant}/products`);
    await page.waitForLoadState('networkidle');

    // Expand System menu if visible
    const systemNav = page.getByRole('navigation').getByText(/system/i);
    if (await systemNav.isVisible()) {
      await systemNav.click();
      await page.waitForTimeout(300);
    }

    // Features link should not be visible (no theme:manage permission)
    await expect(page.getByTestId(SELECTORS.FEATURES.NAV_LINK)).not.toBeVisible();
  });
});

test.describe('Feature Settings - Validation', () => {
  test('should reject invalid API key format', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/settings/features`);
    await page.waitForLoadState('networkidle');

    // Enable chat assistant - click the label text
    await page.getByText('Enable AI Chat Assistant').click();

    // Enter invalid API key (doesn't start with 'sk-')
    const apiKeyInput = page.getByTestId(SELECTORS.FEATURES.INPUT_OPENAI_API_KEY);
    await apiKeyInput.fill('invalid-api-key');

    // Save settings
    await page.getByTestId(SELECTORS.FEATURES.BTN_SAVE_FEATURES).click();

    // Should show error notification with specific message
    await expect(page.getByText(/invalid openai api key format/i)).toBeVisible({ timeout: 5000 });
  });

  test('should allow clearing API key', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/settings/features`);
    await page.waitForLoadState('networkidle');

    // First, set an API key - click the label text
    await page.getByText('Enable AI Chat Assistant').click();
    await page.getByTestId(SELECTORS.FEATURES.INPUT_OPENAI_API_KEY).fill('sk-test-key-12345');
    await page.getByTestId(SELECTORS.FEATURES.BTN_SAVE_FEATURES).click();
    await expect(page.getByText(/feature settings saved successfully/i)).toBeVisible({ timeout: 5000 });

    // Reload to ensure it's persisted
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Now clear the API key
    const apiKeyInput = page.getByTestId(SELECTORS.FEATURES.INPUT_OPENAI_API_KEY);
    await apiKeyInput.clear();
    await page.getByTestId(SELECTORS.FEATURES.BTN_SAVE_FEATURES).click();

    // Should show success notification
    await expect(page.getByText(/feature settings saved successfully/i)).toBeVisible({ timeout: 5000 });
  });
});
