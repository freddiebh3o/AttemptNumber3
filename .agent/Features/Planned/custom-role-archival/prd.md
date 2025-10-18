# Custom Role Archival (Soft Delete) - Implementation Plan

**Status:** 📋 Planning
**Priority:** Medium
**Estimated Effort:** 1-2 days
**Created:** 2025-10-17
**Last Updated:** 2025-10-17

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

### Backend Implementation

- [ ] Database schema changes (create migration: `add_role_archival`)
  - [ ] Add `isArchived Boolean @default(false)` to Role model
  - [ ] Add `archivedAt DateTime?` (optional, for tracking when)
  - [ ] Add `archivedByUserId String?` (optional, for tracking who)
  - [ ] Add index on `isArchived` for query performance: `@@index([tenantId, isArchived])`
- [ ] Prisma client regeneration
- [ ] Update `roleService.ts`:
  - [ ] Update list queries to filter `isArchived: false` by default
  - [ ] Update `deleteRole()` to set `isArchived: true` instead of hard delete
  - [ ] Add validation: CANNOT archive if `isSystem: true` (throw error)
  - [ ] Add validation: CANNOT archive if role has active memberships (throw error or auto-reassign)
  - [ ] Add `restoreRole()` function (sets isArchived: false, clears archivedAt)
  - [ ] Add `archivedFilter` parameter with 3 modes: "active-only" (default), "archived-only", "all"
  - [ ] Allow `getRole()` to return archived roles (needed for detail page access)
  - [ ] Role selection for new memberships excludes archived roles
- [ ] Update OpenAPI schemas:
  - [ ] Add `archivedFilter` enum query parameter to GET /roles
  - [ ] Add POST `/roles/:id/restore` endpoint schema
  - [ ] Update Role response schema to include isArchived fields
- [ ] Update routes:
  - [ ] Change DELETE `/roles/:id` to call archiveRole (requires `roles:manage`)
  - [ ] Add POST `/roles/:id/restore` endpoint (requires `roles:manage`)
  - [ ] Add `archivedFilter` query param support to GET `/roles`
- [ ] Backend tests written and passing
  - [ ] Archive custom role (should succeed)
  - [ ] Cannot archive system role (isSystem: true throws error)
  - [ ] Cannot archive role with active memberships (throws error)
  - [ ] Restore archived role
  - [ ] List roles filters archived by default
  - [ ] List roles with archivedFilter='archived-only' shows only archived
  - [ ] List roles with archivedFilter='all' shows all roles
  - [ ] getRole() allows access to archived roles
  - [ ] Role selection excludes archived roles
  - [ ] Permission checks (multi-tenant isolation)
  - [ ] Audit trail preservation (UPDATE events for restore)
- [ ] Confirm all backend tests pass before moving to frontend

### Frontend Implementation

- [ ] OpenAPI types regenerated (`npm run openapi:gen`)
- [ ] Update `api/roles.ts`:
  - [ ] Add `restoreRole()` function
  - [ ] Add `archivedFilter` parameter to `listRoles()`
- [ ] Update RolesPage component (list view):
  - [ ] Add archive filter dropdown in FilterBar with 3 options:
    - "Active roles only" (active-only - default)
    - "Archived roles only" (archived-only)
    - "All roles (active + archived)" (all)
  - [ ] Display "Archived" badge on roles in table (data-testid="archived-badge")
  - [ ] Display "System Role" badge on system roles (data-testid="system-role-badge")
  - [ ] Archive filter properly synced with URL params
- [ ] Update RoleDetailPage component (detail/edit page) with **data-testid attributes**:
  - [ ] Track isArchived and isSystem state when loading role
  - [ ] Show "Archived" badge in header if role is archived (data-testid="archived-badge")
  - [ ] Show "System Role" badge in header if role is system (data-testid="system-role-badge")
  - [ ] Add "Archive Role" button in header (data-testid="archive-role-btn")
    - Only visible for active custom roles (isSystem: false) with roles:manage permission
    - Hidden for system roles
    - Red color, light variant with archive icon
    - Opens confirmation modal before archiving
  - [ ] Add archive confirmation modal with warning about active memberships
  - [ ] Add "Restore" button for archived roles (data-testid="restore-btn")
  - [ ] Hide Save button when role is archived
  - [ ] Hide Delete button when role is system (isSystem: true)
- [ ] Update role selection components:
  - [ ] Role dropdown for user membership assignment excludes archived roles
  - [ ] Show only active custom roles in role picker
- [ ] E2E tests written and passing
  - [ ] Archive custom role from detail page (with confirmation modal)
  - [ ] Cancel archive confirmation modal (verify no changes)
  - [ ] Restore archived role from detail page
  - [ ] Filter dropdown shows only archived roles
  - [ ] Filter dropdown shows all roles (active + archived)
  - [ ] Verify archived roles accessible via direct URL
  - [ ] Verify system roles cannot be archived (button hidden)
  - [ ] Verify permission checks for archive/restore actions (VIEWER role)
  - [ ] Verify archived roles not shown in role picker
  - [ ] Clear archive filter resets to default (active only)

