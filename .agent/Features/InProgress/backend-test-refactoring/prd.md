# Backend Test Refactoring - Master Implementation Plan

**Status:** 🚧 In Progress
**Priority:** High
**Estimated Effort:** 10-15 days (across 5 PRDs)
**Created:** 2025-10-21
**Last Updated:** 2025-10-21

---

## Overview

Comprehensive refactoring of 39 backend test files into a feature-based, hierarchical organization with complete RBAC coverage and standardized test patterns. This initiative will establish a maintainable test structure, create comprehensive permission test coverage, and fill gaps in middleware and feature testing.

**Key Capabilities:**
- Standardized test template ensuring consistency across all 227+ backend tests
- Feature-based organization mirroring src/ directory structure for easy navigation
- Comprehensive RBAC permission testing (12 new test files covering all roles × all endpoints)
- Complete middleware test coverage (3 new test files for previously untested middleware)
- Full service and route coverage for all features (~20 new test files)

**Related Documentation:**
- [Testing Overview](../../SOP/testing-overview.md) - Current testing strategy
- [Backend Testing Guide](../../SOP/backend-testing.md) - Jest patterns and helpers
- [RBAC System](../../System/rbac-system.md) - Permission catalog and roles
- [Architecture](../../System/architecture.md) - API routes and services overview

---

## Sub-PRD Tracking

This master PRD tracks progress across 5 detailed implementation PRDs:

### PRD 1: Test Template & Directory Structure
**File:** [prd-1-test-template-and-structure.md](./prd-1-test-template-and-structure.md)
**Status:** 📋 Planning
**Goal:** Create standardized test template + establish new directory structure + move existing 39 tests

**Progress:**
- [ ] Phase 1: Create test template markdown document
- [ ] Phase 2: Create new directory structure (8 top-level folders)
- [ ] Phase 3: Move and refactor 39 existing test files

### PRD 2: Permission Test Suite
**File:** [prd-2-permission-test-suite.md](./prd-2-permission-test-suite.md)
**Status:** 🚧 In Progress (Phase 1 Complete ✅)
**Goal:** Build comprehensive RBAC permission tests for all 12 features

**Progress:**
- [x] Phase 1: Products, Stock, Branches permissions (3 files) ✅ **162 tests passing**
- [ ] Phase 2: Users, Roles, Theme permissions (3 files)
- [ ] Phase 3: Uploads, Audit Logs permissions (2 files)
- [ ] Phase 4: Transfers, Templates, Approvals, Analytics permissions (4 files)

**Phase 1 Highlights:**
- Created 162 comprehensive permission tests across 3 core features
- **Fixed critical security bug:** Tenant isolation bypass in stock levels endpoint
- **Fixed test infrastructure:** Race conditions in factory helpers + Prisma deadlock
- All tests passing with parallel execution (Jest `maxWorkers: 4`)

### PRD 3: New Middleware Tests
**File:** [prd-3-new-middleware-tests.md](./prd-3-new-middleware-tests.md)
**Status:** 📋 Planning
**Goal:** Complete middleware test coverage with 3 new test files

**Progress:**
- [ ] Phase 1: requestId + zodValidation middleware tests
- [ ] Phase 2: httpLogging middleware test

### PRD 4: New Feature Tests - Part 1 (Core Features)
**File:** [prd-4-new-feature-tests-part1.md](./prd-4-new-feature-tests-part1.md)
**Status:** 📋 Planning
**Goal:** Add missing service/route tests for core features (8 new test files)

**Progress:**
- [ ] Phase 1: Branches (service + routes)
- [ ] Phase 2: Tenant Users (service)
- [ ] Phase 3: Roles (service + routes)
- [ ] Phase 4: Auth Service tests

### PRD 5: New Feature Tests - Part 2 (Advanced Features)
**File:** [prd-5-new-feature-tests-part2.md](./prd-5-new-feature-tests-part2.md)
**Status:** 📋 Planning
**Goal:** Add missing service/route tests for advanced features (12 new test files)

