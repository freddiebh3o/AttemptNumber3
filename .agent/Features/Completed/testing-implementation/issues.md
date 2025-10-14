# E2E Test Fixes Needed

## Context
We have 7 failing E2E tests in a Playwright test suite. The main issue is **incorrect interaction with Mantine UI components**.

## Critical Information About Mantine Components

**Mantine Select components are NOT HTML `<select>` elements.** They are custom components built with `<input>` and `<div>` elements.

**The Problem:**
- Playwright's `selectOption()` method **DOES NOT WORK** with Mantine Selects
- Tests are failing because they try to click options before opening the dropdown
- Strict mode violations occur when multiple buttons/elements have the same name

**The Solution Pattern:**
```typescript
// ❌ WRONG - Will timeout or fail
await page.locator('[role="option"]').first().click({ force: true });

// ✅ CORRECT - Must open dropdown FIRST
await page.getByLabel(/branch/i).click();  // Opens the dropdown
await page.waitForTimeout(300);  // Wait for dropdown animation
await page.locator('[role="option"]').first().click();  // Then select option
```

## 7 Failing Tests to Fix

### 1. `stock-management.spec.ts` - "should display ledger table with entries" (line 315)
**Issue:** No ledger data exists for test
**Fix:** Already has helper `createProductWithStockViaAPI()` - should be working now

### 2. `stock-management.spec.ts` - "should paginate ledger entries" (line 395)
**Issue:** No ledger data exists for test
**Fix:** Already has helper `createProductWithStockViaAPI()` - should be working now

### 3. `transfer-reversal.spec.ts` - "should create, complete, and reverse a transfer" (line 96)
**Issue:** Mantine Select dropdowns for products and branches not opening
**Fix:** Around lines 105-145, update all dropdown interactions:
```typescript
// Find branch selection, add wait and proper click
await page.getByLabel(/source branch/i).click();
await page.waitForTimeout(300);
await page.locator('[role="option"]').first().click();
```

### 4. `transfer-templates.spec.ts` - "should navigate to templates page from sidebar" (line 164)
**Issue:** Sidebar nav group not expanding before clicking child link
**Fix:** Around lines 167-174:
```typescript
const stockManagementNav = page.getByRole('navigation').getByText(/stock management/i);
if (await stockManagementNav.isVisible()) {
  await stockManagementNav.click();
  await page.waitForTimeout(300);
}
await page.getByRole('link', { name: /transfer templates/i }).click();
```

### 5. `transfer-templates.spec.ts` - "should create template with products" (line 223)
**Issue:** Mantine Select dropdowns not opening properly
**Fix:** Lines 240-272, update all select interactions:
```typescript
// Source branch
await dialog.getByLabel(/source branch/i).click();
await page.waitForTimeout(500);
await page.locator('[role="option"]').first().click();

// Destination branch
await dialog.getByLabel(/destination branch/i).click();
await page.waitForTimeout(500);
await page.locator('[role="option"]').nth(1).click();

// Product select
await dialog.getByRole('button', { name: /add product/i }).click();
await page.waitForTimeout(500);
await dialog.locator('[role="combobox"]').first().click();
await page.waitForTimeout(500);
await page.locator('[role="option"]').first().click();
```

### 6. `transfer-templates.spec.ts` - "should filter by source branch" (line 349)
**Issue:** Mantine Select dropdown for branch filter
**Fix:** Around lines 357-365:
```typescript
await page.getByLabel(/source branch/i).click();
await page.waitForTimeout(300);
await page.locator('[role="option"]').nth(1).click();
```

### 7. `transfer-templates.spec.ts` - "should delete template with confirmation" (line 468)
**Issue:** Cannot find actions button or dropdown timing
**Fix:** Around line 497, ensure proper waiting:
```typescript
const templateRow = page.locator('tr', { hasText: templateName });
await expect(templateRow).toBeVisible();
await page.waitForTimeout(500);  // Wait for row to fully render

const actionsButton = templateRow.locator('td').last().locator('button[aria-haspopup="menu"]');
await actionsButton.click();
```

## Key Patterns to Apply

1. **Always click to open dropdown first**: `await element.click(); await page.waitForTimeout(300);`
2. **Then click the option**: `await page.locator('[role="option"]').first().click();`
3. **For strict mode violations**: Add `.first()` or `.last()` to be specific
4. **For sidebar navigation**: Expand parent nav group before clicking child links
5. **Add waits after animations**: 300-500ms after opening dropdowns or expanding menus

## Files to Modify
- `admin-web/e2e/stock-management.spec.ts`
- `admin-web/e2e/transfer-reversal.spec.ts`
- `admin-web/e2e/transfer-templates.spec.ts`

## Additional Context

The documentation has already been updated in `.agent/SOP/frontend_testing.md` with the correct Mantine component patterns. Refer to that file for additional examples.

The pattern is consistent across all tests - just need to add the proper Mantine Select interaction pattern with appropriate waits.

## Test Isolation Pattern (Already Implemented)

Most tests already use the API isolation pattern:
- Create test data via API before test
- Use `try/finally` blocks for guaranteed cleanup
- Delete test data via API in `finally` block
- Use unique timestamps to avoid collisions

Example:
```typescript
test('should do something', async ({ page }) => {
  await signIn(page, TEST_USERS.owner);
  const timestamp = Date.now();
  const entityId = await createEntityViaAPI(page, { name: `E2E Test ${timestamp}` });

  try {
    // Test actions...
  } finally {
    await deleteEntityViaAPI(page, entityId);
  }
});
```
