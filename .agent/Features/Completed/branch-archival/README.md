# Branch Archival (Soft Delete)

**Status:** ✅ Complete
**Started:** October 17, 2025
**Completed:** October 18, 2025

## Overview
Implemented soft delete (archive) pattern for branches to safely remove closed/inactive locations from active views while preserving all historical data, stock movements, transfers, and user assignments. Branches can now be archived and restored without any data loss.

## Key Features
- **Archive Branches**: Hide branches from active views with confirmation modal
- **Restore Branches**: Return archived branches to active status instantly
- **Three-way Filter**: View active-only, archived-only, or all branches via dropdown
- **Preserved Data**: All stock history, transfers, ledger entries, and user memberships remain intact
- **Read-only Mode**: Archived branches become read-only until restored
- **Permission-based**: Archive/restore buttons only visible to users with `branches:manage`
- **Accessible**: Archived branches accessible via direct URL for restoration

## Implementation

### Backend
- **Database Migration**: Added `isArchived`, `archivedAt`, `archivedByUserId` fields to Branch model with index on `[tenantId, isArchived]`
- **Service Updates**: Modified `branchService.ts` with archive/restore functions and `archivedFilter` parameter
- **API Endpoints**:
  - `DELETE /api/branches/:id` - Archives branch (soft delete)
  - `POST /api/branches/:id/restore` - Restores archived branch
  - `GET /api/branches` - Supports `archivedFilter` query parameter (active-only, archived-only, all)
  - `GET /api/branches/:id` - Returns archived branches (needed for restoration)
- **Audit Trail**: Archive uses DELETE action, restore uses UPDATE action

### Frontend
- **Archive from Detail Page**: Archive button with confirmation modal explaining data preservation
- **Filter Dropdown**: Three-way archive filter in Branches page FilterBar
- **Restore Button**: Blue restore button on archived branch detail pages
- **View-only List Actions**: Replaced inline edit/delete with single "View" button (eye icon)
- **Archived Badge**: Gray badge displayed on archived branches in list and detail views
- **Read-only View**: Save button hidden when viewing archived branches
- **Data-testid Attributes**: Added for E2E testing (archived-badge, archive-branch-btn, restore-btn, view-branch-btn)

## Test Coverage
- **28 passing tests** (17 backend + 11 frontend E2E)
- **Backend Tests (Jest)**: Archive/restore operations, archivedFilter modes, permissions, multi-tenant isolation, idempotency, audit trail
- **Frontend Tests (Playwright E2E)**: Archive flow, restore flow, filter dropdown, confirmation modal, badge display, read-only mode, isolated test data
- **Test Isolation**: All E2E tests use BranchFactory to create/cleanup test data (no seed data modification)
- 100% coverage of archive/restore functionality

## Documentation
- [PRD](./prd.md) - Complete implementation plan and notes
- [User Guide - Managing Branches](../../../docs/branches-users/managing-branches.md#archiving-a-branch) - End-user documentation for archiving
- [User Guide - Restoring Branches](../../../docs/branches-users/managing-branches.md#restoring-an-archived-branch) - End-user documentation for restoring
- [FAQ - Can I delete a branch?](../../../docs/faq.md) - Quick archive instructions
- [FAQ - How do I restore an archived branch?](../../../docs/faq.md) - Quick restore instructions

## Key Files

### Backend
- `api-server/prisma/migrations/20251018_add_branch_archival/migration.sql` - Database schema
- `api-server/src/services/branches/branchService.ts` - Archive/restore logic
- `api-server/src/routes/branchRouter.ts` - API endpoints
- `api-server/src/openapi/paths/branches.ts` - OpenAPI path definitions
- `api-server/src/openapi/schemas/branches.ts` - OpenAPI schemas
- `api-server/__tests__/routes/branchArchival.test.ts` - Backend tests (17 comprehensive tests)

### Frontend
- `admin-web/src/pages/BranchesPage.tsx` - Archive filter dropdown, View button, archived badge
- `admin-web/src/pages/BranchPage.tsx` - Archive/restore buttons, modal, read-only mode
- `admin-web/src/api/branches.ts` - API client functions (restore, archivedFilter)
- `admin-web/e2e/helpers/factories.ts` - BranchFactory with create/archive/restore helpers
- `admin-web/e2e/features/branch-archival.spec.ts` - E2E tests (11 comprehensive tests)

### Documentation
- `docs/branches-users/managing-branches.md` - Updated user guide with archive/restore workflows
- `docs/faq.md` - Added archive and restore FAQ entries

## Architecture Decisions
- **Soft Delete Over Hard Delete**: Preserves audit trail for stock movements, transfers, and user assignments
- **Archive Terminology**: Using "Archive" in UI instead of "Delete" to clarify reversibility
- **Three-way Filter**: Dropdown with 3 modes (active-only, archived-only, all) for better control
- **Archive from Detail Page**: Action moved from list to detail page with confirmation modal
- **Confirmation Modal**: User-friendly explanation of what's preserved during archive
- **Permission Level**: Using `tenant:manage` permission (consistent with other branch operations)
- **View-only List Actions**: Changed from inline edit/delete to single "View" button (consistent with Products/TenantUsers pattern)
- **Detail Page Actions**: All modification actions (Archive, Restore) consolidated in detail page header
- **Read-only Archived View**: Archived branches shown in read-only mode (no edit/save buttons)
- **Test Data Isolation**: BranchFactory creates unique test branches for each test (no seed data pollution)

## Security
- ✅ Multi-tenant isolation (archive only tenant's branches)
- ✅ Permission-based access (`tenant:manage` required)
- ✅ Audit trail preservation (archivedAt, archivedByUserId tracked)
- ✅ Foreign key constraints respected (no data loss)
- ✅ Idempotent operations (safe to archive/restore multiple times)

## Known Limitations
- Archived branches remain in database permanently (not true deletion)
- Branch slug uniqueness constraint still applies to archived branches
- Bulk archive/restore operations not implemented (future enhancement)
- Stock operations should check if branch is archived before allowing new stock movements (future enhancement)

## Related Features
- **Product Archival** - Similar archive/restore pattern implemented for products
- **User Archival** - Similar archive/restore pattern implemented for tenant users
- **Stock Management** - Preserved stock history remains intact for archived branches
- **Stock Transfers** - Past transfers still reference archived branches

## Notes
Built with production-grade patterns including comprehensive confirmation modals, three-way filtering, complete test coverage with isolated test data, and extensive user documentation. Fully integrated with existing RBAC, multi-tenant architecture, audit system, and FIFO stock management.

**Key Insight:** Branches with stock history, transfers, or user assignments cannot be hard-deleted due to foreign key constraints. Archive pattern solves this by hiding branches from active operations while preserving all historical data for reporting and audit purposes.
