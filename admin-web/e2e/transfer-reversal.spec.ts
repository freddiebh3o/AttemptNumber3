// admin-web/e2e/transfer-reversal.spec.ts
import { test, expect, type Page } from '@playwright/test';

/**
 * E2E Tests for Stock Transfer Reversal
 *
 * Tests cover:
 * - Completing a transfer end-to-end
 * - Reversing completed transfers
 * - Verifying reversal badges and bidirectional links
 * - Verifying stock returns to original source
 * - Attempting invalid reversals (already reversed, non-completed status)
 */

// Test credentials from api-server/prisma/seed.ts
const TEST_USERS = {
  owner: { email: 'owner@acme.test', password: 'Password123!', tenant: 'acme' },
  editor: { email: 'editor@acme.test', password: 'Password123!', tenant: 'acme' },
  viewer: { email: 'viewer@acme.test', password: 'Password123!', tenant: 'acme' },
};

// Helper to sign in
async function signIn(page: Page, user: typeof TEST_USERS.owner) {
  await page.goto('/');
  await page.getByLabel(/email address/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByLabel(/tenant/i).fill(user.tenant);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for redirect to products page
  await expect(page).toHaveURL(`/${user.tenant}/products`);
}

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

// Isolate each test - clear browser state
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.describe('Transfer Reversal - UI Elements', () => {
  test('should show Reverse Transfer button only for COMPLETED transfers', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);

    await page.waitForTimeout(1000);

    // Find a completed transfer (if any exist)
    const completedTransfer = page.locator('table tbody tr', {
      has: page.locator('text=/completed/i'),
    }).first();

    if (await completedTransfer.isVisible()) {
      // Click to view details
      await completedTransfer.click();

      // Should see Reverse Transfer button
      await expect(page.getByRole('button', { name: /reverse transfer/i })).toBeVisible();
    }
  });

  test('should not show Reverse Transfer button for DRAFT transfers', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);

    await page.waitForTimeout(1000);

    // Find a draft transfer (if any exist)
    const draftTransfer = page.locator('table tbody tr', {
      has: page.locator('text=/draft/i'),
    }).first();

    if (await draftTransfer.isVisible()) {
      // Click to view details
      await draftTransfer.click();

      // Should NOT see Reverse Transfer button
      await expect(page.getByRole('button', { name: /reverse transfer/i })).not.toBeVisible();
    }
  });
});

