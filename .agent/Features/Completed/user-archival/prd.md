# User Archival (Per-Tenant Deactivation) - Implementation Plan

**Status:** ✅ Complete (Backend ✅, E2E Tests ✅, Frontend UI ✅, Documentation ✅)
**Priority:** High
**Estimated Effort:** 2-3 days
**Created:** 2025-10-17
**Last Updated:** 2025-10-18

---

## Overview

Enable safe user deactivation by implementing archival at the UserTenantMembership level (per-tenant soft delete). Currently, users cannot be removed from tenants when they have related records (stock movements, transfers, approvals, audit events) due to foreign key constraints. This allows deactivating ex-employees while preserving complete audit trails and historical data.

**Key Capabilities:**
- Archive user memberships instead of hard delete (preserves audit trail)
- Per-tenant archival (user remains active in other tenants)
- Filter archived users from active views with dropdown (active-only, archived-only, all)
- Archive users from user management page with confirmation modal
- Restore archived user memberships (users with users:manage permission)

**Related Documentation:**
- [Database Schema](../../System/database-schema.md#usertenantmembership) - UserTenantMembership model reference
- [RBAC System](../../System/rbac-system.md) - Permission enforcement
- [Product Archival PRD](../Completed/product-archival/prd.md) - Similar implementation pattern

**Problem Being Solved:**
Users with stock movements, transfer history, or approval records cannot be removed from tenants due to foreign key constraints. Soft delete at membership level preserves historical data, maintains audit compliance, and supports security requirements while allowing HR to "remove" ex-employees from active user lists.

**Important Security Note:**
Archived users should not be able to sign in to archived tenant memberships. Archive status must be checked during authentication.

---

## Phase 1: Soft Delete Implementation

**Goal:** Implement archive/restore functionality for user memberships with full backend and frontend support

**Relevant Files:**
- [api-server/prisma/schema.prisma](../../api-server/prisma/schema.prisma) - UserTenantMembership model
- [api-server/src/services/userService.ts](../../api-server/src/services/userService.ts) - User service
- [api-server/src/routes/tenantUsersRouter.ts](../../api-server/src/routes/tenantUsersRouter.ts) - Tenant users routes
- [api-server/src/openapi/paths/tenant-users.ts](../../api-server/src/openapi/paths/tenant-users.ts) - OpenAPI schemas
- [api-server/src/middleware/sessionMiddleware.ts](../../api-server/src/middleware/sessionMiddleware.ts) - Authentication check
- [admin-web/src/pages/TenantUsersPage.tsx](../../admin-web/src/pages/TenantUsersPage.tsx) - Users list UI
- [admin-web/src/pages/UserDetailPage.tsx](../../admin-web/src/pages/UserDetailPage.tsx) - User detail UI

### Backend Implementation

- [x] Database schema changes (create migration: `add_user_membership_archival`)
  - [x] Add `isArchived Boolean @default(false)` to UserTenantMembership model
  - [x] Add `archivedAt DateTime?` (optional, for tracking when)
  - [x] Add `archivedByUserId String?` (optional, for tracking who archived)
  - [x] Add index on `isArchived` for query performance: `@@index([tenantId, isArchived])`
- [x] Prisma client regeneration
- [x] Update `userService.ts`:
  - [x] Update list queries to filter `isArchived: false` by default
  - [x] Update `removeUserFromTenant()` to set `isArchived: true` instead of hard delete
  - [x] Add `restoreUserMembership()` function (sets isArchived: false, clears archivedAt)
  - [x] Add `archivedFilter` parameter with 3 modes: "active-only" (default), "archived-only", "all"
  - [x] Allow `getUserMembership()` to return archived memberships (needed for detail page access)
- [x] Update authentication service and routes:
  - [x] Check `isArchived` field on UserTenantMembership during sign-in (authService.ts)
  - [x] Reject authentication if membership is archived (return null from verifyUserCredentials)
  - [x] Update sign-in error message to mention archived memberships
  - [x] Filter archived memberships from tenant list in /me endpoint
  - [x] Block archived memberships during tenant switch
  - [x] Add test coverage for archived membership authentication attempts
- [x] Update OpenAPI schemas:
  - [x] Add `archivedFilter` enum query parameter to GET /tenant-users
  - [x] Add POST `/tenant-users/:userId/restore` endpoint schema
  - [x] Update UserTenantMembership response schema to include isArchived fields
- [x] Update routes:
  - [x] Change DELETE `/tenant-users/:userId` to call archiveUserMembership (requires `users:manage`)
  - [x] Add POST `/tenant-users/:userId/restore` endpoint (requires `users:manage`)
  - [x] Add `archivedFilter` query param support to GET `/tenant-users`
- [x] Backend tests written and passing (19/19 tests)
  - [x] Archive user membership with stock/transfer history (should succeed)
  - [x] Restore archived user membership
  - [x] List users filters archived by default
  - [x] List users with archivedFilter='archived-only' shows only archived
  - [x] List users with archivedFilter='all' shows all users
  - [x] getUserMembership() allows access to archived memberships
  - [x] Archived membership authentication rejected with proper error message
  - [x] Archived memberships filtered from tenant switcher list
  - [x] Archived memberships blocked during tenant switch
  - [x] Permission checks (multi-tenant isolation)
  - [x] Cannot archive own membership
  - [x] Audit trail preservation (UPDATE events for restore)
- [x] Confirm all backend tests pass before moving to frontend

### Frontend Implementation

- [x] OpenAPI types regenerated (`npm run openapi:gen`)
- [x] Update `api/tenantUsers.ts`:
  - [x] Add `restoreUserMembership()` function
  - [x] Add `archivedFilter` parameter to `listTenantUsers()`
- [x] Update TenantUsersPage component (list view):
  - [x] Add archive filter dropdown in FilterBar with 3 options:
    - "Active users only" (active-only - default)
    - "Archived users only" (archived-only)
    - "All users (active + archived)" (all)
  - [x] Display "Archived" badge on users in table (data-testid="archived-badge")
  - [x] Archive filter properly synced with URL params
  - [x] Removed delete button from table (archive only from detail page)
  - [x] Archive filter added to filter chips display
- [x] Update TenantUserPage component (detail/edit page) with **data-testid attributes**:
  - [x] Track isArchived state when loading user membership
  - [x] Show "Archived" badge in header if user is archived (data-testid="archived-badge")
  - [x] Add "Archive User" button in header (data-testid="archive-user-btn")
    - Only visible for active memberships with users:manage permission
    - Hidden for current user (cannot archive self)
    - Red color, light variant with archive icon
    - Opens confirmation modal before archiving
  - [x] Add archive confirmation modal with user-friendly explanation and security warning
  - [x] Add "Restore" button for archived users (data-testid="restore-btn")
  - [x] Hide Save button when user is archived
  - [x] Display warning alert if user archived: "This user membership has been archived and cannot sign in"
- [x] E2E tests written and passing
  - [x] Archive user membership from detail page (with confirmation modal)
  - [x] Cancel archive confirmation modal (verify no changes)
  - [x] Restore archived user membership from detail page
  - [x] Filter dropdown shows only archived users
  - [x] Filter dropdown shows all users (active + archived)
  - [x] Verify archived users accessible via direct URL
  - [x] Verify permission checks for archive/restore actions (VIEWER role)
  - [x] Verify cannot archive own membership
  - [x] Verify archived user cannot sign in
  - [x] Clear archive filter resets to default (active only)

### Documentation

- [x] Update user guide with archive/restore workflows (docs/branches-users/managing-users.md)
  - [x] Added comprehensive "Archiving a User" section with step-by-step instructions
  - [x] Added "Restoring an Archived User" section
  - [x] Added "Viewing Archived Users" section with filter instructions
  - [x] Added "Archive vs Delete" comparison table
- [x] Document archive filter and permissions
  - [x] Updated "Available Filters" section with archive filter options
  - [x] Updated "Common Tasks" with archive/restore workflows
  - [x] Updated permissions section (users:manage required)
- [x] Add security implications (archived users cannot sign in)
  - [x] Added security implications to archiving section
  - [x] Documented error message users see when trying to sign in
  - [x] Updated Security Tips section
- [x] Add troubleshooting and common tasks
  - [x] Added troubleshooting for archival-related issues
  - [x] Added "Archive a Departing Employee" task
  - [x] Added "Restore a Returning Employee" task
  - [x] Added "Find All Archived Users" task
- [x] Update docs/README.md monthly tasks to reference archival
- [x] Update docs/faq.md with archival Q&A
  - [x] "How do I remove a user who left the company?"
  - [x] "Can archived users be restored?"
  - [x] "What error do archived users see when trying to sign in?"

---

## Testing Strategy

### Backend Tests (Jest)

**Service Layer:**
- [x] Archive user membership with stock/transfer history succeeds
- [x] Archive user membership updates isArchived, archivedAt, archivedByUserId
- [x] Restore user membership clears archive fields
- [x] List users excludes archived by default
- [x] List users with archivedFilter='archived-only' returns only archived
- [x] List users with archivedFilter='all' returns all users
- [x] getUserMembership() allows access to archived memberships
- [x] Multi-tenant isolation (cannot archive users in other tenants)
- [x] Cannot archive own membership (throws error)
- [x] Audit trail preservation (UPDATE events for archive/restore)

**Authentication:**
- [x] Archived membership rejected during sign-in with clear error message
- [x] Archived memberships filtered from tenant switcher dropdown
- [x] Archived membership blocked during tenant switch attempt
- [x] User can still sign in to other non-archived tenant memberships

**API Routes:**
- [x] DELETE /tenant-users/:userId sets isArchived instead of deleting
- [x] POST /tenant-users/:userId/restore restores archived membership
- [x] GET /tenant-users with archivedFilter parameter works correctly
- [x] GET /tenant-users/:userId returns archived memberships (for detail page access)

### Frontend Tests (Playwright E2E)

**User Flows:**
- [x] Archive user membership from detail page (with confirmation modal)
- [x] Cancel archive confirmation (verify no changes made)
- [x] Use archive filter dropdown to show only archived users
- [x] Use archive filter dropdown to show all users (active + archived)
- [x] Restore archived user membership from detail page
- [x] Archived badge displayed correctly in list views
- [x] Archived users hidden by default in list view
- [x] Archived users accessible via direct URL to detail page
- [x] Archive confirmation modal displays with correct messaging
- [x] Clear archive filter resets to default state

**Security & Permission Tests:**
- [x] Users with users:manage can archive and restore memberships
- [x] Users without users:manage (VIEWER) cannot see archive/restore buttons
- [x] Archive button only shown for active memberships
- [x] Restore button only shown for archived memberships
- [x] Cannot archive own membership (button hidden)
- [x] Archived user receives 401 when attempting to sign in
- [x] Archived user redirected to sign-in page with error message

**Additional E2E Test Coverage:**
- [x] List all users (with pagination and table display)
- [x] View user details (email and role information)
- [x] Search users by email (table cell filtering)
- [x] Filter users by role
- [x] Sort users (by email, created date)
- [x] Show user role badges in table
- [x] Show user branches in table
- [x] Clear all filters functionality
- [x] Refresh user list
- [x] Permission checks for all roles (VIEWER, EDITOR, ADMIN, OWNER)
- [x] Navigation from list to detail page
- [x] Copy shareable link functionality
- [x] Pagination controls (change page size, page number display)

---

## Success Metrics

- [x] User memberships with stock/transfer history can be archived without errors
- [x] Backend tests all passing (19/19 Jest tests + auth service tests)
- [x] Archived users excluded from active views by default
- [x] Three-way archive filter working (active-only, archived-only, all)
- [x] Restore functionality working with audit trail
- [x] All existing tests continue to pass (backward compatible)
- [x] UI shows archive filter dropdown in FilterBar (TenantUsersPage)
- [x] Archive confirmation modal with security warning (TenantUserPage)
- [x] Archived users cannot authenticate with clear error message "Invalid credentials or your membership has been archived"
- [x] Archived memberships filtered from tenant switcher dropdown
- [x] Archived users accessible on detail pages for restore
- [x] Archive/restore buttons only visible to users with users:manage
- [x] Cannot archive own membership (safety check - button hidden)
- [x] E2E tests written and passing (28 comprehensive Playwright tests)
- [x] User documentation updated with archive workflows and security implications

---

## Notes & Decisions

**Key Design Decisions:**
- **Membership-level archival** - Archive at UserTenantMembership level (not global User), allows per-tenant deactivation
- **Authentication blocking** - Archived memberships rejected during sign-in (critical security requirement)
- **Archive terminology** - Using "Archive" in UI instead of "Delete" to clarify it's reversible
- **Three-way filter** - Dropdown with 3 options (active-only, archived-only, all) for better control
- **Archive from detail page** - Archive action on detail page with confirmation modal (consistent with product/branch archival)
- **Confirmation modal** - User-friendly explanation with security warning: "This user will no longer be able to sign in to this tenant. All historical data and audit trails will be preserved. This action can be reversed."
- **Permission level** - Reusing existing `users:manage` permission (no new permission needed)
- **Self-archival prevention** - Cannot archive own membership (safety check to prevent lockout)
- **Optional tracking fields** - Including archivedAt and archivedByUserId for audit trail
- **Archived user access** - Allow detail page access for restoration

**Related Constraints:**
- User global entity remains (not deleted, just membership archived)
- StockLedger.actorUserId uses `onDelete: SetNull` (preserved, actor shown as "Former User" or similar)
- StockTransfer relations use `onDelete: Restrict` or `onDelete: SetNull` (preserved with archive)
- AuditEvent.actorUserId uses `onDelete: SetNull` (preserved, actor shown in audit trail)
- UserBranchMembership should cascade delete when UserTenantMembership archived (or add isArchived to UserBranchMembership)

**Known Limitations:**
- Archived memberships remain in database permanently (not a true delete)
- Email uniqueness constraint at User level (cannot reuse email even if all memberships archived)
- User global entity remains even if all tenant memberships archived (orphan users possible)
- Stock movements/transfers still reference archived user in history (acceptable for audit trail)

**Future Enhancements (Out of Scope):**
- Bulk archive/restore operations
- Scheduled permanent deletion of archived memberships (after X days)
- Archive reasons/notes field (e.g., "Terminated employment", "Role change")
- Archive history timeline (show who archived/restored and when)
- Email notification to archived user
- Cascade archival to UserBranchMembership records
- Global user cleanup (delete User if all memberships archived)
- Re-invitation workflow (restore archived membership when user re-joins company)

---

## Implementation Summary

### Completed Work

**Backend (✅ Complete):**
- Database migration adding `isArchived`, `archivedAt`, `archivedByUserId` fields to UserTenantMembership
- Archive/restore service layer functions in userService.ts
- Three-way archive filter (active-only, archived-only, all)
- Authentication blocking for archived memberships (authService.ts)
- Archive filter in tenant switcher (getUserMembershipsService)
- Tenant switch blocking for archived memberships
- Improved sign-in error message mentioning archived status
- Archive and restore API endpoints (DELETE and POST /tenant-users/:userId/restore)
- OpenAPI schema updates with archivedFilter parameter
- 19/19 Jest backend tests passing

**Frontend (✅ Complete):**
- TenantUsersPage: Archive filter dropdown in FilterBar
- TenantUsersPage: Archived badge display in table rows
- TenantUsersPage: Filter chips for archive filter
- TenantUsersPage: URL param sync for archive filter
- TenantUsersPage: Removed delete button from table (archive from detail page only)
- TenantUserPage: Archive/Restore buttons in header
- TenantUserPage: Archive confirmation modal with security warning
- TenantUserPage: Archived badge in header
- TenantUserPage: Warning alert for archived users
- TenantUserPage: Hide Save button when archived
- TenantUserPage: Prevent self-archival (button hidden for own membership)
- API client updates (restoreTenantUserApiRequest, archivedFilter parameter)
- 28/28 Playwright E2E tests passing (10 archival + 18 general user management)

**Security & Permission Enforcement (✅ Complete):**
- Archived users cannot sign in (rejected during authentication)
- Archived memberships hidden from tenant switcher
- Archive/restore actions require users:manage permission
- Cannot archive own membership (frontend + backend checks)
- Multi-tenant isolation (cannot archive users in other tenants)
- Clear error messaging: "Invalid credentials or your membership has been archived"

**Testing Coverage (✅ Complete):**
- Backend: 19 Jest tests covering service layer, auth, API routes
- Frontend: 28 Playwright E2E tests covering all user flows and permissions
- All tests passing with full coverage of archive/restore functionality

**Documentation (✅ Complete):**
- Updated [docs/branches-users/managing-users.md](../../../docs/branches-users/managing-users.md) with:
  - Comprehensive "Archiving a User" section (what, why, how)
  - "Viewing Archived Users" with 3-way filter explanation
  - "Restoring an Archived User" workflow
  - "Archive vs Delete" comparison table
  - Updated filters section with archive filter options
  - Updated common tasks (Archive Departing Employee, Restore Returning Employee, Find Archived Users)
  - Updated troubleshooting section (archived user errors, filter issues)
  - Updated best practices (archive instead of delete, periodic access review)
  - Updated security tips (verify archived status, restore carefully)
- Updated [docs/README.md](../../../docs/README.md):
  - Monthly tasks now reference archival instead of deletion
- Updated [docs/faq.md](../../../docs/faq.md):
  - "How do I remove a user who left the company?" (use archiving)
  - "Can archived users be restored?" (yes, reversible)
  - "What error do archived users see when trying to sign in?" (clear messaging)

---

**Template Version:** 1.0
**Created:** 2025-10-17
**Completed:** 2025-10-18
