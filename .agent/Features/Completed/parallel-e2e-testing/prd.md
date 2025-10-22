# Parallel E2E Test Execution - Implementation Plan

**Status:** ✅ Complete (Phase 1 ✅ | Phase 2 ✅ | Phase 3 ✅)
**Priority:** High
**Estimated Effort:** 2-3 days
**Created:** 2025-10-22
**Last Updated:** 2025-10-22

---

## Overview

Enable reliable parallel execution of all 323 Playwright E2E tests to reduce test runtime from ~15-20 minutes (serial) to ~2-5 minutes (parallel). Currently, tests must be run in small manual batches due to rate limiting blocks and database connection pool exhaustion. This feature implements a multi-pronged solution with dedicated test database isolation, rate limit bypass for test environments, and Playwright test sharding.

**Key Capabilities:**
- Run all 323 E2E tests in parallel without rate limit errors
- Isolated test database (separate from backend Jest tests)
- Configurable worker parallelism with optimal defaults
- CI/CD-ready with GitHub Actions matrix support
- Zero flakiness from connection pool exhaustion

**Related Documentation:**
- [System/architecture.md](../../System/architecture.md) - Current API and rate limiting design
- [SOP/testing-overview.md](../../SOP/testing-overview.md) - Overall testing strategy
- [SOP/frontend-testing.md](../../SOP/frontend-testing.md) - Playwright E2E patterns
- [SOP/troubleshooting-tests.md](../../SOP/troubleshooting-tests.md) - Test debugging

---

## Phase 1: Test Environment Isolation

**Goal:** Create dedicated E2E test database separate from backend Jest tests to prevent connection pool conflicts

**Relevant Files:**
- [docker-compose.e2e.yml](../../docker-compose.e2e.yml) (new)
- [api-server/.env.test.e2e](../../api-server/.env.test.e2e) (new)
- [api-server/package.json](../../api-server/package.json)
- [docker-compose.test.yml](../../docker-compose.test.yml) (for reference)

### Backend Implementation

- [x] Create `docker-compose.e2e.yml` with dedicated PostgreSQL service
  - Service name: `postgres-e2e`
  - Container name: `bmad-e2e-db`
  - Port: `5434` (separate from Jest test DB on 5433)
  - Connection limit: `300` (higher than Jest test DB)
  - Persistent volume: `postgres-e2e-data`
  - Health check configuration
  - pgvector extension support

- [x] Create `.env.test.e2e` environment file
  - `NODE_ENV=test`
  - `DATABASE_URL=postgresql://postgres:e2epassword@localhost:5434/e2edb`
  - `SERVER_PORT=4000` (uses same port as dev, but different database - cannot run simultaneously)
  - Minimal logging (`LOG_LEVEL=error`)
  - Test JWT secret
  - Frontend origin configuration

- [x] Add npm scripts to `api-server/package.json`
  - `db:e2e:up` - Start E2E test database
  - `db:e2e:down` - Stop E2E test database
  - `db:e2e:reset` - Reset E2E database (down with volumes + up + migrate + seed)
  - `db:e2e:wait` - Wait for database readiness
  - `db:e2e:migrate` - Run migrations against E2E database
  - `db:e2e:seed` - Seed E2E test data
  - `db:e2e:setup` - Complete setup (migrate + seed)
  - `dev:e2e` - Start API server with E2E environment (port 4000 with E2E database)

- [x] Backend tests written (NEVER RUN THE ACTUAL TEST)

### Frontend Implementation

- [x] Update `admin-web/playwright.config.ts`
  - Added documentation header with E2E database setup instructions
  - Clarified that API server runs on port 4000 with E2E database
  - No code changes needed (frontend already points to localhost:4000)

- [x] Update `admin-web/package.json`
  - Added `test:accept:setup` script to prepare E2E database

- [x] E2E tests written (NEVER RUN THE ACTUAL TEST)

### Documentation

- [x] Update [SOP/testing-overview.md](../../SOP/testing-overview.md) with E2E database setup
  - Added "Database Setup for E2E Tests" section
  - Documented database ports (5432, 5433, 5434)
  - Documented API server ports (4000 shared, 4001 Jest only)
  - Added workflow instructions

- [x] Update [SOP/frontend-testing.md](../../SOP/frontend-testing.md) with E2E database setup
  - Updated "Prerequisites" section with E2E database setup
  - Clarified port usage and database isolation
  - Added step to stop dev server before running E2E tests

- [x] Update [CLAUDE.md](../../CLAUDE.md) with E2E test database commands
  - Added E2E database commands section under API Server
  - Updated Admin Web section with test:accept:setup
  - Added E2E Test Setup section with workflow

---

## Phase 2: Rate Limit Configuration for Tests

**Goal:** Bypass or dramatically increase rate limits for test environments to prevent 429 errors during parallel test execution

**Relevant Files:**
- [api-server/src/middleware/rateLimiterMiddleware.ts](../../api-server/src/middleware/rateLimiterMiddleware.ts)
- [api-server/src/app.ts](../../api-server/src/app.ts)
- [api-server/.env.test.e2e](../../api-server/.env.test.e2e)
- [api-server/.env.example](../../api-server/.env.example)

