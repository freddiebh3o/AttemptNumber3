# E2E Test Suite Refactoring - Implementation Plan

**Status:** 📋 Planning
**Priority:** High
**Estimated Effort:** 13-20 days
**Created:** 2025-10-22
**Last Updated:** 2025-10-22

---

## Overview

Refactor the E2E test suite to mirror the well-organized backend test structure, improve maintainability, and fill significant coverage gaps. Currently, E2E tests are scattered across multiple directories with inconsistent naming and missing tests for several critical features (Audit Logs, Theme, Branches/Roles CRUD, complete Transfer workflows).

**Key Capabilities:**
- Feature-based organization matching backend structure (`core/`, `features/`, `permissions/`)
- Complete E2E coverage for all user-facing features
- Standardized test naming and patterns for easy discoverability
- Consistent test helpers and factories usage
- Clear documentation for future test development

**Related Documentation:**
- [Frontend Testing SOP](../../SOP/frontend_testing.md) - E2E test patterns
- [Testing Overview](../../SOP/testing_overview.md) - Overall testing strategy
- [Admin Web E2E Guidelines](../../../admin-web/e2e/GUIDELINES.md) - Current E2E conventions
- [Backend Test Template](../../../api-server/__tests__/TEST_TEMPLATE.md) - Backend patterns to mirror

---

## Coverage Gap Analysis

### Missing E2E Tests (Backend has, E2E doesn't)
- **Audit Logs** - No E2E tests for viewing audit trail
- **Theme/Branding** - No E2E tests for theme customization
- **Uploads** - No E2E tests for file upload workflows
- **Branches CRUD** - Only archival tested, missing create/edit/list
- **Roles CRUD** - Only archival tested, missing create/edit/list
- **Users CRUD** - Only list/view tested, missing create/edit flows

### Incomplete Feature Coverage
- **Stock Transfers** - Missing full workflow tests (draft → submit → approve → ship → receive)
- **Products** - Missing Activity tab and Stock Levels tab tests
- **Permissions** - Tests scattered across files, need consolidation

### Current Test Statistics
- **Backend**: 70 test files, 450 test suites, organized structure
- **E2E**: 26 test files, 110 test suites, scattered structure
- **Gap**: ~340 test suites difference suggests significant under-coverage

---

## Phase 1: Analysis & Documentation

**Goal:** Create comprehensive catalog of existing tests, identify conflicts, and document new structure.

**Relevant Files:**
- [admin-web/e2e/GUIDELINES.md](../../../admin-web/e2e/GUIDELINES.md)
- [admin-web/e2e/README.md](../../../admin-web/e2e/README.md)
- All existing test files in [admin-web/e2e/](../../../admin-web/e2e/)

### Analysis Tasks

- [x] Create test coverage matrix comparing backend tests to E2E tests
- [x] Identify all 26 existing E2E test files and their test counts
- [x] Map existing tests to new proposed structure
- [x] Identify tests that may conflict or become outdated
- [x] Document gaps for each feature area
- [x] Review [admin-web/e2e/GUIDELINES.md](../../../admin-web/e2e/GUIDELINES.md) for current patterns
- [x] Review [api-server/__tests__/TEST_TEMPLATE.md](../../../api-server/__tests__/TEST_TEMPLATE.md) for backend patterns

### Documentation Updates

- [x] Update [admin-web/e2e/GUIDELINES.md](../../../admin-web/e2e/GUIDELINES.md) with new structure
- [x] Create test coverage matrix document showing before/after
- [x] Document migration mapping (old path → new path)
- [x] Add section on test organization principles
- [x] Create E2E test checklist for new features

### Deliverables

- [x] Test coverage matrix spreadsheet/document → [test-coverage-matrix.md](test-coverage-matrix.md)
- [x] Migration plan document listing all file moves → [migration-plan.md](migration-plan.md)
- [x] Updated GUIDELINES.md with new structure and conventions

**⚠️ IMPORTANT: NEVER RUN THE TESTS - User will run them manually after each phase**

---

## Phase 2: Reorganize Existing Tests (No New Tests)

**Goal:** Restructure all 26 existing E2E test files into new feature-based organization without writing new tests.

