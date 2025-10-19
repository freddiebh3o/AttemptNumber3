/**
 * Centralized data-testid selectors for E2E tests
 *
 * Naming Convention: {domain}-{element}-{action}
 * Examples:
 * - chat-trigger-button
 * - archive-product-btn
 * - archived-badge
 * - restore-btn
 *
 * Usage:
 * ```typescript
 * import { SELECTORS } from './helpers/selectors';
 *
 * await page.getByTestId(SELECTORS.CHAT.TRIGGER_BUTTON).click();
 * await page.getByTestId(SELECTORS.PRODUCT.ARCHIVE_BUTTON).click();
 * ```
 */

export const SELECTORS = {
  /**
   * Authentication & Session selectors
   */
  AUTH: {
    EMAIL_INPUT: 'auth-email-input',
    PASSWORD_INPUT: 'auth-password-input',
    TENANT_INPUT: 'auth-tenant-input',
    SIGN_IN_BUTTON: 'auth-signin-button',
    SIGN_OUT_BUTTON: 'auth-signout-button',
  },

  /**
   * Product management selectors
   */
  PRODUCT: {
    // Actions
    NEW_BUTTON: 'product-new-button',
    SAVE_BUTTON: 'product-save-button',
    CANCEL_BUTTON: 'product-cancel-button',
    EDIT_BUTTON: 'product-edit-button',
    DELETE_BUTTON: 'product-delete-button',
    ARCHIVE_BUTTON: 'archive-product-btn',
    RESTORE_BUTTON: 'restore-btn',

    // Form fields
    NAME_INPUT: 'product-name-input',
    SKU_INPUT: 'product-sku-input',
    PRICE_INPUT: 'product-price-input',
    BARCODE_INPUT: 'product-barcode-input',

    // Display elements
    ARCHIVED_BADGE: 'archived-badge',
    ARCHIVE_FILTER_SELECT: 'archive-filter-select',

    // Tables
    TABLE: 'products-table',
    TABLE_ROW: 'product-table-row',
  },

  /**
   * Stock management selectors
   */
  STOCK: {
    // Actions
    ADJUST_BUTTON: 'stock-adjust-button',
    REFRESH_BUTTON: 'stock-refresh-button',

    // Modal
    ADJUST_MODAL: 'stock-adjust-modal',
    INCREASE_TAB: 'stock-increase-tab',
    DECREASE_TAB: 'stock-decrease-tab',
    QUANTITY_INPUT: 'stock-quantity-input',
    UNIT_COST_INPUT: 'stock-unitcost-input',
    REASON_INPUT: 'stock-reason-input',
    SUBMIT_BUTTON: 'stock-submit-button',

    // Display
    BRANCH_SELECT: 'stock-branch-select',
    ON_HAND_DISPLAY: 'stock-onhand-display',
    FIFO_TABLE: 'stock-fifo-table',
    LEDGER_TABLE: 'stock-ledger-table',
  },

  /**
   * Transfer management selectors
   */
  TRANSFER: {
    // Actions
    NEW_BUTTON: 'transfer-new-button',
    USE_TEMPLATE_BUTTON: 'transfer-use-template-button',
    APPROVE_BUTTON: 'transfer-approve-button',
    REJECT_BUTTON: 'transfer-reject-button',
    SHIP_BUTTON: 'transfer-ship-button',
    COMPLETE_BUTTON: 'transfer-complete-button',
    REVERSE_BUTTON: 'transfer-reverse-button',

    // Form
    SOURCE_BRANCH_SELECT: 'transfer-source-branch-select',
    DEST_BRANCH_SELECT: 'transfer-dest-branch-select',
    PRIORITY_SELECT: 'transfer-priority-select',
    NOTES_INPUT: 'transfer-notes-input',
    CREATE_BUTTON: 'create-transfer-button',

    // Display
    STATUS_BADGE: 'transfer-status-badge',
    TABLE: 'transfers-table',
  },

  /**
   * Transfer template selectors
   */
  TEMPLATE: {
    // Actions
    NEW_BUTTON: 'template-new-button',
    DUPLICATE_BUTTON: 'duplicate-template-', // Suffix with template ID
    DELETE_BUTTON: 'template-delete-button',
    ARCHIVE_BUTTON: 'archive-template-btn',
    RESTORE_BUTTON: 'restore-template-btn',
    USE_BUTTON: 'use-template-button',

    // Form
    NAME_INPUT: 'template-name-input',
    DESCRIPTION_INPUT: 'template-description-input',
    ADD_PRODUCT_BUTTON: 'template-add-product-button',
    CREATE_BUTTON: 'create-template-button',

    // Display
    CARD: 'template-card-', // Suffix with template ID
    TABLE: 'templates-table',
    ARCHIVED_BADGE: 'template-archived-badge',
    ARCHIVED_FILTER_SELECT: 'template-archived-filter-select',
  },

  /**
   * AI Chat selectors
   */
  CHAT: {
    TRIGGER_BUTTON: 'chat-trigger-button',
    MODAL_CONTENT: 'chat-modal-content',
    INPUT: 'chat-input',
    SEND_BUTTON: 'chat-send-button',
    CLOSE_BUTTON: 'chat-close-button',
    MESSAGE_USER: 'chat-message-user',
    MESSAGE_ASSISTANT: 'chat-message-assistant',
    SUGGESTION_BUTTON: 'chat-suggestion-button',
  },

  /**
   * User management selectors
   */
  USER: {
    // Actions
    ARCHIVE_BUTTON: 'archive-user-btn',
    RESTORE_BUTTON: 'restore-btn',

    // Display elements
    ARCHIVED_BADGE: 'archived-badge',
    ARCHIVED_FILTER_SELECT: 'archived-filter-select',
  },

  /**
   * Approval rule management selectors
   */
  APPROVAL_RULE: {
    // Actions
    ARCHIVE_BUTTON: 'archive-approval-rule-btn',
    RESTORE_BUTTON: 'restore-approval-rule-btn',
    TOGGLE_ACTIVE_SWITCH: 'approval-rule-active-switch',

    // Display elements
    ARCHIVED_BADGE: 'approval-rule-archived-badge',
    INACTIVE_BADGE: 'approval-rule-inactive-badge',
    ARCHIVED_FILTER_SELECT: 'approval-rule-archived-filter-select',
  },

  /**
   * Common UI element selectors
   */
  COMMON: {
    // Modals
    MODAL: 'modal-dialog',
    MODAL_CLOSE: 'modal-close-button',
    CONFIRM_BUTTON: 'confirm-button',
    CANCEL_BUTTON: 'cancel-button',

    // Tables
    TABLE_ROW: 'table-row',
    TABLE_HEADER: 'table-header',
    TABLE_CELL: 'table-cell',

    // Filters
    FILTERS_BUTTON: 'filters-button',
    APPLY_FILTERS_BUTTON: 'apply-filters-button',
    CLEAR_FILTERS_BUTTON: 'clear-filters-button',

    // Pagination
    NEXT_PAGE_BUTTON: 'next-page-button',
    PREV_PAGE_BUTTON: 'prev-page-button',
    PAGE_SIZE_INPUT: 'page-size-input',

    // Notifications
    SUCCESS_ALERT: 'success-alert',
    ERROR_ALERT: 'error-alert',
    WARNING_ALERT: 'warning-alert',
  },
} as const;

/**
 * Helper function to build dynamic selectors (e.g., for IDs)
 *
 * @example
 * ```typescript
 * const selector = buildSelector(SELECTORS.TEMPLATE.CARD, templateId);
 * // Returns: 'template-card-abc123'
 * await page.getByTestId(selector).click();
 * ```
 */
export function buildSelector(prefix: string, suffix: string): string {
  return `${prefix}${suffix}`;
}
