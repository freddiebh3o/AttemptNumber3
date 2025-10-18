# User Archival (Per-Tenant Soft Delete)

**Status:** ✅ Complete
**Started:** October 17, 2025
**Completed:** October 18, 2025

## Overview
Implemented per-tenant user deactivation (soft delete) pattern to safely remove user access while preserving complete audit trails and historical data. Users with stock movements, transfers, and approval history can now be archived and restored without data loss or foreign key violations.

## Key Features
- **Archive Users**: Deactivate user memberships with confirmation modal
- **Restore Users**: Reactivate archived user memberships instantly
- **Three-way Filter**: View active, archived, or all users via dropdown
- **Authentication Blocking**: Archived users cannot sign in (clear error message)
- **Preserved Data**: All audit logs, stock movements, transfers, and activity history remain intact
- **Permission-based**: Archive/restore actions require `users:manage` permission
- **Self-protection**: Cannot archive own membership (prevents lockout)

## Implementation
### Backend
- **Database Migration**: Added `isArchived`, `archivedAt`, `archivedByUserId` fields to UserTenantMembership model
- **Service Updates**: Modified `tenantUserService.ts` with archive/restore functions and `archivedFilter` parameter
- **Authentication**: Updated `authService.ts` to reject archived memberships during sign-in and filter from tenant switcher
- **API Endpoints**:
  - `DELETE /api/tenant-users/:userId` - Archives user membership (soft delete)
  - `POST /api/tenant-users/:userId/restore` - Restores archived membership
  - `GET /api/tenant-users` - Supports `archivedFilter` query parameter (active-only, archived-only, all)
- **Error Messages**: Custom error message "Invalid credentials or your membership has been archived"

### Frontend
- **Archive from Detail Page**: Archive button with confirmation modal on TenantUserPage
- **Filter Dropdown**: Three-way filter in Users page FilterBar (active-only, archived-only, all)
- **Restore Button**: Blue restore button on archived user detail pages
- **Archived Badge**: Gray badge displayed on archived users in list and detail views
- **Warning Alert**: Yellow alert on archived user detail page explaining deactivation
- **Data-testid Attributes**: Added for E2E testing (archived-badge, archive-user-btn, restore-btn)
- **Table Cleanup**: Removed delete button from users table (archive only from detail page)

## Test Coverage
- **47 passing tests** (19 backend + 28 frontend E2E)
- **Backend Tests (Jest)**: Service layer, auth blocking, API routes, permissions, multi-tenant isolation, owner protection
- **Frontend Tests (Playwright E2E)**:
  - Archive/restore flows with confirmation
  - Filter dropdown (active, archived, all)
  - Permission checks (VIEWER, EDITOR, ADMIN, OWNER)
  - Self-archival prevention
  - Archived user sign-in blocking
  - General user management (search, filter, sort, pagination)
- 100% coverage of archive/restore functionality

## Documentation
- [PRD](./prd.md) - Complete implementation plan and implementation summary
- [User Guide](../../docs/branches-users/managing-users.md#archiving-a-user) - Comprehensive end-user documentation
- [FAQ](../../docs/faq.md) - Archive/restore Q&A
- [Main README](../../docs/README.md) - Updated monthly tasks

## Key Files
### Backend
- `api-server/prisma/migrations/.../add_user_membership_archival/migration.sql` - Database schema
- `api-server/src/services/tenantUsers/tenantUserService.ts` - Archive/restore logic
- `api-server/src/services/authService.ts` - Authentication blocking
- `api-server/src/routes/authRouter.ts` - Error message updates
- `api-server/src/routes/tenantUserRouter.ts` - API endpoints
- `api-server/src/openapi/paths/tenantUsers.ts` - OpenAPI schemas
- `api-server/__tests__/routes/tenant-users-archival.test.ts` - Comprehensive tests (19 tests)

### Frontend
- `admin-web/src/pages/TenantUsersPage.tsx` - Archive filter dropdown and archived badge
- `admin-web/src/pages/TenantUserPage.tsx` - Archive/restore buttons and modal
- `admin-web/src/api/tenantUsers.ts` - API client functions
- `admin-web/e2e/users/user-archival.spec.ts` - Archive-specific E2E tests (10 tests)
- `admin-web/e2e/users/user-management.spec.ts` - General user management E2E tests (18 tests)
- `admin-web/e2e/helpers/factories.ts` - TenantUserFactory for test data
- `admin-web/e2e/helpers/selectors.ts` - USER selectors

### Documentation
- `docs/branches-users/managing-users.md` - Complete archival workflows and troubleshooting
- `docs/faq.md` - Archival Q&A
- `docs/README.md` - Monthly tasks updated

## Architecture Decisions
- **Membership-level Archival**: Archive at UserTenantMembership level (not global User) for per-tenant deactivation
- **Authentication Blocking**: Archived memberships rejected during sign-in (critical security requirement)
- **Archive Terminology**: Using "Archive" in UI instead of "Delete" to clarify reversibility
- **Three-way Filter**: Dropdown with 3 options (active-only, archived-only, all) for better control
- **Archive from Detail Page**: Action on detail page with confirmation modal (consistent with product archival pattern)
- **Confirmation Modal**: User-friendly explanation with security warning
- **Permission Reuse**: Using existing `users:manage` permission (no new permission needed)
- **Self-archival Prevention**: Cannot archive own membership (safety check to prevent lockout)
- **Optional Tracking Fields**: Including archivedAt and archivedByUserId for audit trail
- **Tenant Switcher Filtering**: Archived memberships hidden from tenant switcher dropdown
- **Clear Error Messages**: Custom message mentioning archived status to prevent confusion

## Security
- ✅ Multi-tenant isolation (archive only within own tenant)
- ✅ Permission-based access (`users:manage` required)
- ✅ Audit trail preservation (archivedAt, archivedByUserId tracked)
- ✅ Authentication blocking (archived users cannot sign in)
- ✅ Self-protection (cannot archive own membership)
- ✅ Owner role protection (prevent archiving last active owner)
- ✅ Foreign key constraints respected (no data loss)

## Known Limitations
- Archived memberships remain in database permanently (not true deletion)
- Email uniqueness constraint at User level (cannot reuse email even if all memberships archived)
- User global entity remains even if all tenant memberships archived (orphan users possible)
- Stock movements/transfers still reference archived user in history (acceptable for audit trail)
- Bulk archive/restore operations not implemented (future enhancement)

## Future Enhancements (Out of Scope)
- Bulk archive/restore operations
- Scheduled permanent deletion of archived memberships (after X days)
- Archive reasons/notes field (e.g., "Terminated employment", "Role change")
- Archive history timeline (show who archived/restored and when)
- Email notification to archived user
- Cascade archival to UserBranchMembership records
- Global user cleanup (delete User if all memberships archived)
- Re-invitation workflow (restore archived membership when user re-joins company)

## Notes
Built with production-grade patterns including authentication security, comprehensive test coverage (47 tests), complete user documentation, and full integration with existing RBAC, multi-tenant architecture, and audit system. Follows the same proven pattern as product archival with enhanced security for user access control.