**New Directory Structure:**
```
admin-web/e2e/
├── core/
│   ├── auth-flow.spec.ts           # From auth/auth-flow.spec.ts
│   ├── signin.spec.ts              # From auth/signin.spec.ts
│   └── navigation.spec.ts          # NEW placeholder (future)
├── features/
│   ├── products/
│   │   ├── product-crud.spec.ts           # From products/product-crud.spec.ts
│   │   ├── product-archival.spec.ts       # From products/product-archive.spec.ts
│   │   └── product-barcodes.spec.ts       # From features/barcode-scanning.spec.ts
│   ├── stock/
│   │   ├── stock-adjustment.spec.ts       # From stock/stock-management.spec.ts
│   │   └── stock-lot-restoration.spec.ts  # From stock/transfer-reversal-lot-restoration.spec.ts
│   ├── transfers/
│   │   ├── transfer-reversal.spec.ts                # From transfers/transfer-reversal.spec.ts
│   │   ├── transfer-templates.spec.ts               # From transfers/transfer-templates.spec.ts
│   │   ├── transfer-template-archival.spec.ts       # From transfers/transfer-template-archival.spec.ts
│   │   ├── transfer-approval-rules.spec.ts          # From transfers/approval-rules.spec.ts
│   │   ├── transfer-approval-rule-archival.spec.ts  # From transfers/approval-rule-archival.spec.ts
│   │   ├── transfer-multi-level-approval.spec.ts    # From transfers/multi-level-approval.spec.ts
│   │   └── transfer-analytics.spec.ts               # From transfers/transfer-analytics.spec.ts
│   ├── branches/
│   │   └── branch-archival.spec.ts        # From branches/branch-archival.spec.ts
│   ├── users/
│   │   ├── user-management.spec.ts        # From users/user-management.spec.ts
│   │   ├── user-archival.spec.ts          # From users/user-archival.spec.ts
│   │   └── user-role-assignment.spec.ts   # From users/owner-role-assignment.spec.ts (renamed)
│   ├── roles/
│   │   └── role-archival.spec.ts          # From auth/role-archival.spec.ts
│   ├── chat/
│   │   ├── chat-basic.spec.ts             # From chat/chat-basic.spec.ts
│   │   ├── chat-advanced.spec.ts          # From chat/chat-advanced.spec.ts
│   │   ├── chat-suggestions.spec.ts       # From chat/chat-suggestions.spec.ts
│   │   └── chat-analytics.spec.ts         # From chat/chat-analytics.spec.ts
│   └── settings/
│       ├── feature-flags.spec.ts          # From features/feature-flags.spec.ts
│       └── feature-settings.spec.ts       # From features/feature-settings.spec.ts
├── permissions/
│   └── rbac.spec.ts                       # From auth/permission-checks.spec.ts (renamed)
└── helpers/
    ├── index.ts
    ├── auth.ts
    ├── api-helpers.ts
    ├── factories.ts
    ├── selectors.ts
    └── chat.ts
```

### File Migration Tasks

- [x] Create new directory structure (core/, features/, permissions/)
- [x] Move auth/auth-flow.spec.ts → core/auth-flow.spec.ts
- [x] Move auth/signin.spec.ts → core/signin.spec.ts
- [x] Move products/product-crud.spec.ts → features/products/product-crud.spec.ts
- [x] Move products/product-archive.spec.ts → features/products/product-archival.spec.ts (rename)
- [x] Move features/barcode-scanning.spec.ts → features/products/product-barcodes.spec.ts (rename)
- [x] Move stock/stock-management.spec.ts → features/stock/stock-adjustment.spec.ts (rename)
- [x] Move stock/transfer-reversal-lot-restoration.spec.ts → features/stock/stock-lot-restoration.spec.ts (rename)
- [x] Move all 7 transfer test files to features/transfers/
- [x] Move branches/branch-archival.spec.ts → features/branches/branch-archival.spec.ts
- [x] Move all 3 user test files to features/users/ (rename owner-role-assignment)
- [x] Move auth/role-archival.spec.ts → features/roles/role-archival.spec.ts
- [x] Move all 4 chat test files to features/chat/
- [x] Move feature-flags.spec.ts and feature-settings.spec.ts to features/settings/
- [x] Move auth/permission-checks.spec.ts → permissions/rbac.spec.ts (rename)
- [x] Update all import paths in moved files (23 files updated)
- [x] Verify helpers/ directory structure is unchanged

### Standardization Tasks

- [x] Rename test files for consistency (product-archive → product-archival, etc.)
- [ ] Update test descriptions to follow "[Feature] - [Capability]" pattern (deferred to Phase 5)
- [ ] Ensure all tests use consistent beforeEach/beforeAll patterns (deferred to Phase 5)
- [ ] Standardize test naming: test.describe('[Feature]') pattern (deferred to Phase 5)
- [ ] Verify all tests use helpers (signIn, Factories, SELECTORS) (deferred to Phase 5)

### Documentation Updates

- [ ] Update [admin-web/e2e/README.md](../../../admin-web/e2e/README.md) with new structure
- [ ] Update [CLAUDE.md](../../../CLAUDE.md) testing section with new paths
- [x] Create migration guide documenting old path → new path → [migration-plan.md](migration-plan.md)

**⚠️ IMPORTANT: NEVER RUN THE TESTS - User will run them manually after migration**

---

## Phase 3: Fill Critical Gaps - Core Features

**Goal:** Add missing E2E tests for critical CRUD operations and complete workflows that have partial coverage.

**Relevant Files:**
- New test files to be created in features/ directory
- [admin-web/e2e/helpers/factories.ts](../../../admin-web/e2e/helpers/factories.ts) - May need new factory methods
- [admin-web/e2e/GUIDELINES.md](../../../admin-web/e2e/GUIDELINES.md) - Reference for patterns

