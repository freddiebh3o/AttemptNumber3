# OWNER Role Assignment Security - Implementation Plan

**Status:** ✅ Complete (All Phases)
**Priority:** High (Security Issue)
**Estimated Effort:** 1-2 days
**Created:** 2025-10-22
**Last Updated:** 2025-10-22

---

## Overview

Implement authorization controls to restrict OWNER role assignment to only existing OWNER users. Currently, any user with `users:manage` permission (OWNER and ADMIN) can assign the OWNER role to any user, including themselves, creating a critical privilege escalation vulnerability. This feature adds backend validation and frontend UX improvements to ensure only OWNER users can create or promote users to OWNER role.

**Key Capabilities:**
- OWNER users can assign OWNER role to new or existing users (preserved)
- ADMIN users are blocked from assigning OWNER role (new enforcement)
- Custom roles with `users:manage` cannot assign OWNER role (new enforcement)
- Frontend hides OWNER role from non-OWNER users in role selectors (improved UX)

**Related Documentation:**
- [System/rbac-system.md](../../System/rbac-system.md) - RBAC architecture and role hierarchy
- [System/database-schema.md](../../System/database-schema.md) - UserTenantMembership and Role models
- [SOP/backend-testing.md](../../SOP/backend-testing.md) - Backend testing patterns

---

## Phase 1: Backend Security Enforcement

**Goal:** Add server-side validation to prevent non-OWNER users from assigning OWNER role

**Relevant Files:**
- [api-server/src/services/tenantUsers/tenantUserService.ts](../../../api-server/src/services/tenantUsers/tenantUserService.ts)
- [api-server/src/utils/httpErrors.ts](../../../api-server/src/utils/httpErrors.ts)
- [api-server/__tests__/features/tenantUsers/tenantUserService.test.ts](../../../api-server/__tests__/features/tenantUsers/tenantUserService.test.ts)
- [api-server/__tests__/permissions/tenantUsers.permissions.test.ts](../../../api-server/__tests__/permissions/tenantUsers.permissions.test.ts)

### Backend Implementation

- [x] Analyze existing tests in `tenantUserService.test.ts` to identify any that may conflict with new validation
- [x] Analyze existing tests in `tenantUsers.permissions.test.ts` for current OWNER assignment coverage
- [x] Add new error type in `httpErrors.ts`: `cantAssignOwnerRole()` with appropriate message
- [x] Create helper function `requireOwnerRoleToAssignOwner()` in `tenantUserService.ts`:
  - Accepts `currentUserId`, `currentTenantId`, `targetRoleId`
  - Checks if target role is OWNER (by name)
  - If target is OWNER, verify current user has OWNER role
  - Throws `cantAssignOwnerRole()` if unauthorized
- [x] Update `createOrAttachUserToTenantService()` to call validation before role assignment
- [x] Update `updateTenantUserService()` to call validation before role change
- [x] Backend tests written (service layer - 7 tests)
- [x] Backend tests written (permissions layer - 7 tests)
- [x] Fixed existing tests to work with new validation (added currentUserId parameter, updated last OWNER tests)
- [x] Confirm all existing tests still pass (40/40 service tests + 50/50 permission tests = 90/90 passing ✅)

### Testing Coverage

**New Service Layer Tests (in `tenantUserService.test.ts`):**
- [x] OWNER can create new user with OWNER role (should succeed)
- [x] OWNER can update existing user to OWNER role (should succeed)
- [x] ADMIN cannot create new user with OWNER role (should fail with 403)
- [x] ADMIN cannot update existing user to OWNER role (should fail with 403)
- [x] Custom role with `users:manage` cannot assign OWNER role (should fail with 403)
- [x] ADMIN can still assign non-OWNER roles (ADMIN, EDITOR, VIEWER) (should succeed)

