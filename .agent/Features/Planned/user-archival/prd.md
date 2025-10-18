# User Archival (Per-Tenant Deactivation) - Implementation Plan

**Status:** 📋 Planning
**Priority:** High
**Estimated Effort:** 2-3 days
**Created:** 2025-10-17
**Last Updated:** 2025-10-17

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

- [ ] Database schema changes (create migration: `add_user_membership_archival`)
  - [ ] Add `isArchived Boolean @default(false)` to UserTenantMembership model
  - [ ] Add `archivedAt DateTime?` (optional, for tracking when)
  - [ ] Add `archivedByUserId String?` (optional, for tracking who archived)
  - [ ] Add index on `isArchived` for query performance: `@@index([tenantId, isArchived])`
- [ ] Prisma client regeneration
- [ ] Update `userService.ts`:
  - [ ] Update list queries to filter `isArchived: false` by default
  - [ ] Update `removeUserFromTenant()` to set `isArchived: true` instead of hard delete
  - [ ] Add `restoreUserMembership()` function (sets isArchived: false, clears archivedAt)
  - [ ] Add `archivedFilter` parameter with 3 modes: "active-only" (default), "archived-only", "all"
  - [ ] Allow `getUserMembership()` to return archived memberships (needed for detail page access)
- [ ] Update `sessionMiddleware.ts`:
  - [ ] Check `isArchived` field on UserTenantMembership during authentication
  - [ ] Reject authentication if membership is archived (401 Unauthorized)
  - [ ] Add test coverage for archived membership authentication attempts
- [ ] Update OpenAPI schemas:
  - [ ] Add `archivedFilter` enum query parameter to GET /tenant-users
  - [ ] Add POST `/tenant-users/:userId/restore` endpoint schema
  - [ ] Update UserTenantMembership response schema to include isArchived fields
- [ ] Update routes:
  - [ ] Change DELETE `/tenant-users/:userId` to call archiveUserMembership (requires `users:manage`)
  - [ ] Add POST `/tenant-users/:userId/restore` endpoint (requires `users:manage`)
  - [ ] Add `archivedFilter` query param support to GET `/tenant-users`
- [ ] Backend tests written and passing
  - [ ] Archive user membership with stock/transfer history (should succeed)
  - [ ] Restore archived user membership
  - [ ] List users filters archived by default
  - [ ] List users with archivedFilter='archived-only' shows only archived
  - [ ] List users with archivedFilter='all' shows all users
  - [ ] getUserMembership() allows access to archived memberships
  - [ ] Archived membership authentication rejected (401)
  - [ ] Permission checks (multi-tenant isolation)
  - [ ] Cannot archive own membership
  - [ ] Audit trail preservation (UPDATE events for restore)
- [ ] Confirm all backend tests pass before moving to frontend

### Frontend Implementation

- [ ] OpenAPI types regenerated (`npm run openapi:gen`)
- [ ] Update `api/tenantUsers.ts`:
  - [ ] Add `restoreUserMembership()` function
  - [ ] Add `archivedFilter` parameter to `listTenantUsers()`
- [ ] Update TenantUsersPage component (list view):
  - [ ] Add archive filter dropdown in FilterBar with 3 options:
    - "Active users only" (active-only - default)
    - "Archived users only" (archived-only)
    - "All users (active + archived)" (all)
  - [ ] Display "Archived" badge on users in table (data-testid="archived-badge")
  - [ ] Archive filter properly synced with URL params
  - [ ] Disable "Archive" action for current user (cannot archive self)
- [ ] Update UserDetailPage component (detail/edit page) with **data-testid attributes**:
  - [ ] Track isArchived state when loading user membership
  - [ ] Show "Archived" badge in header if user is archived (data-testid="archived-badge")
  - [ ] Add "Archive User" button in header (data-testid="archive-user-btn")
    - Only visible for active memberships with users:manage permission
    - Hidden for current user (cannot archive self)
    - Red color, light variant with archive icon
    - Opens confirmation modal before archiving
  - [ ] Add archive confirmation modal with user-friendly explanation and security warning
  - [ ] Add "Restore" button for archived users (data-testid="restore-btn")
  - [ ] Hide Save button when user is archived
  - [ ] Display warning if user archived: "This user cannot sign in to this tenant"