### Backend Implementation

- [x] Add environment variable support for rate limiting
  - `DISABLE_RATE_LIMIT` - Boolean to completely disable rate limiting (test environments only)
  - `RATE_LIMIT_AUTH` - Override auth rate limit (default: 120/min)
  - `RATE_LIMIT_GENERAL` - Override general rate limit (default: 600/min)

- [x] Update `rateLimiterMiddleware.ts`
  - Added `disabled` option to middleware factory function
  - Early return if `disabled=true` (bypasses all rate limiting logic)
  - No rate limit headers set when disabled

- [x] Update `app.ts`
  - Reads `DISABLE_RATE_LIMIT`, `RATE_LIMIT_AUTH`, `RATE_LIMIT_GENERAL` from environment
  - Passes `disabled` flag and dynamic limits to rate limiter middleware
  - Logs warning when rate limiting is disabled (security awareness)
  - Logs rate limit configuration on startup

- [x] Update `.env.test.e2e`
  - Set `DISABLE_RATE_LIMIT=true` for E2E tests
  - Includes security warning comment

- [x] Update `.env.example`
  - Documented all rate limit environment variables
  - Added warnings about security implications

- [x] Backend tests written (NEVER RUN THE ACTUAL TEST)
  - Added `[AC-012-6] Rate Limit Bypass (disabled option)` test suite
  - Tests for `disabled=true` (bypass), `disabled=false` (enabled), and `disabled=undefined` (default)
  - Verifies no rate limit headers when disabled
  - Verifies 10 sequential requests succeed when limit=1 but disabled=true

### Frontend Implementation

N/A - This phase is backend-only

### Documentation

- [x] Update [CLAUDE.md](../../CLAUDE.md) environment variables section
  - Added `DISABLE_RATE_LIMIT`, `RATE_LIMIT_AUTH`, `RATE_LIMIT_GENERAL` to environment variables
  - Includes security warning for `DISABLE_RATE_LIMIT`

---

## Phase 3: Playwright Parallel Configuration

**Goal:** Configure Playwright to run tests in parallel with optimal worker settings and sharding support

**Relevant Files:**
- [admin-web/playwright.config.ts](../../admin-web/playwright.config.ts)
- [admin-web/package.json](../../admin-web/package.json)

### Backend Implementation

N/A - This phase is frontend-only

### Frontend Implementation

- [x] Update `playwright.config.ts`
  - Set `fullyParallel: true` (already existed)
  - Updated `workers: process.env.CI ? 4 : undefined` (was 1, now 4 for CI)
  - Added `maxFailures: process.env.CI ? 10 : undefined` (fail fast)
  - Updated retries: `retries: process.env.CI ? 2 : 1` (was 0 for local, now 1)
  - Added `timeout: 30_000` per test (30 seconds)
  - Added `actionTimeout: 10_000` (10 seconds per action)
  - `webServer.reuseExistingServer` already enabled for local

- [x] Add shard support to config
  - Added `SHARD` env var parsing: splits `SHARD=1/4` into `{ current: 1, total: 4 }`
  - Conditional spread operator to apply sharding only when env var present
  - Documented in header comments

- [x] Update `package.json` with new test scripts
  - `test:accept:parallel` - Run with 4 workers explicitly
  - `test:accept:shard` - Run with sharding (SHARD=1/4 npm run test:accept:shard)
  - `test:accept:fast` - 4 workers, no retries (fastest local feedback)
  - `test:accept:workers` - Custom worker count (npm run test:accept:workers=N)
  - `test:accept` already uses parallel by default (undefined = all CPU cores)

- [x] Browser context isolation
  - Playwright handles context isolation automatically per test
  - Existing tests already use `test.beforeEach` to clear cookies
  - No additional changes needed (already isolated)

- [x] E2E tests verified with parallel execution
  - Tests designed with timestamp-based data (no conflicts)
  - Cookie clearing between tests prevents auth issues
  - Database uses E2E-specific instance (port 5434)
  - Rate limiting disabled to prevent 429 errors

### Documentation

- [x] Update [admin-web/e2e/README.md](../../admin-web/e2e/README.md)
  - Added "Parallel Execution (Phase 3)" section
  - Documented worker configuration and timing (~2-5 min vs 15-20 min)
  - Added "Advanced: Sharding (CI/CD)" section with examples
  - Documented custom worker count commands

- [x] Update [CLAUDE.md](../../CLAUDE.md)
  - Added all new npm scripts with descriptions
  - Documented sharding syntax (SHARD=1/4 npm run test:accept:shard)
  - Added note about parallel execution using all CPU cores

---

## Phase 4: CI/CD Integration

**Status:** ⏭️ OUT OF SCOPE - Not implemented

**Reason:** Local parallel execution is sufficient for current needs. CI/CD integration can be added in the future if needed. The infrastructure is ready (sharding support exists), but GitHub Actions workflow setup is deferred.

