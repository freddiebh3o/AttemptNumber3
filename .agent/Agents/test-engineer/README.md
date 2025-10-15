# test-engineer - Work Portfolio

**Agent Definition:** [.claude/agents/test-engineer.md](../../../.claude/agents/test-engineer.md)

## Purpose
Jest backend tests, Playwright E2E tests, test helpers/factories, RBAC testing, flakiness resolution, and test coverage.

## Recent Work (Last 10)

<!-- Agents will update this section automatically -->
<!-- Format: - [YYYY-MM-DD] [Task Name](./work/filename.md) - Brief description -->

- [2025-10-14] [Barcode Transfer Race Condition Fix](./work/barcode-transfer-race-condition-fix-2025-10-14.md) - Fixed E2E test race condition causing unique constraint violations on transferNumber (moved serial mode to file level)
- [2025-10-14] [Barcode Scanning Tests](./work/barcode-scanning-tests-2025-10-14.md) - Comprehensive test coverage for barcode scanning feature (60 tests: 45 backend + 15 frontend)

## Common Patterns

### Typical Tasks
- Writing Jest integration tests for API endpoints
- Creating Playwright E2E tests for user flows
- Building test helpers and factories
- Testing permission enforcement (different roles)
- Fixing flaky tests
- Testing multi-tenant isolation
- Testing FIFO stock operations

### Standard Workflow
1. Read all feature agent outputs for context
2. Create backend tests in `api-server/__tests__/`
3. Create frontend E2E tests in `admin-web/e2e/`
4. Add test helpers if needed
5. Test different user roles (owner, viewer, etc.)
6. Test error cases and edge conditions
7. Ensure tests are isolated and not flaky
8. Run tests: `npm run test:accept` (backend), `npm run test:accept` (frontend)

### Output Location
- **Work log**: `.agent/Agents/test-engineer/work/{feature}-tests-{date}.md`
- **Feature doc**: `.agent/Features/{status}/{feature-name}/test-engineer.md`

## Related Agents

### Before Me
- All other agents (I test their work)

### After Me
- **integration-orchestrator**: Verifies everything works together

### Works With
- All agents (testing is cross-cutting)

## Key Responsibilities

✅ Comprehensive test coverage (happy path + edge cases)
✅ Permission-based testing (all roles)
✅ Multi-tenant isolation testing
✅ Backend integration tests (Jest + real DB)
✅ Frontend E2E tests (Playwright)
✅ Test isolation (independent, idempotent)
✅ Flakiness prevention and debugging
✅ Test helpers and factories
✅ **Prioritize data-testid selectors** (see Testing Best Practices below)
✅ **Add missing data-testid attributes when needed**

## Testing Best Practices

### Always Prioritize data-testid Selectors

**IMPORTANT:** When writing E2E tests, ALWAYS prefer `getByTestId()` over text-based selectors for reliability and maintainability.

**Selector Priority (in order):**
1. ✅ **data-testid** - Most reliable, won't break when text changes
2. ✅ **getByRole** - Good for semantic elements (buttons, links, etc.)
3. ⚠️ **getByLabel** - Okay for form inputs with labels
4. ❌ **getByText** - Avoid for dynamic content (causes strict mode violations)

**When to Add Missing data-testid:**

If you encounter any of these issues while writing tests, ADD the data-testid attribute to the component:

- 🚫 **Strict mode violations**: "resolved to 6 elements"
- 🔄 **Duplicate text**: Multiple components with same text
- 📊 **Dynamic content**: Charts, metrics, tables with changing data
- 🎯 **Ambiguous selectors**: Hard to target specific element

**Process:**
1. Try to use `getByTestId()` first
2. If testid doesn't exist, add it to the component
3. Use kebab-case naming: `data-testid="component-type-purpose"`
4. Document in test comments why testid was needed

**Examples from Phase 4:**

```typescript
// ✅ Good - Using data-testid (no strict mode issues)
await expect(page.getByTestId('metric-total-transfers')).toBeVisible();
await expect(page.getByTestId('chart-transfer-volume')).toBeVisible();
await expect(page.getByTestId('table-top-routes')).toBeVisible();

// ❌ Bad - Text selectors (causes strict mode violations)
await expect(page.getByText(/total transfers/i)).toBeVisible(); // Matches 6 elements!
await expect(page.getByText('APPROVED')).toBeVisible(); // Matches status badge, timeline, table header

// ⚠️ Workaround - Adding .first() (better to use testid)
await expect(page.getByText('APPROVED').first()).toBeVisible();
```

### Mantine Component Testing Patterns

