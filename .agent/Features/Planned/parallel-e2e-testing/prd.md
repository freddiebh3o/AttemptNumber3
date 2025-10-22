# Parallel E2E Test Execution - Implementation Plan

**Status:** 📋 Planning
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

- [ ] Create `docker-compose.e2e.yml` with dedicated PostgreSQL service
  - Service name: `postgres-e2e`
  - Container name: `bmad-e2e-db`
  - Port: `5434` (separate from Jest test DB on 5433)
  - Connection limit: `300` (higher than Jest test DB)
  - Persistent volume: `postgres-e2e-data`
  - Health check configuration
  - pgvector extension support

- [ ] Create `.env.test.e2e` environment file
  - `NODE_ENV=test`
  - `DATABASE_URL=postgresql://postgres:e2epassword@localhost:5434/e2edb`
  - `SERVER_PORT=4002` (separate from Jest test server on 4001)
  - Minimal logging (`LOG_LEVEL=error`)
  - Test JWT secret
  - Frontend origin configuration

- [ ] Add npm scripts to `api-server/package.json`
  - `db:e2e:up` - Start E2E test database
  - `db:e2e:down` - Stop E2E test database
  - `db:e2e:reset` - Reset E2E database (down with volumes + up)
  - `db:e2e:wait` - Wait for database readiness
  - `db:e2e:migrate` - Run migrations against E2E database
  - `db:e2e:seed` - Seed E2E test data
  - `db:e2e:setup` - Complete setup (wait + migrate + seed)
  - `dev:e2e` - Start API server with E2E environment

- [ ] Backend tests written (NEVER RUN THE ACTUAL TEST)

### Frontend Implementation

- [ ] Update `admin-web/playwright.config.ts`
  - Add environment variable support for database selection
  - Configure `webServer.env` to use E2E database when specified
  - Add `globalSetup` script for database initialization (optional)

- [ ] Create helper script `admin-web/scripts/setup-e2e-db.js` (optional)
  - Check if E2E database is running
  - Start if not running
  - Wait for readiness
  - Run migrations and seed

- [ ] Update `admin-web/package.json`
  - Add `test:accept:setup` script to prepare E2E database
  - Update `test:accept` to depend on setup (optional)

- [ ] E2E tests written (NEVER RUN THE ACTUAL TEST)

### Documentation

- [ ] Update [SOP/testing-overview.md](../../SOP/testing-overview.md) with E2E database setup
- [ ] Update [SOP/frontend-testing.md](../../SOP/frontend-testing.md) with parallel execution instructions
- [ ] Create section in [CLAUDE.md](../../CLAUDE.md) for E2E test database commands

---

## Phase 2: Rate Limit Configuration for Tests

**Goal:** Bypass or dramatically increase rate limits for test environments to prevent 429 errors during parallel test execution

**Relevant Files:**
- [api-server/src/middleware/rateLimiterMiddleware.ts](../../api-server/src/middleware/rateLimiterMiddleware.ts)
- [api-server/src/app.ts](../../api-server/src/app.ts)
- [api-server/.env.test.e2e](../../api-server/.env.test.e2e)
- [api-server/.env.example](../../api-server/.env.example)

### Backend Implementation

- [ ] Add environment variable support for rate limiting
  - `DISABLE_RATE_LIMIT` - Boolean to completely disable rate limiting (test environments only)
  - `RATE_LIMIT_AUTH` - Override auth rate limit (default: 120/min)
  - `RATE_LIMIT_GENERAL` - Override general rate limit (default: 600/min)

- [ ] Update `rateLimiterMiddleware.ts`
  - Add early return if `DISABLE_RATE_LIMIT=true`
  - Support environment variable overrides for limits
  - Add logging when rate limiting is disabled (security awareness)

- [ ] Update `app.ts`
  - Read rate limit config from environment variables
  - Pass dynamic limits to rate limiter middleware
  - Log rate limit configuration on startup

- [ ] Update `.env.test.e2e`
  - Set `DISABLE_RATE_LIMIT=true` for E2E tests
  - Alternative: Set very high limits (`RATE_LIMIT_AUTH=10000`, `RATE_LIMIT_GENERAL=20000`)

- [ ] Update `.env.example`
  - Document new rate limit environment variables
  - Add warnings about disabling in production

- [ ] Backend tests written (NEVER RUN THE ACTUAL TEST)
  - Test rate limit bypass when `DISABLE_RATE_LIMIT=true`
  - Test environment variable overrides
  - Ensure production defaults are secure

### Frontend Implementation

N/A - This phase is backend-only

### Documentation

- [ ] Update [System/architecture.md](../../System/architecture.md) with rate limit configuration options
- [ ] Update [CLAUDE.md](../../CLAUDE.md) environment variables section
- [ ] Add warning in `.env.example` about security implications

---

## Phase 3: Playwright Parallel Configuration

**Goal:** Configure Playwright to run tests in parallel with optimal worker settings and sharding support

**Relevant Files:**
- [admin-web/playwright.config.ts](../../admin-web/playwright.config.ts)
- [admin-web/package.json](../../admin-web/package.json)

### Backend Implementation

N/A - This phase is frontend-only

### Frontend Implementation

- [ ] Update `playwright.config.ts`
  - Set `fullyParallel: true` (already exists)
  - Configure `workers: process.env.CI ? 4 : undefined` (currently `workers: process.env.CI ? 1 : undefined`)
  - Add `maxFailures` to fail fast if many tests fail
  - Configure retries: `retries: process.env.CI ? 2 : 1`
  - Add `timeout: 30000` per test (30 seconds)
  - Enable `webServer.reuseExistingServer` for faster local runs

- [ ] Add shard support to config
  - Read `process.env.SHARD` for manual sharding
  - Example: `shard: process.env.SHARD ? { current: 1, total: 4 } : null`

- [ ] Update `package.json` with new test scripts
  - `test:accept:parallel` - Run with optimal worker count
  - `test:accept:shard` - Run specific shard (e.g., `SHARD=1/4 npm run test:accept:shard`)
  - `test:accept:fast` - Skip retries for faster local runs
  - Update existing `test:accept` to use parallel by default

- [ ] Add browser context isolation
  - Ensure each test gets fresh context
  - Verify cookie clearing between tests works with parallel execution
  - Test localStorage and sessionStorage isolation

- [ ] E2E tests written (NEVER RUN THE ACTUAL TEST)
  - Verify parallel execution works with current tests
  - Ensure no race conditions from shared state
  - Test that database transactions don't conflict

### Documentation

- [ ] Update [SOP/frontend-testing.md](../../SOP/frontend-testing.md)
  - Add section on parallel test execution
  - Document worker configuration
  - Explain sharding for CI/CD

- [ ] Update [admin-web/e2e/GUIDELINES.md](../../admin-web/e2e/GUIDELINES.md)
  - Add parallel execution best practices
  - Document isolation requirements
  - Add examples of parallel-safe patterns

- [ ] Update [CLAUDE.md](../../CLAUDE.md)
  - Add new npm scripts for parallel testing
  - Document sharding syntax

---

## Phase 4: CI/CD Integration (Optional)

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
- **Rate limit bypass for tests:** Acceptable security tradeoff for test environments only; never enabled in production
- **Playwright sharding:** Enables horizontal scaling in CI/CD; optional for local development
- **Environment-based configuration:** Uses `.env.test.e2e` to keep test config separate from development and production

**Known Limitations:**
- Parallel execution may expose hidden state dependencies in tests (requires test refactoring if found)
- Local development may need reduced worker count on lower-spec machines
- Docker database startup adds ~10-15 seconds to initial test run (acceptable tradeoff)

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
