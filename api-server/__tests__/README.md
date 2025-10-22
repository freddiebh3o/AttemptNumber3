# Test Suite Setup

## Directory Structure

**Feature-Based Organization (October 2025 Refactor)**

```
__tests__/
├── helpers/              # Shared test utilities
│   ├── auth.ts          # Session cookie helpers
│   ├── db.ts            # Database utilities
│   ├── factories.ts     # Test data factories (timestamp-based)
│   └── testContext.ts   # Test context and cleanup helpers
├── fixtures/            # Static test data
│   └── testData.ts
├── setup/               # Global setup/teardown
│   ├── globalSetup.ts
│   └── globalTeardown.ts
├── core/                # Core infrastructure tests
│   ├── auth.test.ts     # Authentication tests
│   └── health.test.ts   # Health check tests
├── middleware/          # Middleware-specific tests
│   ├── errorHandler.test.ts
│   ├── session.test.ts
│   ├── permissions.test.ts
│   ├── idempotency.test.ts
│   ├── rateLimit.test.ts
│   └── (more middleware tests...)
├── permissions/         # RBAC permission matrix tests
│   ├── products.permissions.test.ts
│   ├── stock.permissions.test.ts
│   ├── branches.permissions.test.ts
│   └── (one file per feature)
├── features/            # Feature-organized tests
│   ├── products/
│   │   ├── productService.test.ts
│   │   ├── productRoutes.test.ts
│   │   ├── productArchival.test.ts
│   │   └── barcodes.test.ts
│   ├── stock/
│   │   ├── stockService.test.ts
│   │   ├── stockRoutes.test.ts
│   │   ├── stockLotRestoration.test.ts
│   │   └── fifoAlgorithm.test.ts
│   ├── branches/
│   ├── tenantUsers/
│   ├── roles/
│   ├── theme/
│   ├── uploads/
│   ├── auditLogs/
│   ├── stockTransfers/
│   │   ├── transferService.test.ts
│   │   ├── transferRoutes.test.ts
│   │   ├── templates/
│   │   │   └── templateService.test.ts
│   │   └── approvals/
│   │       └── approvalRulesService.test.ts
│   ├── transferAnalytics/
│   ├── featureFlags/
│   └── chat/
│       ├── chatService.test.ts
│       └── tools/
│           ├── productTools.test.ts
│           └── (more tool tests...)
├── TEST_TEMPLATE.md     # Test pattern reference
└── README.md            # This file
```

**Navigation Tips:**
- 📋 **New test?** See [TEST_TEMPLATE.md](./TEST_TEMPLATE.md) for patterns
- 🔧 **Service test?** Go to `features/{feature}/{feature}Service.test.ts`
- 🌐 **Route test?** Go to `features/{feature}/{feature}Routes.test.ts`
- 🔐 **Permission test?** Go to `permissions/{feature}.permissions.test.ts`
- 🛠️ **Middleware test?** Go to `middleware/{middleware}.test.ts`

---

## Test Databases Overview

**This project uses THREE separate databases for different purposes:**

| Database | Port | Purpose | Used By |
|----------|------|---------|---------|
| **Development** | 5432 | Local development | `npm run dev` |
| **Jest Test** | 5433 | Backend unit/integration tests | `npm run test:accept` |
| **E2E Test** | 5434 | Playwright E2E tests | Frontend E2E tests |

**Jest tests use a DEDICATED test database (port 5433), NOT the development database.**

This ensures:
1. Jest tests are isolated from development data
2. Tests can run in parallel without conflicts
3. All test factories use `Date.now()` timestamps for unique data
4. Your development data is never modified by tests

## How It Works

### Unique Test Data
Every test creates entities with timestamps:
```typescript
const tenant = await createTestTenant();
// Creates: { name: "Test Tenant 1728845123456", slug: "test-tenant-1728845123456" }

const user = await createTestUser();
// Creates: { email: "test-1728845123456@example.com" }
```

This ensures:
- ✅ No conflicts with your seed data
- ✅ No conflicts between test runs
- ✅ Tests can run multiple times without issues
- ✅ You can login to dev after running tests

### Database Cleanup (Disabled)

The `cleanDatabase()` function is **disabled by default**. It does nothing unless you explicitly enable it:

```bash
# To enable cleanup (only if you have a separate test database)
ENABLE_TEST_DB_CLEANUP=true npm run test:accept
```

**WARNING**: Only enable cleanup if you're using a separate test database!

## Test Types

### 1. Per-Test Setup (Most Tests)
Tests that use `beforeEach` create fresh data for each test:
```typescript
beforeEach(async () => {
  // No cleanDatabase() needed - timestamps ensure uniqueness
  testTenant = await createTestTenant();
  testUser = await createTestUser();
});
```

