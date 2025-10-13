# Testing Guide - Overview

**Purpose:** High-level overview of testing in the Multi-Tenant Inventory Management System.

**Last Updated:** 2025-10-13

---

## Testing Stack

### Backend (API Server)
- **Framework:** Jest (with ts-jest for TypeScript)
- **HTTP Testing:** Supertest
- **Database:** Real PostgreSQL database (not mocked)
- **Approach:** Integration tests (test entire request → response flow)
- **Test Count:** 279 passing across 14 test suites
- **Test Isolation:** Timestamp-based unique data (no cleanup required)

### Frontend (Admin Web)
- **Framework:** Playwright
- **Approach:** End-to-end tests (test complete user workflows)
- **Test Count:** 72 passing across 5 test suites
  - Sign-in page: 7 tests
  - Auth flow: 10 tests
  - Product management: 23 tests
  - Stock management: 22 tests
  - Permission checks: 21 tests

---

## Test Organization

```
api-server/
├── __tests__/
│   ├── helpers/          # Test utilities
│   │   ├── db.ts         # Database utilities (no cleanup)
│   │   ├── auth.ts       # Authentication helpers
│   │   └── factories.ts  # Test data factories (timestamp-based)
│   ├── middleware/       # Middleware tests
│   ├── routes/           # API route tests
│   ├── services/         # Service layer tests
│   ├── auth.test.ts      # Auth endpoint tests
│   └── README.md         # Test setup documentation
└── jest.config.js        # Jest configuration

admin-web/
├── e2e/                  # Playwright E2E tests
│   ├── signin.spec.ts    # Sign-in page tests
│   ├── auth-flow.spec.ts # Authentication flow tests
│   ├── product-management.spec.ts # Product CRUD tests
│   ├── stock-management.spec.ts   # Stock/FIFO tests
│   └── permission-checks.spec.ts  # Permission tests
├── tsconfig.e2e.json     # TypeScript config for E2E tests
└── playwright.config.ts   # Playwright configuration
```

---

## Quick Start

### Running Tests

**Backend:**
```bash
cd api-server
npm run test:accept              # Run all tests
npm run test:accept:watch        # Watch mode (TDD)
npm run test:accept:coverage     # With coverage report
```

**Frontend:**
```bash
cd admin-web
npm run test:accept              # Headless mode
npm run test:accept:ui           # Interactive UI mode
npm run test:accept:debug        # Debug with breakpoints
npm run test:accept:report       # View HTML report
```

**CI/CD (Makefile):**
```bash
make bmad-accept-api             # Run backend tests
make bmad-accept-web             # Run frontend tests
make bmad-accept-all             # Run all tests
```

---

## Testing Guides

📚 **Detailed Guides:**

1. **[Backend Testing Guide](./backend_testing.md)**
   - Writing Jest tests for API routes
   - Service layer testing
   - Middleware testing
   - Database setup and cleanup
   - Authentication in tests

2. **[Frontend Testing Guide](./frontend_testing.md)**
   - Writing Playwright E2E tests
   - Page object patterns
   - Form interactions
   - Permission testing
   - Stock management testing

3. **[Test Flakiness Guide](./test_flakiness.md)**
   - Understanding flaky tests
   - Test isolation strategies
   - Common causes and fixes
   - beforeEach/afterEach patterns

4. **[Troubleshooting Guide](./troubleshooting_tests.md)**
   - Common errors and solutions
   - SecurityError fixes
   - Strict mode violations
   - Timeout issues
   - Database connection problems

---

## Key Principles

### 1. Pragmatic Over Perfect
- Focus on critical paths rather than 100% coverage
- Target ~60-70% coverage of critical functionality
- Skip edge cases unless they're business-critical

### 2. Integration Over Unit
- Prefer integration tests for services (test real DB interactions)
- Use E2E tests for complete user journeys
- Avoid excessive mocking

### 3. Real Data, Real Database
- Backend tests use real PostgreSQL (dev database)
- No database mocking
- Timestamp-based unique data for isolation

### 4. Test Isolation
- Each test creates unique data with `Date.now()` timestamps
- No database cleanup required between tests
- Tests don't interfere with dev seed data
- Clear cookies/state between tests in frontend
- Don't rely on test execution order

---

## Test Coverage Summary

### Backend Coverage ✅ COMPLETE
- ✅ Authentication & RBAC (46 tests)
- ✅ Stock Management FIFO (23 tests)
- ✅ Product Service (27 tests)
- ✅ API Routes (117 tests)
- ✅ Middleware (62 tests)
- ✅ Health checks (4 tests)
- **Total: 279 tests passing, 0 skipped**

### Frontend Coverage ✅ COMPLETE
- ✅ Authentication flows (17 tests)
- ✅ Product management (23 tests)
- ✅ Stock management (22 tests)
- ✅ Permission checks (21 tests)

---

## Success Metrics

**Backend:**
- ✅ 279 tests passing, 0 skipped
- ✅ All critical paths covered
- ✅ Multi-tenant isolation verified
- ✅ RBAC enforcement tested
- ✅ Timestamp-based isolation (no cleanup needed)

**Frontend:**
- ✅ 72 tests passing
- ✅ Main user flows tested
- ✅ Permission-based UI verified
- ✅ CRUD operations covered

**Overall:**
- ✅ Test infrastructure solid and reusable
- ✅ Documentation comprehensive
- ✅ Test failures actionable and debuggable
- ✅ 100% pass rate on backend tests
- ✅ Tests safe to run on dev database

---

## Next Steps

1. **Read the appropriate guide** based on what you're testing:
   - Backend API/services → [Backend Testing Guide](./backend_testing.md)
   - Frontend UI/workflows → [Frontend Testing Guide](./frontend_testing.md)

2. **Run into issues?** Check the [Troubleshooting Guide](./troubleshooting_tests.md)

3. **Tests flaking?** Read the [Test Flakiness Guide](./test_flakiness.md)

4. **Contributing new tests?** Follow the patterns in existing tests and the guides

---

## Important Notes

### Backend Tests
- **Run against dev database** - Tests use timestamp-based unique data
- **No cleanup needed** - Your seed data is never modified
- **Safe to run anytime** - Tests create unique entities with `Date.now()`
- **See `api-server/__tests__/README.md`** for detailed setup info

### Frontend Tests
- **API server must be running**: `cd api-server && npm run dev`
- **Seed data required**: `npm run db:seed` (run once after migrations)
- **RBAC permissions** must be seeded: `npm run seed:rbac`
- **Test users** from seed data:
  - `owner@acme.test` (Password: `Password123!`)
  - `admin@acme.test` (Password: `Password123!`)
  - `editor@acme.test` (Password: `Password123!`)
  - `viewer@acme.test` (Password: `Password123!`)

---

**Need Help?**
- Check the specific testing guide for your area
- Review existing tests in `__tests__/` or `e2e/` directories
- See [testing_implementation.md](../Tasks/testing_implementation.md) for implementation details