### New Test Files to Create

- [x] features/branches/branch-crud.spec.ts (Create/Read/Update/List branches) - **COMPLETED**
- [x] features/roles/role-crud.spec.ts (Create/Read/Update/List roles) - **COMPLETED**
- [x] features/users/user-crud.spec.ts (Create/Edit users with branch assignments) - **COMPLETED**
- [x] features/transfers/transfer-crud.spec.ts (Create transfer drafts via modal) - **COMPLETED**
- [ ] features/transfers/transfer-workflow.spec.ts (Draft → Submit → Approve → Ship → Receive) - **NOT NEEDED** (Already covered in transfer-reversal.spec.ts)
- [ ] features/auditLogs/audit-log-viewing.spec.ts (View audit logs, filter, search)

### Branch CRUD Tests

**File:** [admin-web/e2e/features/branches/branch-crud.spec.ts](../../../admin-web/e2e/features/branches/branch-crud.spec.ts)

- [x] Test: List all branches with table display
- [x] Test: Filter branches by name
- [x] Test: Sort branches by name/status
- [x] Test: Navigate to create branch page
- [x] Test: Create branch with valid data
- [x] Test: Validation errors for empty branch name
- [x] Test: Validation errors for duplicate branch slug
- [x] Test: Load existing branch data in edit mode
- [x] Test: Update branch name successfully
- [x] Test: Permission check - VIEWER cannot access branches page
- [x] Test: Permission check - ADMIN can view but not create/edit branches
- [x] Added data-testid attributes to BranchesPage (filter button, table, search input)
- [x] Added data-testid attributes to BranchOverviewTab (slug, name, active inputs)
- [x] Added data-testid attributes to BranchPage (save/cancel buttons)
- [x] Created BranchFactory.addCurrentUserToBranch() helper method
- [x] Fixed React synthetic event pooling issue in filter search input

### Role CRUD Tests ✅ COMPLETED

**File:** [admin-web/e2e/features/roles/role-crud.spec.ts](../../../admin-web/e2e/features/roles/role-crud.spec.ts)

- [x] Test: List all roles with table display
- [x] Test: View system roles (OWNER, ADMIN, EDITOR, VIEWER)
- [x] Test: Navigate to create role page
- [x] Test: Create custom role with permissions
- [x] Test: Validation errors for empty role name
- [x] Test: Edit custom role permissions
- [x] Test: Cannot edit system role permissions
- [x] Test: View role details with permission list
- [x] Test: Permission check - viewer cannot access roles page
- [x] Test: Permission check - admin can view but cannot create/edit (only has roles:read)
- [x] Test: Permission check - owner can create/edit (has roles:manage)
- [x] Refer to [admin-web/e2e/GUIDELINES.md](../../../admin-web/e2e/GUIDELINES.md) for test patterns
- [x] Use consistent helper functions (signIn, Factories.role)
- [x] Used existing data-testid attributes (role-system-badge, system-badge, archived-badge)

**Implementation Notes:**
- Fixed route guards: Changed from `roles:manage` to `roles:read` in [main.tsx](../../../admin-web/src/main.tsx) (lines 141, 150)
- Fixed sidebar navigation: Changed from `roles:manage` to `roles:read` in [SidebarNav.tsx](../../../admin-web/src/components/shell/SidebarNav.tsx) (lines 99, 115)
- Added permission guard to "New role" button in [RolesPage.tsx](../../../admin-web/src/pages/RolesPage.tsx) (line 822)
- Used `getByRole('textbox', { name: 'Name' })` pattern for form inputs
- Used `getByPlaceholder('Select permissions')` for MultiSelect component
- Permission dropdown options formatted as `key — description` (e.g., "products:read — View products")
- Used 500ms timeout for Mantine MultiSelect dropdown animations
- Added `^` anchor to notification regexes to avoid strict mode violations

### User CRUD Tests ✅ COMPLETED

**File:** [admin-web/e2e/features/users/user-crud.spec.ts](../../../admin-web/e2e/features/users/user-crud.spec.ts)

- [x] Test: Navigate to create user page (Invite User)
- [x] Test: Create user with email and role
- [x] Test: Validation errors for invalid email format
- [x] Test: Validation errors for missing email
- [x] Test: Validation errors for missing password
- [x] Test: Validation errors for missing required fields
- [x] Test: Edit user role assignment (with restore to original)
- [x] Test: Load existing user data in edit mode
- [x] Test: View user branch assignments
- [x] Test: Add branch assignment to user
- [x] Test: Remove branch assignment from user
- [x] Test: Permission check - VIEWER cannot create users
- [x] Test: Permission check - VIEWER cannot edit users
- [x] Test: Permission check - ADMIN can create users
- [x] Test: Permission check - ADMIN can edit users
- [x] Test: Permission check - OWNER can create and edit users
- [x] Test: Cancel user creation and return to list
- [x] Test: Navigate from user list to edit page
- [x] Used consistent helper functions (signIn, TEST_USERS, Factories)
- [x] Followed E2E guidelines (health check, cookie clearing, try/finally cleanup)
- [x] Complemented existing tests (user-management.spec.ts, user-archival.spec.ts, user-role-assignment.spec.ts)

