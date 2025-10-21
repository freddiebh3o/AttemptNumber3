# Test Infrastructure Refactor - Isolated Test Database

**Status:** 📋 Planning
**Priority:** High (Blocking test suite reliability)
**Estimated Effort:** 1-2 days
**Created:** 2025-10-20
**Last Updated:** 2025-10-20

---

## Overview

Fix database connection pool exhaustion and test isolation issues by running tests against a dedicated PostgreSQL database in Docker. Currently, tests run against the development/staging Supabase database, causing connection limit errors when Jest runs 39 test files (even serially, `maxWorkers: 1`). A local Docker database provides unlimited connection capacity, faster test execution, and true test isolation.

**Key Capabilities:**
- Tests run against local PostgreSQL in Docker (isolated from dev/prod data)
- No more "Too many database connections" errors from Supabase limits
- Faster test execution (local database, no network latency)
- Safe to run tests in parallel (`maxWorkers: auto`)
- Developers can run tests without affecting shared databases

**Related Documentation:**
- [Testing Overview](../../SOP/testing_overview.md) - Testing patterns and best practices
- [Backend Testing Guide](../../SOP/backend_testing.md) - Jest test patterns

---

## Phase 1: Docker Test Database Setup

**Goal:** Create a Docker Compose setup for running PostgreSQL with pgvector extension for tests.

**Relevant Files:**
- [docker-compose.test.yml](../../../docker-compose.test.yml) - New file
- [api-server/.env.test](../../../api-server/.env.test) - New file
- [api-server/package.json](../../../api-server/package.json) - Scripts update
- [api-server/jest.config.js](../../../api-server/jest.config.js) - Configuration

### Backend Implementation

**Docker Setup:**
- [ ] Create `docker-compose.test.yml` with PostgreSQL 16 + pgvector
- [ ] Configure persistent volume for faster subsequent runs
- [ ] Expose port 5433 (avoid conflict with dev database on 5432)
- [ ] Set reasonable connection limits (e.g., `max_connections=200`)

**Environment Configuration:**
- [ ] Create `.env.test` with test database URL
- [ ] Set `DATABASE_URL=postgresql://postgres:testpassword@localhost:5433/testdb`
- [ ] Set `NODE_ENV=test`
- [ ] Document environment variables in `.env.example`

**NPM Scripts:**
- [ ] Add `db:test:up` - Start Docker test database
- [ ] Add `db:test:down` - Stop Docker test database
- [ ] Add `db:test:reset` - Reset and migrate test database
- [ ] Add `db:test:migrate` - Apply migrations to test database
- [ ] Update `test:accept` to load `.env.test` automatically

**Jest Configuration:**
- [ ] Update `jest.config.js` to load `.env.test` in `setupFilesAfterEnv`
- [ ] Update `maxWorkers: 4` (or `auto`) to enable parallel tests
- [ ] Add global setup script to ensure database is ready
- [ ] Add global teardown script to optionally clean up

### Testing Strategy

**Verification Steps:**
- [ ] Start test database: `npm run db:test:up`
- [ ] Verify container is running: `docker ps`
- [ ] Run migrations: `npm run db:test:migrate`
- [ ] Run full test suite: `npm run test:accept`
- [ ] Verify all 299+ tests pass
- [ ] Run tests multiple times in succession (no 60s wait needed)
- [ ] Stop database: `npm run db:test:down`

**Rollback Plan:**
- Keep current `.env` setup working (Supabase)
- If Docker approach fails, can revert to shared Prisma client approach
- Git branch for easy rollback

### Documentation

- [ ] Update [Backend Testing SOP](../../SOP/backend_testing.md):
  - Add "Running Tests Locally" section
  - Document Docker prerequisites (Docker Desktop installed)
  - Document test database lifecycle commands
  - Add troubleshooting section for common Docker issues
