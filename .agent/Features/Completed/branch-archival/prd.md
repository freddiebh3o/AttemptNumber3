# Branch Archival (Soft Delete) - Implementation Plan

**Status:** ✅ Complete
**Priority:** High
**Estimated Effort:** 1-2 days
**Created:** 2025-10-17
**Last Updated:** 2025-10-18
**Completed:** 2025-10-18

---

## Overview

Enable safe branch deletion by implementing soft delete (archive) pattern. Currently, branches cannot be deleted when they have related records (ProductStock, StockLot, StockLedger, UserBranchMembership, or StockTransfer relations) due to foreign key constraints. This prevents users from removing closed/inactive branches while preserving historical data and audit trails.

**Key Capabilities:**
- Archive branches instead of hard delete (preserves audit trail)
- Filter archived branches from active views with dropdown (active-only, archived-only, all)
- Archive branches from detail page with confirmation modal
- Restore archived branches (users with branches:write permission)

**Related Documentation:**
- [Database Schema](../../System/database-schema.md#branch) - Branch model reference
- [RBAC System](../../System/rbac-system.md) - Permission enforcement
- [Product Archival PRD](../Completed/product-archival/prd.md) - Similar implementation pattern

**Problem Being Solved:**
Branches with stock history, transfers, or user assignments cannot be deleted due to `onDelete: Restrict` and `onDelete: Cascade` foreign key constraints. Soft delete preserves historical data while allowing users to "remove" closed branches from active lists.

---

## Phase 1: Soft Delete Implementation

**Goal:** Implement archive/restore functionality for branches with full backend and frontend support

**Relevant Files:**
- [api-server/prisma/schema.prisma](../../api-server/prisma/schema.prisma) - Branch model ✅
- [api-server/src/services/branches/branchService.ts](../../api-server/src/services/branches/branchService.ts) - Branch service ✅
- [api-server/src/routes/branchRouter.ts](../../api-server/src/routes/branchRouter.ts) - Branch routes ✅
- [api-server/src/openapi/paths/branches.ts](../../api-server/src/openapi/paths/branches.ts) - OpenAPI path definitions ✅
- [api-server/src/openapi/schemas/branches.ts](../../api-server/src/openapi/schemas/branches.ts) - OpenAPI schemas ✅
- [api-server/__tests__/routes/branchArchival.test.ts](../../api-server/__tests__/routes/branchArchival.test.ts) - Backend tests ✅
- [admin-web/src/pages/BranchesPage.tsx](../../admin-web/src/pages/BranchesPage.tsx) - Branches list UI
- [admin-web/src/pages/BranchDetailPage.tsx](../../admin-web/src/pages/BranchDetailPage.tsx) - Branch detail UI
- [admin-web/src/api/branches.ts](../../admin-web/src/api/branches.ts) - Frontend API client

### Backend Implementation ✅

- [x] Database schema changes (migration: `20251018_add_branch_archival`)
  - [x] Add `isArchived Boolean @default(false)` to Branch model
  - [x] Add `archivedAt DateTime?` (optional, for tracking when)
  - [x] Add `archivedByUserId String?` (optional, for tracking who)
  - [x] Add index on `[tenantId, isArchived]` for query performance
- [x] Prisma client regeneration
- [x] Update `branchService.ts`:
  - [x] Update list queries to filter `isArchived: false` by default
  - [x] Add `archiveBranchForCurrentTenantService()` function (sets isArchived: true, archivedAt, archivedByUserId)
  - [x] Add `restoreBranchForCurrentTenantService()` function (sets isArchived: false, clears archivedAt/archivedByUserId)
  - [x] Add `archivedFilter` parameter with 3 modes: "active-only" (default), "archived-only", "all"
  - [x] `getBranchForCurrentTenantService()` returns archived branches (needed for detail page access)
  - [x] All select statements include archived fields
- [x] Update OpenAPI schemas:
  - [x] Add `archivedFilter` enum query parameter to GET /branches (`ZodListBranchesQuery`)
  - [x] Add POST `/branches/:id/restore` endpoint schema
  - [x] Update Branch response schema to include isArchived fields (`ZodBranchRecord`)
- [x] Update routes (`branchRouter.ts`):
  - [x] Change DELETE `/branches/:id` to call `archiveBranchForCurrentTenantService` (requires `tenant:manage`)
  - [x] Add POST `/branches/:id/restore` endpoint (requires `tenant:manage`)
  - [x] Add `archivedFilter` query param support to GET `/branches`
- [x] Backend tests written and passing (17 tests in `branchArchival.test.ts`)
  - [x] Archive branch with related records (should succeed)
  - [x] Archive branch updates isArchived, archivedAt, archivedByUserId
  - [x] Restore archived branch clears all archive fields
  - [x] List branches filters archived by default (active-only)
  - [x] List branches with archivedFilter='archived-only' shows only archived
  - [x] List branches with archivedFilter='all' shows all branches
  - [x] getBranch() allows access to archived branches
  - [x] Permission checks (tenant:manage required)
  - [x] Multi-tenant isolation (cannot archive other tenant's branches)
  - [x] Audit trail preservation (DELETE for archive, UPDATE for restore)
  - [x] Idempotent archive/restore operations
- [x] Confirm all backend tests pass before moving to frontend

### Frontend Implementation ✅

- [x] OpenAPI types regenerated (`npm run openapi:gen`)
- [x] Update `api/branches.ts`:
  - [x] Add `restoreBranchApiRequest()` function
  - [x] Add `archivedFilter` parameter to `listBranchesApiRequest()`
- [x] Update BranchesPage component (list view):
  - [x] **Remove inline edit/delete actions from table rows**
  - [x] **Add single "View" action button (eye icon) for each row** (data-testid="view-branch-btn")
  - [x] "View" button navigates to branch detail page (`/:tenantSlug/branches/:branchId`)
  - [x] Add archive filter dropdown in FilterBar with 3 options:
    - "Active branches only" (active-only - default)
    - "Archived branches only" (archived-only)
    - "All branches (active + archived)" (all)
  - [x] Display "Archived" badge on branches in table (data-testid="archived-badge")
  - [x] Archive filter properly synced with URL params
  - [x] **Pattern follows ProductsPage/TenantUsersPage implementation**
- [x] Update BranchPage component (detail/view page) with **data-testid attributes**:
  - [x] Track isArchived state when loading branch
  - [x] Show "Archived" badge in header if branch is archived (data-testid="archived-badge")
  - [x] **Add "Archive Branch" button in header** (data-testid="archive-branch-btn")
    - Only visible for active branches with branches:manage permission
    - Red color, light variant with archive icon
    - Opens confirmation modal before archiving
  - [x] Add archive confirmation modal with user-friendly explanation
    - Message: "This branch will be hidden from your active branch list but can be restored at any time. All stock history, transfers, and user assignments will be preserved."
  - [x] **Add "Restore" button in header for archived branches** (data-testid="restore-btn")
    - Only visible for archived branches with branches:manage permission
    - Blue/accent color
  - [x] **Hide Save button when branch is archived** (read-only view)
  - [x] **Pattern follows ProductPage/TenantUserDetailPage implementation**
- [x] E2E tests written and passing (11 tests in `branch-archival.spec.ts`)
  - [x] Navigate to branch detail page from list view via "View" button
  - [x] Archive branch from detail page (with confirmation modal)
  - [x] Cancel archive confirmation modal (verify no changes)
  - [x] Restore archived branch from detail page
  - [x] Save button only visible for active branches
  - [x] Archive button only visible for active branches
  - [x] Restore button only visible for archived branches
  - [x] Filter dropdown shows only archived branches
  - [x] Filter dropdown shows all branches (active + archived)
  - [x] Verify archived branches accessible via direct URL
  - [x] Clear archive filter resets to default (active only)
  - [x] Verify Save hidden for archived branches (read-only)
  - [x] Archived badge visible in list view
- [x] BranchFactory helpers created (`create()`, `archive()`, `restore()`)
  - [x] All tests use factory-created test data (no seed data modification)
  - [x] Proper cleanup in finally blocks

### Documentation ✅

- [x] Update user guide with archive/restore workflows
  - [x] Updated [Managing Branches](../../../docs/branches-users/managing-branches.md)
  - [x] Added "Archiving a Branch" section with step-by-step instructions
  - [x] Added "Restoring an Archived Branch" section
  - [x] Updated filters documentation to include Archive Filter
  - [x] Updated Common Tasks with archive/restore workflows
- [x] Document archive filter and permissions
  - [x] Archive Filter documented with 3 modes (active-only, archived-only, all)
  - [x] Permission requirements clarified (branches:manage)
- [x] Add troubleshooting and common tasks
  - [x] Added "Can't delete a branch" troubleshooting
  - [x] Added "Can't edit an archived branch" troubleshooting
  - [x] Added "Archived branch not appearing in list" troubleshooting
  - [x] Updated Best Practices section
- [x] Update FAQ with archive questions
  - [x] Updated "Can I delete a branch?" with archive instructions
  - [x] Added "How do I restore an archived branch?" FAQ entry
- [ ] Update [Database Schema](../../System/database-schema.md) with isArchived field (optional - technical docs)

---

## Testing Strategy

### Backend Tests (Jest) ✅

**Completed Tests (17 tests in `branchArchival.test.ts`):**
- [x] Archive branch with stock records succeeds
- [x] Archive branch updates isArchived, archivedAt, archivedByUserId
- [x] Restore branch clears archive fields
- [x] List branches excludes archived by default
- [x] List branches with archivedFilter='archived-only' returns only archived
- [x] List branches with archivedFilter='all' returns all branches
- [x] getBranch() allows access to archived branches
- [x] Multi-tenant isolation (cannot archive other tenant's branches)
- [x] Audit trail preservation (DELETE for archive, UPDATE for restore)
- [x] DELETE /branches/:id sets isArchived instead of deleting
- [x] POST /branches/:id/restore restores archived branch
- [x] GET /branches with archivedFilter parameter works correctly
- [x] GET /branches/:id returns archived branches (for detail page access)
- [x] Permission checks (tenant:manage required for archive/restore)
- [x] Idempotent operations (archive already archived, restore already restored)
- [x] Return success when archiving already archived branch
- [x] Return success when restoring non-archived branch

### Frontend Tests (Playwright E2E) ✅

**User Flows (11 tests passing):**
- [x] Navigate to branch detail page from list view via "View" button
- [x] Archive branch from detail page (with confirmation modal)
- [x] Cancel archive confirmation (verify no changes made)
- [x] Use archive filter dropdown to show only archived branches
- [x] Use archive filter dropdown to show all branches (active + archived)
- [x] Restore archived branch from detail page
- [x] Archived badge displayed correctly in list views
- [x] Archived badge displayed in detail page header
- [x] Archived branches hidden by default in list view
- [x] Archived branches accessible via direct URL to detail page
- [x] Archive confirmation modal displays with correct messaging
- [x] Clear archive filter resets to default state
- [x] Save button visible only for active branches
- [x] Save button hidden when viewing archived branch (read-only)

**Note on Permission Tests:**
- VIEWER role tests not applicable - branches require `branches:manage` permission for any access
- Unlike products (which have read/write split), branches are all-or-nothing access

---

## Success Metrics

**Backend (Completed):**
- [x] Branches with stock history/transfers can be archived without errors
- [x] Backend tests all passing (17 tests in branchArchival.test.ts)
- [x] Archived branches excluded from active views by default
- [x] Three-way archive filter working (active-only, archived-only, all)
- [x] Restore functionality working with audit trail
- [x] All existing tests continue to pass (backward compatible)
- [x] Archive/restore requires tenant:manage permission
- [x] Multi-tenant isolation enforced
- [x] Audit events created for archive/restore operations

**Frontend (Completed):**
- [x] UI shows archive filter dropdown in FilterBar with 3 modes
- [x] Archive confirmation modal with user-friendly messaging
- [x] Archived branches accessible on detail pages for restore
- [x] Archive/restore buttons only visible to users with branches:manage
- [x] E2E tests written and passing (11 comprehensive Playwright tests)
- [x] BranchFactory test helpers created for isolated test data
- [x] User documentation updated with archive workflows

---

## Implementation Notes

### Implementation Complete (2025-10-18)

**Feature fully implemented and tested with 28 passing tests (17 backend + 11 frontend).**

#### Summary of Changes

**Backend (17 tests passing):**
- Database migration adding `isArchived`, `archivedAt`, `archivedByUserId` fields
- Archive/restore service functions with full audit trail
- Three-way archive filter (active-only, archived-only, all)
- API endpoints: DELETE `/branches/:id` (archive), POST `/branches/:id/restore`
- OpenAPI schema updates for all new functionality
- Permission enforcement via `tenant:manage`

**Frontend (11 tests passing):**
- Archive filter dropdown in BranchesPage with URL sync
- View-only list actions (replaced edit/delete with single View button)
- Archive/Restore buttons on BranchPage detail view
- Archive confirmation modal with clear messaging
- Archived badge display in list and detail views
- Read-only mode for archived branches (Save button hidden)
- BranchFactory test helpers for isolated test data

#### Files Modified

**Backend:**
- [api-server/prisma/schema.prisma](../../api-server/prisma/schema.prisma) - Added archive fields
- [api-server/prisma/migrations/20251018_add_branch_archival/](../../api-server/prisma/migrations/20251018_add_branch_archival/) - Migration
- [api-server/src/services/branches/branchService.ts](../../api-server/src/services/branches/branchService.ts) - Archive/restore logic
- [api-server/src/routes/branchRouter.ts](../../api-server/src/routes/branchRouter.ts) - Archive/restore endpoints
- [api-server/src/openapi/paths/branches.ts](../../api-server/src/openapi/paths/branches.ts) - OpenAPI paths
- [api-server/src/openapi/schemas/branches.ts](../../api-server/src/openapi/schemas/branches.ts) - OpenAPI schemas
- [api-server/__tests__/routes/branchArchival.test.ts](../../api-server/__tests__/routes/branchArchival.test.ts) - 17 backend tests

**Frontend:**
- [admin-web/src/api/branches.ts](../../admin-web/src/api/branches.ts) - Added restore function and archive filter
- [admin-web/src/pages/BranchesPage.tsx](../../admin-web/src/pages/BranchesPage.tsx) - Archive filter, View button, archived badge
- [admin-web/src/pages/BranchPage.tsx](../../admin-web/src/pages/BranchPage.tsx) - Archive/restore buttons, modal, read-only mode
- [admin-web/e2e/helpers/factories.ts](../../admin-web/e2e/helpers/factories.ts) - BranchFactory with create/archive/restore
- [admin-web/e2e/features/branch-archival.spec.ts](../../admin-web/e2e/features/branch-archival.spec.ts) - 11 E2E tests

**Documentation:**
- [docs/branches-users/managing-branches.md](../../docs/branches-users/managing-branches.md) - Comprehensive archive/restore guide
- [docs/faq.md](../../docs/faq.md) - FAQ entries for archiving and restoring branches

### Backend Completion Summary (2025-10-18)

**Database Changes:**
- Created migration `20251018_add_branch_archival` adding three new fields to Branch model
- Index added on `[tenantId, isArchived]` for optimal query performance
- Migration applied successfully to database

**Service Layer:**
- Created `archiveBranchForCurrentTenantService()` - soft deletes branch by setting isArchived=true
- Created `restoreBranchForCurrentTenantService()` - restores archived branch
- Updated `listBranchesForCurrentTenantService()` to support archivedFilter with 3 modes
- Default behavior: only show active branches (isArchived=false)
- All operations maintain full audit trail with before/after snapshots
- Both archive/restore operations are idempotent (safe to call multiple times)

**API Layer:**
- DELETE `/api/branches/:id` now calls archive instead of hard delete
- POST `/api/branches/:id/restore` added for restoring archived branches
- GET `/api/branches` supports `archivedFilter` query parameter
- GET `/api/branches/:id` allows access to archived branches for restoration
- All endpoints require `tenant:manage` permission

**Testing:**
- 17 comprehensive tests in `branchArchival.test.ts`
- All tests passing including edge cases (multi-tenant, permissions, idempotency)
- Verified archive works with branches that have stock records, transfers, user memberships
- Test coverage includes audit trail verification

**Key Technical Decisions:**
- Used `tenant:manage` permission (not `branches:write`) for consistency with other branch operations
- Archive tracks `archivedByUserId` for better audit trail
- Restore clears all archive-related fields (isArchived, archivedAt, archivedByUserId)
- Archive action uses AuditAction.DELETE, restore uses AuditAction.UPDATE
- Default filter is 'active-only' to hide archived branches from normal operations

---

## Notes & Decisions

**Key Design Decisions:**
- **Soft delete over hard delete** - Preserves audit trail for stock movements, transfers, and user assignments
- **Archive terminology** - Using "Archive" in UI instead of "Delete" to clarify it's reversible
- **Three-way filter** - Dropdown with 3 options (active-only, archived-only, all) for better control
- **Archive from detail page** - Archive action on detail page with confirmation modal (consistent with product archival)
- **Confirmation modal** - User-friendly explanation: "This branch will be hidden from your active branch list but can be restored at any time. All stock history, transfers, and user assignments will be preserved."
- **Permission level** - Using `tenant:manage` permission (consistent with existing branch operations)
- **Optional tracking fields** - Including archivedAt and archivedByUserId for better audit trail
- **Archived branch access** - Allow detail page access for restoration
- **isActive vs isArchived** - Keep both fields: isActive for operational status, isArchived for deletion status
- **View-only list actions** - Changed from inline edit/delete to single "View" button (consistent with ProductsPage/TenantUsersPage pattern)
- **Detail page actions** - All modification actions (Edit, Archive, Restore) consolidated in detail page header
- **Read-only archived view** - Archived branches shown in read-only mode (no edit/save buttons)

**Related Constraints:**
- UserBranchMembership uses `onDelete: Cascade` (will be deleted if branch deleted - but we archive instead)
- ProductStock uses `onDelete: Cascade` (preserved with archive)
- StockLot uses `onDelete: Cascade` (preserved with archive)
- StockLedger uses `onDelete: Cascade` (preserved with archive)
- StockTransfer uses `onDelete: Restrict` (prevents hard delete - archive solves this)

**Known Limitations:**
- Archived branches remain in database permanently (not a true delete)
- Branch slug uniqueness constraint still applies to archived branches (may need `@@unique([tenantId, branchSlug, isArchived])` if slug reuse is required)
- Stock operations should check if branch is archived before allowing new stock movements

**Future Enhancements (Out of Scope):**
- Bulk archive/restore operations
- Scheduled permanent deletion of archived branches (after X days)
- Archive reasons/notes field
- Archive history timeline (show who archived/restored and when)
- Prevent stock operations on archived branches (add validation in service layer)

---

**Template Version:** 1.0
**Created:** 2025-10-17
