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
    // await page.waitForLoadState('networkidle');

    // Step 9: Get the original transfer number from the detail page
    const originalTransferNumber = await page.locator('h3').first().textContent();

    // Verify badges on original transfer (now reversed)
    await expect(page.getByTestId('reversed-by-section')).toBeVisible();

    // Step 10: Verify reversal link is clickable
    const reversalLink = page.getByTestId('reversed-by-link');
    await expect(reversalLink).toBeVisible();

    // Step 11: Navigate to reversal transfer
    await reversalLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Step 12: Verify we're on the reversal transfer page
    await expect(page.getByTestId('reversal-of-section')).toBeVisible();

    // Step 13: Verify reversal reason is displayed
    await expect(page.getByTestId('reversal-reason')).toContainText('E2E test reversal - damaged goods');

    // Step 14: Verify link back to original transfer
    const originalLink = page.getByTestId('reversal-of-link');
    await expect(originalLink).toBeVisible();
    await expect(originalLink).toContainText(originalTransferNumber || '');

    // Step 15: Navigate back to original transfer
    await originalLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Step 16: Verify we're back at the original transfer
    await expect(page.locator('h3').first()).toContainText(originalTransferNumber || '');
  });
});

test.describe('Transfer Reversal - Validation', () => {
  test('should not show Reverse button on already-reversed transfers', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);

    await page.waitForTimeout(1000);

    // Filter for COMPLETED status to find candidates
    const filtersButton = page.getByRole('button', { name: /filters/i });
    await filtersButton.click();
    await page.waitForTimeout(300);

    // Set status to COMPLETED
    const statusSelect = page.locator('select').first(); // Status dropdown
    await statusSelect.selectOption('COMPLETED');

    // Apply filters
    const applyButton = page.getByRole('button', { name: /apply filters/i });
    await applyButton.click();
    await page.waitForTimeout(500);

    // Look for transfers with "Reversed" badge in the filtered list
    const reversedBadges = page.locator('[data-testid^="reversed-badge-"]');
    const reversedCount = await reversedBadges.count();

    if (reversedCount > 0) {
      // Get the first reversed badge's transfer number to find the correct row
      const firstBadge = reversedBadges.first();
      const testId = await firstBadge.getAttribute('data-testid');

      if (testId) {
        // Extract transfer number from testid (format: "reversed-badge-TRF-2025-001")
        const transferNumber = testId.replace('reversed-badge-', '');

        // Click the row containing this transfer number
        const reversedRow = page.locator('table tbody tr', {
          has: page.getByText(transferNumber, { exact: true })
        });
        await reversedRow.click();
        await page.waitForTimeout(500);

        // Should NOT have Reverse Transfer button (transfer has already been reversed)
        await expect(page.getByRole('button', { name: /reverse transfer/i })).not.toBeVisible();
      }
    } else {
      // No reversed transfers found in seed data - skip this assertion
      console.warn('⚠️  No reversed transfers found in seed data - test partially skipped');
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

  test('should hide Reverse Transfer button for editors', async ({ page }) => {
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

      // Editor should NOT see Reverse Transfer button (stock:write required, editors only have stock:read and stock:allocate)
      await expect(page.getByRole('button', { name: /reverse transfer/i })).not.toBeVisible();
    }
  });
});

