# Custom Role Archival (Soft Delete) - Implementation Plan

**Status:** ✅ COMPLETE
**Priority:** Medium
**Estimated Effort:** 1-2 days
**Created:** 2025-10-17
**Last Updated:** 2025-10-19
**Completed:** 2025-10-19

---

## Implementation Summary

**Total Test Coverage:** 27 passing tests (17 backend + 10 frontend)

**Files Modified:**
- Backend: `schema.prisma`, `roleService.ts`, `roleRouter.ts`, `paths/roles.ts`
- Frontend: `api/roles.ts`, `RolesPage.tsx`, `RolePage.tsx`, `factories.ts`
- Tests: `roleArchival.test.ts` (backend), `role-archival.spec.ts` (frontend E2E)

**Key Achievements:**
- ✅ Custom roles can be archived (soft delete) with full audit trail
- ✅ System roles (OWNER, ADMIN, EDITOR, VIEWER) protected from archival
- ✅ Three-way archive filter (active-only, archived-only, all) in UI
- ✅ Archive/restore from detail page with confirmation modal
- ✅ Comprehensive test coverage (27 tests all passing)
- ✅ Follows established product archival pattern
- ✅ RBAC-enforced (requires roles:manage permission)

---

## Overview

Enable safe custom role deletion by implementing soft delete (archive) pattern for tenant-specific roles. As organizations evolve, custom roles become obsolete (restructured departments, deprecated job titles, merged permission sets). This feature allows archiving outdated custom roles while preserving system roles (OWNER, ADMIN, EDITOR, VIEWER) and maintaining audit trails for historical role assignments.

**Key Capabilities:**
- Archive custom roles instead of hard delete (preserves audit trail)
- System roles (OWNER, ADMIN, EDITOR, VIEWER) cannot be archived (safety check)
- Filter archived roles from active views with dropdown (active-only, archived-only, all)
- Archive roles from role management page with confirmation modal
- Restore archived roles (users with roles:manage permission)

