# Troubleshooting Tests - Common Issues & Solutions

**Purpose:** Reference guide for debugging common testing errors and issues.

**Last Updated:** 2025-10-12

---

## Table of Contents

1. [Backend Issues](#backend-issues)
2. [Frontend Issues](#frontend-issues)
3. [Database Issues](#database-issues)
4. [Authentication Issues](#authentication-issues)
5. [Permission Issues](#permission-issues)
6. [Playwright-Specific Issues](#playwright-specific-issues)

---

## Backend Issues

### Issue 1: Prisma Client Not Generated

**Error:**
```
Cannot find module '@prisma/client'
```

**Cause:** Prisma client hasn't been generated after schema changes.

**Solution:**
```bash
cd api-server
npm run prisma:generate
```

---

### Issue 2: Wrong Error Code in Assertions

**Error:**
```
Expected: "NOT_FOUND"
Received: "RESOURCE_NOT_FOUND"
```

**Cause:** Error codes were standardized to `RESOURCE_NOT_FOUND`.

**Solution:** Update test assertions:
```typescript
// ❌ OLD
expect(response.body.error.errorCode).toBe('NOT_FOUND');

// ✅ NEW
expect(response.body.error.errorCode).toBe('RESOURCE_NOT_FOUND');
```

---

### Issue 3: Foreign Key Constraint Errors

**Error:**
```
Foreign key constraint failed on the field
```

**Cause:** Deleting parent records before child records in `cleanDatabase()`.

**Solution:** Delete in correct order (children first, parents last):
```typescript
export async function cleanDatabase() {
  // ✅ CORRECT ORDER: Delete children first
  await prisma.stockLedger.deleteMany();  // Child
  await prisma.stockLot.deleteMany();     // Child
  await prisma.product.deleteMany();      // Child
  await prisma.tenant.deleteMany();       // Parent
}
```

---

### Issue 4: Session Cookie Not Being Set

**Cause:** Incorrect cookie name or missing `Cookie` header.

**Solution:**
```typescript
// Make sure SESSION_COOKIE_NAME matches your app
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'mt_session';

// Use helper to set cookie correctly
const sessionCookie = createSessionCookie(user.id, tenant.id);
const response = await request(app)
  .get('/api/auth/me')
  .set('Cookie', sessionCookie);  // Don't forget .set()!
```

---

### Issue 5: Permissions Not Found in Database

**Error:**
```
Cannot find permission with key 'products:read'
```

**Cause:** Permissions need to be seeded before running tests.

**Solution:**
```bash
# Seed permissions first
cd api-server
npm run seed:rbac

# Then run tests
npm run test:accept
```

---

### Issue 6: Rate Limiter Tests Interfere

**Error:**
```
Expected: 200
Received: 429
```

**Cause:** Rate limiter uses in-memory Map that persists across tests.

**Solution:** Use unique session IDs per test:
```typescript
test('should allow requests within limit', async () => {
  const uniqueSessionId = `session-${Date.now()}`;
  const cookie = createSessionCookie(userId, tenantId, uniqueSessionId);

  // Now tests won't interfere
});
```

---

### Issue 7: Idempotency Record Not Updating

**Error:** Idempotency tests fail because record doesn't update in DB.

**Cause:** Async database writes need time to complete.

**Solution:** Add small delay after operations:
```typescript
await request(app)
  .post('/api/products')
  .set('Idempotency-Key', key)
  .send(body);

// Wait for DB write
await new Promise(resolve => setTimeout(resolve, 100));

// Now check database
const record = await prisma.idempotencyRecord.findUnique({
  where: { idempotencyKey: key }
});
```

---

### Issue 8: Express Error Handler Not Invoked

**Error:** Error handler doesn't catch `null` or `undefined`.

**Cause:** Express doesn't invoke error handler for falsy values.

**Solution:** Throw proper Error objects:
```typescript
// ❌ BAD
throw null;
throw undefined;

// ✅ GOOD
throw new Error('Something went wrong');
throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid input');
```

---

### Issue 9: Wrong Helper Function for Roles

**Error:**
```
Permission tests fail with "User does not have permission"
```

**Cause:** Using `createTestRole(permissionIds)` instead of `createTestRoleWithPermissions(permissionKeys)`.

**Solution:**
```typescript
// ❌ BAD - Using permission IDs
const role = await createTestRole(tenant.id, [permissionId1, permissionId2]);

// ✅ GOOD - Using permission keys
const role = await createTestRoleWithPermissions(tenant.id, [
  'products:read',
  'products:write'
]);
```

---

### Issue 10: Response Structure Mismatch

**Error:**
```
Expected: response.body.data.aggregate
Received: response.body.data.productStock
```

**Cause:** Response field names differ from service layer.

**Solution:** Check actual response structure:
```typescript
// ✅ Check what the API actually returns
const response = await request(app).get('/api/stock/levels');

// Use correct field names
expect(response.body.data.productStock).toBeDefined();
expect(response.body.data.items).toBeInstanceOf(Array);
```

---

### Issue 11: Schema Field Mismatch

**Error:**
```
Cannot read property 'qtyBefore' of undefined
```

**Cause:** StockLedger schema uses `qtyDelta`, not `qtyBefore`/`qtyChange`/`qtyAfter`.

**Solution:** Use correct field names from Prisma schema:
```typescript
// ❌ BAD
expect(ledgerEntry.qtyBefore).toBe(10);
expect(ledgerEntry.qtyChange).toBe(5);

// ✅ GOOD
expect(ledgerEntry.qtyDelta).toBe(5); // Positive for increase, negative for decrease
```

---

## Frontend Issues

### Issue 12: SecurityError - Access Denied for localStorage

**Error:**
```
SecurityError: Failed to read the 'localStorage' property from 'Window': Access is denied for this document.
```

**Cause:** Trying to clear localStorage/sessionStorage before page has navigated.

**Solution:** Only clear cookies in beforeEach:
```typescript
// ❌ BAD - Causes SecurityError
test.beforeEach(async ({ page, context }) => {
  await context.clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

// ✅ GOOD - Only clear cookies
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  // Storage is cleared automatically on navigation
});
```

---

### Issue 13: Strict Mode Violation - Multiple Elements

**Error:**
```
strict mode violation: getByLabel(/quantity/i) resolved to 2 elements
```

**Cause:** Selector matches multiple elements (e.g., "Sort by quantity" button and quantity input).

**Solution:** Scope to dialog/modal:
```typescript
// ❌ BAD - Matches multiple elements
await page.getByLabel(/quantity/i).fill('5');

// ✅ GOOD - Scoped to dialog
const dialog = page.getByRole('dialog');
await dialog.getByLabel(/quantity/i).fill('5');
```

---

### Issue 14: Table Header Matches Multiple Elements

**Error:**
```
strict mode violation: locator('th:has-text("Received")') resolved to 2 elements
```

**Cause:** Partial text match ("Received" matches "Received" and "Received at").

**Solution:** Use exact text or scope to specific table:
```typescript
// ❌ BAD - Partial match
await expect(page.locator('th:has-text("Received")')).toBeVisible();

// ✅ GOOD - Exact text
await expect(lotsTable.locator('th', { hasText: 'Received at' })).toBeVisible();

// OR scope to first table
const lotsTable = page.locator('table').first();
await expect(lotsTable.locator('th:has-text("Received")')).toBeVisible();
```

---

### Issue 15: Can't Distinguish Similar Selectors

**Error:** Test clicks tenant switcher instead of branch selector.

**Cause:** Both have `input[aria-haspopup="listbox"]` selector.

**Solution:** Use unique attributes:
```typescript
// ❌ BAD - Matches both
const select = page.locator('input[aria-haspopup="listbox"]');

// ✅ GOOD - Branch has 'required' attribute
const branchSelect = page.locator('input[required][aria-haspopup="listbox"]');
```

---

### Issue 16: URL Parameter Not Found

**Error:**
```
Expected URL to contain: branchId=
Received URL: /acme/products/123?tab=fifo
```

**Cause:** `branchId` only appears when branch is CHANGED, not on default selection.

**Solution:** Actually change the branch:
```typescript
// ❌ BAD - Expects branchId immediately
await expect(page).toHaveURL(/branchId=/);

// ✅ GOOD - Change branch first
const branchSelect = page.locator('input[required][aria-haspopup="listbox"]');
await branchSelect.click();
await page.locator('[role="option"]').nth(1).click();
await expect(page).toHaveURL(/branchId=/); // NOW it appears
```

---

### Issue 17: Stock Adjustment Fails with 403

**Error:** Test fails with "Permission denied" even though it should work.

**Cause:** Using editor role which lacks stock:write permission (or only has 1 branch).

**Solution:** Use owner role:
```typescript
// ❌ BAD - Editor lacks stock:write
await signIn(page, TEST_USERS.editor);

// ✅ GOOD - Owner has stock:write
await signIn(page, TEST_USERS.owner);
```

---

### Issue 18: Multiple Alerts Cause Strict Mode Violation

**Error:**
```
strict mode violation: getByRole('alert') resolved to 3 elements
```

**Cause:** Multiple alerts on page (sign-in notification, ledger alert, validation error).

**Solution:** Check for specific error text:
```typescript
// ❌ BAD - Multiple alerts
await expect(page.getByRole('alert')).toBeVisible();

// ✅ GOOD - Specific text
await expect(page.getByText(/quantity must be greater than 0/i)).toBeVisible();
```

---

### Issue 19: TypeScript Error "Cannot find name 'process'"

**Error:**
```
Cannot find name 'process'. Do you need to install type definitions for node?
```

**Cause:** E2E test files don't have Node.js types configured.

**Solution:** Create `tsconfig.e2e.json`:
```json
{
  "extends": "./tsconfig.node.json",
  "compilerOptions": {
    "types": ["node", "@playwright/test"]
  },
  "include": ["e2e/**/*.ts"]
}
```

Update main `tsconfig.json`:
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.e2e.json" }  // Add this
  ]
}
```

---

### Issue 20: Dropdown Click Matches Table Cell

**Error:**
```
strict mode violation: getByText('ADJUSTMENT', { exact: true }) resolved to 2 elements
```

**Cause:** "ADJUSTMENT" appears in both ledger table and kind dropdown.

**Solution:** Scope to listbox:
```typescript
// ❌ BAD - Matches table cell and dropdown option
await page.getByText('ADJUSTMENT', { exact: true }).click();

// ✅ GOOD - Scoped to dropdown
await page.getByLabel(/kind/i).click();
await page.getByRole('listbox').getByText('ADJUSTMENT', { exact: true }).click();
```

---

## Database Issues

### Issue 21: Database Connection Errors

**Error:**
```
Can't reach database server
```

**Cause:** PostgreSQL not running or wrong connection string.

**Solution:**
```bash
# Check if PostgreSQL is running
pg_isready

# Check DATABASE_URL environment variable
echo $DATABASE_URL

# For Supabase/Render: Use Session Pooler URL (not direct connection)
DATABASE_URL=postgresql://user:pass@host:6543/db?pgbouncer=true
```

---

### Issue 22: Migration Errors

**Error:**
```
Migration failed: table already exists
```

**Cause:** Database out of sync with migration files.

**Solution:**
```bash
# Reset database (DESTRUCTIVE - dev only!)
npm run db:reset:dev

# OR apply pending migrations
npm run db:deploy

# OR create new migration
npm run db:migrate -- --name fix_schema
```

---

### Issue 23: Seed Data Errors

**Error:**
```
Unique constraint failed on field: sku
```

**Cause:** Seed script running multiple times with same data.

**Solution:**
```bash
# Reset and re-seed
npm run db:reset:dev

# OR upsert in seed script
await prisma.product.upsert({
  where: { sku: 'WIDGET-001' },
  update: {},
  create: { sku: 'WIDGET-001', name: 'Widget' }
});
```

---

## Authentication Issues

### Issue 24: Tests Fail Without Authentication

**Error:**
```
Expected: 200
Received: 401
```

**Cause:** Missing session cookie in request.

**Solution:**
```typescript
const sessionCookie = createSessionCookie(user.id, tenant.id);
const response = await request(app)
  .get('/api/products')
  .set('Cookie', sessionCookie); // Don't forget this!
```

---

### Issue 25: Wrong Tenant Context

**Error:**
```
Expected: product data
Received: 404 NOT_FOUND
```

**Cause:** User signed in to different tenant than the product belongs to.

**Solution:**
```typescript
// Create product in tenant A
const productA = await createTestProduct(tenantA.id);

// Sign in as user from tenant A (not tenant B!)
const userA = await createTestUser(tenantA.id, 'OWNER');
const cookie = createSessionCookie(userA.id, tenantA.id);

const response = await request(app)
  .get(`/api/products/${productA.id}`)
  .set('Cookie', cookie);

expect(response.status).toBe(200);
```

---

## Permission Issues

### Issue 26: Stock Operations Fail with 403

**Error:**
```
Expected: 201
Received: 403 PERMISSION_DENIED
```

**Cause:** Stock operations require BOTH UserTenantMembership AND UserBranchMembership.

**Solution:**
```typescript
const tenant = await createTestTenant();
const branch = await createTestBranch(tenant.id);
const user = await createTestUser(tenant.id, 'OWNER');

// ✅ MUST add branch membership
await prisma.userBranchMembership.create({
  data: {
    userId: user.id,
    branchId: branch.id,
  },
});

// Now stock operations will work
```

---

### Issue 27: Permission Tests Fail

**Error:**
```
Expected: 403
Received: 200
```

**Cause:** Role has unexpected permissions.

**Solution:** Check RBAC catalog and use correct role:
```typescript
// Check api-server/src/rbac/catalog.ts for actual permissions

// EDITOR permissions: products:read, products:write, stock:read
// EDITOR does NOT have: users:manage, branches:manage

// ✅ Use correct role for test
const viewerRole = await createTestRoleWithPermissions(tenant.id, ['products:read']);
```

---

## Playwright-Specific Issues

### Issue 28: Page Not Loading

**Error:**
```
TimeoutError: page.waitForSelector: Timeout 30000ms exceeded
```

**Cause:** API server not running or slow network.

**Solution:**
```bash
# Start API server
cd api-server && npm run dev

# Check API health
curl http://localhost:4000/api/health

# Increase timeout in test
await page.waitForSelector('table', { timeout: 60000 });
```

---

### Issue 29: Element Not Found

**Error:**
```
locator.click: Error: element not found
```

**Cause:** Selector doesn't match any elements, or element not visible yet.

**Solution:**
```typescript
// Check if element exists
const count = await page.locator('button').count();
console.log('Button count:', count);

// Wait for element to be visible
await page.waitForSelector('button', { state: 'visible' });

// Use more specific selector
await page.getByRole('button', { name: /submit/i }).click();
```

---

### Issue 30: Hydration Error

**Error:**
```
Hydration failed because the initial UI does not match
```

**Cause:** Invalid HTML nesting (e.g., `<div>` inside `<p>`).

**Solution:** Fix React component structure:
```typescript
// ❌ BAD - div in p
<Text>
  Current version: <Badge>{version}</Badge>
</Text>

// ✅ GOOD - separate elements
<Group gap="xs">
  <Text>Current version:</Text>
  <Badge>{version}</Badge>
</Group>
```

---

## Quick Debugging Checklist

When a test fails:

1. **Check API server** - Is it running? `curl http://localhost:4000/api/health`
2. **Check database** - Migrations applied? Data seeded? `npm run db:studio`
3. **Check permissions** - RBAC seeded? Correct role? `npm run seed:rbac`
4. **Check isolation** - Is `beforeEach` cleaning state?
5. **Check selectors** - Element visible? Correct selector? Use Playwright UI mode
6. **Check logs** - Console errors? Network errors? Check terminal output
7. **Run individually** - Does test pass alone? `npm run test:accept -- -g "test name"`
8. **Check documentation** - Review test guides and patterns

---

## Getting More Help

1. **Check test guides:**
   - [Backend Testing Guide](./backend_testing.md)
   - [Frontend Testing Guide](./frontend_testing.md)
   - [Test Flakiness Guide](./test_flakiness.md)

2. **Review existing tests:**
   - Look at similar tests in `__tests__/` or `e2e/` directories
   - Follow established patterns

3. **Use debugging tools:**
   - Backend: Add `console.log()` statements
   - Frontend: Use `npm run test:accept:ui` for visual debugging
   - Use `await page.pause()` to inspect page state

4. **Check implementation docs:**
   - [testing_implementation.md](../Tasks/testing_implementation.md) for detailed implementation notes
   - RBAC catalog: `api-server/src/rbac/catalog.ts` for permissions
   - Seed data: `api-server/prisma/seed.ts` for test users

---

**Remember:** Most test failures fall into these categories:
- ❌ Missing setup (API server, database, permissions)
- ❌ Wrong user role or tenant context
- ❌ Selector issues (multiple matches, element not visible)
- ❌ State pollution (shared state between tests)
- ❌ Timing issues (race conditions, slow networks)

Fix the root cause, don't just add retries or timeouts!
