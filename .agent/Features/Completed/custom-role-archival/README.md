# Custom Role Archival (Soft Delete)

**Status:** ✅ Complete
**Started:** October 17, 2025
**Completed:** October 19, 2025

## Overview
Implemented soft delete (archive) pattern for custom roles to safely remove unused roles from active views while preserving all historical audit data and role assignment records. Custom roles can now be archived and restored without any data loss. System roles (OWNER, ADMIN, EDITOR, VIEWER) cannot be archived.

## Key Features
- **Archive Custom Roles**: Hide custom roles from active views with confirmation modal
- **Restore Archived Roles**: Return archived roles to active status instantly
- **Three-way Filter**: View active-only, archived-only, or all roles via dropdown
- **System Role Protection**: OWNER, ADMIN, EDITOR, VIEWER cannot be archived (`isSystem: true`)
- **Prevent Archive with Active Users**: Roles with user assignments cannot be archived (CONFLICT error)
- **Read-only Mode**: Archived roles become read-only until restored
- **Preserved Audit Trail**: All role activity history remains intact
- **Permission-based**: Archive/restore buttons only visible to users with `roles:manage`
- **Accessible**: Archived roles accessible via direct URL for restoration

## Implementation

### Backend
- **Database Migration**: Added `isArchived`, `archivedAt`, `archivedByUserId` fields to Role model with index on `[tenantId, isArchived]`
- **Service Updates**: Modified `roleService.ts` with archive/restore functions and `archivedFilter` parameter
- **Validation**: Prevent archiving system roles and roles with active user assignments
- **API Endpoints**:
  - `DELETE /api/roles/:id` - Archives role (soft delete)
  - `POST /api/roles/:id/restore` - Restores archived role
  - `GET /api/roles` - Supports `archivedFilter` query parameter (active-only, archived-only, all)
  - `GET /api/roles/:id` - Returns archived roles (needed for restoration)
- **Audit Trail**: Archive uses DELETE action, restore uses UPDATE action

### Frontend
- **Archive from Detail Page**: Archive button with confirmation modal explaining impact and reversibility
- **Filter Dropdown**: Three-way archive filter in Roles page FilterBar
- **Restore Button**: Green restore button on archived role detail pages
- **View-only List Actions**: Removed delete button from table rows (archive only from detail page)
- **Archived Badge**: Red badge displayed on archived roles in list and detail views
- **System Badge**: Blue badge displayed on system roles (OWNER, ADMIN, EDITOR, VIEWER)
- **Read-only View**: Save button disabled when viewing archived roles
- **Data-testid Attributes**: Added for E2E testing (archived-badge, archive-role-btn, restore-role-btn, view-role-btn)

## Test Coverage
- **27 passing tests** (17 backend + 10 frontend E2E)
- **Backend Tests (Jest)**: Archive/restore operations, archivedFilter modes, system role protection, active membership blocking, permissions, multi-tenant isolation, idempotency, audit trail
- **Frontend Tests (Playwright E2E)**: Archive flow, restore flow, filter dropdown, confirmation modal, badge display, read-only mode, system role protection, RBAC checks, isolated test data
- **Test Isolation**: All E2E tests use RoleFactory to create/cleanup test data (no seed data modification)
- 100% coverage of archive/restore functionality

