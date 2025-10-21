# PRD 2: Permission Test Suite Creation

**Status:** 📋 Planning
**Priority:** High
**Estimated Effort:** 4-5 days
**Created:** 2025-10-21
**Last Updated:** 2025-10-21

---

## Overview

Build comprehensive RBAC permission test suite covering all 12 features with matrix testing of all endpoints against all roles (OWNER, ADMIN, EDITOR, VIEWER, custom roles). This ensures complete permission enforcement coverage and catches authorization bugs early.

**Key Capabilities:**
- Matrix testing: Every endpoint × Every role = Complete permission coverage
- Separate permission tests from functional route tests (separation of concerns)
- Test unauthenticated requests (401 errors)
- Test cross-tenant isolation for all features
- Comprehensive custom role permission testing

**Related Documentation:**
- [RBAC System](../../../System/rbac-system.md) - Permission catalog and role definitions
- [RBAC Catalog Source](../../../../api-server/src/rbac/catalog.ts) - Permission keys and role mappings
- [Test Template](../../../../api-server/__tests__/TEST_TEMPLATE.md) - Permission test pattern
- [Master PRD](./prd.md) - Overall refactoring plan

---

## Phase 1: Core Feature Permissions (3 files)

**Goal:** Create permission tests for highest-value features with most endpoints

**Relevant Files:**
- [api-server/__tests__/permissions/products.permissions.test.ts](../../../../api-server/__tests__/permissions/products.permissions.test.ts) - NEW
- [api-server/__tests__/permissions/stock.permissions.test.ts](../../../../api-server/__tests__/permissions/stock.permissions.test.ts) - NEW
- [api-server/__tests__/permissions/branches.permissions.test.ts](../../../../api-server/__tests__/permissions/branches.permissions.test.ts) - NEW

### Backend Implementation

- [ ] Create products.permissions.test.ts
  - [ ] GET /api/products (list) - all roles
  - [ ] GET /api/products/:id - all roles
  - [ ] POST /api/products - products:write roles only
  - [ ] PUT /api/products/:id - products:write roles only
  - [ ] DELETE /api/products/:id - products:write roles only
  - [ ] POST /api/products/:id/restore - products:write roles only
  - [ ] Unauthenticated requests (401)
  - [ ] Cross-tenant isolation

- [ ] Create stock.permissions.test.ts
  - [ ] GET /api/stock/branch/:branchId - stock:read roles only
  - [ ] GET /api/stock/lot/:lotId - stock:read roles only
  - [ ] POST /api/stock/receive - stock:write roles only
  - [ ] POST /api/stock/adjust - stock:write roles only
  - [ ] POST /api/stock/consume - stock:allocate roles only
  - [ ] Unauthenticated requests (401)
  - [ ] Cross-tenant isolation
  - [ ] Branch membership requirements

- [ ] Create branches.permissions.test.ts
  - [ ] GET /api/branches (list) - all roles
  - [ ] GET /api/branches/:id - all roles
  - [ ] POST /api/branches - branches:manage roles only
  - [ ] PUT /api/branches/:id - branches:manage roles only
  - [ ] DELETE /api/branches/:id - branches:manage roles only
  - [ ] POST /api/branches/:id/restore - branches:manage roles only
  - [ ] Unauthenticated requests (401)
  - [ ] Cross-tenant isolation

- [ ] Confirm all tests pass before moving to Phase 2

---

## Phase 2: User Management Permissions (3 files)

**Goal:** Create permission tests for user, role, and theme management features

**Relevant Files:**
- [api-server/__tests__/permissions/tenantUsers.permissions.test.ts](../../../../api-server/__tests__/permissions/tenantUsers.permissions.test.ts) - NEW
- [api-server/__tests__/permissions/roles.permissions.test.ts](../../../../api-server/__tests__/permissions/roles.permissions.test.ts) - NEW
- [api-server/__tests__/permissions/theme.permissions.test.ts](../../../../api-server/__tests__/permissions/theme.permissions.test.ts) - NEW

### Backend Implementation

- [ ] Create tenantUsers.permissions.test.ts
  - [ ] GET /api/tenant-users (list) - users:manage roles only
  - [ ] GET /api/tenant-users/:id - users:manage roles only
  - [ ] POST /api/tenant-users (invite) - users:manage roles only
  - [ ] PUT /api/tenant-users/:id - users:manage roles only
  - [ ] DELETE /api/tenant-users/:id - users:manage roles only
  - [ ] POST /api/tenant-users/:id/restore - users:manage roles only
  - [ ] Unauthenticated requests (401)
  - [ ] Cross-tenant isolation

