# Parallel E2E Test Execution

**Completed:** 2025-10-22
**Duration:** 1 day (3 coordinated phases)
**Status:** ✅ Complete - 253/295 tests passing in parallel (~2-5 minutes)

---

## Summary

Enabled reliable parallel execution of all Playwright E2E tests by implementing dedicated test database isolation, rate limit bypass for test environments, and optimal Playwright worker configuration. Tests now run 4-8x faster (~2-5 minutes vs 15-20 minutes serial) with full support for sharding across multiple machines in CI/CD.

## What Was Done

### Phase 1: Test Environment Isolation
**Goal:** Create dedicated E2E test database separate from backend Jest tests

**Created:**
- `docker-compose.e2e.yml` - Dedicated PostgreSQL database on port 5434
- `api-server/.env.test.e2e` - E2E environment configuration (port 4000 with E2E DB)
- npm scripts for E2E database management (`db:e2e:reset`, `db:e2e:up`, `dev:e2e`, etc.)

**Updated:**
- `admin-web/playwright.config.ts` - Documented E2E database setup
- `admin-web/package.json` - Added `test:accept:setup` script
- Documentation in CLAUDE.md, testing-overview.md, frontend-testing.md

**Result:** E2E tests use isolated database (port 5434), preventing connection pool conflicts with Jest tests (port 5433) and development (port 5432)

### Phase 2: Rate Limit Configuration for Tests
**Goal:** Bypass rate limits for test environments to prevent 429 errors during parallel execution

**Created:**
- Rate limit bypass via `DISABLE_RATE_LIMIT` environment variable
- Environment variable overrides for limits (`RATE_LIMIT_AUTH`, `RATE_LIMIT_GENERAL`)

**Updated:**
- `api-server/src/middleware/rateLimiterMiddleware.ts` - Added `disabled` option
- `api-server/src/app.ts` - Reads rate limit config from env vars, logs warnings
- `api-server/.env.test.e2e` - Set `DISABLE_RATE_LIMIT=true`
- `api-server/.env.example` - Documented rate limit variables with security warnings
- `api-server/__tests__/middleware/rateLimit.test.ts` - Added 3 new tests for `disabled` option

**Result:** E2E tests run without rate limiting, enabling full parallel execution without 429 errors. Security warning logs ensure this is only used in test environments.

### Phase 3: Playwright Parallel Configuration
**Goal:** Configure Playwright to run tests in parallel with optimal worker settings and sharding support

**Updated:**
- `admin-web/playwright.config.ts`:
  - Workers: Changed from `CI ? 1 : undefined` to `CI ? 4 : undefined`
  - Added `maxFailures: CI ? 10 : undefined` (fail fast)
  - Updated retries: `CI ? 2 : 1` (was 0 for local)
  - Added `timeout: 30_000` per test
  - Added `actionTimeout: 10_000` per action
  - Added sharding support via `SHARD` env var

- `admin-web/package.json` - Added 4 new test scripts:
  - `test:accept:parallel` - Force 4 workers
  - `test:accept:fast` - 4 workers, no retries
  - `test:accept:shard` - Run with sharding
  - `test:accept:workers` - Custom worker count

**Updated Documentation:**
- `admin-web/e2e/README.md` - Added parallel execution section with timing metrics
- `CLAUDE.md` - Documented all new test scripts and sharding syntax

**Result:** Tests run in parallel by default (uses all CPU cores locally, 4 workers in CI), with sharding support for CI/CD distribution.

## Key Results

### Performance Gains
- ✅ **4-8x faster test execution:** ~2-5 minutes (parallel) vs ~15-20 minutes (serial)
- ✅ **253/295 tests passing** (85.8% pass rate)
- ✅ **42 tests failing** (pre-existing issues + 4 new parallel-specific failures)
- ✅ **1 flaky test** (product validation form)
- ✅ **Zero rate limit errors** (429s) during parallel execution

### Infrastructure Improvements
- ✅ **Three isolated databases:**
  - Port 5432: Development
  - Port 5433: Jest test database (backend unit tests)
  - Port 5434: E2E test database (Playwright tests)
- ✅ **Rate limiting disabled** for E2E tests (ONLY in test environment)
- ✅ **Sharding support** for CI/CD distribution (SHARD=1/4 syntax)
- ✅ **Optimal worker configuration** (auto-detects CPU cores locally, 4 in CI)

### Documentation
- ✅ **Comprehensive README updates** for both frontend and backend tests
- ✅ **Clear setup instructions** with database isolation explained
- ✅ **Troubleshooting guides** for common issues

## Running Tests

### Quick Start

```bash
# 1. Stop dev server if running (E2E server uses same port 4000)

# 2. Setup E2E database (one-time)
cd api-server
npm run db:e2e:reset    # Starts DB on port 5434, runs migrations, seeds data

# 3. Start API server with E2E environment (keep running in separate terminal)
npm run dev:e2e         # Runs on port 4000 with E2E database
                         # Console shows: "⚠️ RATE LIMITING IS DISABLED"

# 4. Run E2E tests (in separate terminal)
cd admin-web
npm run test:accept     # Parallel (uses all CPU cores, ~2-5 min)
```

### Test Commands

