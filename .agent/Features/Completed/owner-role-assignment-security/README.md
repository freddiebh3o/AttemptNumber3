# OWNER Role Assignment Security

**Status:** ✅ Complete
**Started:** October 22, 2025
**Completed:** October 22, 2025

## Overview
Implemented authorization controls to restrict OWNER role assignment to only existing OWNER users. This closes a critical privilege escalation vulnerability where ADMIN users (who have `users:manage` permission) could promote themselves or others to OWNER role, bypassing the proper organizational hierarchy.

## Key Features
- **Backend Validation**: Server-side enforcement prevents non-OWNER users from assigning OWNER role
- **Frontend Role Filtering**: OWNER role hidden from dropdown for non-OWNER users
- **Informational UX**: Blue alert message explains the restriction to non-OWNER users
- **Permission Separation**: New `roles:read` permission allows listing roles without managing them
- **Defense in Depth**: Both backend enforcement AND frontend UX controls
- **Zero Privilege Escalation**: ADMIN users cannot self-promote or promote others to OWNER

## Implementation
### Backend
- **New Permission**: Added `roles:read` permission for viewing/listing roles (separate from `roles:manage`)
- **RBAC Catalog Updates**: Updated OWNER and ADMIN roles to include `roles:read` permission
- **Service Validation**: Created `requireOwnerRoleToAssignOwner()` function in `tenantUserService.ts`
  - Checks if target role is OWNER (by name)
  - Verifies current user has OWNER role before allowing assignment
  - Throws 403 error with clear message if unauthorized
- **API Endpoints**:
  - `POST /api/tenant-users` - Validates role assignment before creating user
  - `PUT /api/tenant-users/:userId` - Validates role assignment before updating user
  - `GET /api/roles` - Changed from `roles:manage` to `roles:read` permission
- **Error Handling**: Custom error `cantAssignOwnerRole()` with HTTP 403 status
- **Router Updates**: `tenantUserRouter.ts` now passes `currentUserId` to service functions

### Frontend
- **Role Filtering**: `TenantUserPage.tsx` filters OWNER role from dropdown based on current user's role
- **Current User Role Detection**: Uses `useAuthStore` to get `currentTenant.role.name`
- **Informational Alert**: Blue alert displayed to non-OWNER users explaining the restriction
- **Data-testid Attributes**: Added `role-select` and `owner-assignment-info` for E2E testing
- **Graceful UX**: Non-OWNER users see filtered list without errors, with helpful context

## Test Coverage
- **25 passing tests** (14 backend + 11 frontend E2E)
- **Backend Tests (Jest)**:
  - Service Layer: 7 new tests for OWNER assignment authorization
  - Permission Layer: 7 new tests for HTTP endpoint RBAC matrix
  - Multi-tenant isolation and error message validation
  - Existing OWNER protection logic still works
- **Frontend Tests (Playwright E2E)**:
  - Frontend UX Tests (6 tests): Role dropdown visibility and info messages
  - Backend Enforcement Tests (5 tests): API-level security validation
  - Full flow tests: OWNER can create users with OWNER role
  - Security tests: ADMIN direct API attempts return 403
- 100% coverage of OWNER assignment restriction

## Documentation
- [PRD](./prd.md) - Complete implementation plan with both phases
- [RBAC System Documentation](../../System/rbac-system.md#1-owner-role-assignment-protection) - Technical security details
- [Managing Users Guide](../../../docs/branches-users/managing-users.md#owner-role-assignment-security) - End-user documentation
- [Roles & Permissions Guide](../../../docs/branches-users/roles-permissions.md) - Updated role descriptions

## Key Files
### Backend
- `api-server/src/rbac/catalog.ts` - Added `roles:read` permission, updated role definitions
- `api-server/src/routes/roleRouter.ts` - Changed `GET /api/roles` to use `roles:read`
- `api-server/src/services/tenantUsers/tenantUserService.ts` - OWNER assignment validation logic
- `api-server/src/utils/httpErrors.ts` - Added `cantAssignOwnerRole()` error
- `api-server/src/routes/tenantUserRouter.ts` - Pass `currentUserId` parameter
- `api-server/__tests__/features/tenantUsers/tenantUserService.test.ts` - 7 new service tests
- `api-server/__tests__/permissions/tenantUsers.permissions.test.ts` - 7 new permission tests

### Frontend
- `admin-web/src/pages/TenantUserPage.tsx` - Role filtering + informational alert
- `admin-web/e2e/users/owner-role-assignment.spec.ts` - Comprehensive E2E tests (11 tests)
- `admin-web/e2e/helpers/factories.ts` - Used existing TenantUserFactory and RoleFactory

### Documentation
- `.agent/System/rbac-system.md` - Added OWNER assignment protection section
- `docs/branches-users/managing-users.md` - Added OWNER role assignment security section
- `docs/branches-users/roles-permissions.md` - Updated role descriptions with security notes

## Architecture Decisions
- **Server-side Enforcement Primary**: Backend validation is the primary defense; frontend filtering is UX enhancement
- **Check by Role Name**: Uses `role.name === 'OWNER'` rather than permission checks (permissions can be customized)
- **Permission Separation**: `roles:read` for viewing, `roles:manage` for CRUD (principle of least privilege)
- **Graceful UX Degradation**: Non-OWNER users see filtered list with info message (not error messages)
- **Tenant-scoped Validation**: OWNER check happens within current tenant context (multi-tenant isolation)
- **Defense in Depth**: Both backend AND frontend controls (backend enforcement, frontend UX filtering)
- **Error Clarity**: Clear 403 error messages explain the restriction to developers and users

## Security
- ✅ Closes privilege escalation vulnerability (ADMIN → OWNER)
- ✅ Server-side enforcement (backend validation required)
- ✅ Frontend UX filtering (prevents confusion)
- ✅ Multi-tenant isolation (OWNER check is tenant-scoped)
- ✅ Permission-based (requires `users:manage` + OWNER role)
- ✅ Audit trail preserved (no changes to audit logging)
- ✅ API bypass protection (direct API calls return 403)
- ✅ Comprehensive test coverage (25 tests)

## Known Limitations
- None - this fully closes the identified security gap

## Future Enhancements (Out of Scope)
- Audit log alert when OWNER role is assigned (separate monitoring feature)
- Two-factor confirmation for OWNER role assignment (separate UX enhancement)
- Transfer OWNER role workflow with approval process (separate governance feature)
- Owner-initiated role transfer (passing ownership with confirmation)

## Notes
Built with security-first approach including comprehensive backend validation, frontend UX improvements, extensive test coverage (25 tests), complete documentation updates, and zero regressions. This feature eliminates a critical privilege escalation path while maintaining excellent user experience through informative UI feedback.

**Key Insight:** Required adding `roles:read` permission to fix "Failed to load roles" error for ADMIN users. This separation of concerns (`roles:read` vs `roles:manage`) follows the principle of least privilege and allows ADMIN users to view roles for assignment without the ability to create or modify role definitions.