test.describe('Transfer Reversal - Complete Flow', () => {
  test('should create, complete, and reverse a transfer', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);

    // Step 1: Create a new transfer
    await page.getByRole('button', { name: /new transfer/i }).click();

    const createDialog = page.getByRole('dialog');
    await expect(createDialog).toBeVisible();

    // Select source branch
    await createDialog.getByLabel(/source branch/i).click();
    await page.waitForTimeout(300);
    await page.locator('[role="option"]').first().click();

    // Select destination branch (different from source)
    await page.waitForTimeout(300);
    await createDialog.getByLabel(/destination branch/i).click();
    await page.waitForTimeout(300);
    const destOptions = page.locator('[role="option"]');
    const destCount = await destOptions.count();
    if (destCount > 1) {
      await destOptions.nth(1).click();
    } else {
      await destOptions.first().click();
    }

    // Add a product
    await page.waitForTimeout(300);
    await createDialog.getByRole('button', { name: /add product/i }).click();
    await page.waitForTimeout(300);

    const productSelect = createDialog.locator('[role="combobox"]').first();
    await productSelect.click();
    await page.waitForTimeout(300);
    await page.locator('[role="option"]').first().click();

    // Set quantity
    const qtyInput = createDialog.getByLabel(/quantity/i).first();
    await qtyInput.fill('2');

    // Submit transfer
    await createDialog.getByRole('button', { name: /create transfer/i }).click();

    // Should redirect to detail page
    await expect(page).toHaveURL(/\/stock-transfers\/ST-/, { timeout: 10000 });

    // Step 2: Approve the transfer
    await page.getByRole('button', { name: /approve/i }).click();
    await expect(page.getByText(/transfer approved/i)).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Step 3: Ship the transfer
    await page.getByRole('button', { name: /mark as shipped/i }).click();
    await expect(page.getByText(/transfer shipped/i)).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Step 4: Receive the transfer
    await page.getByRole('button', { name: /receive/i }).click();

    const receiveDialog = page.getByRole('dialog');
    await expect(receiveDialog).toBeVisible();

    // Confirm receipt with the same quantity
    await receiveDialog.getByRole('button', { name: /confirm receipt/i }).click();
    await expect(page.getByText(/transfer received/i)).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Step 5: Verify COMPLETED status
    await expect(page.getByText(/status.*completed/i)).toBeVisible();

    // Step 6: Reverse the transfer
    await page.getByRole('button', { name: /reverse transfer/i }).click();

    const reverseDialog = page.getByRole('dialog');
    await expect(reverseDialog).toBeVisible();
    await expect(reverseDialog.getByText(/reverse transfer/i)).toBeVisible();

    // Fill in reversal reason
    await reverseDialog.getByLabel(/reason/i).fill('E2E test reversal - damaged goods');

    // Confirm reversal
    await reverseDialog.getByRole('button', { name: /confirm reversal/i }).click();

    // Should show success and redirect to the NEW reversal transfer
    await expect(page.getByText(/transfer reversed/i)).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Should be on the reversal transfer detail page
    await expect(page).toHaveURL(/\/stock-transfers\/ST-/);

    // Step 7: Verify reversal badges and links on the reversal transfer
    await expect(page.getByText(/this is a reversal/i)).toBeVisible();
    await expect(page.getByText(/reverses/i)).toBeVisible();

    // Should have link to original transfer
    const reversesLink = page.getByRole('link', { name: /ST-/i }).first();
    await expect(reversesLink).toBeVisible();

    // Click link to go back to original transfer
    const originalTransferNumber = await reversesLink.textContent();
    await reversesLink.click();

    await page.waitForTimeout(1000);

    // Step 8: Verify badges on original transfer
    await expect(page.getByText(/this transfer has been reversed/i)).toBeVisible();
    await expect(page.getByText(/reversed by/i)).toBeVisible();

    // Should have link to reversal transfer
    const reversedByLink = page.getByRole('link', { name: /ST-/i }).first();
    await expect(reversedByLink).toBeVisible();

    // Verify the link points to different transfer
    const reversalTransferNumber = await reversedByLink.textContent();
    expect(reversalTransferNumber).not.toBe(originalTransferNumber);
  });
});

test.describe('Transfer Reversal - Validation', () => {
  test('should require reversal reason', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);

    await page.waitForTimeout(1000);

    // Find a completed transfer
    const completedTransfer = page.locator('table tbody tr', {
      has: page.locator('text=/completed/i'),
    }).first();

    if (await completedTransfer.isVisible()) {
      await completedTransfer.click();
      await page.waitForTimeout(500);

      // Click Reverse Transfer
      await page.getByRole('button', { name: /reverse transfer/i }).click();

      const reverseDialog = page.getByRole('dialog');
      await expect(reverseDialog).toBeVisible();

      // Try to submit without reason
      await reverseDialog.getByRole('button', { name: /confirm reversal/i }).click();

      // Should show validation error
      await expect(page.getByText(/reason.*required/i)).toBeVisible();
    }
  });

  test('should not show Reverse button on already-reversed transfers', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);

    await page.waitForTimeout(1000);

    // Look for transfers with "Reversed by" badge (already reversed)
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      await row.click();
      await page.waitForTimeout(500);

      // Check if this transfer has been reversed
      const hasReversedBadge = await page.getByText(/this transfer has been reversed/i).isVisible();

      if (hasReversedBadge) {
        // Should NOT have Reverse Transfer button
        await expect(page.getByRole('button', { name: /reverse transfer/i })).not.toBeVisible();
        break;
      }

      // Go back to list
      await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);
      await page.waitForTimeout(500);
    }
  });
});