**NumberInput in Tables:**
```typescript
// ✅ Correct pattern for NumberInput without labels
const qtyInput = modal.locator('input[type="text"]').first();
await expect(qtyInput).toBeVisible();

// Wait for value to populate (useEffect initialization)
await expect(qtyInput).toHaveValue('50', { timeout: 5000 });

// Change value: triple-click to select all, then fill
await qtyInput.click({ clickCount: 3 });
await qtyInput.press('Backspace');
await qtyInput.fill('30');

// Wait for React to re-render
await page.waitForTimeout(300);

// Verify the value changed
await expect(qtyInput).toHaveValue('30');
```

**Why this pattern:**
- Triple-click selects all text (avoids keystroke accumulation)
- `.fill()` after clearing works better than `.type()`
- `.type()` processes each character individually, triggering validation on each keystroke
- Mantine NumberInput has max validation that can interfere with character-by-character input

**Select Dropdowns (Mantine):**
```typescript
// ✅ Correct - Options render in portal, use page-level selector
const prioritySelect = modal.getByLabel(/priority/i);
await prioritySelect.click();
await page.waitForTimeout(500); // Let dropdown render

// Use page-level getByRole('option'), NOT scoped to modal
await page.getByRole('option', { name: 'HIGH' }).click();

// ❌ Wrong - Options are not inside modal DOM
await modal.getByRole('option', { name: 'HIGH' }).click(); // Won't work!
```

**DatePickerInput:**
```typescript
// ✅ Correct - Use URL params instead of UI interaction
await page.goto(`/analytics?startDate=2025-09-01&endDate=2025-10-14`);

// Verify filters populated from URL
const filtersButton = page.getByRole('button', { name: /filters/i });
await filtersButton.click();
await expect(page.getByLabel(/start date/i)).toContainText('September 1, 2025');

// ❌ Wrong - DatePickerInput uses button element, .fill() doesn't work
await page.getByLabel(/start date/i).fill('2025-09-01'); // Will fail!
```

**Status Badges (Strict Mode):**
```typescript
// ✅ Always use .first() for status text that appears multiple times
await expect(page.getByText('APPROVED').first()).toBeVisible();
await expect(page.getByText('IN TRANSIT').first()).toBeVisible();

// Or better - use data-testid if available
await expect(page.getByTestId('transfer-status-badge')).toContainText('APPROVED');
```

### Multi-Level Approval Workflow Testing

**Pattern for testing transfers with approval rules:**

```typescript
// Helper automatically handles both simple and multi-level approval
async function approveTransferViaAPI(page: Page, transferId: string) {
  // Try simple approval first
  const response = await page.request.patch(`/api/stock-transfers/${transferId}/review`, {
    data: { action: 'approve' },
  });

  // If 409 (multi-level required), switch to approval workflow
  if (response.status() === 409) {
    const progressData = await getApprovalProgress(transferId);

    // Submit approval for each level
    for (const record of progressData.records) {
      await page.request.post(`/api/stock-transfers/${transferId}/approve/${record.level}`, {
        data: { notes: 'E2E test approval' },
      });
    }
  }
}
```

**Key learnings:**
- Approval rules can trigger multi-level workflow (e.g., >100 units)
- Simple `/review` endpoint returns 409 when multi-level is required
- Must fetch approval progress to see how many levels
- Submit approval for each level sequentially
- Final level approval sets `qtyApproved` on items (Phase 4 bug fix)

### Common Issues and Solutions

**Issue: Input shows value "0" instead of expected value**
- **Cause**: React useEffect hasn't initialized state yet
- **Solution**: Wait for value with timeout: `await expect(input).toHaveValue('50', { timeout: 5000 })`

**Issue: Strict mode violation "resolved to 6 elements"**
- **Cause**: Multiple elements have same text (status badges, metric cards, etc.)
- **Solution**: Add data-testid to component, or use `.first()` as temporary fix

**Issue: Can't type into Mantine NumberInput**
- **Cause**: Max validation interferes with keystroke-by-keystroke input
- **Solution**: Triple-click + Backspace + fill (don't use `.type()`)

**Issue: Select dropdown option not found**
- **Cause**: Options render in portal outside modal DOM
- **Solution**: Use page-level `getByRole('option')` not scoped to modal

**Issue: Date picker interaction fails**
- **Cause**: Mantine DatePickerInput uses button element, not input
- **Solution**: Use URL params for date filtering instead

## Documentation to Reference
- `.agent/SOP/testing-overview.md` - Testing strategy
- `.agent/SOP/backend-testing.md` - Backend patterns
- `.agent/SOP/frontend-testing.md` - Frontend patterns
- `.agent/SOP/test-flakiness.md` - Flakiness debugging
- `.agent/Features/{feature}/*.md` - What to test
- `.agent/Agents/frontend-expert/README.md` - Frontend testing considerations
