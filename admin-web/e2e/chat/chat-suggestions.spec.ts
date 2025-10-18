// AI Chat Smart Suggestions E2E acceptance tests
/**
 * Tests the Phase 4.3 smart suggestions feature including:
 * - Loading personalized suggestions based on user permissions
 * - Clicking suggestions to send messages
 * - Suggestions disappearing after first message
 * - New conversation reloading suggestions
 *
 * IMPORTANT: These tests require the API server to be running with OPENAI_API_KEY configured.
 * Before running these tests:
 *   1. Start the API server: cd api-server && npm run dev
 *   2. Ensure OPENAI_API_KEY is set in api-server/.env
 *   3. Ensure database is seeded: cd api-server && npm run db:seed
 *
 * Then run these tests from admin-web:
 *   cd admin-web && npm run test:accept:ui -- chat/chat-suggestions.spec.ts
 */
import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS } from '../helpers';

test.describe('AI Chat Smart Suggestions - Phase 4.3', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    // Sign in as owner for all tests
    await signIn(page, TEST_USERS.owner);
  });

  test.describe('[SUGG-1] Suggestions Display on Empty Chat', () => {
    test('should display suggestions when opening chat modal', async ({ page }) => {
      // Open chat modal
      await page.getByTestId('chat-trigger-button').click();
      const modalContent = page.getByTestId('chat-modal-content');
      await expect(modalContent).toBeVisible();

      // Should see welcome message
      await expect(modalContent.getByText(/Hi! I'm your inventory assistant/i)).toBeVisible();
      await expect(modalContent.getByText(/I can help you with products, stock, transfers, analytics/i)).toBeVisible();

      // Should see "Suggested questions:" label
      await expect(modalContent.getByText(/Suggested questions:/i)).toBeVisible();

      // Should see at least one suggestion button
      const suggestions = modalContent.locator('[data-testid^="suggestion-"]');
      await expect(suggestions.first()).toBeVisible({ timeout: 5000 });

      // Should have multiple suggestions (up to 6)
      const count = await suggestions.count();
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThanOrEqual(6);
    });

    test('should show "Or type your own question below" hint', async ({ page }) => {
      // Open chat modal
      await page.getByTestId('chat-trigger-button').click();
      const modalContent = page.getByTestId('chat-modal-content');
      await expect(modalContent).toBeVisible();

      // Wait for suggestions to load
      const suggestions = modalContent.locator('[data-testid^="suggestion-"]');
      await expect(suggestions.first()).toBeVisible();

      // Should see hint text
      await expect(modalContent.getByText(/Or type your own question below/i)).toBeVisible();
    });
  });

  test.describe('[SUGG-2] Clicking Suggestions', () => {
    test('should send message when clicking a suggestion', async ({ page }) => {
      // Open chat modal
      await page.getByTestId('chat-trigger-button').click();
      const modalContent = page.getByTestId('chat-modal-content');
      await expect(modalContent).toBeVisible();

      // Wait for suggestions to load
      const suggestions = modalContent.locator('[data-testid^="suggestion-"]');
      await expect(suggestions.first()).toBeVisible();

      // Get the text of the first suggestion before clicking
      const suggestionText = await suggestions.first().textContent();
      expect(suggestionText).toBeTruthy();

      // Click the first suggestion
      await suggestions.first().click();

      // Should see the suggestion text as a user message in the chat
      // Use .first() to avoid strict mode violation (text appears in button + user message)
      await expect(modalContent.getByText(suggestionText!, { exact: true }).first()).toBeVisible({ timeout: 2000 });

      // Welcome message and suggestions should disappear after message is sent
      await expect(modalContent.getByText(/Hi! I'm your inventory assistant/i)).not.toBeVisible();
      await expect(modalContent.getByText(/Suggested questions:/i)).not.toBeVisible();

      // Should eventually see an AI response (wait up to 15 seconds for OpenAI)
      await expect(modalContent.getByText(/assist|help|transfer|product|stock/i).first()).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('[SUGG-3] Suggestions Disappear After Message', () => {
    test('should hide suggestions after clicking a suggestion', async ({ page }) => {
      // Open chat modal
      await page.getByTestId('chat-trigger-button').click();
      const modalContent = page.getByTestId('chat-modal-content');
      await expect(modalContent).toBeVisible();

      // Wait for suggestions
      const suggestions = modalContent.locator('[data-testid^="suggestion-"]');
      await expect(suggestions.first()).toBeVisible();

      // Click a suggestion
      await suggestions.first().click();

      // Suggestions should disappear
      await expect(modalContent.getByText(/Suggested questions:/i)).not.toBeVisible();
    });

    test('should hide suggestions after typing and sending a message', async ({ page }) => {
      // Open chat modal
      await page.getByTestId('chat-trigger-button').click();
      const modalContent = page.getByTestId('chat-modal-content');
      await expect(modalContent).toBeVisible();

      // Wait for suggestions to be visible
      await expect(modalContent.getByText(/Suggested questions:/i)).toBeVisible();

      // Type a message manually (not clicking suggestion)
      const messageInput = page.getByTestId('chat-input');
      const sendButton = page.getByTestId('chat-send-button');

      await messageInput.fill('Hello, how many products do we have?');
      await sendButton.click();

      // Suggestions should disappear
      await expect(modalContent.getByText(/Suggested questions:/i)).not.toBeVisible();
      await expect(modalContent.getByText(/Hi! I'm your inventory assistant/i)).not.toBeVisible();
    });
  });

  test.describe('[SUGG-4] New Conversation Reloads Suggestions', () => {
    test('should show suggestions again when starting new conversation', async ({ page }) => {
      // Open chat modal
      await page.getByTestId('chat-trigger-button').click();
      const modalContent = page.getByTestId('chat-modal-content');
      await expect(modalContent).toBeVisible();

      // Send a message to hide suggestions
      const messageInput = page.getByTestId('chat-input');
      const sendButton = page.getByTestId('chat-send-button');

      await messageInput.fill('Test message');
      await sendButton.click();

      // Suggestions should be hidden
      await expect(modalContent.getByText(/Suggested questions:/i)).not.toBeVisible();

      // Click "New Conversation" button
      await page.getByRole('button', { name: /new conversation/i }).click();

      // Suggestions should reappear
      await expect(modalContent.getByText(/Suggested questions:/i)).toBeVisible();
      const suggestions = modalContent.locator('[data-testid^="suggestion-"]');
      await expect(suggestions.first()).toBeVisible();
    });
  });

  test.describe('[SUGG-5] Permission-Based Suggestions', () => {
    test('OWNER should see suggestions based on permissions', async ({ page }) => {
      // Open chat modal
      await page.getByTestId('chat-trigger-button').click();
      const modalContent = page.getByTestId('chat-modal-content');
      await expect(modalContent).toBeVisible();

      // Wait for suggestions
      const suggestions = modalContent.locator('[data-testid^="suggestion-"]');
      await expect(suggestions.first()).toBeVisible();

      // Get all suggestion texts
      const suggestionTexts = await suggestions.allTextContents();

      // OWNER has all permissions, so should see variety of suggestions
      expect(suggestionTexts.length).toBeGreaterThan(0);
    });

    test('VIEWER should not see user management suggestions', async ({ page, context }) => {
      // Sign out owner
      await page.getByRole('button', { name: /sign out/i }).click();
      await expect(page).toHaveURL('/sign-in');

      // Sign in as viewer
      await context.clearCookies();
      await signIn(page, TEST_USERS.viewer);

      // Open chat modal
      await page.getByTestId('chat-trigger-button').click();
      const modalContent = page.getByTestId('chat-modal-content');
      await expect(modalContent).toBeVisible();

      // Wait for suggestions
      const suggestions = modalContent.locator('[data-testid^="suggestion-"]');
      await expect(suggestions.first()).toBeVisible();

      // Get all suggestion texts
      const suggestionTexts = await suggestions.allTextContents();

      // VIEWER should NOT see "Who are the users" type suggestions
      // because they don't have users:manage permission
      const hasUserManagementSuggestion = suggestionTexts.some(text =>
        text.toLowerCase().includes('who are the users')
      );

      expect(hasUserManagementSuggestion).toBe(false);
    });

    test('should prioritize actionable suggestions over general help', async ({ page }) => {
      // Open chat modal
      await page.getByTestId('chat-trigger-button').click();
      const modalContent = page.getByTestId('chat-modal-content');
      await expect(modalContent).toBeVisible();

      // Wait for suggestions
      const suggestions = modalContent.locator('[data-testid^="suggestion-"]');
      await expect(suggestions.first()).toBeVisible();

      // Get all suggestion texts
      const suggestionTexts = await suggestions.allTextContents();

      // OWNER has many permissions, so should see actionable suggestions
      // Priority order: transfers > stock > products > analytics > users > general
      // Examples: "Show my pending transfers", "What's in stock at...", etc.
      expect(suggestionTexts.length).toBeGreaterThan(0);

      // Should see operational suggestions (transfers/stock/products)
      const hasOperationalSuggestion = suggestionTexts.some(text =>
        text.toLowerCase().includes('transfer') ||
        text.toLowerCase().includes('stock') ||
        text.toLowerCase().includes('product')
      );

      expect(hasOperationalSuggestion).toBe(true);
    });
  });

  test.describe('[SUGG-6] Loading Conversation History', () => {
    test('should not show suggestions when loading existing conversation', async ({ page }) => {
      // Open chat modal
      await page.getByTestId('chat-trigger-button').click();
      const modalContent = page.getByTestId('chat-modal-content');
      await expect(modalContent).toBeVisible();

      // Send a message to create a conversation
      const messageInput = page.getByTestId('chat-input');
      const sendButton = page.getByTestId('chat-send-button');

      await messageInput.fill('First message');
      await sendButton.click();

      // Wait for message to appear
      await expect(modalContent.getByText('First message', { exact: true }).first()).toBeVisible();

      // Wait a moment for conversation to be saved
      await page.waitForTimeout(1000);

      // Start a new conversation
      await page.getByRole('button', { name: /new conversation/i }).click();

      // Suggestions should appear in new conversation
      await expect(modalContent.getByText(/Suggested questions:/i)).toBeVisible();

      // Now click on the previous conversation from the sidebar
      // Look for the conversation item (it should have the first message as title)
      const conversationItem = modalContent.locator('.mantine-Paper-root').filter({ hasText: 'First message' }).first();

      if (await conversationItem.isVisible()) {
        await conversationItem.click();

        // Suggestions should NOT appear (we're in an existing conversation with messages)
        await expect(modalContent.getByText(/Suggested questions:/i)).not.toBeVisible();

        // Should see the old message
        await expect(modalContent.getByText('First message', { exact: true }).first()).toBeVisible();
      }
    });
  });
});
