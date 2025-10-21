# PRD 4: New Feature Tests - Part 1 (Core Features)

**Status:** 📋 Planning
**Priority:** High
**Estimated Effort:** 3-4 days
**Created:** 2025-10-21
**Last Updated:** 2025-10-21

---

## Overview

Add missing service and route tests for core business features (Branches, Tenant Users, Roles, Auth Service). These are foundational features with significant coverage gaps that need comprehensive testing.

**Key Capabilities:**
- Complete CRUD testing for branch management
- Full tenant user lifecycle testing (invite, manage, archive, restore)
- Role management testing with permission assignment
- Authentication service testing (sign-in, sign-out, session management)

**Related Documentation:**
- [RBAC System](../../../System/rbac-system.md) - Roles and permissions
- [Database Schema](../../../System/database-schema.md) - Data model
- [Backend Testing Guide](../../../SOP/backend-testing.md) - Testing patterns
- [Test Template](../../../../api-server/__tests__/TEST_TEMPLATE.md) - Service and route patterns
- [Master PRD](./prd.md) - Overall refactoring plan

---

## Phase 1: Branches Feature

**Goal:** Create comprehensive service and route tests for branch management

**Relevant Files:**
- [api-server/src/services/branches/branchService.ts](../../../../api-server/src/services/branches/branchService.ts) - Implementation
- [api-server/src/routes/branchRouter.ts](../../../../api-server/src/routes/branchRouter.ts) - Implementation
- [api-server/__tests__/features/branches/branchService.test.ts](../../../../api-server/__tests__/features/branches/branchService.test.ts) - NEW
- [api-server/__tests__/features/branches/branchRoutes.test.ts](../../../../api-server/__tests__/features/branches/branchRoutes.test.ts) - NEW

### Backend Implementation

- [ ] Create branchService.test.ts
  - [ ] Create branch with valid data
  - [ ] List branches for tenant
  - [ ] Get branch by ID
  - [ ] Update branch (name, slug, isActive)
  - [ ] Archive branch (soft delete)
  - [ ] Restore archived branch
  - [ ] Reject duplicate slug in same tenant
  - [ ] Allow same slug in different tenants
  - [ ] Multi-tenant isolation
  - [ ] Audit log creation (CREATE, UPDATE, DELETE)
  - [ ] Branch membership management
  - [ ] Cannot archive branch with active stock

- [ ] Create branchRoutes.test.ts
  - [ ] GET /api/branches (list) - authenticated
  - [ ] GET /api/branches/:id - authenticated
  - [ ] POST /api/branches - with branches:manage permission
  - [ ] PUT /api/branches/:id - with branches:manage permission
  - [ ] DELETE /api/branches/:id - with branches:manage permission
  - [ ] POST /api/branches/:id/restore - with branches:manage permission
  - [ ] Request validation (Zod schemas)
  - [ ] Response envelope format
  - [ ] Idempotency support
  - [ ] 401 without authentication
  - [ ] 403 without permission (minimal test, full coverage in permissions/)

- [ ] Confirm all tests pass before moving to Phase 2

---

## Phase 2: Tenant Users Feature

**Goal:** Create service tests for tenant user management

**Relevant Files:**
- [api-server/src/services/tenantUsers/tenantUserService.ts](../../../../api-server/src/services/tenantUsers/tenantUserService.ts) - Implementation
- [api-server/__tests__/features/tenantUsers/tenantUserService.test.ts](../../../../api-server/__tests__/features/tenantUsers/tenantUserService.test.ts) - NEW

### Backend Implementation

- [ ] Create tenantUserService.test.ts
  - [ ] Invite user to tenant (create UserTenantMembership)
  - [ ] List tenant users with role information
  - [ ] Get tenant user by ID
  - [ ] Update tenant user role
  - [ ] Remove user from tenant (archive membership)
  - [ ] Restore archived membership
  - [ ] Prevent duplicate membership (user + tenant)
  - [ ] Multi-tenant isolation
  - [ ] Audit log creation
  - [ ] Cannot remove last OWNER from tenant
  - [ ] User can belong to multiple tenants
  - [ ] Membership includes branch assignments

- [ ] Confirm all tests pass before moving to Phase 3

---

## Phase 3: Roles Feature

**Goal:** Create comprehensive service and route tests for role management

**Relevant Files:**
- [api-server/src/services/role/roleService.ts](../../../../api-server/src/services/role/roleService.ts) - Implementation
- [api-server/src/routes/roleRouter.ts](../../../../api-server/src/routes/roleRouter.ts) - Implementation
- [api-server/__tests__/features/roles/roleService.test.ts](../../../../api-server/__tests__/features/roles/roleService.test.ts) - NEW
- [api-server/__tests__/features/roles/roleRoutes.test.ts](../../../../api-server/__tests__/features/roles/roleRoutes.test.ts) - NEW

### Backend Implementation

