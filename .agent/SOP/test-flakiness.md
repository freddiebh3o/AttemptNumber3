# Test Flakiness Guide

**Purpose:** Understanding and fixing flaky tests - tests that pass individually but fail when run together.

**Last Updated:** 2025-10-12

---

## Table of Contents

1. [What is Test Flakiness?](#what-is-test-flakiness)
2. [Common Causes](#common-causes)
3. [Solutions](#solutions)
4. [Patterns](#patterns)
5. [Best Practices](#best-practices)

---

## What is Test Flakiness?

**Flaky Test:** A test that passes when run individually but fails when run with other tests (or vice versa).

### Symptoms:
- ✅ Test passes when run alone: `npm run test:accept specific-test.spec.ts`
- ❌ Test fails when run with suite: `npm run test:accept`
- ❓ Test results are inconsistent - sometimes pass, sometimes fail
- 🔄 Re-running the same test gives different results

### Why It's a Problem:
- Wastes developer time investigating non-issues
- Erodes trust in test suite
- Masks real bugs
- Slows down CI/CD pipelines

---

## Common Causes

### 1. Shared State / Database Pollution

**Problem:** Tests are modifying the same database records or browser state.

```typescript
// ❌ BAD - Tests share database state
test('creates user A', async () => {
  await createUser({ email: 'test@example.com' });
});

test('creates user B', async () => {
  // Fails if user A already exists!
  await createUser({ email: 'test@example.com' });
});
```

**Solution:** Clean database before each test.

```typescript
// ✅ GOOD - Each test starts with clean slate
beforeEach(async () => {
  await cleanDatabase();
});
```

---

### 2. Race Conditions / Timing Issues

**Problem:** Network requests or UI rendering haven't completed.

```typescript
// ❌ BAD - Arbitrary timeout
await page.waitForTimeout(1000);
await expect(page.getByText('Loaded')).toBeVisible();
```

**Solution:** Wait for specific conditions.

```typescript
// ✅ GOOD - Wait for element to appear
await expect(page.getByText('Loaded')).toBeVisible({ timeout: 5000 });
```

---

### 3. Browser State / Cookies

**Problem:** Cookies/storage from previous tests affecting current test.

```typescript
// ❌ BAD - Session from previous test still active
test('should redirect unauthenticated user', async ({ page }) => {
  // Previous test left user signed in!
  await page.goto('/protected');
  // Fails because user is still authenticated
});
```

**Solution:** Clear cookies between tests.

```typescript
// ✅ GOOD - Clear state before each test
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});
```

---

### 4. Test Order Dependency

**Problem:** Tests accidentally depend on running in a specific order.

```typescript
// ❌ BAD - Test B depends on Test A
test('A: creates product', async () => {
  product = await createProduct({ name: 'Widget' });
});

test('B: updates product', async () => {
  // Fails if Test A didn't run first!
  await updateProduct(product.id, { price: 100 });
});
```

**Solution:** Make each test independent.

```typescript
// ✅ GOOD - Each test creates its own data
test('creates product', async () => {
  const product = await createProduct({ name: 'Widget' });
  // Test complete
});

test('updates product', async () => {
  const product = await createProduct({ name: 'Widget' });
  await updateProduct(product.id, { price: 100 });
  // Test complete
});
```

---

### 5. Parallel Execution Issues

**Problem:** Tests running in parallel modifying shared resources.

```typescript
// ❌ BAD - Multiple tests hitting same product
test('deletes first product', async () => {
  const products = await getProducts();
  await deleteProduct(products[0].id);
});

test('updates first product', async () => {
  const products = await getProducts();
  await updateProduct(products[0].id, { name: 'Updated' });
  // Fails if deletion happened first!
});
```

**Solution:** Isolate test data or run sequentially.

```typescript
// ✅ GOOD - Each test uses unique data
test('deletes product', async () => {
  const product = await createProduct({ sku: 'DELETE-TEST' });
  await deleteProduct(product.id);
});

test('updates product', async () => {
  const product = await createProduct({ sku: 'UPDATE-TEST' });
  await updateProduct(product.id, { name: 'Updated' });
});
```

---

## Solutions

### Solution 1: Test Isolation (Backend)

**Clean database before each test:**

```typescript
import { cleanDatabase } from './helpers/db';

describe('Product Routes', () => {
  beforeEach(async () => {
    await cleanDatabase(); // Start with empty database
  });

  afterAll(async () => {
    await cleanDatabase(); // Cleanup after suite
  });

  test('should create product', async () => {
    // Test code
  });
});
```

---

### Solution 2: Test Isolation (Frontend)

**Clear browser state before each test:**

```typescript
// ✅ GOOD - Clear cookies only (not localStorage)
test.beforeEach(async ({ context }) => {
  // Clear cookies to prevent test interference
  // Note: Don't clear localStorage/sessionStorage here - causes SecurityError
  await context.clearCookies();
});
```

**Why not clear localStorage/sessionStorage?**

```typescript
// ❌ BAD - Causes SecurityError
test.beforeEach(async ({ page, context }) => {
  await context.clearCookies();
  await page.evaluate(() => {
    localStorage.clear(); // SecurityError: Access denied
    sessionStorage.clear();
  });
});
```

**Reason:** Page hasn't navigated yet, so accessing storage throws SecurityError.
**Alternative:** Browser clears storage automatically on navigation with new session.

---

### Solution 3: Better Waits

Replace arbitrary timeouts with condition-based waits:

```typescript
// ❌ BAD - Arbitrary timeout
await page.waitForTimeout(1000);

// ✅ GOOD - Wait for specific condition
await page.waitForSelector('table tbody tr:first-child', { state: 'visible' });
await expect(page.getByText(/on hand:/i)).toBeVisible();
await page.waitForLoadState('networkidle');
```

---

### Solution 4: Run Tests Sequentially

If tests are inherently difficult to parallelize, run them sequentially:

**playwright.config.ts:**
```typescript
export default defineConfig({
  workers: 1, // Run tests one at a time (slower but more reliable)
  // OR
  fullyParallel: false, // Run describe blocks sequentially
});
```

---

### Solution 5: Add Retries (Temporary Fix)

As a temporary measure while fixing root causes:

**playwright.config.ts:**
```typescript
export default defineConfig({
  retries: 1, // Retry failed tests once
  // CI environment might want more retries
  retries: process.env.CI ? 2 : 0,
});
```

**Note:** Retries mask the real problem - use as temporary fix only!

---

## Patterns

### Pattern 1: Unique Test Data

Create unique data for each test to avoid conflicts:

```typescript
// ✅ GOOD - Timestamp ensures uniqueness
const testProduct = await createProduct({
  sku: `TEST-${Date.now()}`,
  name: `Product ${Date.now()}`,
});
```

### Pattern 2: Test-Specific Users

Create users dynamically instead of reusing:

```typescript
// ❌ BAD - Reusing same user
const sharedUser = await createUser({ email: 'test@example.com' });

// ✅ GOOD - Unique user per test
const user = await createUser({
  email: `test-${Date.now()}@example.com`
});
```

### Pattern 3: Cleanup After Actions

Clean up after destructive actions:

```typescript
test('should delete product', async () => {
  const product = await createProduct({ name: 'Test' });

  await deleteProduct(product.id);

  // Verify cleanup
  const products = await getProducts();
  expect(products.find(p => p.id === product.id)).toBeUndefined();
});
```

### Pattern 4: Idempotent Operations

Make operations idempotent when possible:

```typescript
// ✅ GOOD - Upsert instead of create
await upsertProduct({
  sku: 'TEST-001', // Unique key
  name: 'Product',
  priceInPence: 1000,
});
```

---

## Real-World Example: Product Management Tests

**Problem:** Tests passed individually but failed when run together.

**Symptoms:**
```
✅ npm run test:accept product-management.spec.ts -- -g "create product"  # PASS
✅ npm run test:accept product-management.spec.ts -- -g "delete product"  # PASS
❌ npm run test:accept product-management.spec.ts                         # FAIL (2/23)
```

**Root Causes:**
1. Browser cookies from previous tests
2. Tests creating products with same SKU
3. Race conditions with table loading

**Solutions Applied:**

1. **Added beforeEach hook:**
```typescript
test.beforeEach(async ({ context }) => {
  await context.clearCookies(); // Clear session between tests
});
```

2. **Made SKUs unique:**
```typescript
await page.getByLabel(/sku/i).fill(`TEST-${Date.now()}`);
```

3. **Better waits:**
```typescript
// ❌ BEFORE
await page.waitForTimeout(1000);

// ✅ AFTER
await page.waitForSelector('table tbody tr:first-child', {
  state: 'visible',
  timeout: 10000
});
```

**Result:** 21/23 tests passing (91% pass rate)

Remaining 2 flaky tests have timing/race conditions that will be addressed in future iterations.

---

## Best Practices

### ✅ DO

1. **Clean state before each test** - Database, cookies, storage
2. **Use unique test data** - Timestamps, UUIDs, random strings
3. **Wait for specific conditions** - Not arbitrary timeouts
4. **Make tests independent** - Each test should work in isolation
5. **Use factories for test data** - DRY principle
6. **Run tests locally** - Catch flakiness before CI
7. **Use Playwright UI mode** - Debug flaky tests visually

### ❌ DON'T

1. **Don't share state between tests** - No global variables
2. **Don't rely on test order** - Playwright randomizes order
3. **Don't use arbitrary timeouts** - `waitForTimeout(1000)` is unreliable
4. **Don't ignore flaky tests** - Fix root cause, don't just retry
5. **Don't clear localStorage in beforeEach** - Causes SecurityError
6. **Don't reuse test data** - Create fresh data for each test
7. **Don't mock time** - Use real delays with proper waits

---

## Debugging Flaky Tests

### Step 1: Reproduce Locally

```bash
# Run test suite multiple times
for i in {1..10}; do npm run test:accept; done
```

### Step 2: Run in UI Mode

```bash
npm run test:accept:ui
```

Watch test execution to spot:
- Race conditions
- Timing issues
- State pollution

### Step 3: Check Test Output

Look for:
- `SecurityError` - Trying to access storage too early
- `Strict mode violation` - Multiple elements matched
- `Timeout` - Element not appearing
- `404` / `403` - Wrong user role or missing data

### Step 4: Isolate the Problem

Run tests in different combinations:
```bash
# Run individually
npm run test:accept -- -g "test name"

# Run first two tests
npm run test:accept -- -g "test1|test2"

# Run in different order
npm run test:accept -- --shard 1/1
```

### Step 5: Add Logging

```typescript
test('flaky test', async ({ page }) => {
  console.log('Starting test...');

  await signIn(page, TEST_USERS.editor);
  console.log('Signed in, current URL:', page.url());

  await page.getByRole('button', { name: /new/i }).click();
  console.log('Clicked button');

  // ... rest of test
});
```

---

## When to Use Retries

Retries are acceptable for:
- **External service flakiness** - Third-party APIs
- **Known infrastructure issues** - Slow CI runners
- **Temporary workaround** - While fixing root cause

Retries are NOT acceptable for:
- **Test logic errors** - Fix the test instead
- **Application bugs** - Fix the bug instead
- **Poor test design** - Refactor the test instead

---

## Summary

**Key Takeaways:**
1. Flaky tests are usually caused by **shared state** or **timing issues**
2. **Test isolation** is critical - clean database and clear cookies
3. **Don't use arbitrary timeouts** - wait for specific conditions
4. **Make each test independent** - don't rely on execution order
5. **Retries mask problems** - fix root causes instead

**Quick Checklist:**
- [ ] Added `beforeEach` to clean state
- [ ] Using unique test data (timestamps, UUIDs)
- [ ] Waiting for specific conditions (not timeouts)
- [ ] Tests pass when run individually
- [ ] Tests pass when run in suite
- [ ] Tests pass when run multiple times

---

**Next Steps:**
- Apply isolation patterns to your tests
- Review [Backend Testing Guide](./backend_testing.md) or [Frontend Testing Guide](./frontend_testing.md)
- See [Troubleshooting Guide](./troubleshooting_tests.md) for specific errors