- [ ] E2E tests written and passing
  - [ ] Archive user membership from detail page (with confirmation modal)
  - [ ] Cancel archive confirmation modal (verify no changes)
  - [ ] Restore archived user membership from detail page
  - [ ] Filter dropdown shows only archived users
  - [ ] Filter dropdown shows all users (active + archived)
  - [ ] Verify archived users accessible via direct URL
  - [ ] Verify permission checks for archive/restore actions (VIEWER role)
  - [ ] Verify cannot archive own membership
  - [ ] Verify archived user cannot sign in
  - [ ] Clear archive filter resets to default (active only)

### Documentation

- [ ] Update user guide with archive/restore workflows
- [ ] Document archive filter and permissions
- [ ] Add security implications (archived users cannot sign in)
- [ ] Add troubleshooting and common tasks
- [ ] Update [Database Schema](../../System/database-schema.md) with isArchived field (optional)

---

## Testing Strategy

### Backend Tests (Jest)

**Service Layer:**
- [ ] Archive user membership with stock/transfer history succeeds
- [ ] Archive user membership updates isArchived, archivedAt, archivedByUserId
- [ ] Restore user membership clears archive fields
- [ ] List users excludes archived by default
- [ ] List users with archivedFilter='archived-only' returns only archived
- [ ] List users with archivedFilter='all' returns all users
- [ ] getUserMembership() allows access to archived memberships
- [ ] Multi-tenant isolation (cannot archive users in other tenants)
- [ ] Cannot archive own membership (throws error)
- [ ] Audit trail preservation (UPDATE events for archive/restore)

**Authentication:**
- [ ] Archived membership rejected during sign-in (401)
- [ ] Archived membership rejected during session validation (401)
- [ ] User can still sign in to other non-archived tenant memberships

**API Routes:**
- [ ] DELETE /tenant-users/:userId sets isArchived instead of deleting
- [ ] POST /tenant-users/:userId/restore restores archived membership
- [ ] GET /tenant-users with archivedFilter parameter works correctly
- [ ] GET /tenant-users/:userId returns archived memberships (for detail page access)

### Frontend Tests (Playwright E2E)

**User Flows:**
- [ ] Archive user membership from detail page (with confirmation modal)
- [ ] Cancel archive confirmation (verify no changes made)
- [ ] Use archive filter dropdown to show only archived users
- [ ] Use archive filter dropdown to show all users (active + archived)
- [ ] Restore archived user membership from detail page
- [ ] Archived badge displayed correctly in list views
- [ ] Archived users hidden by default in list view
- [ ] Archived users accessible via direct URL to detail page
- [ ] Archive confirmation modal displays with correct messaging
- [ ] Clear archive filter resets to default state

**Security & Permission Tests:**
- [ ] Users with users:manage can archive and restore memberships
- [ ] Users without users:manage (VIEWER) cannot see archive/restore buttons
- [ ] Archive button only shown for active memberships
- [ ] Restore button only shown for archived memberships
- [ ] Cannot archive own membership (button hidden)
- [ ] Archived user receives 401 when attempting to sign in
- [ ] Archived user redirected to sign-in page with error message

---

## Success Metrics

- [ ] User memberships with stock/transfer history can be archived without errors
- [ ] Backend tests all passing (user service tests + auth tests)
- [ ] Archived users excluded from active views by default
- [ ] Three-way archive filter working (active-only, archived-only, all)
- [ ] Restore functionality working with audit trail
- [ ] All existing tests continue to pass (backward compatible)
- [ ] UI shows archive filter dropdown in FilterBar
- [ ] Archive confirmation modal with security warning
- [ ] Archived users cannot authenticate to archived tenant
- [ ] Archived users accessible on detail pages for restore
- [ ] Archive/restore buttons only visible to users with users:manage
- [ ] Cannot archive own membership (safety check)
- [ ] E2E tests written and passing (comprehensive Playwright tests)
- [ ] User documentation updated with archive workflows and security implications

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

**Template Version:** 1.0
**Created:** 2025-10-17
