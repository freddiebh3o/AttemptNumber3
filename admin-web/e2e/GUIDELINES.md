# E2E Testing Guidelines

Comprehensive best practices, patterns, and conventions for writing maintainable E2E tests in this project.

## Table of Contents

- [Core Principles](#core-principles)
- [Selector Strategy](#selector-strategy)
- [Test Structure Patterns](#test-structure-patterns)
- [Factory Pattern Usage](#factory-pattern-usage)
- [Async Testing Patterns](#async-testing-patterns)
- [Common Patterns](#common-patterns)
- [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
- [Lessons Learned by Domain](#lessons-learned-by-domain)

---

## Core Principles

### 1. Test Isolation

**Every test should be completely independent:**

```typescript
// ✅ GOOD: Self-contained test
test('should create product', async ({ page }) => {
  await signIn(page, TEST_USERS.editor);

  const productId = await Factories.product.create(page, {
    productName: `Test Product ${Date.now()}`,
    productSku: `TEST-${Date.now()}`,
    productPricePence: 1000,
  });

  try {
    // Test assertions
    await page.goto(`/${TEST_USERS.editor.tenant}/products/${productId}`);
    await expect(page.getByText('Test Product')).toBeVisible();
  } finally {
    await Factories.product.delete(page, productId);
  }
});

// ❌ BAD: Depends on previous test's data
let sharedProductId: string;

test('create product', async ({ page }) => {
  sharedProductId = await Factories.product.create(page, {...});
});

test('update product', async ({ page }) => {
  // This test will fail if previous test fails!
  await page.goto(`/products/${sharedProductId}`);
});
```

### 2. Always Clean Up

**Use try/finally for guaranteed cleanup:**

```typescript
// ✅ GOOD: Cleanup even if test fails
test('should archive product', async ({ page }) => {
  await signIn(page, TEST_USERS.editor);
  const productId = await Factories.product.create(page, {...});

  try {
    await Factories.product.archive(page, productId);
    // Assertions...
  } finally {
    // Runs even if test fails
    await Factories.product.delete(page, productId);
  }
});

// ❌ BAD: No cleanup if test fails
test('should archive product', async ({ page }) => {
  const productId = await Factories.product.create(page, {...});
  await Factories.product.archive(page, productId);
  await Factories.product.delete(page, productId); // Never runs if test fails!
});
```

### 3. Use Shared Utilities

**Never duplicate code:**

```typescript
// ✅ GOOD: Use shared helpers
import { signIn, TEST_USERS, Factories } from '../helpers';

test('my test', async ({ page }) => {
  await signIn(page, TEST_USERS.editor);
  const productId = await Factories.product.create(page, {...});
});

// ❌ BAD: Duplicate helper code
const TEST_USERS = { owner: { email: '...', password: '...', tenant: '...' } };

async function signIn(page: Page, user: any) {
  await page.goto('/');
  await page.getByLabel(/email/i).fill(user.email);
  // ... 10 more lines of duplication
}

test('my test', async ({ page }) => {
  await signIn(page, TEST_USERS.owner);
});
```

### 4. Unique Test Data

**Always use timestamps for uniqueness:**

```typescript
// ✅ GOOD: Guaranteed unique
const timestamp = Date.now();
const productName = `Test Product ${timestamp}`;
const productSku = `TEST-${timestamp}`;

// ❌ BAD: Duplicate SKU errors
const productSku = 'TEST-001'; // Will fail if test runs twice
```

---

## Selector Strategy

### Selector Hierarchy (Priority Order)

1. **data-testid** - Most reliable, intentional
2. **getByRole** - Semantic, accessible
3. **getByLabel** - Form fields
4. **getByText** - Last resort (fragile)

### 1. data-testid (Preferred)

**When to use:** Buttons, links, custom components, dynamic content

```typescript
// ✅ GOOD: Explicit, stable selector
await page.getByTestId(SELECTORS.PRODUCT.ARCHIVE_BUTTON).click();
await page.getByTestId(SELECTORS.CHAT.TRIGGER_BUTTON).click();

// Import constants for consistency
import { SELECTORS } from '../helpers';
```

**Naming convention:** `{domain}-{element}-{action/state}`

Examples:
- `auth-email-input`
- `auth-signin-button`
- `product-archive-button`
- `archived-badge`
- `chat-trigger-button`
- `chat-modal-content`

### 2. getByRole (Semantic)

**When to use:** Standard HTML elements with clear roles

```typescript
// ✅ GOOD: Semantic, accessible
await page.getByRole('button', { name: /save/i }).click();
await page.getByRole('heading', { name: /edit product/i }).isVisible();
await page.getByRole('link', { name: /products/i }).click();
```

### 3. getByLabel (Form Fields)

**When to use:** Form inputs, selects, textareas

```typescript
// ✅ GOOD: Accessible, semantic
await page.getByLabel(/product name/i).fill('Widget');
await page.getByLabel(/email address/i).fill('user@example.com');
await page.getByLabel(/password/i).fill('secret');
```

### 4. getByText (Use Sparingly)

**When to use:** Static text, badges, notifications (last resort)

```typescript
// ⚠️ OK: Static badge text
await expect(page.getByText('Archived')).toBeVisible();

// ❌ BAD: Button text may change
await page.getByText('Save').click(); // Use getByRole('button', { name: /save/i }) instead
```

### Handling Mantine Components

**Mantine Select (no data-testid):**

```typescript
// Use aria attributes
const select = page.locator('input[id*="mantine"][aria-haspopup="listbox"]').first();
await select.click();
await page.getByText('Option Name', { exact: true }).click();
```

**Mantine Modal:**

```typescript
// Scope to dialog role
const modal = page.getByRole('dialog');
await modal.getByLabel(/product name/i).fill('New Name');
await modal.getByRole('button', { name: /save/i }).click();
```

---

## Test Structure Patterns

### Standard Test Template

```typescript
import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS, Factories } from '../helpers';

// REQUIRED: Health check
test.beforeAll(async () => {
  const apiUrl = process.env.VITE_API_BASE_URL || 'http://localhost:4000';
  try {
    const response = await fetch(`${apiUrl}/api/health`);
    if (!response.ok) throw new Error(`API health check failed`);
  } catch (error) {
    console.warn('⚠️  API server may not be running. Tests will fail without it.');
    console.warn('   Start it with: cd api-server && npm run dev');
  }
});

// REQUIRED: Cookie clearing
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.describe('Feature Name', () => {
  test('should perform action', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);

    const testData = await createTestData(page);

    try {
      // Test logic
      await performActions(page);

      // Assertions
      await expect(page.getByText(/success/i)).toBeVisible();
    } finally {
      // Cleanup
      await cleanupTestData(page, testData);
    }
  });
});
```

### Multi-Step Workflow Pattern

```typescript
test('should complete transfer workflow', async ({ page }) => {
  await signIn(page, TEST_USERS.owner);

  // Step 1: Setup
  const branches = await Factories.branch.getAll(page);
  const productId = await Factories.product.create(page, {...});

  try {
    // Step 2: Create transfer
    const transferId = await Factories.transfer.create(page, {
      sourceBranchId: branches[0].id,
      destinationBranchId: branches[1].id,
      items: [{ productId, qty: 10 }],
    });

    // Step 3: Approve
    await Factories.transfer.approve(page, transferId);

    // Step 4: Ship
    const transfer = await Factories.transfer.getById(page, transferId);
    await Factories.transfer.ship(page, {
      transferId,
      items: transfer.items.map(item => ({
        itemId: item.id,
        qtyToShip: item.qtyRequested,
      })),
    });

    // Step 5: Verify
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/${transferId}`);
    await expect(page.getByText('IN TRANSIT')).toBeVisible();
  } finally {
    await Factories.transfer.delete(page, transferId);
    await Factories.product.delete(page, productId);
  }
});
```

### Permission Testing Pattern

```typescript
test.describe('Permission Checks', () => {
  test('viewer cannot create products', async ({ page }) => {
    await signIn(page, TEST_USERS.viewer);

    await page.goto('/acme/products');
    await page.waitForLoadState('networkidle');

    // Verify create button is hidden
    await expect(page.getByRole('button', { name: /new product/i })).not.toBeVisible();
  });

  test('editor can create products', async ({ page }) => {
    await signIn(page, TEST_USERS.editor);

    await page.goto('/acme/products');
    await page.waitForLoadState('networkidle');

    // Verify create button is visible
    await expect(page.getByRole('button', { name: /new product/i })).toBeVisible();
  });
});
```

---

## Factory Pattern Usage

### When to Use Factories

**✅ Use factories for:**
- Creating entities (products, transfers, templates, rules)
- Deleting/archiving entities
- Getting entity lists
- Common setup steps

**❌ Don't use factories for:**
- Test-specific workflows with unique logic
- One-off API calls used in a single test
- Complex domain-specific operations

### Product Factory Examples

```typescript
// Create basic product
const productId = await Factories.product.create(page, {
  productName: 'Widget',
  productSku: 'WID-001',
  productPricePence: 1000,
});

// Create product with barcode
const productId = await Factories.product.create(page, {
  productName: 'Barcoded Widget',
  productSku: 'BAR-001',
  productPricePence: 1500,
  barcode: '1234567890',
  barcodeType: 'EAN13',
});

// Archive product
await Factories.product.archive(page, productId);

// Restore product
await Factories.product.restore(page, productId);

// Delete product (cleanup)
await Factories.product.delete(page, productId);
```

### Stock Factory Examples

```typescript
// Create product with initial stock
const result = await Factories.stock.createProductWithStock(page, {
  productName: 'Stocked Widget',
  productSku: 'STK-001',
  productPricePence: 1500,
  qtyDelta: 100,           // Initial quantity
  unitCostPence: 500,       // Cost per unit
});
// Returns: { productId, branchId, adjustmentId }

// Add stock to existing product
await Factories.stock.addStock(page, {
  productId: productId,
  branchId: branchId,
  qtyDelta: 50,
  unitCostPence: 600,
  reason: 'Restock',
});
```

### Transfer Factory Examples

```typescript
// Create transfer
const transferId = await Factories.transfer.create(page, {
  sourceBranchId: sourceBranch.id,
  destinationBranchId: destBranch.id,
  items: [
    { productId: product1Id, qty: 10 },
    { productId: product2Id, qty: 5 },
  ],
});

// Approve transfer
await Factories.transfer.approve(page, transferId);

// Ship transfer
await Factories.transfer.ship(page, {
  transferId: transferId,
  items: [
    { itemId: item1Id, qtyToShip: 10 },
    { itemId: item2Id, qtyToShip: 5 },
  ],
});

// Convenience: Create, approve, and ship in one call
const transferId = await Factories.transfer.createAndShip(page, {
  sourceBranchId: sourceBranch.id,
  destinationBranchId: destBranch.id,
  productId: productId,
  quantity: 10,
  unitCostPence: 100,
});

// Delete transfer
await Factories.transfer.delete(page, transferId);
```

### Branch Factory Examples

```typescript
// Get all branches
const branches = await Factories.branch.getAll(page);

// Get first branch
const firstBranch = await Factories.branch.getFirst(page);

// Get second branch
const secondBranch = await Factories.branch.getSecond(page);
```

### Role Factory Examples

```typescript
// Get role by name
const roleId = await Factories.role.getByName(page, 'OWNER');
const adminRoleId = await Factories.role.getByName(page, 'ADMIN');

// Get first role
const roleId = await Factories.role.getFirst(page);
```

### Approval Rule Factory Examples

```typescript
// Create approval rule
const ruleId = await Factories.approvalRule.create(page, {
  name: 'High Value Approval',
  description: 'Requires approval for transfers over £100',
  isActive: true,
  approvalMode: 'SEQUENTIAL',
  priority: 100,
  conditions: [
    { conditionType: 'TOTAL_VALUE_THRESHOLD', threshold: 10000 },
  ],
  levels: [
    { level: 1, name: 'Manager Review', requiredRoleId: roleId },
  ],
});

// Delete approval rule
await Factories.approvalRule.delete(page, ruleId);
```

### Template Factory Examples

```typescript
// Create transfer template
const templateId = await Factories.transferTemplate.create(page, {
  templateName: 'London → Manchester',
  sourceBranchId: sourceBranch.id,
  destinationBranchId: destBranch.id,
});

// Delete template
await Factories.transferTemplate.delete(page, templateId);
```

---

## Async Testing Patterns

### Standard Async Operations (5s timeout)

```typescript
// Default timeout is 5 seconds - sufficient for most operations
await expect(page.getByText(/product created/i)).toBeVisible();
await expect(page).toHaveURL('/products');
```

### Long Async Operations (15s timeout)

```typescript
// AI responses need longer timeout
await expect(page.getByText(/stock value/i)).toBeVisible({ timeout: 15000 });

// Complex API operations
await expect(page.getByText(/transfer completed/i)).toBeVisible({ timeout: 10000 });
```

### Wait for Page Load

```typescript
// Wait for all network requests to complete
await page.goto('/products');
await page.waitForLoadState('networkidle');

// Wait for DOM to be loaded (faster, but less reliable)
await page.goto('/products');
await page.waitForLoadState('domcontentloaded');
```

### Wait for Animations

```typescript
// Mantine dropdowns need time to expand
const nav = page.getByRole('navigation').getByText(/user management/i);
await nav.click();
await page.waitForTimeout(300); // Wait for animation
await page.getByRole('link', { name: /tenant users/i }).click();

// Modal transitions
await page.getByRole('button', { name: /open modal/i }).click();
await page.waitForTimeout(200); // Wait for modal animation
const modal = page.getByRole('dialog');
await expect(modal).toBeVisible();
```

### Conditional Waits

```typescript
// Check if element exists before interacting
const nav = page.getByText(/user management/i);
if (await nav.isVisible()) {
  await nav.click();
  await page.waitForTimeout(300);
}
await page.getByRole('link', { name: /users/i }).click();
```

---

## Common Patterns

### Modal/Dialog Pattern

```typescript
// Open modal
await page.getByRole('button', { name: /new product/i }).click();

// Scope all interactions to modal
const modal = page.getByRole('dialog');
await expect(modal).toBeVisible();

// Fill form inside modal
await modal.getByLabel(/product name/i).fill('Widget');
await modal.getByLabel(/sku/i).fill('WID-001');
await modal.getByRole('button', { name: /save/i }).click();

// Wait for modal to close
await expect(modal).not.toBeVisible();

// Verify success
await expect(page.getByText(/product created/i)).toBeVisible();
```

### Table Interaction Pattern

```typescript
// Wait for table to load
await page.goto('/products');
await page.waitForLoadState('networkidle');

// Check if table has rows
const rowCount = await page.locator('table tbody tr').count();
if (rowCount > 0) {
  // Click action in first row
  await page.locator('table tbody tr:first-child td:last-child button').first().click();
} else {
  console.warn('No products found');
}
```

### Form Submission Pattern

```typescript
// Fill form
await page.getByLabel(/product name/i).fill('Widget');
await page.getByLabel(/sku/i).fill('WID-001');
await page.getByLabel(/price \(gbp\)/i).fill('10.00');

// Submit
await page.getByRole('button', { name: /save/i }).click();

// Wait for success notification
await expect(page.getByText(/product created/i)).toBeVisible();

// Verify redirect
await expect(page).toHaveURL(/\/products\/.+/);
```

### Navigation Pattern

```typescript
// Navigate to page
await page.goto(`/${TEST_USERS.editor.tenant}/products`);
await page.waitForLoadState('networkidle');

// Click navigation link
await page.getByRole('link', { name: /products/i }).click();
await page.waitForLoadState('networkidle');

// Verify URL
await expect(page).toHaveURL('/acme/products');
```

### Collapsible Navigation Pattern

```typescript
// Expand navigation group
const userManagementNav = page.getByRole('navigation').getByText(/user management/i);
if (await userManagementNav.isVisible()) {
  await userManagementNav.click();
  await page.waitForTimeout(300); // Wait for expansion animation
}

// Click nested link
await page.getByRole('link', { name: /tenant users/i }).click();
await page.waitForLoadState('networkidle');
```

### Chat Interaction Pattern

```typescript
import { sendChatMessage, openChatModal, closeChatModal } from '../helpers';

// Open chat
await openChatModal(page);

// Send message
await sendChatMessage(page, 'What is the total stock value?');

// Wait for AI response (15s timeout)
await expect(page.getByText(/total stock value/i)).toBeVisible({ timeout: 15000 });

// Close chat (important before other UI interactions)
await closeChatModal(page);
```

### Feature Flag Testing Pattern

```typescript
// Test with feature enabled
test('ACME tenant shows barcode scanner', async ({ page }) => {
  await signIn(page, { email: 'owner@acme.test', password: 'Password123!', tenant: 'acme' });

  await page.goto('/acme/products/new');
  await expect(page.getByLabel(/barcode/i)).toBeVisible();
});

// Test with feature disabled
test('Globex tenant hides barcode scanner', async ({ page }) => {
  await signIn(page, { email: 'mixed@both.test', password: 'Password123!', tenant: 'globex' });

  await page.goto('/globex/products/new');
  await expect(page.getByLabel(/barcode/i)).not.toBeVisible();
});
```

---

## Anti-Patterns to Avoid

### ❌ Hardcoded Waits

```typescript
// ❌ BAD: Arbitrary timeout
await page.waitForTimeout(5000);
await expect(page.getByText('Loaded')).toBeVisible();

// ✅ GOOD: Wait for specific condition
await expect(page.getByText('Loaded')).toBeVisible({ timeout: 5000 });
```

### ❌ Duplicate Helper Code

```typescript
// ❌ BAD: Copy-pasted helpers in every file
async function signIn(page: Page, user: any) { /* ... */ }
async function createProduct(page: Page, params: any) { /* ... */ }

// ✅ GOOD: Import from shared helpers
import { signIn, Factories } from '../helpers';
```

### ❌ Fragile Text Selectors

```typescript
// ❌ BAD: Exact text match
await page.getByText('Save Product').click();

// ✅ GOOD: Regex or role-based
await page.getByRole('button', { name: /save/i }).click();
```

### ❌ Missing Cleanup

```typescript
// ❌ BAD: No cleanup if test fails
test('should update product', async ({ page }) => {
  const productId = await Factories.product.create(page, {...});
  await updateProduct(page, productId);
  await Factories.product.delete(page, productId); // Never runs if test fails!
});

// ✅ GOOD: Guaranteed cleanup
test('should update product', async ({ page }) => {
  const productId = await Factories.product.create(page, {...});
  try {
    await updateProduct(page, productId);
  } finally {
    await Factories.product.delete(page, productId);
  }
});
```

### ❌ Test Interdependence

```typescript
// ❌ BAD: Tests depend on each other
let productId: string;

test('create product', async ({ page }) => {
  productId = await Factories.product.create(page, {...});
});

test('update product', async ({ page }) => {
  // Fails if previous test fails!
  await updateProduct(page, productId);
});

// ✅ GOOD: Independent tests
test('should create and update product', async ({ page }) => {
  const productId = await Factories.product.create(page, {...});
  try {
    await updateProduct(page, productId);
  } finally {
    await Factories.product.delete(page, productId);
  }
});
```

### ❌ Scope Conflicts

```typescript
// ❌ BAD: Ambiguous selector (matches multiple elements)
await page.getByLabel(/product name/i).fill('Widget');

// ✅ GOOD: Scoped to dialog
const modal = page.getByRole('dialog');
await modal.getByLabel(/product name/i).fill('Widget');
```

---

## Lessons Learned by Domain

### Auth Domain

**Key Insights:**
- Always clear cookies before each test
- Expand collapsible navigation sections before clicking nested links
- Add API health checks to detect server issues early
- Permission tests belong in auth domain, not scattered across features

**Patterns:**
```typescript
// Expand collapsible navigation
const nav = page.getByRole('navigation').getByText(/user management/i);
if (await nav.isVisible()) {
  await nav.click();
  await page.waitForTimeout(300);
}
```

### Products Domain

**Key Insights:**
- Use getByLabel() for form fields (semantic, accessible)
- Centralize permission tests in auth domain
- Use factories for all CRUD operations
- Archive tests require checking both "Archived" badge and filter behavior

**Patterns:**
```typescript
// Archive and verify
await Factories.product.archive(page, productId);
await page.reload();
await expect(page.getByTestId(SELECTORS.PRODUCT.ARCHIVED_BADGE)).toBeVisible();
```

### Stock Domain

**Key Insights:**
- Mantine Select components use aria attributes (no data-testid)
- Strategic timeouts acceptable for complex async operations (stock adjustments)
- Table scoping prevents selector conflicts (use `.first()` and `.last()`)
- Dialog scoping essential for form inputs

**Patterns:**
```typescript
// Mantine Select
const select = page.locator('input[id*="mantine"][aria-haspopup="listbox"]').first();
await select.click();
await page.getByText('Option', { exact: true }).click();
```

### Transfers Domain

**Key Insights:**
- Keep test-specific API helpers for complex workflows
- Transfer tests benefit from conditional logic (data availability checks)
- Don't over-abstract domain-specific helpers
- Use serial mode to prevent transferNumber collisions

**Patterns:**
```typescript
// Serial mode for collision prevention
test.describe.configure({ mode: 'serial' });
```

### Chat Domain

**Key Insights:**
- AI responses need 15-second timeouts
- Explicitly close modals before other UI interactions
- Chat tests already follow data-testid best practices
- Extract domain-specific helpers even for single-use patterns

**Patterns:**
```typescript
// AI response timeout
await expect(page.getByText(/response/i)).toBeVisible({ timeout: 15000 });

// Close modal before sign-out
await closeChatModal(page);
await signOut(page);
```

### Features Domain

**Key Insights:**
- Keep inline helpers for tightly-coupled workflows (barcode scanning)
- Use custom TEST_USERS for multi-tenant feature flag tests
- Create convenience factory methods for common multi-step setups
- Add optional parameters to factories as needed

**Patterns:**
```typescript
// Convenience factory method
const transferId = await Factories.transfer.createAndShip(page, {
  sourceBranchId: branch1.id,
  destinationBranchId: branch2.id,
  productId: productId,
  quantity: 10,
  unitCostPence: 100,
});
```

---

## Migration Checklist

When migrating old tests to new structure:

- [ ] Move file to appropriate domain folder
- [ ] Replace TEST_USERS with `import { TEST_USERS } from '../helpers'`
- [ ] Replace signIn helper with `import { signIn } from '../helpers'`
- [ ] Replace createProductViaAPI with `Factories.product.create()`
- [ ] Replace deleteProductViaAPI with `Factories.product.delete()`
- [ ] Replace getBranchesViaAPI with `Factories.branch.getAll()`
- [ ] Add health check to `test.beforeAll()`
- [ ] Add cookie clearing to `test.beforeEach()`
- [ ] Convert selectors to data-testid (or document why not)
- [ ] Add try/finally for cleanup
- [ ] Run tests and verify passing
- [ ] Document any new patterns in this file

---

**Last Updated:** 2025-10-18
**Refactoring Phases:** 8 of 9 complete
**Total Code Reduction:** ~600+ lines removed across all domains