- [ ] Create roleService.test.ts
  - [ ] Create role with permissions
  - [ ] List roles for tenant
  - [ ] Get role by ID with permissions
  - [ ] Update role name and description
  - [ ] Update role permissions (add/remove)
  - [ ] Archive role (soft delete)
  - [ ] Restore archived role
  - [ ] Cannot archive system roles (OWNER, ADMIN, EDITOR, VIEWER)
  - [ ] Cannot delete role with active users
  - [ ] Multi-tenant isolation
  - [ ] Audit log creation
  - [ ] Custom role with subset of permissions

- [ ] Create roleRoutes.test.ts
  - [ ] GET /api/roles (list) - with roles:manage permission
  - [ ] GET /api/roles/:id - with roles:manage permission
  - [ ] POST /api/roles - with roles:manage permission
  - [ ] PUT /api/roles/:id - with roles:manage permission
  - [ ] DELETE /api/roles/:id - with roles:manage permission
  - [ ] POST /api/roles/:id/restore - with roles:manage permission
  - [ ] Request validation (Zod schemas)
  - [ ] Response envelope format
  - [ ] 401 without authentication
  - [ ] 403 without permission (minimal test)

- [ ] Confirm all tests pass before moving to Phase 4

---

## Phase 4: Auth Service

**Goal:** Create comprehensive tests for authentication service layer

**Relevant Files:**
- [api-server/src/services/authService.ts](../../../../api-server/src/services/authService.ts) - Implementation
- [api-server/__tests__/features/auth/authService.test.ts](../../../../api-server/__tests__/features/auth/authService.test.ts) - NEW
- Note: Route tests exist in [core/auth.test.ts](../../../../api-server/__tests__/core/auth.test.ts)

### Backend Implementation

- [ ] Create authService.test.ts
  - [ ] Sign in with valid credentials
  - [ ] Sign in fails with invalid email
  - [ ] Sign in fails with invalid password
  - [ ] Sign in fails with invalid tenant slug
  - [ ] Sign in fails if user not member of tenant
  - [ ] Generate session token with correct payload
  - [ ] Session token includes userId and tenantId
  - [ ] Session token is properly signed (JWT)
  - [ ] Password hashing with bcrypt (verify strength)
  - [ ] Password comparison timing-safe
  - [ ] Multiple tenants for same user
  - [ ] Session creation audit log

- [ ] Confirm all tests pass

---

## Testing Strategy

### Service Tests (Business Logic)

**Pattern:**
- Test service functions directly (no HTTP layer)
- Focus on business logic, validation, data transformations
- Test multi-tenant isolation thoroughly
- Test error cases and edge cases
- Verify audit log creation
- Use factory helpers for test data

**Coverage:**
- CRUD operations (Create, Read, Update, Delete, Restore)
- Business rules and constraints
- Error handling
- Multi-tenant isolation
- Audit trail

### Route Tests (HTTP Layer)

**Pattern:**
- Test Express router with middleware
- Use supertest for HTTP requests
- Test request validation (Zod)
- Test response format (envelope)
- Minimal permission testing (1 happy, 1 denied)
- Test authentication requirement

**Coverage:**
- All HTTP methods (GET, POST, PUT, DELETE)
- Request validation
- Response format
- Authentication (401)
- Basic authorization (403)
- Idempotency where applicable

---

## Success Metrics

- [ ] 8 new test files created (4 service + 4 route)
- [ ] branchService.test.ts: 12+ tests passing
- [ ] branchRoutes.test.ts: 10+ tests passing
- [ ] tenantUserService.test.ts: 12+ tests passing
- [ ] roleService.test.ts: 12+ tests passing
- [ ] roleRoutes.test.ts: 10+ tests passing
- [ ] authService.test.ts: 12+ tests passing
- [ ] All new tests passing (~70+ new tests total)
- [ ] Coverage gaps filled for core features
- [ ] Service and route test patterns documented in TEST_TEMPLATE.md

---

## Notes & Decisions

**Key Design Decisions:**

1. **Separate service and route tests**
   - **Rationale:** Service tests focus on business logic; route tests focus on HTTP layer
   - **Alternative:** Combined tests (rejected: mixes concerns, hard to debug)

2. **Minimal permission testing in route tests**
   - **Rationale:** Full permission coverage in permissions/ directory
   - **Alternative:** Full matrix in route tests (rejected: duplicates permission tests)

3. **Test branch membership requirements**
   - **Rationale:** Stock operations require UserBranchMembership, critical to test
   - **Alternative:** Skip branch membership (rejected: incomplete coverage)

4. **Test system role protection**
   - **Rationale:** Security-critical to prevent accidental deletion of system roles
   - **Alternative:** Only test custom roles (rejected: incomplete coverage)

5. **Auth service testing separate from route tests**
   - **Rationale:** Service layer has complex logic (bcrypt, JWT) deserving dedicated tests
   - **Alternative:** Only test via routes (rejected: black-box testing insufficient)

**Known Limitations:**
- Cannot test branch deletion if active stock exists (requires complex setup)
- Some edge cases require multiple tenants (more test data overhead)
- Password hashing tests are slow (bcrypt is intentionally slow)

**Future Enhancements (Out of Scope):**
- Branch hierarchy support (parent/child branches)
- Bulk user invite functionality
- Role templates (pre-defined role configurations)
- SSO integration testing

---

**Template Version:** 1.0
**Created:** 2025-10-21
