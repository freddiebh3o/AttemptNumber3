# Frontend Testing Guide (Playwright)

**Purpose:** Guide for writing E2E tests using Playwright for the admin web frontend.

**Last Updated:** 2025-10-12

---

## Table of Contents

1. [Setup](#setup)
2. [Writing Tests](#writing-tests)
3. [Common Patterns](#common-patterns)
4. [Selectors Guide](#selectors-guide)
5. [Best Practices](#best-practices)

---

## Setup

### Prerequisites

**API Server Must Be Running:**
```bash
cd api-server
npm run dev
```

**Seed Data Required:**
```bash
cd api-server
npm run db:seed        # Seed test data
npm run seed:rbac      # Seed permissions
```

### Test User Credentials

From `api-server/prisma/seed.ts`:

```typescript
const TEST_USERS = {
  owner: { email: 'owner@acme.test', password: 'Password123!', tenant: 'acme' },
  admin: { email: 'admin@acme.test', password: 'Password123!', tenant: 'acme' },
  editor: { email: 'editor@acme.test', password: 'Password123!', tenant: 'acme' },
  viewer: { email: 'viewer@acme.test', password: 'Password123!', tenant: 'acme' },
};
```

---

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect, type Page } from '@playwright/test';

// Test user credentials
const TEST_USERS = {
  editor: { email: 'editor@acme.test', password: 'Password123!', tenant: 'acme' },
};

// Helper to sign in
async function signIn(page: Page, user: typeof TEST_USERS.editor) {
  await page.goto('/');
  await page.getByLabel(/email address/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByLabel(/tenant/i).fill(user.tenant);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for redirect to products page
  await expect(page).toHaveURL(`/${user.tenant}/products`);
}

// Check API health before tests
test.beforeAll(async () => {
  const apiUrl = process.env.VITE_API_BASE_URL || 'http://localhost:4000';
  const response = await fetch(`${apiUrl}/api/health`);
  if (!response.ok) {
    throw new Error('API server is not running');
  }
});

// Clear cookies between tests for isolation
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.describe('Product Management', () => {
  test('should display products list', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);

    // Should show table with products
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('heading', { name: /all products/i })).toBeVisible();
  });
});
```

### Pattern: Form Interactions

```typescript
test('should create a product', async ({ page }) => {
  await signIn(page, TEST_USERS.editor);

  // Navigate to create page
  await page.getByRole('button', { name: /new product/i }).click();
  await expect(page).toHaveURL(/\/products\/new/);

  // Fill out form
  await page.getByLabel(/product name/i).fill('Test Product');
  await page.getByLabel(/sku/i).fill('TEST-001');
  await page.getByLabel(/price \(gbp\)/i).fill('10.00');
  await page.getByLabel(/description/i).fill('Test description');

  // Submit form
  await page.getByRole('button', { name: /create product/i }).click();

  // Should show success notification
  await expect(page.getByText(/product created/i)).toBeVisible();

  // Should redirect to product detail page
  await expect(page).toHaveURL(/\/products\/.+/);
});
```

### Pattern: Modal/Dialog Interactions

```typescript
test('should adjust stock via modal', async ({ page }) => {
  await signIn(page, TEST_USERS.owner);

  // Navigate to product FIFO tab
  await page.waitForSelector('table tbody tr:first-child');
  const firstRow = page.locator('table tbody tr:first-child');
  await firstRow.locator('td').last().locator('button').first().click();

  await page.getByRole('tab', { name: /fifo/i }).click();

  // Open adjust stock modal
  await page.getByRole('button', { name: /adjust stock/i }).click();

  // Modal should be visible
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Fill form - IMPORTANT: Scope to dialog to avoid background elements
  await dialog.getByLabel(/quantity/i).fill('10');
  await dialog.getByLabel(/unit cost \(pence\)/i).fill('100');
  await dialog.getByLabel(/reason/i).fill('Test adjustment');

  // Submit
  const submitButton = dialog.getByRole('button', { name: /submit/i });
  await submitButton.click();

  // Should show success notification
  await expect(page.getByText(/stock adjusted/i)).toBeVisible();
});
```

### Pattern: Table Interactions

```typescript
test('should delete a product', async ({ page }) => {
  await signIn(page, TEST_USERS.editor);

  // Wait for table to load
  await page.waitForSelector('table tbody tr:first-child', { state: 'visible' });

  // Get first row
  const firstRow = page.locator('table tbody tr:first-child');
  const productName = await firstRow.locator('td').nth(1).textContent();

  // Click delete button (last button in actions cell)
  const actionsCell = firstRow.locator('td').last();
  const deleteButton = actionsCell.locator('button').last();
  await deleteButton.click();

  // Confirm deletion (if confirmation modal exists)
  // await page.getByRole('button', { name: /confirm/i }).click();

  // Should show success notification
  await expect(page.getByText(/deleted/i)).toBeVisible();

  // Product should be removed from list
  await expect(page.getByText(productName)).not.toBeVisible();
});
```

### Pattern: Permission Testing

```typescript
test('viewer should have read-only access', async ({ page }) => {
  await signIn(page, TEST_USERS.viewer);

  // Should see products list
  await expect(page.getByRole('table')).toBeVisible();

  // "New product" button should be disabled
  const newButton = page.getByRole('button', { name: /new product/i });
  await expect(newButton).toBeDisabled();

  // View button should be enabled (allows viewing details)
  const firstRow = page.locator('table tbody tr:first-child');
  const viewButton = firstRow.locator('td').last().locator('button').first();
  await expect(viewButton).toBeEnabled();
});

test('viewer should see permission denied on create page', async ({ page }) => {
  await signIn(page, TEST_USERS.viewer);

  // Navigate directly to create page
  await page.goto('/acme/products/new');

  // Should show permission denied message
  await expect(page.getByText(/no access/i)).toBeVisible();
  await expect(page.getByText(/you don't have permission/i)).toBeVisible();

  // Should NOT see the form
  await expect(page.getByLabel(/product name/i)).not.toBeVisible();
});
```

---

## Common Patterns

### Pattern 1: Dropdown/Select Interactions

```typescript
// Mantine Select component
await page.getByLabel(/branch/i).click();
await page.getByRole('option', { name: /warehouse/i }).click();

// Filtering dropdown with search
await page.getByLabel(/kind/i).click();
await page.getByRole('listbox').getByText('ADJUSTMENT', { exact: true }).click();
```

### Pattern 2: Multiple Tables on Same Page

When a page has multiple tables (e.g., FIFO lots table and ledger table):

```typescript
// Scope to first table (FIFO lots)
const lotsTable = page.locator('table').first();
await expect(lotsTable.locator('th', { hasText: 'Lot' }).first()).toBeVisible();

// Scope to last table (ledger)
const ledgerTable = page.locator('table').last();
await expect(ledgerTable.locator('th', { hasText: 'Date' })).toBeVisible();
```

### Pattern 3: Notifications (Mantine Alerts)

```typescript
// Success notification
await expect(page.getByText(/product created/i)).toBeVisible();

// Error notification (be specific, don't use generic role="alert")
await expect(page.getByText(/quantity must be greater than 0/i)).toBeVisible();
```

### Pattern 4: Navigation and URL Verification

```typescript
// Navigate to page
await page.goto('/acme/products/new');

// Click link
await page.getByRole('link', { name: /users/i }).click();

// Verify URL
await expect(page).toHaveURL(/\/users/);
await expect(page).toHaveURL('/acme/users');

// URL with query parameters
await expect(page).toHaveURL(/tab=fifo/);
await expect(page).toHaveURL(/branchId=/);
```

---

## Selectors Guide

### Priority Order (Best → Worst)

1. **Role-based selectors** (most resilient)
2. **Label text** (form fields)
3. **Placeholder text**
4. **Text content**
5. **Test IDs** (if added)
6. **CSS selectors** (last resort)

### Role-Based Selectors

```typescript
// Buttons
page.getByRole('button', { name: /submit/i })
page.getByRole('button', { name: /new product/i })

// Links
page.getByRole('link', { name: /products/i })

// Headings
page.getByRole('heading', { name: /all products/i })
page.getByRole('heading', { level: 2, name: /product details/i })

// Tables
page.getByRole('table')
page.getByRole('columnheader', { name: /name/i })

// Forms
page.getByRole('textbox', { name: /product name/i })
page.getByRole('combobox', { name: /branch/i })

// Dialogs
page.getByRole('dialog')
page.getByRole('alertdialog')
```

### Label-Based Selectors (Forms)

```typescript
// Best for form fields
page.getByLabel(/email address/i)
page.getByLabel(/password/i)
page.getByLabel(/product name/i)
page.getByLabel(/quantity/i)

// Case insensitive regex
page.getByLabel(/sku/i)
page.getByLabel(/price \(gbp\)/i)
```

### Text-Based Selectors

```typescript
// Text content
page.getByText(/product created/i)
page.getByText(/no access/i)

// Exact match
page.getByText('ADJUSTMENT', { exact: true })

// First occurrence
page.getByText(/on hand:/i).first()
```

### CSS Selectors (Use Sparingly)

```typescript
// Table rows
page.locator('table tbody tr:first-child')
page.locator('table tbody tr').nth(1)

// Specific attributes
page.locator('input[required][aria-haspopup="listbox"]') // Branch selector
page.locator('button[data-size="md"]')

// Nth child
page.locator('td').nth(1)
page.locator('td').last()
```

---

## Scoping Strategies

### Problem: Multiple Matching Elements

When selectors match multiple elements, scope to a specific area:

```typescript
// ❌ BAD - Matches multiple elements (strict mode violation)
await page.getByLabel(/quantity/i).fill('10');

// ✅ GOOD - Scoped to dialog
const dialog = page.getByRole('dialog');
await dialog.getByLabel(/quantity/i).fill('10');
```

### Scoping to Tables

```typescript
// Multiple tables on page
const lotsTable = page.locator('table').first();
const ledgerTable = page.locator('table').last();

// Or use IDs if available
const ledgerTable = page.locator('#ledger-table');
```

### Scoping to Rows

```typescript
const firstRow = page.locator('table tbody tr:first-child');
const nameCell = firstRow.locator('td').nth(1);
const actionsCell = firstRow.locator('td').last();
```

---

## Key Learnings from Implementation

### 1. Dialog Scoping is Essential

Form fields in modals MUST be scoped to prevent matching background elements:

```typescript
// ❌ BAD - Matches "Sort by quantity" button in background
await page.getByLabel(/quantity/i).fill('5');

// ✅ GOOD - Scoped to dialog
const dialog = page.getByRole('dialog');
await dialog.getByLabel(/quantity/i).fill('5');
```

### 2. Distinguishing Similar Selectors

Branch selector vs tenant switcher have identical attributes - use unique attributes:

```typescript
// ❌ BAD - Matches both branch and tenant selectors
const selector = page.locator('input[aria-haspopup="listbox"]');

// ✅ GOOD - Branch has 'required' attribute
const branchSelect = page.locator('input[required][aria-haspopup="listbox"]');
```

### 3. Exact Column Header Matching

"Received" matches both "Received" and "Received at" - use full text:

```typescript
// ❌ BAD - Partial match
await expect(page.locator('th:has-text("Received")')).toBeVisible();

// ✅ GOOD - Full column name
await expect(lotsTable.locator('th', { hasText: 'Received at' })).toBeVisible();
```

### 4. URL State Management

`branchId` only appears when branch is CHANGED, not on default:

```typescript
// ❌ BAD - Expects branchId immediately
await expect(page).toHaveURL(/branchId=/);

// ✅ GOOD - Actually change branch first
const branchSelect = page.locator('input[required][aria-haspopup="listbox"]');
await branchSelect.click();
await page.locator('[role="option"]').nth(1).click();
await expect(page).toHaveURL(/branchId=/); // NOW it appears
```

### 5. Avoid Generic Alert Selectors

Multiple alerts on page cause strict mode violations:

```typescript
// ❌ BAD - Matches multiple alerts (sign-in notification, validation error, etc.)
await expect(page.getByRole('alert')).toBeVisible();

// ✅ GOOD - Check for specific error text
await expect(page.getByText(/quantity must be greater than 0/i)).toBeVisible();
```

### 6. Permission-Based User Selection

Use the correct user role for each test:

```typescript
// ❌ BAD - Editor can't adjust stock or change branches
await signIn(page, TEST_USERS.editor);

// ✅ GOOD - Owner has necessary permissions
await signIn(page, TEST_USERS.owner);
```

### 7. TypeScript Configuration for E2E

E2E test files need Node.js types - create `tsconfig.e2e.json`:

```json
{
  "extends": "./tsconfig.node.json",
  "compilerOptions": {
    "types": ["node", "@playwright/test"]
  },
  "include": ["e2e/**/*.ts"]
}
```

---

## Best Practices

### ✅ DO

1. **Use role-based selectors** - Most resilient to UI changes
2. **Scope to dialogs/modals** - Prevents matching background elements
3. **Use exact text for disambiguation** - "Received at" not "Received"
4. **Clear cookies between tests** - `test.beforeEach` with `context.clearCookies()`
5. **Wait for specific elements** - `await expect(element).toBeVisible()`
6. **Use correct user roles** - Owner for multi-branch, Editor for basic ops, Viewer for read-only
7. **Check API health** - `test.beforeAll` to verify API server is running
8. **Use descriptive test names** - "should create product with valid data"

### ❌ DON'T

1. **Don't use arbitrary timeouts** - `waitForTimeout()` is unreliable
2. **Don't use generic alert selectors** - Check for specific error text
3. **Don't rely on test order** - Each test should be independent
4. **Don't use partial text matches** - Use exact text or regex
5. **Don't forget to scope modals** - Form fields must be scoped to dialog
6. **Don't use wrong user roles** - Check RBAC catalog for permissions
7. **Don't clear localStorage in beforeEach** - Causes SecurityError

---

## Running Tests

```bash
# Run all E2E tests (headless)
npm run test:accept

# Run specific test file
npm run test:accept product-management.spec.ts

# Run with interactive UI (recommended for debugging)
npm run test:accept:ui

# Run in debug mode with breakpoints
npm run test:accept:debug

# View HTML report of last run
npm run test:accept:report

# Run tests matching pattern
npm run test:accept -- -g "should create"
```

---

## Debugging Tips

### 1. Use Playwright UI Mode

```bash
npm run test:accept:ui
```

- See tests run in real-time
- Pause and inspect at any point
- Time travel through test steps

### 2. Add Breakpoints

```typescript
await page.pause(); // Pauses test execution for manual inspection
```

### 3. Take Screenshots on Failure

Playwright automatically captures screenshots on failure in `test-results/`.

### 4. Use Console Logs

```typescript
console.log('Current URL:', page.url());
console.log('Element count:', await page.locator('button').count());
```

### 5. Check Element Visibility

```typescript
const isVisible = await page.getByText(/product/i).isVisible();
console.log('Is visible?', isVisible);
```

---

**Next Steps:**
- Review existing tests in `e2e/` directory
- Follow patterns documented here
- See [Troubleshooting Guide](./troubleshooting_tests.md) if you encounter issues
- See [Test Flakiness Guide](./test_flakiness.md) for isolation strategies
