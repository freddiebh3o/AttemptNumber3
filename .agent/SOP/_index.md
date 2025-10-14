# Standard Operating Procedures (SOP) Index

This directory contains step-by-step guides for common development tasks, testing procedures, and troubleshooting workflows. SOPs provide practical, actionable guidance for engineers working on the system.

---

## Quick Navigation

| Category | SOPs |
|----------|------|
| **Development** | [adding-new-feature.md](#adding-new-feature) |
| **Testing** | [testing-overview.md](#testing-overview), [backend-testing.md](#backend-testing), [frontend-testing.md](#frontend-testing), [testing-guide.md](#testing-guide) |
| **Test Quality** | [test-flakiness.md](#test-flakiness), [test-isolation-pattern.md](#test-isolation-pattern), [frontend-test-isolation.md](#frontend-test-isolation), [troubleshooting-tests.md](#troubleshooting-tests) |
| **Debugging** | [debugging-guide.md](#debugging-guide) |
| **Feature Guides** | [stock-transfers-feature-guide.md](#stock-transfers-feature-guide) |

---

## Development SOPs

### adding-new-feature.md

**Full Path:** `.agent/SOP/adding-new-feature.md`

**What it covers:**
Complete step-by-step workflow for adding a new feature to the system (using "Suppliers" as example).

**Steps covered:**
1. **Database changes** - Prisma schema, migrations, seed data
2. **Add permissions** - RBAC catalog, role assignments, seeding
3. **Backend implementation** - Service layer, OpenAPI schemas, router, registration
4. **Frontend implementation** - Type generation, API client, page component, routing
5. **Testing** - Backend Jest tests, frontend Playwright tests

**When to use:**
- ✅ Starting a new feature from scratch
- ✅ Ensuring you follow the correct workflow
- ✅ Onboarding new developers
- ✅ As a reference during implementation
- ✅ Understanding the full development cycle

**Key sections:**
- Step-by-step checklist
- Code examples for each step
- Common issues and solutions
- Verification steps

**Typical workflow:**
```
1. Update schema.prisma → migrate → seed
2. Add permissions → assign to roles → seed RBAC
3. Create service → OpenAPI schemas → router → register
4. Regenerate types → API client → page component → routing
5. Write tests → verify functionality
```

---

## Testing SOPs

### testing-overview.md

**Full Path:** `.agent/SOP/testing-overview.md`

**What it covers:**
High-level introduction to the testing strategy. **Start here** if you're new to testing in this project.

**Topics:**
- Testing philosophy (299 tests: 227 backend + 72 frontend)
- Test types (Jest integration, Playwright E2E)
- Test structure and organization
- Quick start guide
- Navigation to other testing docs

**When to use:**
- ✅ First time writing tests for this project
- ✅ Getting oriented with testing approach
- ✅ Finding the right testing doc for your task
- ✅ Understanding test coverage

**Quick reference:**
```bash
# Backend tests (Jest)
cd api-server
npm run test:accept                # Run all (227 tests)
npm run test:accept:watch          # TDD workflow
npm run test:accept:coverage       # With coverage

# Frontend tests (Playwright)
cd admin-web
npm run test:accept                # Headless (72 tests)
npm run test:accept:ui             # Interactive UI mode
npm run test:accept:debug          # Debug with breakpoints
```

---

### backend-testing.md

**Full Path:** `.agent/SOP/backend-testing.md`

**What it covers:**
Comprehensive guide to writing backend tests with Jest and Supertest.

**Topics:**
- Jest test structure and patterns
- Supertest for API testing
- Test helpers (`db.ts`, `auth.ts`, `factories.ts`)
- Testing with real PostgreSQL database
- Multi-tenant isolation testing
- RBAC permission testing
- Service layer testing
- Integration testing approach

**When to use:**
- ✅ Writing new backend tests
- ✅ Testing API endpoints
- ✅ Testing service layer logic
- ✅ Testing RBAC permissions
- ✅ Understanding test helpers

**Key patterns:**
```typescript
// Use test helpers
import { setupTestDatabase, cleanupTestDatabase } from '@/__tests__/helpers/db';
import { createTestUser, createSessionCookie } from '@/__tests__/helpers/auth';
import { createTestTenant, createTestProduct } from '@/__tests__/helpers/factories';

describe('Product API', () => {
  beforeAll(setupTestDatabase);
  afterAll(cleanupTestDatabase);

  it('should create product', async () => {
    const tenant = await createTestTenant('ACME');
    const user = await createTestUser(tenant.id, 'OWNER');
    const cookie = createSessionCookie(user.id, tenant.id);

    const response = await request(app)
      .post('/api/products')
      .set('Cookie', cookie)
      .send({ name: 'Widget', sku: 'WID-001', unitPricePence: 1000 });

    expect(response.status).toBe(201);
  });
});
```

**Test coverage:**
- Authentication & RBAC: 46 tests
- Stock Management FIFO: 23 tests
- Product Service: 27 tests
- API Routes: 70 tests
- Middleware: 58 tests

---

### frontend-testing.md

**Full Path:** `.agent/SOP/frontend-testing.md`

**What it covers:**
Comprehensive guide to writing E2E tests with Playwright.

**Topics:**
- Playwright test structure
- Selectors and locators (prefer role-based)
- Authentication helpers (`signIn()`)
- Form interactions
- Table interactions
- Permission-based UI testing
- Modal/dialog testing
- Debugging E2E tests
- Test isolation patterns

**When to use:**
- ✅ Writing new E2E tests
- ✅ Testing user flows
- ✅ Testing permission-based UI
- ✅ Debugging Playwright tests
- ✅ Understanding test selectors

**Key patterns:**
```typescript
import { test, expect } from '@playwright/test';

const TEST_USERS = {
  owner: { email: 'owner@acme.test', password: 'Password123!', tenant: 'acme' },
  viewer: { email: 'viewer@acme.test', password: 'Password123!', tenant: 'acme' },
};

async function signIn(page, user) {
  await page.goto('/');
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByLabel(/tenant/i).fill(user.tenant);
  await page.getByRole('button', { name: /sign in/i }).click();
}

test('should create product', async ({ page }) => {
  await signIn(page, TEST_USERS.owner);

  await page.getByRole('button', { name: /new product/i }).click();
  await page.getByLabel(/product name/i).fill('Test Widget');
  await page.getByRole('button', { name: /save/i }).click();

  await expect(page.getByRole('alert')).toContainText('Product created');
});
```

**Test coverage:**
- Authentication Flow: 12 tests
- Product Management: 23 tests
- Stock Management: 20 tests
- Permission-Based UI: 21 tests

---

### testing-guide.md

**Full Path:** `.agent/SOP/testing-guide.md`

**What it covers:**
**Comprehensive reference** for all testing practices (2294 lines). This is the most complete testing document.

**Topics:**
- Everything from testing-overview, backend-testing, and frontend-testing
- Detailed troubleshooting section (30+ common issues)
- Advanced patterns
- Performance testing
- CI/CD integration
- Coverage reporting

**When to use:**
- ✅ Need complete reference for testing
- ✅ Looking for advanced patterns
- ✅ Troubleshooting complex test issues
- ✅ Setting up CI/CD for tests

**Note:** This is a reference document. For getting started, use testing-overview, backend-testing, or frontend-testing instead.

---

## Test Quality SOPs

### test-flakiness.md

**Full Path:** `.agent/SOP/test-flakiness.md`

**What it covers:**
Understanding and fixing flaky tests (tests that pass/fail intermittently).

**Topics:**
- What causes flakiness
- Common flakiness patterns
- Race conditions
- Timing issues
- Test isolation problems
- State leakage between tests
- How to debug flaky tests
- Prevention strategies

**When to use:**
- ✅ Tests are failing intermittently
- ✅ Tests pass locally but fail in CI
- ✅ Tests fail when run together but pass individually
- ✅ Understanding timing issues

**Common causes:**
1. **Race conditions** - Not waiting for async operations
2. **State leakage** - Tests affecting each other
3. **Timing assumptions** - Using fixed timeouts
4. **External dependencies** - Network, file system
5. **Shared resources** - Database, cookies, localStorage

**Prevention:**
- Use proper waiting strategies (not `setTimeout`)
- Clear state between tests (`beforeEach`)
- Use test isolation patterns
- Avoid hardcoded timeouts
- Mock external dependencies

---

### test-isolation-pattern.md

**Full Path:** `.agent/SOP/test-isolation-pattern.md`

**What it covers:**
Patterns for ensuring tests don't interfere with each other.

**Topics:**
- Test isolation principles
- Database cleanup strategies
- Cookie clearing
- localStorage cleanup
- Test data factories
- Setup/teardown patterns
- Independent test design

**When to use:**
- ✅ Writing new tests
- ✅ Tests failing when run together
- ✅ Need to understand cleanup patterns
- ✅ Designing test helpers

**Backend isolation:**
```typescript
describe('Product API', () => {
  beforeAll(setupTestDatabase);  // Once per suite
  afterEach(cleanupTestData);    // After each test
  afterAll(cleanupTestDatabase); // Once at end

  it('test 1', async () => {
    // Each test creates its own data
    const tenant = await createTestTenant('Test');
    // ... test logic
  });
});
```

**Frontend isolation:**
```typescript
test.beforeEach(async ({ context }) => {
  // Clear cookies before each test
  await context.clearCookies();
});

test('should do something', async ({ page }) => {
  // Each test signs in fresh
  await signIn(page, TEST_USERS.owner);
  // ... test logic
});
```

---

### frontend-test-isolation.md

**Full Path:** `.agent/SOP/frontend-test-isolation.md`

**What it covers:**
Specific patterns for frontend (Playwright) test isolation.

**Topics:**
- Cookie clearing strategies
- localStorage cleanup
- Page state reset
- Authentication isolation
- Modal/dialog cleanup
- Table selection clearing
- Notification dismissal
- Context isolation

**When to use:**
- ✅ Writing Playwright tests
- ✅ Frontend tests affecting each other
- ✅ Authentication state issues
- ✅ UI state leaking between tests

**Key pattern:**
```typescript
test.beforeEach(async ({ context, page }) => {
  // Clear all cookies
  await context.clearCookies();

  // Clear localStorage/sessionStorage
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});
```

---

### troubleshooting-tests.md

**Full Path:** `.agent/SOP/troubleshooting-tests.md`

**What it covers:**
30+ common test issues with solutions. **Check here first** when tests fail.

**Topics organized by category:**
- Backend test issues (database, auth, API)
- Frontend test issues (selectors, timing, state)
- Permission test issues
- Stock/FIFO test issues
- CI/CD test issues
- Performance issues

**When to use:**
- ✅ Tests are failing (start here!)
- ✅ Need quick solutions to common problems
- ✅ Error messages you don't understand
- ✅ Tests work locally but fail in CI

**Example issues covered:**
- "SecurityError: localStorage is not available" → Use beforeEach cookie clearing
- "Test timeout of 5000ms exceeded" → Add proper waits, increase timeout
- "Element not found" → Scope selectors, wait for elements
- "Permission denied (403)" → Check user role, verify permission seeding
- "Stock calculation incorrect" → Check FIFO lot ordering
- "Prisma client not initialized" → Use setupTestDatabase helper

**Format:**
Each issue includes:
1. Error message/symptom
2. Root cause
3. Solution (with code example)
4. Prevention tips

---

## Debugging SOPs

### debugging-guide.md

**Full Path:** `.agent/SOP/debugging-guide.md`

**What it covers:**
Troubleshooting common issues across the entire system.

**Categories:**
- **Database issues** - Migration failures, Prisma sync, data integrity
- **Authentication issues** - Session cookies, CORS, 403 errors
- **API issues** - Type drift, validation failures, CORS
- **Frontend issues** - Components not rendering, permission checks
- **Performance issues** - Slow API, slow frontend
- **Deployment issues** - Build failures, connection timeouts
- **Logging & monitoring** - Debug logs, correlation IDs

**When to use:**
- ✅ Encountering errors or unexpected behavior
- ✅ API calls failing
- ✅ Permission checks not working
- ✅ Performance problems
- ✅ Deployment issues
- ✅ Production troubleshooting

**Common scenarios:**
- **"Session cookie isn't being set"** → Check CORS origins, cookie mode
- **"Getting 403 errors"** → Check user's role and permissions
- **"OpenAPI types are wrong"** → Restart API server, regenerate types
- **"Stock levels are incorrect"** → Check aggregate vs lot sum, recalculate
- **"Migration failed"** → Check syntax, reset database, manual fix
- **"CORS error"** → Check FRONTEND_ORIGIN exactly matches (no trailing slash)

**Debugging tools:**
- Prisma Studio (`npm run db:studio`) - Visual database browser
- Swagger UI (`http://localhost:4000/docs`) - API testing
- Correlation IDs - Trace requests through logs
- Browser DevTools - Network, console, storage

---

## Feature-Specific Guides

### stock-transfers-feature-guide.md

**Full Path:** `.agent/SOP/stock-transfers-feature-guide.md`

**What it covers:**
Complete guide to the stock transfer feature (v1 and v2 enhancements).

**Topics:**
- Stock transfer concepts
- Transfer flow (source → destination)
- FIFO consumption during transfers
- Transfer templates
- Transfer reversal logic
- Branch membership requirements
- API endpoints
- UI workflows
- Testing stock transfers

**When to use:**
- ✅ Working on stock transfer features
- ✅ Understanding transfer business logic
- ✅ Debugging transfer issues
- ✅ Extending transfer functionality
- ✅ Understanding FIFO in context of transfers

**Key concepts:**
- **Transfer flow:** Consume at source (FIFO) → Receipt at destination
- **Templates:** Save frequent transfers for reuse
- **Reversal:** Undo transfer with proper lot tracking
- **Barcode scanning:** Speed up transfer creation
- **Audit trail:** All movements logged in StockLedger

**Coverage:**
- Transfer creation (manual and from template)
- Transfer history and filtering
- Reversal workflow
- Barcode scanning integration
- Multi-branch coordination

---

## Common Tasks → SOP Reference

| Task | Primary SOP | Supporting SOPs |
|------|-------------|-----------------|
| **Add new feature** | adding-new-feature.md | - |
| **Write backend test** | backend-testing.md | testing-overview.md, test-isolation-pattern.md |
| **Write E2E test** | frontend-testing.md | testing-overview.md, frontend-test-isolation.md |
| **Fix flaky test** | test-flakiness.md | troubleshooting-tests.md |
| **Debug test failure** | troubleshooting-tests.md | backend-testing.md, frontend-testing.md |
| **Fix 403 error** | debugging-guide.md | `.agent/System/rbac-system.md` |
| **Fix CORS issue** | debugging-guide.md | `.agent/System/architecture.md` |
| **Understand stock transfers** | stock-transfers-feature-guide.md | `.agent/System/stock-management.md` |
| **Set up tests** | testing-overview.md | backend-testing.md, frontend-testing.md |
| **Improve test isolation** | test-isolation-pattern.md | frontend-test-isolation.md |

---

## SOP Usage Patterns

### For New Engineers

**Recommended reading order:**
1. `.agent/README.md` - Understand documentation structure
2. `.agent/System/architecture.md` - Understand system design
3. `adding-new-feature.md` - Learn development workflow
4. `testing-overview.md` - Understand testing approach
5. `debugging-guide.md` - Bookmark for troubleshooting

### For Writing Tests

**Workflow:**
1. Start with `testing-overview.md` (orientation)
2. Read `backend-testing.md` (if backend) or `frontend-testing.md` (if frontend)
3. Use `test-isolation-pattern.md` (ensure independence)
4. Reference `troubleshooting-tests.md` (when issues arise)
5. Read `test-flakiness.md` (if tests are flaky)

### For Debugging

**Workflow:**
1. Check `troubleshooting-tests.md` (if test failure)
2. Check `debugging-guide.md` (if runtime issue)
3. Use correlation IDs to trace requests
4. Reference system docs for architecture context
5. Use Prisma Studio or Swagger UI for interactive debugging

### For Feature Development

**Workflow:**
1. Read `adding-new-feature.md` (understand full workflow)
2. Follow step-by-step checklist
3. Write tests as you go (backend-testing, frontend-testing)
4. Debug issues with debugging-guide
5. Verify with test-isolation-pattern

---

## SOP Maintenance

### When to Update SOPs

**Update after:**
- ✅ Discovering new common issues → Add to troubleshooting-tests or debugging-guide
- ✅ Establishing new development patterns → Update adding-new-feature
- ✅ Changing test infrastructure → Update testing SOPs
- ✅ Resolving repeated questions → Add to relevant SOP

### How to Update

1. Identify the relevant SOP
2. Add new section or update existing content
3. Include code examples where helpful
4. Update "Last Updated" date
5. Cross-reference with related SOPs if needed

### Documentation Principles

- **Practical:** Focus on "how to" with concrete examples
- **Problem-oriented:** Organize by what developers need to accomplish
- **Examples:** Show code, not just descriptions
- **Searchable:** Use clear headings and consistent terminology
- **Maintained:** Keep in sync with actual code patterns

---

## Quick Reference Cards

### Testing Quick Reference

| Framework | Location | Command | Test Count |
|-----------|----------|---------|------------|
| **Jest** | `api-server/__tests__/` | `npm run test:accept` | 227 |
| **Playwright** | `admin-web/e2e/` | `npm run test:accept` | 72 |
| **Total** | - | - | **299** |

**Test helpers:**
- `__tests__/helpers/db.ts` - Database setup/cleanup
- `__tests__/helpers/auth.ts` - User creation, session cookies
- `__tests__/helpers/factories.ts` - Test data factories

### Debugging Quick Reference

| Issue Category | First Check | Tool |
|----------------|-------------|------|
| **Database** | Prisma client sync | Prisma Studio |
| **Auth** | CORS origins, cookie mode | Browser DevTools |
| **API** | OpenAPI type sync | Swagger UI |
| **Tests** | Isolation, flakiness | troubleshooting-tests.md |
| **Performance** | Indexes, N+1 queries | Correlation IDs |

### Development Quick Reference

| Stage | SOP | Agents Involved |
|-------|-----|-----------------|
| **Plan** | adding-new-feature.md (step 0) | - |
| **Database** | adding-new-feature.md (step 1) | database-expert |
| **RBAC** | adding-new-feature.md (step 2) | rbac-security-expert |
| **Backend** | adding-new-feature.md (step 3) | backend-api-expert |
| **Frontend** | adding-new-feature.md (step 4) | frontend-expert |
| **Testing** | adding-new-feature.md (step 5) | test-engineer |

---

## Related Documentation

- **System Docs:** `.agent/System/_index.md` - Architecture and technical design
- **Features:** `.agent/Features/_index.md` - Feature PRDs and implementation docs
- **Agents:** `.agent/Agents/_index.md` - Agent registry and work logs
- **Main Index:** `.agent/README.md` - Master documentation index

---

## Statistics

**Total SOPs:** 11

**By Category:**
- Development: 1
- Testing: 4 (overview, backend, frontend, comprehensive)
- Test Quality: 4 (flakiness, isolation patterns)
- Debugging: 1
- Feature Guides: 1

**Most Referenced SOPs:**
1. testing-overview.md
2. backend-testing.md
3. frontend-testing.md
4. troubleshooting-tests.md
5. debugging-guide.md

**Test Coverage:**
- 299 total tests documented
- 30+ common issues catalogued
- 100+ code examples

---

**Last Updated:** 2025-01-15
**Total SOPs:** 11
**Total Pages:** ~300 pages of documentation
**Code Examples:** 100+ across all SOPs
