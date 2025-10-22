# E2E Test Suite

Playwright-based end-to-end tests for the admin-web application, organized by domain with shared utilities and consistent patterns.

## Table of Contents

- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Shared Utilities](#shared-utilities)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites

**E2E tests use a dedicated database (port 5434) separate from development (port 5432) and Jest tests (port 5433).**

**Complete Setup (Required before running E2E tests):**

```bash
# 0. Stop dev server if running (E2E server uses same port 4000)

# 1. Start E2E database (one-time setup)
cd api-server
npm run db:e2e:reset    # Starts DB on port 5434, runs migrations, seeds data

# 2. Start API server with E2E environment (keep running in separate terminal)
npm run dev:e2e         # Runs on port 4000 with E2E database
                         # Console shows: "⚠️ RATE LIMITING IS DISABLED"

# 3. Run E2E tests (in separate terminal)
cd admin-web
npm run test:accept     # Headless mode
npm run test:accept:ui  # Interactive UI mode (recommended)
```

**Database Ports:**
- **5432** - Development database (for `npm run dev`)
- **5433** - Jest test database (for backend unit tests)
- **5434** - E2E test database (for Playwright tests) ← **You are here**

**API Server Ports:**
- **4000** - Development server OR E2E server (cannot run simultaneously)
- **4001** - Jest test server (backend tests only)

**Why a separate E2E database?**
- Prevents connection pool exhaustion during parallel test execution
- Isolates E2E test data from backend Jest tests
- Allows rate limiting to be disabled for test performance (NEVER in production!)

### Run All Tests

```bash
cd admin-web
npm run test:accept              # Parallel (uses all CPU cores, ~2-5 min for 72 tests)
npm run test:accept:ui           # Interactive UI mode (recommended for development)
npm run test:accept:parallel     # Force 4 workers (predictable performance)
npm run test:accept:fast         # 4 workers, no retries (fastest local run)
```

**Parallel Execution (Phase 3):**
- Tests run in parallel by default (uses all available CPU cores)
- Local: Usually 4-8 workers depending on CPU
- CI: 4 workers (balanced performance/resource usage)
- Rate limiting is disabled in E2E environment to support parallel execution
- ~2-5 minutes to run all 72 tests (vs ~15-20 minutes serial)

### Run Specific Domain

```bash
npm run test:accept:ui -- auth/          # Auth tests only
npm run test:accept:ui -- products/      # Products tests only
npm run test:accept:ui -- stock/         # Stock tests only
npm run test:accept:ui -- transfers/     # Transfer tests only
npm run test:accept:ui -- chat/          # Chat tests only
npm run test:accept:ui -- features/      # Feature tests only
```

### Run Specific File

```bash
npm run test:accept:ui -- auth/signin.spec.ts
npm run test:accept:ui -- products/product-crud.spec.ts
```

### Advanced: Sharding (CI/CD)

**Split tests across multiple machines in CI:**

```bash
# Machine 1: Run 1st quarter of tests
SHARD=1/4 npm run test:accept:shard

# Machine 2: Run 2nd quarter of tests
SHARD=2/4 npm run test:accept:shard

# Machine 3: Run 3rd quarter of tests
SHARD=3/4 npm run test:accept:shard

# Machine 4: Run 4th quarter of tests
SHARD=4/4 npm run test:accept:shard
```

**Custom worker count:**

```bash
npm run test:accept:workers=2    # Use 2 workers
npm run test:accept:workers=8    # Use 8 workers
```

---

## Project Structure

```
admin-web/e2e/
├── auth/                          # Authentication & authorization tests
│   ├── signin.spec.ts            # Sign-in page functionality
│   ├── auth-flow.spec.ts         # Full authentication flows
│   └── permission-checks.spec.ts # RBAC permission enforcement
│
├── products/                      # Product management tests
│   ├── product-crud.spec.ts      # Product CRUD operations
│   └── product-archive.spec.ts   # Archive/restore functionality
│
├── stock/                         # Stock management tests
│   └── stock-management.spec.ts  # FIFO, adjustments, ledger
│
├── transfers/                     # Stock transfer tests
│   ├── transfer-templates.spec.ts        # Transfer templates
│   ├── approval-rules.spec.ts            # Approval rule system
│   ├── multi-level-approval.spec.ts      # Multi-level approvals
│   ├── transfer-reversal.spec.ts         # Transfer reversal flows
│   └── transfer-analytics.spec.ts        # Transfer analytics
│
├── chat/                          # AI chat feature tests
│   ├── chat-basic.spec.ts        # Basic chat interactions
│   ├── chat-advanced.spec.ts     # Advanced chat features (Phase 2)
│   ├── chat-analytics.spec.ts    # Chat analytics dashboard
│   └── chat-suggestions.spec.ts  # Chat suggestions feature
│
├── features/                      # Edge case & feature flag tests
│   ├── barcode-scanning.spec.ts  # Barcode scanning workflow
│   ├── feature-flags.spec.ts     # Tenant feature toggles
│   └── test-cleanup.spec.ts      # Test cleanup verification (skipped)
│
├── helpers/                       # Shared test utilities
│   ├── index.ts                  # Central export point
│   ├── auth.ts                   # Authentication helpers
│   ├── factories.ts              # Entity factories (product, stock, transfer, etc.)
│   ├── selectors.ts              # data-testid constants
│   ├── api-helpers.ts            # API request utilities
│   └── chat.ts                   # Chat-specific helpers
│
├── README.md                      # This file
└── GUIDELINES.md                  # Testing best practices & patterns
```

### Domain Organization

Tests are organized into 6 logical domains:

1. **auth/** - Authentication, authorization, RBAC permissions
2. **products/** - Product CRUD, archival, validation
3. **stock/** - Stock management, FIFO, adjustments, ledger
4. **transfers/** - Stock transfers, templates, approval rules, analytics
5. **chat/** - AI chat interface, analytics, suggestions
6. **features/** - Feature flags, barcode scanning, edge cases

---

## Running Tests

### Development Workflow

**Recommended: Use UI Mode**
```bash
npm run test:accept:ui
```

UI mode provides:
- Interactive test selection
- Visual test execution
- Step-by-step debugging
- Automatic re-runs on file changes
- Time-travel debugging

### Headless Mode (CI)

```bash
npm run test:accept              # All tests
npm run test:accept:coverage     # With coverage report
```

### Debug Mode

```bash
npm run test:accept:debug        # Opens Playwright Inspector
```

### View Test Results

```bash
npm run test:accept:report       # Opens HTML report of last run
```

### Common Patterns

```bash
# Run tests matching a pattern
npm run test:accept -- --grep "should create product"

# Run tests in a specific file
npm run test:accept -- products/product-crud.spec.ts

# Run tests with specific tag
npm run test:accept -- --grep @smoke

# Run tests in parallel (default: 4 workers)
npm run test:accept -- --workers=2

# Run tests serially (one at a time)
npm run test:accept -- --workers=1
```

---

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS, Factories } from '../helpers';

// Health check (required)
test.beforeAll(async () => {
  const apiUrl = process.env.VITE_API_BASE_URL || 'http://localhost:4000';
  try {
    const response = await fetch(`${apiUrl}/api/health`);
    if (!response.ok) throw new Error(`API health check failed`);
  } catch (error) {
    console.warn('⚠️  API server may not be running');
  }
});

// Clear cookies (required)
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.describe('Feature Name', () => {
  test('should perform action', async ({ page }) => {
    // Sign in as appropriate user
    await signIn(page, TEST_USERS.editor);

    // Create test data using factories
    const productId = await Factories.product.create(page, {
      productName: 'Test Product',
      productSku: `TEST-${Date.now()}`,
      productPricePence: 1000,
    });

    try {
      // Perform test actions
      await page.goto(`/${TEST_USERS.editor.tenant}/products/${productId}`);
      await page.getByLabel(/product name/i).fill('Updated Name');
      await page.getByRole('button', { name: /save/i }).click();

      // Assert expected outcomes
      await expect(page.getByText(/product updated/i)).toBeVisible();
    } finally {
      // Clean up test data
      await Factories.product.delete(page, productId);
    }
  });
});
```

### Using Test Users

```typescript
import { signIn, TEST_USERS } from '../helpers';

// Available users (from api-server/prisma/seed.ts)
TEST_USERS.owner   // Full permissions (OWNER role)
TEST_USERS.admin   // Admin permissions (ADMIN role)
TEST_USERS.editor  // Read/write permissions (EDITOR role)
TEST_USERS.viewer  // Read-only permissions (VIEWER role)

// Sign in as specific user
await signIn(page, TEST_USERS.editor);
```

### Using Factories

```typescript
import { Factories } from '../helpers';

// Create product
const productId = await Factories.product.create(page, {
  productName: 'Widget',
  productSku: 'WID-001',
  productPricePence: 1000,
  barcode: '1234567890',      // Optional
  barcodeType: 'EAN13',       // Optional
});

// Archive product (soft delete)
await Factories.product.archive(page, productId);

// Restore product
await Factories.product.restore(page, productId);

// Delete product (cleanup)
await Factories.product.delete(page, productId);

// Create product with stock
const result = await Factories.stock.createProductWithStock(page, {
  productName: 'Stocked Widget',
  productSku: 'STK-001',
  productPricePence: 1500,
  qtyDelta: 100,
  unitCostPence: 500,
});
// Returns: { productId, branchId, adjustmentId }

// Get branches
const branches = await Factories.branch.getAll(page);
const firstBranch = await Factories.branch.getFirst(page);
const secondBranch = await Factories.branch.getSecond(page);

// Create and ship transfer (convenience method)
const transferId = await Factories.transfer.createAndShip(page, {
  sourceBranchId: branches[0].id,
  destinationBranchId: branches[1].id,
  productId: productId,
  quantity: 10,
  unitCostPence: 100,
});

// Delete transfer
await Factories.transfer.delete(page, transferId);

// Create transfer template
const templateId = await Factories.transferTemplate.create(page, {
  templateName: 'London → Manchester',
  sourceBranchId: branches[0].id,
  destinationBranchId: branches[1].id,
});

// Delete template
await Factories.transferTemplate.delete(page, templateId);

// Create approval rule
const ruleId = await Factories.approvalRule.create(page, {
  name: 'High Value Approval',
  description: 'Requires approval for transfers over £100',
  isActive: true,
  approvalMode: 'SEQUENTIAL',
  priority: 100,
  conditions: [{ conditionType: 'TOTAL_VALUE_THRESHOLD', threshold: 10000 }],
  levels: [{ level: 1, name: 'Manager Review', requiredRoleId: roleId }],
});

// Delete approval rule
await Factories.approvalRule.delete(page, ruleId);

// Get role ID
const roleId = await Factories.role.getByName(page, 'OWNER');
const firstRoleId = await Factories.role.getFirst(page);
```

### Using Selectors

**Hierarchy (in order of preference):**

1. **data-testid** - Most reliable, intentional
   ```typescript
   import { SELECTORS } from '../helpers';

   await page.getByTestId(SELECTORS.PRODUCT.ARCHIVE_BUTTON).click();
   await page.getByTestId(SELECTORS.CHAT.TRIGGER_BUTTON).click();
   ```

2. **getByRole** - Semantic, accessible
   ```typescript
   await page.getByRole('button', { name: /save/i }).click();
   await page.getByRole('heading', { name: /edit product/i }).isVisible();
   ```

3. **getByLabel** - Form fields
   ```typescript
   await page.getByLabel(/product name/i).fill('New Name');
   await page.getByLabel(/email address/i).fill('user@example.com');
   ```

4. **getByText** - Last resort (fragile)
   ```typescript
   await page.getByText('Archived').isVisible();
   ```

### Chat Helpers

```typescript
import { sendChatMessage, openChatModal, closeChatModal } from '../helpers';

// Open chat modal
await openChatModal(page);

// Send message and wait for response
await sendChatMessage(page, 'What is the total stock value?');

// Wait for AI response (with 15 second timeout)
await expect(page.getByText(/total stock value/i)).toBeVisible({ timeout: 15000 });

// Close modal
await closeChatModal(page);
```

---

## Shared Utilities

### Import Everything from Helpers

```typescript
// Single import for all utilities
import {
  signIn,
  signOut,
  switchUser,
  TEST_USERS,
  Factories,
  SELECTORS,
  sendChatMessage,
  openChatModal,
  closeChatModal,
  getApiUrl,
  getCookieHeader,
  makeAuthenticatedRequest,
} from '../helpers';
```

### Test Users

All test users belong to the `acme` tenant (seeded by `api-server/prisma/seed.ts`):

| User | Email | Password | Role | Permissions |
|------|-------|----------|------|-------------|
| owner | owner@acme.test | Password123! | OWNER | All permissions |
| admin | admin@acme.test | Password123! | ADMIN | Most permissions |
| editor | editor@acme.test | Password123! | EDITOR | Read + write |
| viewer | viewer@acme.test | Password123! | VIEWER | Read only |

### Available SELECTORS

```typescript
SELECTORS.AUTH.EMAIL_INPUT
SELECTORS.AUTH.PASSWORD_INPUT
SELECTORS.AUTH.TENANT_INPUT
SELECTORS.AUTH.SIGNIN_BUTTON

SELECTORS.PRODUCT.ARCHIVE_BUTTON
SELECTORS.PRODUCT.RESTORE_BUTTON
SELECTORS.PRODUCT.ARCHIVED_BADGE
SELECTORS.PRODUCT.ARCHIVED_FILTER_SELECT

SELECTORS.CHAT.TRIGGER_BUTTON
SELECTORS.CHAT.MODAL_CONTENT
SELECTORS.CHAT.INPUT
SELECTORS.CHAT.SEND_BUTTON
```

---

## Best Practices

### 1. Always Use Health Checks

```typescript
test.beforeAll(async () => {
  const apiUrl = process.env.VITE_API_BASE_URL || 'http://localhost:4000';
  try {
    const response = await fetch(`${apiUrl}/api/health`);
    if (!response.ok) throw new Error(`API health check failed`);
  } catch (error) {
    console.warn('⚠️  API server may not be running. Tests will fail without it.');
  }
});
```

### 2. Always Clear Cookies

```typescript
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});
```

### 3. Always Clean Up Test Data

```typescript
try {
  // Test code here
} finally {
  // Cleanup runs even if test fails
  await Factories.product.delete(page, productId);
}
```

### 4. Use Unique Identifiers

```typescript
const timestamp = Date.now();
const productName = `Test Product ${timestamp}`;
const productSku = `TEST-${timestamp}`;
```

### 5. Wait for Navigation/State

```typescript
await page.goto('/products');
await page.waitForLoadState('networkidle');
```

### 6. Scope Selectors to Context

```typescript
// Scope to dialog to avoid conflicts
const modal = page.getByRole('dialog');
await modal.getByLabel(/product name/i).fill('New Name');
await modal.getByRole('button', { name: /save/i }).click();
```

### 7. Use Appropriate Timeouts

```typescript
// AI responses need longer timeouts
await expect(page.getByText(/response/i)).toBeVisible({ timeout: 15000 });

// Default timeout is 5 seconds (usually sufficient)
await expect(page.getByText(/saved/i)).toBeVisible();
```

### 8. Handle Collapsible Navigation

```typescript
// Expand navigation group before clicking nested links
const userManagementNav = page.getByRole('navigation').getByText(/user management/i);
if (await userManagementNav.isVisible()) {
  await userManagementNav.click();
  await page.waitForTimeout(300); // Wait for animation
}
await page.getByRole('link', { name: /tenant users/i }).click();
```

### 9. Test Isolation

- Each test should be independent
- Don't rely on data from previous tests
- Create fresh test data for each test
- Clean up data in `finally` blocks

### 10. Serial Mode for Collision-Prone Tests

```typescript
// Prevent concurrent tests from causing unique constraint violations
test.describe.configure({ mode: 'serial' });
```

---

## Troubleshooting

### API Server Not Running (E2E Mode)

**Error:** Tests timeout or fail to connect

**Solution:**
```bash
cd api-server
npm run dev:e2e  # NOT npm run dev (uses wrong database)
```

**Important:** E2E tests require the API server to run with `.env.test.e2e` config, not the development config!

### E2E Database Not Running

**Error:** "Database connection failed" or "ECONNREFUSED localhost:5434"

**Solution:**
```bash
cd api-server
npm run db:e2e:reset  # Start E2E database on port 5434
```

### Database Not Seeded

**Error:** "User not found" or "No branches available"

**Solution:**
```bash
cd api-server
npm run db:e2e:seed  # Seed E2E database (port 5434)
```

### Rate Limit Errors (429)

**Error:** "Too many requests" or 429 status codes during tests

**Solution:**
1. Verify API server is running with E2E config: `npm run dev:e2e`
2. Check console shows: `⚠️ RATE LIMITING IS DISABLED`
3. Verify `.env.test.e2e` has `DISABLE_RATE_LIMIT=true`

**Why:** E2E tests run in parallel and would exceed rate limits. Rate limiting is disabled ONLY in test environment.

### Cookie Issues

**Error:** "Unauthorized" or redirected to sign-in

**Solution:**
- Ensure `test.beforeEach` clears cookies
- Check `COOKIE_SAMESITE_MODE` env var (`lax` for local dev)
- Verify `FRONTEND_ORIGIN` matches Vite dev server URL

### Element Not Found

**Error:** "Timeout waiting for locator"

**Solution:**
1. Check if element has data-testid attribute
2. Try scoping to dialog/modal: `page.getByRole('dialog').getByLabel(...)`
3. Wait for page load: `await page.waitForLoadState('networkidle')`
4. Check for collapsible navigation (expand first)
5. Use `.first()` if multiple matches exist

### Flaky Tests

**Common Causes:**
- Race conditions (wait for network idle)
- Animation timing (add 300ms delay after expanding UI)
- Multiple elements matching (use `.first()` or scope to dialog)
- Async operations (use `{ timeout: 15000 }` for AI responses)

**Solutions:**
- See [.agent/SOP/test-flakiness.md](../../.agent/SOP/test-flakiness.md)
- See [.agent/SOP/troubleshooting-tests.md](../../.agent/SOP/troubleshooting-tests.md)

### Type Errors

**Error:** TypeScript compilation errors

**Solution:**
1. Check OpenAPI types are up to date:
   ```bash
   cd api-server && npm run dev  # Restart API server
   cd admin-web && npm run openapi:gen
   ```
2. Run type check:
   ```bash
   npm run typecheck
   ```

---

## Additional Resources

- **[GUIDELINES.md](./GUIDELINES.md)** - Detailed testing patterns and best practices
- **[.agent/SOP/frontend-testing.md](../../.agent/SOP/frontend-testing.md)** - Frontend testing SOP
- **[.agent/SOP/testing-guide.md](../../.agent/SOP/testing-guide.md)** - Comprehensive testing guide
- **[.agent/SOP/test-flakiness.md](../../.agent/SOP/test-flakiness.md)** - Understanding flaky tests
- **[.agent/SOP/troubleshooting-tests.md](../../.agent/SOP/troubleshooting-tests.md)** - Common issues and solutions

---

## Contributing

When adding new E2E tests:

1. **Choose the right domain folder** (auth, products, stock, transfers, chat, features)
2. **Use shared helpers and factories** (never duplicate code)
3. **Follow naming conventions**: `feature-name.spec.ts`
4. **Add health checks and cookie clearing**
5. **Use data-testid for primary selectors** (request frontend team to add if missing)
6. **Clean up test data in `finally` blocks**
7. **Document any new patterns** in GUIDELINES.md

---

**Last Updated:** 2025-10-18
**Test Files:** 18 specs across 6 domains
**Total Tests:** 299 passing (227 backend + 72 frontend)