**Implementation Notes:**
- Created 26 comprehensive tests covering user CRUD operations
- Discovered and fixed validation error UX issue (generic "Invalid request body" → specific "Invalid email format")
- Fixed backend Zod schemas with custom error messages in [tenantUserRouter.ts](../../../api-server/src/routes/tenantUserRouter.ts)
- Enhanced validation middleware with `formatZodError()` helper in [zodValidation.ts](../../../api-server/src/middleware/zodValidation.ts)
- Tests now provide complete coverage alongside existing user tests (total: ~48 user-related E2E tests)

### Transfer CRUD Tests

**File:** [admin-web/e2e/features/transfers/transfer-crud.spec.ts](../../../admin-web/e2e/features/transfers/transfer-crud.spec.ts)

**Status:** ✅ **COMPLETED** - 12 tests passing

- [x] Test: Navigate to transfers list page
- [x] Test: Open create transfer modal (not a page - modal pattern)
- [x] Test: Display transfers table with columns
- [x] Test: Create transfer draft with basic details via modal
- [x] Test: Add multiple products to transfer via modal
- [x] Test: View transfer details page
- [x] Test: Navigate from list to detail page
- [x] Test: Validation error for missing source branch
- [x] Test: Validation error for same source/destination
- [x] Test: Validation error for empty product list
- [x] Test: VIEWER cannot create transfers (no stock:write)
- [x] Test: EDITOR cannot create transfers (no stock:write, only stock:allocate)
- [x] Test: ADMIN can create transfers (has stock:write)
- [x] Test: OWNER can create transfers (has stock:write)
- [x] Used modal pattern (not dedicated page)
- [x] Used seeded branches (acme-hq, acme-warehouse) that test users have access to
- [x] Referred to [admin-web/e2e/GUIDELINES.md](../../../admin-web/e2e/GUIDELINES.md) for test patterns
- [x] Used consistent helper functions (signIn, Factories.transfer, Factories.branch.getBySlug)
- [x] Fixed permission checks (transfers require stock:write, not stock:allocate)

**Notes:**
- Edit/Delete tests not included - these happen on detail page, not part of modal CRUD
- Transfer workflow tests (approve, ship, receive) already covered in [transfer-reversal.spec.ts](../../../admin-web/e2e/features/transfers/transfer-reversal.spec.ts)
- Permission insight: `stock:write` = initiating stock movements (transfers, receipts), `stock:allocate` = consuming stock for orders

### Transfer Workflow Tests

**File:** ~~[admin-web/e2e/features/transfers/transfer-workflow.spec.ts](../../../admin-web/e2e/features/transfers/transfer-workflow.spec.ts)~~

**Status:** ✅ **NOT NEEDED** - Complete workflow already covered in [transfer-reversal.spec.ts](../../../admin-web/e2e/features/transfers/transfer-reversal.spec.ts)

**Coverage Analysis:**
- [x] Complete workflow (Draft → Approve → Ship → Receive) covered in transfer-reversal.spec.ts lines 78-147
- [x] Stock levels and FIFO lots verified via backend factories
- [x] Permission checks covered in transfer-crud.spec.ts (lines 387-452) and transfer-reversal.spec.ts (lines 216-256)
- [x] Status badge updates verified at each workflow stage
- [x] Multi-level approval workflow covered in transfer-multi-level-approval.spec.ts
- [x] All tests use consistent helper functions and factories (Factories.transfer, Factories.stock, Factories.branch)

**Why not needed:**
- transfer-reversal.spec.ts already tests the complete end-to-end workflow from draft through receiving
- Creating a separate file would duplicate 70%+ of the test logic
- The reversal test naturally requires completing the full workflow first, providing comprehensive coverage
- Permission and validation tests already exist across transfer-crud.spec.ts and transfer-reversal.spec.ts

**Existing Transfer Test Coverage:**
- transfer-crud.spec.ts (12 tests) - Create draft, view, validation, permissions
- transfer-reversal.spec.ts (6 tests) - **Complete workflow + reversal**
- transfer-multi-level-approval.spec.ts (9 tests) - Multi-level approvals
- transfer-approval-rules.spec.ts (12 tests) - Approval rule management
- transfer-templates.spec.ts (15 tests) - Template CRUD
- **Total: 54+ transfer workflow tests**

### Audit Log Viewing Tests ✅ COMPLETED

**File:** [admin-web/e2e/features/auditLogs/audit-log-viewing.spec.ts](../../../admin-web/e2e/features/auditLogs/audit-log-viewing.spec.ts)