**Related Documentation:**
- [Database Schema](../../System/database-schema.md#role) - Role model reference
- [RBAC System](../../System/rbac-system.md) - Role and permission system
- [Product Archival PRD](../Completed/product-archival/prd.md) - Similar implementation pattern

**Problem Being Solved:**
Custom roles cannot be deleted when they have active memberships (UserTenantMembership) due to foreign key constraints. As organizations restructure, old custom roles accumulate and clutter the role management UI. Soft delete provides a clean way to hide obsolete roles while preserving historical role assignments and the ability to restore if needed.

**Critical Safety Requirement:**
System roles (OWNER, ADMIN, EDITOR, VIEWER) with `isSystem: true` must NEVER be archivable. These are core to the RBAC system and must always be available.

---

## Phase 1: Soft Delete Implementation

**Goal:** Implement archive/restore functionality for custom roles with full backend and frontend support

**Relevant Files:**
- [api-server/prisma/schema.prisma](../../api-server/prisma/schema.prisma) - Role model
- [api-server/src/services/roleService.ts](../../api-server/src/services/roleService.ts) - Role service
- [api-server/src/routes/rolesRouter.ts](../../api-server/src/routes/rolesRouter.ts) - Role routes
- [api-server/src/openapi/paths/roles.ts](../../api-server/src/openapi/paths/roles.ts) - OpenAPI schemas
- [admin-web/src/pages/RolesPage.tsx](../../admin-web/src/pages/RolesPage.tsx) - Roles list UI
- [admin-web/src/pages/RoleDetailPage.tsx](../../admin-web/src/pages/RoleDetailPage.tsx) - Role detail UI

### Backend Implementation ✅ COMPLETE

- [x] Database schema changes (create migration: `add_role_archival`)
  - [x] Add `isArchived Boolean @default(false)` to Role model
  - [x] Add `archivedAt DateTime?` (optional, for tracking when)
  - [x] Add `archivedByUserId String?` (optional, for tracking who)
  - [x] Add index on `isArchived` for query performance: `@@index([tenantId, isArchived])`
- [x] Prisma client regeneration
- [x] Update `roleService.ts`:
  - [x] Update list queries to filter `isArchived: false` by default
  - [x] Update `deleteRole()` to set `isArchived: true` instead of hard delete
  - [x] Add validation: CANNOT archive if `isSystem: true` (throw error)
  - [x] Add validation: CANNOT archive if role has active memberships (throw error)
  - [x] Add `restoreRole()` function (sets isArchived: false, clears archivedAt)
  - [x] Add `archivedFilter` parameter with 3 modes: "active-only" (default), "archived-only", "all"
  - [x] Allow `getRole()` to return archived roles (needed for detail page access)
  - [x] Prevent editing archived roles (validation added to updateTenantRoleService)
- [x] Update OpenAPI schemas:
  - [x] Add `archivedFilter` enum query parameter to GET /roles
  - [x] Add POST `/roles/:id/restore` endpoint schema
  - [x] Update Role response schema to include isArchived fields
- [x] Update routes:
  - [x] Change DELETE `/roles/:id` to call archiveRole (requires `roles:manage`)
  - [x] Add POST `/roles/:id/restore` endpoint (requires `roles:manage`)
  - [x] Add `archivedFilter` query param support to GET `/roles`
- [x] Backend tests written and passing (17 test cases in roleArchival.test.ts)
  - [x] Archive custom role (should succeed)
  - [x] Cannot archive system role (isSystem: true throws error)
  - [x] Cannot archive role with active memberships (throws error)
  - [x] Cannot archive already archived role
  - [x] Restore archived role
  - [x] Cannot restore non-archived role
  - [x] List roles filters archived by default (active-only)
  - [x] List roles with archivedFilter='archived-only' shows only archived
  - [x] List roles with archivedFilter='all' shows all roles
  - [x] getRole() allows access to archived roles
  - [x] Cannot update archived role
  - [x] Permission checks (roles:manage required for archive/restore)
  - [x] Multi-tenant isolation (cannot archive/restore other tenant's roles)
- [x] Confirm all backend tests pass before moving to frontend

### Frontend Implementation ✅ COMPLETE

**UI Pattern:** Following product archival pattern - archive/restore from detail page, NOT from table row actions

- [x] OpenAPI types regenerated (`npm run openapi:gen`)
- [x] Update `api/roles.ts`:
  - [x] Add `restoreRoleApiRequest()` function
  - [x] Add `archivedFilter` parameter to `listRolesApiRequest()`
- [x] Update RolesPage component (list view):
  - [x] **REMOVED delete action button from table rows** (archival happens on detail page)
  - [x] Add archive filter dropdown in FilterBar with 3 options:
    - "Active roles only" (active-only - default)
    - "Archived roles only" (archived-only)
    - "All roles (active + archived)" (all)
  - [x] Display "Archived" badge on roles in table (data-testid="role-archived-badge")
  - [x] Display "System Role" badge on system roles (data-testid="role-system-badge")
  - [x] Archive filter properly synced with URL params
  - [x] Keep view/edit action button in table (navigates to detail page)
- [x] Update RolePage component (detail/edit page) with **data-testid attributes**:
  - [x] Track isArchived and isSystem state when loading role
  - [x] Show "Archived" badge in header if role is archived (data-testid="archived-badge")
  - [x] Show "System Role" badge in header if role is system (data-testid="system-badge")
  - [x] Add "Archive Role" button in header (data-testid="archive-role-btn")
    - Only visible for active custom roles (isSystem: false) with roles:manage permission
    - Hidden for system roles and archived roles
    - Red color, light variant with archive icon
    - Opens confirmation modal before archiving
  - [x] Add archive confirmation modal with warning about active memberships
  - [x] Add "Restore" button for archived roles (data-testid="restore-role-btn")
    - Only visible for archived roles with roles:manage permission
    - Green color with restore icon
  - [x] Save button disabled when role is archived (read-only mode)
  - [x] Form fields work correctly (RoleOverviewTab handles disabled state)
- [x] E2E tests written and passing (admin-web/e2e/auth/role-archival.spec.ts - 10 test cases)
  - [x] Archive custom role from detail page (with confirmation modal)
  - [x] Cancel archive confirmation modal (verify no changes)
  - [x] Restore archived role from detail page
  - [x] Filter dropdown shows only archived roles
  - [x] Filter dropdown shows all roles (active + archived)
  - [x] Show archived badge in list view for archived roles
  - [x] Verify system roles cannot be archived (button hidden)
  - [x] Verify VIEWER role cannot access roles page (RBAC working)
  - [x] Verify archived role is read-only (save button disabled)
  - [x] Clear archive filter resets to default (active only)

### Documentation ✅ COMPLETE

- [x] Update user guide with archive/restore workflows ([roles-permissions.md](../../../docs/branches-users/roles-permissions.md))
- [x] Document archive filter and permissions (added "Archived Filter" section)
- [x] Document system role protection (cannot archive) (updated archiving section)
- [x] Add troubleshooting and common tasks (updated "Common Tasks" and "Troubleshooting")
- [x] Update FAQ with role archival questions ([faq.md](../../../docs/faq.md))
- [x] Added "Can I delete custom roles?" FAQ entry
- [x] Added "Can I restore an archived role?" FAQ entry
- [ ] Update [Database Schema](../../System/database-schema.md) with isArchived field (optional - can be done separately)
- [ ] Update [RBAC System](../../System/rbac-system.md) with custom role archival (optional - can be done separately)

---

## Testing Strategy

### Backend Tests (Jest) ✅ COMPLETE

**Test File:** `api-server/__tests__/routes/roleArchival.test.ts` (17 test cases, all passing)

**Service Layer & API Routes:**
- [x] Archive custom role succeeds
- [x] Archive custom role updates isArchived, archivedAt, archivedByUserId
- [x] Cannot archive system role (isSystem: true) - throws error
- [x] Cannot archive role with active memberships - throws error
- [x] Cannot archive already archived role - throws error
- [x] Restore role clears archive fields
- [x] Cannot restore non-archived role - throws error
- [x] List roles excludes archived by default (active-only)
- [x] List roles with archivedFilter='archived-only' returns only archived
- [x] List roles with archivedFilter='all' returns all roles
- [x] getRole() allows access to archived roles (detail page access)
- [x] Cannot update archived roles - throws error
- [x] Multi-tenant isolation (cannot archive/restore other tenant's roles)
- [x] Permission checks (roles:manage required for all operations)
- [x] DELETE /roles/:id sets isArchived instead of deleting (custom roles only)
- [x] DELETE /roles/:id returns 409 for system roles
- [x] POST /roles/:id/restore restores archived role
- [x] GET /roles with archivedFilter parameter works correctly
- [x] GET /roles/:id returns archived roles

### Frontend Tests (Playwright E2E) ✅ COMPLETE

**Test File:** `admin-web/e2e/auth/role-archival.spec.ts` (10 test cases, all passing)

**User Flows:**
- [x] Archive custom role from detail page (with confirmation modal)
- [x] Cancel archive confirmation (verify no changes made)
- [x] Use archive filter dropdown to show only archived roles
- [x] Use archive filter dropdown to show all roles (active + archived)
- [x] Restore archived role from detail page
- [x] Archived badge displayed correctly in list views
- [x] Archived roles hidden by default in list view (active-only filter default)
- [x] Archive confirmation modal displays with correct messaging
- [x] Clear archive filter resets to default state

**System Role Protection:**
- [x] System roles display "System Role" badge
- [x] System roles do not show archive button
- [x] System roles always shown in active list (cannot be archived)

**Permission-Based UI:**
- [x] Users with roles:manage can archive and restore custom roles
- [x] Users without roles:manage (VIEWER) cannot access roles page
- [x] Archive button only shown for active custom roles
- [x] Restore button only shown for archived roles
- [x] Archived role is read-only (save button disabled)

---

## Success Metrics ✅ ALL COMPLETE

**Backend:**
- [x] Custom roles can be archived without errors
- [x] System roles protected from archival (validation works)
- [x] Backend tests all passing (17 test cases in roleArchival.test.ts)
- [x] Archived roles excluded from active views by default
- [x] Three-way archive filter working (active-only, archived-only, all)
- [x] Restore functionality working with audit trail
- [x] All existing tests continue to pass (backward compatible)

**Frontend:**
- [x] UI shows archive filter dropdown in FilterBar with 3 options
- [x] Archive confirmation modal with membership warning
- [x] System role protection visible in UI (badges, hidden buttons)
- [x] Archived roles accessible on detail pages for restore
- [x] Archive/restore buttons only visible to users with roles:manage
- [x] E2E tests written and passing (10 test cases in role-archival.spec.ts)
- [x] All Playwright tests passing
- [x] RoleFactory helpers added for E2E test cleanup
- [ ] User documentation pending (optional - can be done separately)

---

## Notes & Decisions

**Key Design Decisions:**
- **Custom roles only** - System roles (OWNER, ADMIN, EDITOR, VIEWER) with `isSystem: true` cannot be archived (critical safety check)
- **Active membership check** - Cannot archive role if it has active memberships (prevents orphaned users)
- **Archive terminology** - Using "Archive" in UI instead of "Delete" to clarify it's reversible
- **Three-way filter** - Dropdown with 3 options (active-only, archived-only, all) for better control
- **Archive from detail page** - Archive action on detail page with confirmation modal (consistent with product archival pattern)
- **NO delete from table** - Removed delete action button from table rows (archival happens on detail page, following product pattern)
- **Confirmation modal** - Warning about active memberships: "This role will be hidden from your active role list. Users with this role will need to be reassigned. This action can be reversed."
- **Permission level** - Reusing existing `roles:manage` permission (no new permission needed)
- **Optional tracking fields** - Including archivedAt and archivedByUserId for audit trail
- **Archived role access** - Allow detail page access for restoration
- **Read-only archived roles** - Form fields disabled when role is archived (consistent with product pattern)
- **System role badges** - Visual indicator for system roles (cannot be edited or archived)

**Related Constraints:**
- UserTenantMembership.roleId references Role (foreign key)
- RolePermission uses `onDelete: Cascade` (permission mappings deleted with role - but we archive instead)
- System roles must always be available for RBAC system to function
- Role name uniqueness per tenant (archived role names still reserved)

**Implementation Options for Active Memberships:**

**Option A: Block archival (Recommended)**
- Throw error if role has active memberships
- User must reassign all users to different role first
- Safer, more explicit

**Option B: Auto-reassign**
- Automatically reassign active memberships to default VIEWER role
- More convenient but potentially dangerous (permission reduction)
- Requires audit trail of reassignments

**Decision: Use Option A** - Block archival if active memberships exist. Safer and more transparent.

**Known Limitations:**
- Archived roles remain in database permanently (not a true delete)
- Role name uniqueness still enforced even for archived roles (cannot reuse archived role name)
- Historical memberships still reference archived role (acceptable for audit trail)
- System role protection relies on `isSystem` flag (must be properly seeded)

**Future Enhancements (Out of Scope):**
- Bulk archive/restore operations
- Scheduled permanent deletion of archived roles (after X days)
- Archive reasons/notes field (e.g., "Department restructure", "Permission set merged")
- Archive history timeline (show who archived/restored and when)
- Auto-reassign workflow (safely migrate users from archived role to new role)
- Role usage statistics (show how many users currently have role before archival)
- Smart suggestions: "This role has 0 active users. Archive it?"
- Cascade archival warning: "Archiving this role will affect 15 users"

---

**Template Version:** 1.0
**Created:** 2025-10-17