### Documentation

- [ ] Update user guide with archive/restore workflows
- [ ] Document archive filter and permissions
- [ ] Document system role protection (cannot archive)
- [ ] Add troubleshooting and common tasks
- [ ] Update [Database Schema](../../System/database-schema.md) with isArchived field (optional)
- [ ] Update [RBAC System](../../System/rbac-system.md) with custom role archival

---

## Testing Strategy

### Backend Tests (Jest)

**Service Layer:**
- [ ] Archive custom role succeeds
- [ ] Archive custom role updates isArchived, archivedAt, archivedByUserId
- [ ] Cannot archive system role (isSystem: true) - throws error
- [ ] Cannot archive role with active memberships - throws error
- [ ] Restore role clears archive fields
- [ ] List roles excludes archived by default
- [ ] List roles with archivedFilter='archived-only' returns only archived
- [ ] List roles with archivedFilter='all' returns all roles
- [ ] getRole() allows access to archived roles
- [ ] Role selection for memberships excludes archived roles
- [ ] Multi-tenant isolation (cannot archive other tenant's roles)
- [ ] Audit trail preservation (UPDATE events for restore)

**API Routes:**
- [ ] DELETE /roles/:id sets isArchived instead of deleting (custom roles only)
- [ ] DELETE /roles/:id returns 400 for system roles
- [ ] POST /roles/:id/restore restores archived role
- [ ] GET /roles with archivedFilter parameter works correctly
- [ ] GET /roles/:id returns archived roles (for detail page access)

### Frontend Tests (Playwright E2E)

**User Flows:**
- [ ] Archive custom role from detail page (with confirmation modal)
- [ ] Cancel archive confirmation (verify no changes made)
- [ ] Use archive filter dropdown to show only archived roles
- [ ] Use archive filter dropdown to show all roles (active + archived)
- [ ] Restore archived role from detail page
- [ ] Archived badge displayed correctly in list views
- [ ] Archived roles hidden by default in list view
- [ ] Archived roles accessible via direct URL to detail page
- [ ] Archive confirmation modal displays with correct messaging
- [ ] Clear archive filter resets to default state

**System Role Protection:**
- [ ] System roles display "System Role" badge
- [ ] System roles do not show archive button
- [ ] System roles always shown in active list (cannot be archived)

**Role Selection:**
- [ ] Archived roles not shown in role picker for user membership assignment
- [ ] Active roles shown in role picker
- [ ] System roles always shown in role picker

**Permission-Based UI:**
- [ ] Users with roles:manage can archive and restore custom roles
- [ ] Users without roles:manage (VIEWER) cannot see archive/restore buttons
- [ ] Archive button only shown for active custom roles
- [ ] Restore button only shown for archived roles

---

## Success Metrics

- [ ] Custom roles can be archived without errors
- [ ] System roles protected from archival (validation works)
- [ ] Backend tests all passing (role service tests)
- [ ] Archived roles excluded from active views by default
- [ ] Three-way archive filter working (active-only, archived-only, all)
- [ ] Restore functionality working with audit trail
- [ ] All existing tests continue to pass (backward compatible)
- [ ] UI shows archive filter dropdown in FilterBar
- [ ] Archive confirmation modal with membership warning
- [ ] Archived roles excluded from role picker (UX improvement)
- [ ] System role protection visible in UI (badges, hidden buttons)
- [ ] Archived roles accessible on detail pages for restore
- [ ] Archive/restore buttons only visible to users with roles:manage
- [ ] E2E tests written and passing (comprehensive Playwright tests)
- [ ] User documentation updated with archive workflows and system role protection

---

## Notes & Decisions

**Key Design Decisions:**
- **Custom roles only** - System roles (OWNER, ADMIN, EDITOR, VIEWER) with `isSystem: true` cannot be archived (critical safety check)
- **Active membership check** - Cannot archive role if it has active memberships (prevents orphaned users)
- **Archive terminology** - Using "Archive" in UI instead of "Delete" to clarify it's reversible
- **Three-way filter** - Dropdown with 3 options (active-only, archived-only, all) for better control
- **Archive from detail page** - Archive action on detail page with confirmation modal (consistent with other archival features)
- **Confirmation modal** - Warning about active memberships: "This role will be hidden from your active role list. Users with this role will need to be reassigned. This action can be reversed."
- **Permission level** - Reusing existing `roles:manage` permission (no new permission needed)
- **Optional tracking fields** - Including archivedAt and archivedByUserId for audit trail
- **Archived role access** - Allow detail page access for restoration
- **Role picker exclusion** - Archived roles excluded from role selection dropdown (key UX improvement)
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