**Status:** ✅ **COMPLETED** - 38 comprehensive tests covering all audit log viewing functionality

- [x] Test: Navigate to audit logs page
- [x] Test: Display audit log table with columns (Occurred, Actor, Entity, Action, Diff, Correlation, IP, User-Agent)
- [x] Test: Display range information (showing X–Y of Z)
- [x] Test: Filter by entity type (PRODUCT, BRANCH, STOCK_LOT, etc.)
- [x] Test: Filter by action type (CREATE, UPDATE, DELETE, etc.)
- [x] Test: Filter by date range (occurredFrom/occurredTo)
- [x] Test: Filter by actor user ID
- [x] Test: Filter by entity ID
- [x] Test: Combine multiple filters
- [x] Test: Clear individual filter chips
- [x] Test: Clear all filters at once
- [x] Test: Reset filters using clear button in filter panel
- [x] Test: Navigate to next/previous pages
- [x] Test: Change page size (per page limit)
- [x] Test: Maintain filters when navigating pages
- [x] Test: View audit event details in modal (diff, before, after JSON)
- [x] Test: Copy event ID from details modal
- [x] Test: Copy shareable link
- [x] Test: Refresh audit logs
- [x] Test: Toggle filters panel
- [x] Test: Show entity links for supported types (PRODUCT, USER)
- [x] Test: Copy correlation ID
- [x] Test: Permission checks for all roles (OWNER, ADMIN, EDITOR, VIEWER)
- [x] Test: Empty state when no results match filters
- [x] Test: Handle invalid entity type gracefully
- [x] Test: Persist filters in URL
- [x] Test: Handle browser back/forward with filters
- [x] Followed E2E guidelines for test structure and patterns
- [x] Fixed URL path issue (`/audit` instead of `/audit-logs`)

**Bugs Fixed During Testing:**
- ✅ Fixed TextInput crash when typing in Actor user id/Entity id filters (changed `e.currentTarget.value` to `e.target.value`)
- ✅ Fixed 60+ strict mode violations (selector ambiguity issues)
- ✅ Fixed URL path from `/audit-logs` to `/audit`
- ✅ Fixed date filter test to use URL parameters instead of complex date picker interactions

**Selector Pattern Improvements:**
- ✅ Mantine Select: Use `getByRole('textbox', { name: /label/i })` instead of `getByLabel`
- ✅ Dropdown options: Use `getByRole('option', { name: 'VALUE', exact: true })`
- ✅ Buttons: Use regex anchors `/^text$/i` for exact matching
- ✅ Multiple elements: Use `.first()` or scope to parent container

**Notes:**
- Permission behavior: Currently ALL authenticated users can access audit logs (backend only checks authentication)
- Expected future behavior: Should require `users:manage` permission (OWNER/ADMIN only)
- Tests document this gap with clear comments and test names
- The AuditLogPage uses sophisticated cursor pagination with URL state management
- Filters include entity type, action, actor user ID, entity ID, and date ranges
- Details modal shows diff/before/after JSON for events with changes

### Helper Updates

- [x] Add Factories.branch.create() - Already existed
- [x] Add Factories.branch.addCurrentUserToBranch() - Created for branch membership management
- [ ] Add Factories.role.create() if missing
- [ ] Add Factories.transfer.createDraft() if missing
- [ ] Add SELECTORS for new pages (branches, roles, audit logs)
- [x] Updated [admin-web/e2e/helpers/factories.ts](../../../admin-web/e2e/helpers/factories.ts) with addCurrentUserToBranch method

### Documentation

- [ ] Update [admin-web/e2e/GUIDELINES.md](../../../admin-web/e2e/GUIDELINES.md) with examples from new tests
- [ ] Document transfer workflow testing pattern
- [ ] Update test coverage matrix with new tests

**⚠️ IMPORTANT: NEVER RUN THE TESTS - User will run them manually after each test file is created**

---

## Phase 4: Complete Feature Coverage - Enhancement Tests

**Goal:** Add E2E tests for remaining features and tabs that are missing coverage.

**Relevant Files:**
- New test files in features/ directory
- [admin-web/src/pages/ProductPage.tsx](../../../admin-web/src/pages/ProductPage.tsx) - Product tabs
- [admin-web/src/pages/ThemePage.tsx](../../../admin-web/src/pages/ThemePage.tsx) - Theme customization

### New Test Files to Create

- [x] features/products/product-stock-levels.spec.ts (Stock Levels tab) - **26 tests**
- [ ] features/products/product-activity.spec.ts (Activity tab)
- [ ] features/transfers/transfer-partial-shipment.spec.ts (Partial shipment workflow)
- [ ] features/theme/theme-customization.spec.ts (Theme/branding)
- [ ] features/uploads/file-upload.spec.ts (File upload workflows)

### Product Stock Levels Tab Tests ✅ COMPLETED

