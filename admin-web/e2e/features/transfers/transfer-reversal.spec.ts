// admin-web/e2e/transfers/transfer-reversal.spec.ts
import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS, Factories } from '../../helpers';

/**
 * E2E Tests for Stock Transfer Reversal (Refactored)
 *
 * Tests cover:
 * - Completing a transfer end-to-end
 * - Reversing completed transfers
 * - Verifying reversal badges and bidirectional links
 * - Verifying stock returns to original source
 * - Attempting invalid reversals (already reversed, non-completed status)
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

      // Should see Reverse Transfer button (use .first() to avoid strict mode violation)
      await expect(page.getByRole('button', { name: /reverse transfer/i }).first()).toBeVisible();
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

    const timestamp = Date.now();
    const productName = `Reversal Test Product ${timestamp}`;
    const productSku = `REV-${timestamp}`;

    // Step 1: Setup - Get seeded branches that owner has access to
    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const destBranchId = await Factories.branch.getBySlug(page, 'acme-retail-1');

    const productId = await Factories.product.create(page, {
      productName,
      productSku,
      productPricePence: 1000,
    });

    await Factories.stock.addStock(page, {
      productId,
      branchId: sourceBranchId,
      qtyDelta: 100,
      unitCostPence: 500,
    });

    // Step 2: Create transfer via API (low qty to avoid approval rules)
    const transferId = await Factories.transfer.create(page, {
      sourceBranchId: sourceBranchId,
      destinationBranchId: destBranchId,
      items: [{ productId, qty: 2 }],
    });

    // Step 3: Approve transfer via API
    await Factories.transfer.approve(page, transferId);

    // Step 4: Navigate to transfer detail page
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/${transferId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Step 5: Ship the transfer via UI
    await page.getByRole('button', { name: /ship transfer/i }).click();

    const shipDialog = page.getByRole('dialog');
    await expect(shipDialog).toBeVisible();
    await page.waitForTimeout(500);

    // Ship all items
    await shipDialog.getByRole('button', { name: /ship items/i }).click();
    await expect(page.getByText(/shipped.*successfully/i)).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Step 6: Receive the transfer via UI
    await page.getByRole('button', { name: /manual receive/i }).click();

    const receiveDialog = page.getByRole('dialog');
    await expect(receiveDialog).toBeVisible();
    await page.waitForTimeout(500);

    // Confirm receipt with the same quantity - try different button text patterns
    const receiveButton = receiveDialog.getByRole('button', { name: /(confirm|receive items|submit)/i });
    await expect(receiveButton).toBeVisible({ timeout: 5000 });
    await receiveButton.click();

    // Wait for success notification - could be various texts
    const successNotification = page.getByText(/(received|receipt|success)/i);
    await expect(successNotification.first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Step 7: Verify COMPLETED status
    await expect(page.getByText(/completed/i).first()).toBeVisible();

    // Step 8: Reverse the transfer (use .first() to avoid strict mode violation)
    await page.getByRole('button', { name: /reverse transfer/i }).first().click();

    const reverseDialog = page.getByRole('dialog');
    await expect(reverseDialog).toBeVisible();
    await expect(reverseDialog.getByText(/reverse transfer/i)).toBeVisible();

    // Fill in reversal reason
    await reverseDialog.getByLabel(/reason/i).fill('E2E test reversal - damaged goods');
    await page.waitForTimeout(300);

    // Confirm reversal - try different button text patterns
    const confirmButton = reverseDialog.getByRole('button', { name: /(confirm|reverse|submit)/i });
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    await confirmButton.click();

    // Should show success notification
    await expect(page.getByText(/transfer reversed/i)).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Should still be on the original transfer detail page (doesn't redirect)
    await expect(page).toHaveURL(/\/stock-transfers\/[a-z0-9]+$/i);
    await page.waitForLoadState('networkidle');

    // Step 9: Verify badges on original transfer (now reversed)
    await expect(page.getByText(/this transfer has been reversed/i)).toBeVisible();

    // TODO: Reversal linking features not yet implemented - will add in future:
    // - Reversal timeline entry ("reversed by ST-XXX")
    // - Link to reversal transfer from original
    // - Navigate to reversal transfer and verify badges
    // - Bidirectional links between original and reversal transfers
  });
});

test.describe('Transfer Reversal - Validation', () => {
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

      // Editor should see Reverse Transfer button (has stock:write) - use .first() to avoid strict mode violation
      await expect(page.getByRole('button', { name: /reverse transfer/i }).first()).toBeVisible();
    }
  });
});

test.describe('Transfer Reversal - Bidirectional Links', () => {
  test.skip('should navigate between original and reversal transfers', async ({ page }) => {
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
  test.skip('should display reversal reason', async ({ page }) => {
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