### 2. Shared Setup (Some Tests)
Tests like `auth.test.ts` and `permissions.test.ts` use `beforeAll` and share data across tests. These tests:
- Call `cleanDatabase()` in `beforeAll` (but it's disabled)
- May accumulate data from previous runs
- Still work correctly due to unique timestamps

## Database Growth

Over time, test data will accumulate in your dev database. This is normal and expected. To clean up:

### Option 1: Manual Cleanup (Recommended)
Periodically run your seed script to reset dev data:
```bash
npm run db:seed
```

### Option 2: Enable Auto-Cleanup (Use Separate DB)
If you set up a separate test database:
1. Create a test database: `my_app_test`
2. Set `DATABASE_URL_TEST` environment variable
3. Configure jest to use test database
4. Enable cleanup: `ENABLE_TEST_DB_CLEANUP=true`

## Running Tests

### Prerequisites

**Start the Jest test database (if not already running):**

```bash
# Start Jest test database (Docker PostgreSQL on port 5433)
npm run db:test:up

# The database will:
# - Start PostgreSQL container on port 5433
# - Wait for database to be ready
# - Run migrations
# - Seed test data
```

### Run Tests

```bash
# Run all Jest tests
npm run test:accept

# Run in watch mode (automatically re-runs on file changes)
npm run test:accept:watch

# Run with coverage report
npm run test:accept:coverage

# Run specific test file
npm run test:accept -- features/products/productService.test.ts

# Run tests matching a pattern
npm run test:accept -- --testNamePattern="should create product"
```

### Stop Jest Test Database

```bash
# Stop the Jest test database (when done testing)
npm run db:test:down

# Reset the Jest test database (clear all data and re-seed)
npm run db:test:reset
```

---

## E2E Tests (Separate Database)

**E2E tests are located in `admin-web/e2e/` and use a SEPARATE database (port 5434).**

See **[admin-web/e2e/README.md](../../admin-web/e2e/README.md)** for complete E2E test instructions.

**Quick E2E Setup:**

```bash
# 1. Start E2E database
npm run db:e2e:reset

# 2. Start API server with E2E config (separate terminal)
npm run dev:e2e

# 3. Run E2E tests (from admin-web directory)
cd ../admin-web
npm run test:accept
```

**Why separate databases?**
- **Jest tests (port 5433):** Backend unit/integration tests
- **E2E tests (port 5434):** Full-stack Playwright tests
- Prevents connection pool conflicts during parallel E2E test execution

---

## Troubleshooting

### Jest Test Database Not Running

**Error:** `ECONNREFUSED localhost:5433` or "Database connection failed"

**Solution:**
```bash
npm run db:test:up  # Start Jest test database on port 5433
```

### "Database has too many test records"

**Error:** Tests are slow or you see many records with timestamps in names

**Solution:**
```bash
npm run db:test:reset  # Reset and re-seed the Jest test database
```

**Note:** This ONLY affects the Jest test database (port 5433), NOT development (5432) or E2E (5434)

### "Tests are failing randomly"

**Possible Causes:**
1. Database not running: `npm run db:test:up`
2. Migrations not applied: `npm run db:test:reset`
3. Test assumes clean state (count assertions, etc.)

### Wrong Database Port

**Error:** Tests connecting to wrong database

**Solution:**
- Jest tests use `.env.test` → connects to port **5433**
- Development uses `.env` → connects to port **5432**
- E2E tests use `.env.test.e2e` → connects to port **5434**

Verify the correct environment file is being used.

---

## Best Practices

✅ **DO**:
- Start Jest test database before running tests: `npm run db:test:up`
- Use factory defaults (let timestamps create unique data)
- Run tests frequently - they use isolated test database
- Use watch mode for TDD: `npm run test:accept:watch`

❌ **DON'T**:
- Run tests without starting the test database first
- Hardcode test data values (defeats timestamp uniqueness)
- Assume clean database state in new tests
- Mix up database ports (5432=dev, 5433=Jest, 5434=E2E)

## Test Patterns

**See [TEST_TEMPLATE.md](./TEST_TEMPLATE.md) for:**
- Test naming conventions (avoid PRD phase numbers!)
- Service test pattern (business logic)
- Route test pattern (HTTP layer)
- Permission test pattern (RBAC matrix)
- Common patterns and anti-patterns
- Test isolation strategies

## Questions?

- Test patterns: See [TEST_TEMPLATE.md](./TEST_TEMPLATE.md)
- Test isolation: See `.agent/SOP/test_isolation_pattern.md`
- Backend testing: See `.agent/SOP/backend-testing.md`
- Troubleshooting: See `.agent/SOP/troubleshooting-tests.md`