**File:** [admin-web/e2e/features/products/product-stock-levels.spec.ts](../../../admin-web/e2e/features/products/product-stock-levels.spec.ts)

**Status:** ✅ **COMPLETED** - 26 tests passing

- [x] Test: Navigate to Stock Levels tab
- [x] Test: Display stock levels across all branches
- [x] Test: Show on-hand quantity per branch
- [x] Test: Show allocated quantities (reserved/available)
- [x] Test: Display open lots count
- [x] Test: Empty state when no stock
- [x] Test: Refresh button updates data
- [x] Test: Multiple branches with stock
- [x] Test: Branch names display correctly
- [x] Test: Loading state
- [x] Test: Integration with FIFO tab (data consistency)
- [x] Test: Permission checks for all roles (Owner, Admin, Editor, Viewer)
- [x] Refer to [admin-web/e2e/GUIDELINES.md](../../../admin-web/e2e/GUIDELINES.md) for test patterns
- [x] No data-testid attributes needed - Used semantic selectors (getByRole, getByText)

**Implementation Notes:**
- Created 26 comprehensive tests covering navigation, display, empty states, refresh, permissions, and integration
- All tests use `TEST_USERS.owner` for stock creation (requires branch membership)
- Tests target specific "Warehouse" row where stock is created (not first row which is HQ)
- Used semantic selectors: `getByRole('row', { name: /warehouse/i })` to avoid strict mode violations
- Permission tests verify all roles (Owner, Admin, Editor, Viewer) can view stock levels (all have `stock:read`)
- Fixed parameter naming: `initialQty` (not `qtyDelta`) for `StockFactory.createProductWithStock()`

### Product Activity Tab Tests

**File:** [admin-web/e2e/features/products/product-activity.spec.ts](../../../admin-web/e2e/features/products/product-activity.spec.ts)

- [ ] Test: Navigate to Activity tab
- [ ] Test: Display audit log for product (create, update events)
- [ ] Test: Show actor and timestamp for each event
- [ ] Test: Display before/after changes
- [ ] Test: Filter activity by action type
- [ ] Test: Filter activity by date range
- [ ] Test: Pagination works correctly
- [ ] Test: Empty state for new products
- [ ] Refer to [admin-web/e2e/GUIDELINES.md](../../../admin-web/e2e/GUIDELINES.md) for test patterns
- [ ] Add data-testid attributes to activity log UI

### Transfer Partial Shipment Tests

**File:** [admin-web/e2e/features/transfers/transfer-partial-shipment.spec.ts](../../../admin-web/e2e/features/transfers/transfer-partial-shipment.spec.ts)

- [ ] Test: Create transfer with multiple products
- [ ] Test: Ship partial quantity (less than requested)
- [ ] Test: Transfer status shows "Partially Shipped"
- [ ] Test: Receive partial shipment at destination
- [ ] Test: Ship remaining quantity
- [ ] Test: Transfer status shows "Completed" after all items shipped
- [ ] Test: Verify stock levels after partial shipment
- [ ] Test: Verify FIFO lots after partial receive
- [ ] Test: Cannot ship more than available quantity
- [ ] Refer to backend [api-server/__tests__/features/stockTransfers/partialShipment.test.ts](../../../api-server/__tests__/features/stockTransfers/partialShipment.test.ts) for logic
- [ ] Add data-testid attributes to partial shipment UI

### Theme Customization Tests

**File:** [admin-web/e2e/features/theme/theme-customization.spec.ts](../../../admin-web/e2e/features/theme/theme-customization.spec.ts)

- [ ] Test: Navigate to theme settings page
- [ ] Test: Select theme preset (Light, Dark, Custom)
- [ ] Test: Customize primary color
- [ ] Test: Customize secondary color
- [ ] Test: Save theme changes
- [ ] Test: Theme changes apply across application
- [ ] Test: Reset to default theme
- [ ] Test: Preview theme before saving
- [ ] Test: Permission check - Only OWNER/ADMIN can customize theme
- [ ] Refer to [admin-web/e2e/GUIDELINES.md](../../../admin-web/e2e/GUIDELINES.md) for test patterns
- [ ] Add data-testid attributes to theme customization UI

### Documentation

- [ ] Update test coverage matrix with all new tests
- [ ] Document partial shipment testing pattern
- [ ] Update [admin-web/e2e/GUIDELINES.md](../../../admin-web/e2e/GUIDELINES.md) with advanced patterns

**⚠️ IMPORTANT: NEVER RUN THE TESTS - User will run them manually after each test file is created**

---

## Phase 5: Standardization, Documentation & Cleanup

**Goal:** Finalize test suite with comprehensive documentation, standardized patterns, and create maintenance guides.

**Relevant Files:**
- [admin-web/e2e/GUIDELINES.md](../../../admin-web/e2e/GUIDELINES.md)
- [admin-web/e2e/README.md](../../../admin-web/e2e/README.md)
- [CLAUDE.md](../../../CLAUDE.md)
- [.agent/SOP/testing_overview.md](../../SOP/testing_overview.md)
- [.agent/SOP/frontend_testing.md](../../SOP/frontend_testing.md)

