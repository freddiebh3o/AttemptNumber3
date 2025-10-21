# Backend Test Refactoring - Master Implementation Plan

**Status:** 📋 Planning
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
**Status:** 📋 Planning
**Goal:** Build comprehensive RBAC permission tests for all 12 features

**Progress:**
- [ ] Phase 1: Products, Stock, Branches permissions (3 files)
- [ ] Phase 2: Users, Roles, Theme permissions (3 files)
- [ ] Phase 3: Uploads, Audit Logs permissions (2 files)
- [ ] Phase 4: Transfers, Templates, Approvals, Analytics permissions (4 files)

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
- Current: 227 backend tests passing
- Target: 400+ backend tests passing
- Permission coverage: 0% → 100% (all roles × all endpoints)
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

- [ ] All 39 existing tests moved to new structure and passing
- [ ] Test template document created and referenced in all new tests
- [ ] 12 permission test files created with comprehensive role coverage
- [ ] 3 new middleware test files created with >90% coverage
- [ ] 20 new feature test files created filling coverage gaps
- [ ] All tests passing: 400+ backend tests (up from 227)
- [ ] Permission coverage: 100% of endpoints × 100% of roles
- [ ] Middleware coverage: 100% of middleware functions
- [ ] Feature coverage: 100% of service functions and routes
- [ ] Documentation updated: testing SOPs reflect new structure
- [ ] Zero test flakiness (all tests deterministic and isolated)

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