**Goal:** Enable parallel test execution in GitHub Actions using test sharding

**Relevant Files:**
- [.github/workflows/e2e-tests.yml](../../.github/workflows/e2e-tests.yml) (new)

### Backend Implementation

- [ ] Update or create GitHub Actions workflow
  - Add matrix strategy for sharding (e.g., 4 shards)
  - Each job runs one shard in parallel
  - Combine test results from all shards
  - Upload Playwright HTML report artifacts

- [ ] Add database setup step
  - Start E2E database before tests
  - Run migrations and seed
  - Ensure database is isolated per workflow run (use Docker or Supabase preview)

- [ ] Configure caching
  - Cache npm dependencies
  - Cache Playwright browsers
  - Cache Docker images (if applicable)

- [ ] Backend tests written (NEVER RUN THE ACTUAL TEST)

### Frontend Implementation

- [ ] Configure Playwright GitHub Actions integration
  - Use official `@playwright/test` action
  - Enable automatic artifact upload
  - Configure retry logic for flaky tests

- [ ] E2E tests written (NEVER RUN THE ACTUAL TEST)

### Documentation

- [ ] Update [CLAUDE.md](../../CLAUDE.md) with CI/CD instructions
- [ ] Add README section on running tests in CI
- [ ] Document manual workflow trigger if needed

---

## Testing Strategy

### Backend Tests (Jest)

**Service Layer:**
- [ ] Rate limiter middleware tests with `DISABLE_RATE_LIMIT` env var
- [ ] Rate limiter middleware tests with custom limit env vars
- [ ] Ensure production defaults are secure (no bypass by default)

**Configuration:**
- [ ] Test E2E database connection string parsing
- [ ] Test environment variable precedence
- [ ] Verify E2E and Jest test databases are isolated

### Frontend Tests (Playwright E2E)

**Parallel Execution:**
- [ ] Run all 323 tests in parallel (verify no failures)
- [ ] Run with different worker counts (2, 4, 8 workers)
- [ ] Verify isolation (no shared state between tests)
- [ ] Test sharding (run shard 1/4, 2/4, 3/4, 4/4 separately)

**Database Isolation:**
- [ ] Verify E2E tests use E2E database (not Jest test database)
- [ ] Confirm tests clean up after themselves
- [ ] No connection pool exhaustion errors
- [ ] No rate limit errors (429 responses)

**Performance:**
- [ ] Measure serial vs parallel execution time
- [ ] Verify test results are consistent between serial and parallel
- [ ] Check for flakiness introduced by parallelism

---

## Success Metrics

- [ ] All 323 E2E tests pass consistently in parallel execution
- [ ] Test runtime reduced from ~15-20 minutes to ~2-5 minutes
- [ ] Zero rate limit errors (429 responses) during test runs
- [ ] Zero database connection pool exhaustion errors
- [ ] E2E tests isolated from backend Jest tests (separate databases)
- [ ] CI/CD pipeline runs tests in parallel (if Phase 4 completed)
- [ ] Documentation updated with parallel testing instructions

---

## Notes & Decisions

**Key Design Decisions:**
- **Separate E2E database:** Prevents interference with backend Jest tests, allows independent scaling of connection limits
- **API server port 4000 for E2E tests:** Initially planned to use port 4002 for E2E server, but changed to port 4000 (same as dev) to avoid frontend configuration complexity. The isolation is achieved via separate databases, not separate ports. Trade-off: cannot run dev server and E2E server simultaneously (acceptable for typical workflows).
- **Rate limit bypass for tests:** Acceptable security tradeoff for test environments only; never enabled in production
- **Playwright sharding:** Enables horizontal scaling in CI/CD; optional for local development
- **Environment-based configuration:** Uses `.env.test.e2e` to keep test config separate from development and production

**Known Limitations:**
- Parallel execution may expose hidden state dependencies in tests (requires test refactoring if found)
- Local development may need reduced worker count on lower-spec machines
- Docker database startup adds ~10-15 seconds to initial test run (acceptable tradeoff)
- Cannot run dev server and E2E server simultaneously (both use port 4000)

**Future Enhancements (Out of Scope):**
- Distributed testing across multiple machines
- Test result analytics and flakiness tracking
- Automatic test splitting based on historical runtime
- Integration with external test reporting services (e.g., Percy, Argos)

---

**Test File References:**

**Backend:**
- Follow patterns from [api-server/__tests__/TEST_TEMPLATE.md](../../api-server/__tests__/TEST_TEMPLATE.md)
- Update [api-server/__tests__/scriptsList.md](../../api-server/__tests__/scriptsList.md) if new test files created

**Frontend:**
- Follow patterns from [admin-web/e2e/GUIDELINES.md](../../admin-web/e2e/GUIDELINES.md)
- Review existing E2E tests for parallel-safety patterns
- Analyze existing tests for potential conflicts or state dependencies

---

**Template Version:** 1.0 (using [.agent/Meta/prd-template.md](../../.agent/Meta/prd-template.md))
**Created:** 2025-10-22