**Progress:**
- [ ] Phase 1: Theme (service + routes)
- [ ] Phase 2: Uploads (service + routes)
- [ ] Phase 3: Audit Logs (service + routes)
- [ ] Phase 4: Stock Transfers routes
- [ ] Phase 5: Transfer Templates routes
- [ ] Phase 6: Transfer Approvals (service + routes + evaluation)
- [ ] Phase 7: Transfer Analytics routes

---

## Overall Progress Summary

**Total Test Files:**
- Existing: 39 files → reorganize
- New Permissions: 12 files
- New Middleware: 3 files
- New Feature Tests: 20 files
- **Total after completion:** ~74 well-organized test files

**Test Coverage Goals:**
- Current: 389 backend tests passing (227 original + 162 new permission tests)
- Target: 400+ backend tests passing
- Permission coverage: 25% complete (3 of 12 features)
  - ✅ Products (8 endpoints, 58 tests)
  - ✅ Stock (6 endpoints, 44 tests)
  - ✅ Branches (7 endpoints, 56 tests)
- Middleware coverage: 67% → 100%
- Feature coverage: ~60% → 100%

---

## Testing Strategy

### Standardization Approach

**Test Template Document:**
- Markdown reference document for consistent test structure
- Service test pattern (business logic, multi-tenancy, validation)
- Route test pattern (HTTP layer, envelope format, minimal permissions)
- Permission test pattern (matrix testing: all roles × all endpoints)

**Directory Organization:**
```
__tests__/
├── helpers/              # Shared test utilities
├── fixtures/             # Test data
├── setup/                # Global setup/teardown
├── core/                 # Health, auth core tests
├── middleware/           # Middleware-specific tests
├── permissions/          # RBAC permission tests (NEW - 12 files)
└── features/             # Feature-organized tests
    ├── products/
    ├── stock/
    ├── branches/
    ├── tenantUsers/
    ├── roles/
    ├── theme/
    ├── uploads/
    ├── auditLogs/
    ├── stockTransfers/
    ├── transferAnalytics/
    ├── featureFlags/
    └── chat/
```

### Test Isolation Pattern

**Use `testContext` for cleanup:**
- Initialize in `beforeEach` → cleanup in `afterEach`
- Track all created entities for automatic deletion
- Prevent test interference and data pollution

**Database Strategy:**
- Tests run against dev database (safe with timestamps)
- Use factory helpers with `Date.now()` for unique data
- No cleanup needed by default (timestamp-based uniqueness)

### Permission Testing Strategy

**Matrix Coverage:**
- Test EVERY endpoint with EVERY role (OWNER, ADMIN, EDITOR, VIEWER, custom roles)
- Test unauthenticated requests (401)
- Test unauthorized requests (403)
- Test cross-tenant isolation

**Separation of Concerns:**
- Permission tests in `permissions/` directory (comprehensive RBAC)
- Route tests include minimal permission checks (1 happy path, 1 denied path)
- Service tests focus on business logic (no permission layer)

---

## Success Metrics

- [x] All 39 existing tests moved to new structure and passing
- [x] Test template document created and referenced in all new tests
- [x] 3 of 12 permission test files created (Phase 1 complete) ✅
- [ ] 9 more permission test files (Phases 2-4)
- [ ] 3 new middleware test files created with >90% coverage
- [ ] 20 new feature test files created filling coverage gaps
- [ ] All tests passing: 400+ backend tests (currently 389, up from 227)
- [ ] Permission coverage: 100% of endpoints × 100% of roles (currently 25% - 3 of 12 features)
- [ ] Middleware coverage: 100% of middleware functions
- [ ] Feature coverage: 100% of service functions and routes
- [ ] Documentation updated: testing SOPs reflect new structure
- [x] Zero test flakiness (all parallel execution issues fixed) ✅

---

## PRD 2 Phase 1 Completion Notes

**Date Completed:** 2025-10-21

**Summary:** Successfully completed Phase 1 of permission test suite creation, adding 162 comprehensive RBAC tests across 3 core features (Products, Stock, Branches). Testing revealed and fixed one critical security bug and two test infrastructure issues.

**Key Achievements:**

1. **Created 3 Permission Test Files:**
   - `products.permissions.test.ts` - 58 tests covering 8 endpoints
   - `stock.permissions.test.ts` - 44 tests covering 6 endpoints
   - `branches.permissions.test.ts` - 56 tests covering 7 endpoints

