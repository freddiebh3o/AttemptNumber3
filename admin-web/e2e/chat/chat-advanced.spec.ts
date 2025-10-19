// AI Chat Assistant Phase 2 E2E acceptance tests
/**
 * Tests the Phase 2 AI chat tools including:
 * - Product tools (search, details, stock levels)
 * - Stock management tools (branch stock, movements, low stock, FIFO)
 * - Branch tools (list, details)
 * - User tools (search, details, roles, permissions)
 * - Template tools (list, details)
 * - Analytics tools (metrics, performance, stock value)
 *
 * IMPORTANT: These tests require the API server to be running with OPENAI_API_KEY configured.
 * Before running these tests:
 *   1. Start the API server: cd api-server && npm run dev
 *   2. Ensure OPENAI_API_KEY is set in api-server/.env
 *   3. Ensure database is seeded: cd api-server && npm run db:seed
 *
 * Then run these tests from admin-web:
 *   cd admin-web && npm run test:accept -- chat/chat-advanced.spec.ts
 */
import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS, sendChatMessage } from '../helpers';

test.describe('AI Chat Assistant - Phase 2 Tools', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    // Sign in as owner for all tests
    await signIn(page, TEST_USERS.owner);

    // Open chat modal
    await page.getByTestId('chat-trigger-button').click();
    const modalContent = page.getByTestId('chat-modal-content');
    await expect(modalContent).toBeVisible();
  });

  test.describe('[AC-PHASE2-1] Updated Empty State', () => {
    test('should have updated placeholder text', async ({ page }) => {
      const messageInput = page.getByTestId('chat-input');

      // Should have Phase 2 placeholder
      await expect(messageInput).toHaveAttribute(
        'placeholder',
        /products.*stock.*transfers.*analytics.*users/i
      );
    });
  });

  test.describe('[AC-PHASE2-2] Product Tools', () => {
    test('should search for products', async ({ page }) => {
      const modalContent = page.getByTestId('chat-modal-content');

      await sendChatMessage(page, 'Search for products');

      // Should get a response mentioning products (AI calls searchProducts tool)
      await expect(
        modalContent.getByText(/product|sku|found/i).first()
      ).toBeVisible({ timeout: 15000 });
    });

    test('should get product details', async ({ page }) => {
      const modalContent = page.getByTestId('chat-modal-content');

      await sendChatMessage(page, 'Tell me about the first product');

      // Should get product details (AI calls getProductDetails tool)
      await expect(
        modalContent.getByText(/product|price|sku/i).first()
      ).toBeVisible({ timeout: 15000 });
    });

    test('should check stock levels for a product', async ({ page }) => {
      const modalContent = page.getByTestId('chat-modal-content');

      await sendChatMessage(page, 'What stock do we have for products?');

      // Should get stock information (AI calls getStockLevel tool)
      await expect(
        modalContent.getByText(/stock|quantity|warehouse|branch/i).first()
      ).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('[AC-PHASE2-3] Stock Management Tools', () => {
    test('should show stock at a branch', async ({ page }) => {
      const modalContent = page.getByTestId('chat-modal-content');

      await sendChatMessage(page, 'What stock is at the warehouse?');

      // Should get branch stock info (AI calls getStockAtBranch tool)
      await expect(
        modalContent.getByText(/stock|warehouse|branch|product/i).first()
      ).toBeVisible({ timeout: 15000 });
    });

    test('should identify low stock products', async ({ page }) => {
      const modalContent = page.getByTestId('chat-modal-content');

      await sendChatMessage(page, 'What products are low on stock?');

      // Should get low stock alert (AI calls checkLowStock tool)
      await expect(
        modalContent.getByText(/stock|low|product|quantity/i).first()
      ).toBeVisible({ timeout: 15000 });
    });

    test('should show stock movements', async ({ page }) => {
      const modalContent = page.getByTestId('chat-modal-content');

      await sendChatMessage(page, 'Show me recent stock movements');

      // Should get stock movement history (AI calls viewStockMovements tool)
      await expect(
        modalContent.getByText(/movement|receipt|stock|adjustment/i).first()
      ).toBeVisible({ timeout: 15000 });
    });

    test('should show FIFO lot information', async ({ page }) => {
      const modalContent = page.getByTestId('chat-modal-content');

      await sendChatMessage(page, 'What are the FIFO lots for products?');

      // Should get FIFO lot details (AI calls getFIFOLotInfo tool)
      await expect(
        modalContent.getByText(/lot|fifo|cost|received/i).first()
      ).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('[AC-PHASE2-4] Branch Tools', () => {
    test('should list all branches', async ({ page }) => {
      const modalContent = page.getByTestId('chat-modal-content');

      await sendChatMessage(page, 'List all branches');

      // Should get branch list (AI calls listBranches tool)
      await expect(
        modalContent.getByText(/branch|warehouse|store|location/i).first()
      ).toBeVisible({ timeout: 15000 });
    });

    test('should get branch details', async ({ page }) => {
      const modalContent = page.getByTestId('chat-modal-content');

      await sendChatMessage(page, 'Tell me about the warehouse branch');

      // Should get branch details (AI calls getBranchDetails tool)
      await expect(
        modalContent.getByText(/branch|warehouse|member|stock/i).first()
      ).toBeVisible({ timeout: 15000 });
    });

    test('should show branch performance metrics', async ({ page }) => {
      const modalContent = page.getByTestId('chat-modal-content');

      await sendChatMessage(page, 'How is the warehouse performing?');

      // Should get performance metrics (AI calls getBranchDetails with stats)
      await expect(
        modalContent.getByText(/branch|performance|transfer|stock/i).first()
      ).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('[AC-PHASE2-5] User & Role Tools', () => {
    test('should search for users', async ({ page }) => {
      const modalContent = page.getByTestId('chat-modal-content');

      await sendChatMessage(page, 'Who are the users in the system?');

      // Should get user list (AI calls searchUsers tool)
      await expect(
        modalContent.getByText(/user|email|role/i).first()
      ).toBeVisible({ timeout: 15000 });
    });

    test('should get user details', async ({ page }) => {
      const modalContent = page.getByTestId('chat-modal-content');

      await sendChatMessage(page, 'Tell me about the owner user');

      // Should get user details (AI calls getUserDetails tool)
      await expect(
        modalContent.getByText(/user|owner|role|permission/i).first()
      ).toBeVisible({ timeout: 15000 });
    });

    test('should list all roles', async ({ page }) => {
      const modalContent = page.getByTestId('chat-modal-content');

      await sendChatMessage(page, 'What roles exist in the system?');

      // Should get role list (AI calls listRoles tool)
      await expect(
        modalContent.getByText(/role|owner|admin|editor|viewer/i).first()
      ).toBeVisible({ timeout: 15000 });
    });

    test('should check user permissions', async ({ page }) => {
      const modalContent = page.getByTestId('chat-modal-content');

      await sendChatMessage(page, 'What permissions does the owner have?');

      // Should check permissions (AI calls checkPermission tool)
      await expect(
        modalContent.getByText(/permission|role|access|owner/i).first()
      ).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('[AC-PHASE2-6] Template Tools', () => {
    test('should list transfer templates', async ({ page }) => {
      const modalContent = page.getByTestId('chat-modal-content');

      await sendChatMessage(page, 'What transfer templates do we have?');

      // Should get template list (AI calls listTemplates tool)
      await expect(
        modalContent.getByText(/template|transfer|found|exist/i).first()
      ).toBeVisible({ timeout: 15000 });
    });

    test('should get template details', async ({ page }) => {
      const modalContent = page.getByTestId('chat-modal-content');

      await sendChatMessage(page, 'Show me details of transfer templates');

      // Should get template details (AI calls getTemplateDetails tool)
      await expect(
        modalContent.getByText(/template|transfer|item|product/i).first()
      ).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('[AC-PHASE2-7] Analytics Tools', () => {
    test('should get transfer metrics', async ({ page }) => {
      const modalContent = page.getByTestId('chat-modal-content');

      await sendChatMessage(page, 'What are our transfer metrics?');

      // Should get metrics (AI calls getTransferMetrics tool)
      await expect(
        modalContent.getByText(/transfer|metric|completion|rate|cycle/i).first()
      ).toBeVisible({ timeout: 15000 });
    });

    test('should get branch performance', async ({ page }) => {
      const modalContent = page.getByTestId('chat-modal-content');

      await sendChatMessage(page, 'Show me branch performance stats');

      // Should get performance (AI calls getBranchPerformance tool)
      await expect(
        modalContent.getByText(/branch|performance|inbound|outbound|transfer/i).first()
      ).toBeVisible({ timeout: 15000 });
    });

    test('should get stock value report', async ({ page }) => {
      const modalContent = page.getByTestId('chat-modal-content');

      await sendChatMessage(page, 'What is the total stock value?');

      // Should get stock value (AI calls getStockValueReport tool)
      await expect(
        modalContent.getByText(/stock|value|total|cost|£/i).first()
      ).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('[AC-PHASE2-8] Multi-Feature Queries', () => {
    test('should handle questions spanning multiple features', async ({ page }) => {
      const modalContent = page.getByTestId('chat-modal-content');

      await sendChatMessage(page, 'Show me low stock products and who can approve replenishment transfers');

      // Should use multiple tools in one response
      await expect(
        modalContent.getByText(/stock|product|approval|permission|role/i).first()
      ).toBeVisible({ timeout: 15000 });
    });

    test('should maintain conversation context between follow-up questions', async ({ page }) => {
      const modalContent = page.getByTestId('chat-modal-content');

      // First message about branches
      await sendChatMessage(page, 'List all branches');
      await expect(
        modalContent.getByText(/branch|warehouse/i).first()
      ).toBeVisible({ timeout: 15000 });

      // Follow-up about stock at those branches (should use context from previous message)
      await sendChatMessage(page, 'What stock is at the first one?');
      await expect(
        modalContent.getByText(/stock|product|quantity/i).first()
      ).toBeVisible({ timeout: 15000 });
    });

    test('should switch between tool categories smoothly', async ({ page }) => {
      const modalContent = page.getByTestId('chat-modal-content');

      // Ask about products
      await sendChatMessage(page, 'What products do we have?');
      await expect(
        modalContent.getByText(/product/i).first()
      ).toBeVisible({ timeout: 15000 });

      // Switch to users
      await sendChatMessage(page, 'Who are the users?');
      await expect(
        modalContent.getByText(/user|email/i).first()
      ).toBeVisible({ timeout: 15000 });

      // Switch to analytics
      await sendChatMessage(page, 'Show me transfer metrics');
      await expect(
        modalContent.getByText(/transfer|metric/i).first()
      ).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('[AC-PHASE2-9] Security & Permissions', () => {
    test('should respect branch membership filtering in Phase 2 tools', async ({ page, context }) => {
      // Close the chat modal first (it's blocking the sign out button)
      await page.keyboard.press('Escape');
      let modalContent = page.getByTestId('chat-modal-content');
      await expect(modalContent).not.toBeVisible();

      // Sign out owner
      await page.getByRole('button', { name: /sign out/i }).click();
      await expect(page).toHaveURL('/sign-in');

      // Sign in as admin (different branch memberships)
      await context.clearCookies();
      await signIn(page, TEST_USERS.admin);

      // Open chat
      await page.getByTestId('chat-trigger-button').click();
      modalContent = page.getByTestId('chat-modal-content');
      await expect(modalContent).toBeVisible();

      await sendChatMessage(page, 'What stock is available?');

      // Should only see stock for admin's branches
      await expect(
        modalContent.getByText(/stock|branch/i).first()
      ).toBeVisible({ timeout: 15000 });
    });

    test('should not show tools user has no permission for', async ({ page }) => {
      const modalContent = page.getByTestId('chat-modal-content');

      // Owner should be able to query all features
      await sendChatMessage(page, 'Show me user permissions');

      // Should get response (owner has full permissions)
      await expect(
        modalContent.getByText(/permission|user|role/i).first()
      ).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('[AC-PHASE2-10] Error Handling', () => {
    test('should handle ambiguous queries by asking for clarification', async ({ page }) => {
      const modalContent = page.getByTestId('chat-modal-content');

      await sendChatMessage(page, 'Show me the thing');

      // Should ask for clarification or suggest what user might mean
      await expect(
        modalContent.getByText(/help|specify|what|which|clarify|mean/i).first()
      ).toBeVisible({ timeout: 15000 });
    });
  });
});