- [ ] Update [Testing Overview](../../SOP/testing_overview.md):
  - Update "Prerequisites" section with Docker requirement
  - Add "Test Database Architecture" explanation
- [ ] Update [CLAUDE.md](../../../CLAUDE.md):
  - Add Docker test database to "Common Development Commands"
  - Update "Testing & Debugging" section

---

## Phase 2: Migration Workflow & CI Integration

**Goal:** Ensure test database schema stays in sync with development and support CI/CD environments.

**Relevant Files:**
- [.github/workflows/test.yml](../../../.github/workflows/test.yml) - CI config (if exists)
- [api-server/package.json](../../../api-server/package.json) - Scripts
- [Makefile](../../../Makefile) - Build targets

### Backend Implementation

**Migration Automation:**
- [ ] Create `db:test:setup` script that runs migrations automatically
- [ ] Update `test:accept` to run `db:test:setup` before tests (idempotent)
- [ ] Document migration workflow in testing SOP

**CI Configuration (if applicable):**
- [ ] Add Docker service to GitHub Actions workflow
- [ ] Configure PostgreSQL container in CI
- [ ] Run migrations before test step
- [ ] Verify tests pass in CI environment

**Developer Workflow:**
- [ ] Document when to run `db:test:migrate` (after schema changes)
- [ ] Add pre-test check script to detect schema drift
- [ ] Consider adding a git hook for schema changes

### Testing Strategy

**Verification Steps:**
- [ ] Create a new migration (e.g., add test table)
- [ ] Run `db:test:migrate`
- [ ] Verify migration applied: `npm run db:studio` (against test DB)
- [ ] Verify tests still pass
- [ ] Rollback migration and verify cleanup

### Documentation

- [ ] Update [SOP: Schema Migrations](../../SOP/schema-migrations.md) (if exists):
  - Add section on test database migrations
  - Document `db:test:migrate` workflow
- [ ] Update [CLAUDE.md](../../../CLAUDE.md):
  - Add migration workflow for test database to "Database Workflow"

---

## Phase 3: Shared Prisma Client Pattern (Optional Optimization)

**Goal:** Reduce connection count further by using a single Prisma client instance across all tests.

**Relevant Files:**
- [api-server/__tests__/helpers/db.ts](../../../api-server/__tests__/helpers/db.ts)
- [api-server/__tests__/helpers/factories.ts](../../../api-server/__tests__/helpers/factories.ts)
- All test files with `new PrismaClient()`

### Backend Implementation

**Shared Client Migration:**
- [ ] Update `__tests__/helpers/db.ts` to export singleton instance
- [ ] Replace `new PrismaClient()` in factories.ts
- [ ] Replace `new PrismaClient()` in 6 other test files:
  - [ ] `__tests__/services/tenantFeatureFlags.test.ts`
  - [ ] `__tests__/routes/tenantFeatureFlagsRoutes.test.ts`
  - [ ] `__tests__/services/transferPriority.test.ts`
  - [ ] `__tests__/services/partialShipment.test.ts`
  - [ ] `__tests__/services/transferAnalytics.test.ts`
- [ ] Remove `await prisma.$disconnect()` from test teardown hooks
- [ ] Add global teardown to disconnect once at end

**Pattern Enforcement:**
- [ ] Add lint rule (optional) to prevent `new PrismaClient()` in test files
- [ ] Add comment in db.ts explaining singleton pattern

### Testing Strategy

**Verification Steps:**
- [ ] Run full test suite with shared client
- [ ] Verify all tests still pass
- [ ] Monitor connection count (should be ~10, not ~100+)
- [ ] Run tests in parallel (`maxWorkers: 4`)

**Note:** This phase is optional and can be skipped if Docker database solves the connection limit issue. Only implement if parallel tests still show connection pressure.

### Documentation

- [ ] Update [Backend Testing SOP](../../SOP/backend_testing.md):
  - Document shared Prisma client pattern
  - Explain why singleton is used in tests

