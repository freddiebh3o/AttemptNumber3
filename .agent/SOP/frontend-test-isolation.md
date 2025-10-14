# Frontend E2E Test Isolation Pattern

**Purpose:** Best practices for writing isolated, non-flaky Playwright E2E tests that don't interfere with each other.

**Last Updated:** 2025-10-13

---

## Table of Contents

1. [The Problem](#the-problem)
2. [The Solution](#the-solution)
3. [Test Isolation Strategy](#test-isolation-strategy)
4. [Implementation Patterns](#implementation-patterns)
5. [Anti-Flakiness Checklist](#anti-flakiness-checklist)
6. [Examples](#examples)

---

## The Problem

### Why Frontend E2E Tests Become Flaky

**Common Issues:**

1. **Shared Database State** - Tests modifying the same records
2. **Browser State Pollution** - Cookies/sessions from previous tests
3. **Race Conditions** - Async operations not properly awaited
4. **Test Order Dependency** - Tests accidentally depending on execution order
5. **Seed Data Conflicts** - Multiple tests fighting over same seeded entities

**Symptoms:**
- ✅ Test passes when run alone
- ❌ Test fails when run with others
- 🎲 Test results are inconsistent

---

## The Solution

### Hybrid Isolation Approach

We combine **backend test isolation patterns** with **frontend-specific strategies**:

1. **Unique Test Data** - Use timestamps for all created entities
2. **Cookie Clearing** - Reset browser state between tests
3. **Proper Waits** - Condition-based waits, not arbitrary timeouts
4. **Test Independence** - Each test creates and optionally cleans up its own data
5. **Minimal Seed Dependency** - Only rely on base tenant/users from seed data

---

## Test Isolation Strategy

### Level 1: Browser State Isolation

```typescript
// Clear cookies between every test
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});
```

**Why:**
- Prevents session persistence between tests
- Ensures each test starts with fresh authentication
- Eliminates cross-test authentication pollution

**Note:** Don't clear localStorage/sessionStorage in beforeEach - causes SecurityError. Playwright handles this on navigation.

---

### Level 2: Unique Test Data

```typescript
// ✅ GOOD - Unique data with timestamps
test('should create approval rule', async ({ page }) => {
  const timestamp = Date.now();
  const ruleName = `E2E Test Rule ${timestamp}`;

  await dialog.getByLabel(/rule name/i).fill(ruleName);
  // Rest of test...
});
```

```typescript
// ❌ BAD - Hardcoded data causes conflicts
test('should create approval rule', async ({ page }) => {
  await dialog.getByLabel(/rule name/i).fill('Test Rule');
  // Will fail if another test created same rule!
});
```

**Why:**
- Prevents conflicts when tests run in parallel
- Makes tests repeatable
- Allows tests to run in any order

---

### Level 3: Test Independence

**Each test should:**
- ✅ Create its own data (don't rely on other tests)
- ✅ Work in isolation (can run alone)
- ✅ Optionally clean up after itself
- ✅ Not assume execution order

```typescript
// ✅ GOOD - Test is self-contained
test('should edit approval rule', async ({ page }) => {
  await signIn(page, TEST_USERS.owner);
  await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/approval-rules`);

  // Don't assume a rule exists - check first
  const rowCount = await page.locator('table tbody tr').count();
  if (rowCount > 0) {
    // Proceed with test
  } else {
    // Skip if no data (or create data first)
    test.skip();
  }
});
```

```typescript
// ❌ BAD - Test depends on previous test
test('create rule', async ({ page }) => {
  // Creates rule...
});

test('edit rule', async ({ page }) => {
  // Assumes rule from previous test exists!
  // Will fail if run alone
});
```

---

### Level 4: Proper Async Waits

```typescript
// ✅ GOOD - Wait for specific condition
await expect(page.getByText(/rule created/i)).toBeVisible({ timeout: 10000 });

// Wait for element with proper selector
await page.waitForSelector('table tbody tr:first-child', { state: 'visible' });

// Wait for navigation
await expect(page).toHaveURL(/\/approval-rules/);
```

```typescript
// ❌ BAD - Arbitrary timeout (unreliable)
await page.waitForTimeout(1000);
await expect(page.getByText(/rule created/i)).toBeVisible();
```

**Why:**
- Arbitrary timeouts are flaky (too short = failure, too long = slow)
- Condition-based waits are fast and reliable
- Properly handles network/rendering delays

---

### Level 5: Minimal Seed Data Dependency

**Only rely on seed data for:**
- ✅ Base tenant (acme)
- ✅ Test users (owner, admin, editor, viewer)
- ✅ User roles and permissions
- ✅ Basic branch structure (if needed)

**Create test-specific data for:**
- ✅ Approval rules
- ✅ Products
- ✅ Transfers
- ✅ Any entity being tested

```typescript
// ✅ GOOD - Uses seed data for auth only
test('should create rule', async ({ page }) => {
  await signIn(page, TEST_USERS.owner); // Uses seed user

  // Create test-specific rule
  const ruleName = `Test Rule ${Date.now()}`;
  // ...
});
```

```typescript
// ❌ BAD - Assumes specific seeded rule exists
test('should edit High Quantity rule', async ({ page }) => {
  await signIn(page, TEST_USERS.owner);

  // Assumes "High Quantity" rule from seed data
  await page.getByText('High Quantity').click();
  // Will fail if seed data changes!
});
```

---

## Implementation Patterns

### Pattern 1: Sign In Helper

```typescript
const TEST_USERS = {
  owner: { email: 'owner@acme.test', password: 'Password123!', tenant: 'acme' },
  admin: { email: 'admin@acme.test', password: 'Password123!', tenant: 'acme' },
  editor: { email: 'editor@acme.test', password: 'Password123!', tenant: 'acme' },
  viewer: { email: 'viewer@acme.test', password: 'Password123!', tenant: 'acme' },
};

async function signIn(page: Page, user: typeof TEST_USERS.owner) {
  await page.goto('/');
  await page.getByLabel(/email address/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByLabel(/tenant/i).fill(user.tenant);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for redirect
  await expect(page).toHaveURL(`/${user.tenant}/products`);

  // Wait for auth store to populate
  await page.waitForTimeout(500);
}
```

---

### Pattern 2: Unique Entity Creation

```typescript
test('should create approval rule', async ({ page }) => {
  const timestamp = Date.now();
  const uniqueData = {
    ruleName: `E2E Test Rule ${timestamp}`,
    description: `Rule created by automated test at ${new Date().toISOString()}`,
  };

  // Use unique data throughout test
  await dialog.getByLabel(/rule name/i).fill(uniqueData.ruleName);
  await dialog.getByLabel(/description/i).fill(uniqueData.description);

  // Submit and verify
  await dialog.getByRole('button', { name: /create/i }).click();
  await expect(page.getByText(uniqueData.ruleName)).toBeVisible();
});
```

---

### Pattern 3: Graceful Test Skipping

```typescript
test('should edit existing rule', async ({ page }) => {
  await signIn(page, TEST_USERS.owner);
  await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/approval-rules`);

  await page.waitForTimeout(1000);

  // Check if any rules exist
  const rowCount = await page.locator('table tbody tr').count();
  if (rowCount === 0) {
    console.log('⏭️  Skipping test - no approval rules exist');
    test.skip();
    return;
  }

  // Proceed with test
  const firstRow = page.locator('table tbody tr').first();
  // ...
});
```

---

### Pattern 4: Dialog Scoping

```typescript
// ✅ GOOD - Scope to dialog to avoid background elements
test('should create rule', async ({ page }) => {
  await page.getByRole('button', { name: /create rule/i }).click();
  await page.waitForTimeout(500);

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // All form interactions scoped to dialog
  await dialog.getByLabel(/rule name/i).fill('Test Rule');
  await dialog.getByLabel(/description/i).fill('Test description');
  await dialog.getByRole('button', { name: /create/i }).click();
});
```

```typescript
// ❌ BAD - Not scoped, matches background elements
test('should create rule', async ({ page }) => {
  await page.getByRole('button', { name: /create rule/i }).click();

  // Might match elements outside dialog!
  await page.getByLabel(/rule name/i).fill('Test Rule');
});
```

---

### Pattern 5: Conditional Waits

```typescript
// ✅ GOOD - Wait for specific conditions
await page.waitForSelector('table tbody tr:first-child', {
  state: 'visible',
  timeout: 10000
});

await expect(page.getByText(/rule created/i)).toBeVisible({
  timeout: 10000
});

await page.waitForLoadState('networkidle');
```

```typescript
// ❌ BAD - Arbitrary timeouts
await page.waitForTimeout(1000);
await page.waitForTimeout(2000);
```

---

### Pattern 6: API Health Check

```typescript
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
```

---

## Anti-Flakiness Checklist

Use this checklist when writing or reviewing E2E tests:

### ✅ Test Structure
- [ ] Test has clear, descriptive name
- [ ] Test is self-contained (creates own data)
- [ ] Test can run in isolation
- [ ] Test doesn't assume execution order

### ✅ Browser State
- [ ] `context.clearCookies()` in `beforeEach`
- [ ] Don't rely on previous test's session
- [ ] Fresh sign-in for each test

### ✅ Data Uniqueness
- [ ] Use timestamps for unique data: `Date.now()`
- [ ] No hardcoded emails, names, or IDs
- [ ] Test-specific data, not relying on seed data

### ✅ Async Handling
- [ ] Proper waits for elements: `expect().toBeVisible()`
- [ ] Condition-based waits, not `waitForTimeout()`
- [ ] Wait for navigation: `expect(page).toHaveURL()`
- [ ] Wait for modals: `page.waitForTimeout(500)` after open/close

### ✅ Selectors
- [ ] Role-based selectors preferred
- [ ] Dialog/modal selectors scoped
- [ ] Exact text when disambiguation needed
- [ ] No generic alert selectors

### ✅ Cleanup (Optional)
- [ ] Tests clean up created entities (if practical)
- [ ] Seed data remains clean
- [ ] No test pollution affects subsequent tests

---

## Examples

### Example 1: Approval Rule CRUD Test

```typescript
test.describe('Approval Rules - CRUD Operations', () => {
  // Clear cookies before each test
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('should create rule with unique data', async ({ page }) => {
    // Sign in with owner (has stock:write permission)
    await signIn(page, TEST_USERS.owner);

    // Navigate to approval rules page
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/approval-rules`);
    await page.waitForTimeout(1000);

    // Open create modal
    await page.getByRole('button', { name: /create rule/i }).click();
    await page.waitForTimeout(500);

    // Scope to dialog
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Create unique test data
    const timestamp = Date.now();
    const ruleName = `E2E Test Rule ${timestamp}`;

    // Fill form with unique data
    await dialog.getByLabel(/rule name/i).fill(ruleName);
    await dialog.getByLabel(/description/i).fill('Automated test rule');

    // Select approval mode
    await dialog.getByLabel(/approval mode/i).click();
    await page.waitForTimeout(300);
    await page.getByRole('option', { name: /sequential/i }).click();

    // Add condition
    await dialog.getByRole('button', { name: /add condition/i }).click();
    await page.waitForTimeout(300);

    // ... (rest of form filling)

    // Submit
    await dialog.getByRole('button', { name: /create rule/i }).click();

    // Wait for success
    await expect(page.getByText(/rule created/i)).toBeVisible({ timeout: 10000 });

    // Verify in list
    await expect(page.getByText(ruleName)).toBeVisible();
  });

  test('should edit rule gracefully', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/approval-rules`);
    await page.waitForTimeout(1000);

    // Check if rules exist
    const rowCount = await page.locator('table tbody tr').count();
    if (rowCount === 0) {
      console.log('⏭️  Skipping - no rules to edit');
      test.skip();
      return;
    }

    // Edit first rule
    const firstRow = page.locator('table tbody tr').first();
    await firstRow.getByRole('button', { name: /edit/i }).click();

    await page.waitForTimeout(500);
    const dialog = page.getByRole('dialog');

    // Modify with unique data
    const newName = `Updated Rule ${Date.now()}`;
    const nameInput = dialog.getByLabel(/rule name/i);
    await nameInput.fill(newName);

    // Save
    await dialog.getByRole('button', { name: /save/i }).click();

    // Verify
    await expect(page.getByText(/updated/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(newName)).toBeVisible();
  });
});
```

---

### Example 2: Multi-Level Approval Workflow Test

```typescript
test.describe('Multi-Level Approval - Sequential Flow', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('should approve Level 1 as owner', async ({ page }) => {
    // Sign in as owner (authorized for Level 1)
    await signIn(page, TEST_USERS.owner);

    // Navigate to transfers
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);
    await page.waitForTimeout(1000);

    // Find a transfer with pending Level 1
    const transfers = page.locator('table tbody tr');
    const transferCount = await transfers.count();

    let foundPending = false;

    for (let i = 0; i < transferCount; i++) {
      const row = transfers.nth(i);

      // Check if multi-level transfer
      if (await row.getByText(/multi-level/i).isVisible()) {
        // Click to view details
        const viewButton = row.getByRole('button', { name: /view/i }).first();
        await viewButton.click();

        await page.waitForTimeout(1000);

        // Check if Level 1 is pending
        const level1Pending = page.getByText(/level 1/i).locator('..').getByText(/pending/i);

        if (await level1Pending.isVisible()) {
          foundPending = true;

          // Click Approve button
          const approveButton = page.getByRole('button', { name: /approve level 1/i });
          if (await approveButton.isVisible()) {
            await approveButton.click();

            await page.waitForTimeout(500);

            // Fill confirmation modal
            const confirmDialog = page.getByRole('dialog');
            await expect(confirmDialog).toBeVisible();

            const notesTextarea = confirmDialog.getByLabel(/notes/i);
            if (await notesTextarea.isVisible()) {
              await notesTextarea.fill(`Approved by E2E test at ${new Date().toISOString()}`);
            }

            // Confirm
            await confirmDialog.getByRole('button', { name: /approve/i }).click();

            // Verify success
            await expect(page.getByText(/approval submitted/i)).toBeVisible({ timeout: 10000 });

            // Verify Level 1 now approved
            await page.waitForTimeout(1000);
            await expect(page.getByText(/level 1/i).locator('..').getByText(/approved/i)).toBeVisible();

            // Test complete
            break;
          }
        }

        // Go back and try next transfer
        await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers`);
        await page.waitForTimeout(1000);
      }
    }

    if (!foundPending) {
      console.log('⏭️  Skipping - no pending Level 1 approvals found');
      test.skip();
    }
  });
});
```

---

## When to Use Which Strategy

### Always Use:
- ✅ Cookie clearing between tests (`beforeEach`)
- ✅ Unique data with timestamps
- ✅ Condition-based waits
- ✅ Dialog scoping

### Use When Appropriate:
- ⚠️ Test skipping (when data state unknown)
- ⚠️ Data cleanup (if practical, not always necessary)
- ⚠️ API health checks (once per suite)

### Never Use:
- ❌ Hardcoded test data
- ❌ Arbitrary timeouts (except modal animations)
- ❌ Test order dependencies
- ❌ Generic alert selectors

---

## Comparing to Backend Pattern

| Aspect | Backend (Jest) | Frontend (Playwright) |
|--------|----------------|----------------------|
| **State Reset** | `cleanDatabase()` | `context.clearCookies()` |
| **Data Creation** | Factory functions | Manual form filling |
| **Uniqueness** | `Date.now()` timestamps | `Date.now()` timestamps |
| **Cleanup** | `cleanDatabase()` after | Optional (browser isolated) |
| **Seed Dependency** | None (creates all data) | Minimal (tenant, users) |
| **Parallelization** | Works with isolation | Works with cookie clearing |

---

## Summary

**Key Principles:**
1. **Clear cookies** between every test
2. **Use unique data** with timestamps
3. **Wait for conditions**, not timeouts
4. **Make tests independent** - no execution order
5. **Scope selectors** to dialogs/sections
6. **Skip gracefully** when data state unknown

**Quick Checklist:**
- [ ] `context.clearCookies()` in `beforeEach`
- [ ] Unique data with `Date.now()`
- [ ] Condition-based waits
- [ ] Dialog scoping
- [ ] Test can run alone
- [ ] Test can run in suite

---

**Related Docs:**
- [Frontend Testing Guide](./frontend_testing.md)
- [Test Flakiness Guide](./test_flakiness.md)
- [Backend Test Isolation Pattern](./test_isolation_pattern.md)
- [Troubleshooting Tests](./troubleshooting_tests.md)

---

**Last Updated:** 2025-10-13
**Document Version:** 1.0