- [ ] Create roles.permissions.test.ts
  - [ ] GET /api/roles (list) - roles:manage roles only
  - [ ] GET /api/roles/:id - roles:manage roles only
  - [ ] POST /api/roles - roles:manage roles only
  - [ ] PUT /api/roles/:id - roles:manage roles only
  - [ ] DELETE /api/roles/:id - roles:manage roles only
  - [ ] POST /api/roles/:id/restore - roles:manage roles only
  - [ ] Unauthenticated requests (401)
  - [ ] Cross-tenant isolation
  - [ ] System role protection (cannot delete OWNER, ADMIN, etc.)

- [ ] Create theme.permissions.test.ts
  - [ ] GET /api/theme - theme:manage roles only
  - [ ] PUT /api/theme - theme:manage roles only
  - [ ] POST /api/theme/reset - theme:manage roles only
  - [ ] Unauthenticated requests (401)
  - [ ] Cross-tenant isolation

- [ ] Confirm all tests pass before moving to Phase 3

---

## Phase 3: System Feature Permissions (2 files)

**Goal:** Create permission tests for uploads and audit log features

**Relevant Files:**
- [api-server/__tests__/permissions/uploads.permissions.test.ts](../../../../api-server/__tests__/permissions/uploads.permissions.test.ts) - NEW
- [api-server/__tests__/permissions/auditLogs.permissions.test.ts](../../../../api-server/__tests__/permissions/auditLogs.permissions.test.ts) - NEW

### Backend Implementation

- [ ] Create uploads.permissions.test.ts
  - [ ] POST /api/uploads - uploads:write roles only
  - [ ] GET /api/uploads/:id - uploads:write roles only
  - [ ] DELETE /api/uploads/:id - uploads:write roles only
  - [ ] Unauthenticated requests (401)
  - [ ] Cross-tenant isolation

- [ ] Create auditLogs.permissions.test.ts
  - [ ] GET /api/audit-logs (list) - tenant:manage roles only
  - [ ] GET /api/audit-logs/:id - tenant:manage roles only
  - [ ] Query filters (entityType, action, actorUserId) - tenant:manage only
  - [ ] Unauthenticated requests (401)
  - [ ] Cross-tenant isolation

- [ ] Confirm all tests pass before moving to Phase 4

---

## Phase 4: Transfer Feature Permissions (4 files)

**Goal:** Create permission tests for stock transfer ecosystem (transfers, templates, approvals, analytics)

**Relevant Files:**
- [api-server/__tests__/permissions/stockTransfers.permissions.test.ts](../../../../api-server/__tests__/permissions/stockTransfers.permissions.test.ts) - NEW
- [api-server/__tests__/permissions/transferTemplates.permissions.test.ts](../../../../api-server/__tests__/permissions/transferTemplates.permissions.test.ts) - NEW
- [api-server/__tests__/permissions/transferApprovals.permissions.test.ts](../../../../api-server/__tests__/permissions/transferApprovals.permissions.test.ts) - NEW
- [api-server/__tests__/permissions/transferAnalytics.permissions.test.ts](../../../../api-server/__tests__/permissions/transferAnalytics.permissions.test.ts) - NEW

### Backend Implementation

- [ ] Create stockTransfers.permissions.test.ts
  - [ ] GET /api/stock-transfers (list) - stock:read roles only
  - [ ] GET /api/stock-transfers/:id - stock:read roles only
  - [ ] POST /api/stock-transfers (create) - stock:write roles only
  - [ ] PUT /api/stock-transfers/:id (update) - stock:write roles only
  - [ ] POST /api/stock-transfers/:id/receive - stock:write roles only
  - [ ] POST /api/stock-transfers/:id/reverse - stock:write roles only
  - [ ] POST /api/stock-transfers/:id/approve - stock:write roles only
  - [ ] Unauthenticated requests (401)
  - [ ] Cross-tenant isolation
  - [ ] Branch membership requirements

- [ ] Create transferTemplates.permissions.test.ts
  - [ ] GET /api/transfer-templates (list) - stock:read roles only
  - [ ] GET /api/transfer-templates/:id - stock:read roles only
  - [ ] POST /api/transfer-templates - stock:write roles only
  - [ ] PUT /api/transfer-templates/:id - stock:write roles only
  - [ ] DELETE /api/transfer-templates/:id - stock:write roles only
  - [ ] POST /api/transfer-templates/:id/apply - stock:write roles only
  - [ ] Unauthenticated requests (401)
  - [ ] Cross-tenant isolation

