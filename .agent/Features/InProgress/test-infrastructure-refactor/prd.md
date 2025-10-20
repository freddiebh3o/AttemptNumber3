# Test Infrastructure Refactor - Shared Prisma Client

**Status:** 📋 Planning
**Priority:** High (Blocking test suite reliability)
**Estimated Effort:** 2-3 hours
**Created:** 2025-10-20
**Last Updated:** 2025-10-20

---

## Overview

Fix database connection pool exhaustion issue that causes intermittent test failures with "Too many database connections" errors. Currently, multiple test files create their own `PrismaClient` instances, each opening 10+ connections. When Jest runs 39 test files in parallel, this exhausts the database connection pool limit (typically 100-200 connections).

**Key Capabilities:**
- All tests share a single Prisma client instance with one connection pool
- No more connection pool exhaustion errors during test runs
- Faster test execution (connection reuse)
- Consistent pattern for all future tests

**Related Documentation:**
- [Testing Overview](../../SOP/testing_overview.md) - Testing patterns and best practices
- [Backend Testing Guide](../../SOP/backend_testing.md) - Jest test patterns

---

## Phase 1: Migrate to Shared Prisma Client

**Goal:** Replace all individual `new PrismaClient()` instances with the shared `prismaClientInstance` from `src/db/prismaClient.ts`.

**Relevant Files:**
- [api-server/src/db/prismaClient.ts](../../../api-server/src/db/prismaClient.ts) - Shared Prisma instance
- [api-server/__tests__/helpers/factories.ts](../../../api-server/__tests__/helpers/factories.ts) - Test factories
- [api-server/__tests__/helpers/db.ts](../../../api-server/__tests__/helpers/db.ts) - Database utilities

### Backend Implementation

**Files Creating Their Own Prisma Instances (7 files):**
- [ ] [__tests__/helpers/factories.ts](../../../api-server/__tests__/helpers/factories.ts) - Line 11
- [ ] [__tests__/services/tenantFeatureFlags.test.ts](../../../api-server/__tests__/services/tenantFeatureFlags.test.ts) - Line 15
- [ ] [__tests__/routes/tenantFeatureFlagsRoutes.test.ts](../../../api-server/__tests__/routes/tenantFeatureFlagsRoutes.test.ts) - Line 23
- [ ] [__tests__/services/transferPriority.test.ts](../../../api-server/__tests__/services/transferPriority.test.ts)
- [ ] [__tests__/services/partialShipment.test.ts](../../../api-server/__tests__/services/partialShipment.test.ts)
- [ ] [__tests__/services/transferAnalytics.test.ts](../../../api-server/__tests__/services/transferAnalytics.test.ts)
- [ ] [__tests__/helpers/db.ts](../../../api-server/__tests__/helpers/db.ts) - Line 19 (keep this one, but ensure only one instance)

**Changes Per File:**
1. Replace `const prisma = new PrismaClient()` with:
   ```typescript
   import { prismaClientInstance as prisma } from '../../src/db/prismaClient.js'
   ```
2. Remove `await prisma.$disconnect()` from `afterAll` hooks (shared instance shouldn't be disconnected)
3. Keep data cleanup in `afterAll` (delete test data)

**Pattern for Future Tests:**
- [ ] Update [Backend Testing SOP](../../SOP/backend_testing.md) to document this pattern
- [ ] Add comment in factories.ts explaining why shared instance is used
- [ ] Add linting rule (optional) to prevent `new PrismaClient()` in test files

### Testing Strategy

**Verification Steps:**
- [ ] Run full test suite: `npm run test:accept`
- [ ] Verify no "Too many database connections" errors
- [ ] Verify all 299+ tests still pass
- [ ] Run tests multiple times to ensure consistency
- [ ] Monitor database connection count during test run

**Connection Pool Monitoring:**
```sql
-- PostgreSQL: Check active connections during tests
SELECT count(*) FROM pg_stat_activity WHERE datname = 'your_db_name';
```

### Documentation

- [ ] Update [Backend Testing SOP](../../SOP/backend_testing.md):
  - Add section: "Database Connections in Tests"
  - Document shared Prisma client pattern
  - Add example of correct import
  - Explain why `$disconnect()` shouldn't be called in tests
- [ ] Update [Testing Overview](../../SOP/testing_overview.md):
  - Add "Common Pitfalls" section
  - Document connection pool exhaustion issue
  - Reference this PRD for historical context

---

## Testing Strategy

### Before Refactor (Current State)

**Problem:**
- 39 test files × ~10 connections per PrismaClient = 390+ connections
- Database limit: ~100-200 connections
- Result: Intermittent "Too many database connections" errors

**Workaround:**
- Wait 30-60 seconds between test runs
- Restart database to clear connections

### After Refactor (Target State)

**Solution:**
- 1 shared PrismaClient instance
- 1 connection pool (~10 connections)
- All tests reuse connections
- No connection exhaustion

**Verification:**
- [ ] Run full test suite 5 times consecutively without errors
- [ ] Run tests with `--maxWorkers=10` (parallel) without errors
- [ ] Monitor database connections stay under pool limit
- [ ] Verify test execution time doesn't increase

---

## Success Metrics

- [ ] Zero "Too many database connections" errors in test runs
- [ ] All 299+ existing tests pass without modification
- [ ] Test suite can run consecutively without waiting
- [ ] Database connection count stays under 20 during tests
- [ ] Pattern documented in Backend Testing SOP
- [ ] Future tests follow shared client pattern

---

## Notes & Decisions

**Key Design Decisions:**
- **Reuse application's Prisma instance** - Tests use the same `prismaClientInstance` as the app, ensuring consistency
- **No $disconnect() in tests** - The shared instance is never disconnected, Jest handles cleanup on exit
- **Keep data cleanup** - Tests still clean up their own data in `afterAll`, just not the connection

**Known Limitations:**
- Tests must be careful not to interfere with each other (already handled via timestamp-based unique data)
- Cannot test Prisma connection failure scenarios easily (rare use case)

**Root Cause Analysis:**
- Each `new PrismaClient()` opens 10 connections by default
- Jest runs tests in parallel (default: CPU cores - 1)
- Connection pooling doesn't work across Prisma instances
- PostgreSQL (and most DBs) have connection limits to prevent resource exhaustion

**Why Other Test Files Don't Have This Issue:**
- Most route tests (e.g., `productRoutes.test.ts`) don't create Prisma instances
- They use factories which will use shared instance once fixed
- Only 7 files create their own instances (outliers)

**Future Enhancements (Out of Scope):**
- Connection pool size tuning for test environment
- Jest configuration to limit parallelism
- Docker-based test database with higher connection limits
- Test database per worker (more complex setup)

---

## Related Issues

**Symptoms:**
```
PrismaClientInitializationError:
Too many database connections opened: FATAL: remaining connection
slots are reserved for roles with the SUPERUSER attribute
```

**Occurrence:**
- Happens when running full test suite: `npm run test:accept`
- Usually appears after 20-30 test files have run
- Not deterministic - depends on test execution order and timing

**Immediate Workaround:**
```bash
# Wait for connections to timeout (30-60 seconds)
sleep 60 && npm run test:accept -- -f

# Or restart database to clear all connections immediately
```

---

**Template Version:** 1.0
**Created:** 2025-10-20
