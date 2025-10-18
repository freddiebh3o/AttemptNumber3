// admin-web/tests/chat-analytics.spec.ts
import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS } from '../helpers';

test.describe('Chat Analytics Page', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('should display Chat Analytics link in sidebar for users with reports:view permission', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Click on System section to expand it
    await page.getByTestId('nav-system').click();

    // Should see Chat Analytics link
    await expect(page.getByTestId('nav-chat-analytics')).toBeVisible();
  });

  test('should NOT display Chat Analytics link for users without reports:view permission', async ({ page }) => {
    await signIn(page, TEST_USERS.viewer);

    // Viewer does not have reports:view, so System section may not be visible
    // Or if it is visible (due to users:manage), Chat Analytics should not be there
    const systemNav = page.getByTestId('nav-system');

    if (await systemNav.isVisible()) {
      await systemNav.click();
      // Should NOT see Chat Analytics link
      await expect(page.getByTestId('nav-chat-analytics')).not.toBeVisible();
    }
  });

  test('should navigate to Chat Analytics page', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    // Expand System section and click Chat Analytics
    await page.getByTestId('nav-system').click();
    await page.getByTestId('nav-chat-analytics').click();

    // Should navigate to chat analytics page
    await expect(page).toHaveURL(/\/acme\/chat-analytics/);

    // Should display page title
    await expect(page.getByRole('heading', { name: /chat analytics/i })).toBeVisible();
  });

  test('should display key metrics cards', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto('/acme/chat-analytics');

    // Wait for data to load
    await page.waitForSelector('[data-testid="date-range-select"]');

    // Should display all 4 stat cards
    await expect(page.getByText(/total conversations/i)).toBeVisible();
    await expect(page.getByText(/total messages/i)).toBeVisible();
    await expect(page.getByText(/active users/i)).toBeVisible();
    await expect(page.getByText(/avg messages\/conv/i)).toBeVisible();
  });

  test('should display Top Tools table', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto('/acme/chat-analytics');

    // Wait for data to load
    await page.waitForSelector('[data-testid="top-tools-table"]');

    // Should display table heading
    await expect(page.getByRole('heading', { name: /most used tools/i })).toBeVisible();

    // Should display table headers
    const table = page.getByTestId('top-tools-table');
    await expect(table.locator('th', { hasText: 'Rank' })).toBeVisible();
    await expect(table.locator('th', { hasText: 'Tool Name' })).toBeVisible();
    await expect(table.locator('th', { hasText: 'Usage Count' })).toBeVisible();
    await expect(table.locator('th', { hasText: 'Percentage' })).toBeVisible();
  });

  test('should display Daily Breakdown table when data is available', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto('/acme/chat-analytics');

    // Wait for data to load
    await page.waitForSelector('[data-testid="date-range-select"]');

    // Check if daily data table exists (it may or may not have data)
    const dailyTable = page.getByTestId('daily-data-table');
    if (await dailyTable.isVisible()) {
      // Should display table headers
      await expect(dailyTable.locator('th', { hasText: 'Date' })).toBeVisible();
      await expect(dailyTable.locator('th', { hasText: 'Conversations' })).toBeVisible();
      await expect(dailyTable.locator('th', { hasText: 'Messages' })).toBeVisible();
      await expect(dailyTable.locator('th', { hasText: 'Users' })).toBeVisible();
    }
  });

  test('should change date range using selector', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto('/acme/chat-analytics');

    // Wait for data to load
    const dateRangeSelect = page.getByTestId('date-range-select');
    await dateRangeSelect.waitFor({ state: 'visible' });

    // Default should be 30 days
    await expect(dateRangeSelect).toHaveValue('Last 30 days');

    // Change to 7 days
    await dateRangeSelect.click();
    await page.getByRole('option', { name: /last 7 days/i }).click();

    // Should update to 7 days
    await expect(dateRangeSelect).toHaveValue('Last 7 days');

    // The subtitle should show "7 days"
    await expect(page.getByText(/7 days/i).first()).toBeVisible();
  });

  test('should change to 90 days range', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto('/acme/chat-analytics');

    const dateRangeSelect = page.getByTestId('date-range-select');
    await dateRangeSelect.waitFor({ state: 'visible' });

    // Change to 90 days
    await dateRangeSelect.click();
    await page.getByRole('option', { name: /last 90 days/i }).click();

    await expect(dateRangeSelect).toHaveValue('Last 90 days');
  });

  test('should require authentication', async ({ page }) => {
    // Try to access without signing in
    await page.goto('/acme/chat-analytics');

    // Should redirect to sign in
    await expect(page).toHaveURL(/sign-in/);
  });

  test('should display ring progress indicators on stat cards', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto('/acme/chat-analytics');

    // Wait for data to load
    await page.waitForSelector('[data-testid="date-range-select"]');

    // Ring progress uses SVG circles
    const svgElements = await page.locator('svg circle').count();

    // Should have at least 4 ring progress indicators (one per stat card)
    expect(svgElements).toBeGreaterThanOrEqual(4);
  });

  test('should display total tool calls badge in Top Tools section', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto('/acme/chat-analytics');

    // Wait for data to load
    await page.waitForSelector('[data-testid="top-tools-table"]');

    // Should display total calls badge
    await expect(page.getByText(/total calls/i)).toBeVisible();
  });

  test('should format daily data dates correctly', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto('/acme/chat-analytics');

    // Wait for data to load
    await page.waitForSelector('[data-testid="date-range-select"]');

    const dailyTable = page.getByTestId('daily-data-table');
    if (await dailyTable.isVisible()) {
      // Check that dates are formatted (e.g., "Jan 15, 2025")
      const dateCell = dailyTable.locator('tbody tr').first().locator('td').first();
      const dateText = await dateCell.textContent();

      // Should match format like "Jan 15, 2025" or "Dec 31, 2024"
      expect(dateText).toMatch(/[A-Z][a-z]{2} \d{1,2}, \d{4}/);
    }
  });

  test('should rank tools correctly in Top Tools table', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto('/acme/chat-analytics');

    await page.waitForSelector('[data-testid="top-tools-table"]');

    const table = page.getByTestId('top-tools-table');
    const rows = table.locator('tbody tr');
    const rowCount = await rows.count();

    if (rowCount > 0) {
      // Check first rank badge shows #1
      const firstRankBadge = rows.first().locator('td').first();
      await expect(firstRankBadge).toContainText('#1');

      // If there are more rows, check second rank
      if (rowCount > 1) {
        const secondRankBadge = rows.nth(1).locator('td').first();
        await expect(secondRankBadge).toContainText('#2');
      }
    }
  });

  test('should display page description', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto('/acme/chat-analytics');

    // Should display description text
    await expect(page.getByText(/ai chatbot usage statistics and insights/i)).toBeVisible();
  });
});