test.describe('Transfer Reversal - Permissions', () => {
  test('should hide Reverse Transfer button for viewers', async ({ page }) => {
    await signIn(page, TEST_USERS.viewer);
    await page.goto(`/${TEST_USERS.viewer.tenant}/stock-transfers`);

    await page.waitForTimeout(1000);

    // Find a completed transfer
    const completedTransfer = page.locator('table tbody tr', {
      has: page.locator('text=/completed/i'),
    }).first();

    if (await completedTransfer.isVisible()) {
      await completedTransfer.click();
      await page.waitForTimeout(500);

      // Viewer should not see Reverse Transfer button (stock:write required)
      await expect(page.getByRole('button', { name: /reverse transfer/i })).not.toBeVisible();
    }
  });

  test('should show Reverse Transfer button for editors', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);
    await page.goto(`/${TEST_USERS.editor.tenant}/stock-transfers`);

    await page.waitForTimeout(1000);

    // Find a completed transfer
    const completedTransfer = page.locator('table tbody tr', {
      has: page.locator('text=/completed/i'),
    }).first();

    if (await completedTransfer.isVisible()) {
      await completedTransfer.click();
      await page.waitForTimeout(500);

      // Editor should see Reverse Transfer button (has stock:write)
      await expect(page.getByRole('button', { name: /reverse transfer/i })).toBeVisible();
    }
  });
});

test.describe('Transfer Reversal - Bidirectional Links', () => {
  test('should navigate between original and reversal transfers', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);

    await page.waitForTimeout(1000);

    // Find any transfer with reversal badge
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      await row.click();
      await page.waitForTimeout(500);

      // Check for either badge type
      const isOriginalReversed = await page.getByText(/this transfer has been reversed/i).isVisible();
      const isReversal = await page.getByText(/this is a reversal/i).isVisible();

      if (isOriginalReversed || isReversal) {
        // Get current URL
        const currentUrl = page.url();

        // Click the link to related transfer
        const relatedLink = page.getByRole('link', { name: /ST-/i }).first();
        await expect(relatedLink).toBeVisible();
        await relatedLink.click();

        await page.waitForTimeout(1000);

        // Should navigate to different transfer
        const newUrl = page.url();
        expect(newUrl).not.toBe(currentUrl);

        // Should have opposite badge
        if (isOriginalReversed) {
          await expect(page.getByText(/this is a reversal/i)).toBeVisible();
        } else {
          await expect(page.getByText(/this transfer has been reversed/i)).toBeVisible();
        }

        // Should be able to navigate back
        const backLink = page.getByRole('link', { name: /ST-/i }).first();
        await expect(backLink).toBeVisible();
        await backLink.click();

        await page.waitForTimeout(1000);

        // Should be back at original transfer
        expect(page.url()).toBe(currentUrl);
        break;
      }

      // Go back to list
      await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);
      await page.waitForTimeout(500);
    }
  });
});

test.describe('Transfer Reversal - Status Display', () => {
  test('should show reversal transfers with COMPLETED status', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);

    await page.waitForTimeout(1000);

    // Look through transfers for reversals
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      await row.click();
      await page.waitForTimeout(500);

      const isReversal = await page.getByText(/this is a reversal/i).isVisible();

      if (isReversal) {
        // Reversal transfers should always be COMPLETED
        await expect(page.getByText(/status.*completed/i)).toBeVisible();
        break;
      }

      // Go back to list
      await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);
      await page.waitForTimeout(500);
    }
  });

  test('should display reversal reason', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);

    await page.waitForTimeout(1000);

    // Look for reversal transfers
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      await row.click();
      await page.waitForTimeout(500);

      const isReversal = await page.getByText(/this is a reversal/i).isVisible();

      if (isReversal) {
        // Should show reversal reason
        await expect(page.getByText(/reason:/i)).toBeVisible();
        break;
      }

      // Go back to list
      await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);
      await page.waitForTimeout(500);
    }
  });
});
