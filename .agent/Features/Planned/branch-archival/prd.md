# Branch Archival (Soft Delete) - Implementation Plan

**Status:** 📋 Planning
**Priority:** High
**Estimated Effort:** 1-2 days
**Created:** 2025-10-17
**Last Updated:** 2025-10-17

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
- [api-server/prisma/schema.prisma](../../api-server/prisma/schema.prisma) - Branch model
- [api-server/src/services/branchService.ts](../../api-server/src/services/branchService.ts) - Branch service
- [api-server/src/routes/branchesRouter.ts](../../api-server/src/routes/branchesRouter.ts) - Branch routes
- [api-server/src/openapi/paths/branches.ts](../../api-server/src/openapi/paths/branches.ts) - OpenAPI schemas
- [admin-web/src/pages/BranchesPage.tsx](../../admin-web/src/pages/BranchesPage.tsx) - Branches list UI
- [admin-web/src/pages/BranchDetailPage.tsx](../../admin-web/src/pages/BranchDetailPage.tsx) - Branch detail UI

### Backend Implementation

- [ ] Database schema changes (create migration: `add_branch_archival`)
  - [ ] Add `isArchived Boolean @default(false)` to Branch model
  - [ ] Add `archivedAt DateTime?` (optional, for tracking when)
  - [ ] Add `archivedByUserId String?` (optional, for tracking who)
  - [ ] Add index on `isArchived` for query performance
- [ ] Prisma client regeneration
- [ ] Update `branchService.ts`:
  - [ ] Update list queries to filter `isArchived: false` by default
  - [ ] Update `deleteBranch()` to set `isArchived: true` instead of hard delete
  - [ ] Add `restoreBranch()` function (sets isArchived: false, clears archivedAt)
  - [ ] Add `archivedFilter` parameter with 3 modes: "active-only" (default), "archived-only", "all"
  - [ ] Allow `getBranch()` to return archived branches (needed for detail page access)
- [ ] Update OpenAPI schemas:
  - [ ] Add `archivedFilter` enum query parameter to GET /branches
  - [ ] Add POST `/branches/:id/restore` endpoint schema
  - [ ] Update Branch response schema to include isArchived fields
- [ ] Update routes:
  - [ ] Change DELETE `/branches/:id` to call archiveBranch (requires `branches:write`)
  - [ ] Add POST `/branches/:id/restore` endpoint (requires `branches:write`)
  - [ ] Add `archivedFilter` query param support to GET `/branches`
- [ ] Backend tests written and passing
  - [ ] Archive branch with related records (should succeed)
  - [ ] Restore archived branch
  - [ ] List branches filters archived by default
  - [ ] List branches with archivedFilter='archived-only' shows only archived
  - [ ] List branches with archivedFilter='all' shows all branches
  - [ ] getBranch() allows access to archived branches
  - [ ] Permission checks (multi-tenant isolation)
- [ ] Confirm all backend tests pass before moving to frontend

### Frontend Implementation

- [ ] OpenAPI types regenerated (`npm run openapi:gen`)
- [ ] Update `api/branches.ts`:
  - [ ] Add `restoreBranch()` function
  - [ ] Add `archivedFilter` parameter to `listBranches()`
- [ ] Update BranchesPage component (list view):
  - [ ] Add archive filter dropdown in FilterBar with 3 options:
    - "Active branches only" (active-only - default)
    - "Archived branches only" (archived-only)
    - "All branches (active + archived)" (all)
  - [ ] Display "Archived" badge on branches in table (data-testid="archived-badge")
  - [ ] Archive filter properly synced with URL params
- [ ] Update BranchDetailPage component (detail/edit page) with **data-testid attributes**:
  - [ ] Track isArchived state when loading branch
  - [ ] Show "Archived" badge in header if branch is archived (data-testid="archived-badge")
  - [ ] Add "Archive Branch" button in header (data-testid="archive-branch-btn")
    - Only visible for active branches with branches:write permission
    - Red color, light variant with archive icon
    - Opens confirmation modal before archiving
  - [ ] Add archive confirmation modal with user-friendly explanation
  - [ ] Add "Restore" button for archived branches (data-testid="restore-btn")
  - [ ] Hide Save button when branch is archived
