# PRD 1: Test Template & Directory Structure Setup

**Status:** ✅ Complete
**Priority:** High
**Estimated Effort:** 3-4 days
**Created:** 2025-10-21
**Last Updated:** 2025-10-21 (All phases completed)
**Completed:** 2025-10-21

---

## Overview

Establish the foundation for backend test refactoring by creating a standardized test template document, setting up the new directory structure, and migrating all 39 existing test files to their new locations with minimal refactoring.

**Key Capabilities:**
- Standardized test template as living markdown reference document
- Feature-based directory structure mirroring src/ organization
- All existing tests migrated to new locations and passing
- Clear separation between core, middleware, and feature tests

**Related Documentation:**
- [Backend Testing Guide](../../../SOP/backend-testing.md) - Current testing patterns
- [Testing Overview](../../../SOP/testing-overview.md) - Testing philosophy
- [Master PRD](./prd.md) - Overall refactoring plan

---

## Phase 1: Create Test Template Document

**Goal:** Create comprehensive markdown reference document for standardized test patterns

**Relevant Files:**
- [api-server/__tests__/TEST_TEMPLATE.md](../../../../api-server/__tests__/TEST_TEMPLATE.md) - NEW

### Documentation

- [x] Create TEST_TEMPLATE.md with three main sections
- [x] Document service test pattern (business logic testing)
- [x] Document route test pattern (HTTP layer testing)
- [x] Document permission test pattern (RBAC matrix testing)
- [x] Include describe() block naming conventions
- [x] Include test isolation patterns (testContext usage)
- [x] Include common patterns (beforeEach setup, factory usage)
- [x] Include anti-patterns to avoid (PRD phase numbers!)
- [x] Add examples from existing high-quality tests
- [x] Link from SOP/backend-testing.md

---

## Phase 2: Create New Directory Structure

**Goal:** Establish feature-based directory structure for test organization

**Relevant Files:**
- [api-server/__tests__/](../../../../api-server/__tests__/) - Directory structure changes

### Directory Creation

- [x] Create core/ directory
- [x] Create middleware/ directory (already exists, keep as-is)
- [x] Create permissions/ directory (empty for now, populated in PRD 2)
- [x] Create features/ directory with subdirectories:
  - [x] features/products/
  - [x] features/stock/
  - [x] features/branches/
  - [x] features/tenantUsers/
  - [x] features/roles/
  - [x] features/theme/
  - [x] features/uploads/
  - [x] features/auditLogs/
  - [x] features/stockTransfers/ (with subdirs: templates/, approvals/)
  - [x] features/transferAnalytics/
  - [x] features/featureFlags/
  - [x] features/chat/ (with subdir: tools/)

### Documentation

- [x] Update README.md in __tests__/ to document new structure
- [x] Add navigation guide to folder organization

---

## Phase 3: Move and Refactor Existing Tests

**Goal:** Migrate all 39 existing test files to new locations with minimal refactoring

**Status:** ✅ Complete

**Relevant Files:** (34 files moved - 32 from old structure + 2 core files)

### Core Tests (2 files)

- [x] Move auth.test.ts → core/auth.test.ts
- [x] Move health.test.ts → core/health.test.ts

### Middleware Tests (5 files - already in correct location)

- [x] Keep middleware/errorHandler.test.ts (no move needed)
- [x] Keep middleware/session.test.ts (no move needed)
- [x] Keep middleware/idempotency.test.ts (no move needed)
- [x] Keep middleware/rateLimit.test.ts (no move needed)
- [x] Keep middleware/permissions.test.ts (will be refactored in PRD 2)

### Feature: Products (4 files)

- [x] Move services/product.test.ts → features/products/productService.test.ts
- [x] Move routes/productRoutes.test.ts → features/products/productRoutes.test.ts
- [x] Move routes/product-archival-activity.test.ts → features/products/productArchival.test.ts
- [x] Move routes/barcodeRoutes.test.ts → features/products/barcodes.test.ts

### Feature: Stock (3 files)

- [x] Move services/stock.test.ts → features/stock/stockService.test.ts
- [x] Move routes/stockRoutes.test.ts → features/stock/stockRoutes.test.ts
- [x] Move services/stockLotRestoration.test.ts → features/stock/stockLotRestoration.test.ts
- [ ] Extract FIFO tests from stockService.test.ts → features/stock/fifoAlgorithm.test.ts (deferred to future refactoring)

### Feature: Branches (1 file)

- [x] Move routes/branchArchival.test.ts → features/branches/branchArchival.test.ts

### Feature: Tenant Users (2 files)

- [x] Move routes/tenantUserRoutes.test.ts → features/tenantUsers/tenantUserRoutes.test.ts
- [x] Move routes/tenant-users-archival.test.ts → features/tenantUsers/tenantUserArchival.test.ts

### Feature: Roles (1 file)

- [x] Move routes/roleArchival.test.ts → features/roles/roleArchival.test.ts

### Feature: Stock Transfers (5 files)

- [x] Move services/stockTransfers.test.ts → features/stockTransfers/transferService.test.ts
- [x] Move services/partialShipment.test.ts → features/stockTransfers/partialShipment.test.ts
- [x] Move services/transferPriority.test.ts → features/stockTransfers/transferPriority.test.ts
- [x] Move services/stockTransferTemplates.test.ts → features/stockTransfers/templates/templateService.test.ts
- [x] Move services/approvalRuleArchival.test.ts → features/stockTransfers/approvals/approvalRuleArchival.test.ts

### Feature: Transfer Analytics (1 file)

- [x] Move services/transferAnalytics.test.ts → features/transferAnalytics/analyticsService.test.ts

### Feature: Feature Flags (2 files)

