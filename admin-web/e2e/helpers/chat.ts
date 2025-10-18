/**
 * E2E Test Helpers for AI Chat
 *
 * Provides utilities for interacting with the AI chat modal in tests.
 */

import { expect, type Page } from '@playwright/test';

/**
 * Opens chat modal and sends a message
 * @param page - Playwright page object
 * @param message - Message text to send
 * @example
 * ```typescript
 * await sendChatMessage(page, 'Show me all products');
 * ```
 */
export async function sendChatMessage(page: Page, message: string) {
  const messageInput = page.getByTestId('chat-input');
  const sendButton = page.getByTestId('chat-send-button');

  await messageInput.fill(message);
  await sendButton.click();

  // Wait for user message to appear (use .first() to avoid strict mode violations)
  // User messages can appear multiple times (as user bubble + potentially in AI response)
  await expect(page.getByText(message, { exact: true }).first()).toBeVisible({ timeout: 2000 });
}

/**
 * Opens the AI chat modal
 * @param page - Playwright page object
 * @example
 * ```typescript
 * await openChatModal(page);
 * ```
 */
export async function openChatModal(page: Page) {
  await page.getByTestId('chat-trigger-button').click();
  const modalContent = page.getByTestId('chat-modal-content');
  await expect(modalContent).toBeVisible();
}

/**
 * Closes the AI chat modal using Escape key
 * @param page - Playwright page object
 * @example
 * ```typescript
 * await closeChatModal(page);
 * ```
 */
export async function closeChatModal(page: Page) {
  await page.keyboard.press('Escape');
  const modalContent = page.getByTestId('chat-modal-content');
  await expect(modalContent).not.toBeVisible();
}