**New Permission Tests (in `tenantUsers.permissions.test.ts`):**
- [x] POST /api/tenant-users - ADMIN with OWNER roleId should return 403
- [x] POST /api/tenant-users - OWNER with OWNER roleId should return 201
- [x] POST /api/tenant-users - Custom role with users:manage attempting OWNER assignment should return 403
- [x] POST /api/tenant-users - ADMIN creating user with non-OWNER role should return 201
- [x] PUT /api/tenant-users/:userId - ADMIN changing role to OWNER should return 403
- [x] PUT /api/tenant-users/:userId - OWNER changing role to OWNER should return 200
- [x] PUT /api/tenant-users/:userId - ADMIN changing role to non-OWNER should return 200

### Documentation

- [ ] Update [System/rbac-system.md](../../System/rbac-system.md) to document OWNER assignment restriction
- [ ] Update [docs/branches-users/managing-users.md](../../../docs/branches-users/managing-users.md) if it covers role assignment

### Phase 1 Summary (COMPLETE ✅)

**Implementation Completed:**
- ✅ New error type: `cantAssignOwnerRole()` (HTTP 403, clear user message)
- ✅ Security validation function: `requireOwnerRoleToAssignOwner()` (checks role by name, validates current user is OWNER)
- ✅ Updated `createOrAttachUserToTenantService()` with OWNER assignment check
- ✅ Updated `updateTenantUserService()` with OWNER assignment check
- ✅ Updated `tenantUserRouter.ts` to pass `currentUserId` parameter

**Test Coverage Added:**
- ✅ 7 new service layer tests (OWNER assignment authorization)
- ✅ 7 new permission tests (HTTP endpoint RBAC matrix)
- ✅ Fixed 9 existing service tests (added required `currentUserId` parameter)
- ✅ Fixed 2 last OWNER protection tests (account for actorUser being OWNER)

**Test Results:**
- ✅ Service tests: 40/40 passing (33 existing + 7 new)
- ✅ Permission tests: 50/50 passing (43 existing + 7 new)
- ✅ Total: 90/90 tests passing

**Security Vulnerability Closed:**
- ✅ ADMIN users can no longer assign OWNER role (returns 403)
- ✅ Custom roles with `users:manage` cannot assign OWNER role (returns 403)
- ✅ Only OWNER users can assign OWNER role to others (enforced server-side)
- ✅ No privilege escalation paths via role assignment

**Files Modified:**
- [api-server/src/utils/httpErrors.ts](../../../api-server/src/utils/httpErrors.ts) - Added `cantAssignOwnerRole()`
- [api-server/src/services/tenantUsers/tenantUserService.ts](../../../api-server/src/services/tenantUsers/tenantUserService.ts) - Added validation + updated signature
- [api-server/src/routes/tenantUserRouter.ts](../../../api-server/src/routes/tenantUserRouter.ts) - Pass `currentUserId`
- [api-server/__tests__/features/tenantUsers/tenantUserService.test.ts](../../../api-server/__tests__/features/tenantUsers/tenantUserService.test.ts) - 7 new + 11 fixed tests
- [api-server/__tests__/permissions/tenantUsers.permissions.test.ts](../../../api-server/__tests__/permissions/tenantUsers.permissions.test.ts) - 7 new tests

---

## Phase 2: Frontend UX Improvements

**Goal:** Hide OWNER role from non-OWNER users in role selection UI and provide helpful feedback

**Relevant Files:**
- [admin-web/src/pages/TenantUserPage.tsx](../../../admin-web/src/pages/TenantUserPage.tsx)
- [admin-web/e2e/users/owner-role-assignment.spec.ts](../../../admin-web/e2e/users/owner-role-assignment.spec.ts)
- [api-server/src/rbac/catalog.ts](../../../api-server/src/rbac/catalog.ts)
- [api-server/src/routes/roleRouter.ts](../../../api-server/src/routes/roleRouter.ts)

### Prerequisites

- [x] Confirm all backend tests are passing before starting frontend work (✅ 90/90 tests passing)

### Backend Permission Fix (Required for Phase 2)

- [x] Add `roles:read` permission to RBAC catalog for listing roles
- [x] Update OWNER role to include `roles:read` permission
- [x] Update ADMIN role to include `roles:read` permission (needed for role dropdown)
- [x] Update `GET /api/roles` endpoint to require `roles:read` instead of `roles:manage`
- [x] Run RBAC seed to update permissions in database