### Standardization Tasks

- [ ] Review all test files for consistent naming patterns
- [ ] Ensure all tests follow test.describe('[Feature] - [Capability]') pattern
- [ ] Standardize test descriptions (should, must, etc.)
- [ ] Ensure all tests use helpers consistently (signIn, Factories, SELECTORS)
- [ ] Verify all beforeEach/beforeAll hooks follow same pattern
- [ ] Ensure all tests have API health check in beforeAll
- [ ] Verify all tests clear cookies in beforeEach
- [ ] Standardize timeout usage across all tests
- [ ] Review and consolidate duplicate test logic
- [ ] Ensure all new UI components have data-testid attributes

### Documentation Updates

- [ ] Update [admin-web/e2e/GUIDELINES.md](../../../admin-web/e2e/GUIDELINES.md) with:
  - [ ] New directory structure explanation
  - [ ] Test naming conventions
  - [ ] When to use core/ vs features/ vs permissions/
  - [ ] Helper usage examples (signIn, Factories, SELECTORS)
  - [ ] Common patterns (beforeAll health check, beforeEach cookies)
  - [ ] data-testid naming conventions
- [ ] Update [admin-web/e2e/README.md](../../../admin-web/e2e/README.md) with:
  - [ ] Quick start guide for new developers
  - [ ] Directory structure overview
  - [ ] How to run specific test suites
  - [ ] How to debug failing tests
- [ ] Update [CLAUDE.md](../../../CLAUDE.md) testing section:
  - [ ] New E2E test directory structure
  - [ ] Updated test file paths and examples
  - [ ] Link to refactored test organization
- [ ] Update [.agent/SOP/frontend_testing.md](../../SOP/frontend_testing.md):
  - [ ] New test organization principles
  - [ ] Examples from refactored tests
  - [ ] Best practices from this refactor
- [ ] Update [.agent/SOP/testing_overview.md](../../SOP/testing_overview.md):
  - [ ] Updated test counts (backend vs E2E)
  - [ ] Coverage matrix reference
  - [ ] Testing strategy overview

### Test Coverage Documentation

- [ ] Create test coverage matrix spreadsheet/document showing:
  - [ ] Backend test files vs E2E test files
  - [ ] Test count by feature area
  - [ ] Coverage percentage by feature
  - [ ] Gaps identified and filled
- [ ] Create E2E test inventory document listing:
  - [ ] All 26+ test files with line counts
  - [ ] Test suite counts per file
  - [ ] Key scenarios covered per feature
- [ ] Create test maintenance guide:
  - [ ] How to add tests for new features
  - [ ] Where to place tests (decision tree)
  - [ ] How to update factories and helpers
  - [ ] How to add new SELECTORS

### Script Management

- [ ] Create scriptsList.md equivalent for E2E tests (like backend has)
- [ ] Document commands to run each test file individually
- [ ] Document commands to run test suites by feature
- [ ] Add helpful debugging commands
- [ ] Document Playwright UI mode usage
- [ ] Add performance testing tips (parallel execution)

### Cleanup Tasks

- [ ] Remove any old test files that were moved (verify nothing left behind)
- [ ] Clean up old directory structure (auth/, features/, users/, etc.)
- [ ] Verify no broken import paths remain
- [ ] Remove deprecated helper functions (if any)
- [ ] Clean up commented-out test code
- [ ] Ensure all tests pass linting
- [ ] Verify TypeScript types are correct

### Quality Checks