---

## Testing Strategy

### Current State (Problems)

**Connection Pool Exhaustion:**
- Supabase free tier: ~100 connection limit
- Each test file creates `PrismaClient` → ~10 connections
- Even with `maxWorkers: 1`, connections accumulate
- Result: "Too many database connections" errors

**Slow Feedback Loop:**
- Network latency to Supabase (cloud database)
- Must wait 60+ seconds between test runs for connections to close
- Cannot run tests in parallel safely

**Shared Database Risks:**
- Tests run against dev/staging database
- Risk of polluting shared data
- Timestamp-based isolation helps but not foolproof

### Target State (After Refactor)

**Isolated Test Database:**
- Local PostgreSQL in Docker
- No connection limits (local resource only)
- Fast (no network latency)
- Safe to reset/seed between runs

**Parallel Testing:**
- Can increase `maxWorkers` to 4 or `auto`
- Faster test execution (4x speedup potential)
- No connection exhaustion

**Developer Experience:**
- Single command to start database: `npm run db:test:up`
- Tests run reliably without waits
- Can run tests in watch mode: `npm run test:accept:watch`

---

## Success Metrics

- [ ] Zero "Too many database connections" errors in 10 consecutive test runs
- [ ] All 299+ existing tests pass without modification
- [ ] Test suite runs in parallel (`maxWorkers: 4`) successfully
- [ ] Test execution time < 60 seconds (vs current ~120s serial)
- [ ] Developer onboarding: single `npm run db:test:up` gets tests working
- [ ] CI pipeline passes with Docker database setup
- [ ] Documentation updated with Docker prerequisites and workflow

---

## Notes & Decisions

**Key Design Decisions:**
- **Docker over Supabase for tests:** Local Docker provides unlimited connections, faster execution, and true isolation
- **Port 5433 for test DB:** Avoids conflict with local dev database on 5432
- **Persistent volume:** Faster restarts, schema persists between container restarts
- **Auto-migration on test run:** `db:test:setup` ensures schema is always current (idempotent)

**Known Limitations:**
- Requires Docker Desktop installed (new developer prerequisite)
- Windows/Mac: Docker may consume significant resources
- CI environments need Docker support (most CI providers support this)

**Technology Choices:**
- PostgreSQL 16 (matches production)
- pgvector extension (required for AI chat feature)
- Docker Compose (simple, standard, well-documented)

**Alternative Approaches Considered:**
1. **Shared Prisma client only:** Would reduce connections but doesn't solve Supabase limit
2. **In-memory SQLite:** Fast but schema differences from PostgreSQL
3. **Test database per worker:** Complex setup, harder to debug
4. **Supabase project pooler settings:** Cannot control free tier limits

**Future Enhancements (Out of Scope):**
- Test database snapshots for faster resets
- Seed data optimizations (minimal fixture data)
- Parallel test sharding across multiple databases
- Integration with test coverage reporting

**Migration Path:**
- Phase 1 is required (Docker setup)
- Phase 2 is required (migration workflow)
- Phase 3 is optional (shared client optimization)

---

## Related Issues

**Original Error:**
```
PrismaClientInitializationError:
Too many database connections opened: FATAL: remaining connection
slots are reserved for roles with the SUPERUSER attribute
```

**Root Cause:**
- Supabase connection pooler limits (~100 connections)
- Jest test files create individual Prisma clients
- Connections don't close fast enough between test files
- Even `maxWorkers: 1` accumulates connections

**Previous Workarounds:**
```bash
# Wait for connections to timeout (60+ seconds)
sleep 60 && npm run test:accept

# Manual connection cleanup via Supabase dashboard
```

**Why Docker Solves This:**
- Local database = no cloud connection limits
- Control over `max_connections` setting
- Fast connection creation/cleanup
- Can restart database instantly if needed

---

**Template Version:** 1.0
**Created:** 2025-10-20