### Frontend Implementation

- [x] Analyze existing E2E tests in `user-management.spec.ts` to identify tests that may need updating
- [x] Add `currentUserRole` state to TenantUserPage (from `useAuthStore`)
- [x] Filter `roleChoices` to exclude OWNER role if `currentUserRole !== 'OWNER'`
- [x] Add `data-testid="role-select"` to role Select component
- [x] Add info Alert component when non-OWNER user views role selector:
  - Message: "Only OWNER users can assign the OWNER role"
  - Color: blue (informational)
  - `data-testid="owner-assignment-info"`
- [x] Test manual user flows in dev environment
- [x] E2E tests written and passing (11/11 tests passing ✅)

### Testing Coverage

**New E2E Tests (in `owner-role-assignment.spec.ts`):**
- [x] OWNER user sees OWNER in role dropdown when creating user
- [x] OWNER user sees OWNER in role dropdown when editing user
- [x] ADMIN user does NOT see OWNER in role dropdown when creating user
- [x] ADMIN user does NOT see OWNER in role dropdown when editing user
- [x] ADMIN user sees info message about OWNER assignment restriction (create page)
- [x] ADMIN user sees info message when editing user
- [x] OWNER can successfully create user with OWNER role (full flow)
- [x] ADMIN attempt to assign OWNER via API directly returns 403 error
- [x] ADMIN can still assign non-OWNER roles (ADMIN, EDITOR, VIEWER)

### Documentation

- [x] Update [System/rbac-system.md](../../System/rbac-system.md) to document OWNER assignment restriction
- [x] Update [docs/branches-users/managing-users.md](../../../docs/branches-users/managing-users.md) with new OWNER assignment rules
- [x] Add security note to [docs/branches-users/roles-permissions.md](../../../docs/branches-users/roles-permissions.md)

### Phase 2 Summary (COMPLETE ✅)

**Backend Permission Fix:**
- ✅ New permission: `roles:read` (allows listing roles without managing them)
- ✅ Updated ADMIN role to include `roles:read` (fixes "Failed to load roles" error)
- ✅ Updated `GET /api/roles` endpoint to use `roles:read` permission

**Frontend Implementation Completed:**
- ✅ Role filtering: Non-OWNER users don't see OWNER in dropdown
- ✅ Informational alert: Blue alert explaining OWNER assignment restriction
- ✅ data-testid attributes: Added for reliable E2E testing
- ✅ Current user role detection: Uses `useAuthStore` to get role

**Test Coverage Added:**
- ✅ 11 new E2E tests in [owner-role-assignment.spec.ts](../../../admin-web/e2e/users/owner-role-assignment.spec.ts)
- ✅ Frontend UX tests: 6 tests covering role dropdown visibility and info messages
- ✅ Backend enforcement tests: 5 tests covering API-level security

**Test Results:**
- ✅ All 11 E2E tests passing
- ✅ Manual testing confirmed working for OWNER and ADMIN users
- ✅ No regressions in existing user management tests

**Files Modified:**
- [api-server/src/rbac/catalog.ts](../../../api-server/src/rbac/catalog.ts) - Added `roles:read` permission
- [api-server/src/routes/roleRouter.ts](../../../api-server/src/routes/roleRouter.ts) - Updated permission requirement
- [admin-web/src/pages/TenantUserPage.tsx](../../../admin-web/src/pages/TenantUserPage.tsx) - Role filtering + info alert
- [admin-web/e2e/users/owner-role-assignment.spec.ts](../../../admin-web/e2e/users/owner-role-assignment.spec.ts) - New test file (11 tests)

---

## Testing Strategy

### Backend Tests (Jest) - Phase 1 ✅

**Service Layer (`tenantUserService.test.ts`):**
- [x] Role assignment authorization (7 new test cases)
- [x] Multi-tenant isolation (ensure OWNER check is tenant-scoped)
- [x] Error messages are descriptive and actionable
- [x] Existing OWNER protection logic still works (last OWNER removal)