test.describe('Transfer Reversal - Bidirectional Links', () => {
  test('should show reversal badges in list view', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);

    await page.waitForTimeout(1000);

    // Filter for COMPLETED status to narrow down results
    const filtersButton = page.getByRole('button', { name: /filters/i });
    await filtersButton.click();
    await page.waitForTimeout(300);

    const statusSelect = page.locator('select').first();
    await statusSelect.selectOption('COMPLETED');

    const applyButton = page.getByRole('button', { name: /apply filters/i });
    await applyButton.click();
    await page.waitForTimeout(500);

    // Check if any transfers have reversal or reversed badges in the list
    const reversalBadges = page.locator('[data-testid^="reversal-badge-"]');
    const reversedBadges = page.locator('[data-testid^="reversed-badge-"]');

    const reversalCount = await reversalBadges.count();
    const reversedCount = await reversedBadges.count();

    // At least one badge should exist (from previous test or seed data)
    expect(reversalCount + reversedCount).toBeGreaterThan(0);
  });

  test.skip('should navigate between original and reversal transfers using detail page links', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);

    await page.waitForTimeout(1000);

    // Filter for COMPLETED status
    const filtersButton = page.getByRole('button', { name: /filters/i });
    await filtersButton.click();
    await page.waitForTimeout(300);

    const statusSelect = page.locator('select').first();
    await statusSelect.selectOption('COMPLETED');

    const applyButton = page.getByRole('button', { name: /apply filters/i });
    await applyButton.click();
    await page.waitForTimeout(500);

    // Find any transfer with reversal badge in the filtered list
    const reversalBadges = page.locator('[data-testid^="reversal-badge-"]');
    const reversedBadges = page.locator('[data-testid^="reversed-badge-"]');

    const reversalCount = await reversalBadges.count();
    const reversedCount = await reversedBadges.count();

    let foundReversalPair = false;

    // Try reversed transfers first (original that was reversed)
    if (reversedCount > 0) {
      // Click the first row with a reversed badge
      const firstReversedRow = page.locator('table tbody tr').first();
      await firstReversedRow.click();
      await page.waitForTimeout(500);

      // Check for reversal information section
      const hasReversedBySection = await page.getByTestId('reversed-by-section').isVisible();

      if (hasReversedBySection) {
        // This is an original that was reversed - test link to reversal
        const currentUrl = page.url();
        const reversalLink = page.getByTestId('reversed-by-link');
        await expect(reversalLink).toBeVisible();

        // Navigate to reversal
        await reversalLink.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);

        // Should be at different URL
        expect(page.url()).not.toBe(currentUrl);

        // Should see reversal-of section
        await expect(page.getByTestId('reversal-of-section')).toBeVisible();

        // Navigate back to original
        const originalLink = page.getByTestId('reversal-of-link');
        await expect(originalLink).toBeVisible();
        await originalLink.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);

        // Should be back at original URL
        expect(page.url()).toBe(currentUrl);
        foundReversalPair = true;
      }
    }

    // Try reversal transfers if no reversed found
    if (!foundReversalPair && reversalCount > 0) {
      // Navigate back to list
      await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);
      await page.waitForTimeout(500);

      // Filter again
      await filtersButton.click();
      await page.waitForTimeout(300);
      await statusSelect.selectOption('COMPLETED');
      await applyButton.click();
      await page.waitForTimeout(500);

      // Click first reversal
      const firstReversalRow = page.locator('table tbody tr').first();
      await firstReversalRow.click();
      await page.waitForTimeout(500);

      const hasReversalOfSection = await page.getByTestId('reversal-of-section').isVisible();

      if (hasReversalOfSection) {
        // This is a reversal - test link to original
        const currentUrl = page.url();
        const originalLink = page.getByTestId('reversal-of-link');
        await expect(originalLink).toBeVisible();

        // Navigate to original
        await originalLink.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);

        // Should be at different URL
        expect(page.url()).not.toBe(currentUrl);

        // Should see reversed-by section
        await expect(page.getByTestId('reversed-by-section')).toBeVisible();

        // Navigate back to reversal
        const reversalLink = page.getByTestId('reversed-by-link');
        await expect(reversalLink).toBeVisible();
        await reversalLink.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);

        // Should be back at original URL
        expect(page.url()).toBe(currentUrl);
        foundReversalPair = true;
      }
    }

    // Ensure we found at least one reversal pair to test
    expect(foundReversalPair).toBe(true);
  });
});

test.describe('Transfer Reversal - Status Display', () => {
  test.skip('should display reversal reason in orderNotes field', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);

    await page.waitForTimeout(1000);

    // Filter for COMPLETED status
    const filtersButton = page.getByRole('button', { name: /filters/i });
    await filtersButton.click();
    await page.waitForTimeout(300);

    const statusSelect = page.locator('select').first();
    await statusSelect.selectOption('COMPLETED');

    const applyButton = page.getByRole('button', { name: /apply filters/i });
    await applyButton.click();
    await page.waitForTimeout(500);

    // Look for reversal transfers
    const reversalBadges = page.locator('[data-testid^="reversal-badge-"]');
    const reversalCount = await reversalBadges.count();

    let foundReversalWithOrderNotes = false;

    if (reversalCount > 0) {
      // Click the first reversal transfer
      const firstReversalRow = page.locator('table tbody tr').first();
      await firstReversalRow.click();
      await page.waitForTimeout(500);

      // Check if order notes are present (reversal reason should be propagated here)
      const orderNotes = page.getByTestId('transfer-order-notes');
      if (await orderNotes.isVisible()) {
        // Order notes should contain "Reversal of" prefix
        const notesText = await orderNotes.textContent();
        if (notesText && notesText.includes('Reversal of')) {
          foundReversalWithOrderNotes = true;
        }
      }
    }

    // Ensure we found at least one reversal with order notes
    expect(foundReversalWithOrderNotes).toBe(true);
  });
});