- [x] Move services/tenantFeatureFlags.test.ts → features/featureFlags/featureFlagsService.test.ts
- [x] Move routes/tenantFeatureFlagsRoutes.test.ts → features/featureFlags/featureFlagsRoutes.test.ts

### Feature: Chat (13 files)

- [x] Move services/chat.test.ts → features/chat/chatService.test.ts
- [x] Move routes/chatRouter.test.ts → features/chat/chatRouter.test.ts (kept separate)
- [x] Move routes/chatRoutes.test.ts → features/chat/chatRoutes.test.ts (kept separate)
- [x] Move integration/chatIntegration.test.ts → features/chat/chatIntegration.test.ts
- [x] Move services/chat/conversationService.test.ts → features/chat/conversationService.test.ts
- [x] Move services/chat/suggestionService.test.ts → features/chat/suggestionService.test.ts
- [x] Move services/chat/analyticsService.test.ts → features/chat/analyticsService.test.ts
- [x] Move services/chat/productTools.test.ts → features/chat/tools/productTools.test.ts
- [x] Move services/chat/stockTools.test.ts → features/chat/tools/stockTools.test.ts
- [x] Move services/chat/branchTools.test.ts → features/chat/tools/branchTools.test.ts
- [x] Move services/chat/userTools.test.ts → features/chat/tools/userTools.test.ts
- [x] Move services/chat/templateTools.test.ts → features/chat/tools/templateTools.test.ts
- [x] Move services/chat/analyticsTools.test.ts → features/chat/tools/analyticsTools.test.ts

### Post-Move Refactoring

- [x] Update import paths in all moved files
- [x] Delete empty old directories (routes/, services/, integration/)
- [x] Updated scriptsList.md with new file paths
- [ ] Remove embedded permission tests from route files (deferred to PRD 2)

---

## Testing Strategy

### Test Execution

**Verification Steps:**
- Run full test suite after each phase
- Ensure all 227 existing tests still pass
- Fix any import path issues immediately
- Use git to track file moves (git mv for better history)

**Test Isolation:**
- No changes to test logic in Phase 3 (just moves)
- Import path updates only
- Preserve existing test structure and patterns

---

## Success Metrics

- [x] TEST_TEMPLATE.md created and comprehensive (covers all 3 test types)
- [x] New directory structure created (8 top-level folders, 12 feature subdirectories)
- [x] All 34 test files moved to new locations (32 from old structure + 2 core files)
- [x] Import paths updated correctly in all files
- [x] Old empty directories removed (routes/, services/, integration/)
- [x] README.md updated with new structure documentation
- [x] Git history preserved (used git mv for all moves)
- [x] scriptsList.md updated with new file paths for running individual test suites
- [ ] All tests passing after migration (pre-existing failures remain - will be fixed separately)

---

## Notes & Decisions

**Key Design Decisions:**

1. **Markdown template instead of code generator**
   - **Rationale:** Living reference document is easier to update and doesn't require tooling
   - **Alternative:** Jest template files (rejected: rigid, hard to customize per feature)

2. **Minimal refactoring during move**
   - **Rationale:** Reduce risk; separate file moves from logic changes
   - **Alternative:** Refactor while moving (rejected: too many changes at once, hard to debug)

3. **Merge chatRouter + chatRoutes tests**
   - **Rationale:** Both test the same router, unnecessary duplication
   - **Alternative:** Keep separate (rejected: causes confusion, same test coverage)

4. **Extract FIFO tests from stock service**
   - **Rationale:** FIFO algorithm is complex enough to deserve dedicated test file
   - **Alternative:** Keep in stockService.test.ts (rejected: file too large)

5. **Move permissions.test.ts to permissions/ directory**
   - **Rationale:** It's a cross-cutting RBAC test, not middleware-specific
   - **Alternative:** Keep in middleware/ (rejected: misleading location)

**Known Limitations:**
- Some tests may have hardcoded paths that break on move (fix as discovered)
- Git may not track moves perfectly if too many imports change (use git mv)
- Large git diff may be hard to review (split into logical commits per feature)

**Future Enhancements (Out of Scope):**
- Automated import path fixing tool
- Lint rule to enforce test file naming conventions
- Pre-commit hook to ensure tests in correct directory
- Extract FIFO algorithm tests into separate file (deferred)
- Merge chatRouter and chatRoutes test files (deferred)

---

## Completion Summary

**Date Completed:** 2025-10-21

**What Was Accomplished:**
1. ✅ Created comprehensive TEST_TEMPLATE.md with service, route, and permission test patterns
2. ✅ Established feature-based directory structure with 8 top-level folders and 12 feature subdirectories
3. ✅ Migrated all 34 test files from old structure (routes/, services/, integration/) to new feature-based locations
4. ✅ Updated all import paths to reflect new locations (from `../` to `../../` or `../../../`)
5. ✅ Used `git mv` for all file moves to preserve git history
6. ✅ Deleted empty old directories (routes/, services/, integration/)
7. ✅ Updated [README.md](../../../../api-server/__tests__/README.md) with new directory navigation guide
8. ✅ Updated [scriptsList.md](../../../../api-server/__tests__/scriptsList.md) with commands for running individual test suites

**Test Results:**
- Same test pass/fail rate as before refactoring (test failures are pre-existing)
- No tests were broken by the file moves or import path updates
- Test failures to be addressed in separate debugging session

**Next Steps:**
- Continue with PRD 2 (Permission Test Suite) to add comprehensive RBAC coverage
- Address pre-existing test failures in separate debugging session
- Consider extracting FIFO tests and merging chat route tests in future refactoring

---

**Template Version:** 1.0
**Created:** 2025-10-21
**Completed:** 2025-10-21