**API Routes (`tenantUsers.permissions.test.ts`):**
- [x] HTTP 403 returned for unauthorized OWNER assignment
- [x] HTTP 201/200 for authorized OWNER assignment
- [x] Error response format matches standard envelope
- [x] Correlation IDs present in error responses

### Frontend Tests (Playwright E2E) - Phase 2 ✅

**User Flows:**
- [x] OWNER can create users with all roles including OWNER
- [x] ADMIN can create users with ADMIN/EDITOR/VIEWER but not OWNER
- [x] Role dropdown filters correctly based on user's role
- [x] Informational message displays for non-OWNER users

**Permission-Based UI:**
- [x] OWNER role functionality (full role assignment capabilities)
- [x] ADMIN role functionality (restricted from OWNER assignment)
- [x] EDITOR role (no access to user management, existing behavior)
- [x] VIEWER role (no access to user management, existing behavior)

---

## Success Metrics

- [x] Zero privilege escalation paths via role assignment
- [x] ADMIN users cannot self-promote to OWNER
- [x] All existing tests continue to pass (no regressions)
- [x] Frontend provides clear feedback about OWNER assignment restrictions
- [x] Security vulnerability closed and verified with comprehensive test coverage

---

## Notes & Decisions

**Key Design Decisions:**
- **Server-side enforcement is primary defense** - Never trust client-side filtering alone; backend validation is mandatory
- **Check by role name, not permission set** - Use `role.name === 'OWNER'` rather than checking permission list, as permissions can be customized
- **Graceful UX degradation** - Non-OWNER users see filtered list rather than error messages, with optional informational alert
- **Tenant-scoped validation** - OWNER status is checked within the current tenant context (multi-tenant isolation preserved)

**Security Rationale:**
- Current vulnerability allows ADMIN → OWNER privilege escalation
- Custom roles with `users:manage` could be misconfigured to allow OWNER assignment
- Defense-in-depth: Both backend validation AND frontend UX controls

**Known Limitations:**
- None - this fully closes the identified security gap

**Implementation Notes:**
- Required adding `roles:read` permission to allow ADMIN users to list roles without being able to create/edit them
- Separation of concerns: `roles:read` for viewing/listing, `roles:manage` for CRUD operations
- E2E test selectors use loose regex patterns (`/password/i`) to handle Mantine component label variations

**Future Enhancements (Out of Scope):**
- Audit log alert when OWNER role is assigned (separate monitoring feature)
- Two-factor confirmation for OWNER role assignment (separate UX enhancement)
- Transfer OWNER role workflow with approval process (separate governance feature)

---

## Reference: Test Template Locations

**Backend Testing:**
- [api-server/__tests__/TEST_TEMPLATE.md](../../../api-server/__tests__/TEST_TEMPLATE.md) - Jest test patterns
- [api-server/__tests__/scriptsList.md](../../../api-server/__tests__/scriptsList.md) - Test suite scripts (update if new test files added)

**Frontend Testing:**
- [admin-web/e2e/GUIDELINES.md](../../../admin-web/e2e/GUIDELINES.md) - Playwright E2E patterns

---

## Implementation Checklist

### Phase 1: Backend (Complete ✅)
- [x] Error handling implemented
- [x] Service validation logic added
- [x] Service tests passing
- [x] Permission tests passing
- [x] All existing tests still passing
- [x] Documentation updated

### Phase 2: Frontend (Complete ✅)
- [x] Backend permission fix (`roles:read` added)
- [x] Role filtering implemented
- [x] UI feedback added
- [x] E2E tests passing
- [x] Manual testing completed
- [x] Documentation updated

### Final Verification (Complete ✅)
- [x] Run full backend test suite: `npm run test:accept` (from api-server/)
- [x] Run full E2E test suite: `npm run test:accept` (from admin-web/)
- [x] Security review: Manually tested privilege escalation scenarios
- [x] Code review: Security-focused review of validation logic
- [x] Documentation: All system and user docs updated

---

**Template Version:** 1.0 (based on Meta/prd-template.md)