- [ ] Create transferApprovals.permissions.test.ts
  - [ ] GET /api/approval-rules (list) - stock:read roles only
  - [ ] GET /api/approval-rules/:id - stock:read roles only
  - [ ] POST /api/approval-rules - stock:write + tenant:manage roles only
  - [ ] PUT /api/approval-rules/:id - stock:write + tenant:manage roles only
  - [ ] DELETE /api/approval-rules/:id - stock:write + tenant:manage roles only
  - [ ] POST /api/approval-rules/:id/restore - stock:write + tenant:manage roles only
  - [ ] Unauthenticated requests (401)
  - [ ] Cross-tenant isolation

- [ ] Create transferAnalytics.permissions.test.ts
  - [ ] GET /api/transfer-analytics/summary - reports:view roles only
  - [ ] GET /api/transfer-analytics/by-branch - reports:view roles only
  - [ ] GET /api/transfer-analytics/by-product - reports:view roles only
  - [ ] GET /api/transfer-analytics/trends - reports:view roles only
  - [ ] Unauthenticated requests (401)
  - [ ] Cross-tenant isolation

- [ ] Confirm all tests pass

---

## Testing Strategy

### Permission Matrix Pattern

**For each endpoint, test:**
```typescript
describe('[RBAC] Feature Permissions', () => {
  describe('GET /api/endpoint - Action', () => {
    it('OWNER - should allow access', async () => { ... });
    it('ADMIN - should allow access', async () => { ... });
    it('EDITOR - should allow access (if has permission)', async () => { ... });
    it('VIEWER - should deny (lacks permission)', async () => { ... });
    it('Custom role with permission - should allow', async () => { ... });
    it('Custom role without permission - should deny', async () => { ... });
    it('No membership - should deny (403)', async () => { ... });
    it('Unauthenticated - should deny (401)', async () => { ... });
    it('Cross-tenant access - should deny (404)', async () => { ... });
  });
});
```

### Test Data Setup

**Use factories for consistent setup:**
- Create test tenant
- Create users with each role (OWNER, ADMIN, EDITOR, VIEWER)
- Create session cookies for each user
- Create test resources (products, branches, etc.)
- Create resources in other tenant for cross-tenant tests

### Expected Outcomes

**Permission enforcement:**
- 200/201: User has required permission
- 401: Unauthenticated (no session cookie)
- 403: Authenticated but lacks permission
- 404: Cross-tenant access (resource not found in user's tenant)

---

## Success Metrics

- [ ] 12 permission test files created (one per feature)
- [ ] All CRUD endpoints tested with all 4 system roles
- [ ] Custom role permission testing included
- [ ] Unauthenticated request testing (401) for all endpoints
- [ ] Cross-tenant isolation testing for all endpoints
- [ ] All permission tests passing (~150-200 new tests)
- [ ] Zero permission bypasses detected
- [ ] Permission test pattern documented in TEST_TEMPLATE.md
- [ ] Backend testing SOP updated with permission testing section

---

## Notes & Decisions

**Key Design Decisions:**

1. **Separate permissions/ directory**
   - **Rationale:** Permission testing is cross-cutting concern; deserves dedicated space
   - **Alternative:** Embed in route tests (rejected: creates massive files, mixes concerns)

2. **Matrix testing approach**
   - **Rationale:** Comprehensive coverage of all roles × all endpoints catches permission bugs
   - **Alternative:** Sample testing (rejected: incomplete coverage, risk of gaps)

3. **Custom role testing**
   - **Rationale:** Real-world usage includes custom roles, must test them too
   - **Alternative:** Only test system roles (rejected: incomplete coverage)

4. **Cross-tenant isolation in permission tests**
   - **Rationale:** Security-critical to verify tenant isolation at permission layer
   - **Alternative:** Test only in service layer (rejected: defense in depth needed)

5. **Test all endpoints, not just write operations**
   - **Rationale:** Read permissions are equally important (data leakage risk)
   - **Alternative:** Only test write operations (rejected: incomplete security coverage)

**Known Limitations:**
- Permission tests are verbose (9+ tests per endpoint)
- Some permission combinations may be redundant (e.g., OWNER has all permissions)
- Test data setup is duplicated across files (opportunity for shared helpers)

**Future Enhancements (Out of Scope):**
- Automated permission test generation from OpenAPI + RBAC catalog
- Permission testing for GraphQL endpoints (if added)
- Fine-grained permission testing (field-level access control)
- Permission testing for bulk operations

---

**Template Version:** 1.0
**Created:** 2025-10-21