## Documentation
- [PRD](./prd.md) - Complete implementation plan and notes
- [User Guide - Roles & Permissions](../../../docs/branches-users/roles-permissions.md#archiving-custom-roles) - End-user documentation for archiving
- [User Guide - Restoring Roles](../../../docs/branches-users/roles-permissions.md#restoring-archived-roles) - End-user documentation for restoring
- [FAQ - Can I delete custom roles?](../../../docs/faq.md) - Quick archive instructions
- [FAQ - Can I restore an archived role?](../../../docs/faq.md) - Quick restore instructions

## Key Files

### Backend
- `api-server/prisma/migrations/20251018230848_add_role_archival/migration.sql` - Database schema
- `api-server/src/services/role/roleService.ts` - Archive/restore logic
- `api-server/src/routes/roleRouter.ts` - API endpoints
- `api-server/src/openapi/paths/roles.ts` - OpenAPI path definitions
- `api-server/src/openapi/schemas/roles.ts` - OpenAPI schemas
- `api-server/__tests__/routes/roleArchival.test.ts` - Backend tests (17 comprehensive tests)

### Frontend
- `admin-web/src/pages/RolesPage.tsx` - Archive filter dropdown, View button, archived badge, system badge
- `admin-web/src/pages/RolePage.tsx` - Archive/restore buttons, modal, read-only mode, badges
- `admin-web/src/api/roles.ts` - API client functions (restore, archivedFilter)
- `admin-web/e2e/helpers/factories.ts` - RoleFactory with create/delete helpers
- `admin-web/e2e/auth/role-archival.spec.ts` - E2E tests (10 comprehensive tests)

### Documentation
- `docs/branches-users/roles-permissions.md` - Updated user guide with archive/restore workflows
- `docs/faq.md` - Added archive and restore FAQ entries

## Architecture Decisions
- **Soft Delete Over Hard Delete**: Preserves audit trail for role activity and historical user assignments
- **Archive Terminology**: Using "Archive" in UI instead of "Delete" to clarify reversibility
- **Three-way Filter**: Dropdown with 3 modes (active-only, archived-only, all) for better control
- **Archive from Detail Page**: Action moved from list to detail page with confirmation modal
- **Confirmation Modal**: User-friendly explanation of impact and reversibility
- **System Role Protection**: System roles (OWNER, ADMIN, EDITOR, VIEWER) cannot be archived at all
- **Active Membership Blocking**: Roles with active user assignments cannot be archived (user must reassign first)
- **Permission Level**: Using `roles:manage` permission (consistent with role editing)
- **View-only List Actions**: Removed delete button from table rows (consistent with branch/product archival pattern)
- **Detail Page Actions**: All modification actions (Archive, Restore) consolidated in detail page header
- **Read-only Archived View**: Archived roles shown in read-only mode (save button disabled)
- **Test Data Isolation**: RoleFactory creates unique test roles for each test (no seed data pollution)

## Security
- ✅ Multi-tenant isolation (archive only tenant's roles)
- ✅ Permission-based access (`roles:manage` required)
- ✅ System role protection (cannot archive OWNER, ADMIN, EDITOR, VIEWER)
- ✅ Active membership validation (cannot archive roles assigned to users)
- ✅ Audit trail preservation (archivedAt, archivedByUserId tracked)
- ✅ Foreign key constraints respected (no data loss)
- ✅ Idempotent operations (safe to archive/restore multiple times)

## Known Limitations
- Archived roles remain in database permanently (not true deletion)
- Role name uniqueness constraint still applies to archived roles
- Bulk archive/restore operations not implemented (future enhancement)
- Users must manually reassign all users before archiving a role (no bulk reassignment UI)

## Related Features
- **Product Archival** - Similar archive/restore pattern implemented for products
- **Branch Archival** - Similar archive/restore pattern implemented for branches
- **User Archival** - Similar archive/restore pattern implemented for tenant users
- **RBAC System** - Preserved role activity history remains intact for archived roles
- **Approval Rule Archival** - Similar archive/restore pattern implemented for approval rules

## Notes
Built with production-grade patterns including comprehensive confirmation modals, three-way filtering, complete test coverage with isolated test data, and extensive user documentation. Fully integrated with existing RBAC, multi-tenant architecture, and audit system.

**Key Insight:** Roles with active user assignments cannot be archived due to referential integrity and RBAC enforcement. The archive pattern solves cleanup needs by hiding unused roles from active operations while preserving all historical data for reporting and audit purposes. This prevents accidental permission loss and maintains complete audit trail.

**Technical Highlight:** Archive/restore operations use the existing DELETE and UPDATE audit actions, avoiding new audit action types while maintaining clear semantic meaning in the audit trail.