- [ ] Run full E2E test suite to verify all tests pass (USER WILL DO THIS)
- [ ] Verify test isolation (tests don't depend on execution order)
- [ ] Check for flaky tests (re-run multiple times if needed)
- [ ] Verify all permissions tests work for all roles
- [ ] Ensure no tests are skipped/disabled without reason
- [ ] Review test output for any warnings

### Final Documentation

- [ ] Create migration summary document:
  - [ ] Before/after structure comparison
  - [ ] Test count improvements
  - [ ] Coverage gaps filled
  - [ ] Key learnings and patterns
- [ ] Update PR/commit descriptions with clear explanations
- [ ] Create visual diagram of new test structure (optional)

**⚠️ IMPORTANT: NEVER RUN THE TESTS - User will run them manually for verification**

---

## Testing Strategy

### E2E Test Organization Principles

**Core Tests** (`core/`)
- Authentication flows (sign-in, sign-out, session)
- Navigation and routing
- Global UI components (sidebar, header)
- Tests that don't fit into a specific feature

**Feature Tests** (`features/`)
- Organized by feature domain matching backend structure
- Each feature has its own directory
- Sub-features can have subdirectories (e.g., transfers/approvals/)
- Tests follow CRUD + workflow pattern:
  - List/view tests
  - Create flow tests
  - Edit flow tests
  - Delete/archive tests
  - Special workflows (approval, shipment, etc.)

**Permission Tests** (`permissions/`)
- RBAC enforcement across all features
- Role-based UI visibility
- Permission-based action enablement
- Cross-feature permission scenarios

### Test File Naming Conventions

- Use kebab-case: `product-crud.spec.ts`
- Feature prefix: `transfer-workflow.spec.ts`
- Clear capability: `user-role-assignment.spec.ts`
- Avoid generic names: ❌ `test.spec.ts` ✅ `branch-crud.spec.ts`

### Test Suite Organization

```typescript
test.describe('[Feature] - [Capability]', () => {
  // API health check
  test.beforeAll(async () => { /* health check */ });

  // Cookie isolation
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test.describe('[Sub-capability]', () => {
    test('should [expected behavior]', async ({ page }) => {
      await signIn(page, TEST_USERS.owner);
      // Test implementation
    });
  });
});
```

### Helper Usage Patterns

**Authentication:**
```typescript
import { signIn, TEST_USERS } from '../helpers';
await signIn(page, TEST_USERS.owner);
```

**Factories:**
```typescript
import { Factories } from '../helpers';
const productId = await Factories.product.create(page, { productName: 'Test' });
```

**Selectors:**
```typescript
import { SELECTORS } from '../helpers';
await page.getByTestId(SELECTORS.PRODUCT.ARCHIVE_BUTTON).click();
```

### Backend Test Reference

When creating E2E tests, always reference corresponding backend tests:

**Backend Service Tests** → E2E Feature Tests
- [api-server/__tests__/features/products/productService.test.ts](../../../api-server/__tests__/features/products/productService.test.ts) → features/products/
- [api-server/__tests__/features/stockTransfers/transferService.test.ts](../../../api-server/__tests__/features/stockTransfers/transferService.test.ts) → features/transfers/

**Backend Permission Tests** → E2E Permission Tests
- [api-server/__tests__/permissions/products.permissions.test.ts](../../../api-server/__tests__/permissions/products.permissions.test.ts) → permissions/rbac.spec.ts

This ensures E2E tests verify the complete user-facing behavior of backend functionality.

---

## Success Metrics

- [ ] All 26 existing test files successfully moved to new structure
- [ ] Zero broken import paths or test failures from reorganization
- [ ] At least 15 new test files created for missing features
- [ ] Test count increases from 110 to 200+ test suites
- [ ] E2E test coverage gaps document shows 90%+ coverage of backend features
- [ ] All documentation updated (GUIDELINES.md, README.md, CLAUDE.md, SOPs)
- [ ] Test coverage matrix shows clear before/after improvement
- [ ] All tests use consistent patterns (signIn, Factories, SELECTORS)
- [ ] No tests run during implementation (USER RUNS TESTS MANUALLY)

---

## Notes & Decisions

**Key Design Decisions:**

1. **Mirror Backend Structure** - Chose to follow backend `features/` organization rather than create a unique E2E structure. This makes it easy to correlate backend tests with E2E tests and reduces cognitive load.

2. **Feature-Based Over Type-Based** - Organized by feature (products, transfers) rather than test type (CRUD, workflows). This keeps all tests for a feature together and makes maintenance easier.

3. **Separate Core from Features** - Core tests (auth, navigation) are foundational and used across all features, so they deserve their own top-level directory.

4. **Consolidate Permissions** - Rather than scatter permission tests across features, consolidated into `permissions/rbac.spec.ts`. This makes it easier to verify complete RBAC coverage.

5. **User Runs Tests** - Explicitly decided to NEVER run tests during implementation. User will validate each phase manually to ensure no test environment issues.

**Known Limitations:**

- E2E tests will never achieve 100% backend test parity due to different testing purposes (UI flows vs unit logic)
- Some backend middleware/service tests have no E2E equivalent (rate limiting, correlation IDs, etc.)
- Test execution time will increase with more E2E tests (need to balance coverage vs speed)
- Playwright limitations may prevent testing certain scenarios (file downloads, print dialogs, etc.)

**Future Enhancements (Out of Scope):**

- Visual regression testing with Playwright screenshots
- Performance testing and load time assertions
- Accessibility testing (ARIA roles, keyboard navigation)
- Mobile responsive testing
- Cross-browser testing (currently Chrome only)
- API mocking for isolated E2E tests
- Test result reporting dashboard

**References:**

- Backend test structure: [api-server/__tests__/](../../../api-server/__tests__/)
- Backend test template: [api-server/__tests__/TEST_TEMPLATE.md](../../../api-server/__tests__/TEST_TEMPLATE.md)
- Current E2E guidelines: [admin-web/e2e/GUIDELINES.md](../../../admin-web/e2e/GUIDELINES.md)
- Testing SOP: [.agent/SOP/frontend_testing.md](../../SOP/frontend_testing.md)

---

**PRD Version:** 1.0
**Created:** 2025-10-22
