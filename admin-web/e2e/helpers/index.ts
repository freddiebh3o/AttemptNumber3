/**
 * E2E Test Helpers - Centralized exports
 *
 * This file provides a single import point for all E2E test utilities.
 *
 * @example
 * ```typescript
 * import { signIn, TEST_USERS, Factories, SELECTORS } from '../helpers';
 *
 * test('my test', async ({ page }) => {
 *   await signIn(page, TEST_USERS.owner);
 *   const productId = await Factories.product.create(page, { ... });
 *   await page.getByTestId(SELECTORS.PRODUCT.ARCHIVE_BUTTON).click();
 * });
 * ```
 */

// Auth helpers
export { signIn, signOut, switchUser, TEST_USERS, type TestUser } from './auth';

// API helpers
export { getApiUrl, getCookieHeader, makeAuthenticatedRequest } from './api-helpers';

// Factories
export {
  ProductFactory,
  BranchFactory,
  StockFactory,
  TransferTemplateFactory,
  TransferFactory,
  ApprovalRuleFactory,
  RoleFactory,
  TenantUserFactory,
  Factories,
} from './factories';

// Selectors
export { SELECTORS, buildSelector } from './selectors';

// Chat helpers
export { sendChatMessage, openChatModal, closeChatModal } from './chat';