- [ ] E2E tests written and passing
  - [ ] Archive branch from detail page (with confirmation modal)
  - [ ] Cancel archive confirmation modal (verify no changes)
  - [ ] Restore archived branch from detail page
  - [ ] Filter dropdown shows only archived branches
  - [ ] Filter dropdown shows all branches (active + archived)
  - [ ] Verify archived branches accessible via direct URL
  - [ ] Verify permission checks for archive/restore actions (VIEWER role)
  - [ ] Clear archive filter resets to default (active only)

### Documentation

- [ ] Update user guide with archive/restore workflows
- [ ] Document archive filter and permissions
- [ ] Add troubleshooting and common tasks
- [ ] Update [Database Schema](../../System/database-schema.md) with isArchived field (optional)

---

## Testing Strategy

### Backend Tests (Jest)

**Service Layer:**
- [ ] Archive branch with stock records succeeds
- [ ] Archive branch updates isArchived, archivedAt, archivedByUserId
- [ ] Restore branch clears archive fields
- [ ] List branches excludes archived by default
- [ ] List branches with archivedFilter='archived-only' returns only archived
- [ ] List branches with archivedFilter='all' returns all branches
- [ ] getBranch() allows access to archived branches
- [ ] Multi-tenant isolation (cannot archive other tenant's branches)
- [ ] Audit trail preservation (UPDATE events for restore)

**API Routes:**
- [ ] DELETE /branches/:id sets isArchived instead of deleting
- [ ] POST /branches/:id/restore restores archived branch
- [ ] GET /branches with archivedFilter parameter works correctly
- [ ] GET /branches/:id returns archived branches (for detail page access)

### Frontend Tests (Playwright E2E)

**User Flows:**
- [ ] Archive branch from detail page (with confirmation modal)
- [ ] Cancel archive confirmation (verify no changes made)
- [ ] Use archive filter dropdown to show only archived branches
- [ ] Use archive filter dropdown to show all branches (active + archived)
- [ ] Restore archived branch from detail page
- [ ] Archived badge displayed correctly in list views
- [ ] Archived branches hidden by default in list view
- [ ] Archived branches accessible via direct URL to detail page
- [ ] Archive confirmation modal displays with correct messaging
- [ ] Clear archive filter resets to default state

**Permission-Based UI:**
- [ ] Users with branches:write can archive and restore branches
- [ ] Users without branches:write (VIEWER) cannot see archive/restore buttons
- [ ] Archive button only shown for active branches
- [ ] Restore button only shown for archived branches

---

## Success Metrics

- [ ] Branches with stock history/transfers can be archived without errors
- [ ] Backend tests all passing (branch service tests)
- [ ] Archived branches excluded from active views by default
- [ ] Three-way archive filter working (active-only, archived-only, all)
- [ ] Restore functionality working with audit trail
- [ ] All existing tests continue to pass (backward compatible)
- [ ] UI shows archive filter dropdown in FilterBar
- [ ] Archive confirmation modal with user-friendly messaging
- [ ] Archived branches accessible on detail pages for restore
- [ ] Archive/restore buttons only visible to users with branches:write
- [ ] E2E tests written and passing (comprehensive Playwright tests)
- [ ] User documentation updated with archive workflows

---

## Notes & Decisions

**Key Design Decisions:**
- **Soft delete over hard delete** - Preserves audit trail for stock movements, transfers, and user assignments
- **Archive terminology** - Using "Archive" in UI instead of "Delete" to clarify it's reversible
- **Three-way filter** - Dropdown with 3 options (active-only, archived-only, all) for better control
- **Archive from detail page** - Archive action on detail page with confirmation modal (consistent with product archival)
- **Confirmation modal** - User-friendly explanation: "This branch will be hidden from your active branch list but can be restored at any time. All stock history, transfers, and user assignments will be preserved."
- **Permission level** - Reusing existing `branches:write` permission (no new permission needed)
- **Optional tracking fields** - Including archivedAt and archivedByUserId for better audit trail
- **Archived branch access** - Allow detail page access for restoration
- **isActive vs isArchived** - Keep both fields: isActive for operational status, isArchived for deletion status

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