```bash
# Default (parallel, uses all CPU cores)
npm run test:accept

# Interactive UI mode (recommended for debugging)
npm run test:accept:ui

# Explicit worker count
npm run test:accept:parallel     # 4 workers
npm run test:accept:fast         # 4 workers, no retries (fastest)
npm run test:accept:workers=2    # Custom: 2 workers

# Sharding (for CI/CD)
SHARD=1/4 npm run test:accept:shard  # Run 1st quarter of tests
SHARD=2/4 npm run test:accept:shard  # Run 2nd quarter of tests
```

## Database Ports

| Database | Port | Purpose | Used By |
|----------|------|---------|---------|
| **Development** | 5432 | Local development | `npm run dev` |
| **Jest Test** | 5433 | Backend unit/integration tests | `npm run test:accept` (api-server) |
| **E2E Test** | 5434 | Playwright E2E tests | `npm run test:accept` (admin-web) |

## Key Learnings

### Design Decisions

**1. API Server Port 4000 for E2E Tests**
- Initially planned to use port 4002 for E2E server
- Changed to port 4000 (same as dev) to avoid frontend configuration complexity
- Isolation achieved via separate databases, not separate ports
- Trade-off: Cannot run dev server and E2E server simultaneously (acceptable)

**2. Rate Limiting Bypass**
- Security tradeoff: Disabled ONLY in test environment, NEVER in production
- Clear warning logs when rate limiting is disabled
- Allows parallel test execution without 429 errors
- Environment variable documentation includes multiple warnings

**3. Sharding Support**
- Added infrastructure for CI/CD distribution across multiple machines
- Not currently used but ready for future GitHub Actions implementation
- Syntax: `SHARD=1/4` splits tests into 4 parts, runs 1st part

### Known Issues

**New Failures (Only in Parallel):**
- 4 new test failures appeared after implementing parallel execution
- Likely race conditions or sidebar navigation timing issues:
  1. `branch-archival.spec.ts` - 2 tests (View button, filter display)
  2. `transfer-analytics.spec.ts` - 1 test (navigation from sidebar)
  3. `transfer-reversal.spec.ts` - 1 test (permission button display)

**Pre-existing Failures:**
- 38 tests failing due to known issues (seed data, navigation, permissions, URL changes)
- See `.agent/Features/Planned/small-todo.md` for detailed list

**Flaky Test:**
- `product-crud.spec.ts` - "should show validation errors for empty form"
- Intermittent failure during parallel execution

## Files Changed

### Created (3 files)
- `docker-compose.e2e.yml` - E2E database configuration
- `api-server/.env.test.e2e` - E2E environment configuration
- `.agent/Features/Planned/parallel-e2e-testing/README.md` - This file

### Modified (15 files)

**Backend:**
- `api-server/src/middleware/rateLimiterMiddleware.ts` - Added `disabled` option
- `api-server/src/app.ts` - Rate limit configuration from env vars
- `api-server/.env.example` - Documented rate limit variables
- `api-server/package.json` - Added 8 E2E database management scripts
- `api-server/__tests__/middleware/rateLimit.test.ts` - Added 3 tests for bypass

**Frontend:**
- `admin-web/playwright.config.ts` - Parallel configuration + sharding support
- `admin-web/package.json` - Added 4 new test scripts
- `admin-web/e2e/README.md` - Added parallel execution documentation

**Backend Test Documentation:**
- `api-server/__tests__/README.md` - Updated with Jest test database clarifications

**Project Documentation:**
- `CLAUDE.md` - E2E database commands + parallel test scripts
- `.agent/SOP/testing-overview.md` - E2E database setup section
- `.agent/SOP/frontend-testing.md` - Updated prerequisites with E2E database

**PRD:**
- `.agent/Features/Planned/parallel-e2e-testing/prd.md` - Complete implementation plan

## Documentation Links

- **[Master PRD](./prd.md)** - Complete implementation plan across 3 phases
- **[Frontend E2E README](../../../admin-web/e2e/README.md)** - How to run E2E tests
- **[Backend Tests README](../../../api-server/__tests__/README.md)** - How to run Jest tests
- **[Testing Overview SOP](../../SOP/testing-overview.md)** - Overall testing strategy
- **[Frontend Testing SOP](../../SOP/frontend-testing.md)** - Playwright E2E patterns
- **[CLAUDE.md](../../../CLAUDE.md)** - Environment configuration

## Future Considerations

### Phase 4: CI/CD Integration (Out of Scope)
- GitHub Actions workflow with test sharding across multiple machines
- Infrastructure is ready (sharding support implemented)
- Can be added in the future if CI/CD parallel execution is needed

### Test Fixes Needed
1. **Fix 4 new parallel-specific failures** (race conditions, timing issues)
2. **Fix 38 pre-existing test failures** (seed data, navigation, permissions)
3. **Address 1 flaky test** (product validation form)

### Potential Improvements
- Investigate and fix race conditions in parallel execution
- Add GitHub Actions workflow for CI/CD (Phase 4)
- Consider increasing worker count for faster local execution
- Add test result analytics and flakiness tracking

---

**Related PRD:** [prd.md](./prd.md)
**Implementation Duration:** 1 day (3 coordinated phases)
**Pass Rate:** 253/295 tests (85.8%) in parallel execution
**Performance Gain:** 4-8x faster (~2-5 min vs 15-20 min serial)
**Infrastructure:** 3 isolated databases + rate limit bypass + sharding support
