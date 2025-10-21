# PRD 2: Permission Test Suite Creation

**Status:** 🚧 In Progress (Phase 1 Complete ✅)
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

- [x] Create products.permissions.test.ts ✅
  - [x] GET /api/products (list) - all roles
  - [x] GET /api/products/:id - all roles
  - [x] GET /api/products/:id/activity - all roles
  - [x] POST /api/products - products:write roles only
  - [x] PUT /api/products/:id - products:write roles only
  - [x] DELETE /api/products/:id - products:write roles only
  - [x] POST /api/products/:id/restore - products:write roles only
  - [x] POST /api/products/bulk-update - products:write roles only
  - [x] Unauthenticated requests (401)
  - [x] Cross-tenant isolation (404 for main endpoints, 200 empty for activity)

- [x] Create stock.permissions.test.ts ✅
  - [x] GET /api/stock/levels - stock:read roles only
  - [x] GET /api/stock/ledger - stock:read roles only
  - [x] GET /api/stock/levels/bulk - stock:read roles only
  - [x] POST /api/stock/receive - stock:write roles only
  - [x] POST /api/stock/adjust - stock:write roles only
  - [x] POST /api/stock/consume - stock:write roles only
  - [x] Unauthenticated requests (401)
  - [x] Cross-tenant isolation (404 for ledger, 200 empty for levels)
  - [x] Branch membership requirements (all stock operations)
  - [x] Fixed tenant isolation bug in GET /api/stock/levels ✅

- [x] Create branches.permissions.test.ts ✅
  - [x] GET /api/branches (list) - all authenticated users
  - [x] GET /api/branches/:id - all authenticated users
  - [x] GET /api/branches/:id/activity - all authenticated users
  - [x] POST /api/branches - tenant:manage roles only
  - [x] PUT /api/branches/:id - tenant:manage roles only
  - [x] DELETE /api/branches/:id - tenant:manage roles only
  - [x] POST /api/branches/:id/restore - tenant:manage roles only
  - [x] Unauthenticated requests (401)
  - [x] Cross-tenant isolation (404 for main endpoints, 200 empty for activity)

- [x] Confirm all tests pass before moving to Phase 2 ✅ (162 new permission tests passing)

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

## Phase 1 Completion Summary

**Files Created:**
- `api-server/__tests__/permissions/products.permissions.test.ts` - 58 tests
- `api-server/__tests__/permissions/stock.permissions.test.ts` - 44 tests
- `api-server/__tests__/permissions/branches.permissions.test.ts` - 56 tests
- Updated `api-server/__tests__/scriptsList.md` with new PERMISSIONS section

**Total Tests Added:** 162 permission tests (all passing ✅)

**Bugs Fixed During Testing:**

1. **Critical Security Bug: Tenant Isolation Bypass in Stock Levels**
   - **Location:** `api-server/src/services/stockService.ts` - `getStockLevelsForProductService()`
   - **Issue:** Endpoint was not validating that `branchId` and `productId` belonged to the current tenant
   - **Impact:** Cross-tenant users could query stock levels for branches/products from other tenants
   - **Fix:** Added tenant ownership validation before querying stock data (returns 404 for cross-tenant access)
   - **File Modified:** [api-server/src/services/stockService.ts](../../../../api-server/src/services/stockService.ts#L724-L741)

2. **Test Infrastructure: Race Condition in Factory Helpers**
   - **Location:** `api-server/__tests__/helpers/factories.ts`
   - **Issue:** `Date.now()` timestamps caused unique constraint failures when tests ran in parallel
   - **Impact:** Intermittent test failures with "Unique constraint failed on userEmailAddress"
   - **Fix:** Added `generateUniqueId()` helper combining timestamp + random string
   - **File Modified:** [api-server/__tests__/helpers/factories.ts](../../../../api-server/__tests__/helpers/factories.ts#L13-L19)

3. **Test Infrastructure: Prisma Transaction Deadlock**
   - **Location:** `api-server/__tests__/features/stockTransfers/transferService.test.ts`
   - **Issue:** Multiple tests' `beforeEach` hooks calling `receiveStock()` simultaneously caused upsert deadlocks
   - **Impact:** Intermittent "Transaction failed due to write conflict or deadlock" errors
   - **Fix:** Pre-create `ProductStock` rows before `receiveStock()` calls to eliminate upsert race condition
   - **File Modified:** [api-server/__tests__/features/stockTransfers/transferService.test.ts](../../../../api-server/__tests__/features/stockTransfers/transferService.test.ts#L74-L93)

**Key Learnings:**

1. **Activity Endpoint Behavior:** Activity endpoints (e.g., `GET /api/products/:id/activity`) return 200 with empty results for cross-tenant requests rather than 404. This is by design - they filter by `tenantId` in service layer.

2. **Branch Permissions:** Branch write operations require `tenant:manage` permission (OWNER only), not `branches:manage` from RBAC catalog. GET endpoints have no permission requirements (all authenticated users allowed).

3. **Stock Operation Authorization:** Stock operations require TWO authorization layers:
   - Role-based permission (`stock:read` or `stock:write`)
   - Branch membership (`UserBranchMembership` record must exist)

4. **Custom Role Testing:** Custom roles with specific permissions work correctly across all endpoints tested.

**Performance:** All 162 permission tests run in parallel (Jest `maxWorkers: 4`) without conflicts after race condition fixes.

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