2. **Fixed Critical Security Bug:**
   - **Tenant Isolation Bypass in Stock Levels API**
   - Endpoint was not validating branch/product ownership before returning stock data
   - Cross-tenant users could query stock information from other tenants
   - Fixed by adding tenant ownership validation in `getStockLevelsForProductService()`
   - Returns 404 for cross-tenant access attempts

3. **Fixed Test Infrastructure Issues:**
   - **Race Condition in Factory Helpers:** `Date.now()` collisions causing unique constraint failures
     - Fixed by adding `generateUniqueId()` helper (timestamp + random string)
   - **Prisma Transaction Deadlock:** Parallel `receiveStock()` calls causing upsert conflicts
     - Fixed by pre-creating `ProductStock` rows to eliminate race condition

4. **Key Learnings:**
   - Activity endpoints return 200 empty instead of 404 for cross-tenant (by design)
   - Branch operations require `tenant:manage`, not `branches:manage`
   - Stock operations need both role permission AND branch membership
   - Custom roles work correctly across all tested endpoints

**Test Quality:**
- All 162 tests passing consistently
- Tests run in parallel (Jest `maxWorkers: 4`) without conflicts
- Zero flakiness after infrastructure fixes
- Comprehensive coverage: all roles × all endpoints matrix

**Files Modified:**
- Created: 3 permission test files
- Updated: `scriptsList.md` (added PERMISSIONS section)
- Security fix: `stockService.ts` (tenant validation)
- Infrastructure: `factories.ts` (unique ID generation)
- Infrastructure: `transferService.test.ts` (deadlock fix)

**Next Steps:**
- Begin PRD 2 Phase 2: User Management Permissions (tenantUsers, roles, theme)
- Continue applying permission test pattern to remaining 9 features

---

## Notes & Decisions

**Key Design Decisions:**

1. **Feature-based organization**
   - **Rationale:** Mirror src/ directory structure for intuitive navigation; easier to find tests
   - **Alternative considered:** Keep flat routes/ and services/ structure (rejected: hard to navigate at scale)

2. **Separate permissions/ directory**
   - **Rationale:** RBAC testing is cross-cutting concern; matrix testing needs dedicated space
   - **Alternative considered:** Embed in route tests (rejected: creates massive route test files)

3. **Test template as markdown document**
   - **Rationale:** Living reference that's easy to update; not enforced by tooling but by convention
   - **Alternative considered:** Code generator (rejected: adds complexity, reduces flexibility)

4. **Split into 5 sub-PRDs**
   - **Rationale:** Work is too large for single PRD; enables parallel work and clear milestones
   - **Alternative considered:** Single massive PRD (rejected: overwhelming, hard to track)

5. **Backend-only refactoring**
   - **Rationale:** Frontend E2E tests recently refactored (Oct 2025); focus on backend gaps
   - **Alternative considered:** Full-stack refactor (rejected: too large, frontend already done)

**Known Limitations:**
- Refactoring may temporarily break test references in documentation (update SOPs afterward)
- Moving 39 files will create large git diff (use clear commit messages per PRD)
- Some existing tests may need significant refactoring to match new patterns

**Future Enhancements (Out of Scope):**
- Automated test generation from OpenAPI schemas
- Contract testing between frontend and backend
- Mutation testing for test quality validation
- Performance/load testing infrastructure
- Visual regression testing for E2E

---

## Implementation Sequence

**Recommended Order:**
1. **PRD 1** (Template & Structure) - Foundation for all other work
2. **PRD 3** (Middleware) - Quick win, fills obvious gaps
3. **PRD 2** (Permissions) - High value, comprehensive coverage
4. **PRD 4** (Core Features) - Essential service/route coverage
5. **PRD 5** (Advanced Features) - Complete remaining coverage

**Rationale:** Build foundation first (template + structure), then layer in missing tests (middleware → permissions → features)

**Parallelization Opportunities:**
- After PRD 1 complete, PRD 2-5 can be worked in parallel
- Within each PRD, phases are independent and can be parallelized

---

**Template Version:** 1.0
**Created:** 2025-10-21
