# E2E Test Coverage Matrix

**Created:** 2025-10-22
**Last Updated:** 2025-10-23

---

## Summary Statistics

| Metric | Backend (Jest) | E2E (Playwright) | Total |
|--------|----------------|------------------|-------|
| **Total Tests** | 1,007 | 338 | 1,345 |
| **Test Files** | 49 | 27 | 76 |
| **Average Tests/File** | 20.5 | 12.5 | 17.7 |

---

## Feature-by-Feature Coverage Analysis

### Legend
- ✅ **LOW GAP** - Good E2E coverage (>30% of backend tests)
- ⚠️ **MODERATE GAP** - Partial E2E coverage (10-30% of backend tests)
- 🔴 **HIGH GAP** - Missing significant E2E coverage (<10% of backend tests)
- ❌ **CRITICAL GAP** - Zero E2E coverage (0% of backend tests)

---

### 1. Products ✅ LOW GAP

| Backend Tests | E2E Tests | Coverage | Gap Level |
|--------------|-----------|----------|-----------|
| 87 | 54 | 62% | ✅ LOW |

**Backend Test Files (4 files):**
- `productService.test.ts` (38 tests)
- `productRoutes.test.ts` (24 tests)
- `barcodes.test.ts` (23 tests)
- `productArchival.test.ts` (2 tests)

**E2E Test Files (4 files):**
- `products/product-crud.spec.ts` (20 tests)
- `products/product-archive.spec.ts` (8 tests)
- `products/product-barcodes.spec.ts` (0 tests) - **Placeholder**
- `products/product-stock-levels.spec.ts` (26 tests) - **NEW ✅**

**Missing E2E Coverage:**
- Product Activity tab (audit log view)
- Advanced barcode scanning workflows (file exists but empty)

---

### 2. Stock Management ✅ LOW GAP

| Backend Tests | E2E Tests | Coverage | Gap Level |
|--------------|-----------|----------|-----------|
| 72 | 23 | 32% | ✅ LOW |

**Backend Test Files (3 files):**
- `stockService.test.ts` (23 tests)
- `stockRoutes.test.ts` (27 tests)
- `stockLotRestoration.test.ts` (22 tests)

**E2E Test Files (2 files):**
- `stock/stock-management.spec.ts` (15 tests)
- `stock/transfer-reversal-lot-restoration.spec.ts` (8 tests)

**Missing E2E Coverage:**
- Edge cases for FIFO consumption
- Stock reconciliation workflows

---

### 3. Stock Transfers ✅ LOW GAP

| Backend Tests | E2E Tests | Coverage | Gap Level |
|--------------|-----------|----------|-----------|
| 198 | 67 | 34% | ✅ LOW |

**Backend Test Files (10 files):**
- `transferService.test.ts` (29 tests)
- `transferRoutes.test.ts` (56 tests)
- `partialShipment.test.ts` (22 tests) ⚠️ **Missing E2E**
- `transferPriority.test.ts` (14 tests) ⚠️ **Missing E2E**
- `templates/templateService.test.ts` (33 tests)
- `templates/templateRoutes.test.ts` (19 tests)
- `approvals/approvalRulesService.test.ts` (18 tests)
- `approvals/approvalEvaluation.test.ts` (9 tests)
- `approvals/approvalRulesRoutes.test.ts` (15 tests)
- `approvals/approvalRuleArchival.test.ts` (14 tests)

**E2E Test Files (7 files):**
- `transfers/approval-rules.spec.ts` (12 tests)
- `transfers/multi-level-approval.spec.ts` (9 tests)
- `transfers/approval-rule-archival.spec.ts` (11 tests)
- `transfers/transfer-analytics.spec.ts` (15 tests)
- `transfers/transfer-reversal.spec.ts` (6 tests)
- `transfers/transfer-templates.spec.ts` (15 tests)
- `transfers/transfer-template-archival.spec.ts` (9 tests)

**Missing E2E Coverage:**
- Transfer CRUD (create/edit draft)
- Complete transfer workflow (draft → submit → approve → ship → receive)
- Partial shipment E2E flows
- Transfer priority handling

---

### 4. Chat/AI Assistant ⚠️ MODERATE GAP

| Backend Tests | E2E Tests | Coverage | Gap Level |
|--------------|-----------|----------|-----------|
| 199 | 62 | 31% | ⚠️ MODERATE |

**Backend Test Files (12 files):**
- `chatService.test.ts` (21 tests)
- `chatRouter.test.ts` (21 tests)
- `conversationService.test.ts` (16 tests)
- `suggestionService.test.ts` (8 tests)
- `analyticsService.test.ts` (14 tests)
- `chatIntegration.test.ts` (8 tests)
- `tools/analyticsTools.test.ts` (26 tests)
- `tools/templateTools.test.ts` (20 tests)
- `tools/branchTools.test.ts` (21 tests)
- `tools/productTools.test.ts` (19 tests)
- `tools/stockTools.test.ts` (19 tests)
- `tools/userTools.test.ts` (26 tests)

**E2E Test Files (4 files):**
- `chat/chat-basic.spec.ts` (13 tests)
- `chat/chat-advanced.spec.ts` (26 tests)
- `chat/chat-analytics.spec.ts` (13 tests)
- `chat/chat-suggestions.spec.ts` (10 tests)

**Missing E2E Coverage:**
- Complex tool interaction edge cases
- Error recovery flows
- Multi-turn conversation scenarios

---

### 5. Authentication & Authorization ⚠️ MODERATE GAP

| Backend Tests | E2E Tests | Coverage | Gap Level |
|--------------|-----------|----------|-----------|
| 18 | 40 | 222% | ⚠️ MODERATE* |

*Note: E2E has MORE tests than backend, but missing key scenarios

**Backend Test Files (1 file):**
- `authService.test.ts` (18 tests)

**E2E Test Files (3 files):**
- `auth/signin.spec.ts` (7 tests)
- `auth/auth-flow.spec.ts` (12 tests)
- `auth/permission-checks.spec.ts` (21 tests)

**Missing E2E Coverage:**
- Password reset flows
- Session expiry handling
- Multi-tenant switching
- Token refresh scenarios

---

### 6. Branches 🔴 HIGH GAP

| Backend Tests | E2E Tests | Coverage | Gap Level |
|--------------|-----------|----------|-----------|
| 72 | 9 | 13% | 🔴 HIGH |

**Backend Test Files (3 files):**
- `branchService.test.ts` (29 tests)
- `branchRoutes.test.ts` (28 tests)
- `branchArchival.test.ts` (15 tests)

**E2E Test Files (1 file):**
- `branches/branch-archival.spec.ts` (9 tests)

**Missing E2E Coverage:**
- ❌ Branch CRUD UI (create, edit, list)
- ❌ Branch search and filtering
- ❌ Branch membership management
- ❌ Branch activation/deactivation

**Priority:** 🔥 **HIGH** - Core feature with critical UI gaps

---

### 7. Tenant Users ⚠️ MODERATE GAP

| Backend Tests | E2E Tests | Coverage | Gap Level |
|--------------|-----------|----------|-----------|
| 76 | 28 | 37% | ⚠️ MODERATE |

**Backend Test Files (3 files):**
- `tenantUserService.test.ts` (40 tests)
- `tenantUserRoutes.test.ts` (15 tests)
- `tenantUserArchival.test.ts` (21 tests)

**E2E Test Files (3 files):**
- `users/user-management.spec.ts` (15 tests)
- `users/user-archival.spec.ts` (6 tests)
- `users/owner-role-assignment.spec.ts` (7 tests)

**Missing E2E Coverage:**
- User creation flow (invite user)
- User editing (email, role changes)
- Branch assignment UI
- Role assignment edge cases

---

### 8. Roles & RBAC 🔴 HIGH GAP

| Backend Tests | E2E Tests | Coverage | Gap Level |
|--------------|-----------|----------|-----------|
| 71 | 10 | 14% | 🔴 HIGH |

**Backend Test Files (3 files):**
- `roleService.test.ts` (29 tests)
- `roleRoutes.test.ts` (24 tests)
- `roleArchival.test.ts` (18 tests)

**E2E Test Files (1 file):**
- `auth/role-archival.spec.ts` (10 tests)

**Missing E2E Coverage:**
- ❌ Role CRUD UI (create, edit custom roles)
- ❌ Permission assignment UI
- ❌ Role list and search
- ❌ System role viewing

**Priority:** 🔥 **HIGH** - Administrative feature with major UI gaps

---

### 9. Audit Logs ❌ CRITICAL GAP

| Backend Tests | E2E Tests | Coverage | Gap Level |
|--------------|-----------|----------|-----------|
| 54 | 0 | 0% | ❌ CRITICAL |

**Backend Test Files (2 files):**
- `auditLogService.test.ts` (26 tests)
- `auditLogRoutes.test.ts` (28 tests)

**E2E Test Files:**
- ❌ **NONE**

**Missing E2E Coverage:**
- ❌ Audit log viewing page
- ❌ Filter by entity type
- ❌ Filter by action type
- ❌ Filter by date range
- ❌ Search by actor
- ❌ View audit details
- ❌ Export audit logs

**Priority:** 🔥🔥 **CRITICAL** - Zero E2E coverage for important compliance feature

---

### 10. Transfer Analytics ✅ LOW GAP

| Backend Tests | E2E Tests | Coverage | Gap Level |
|--------------|-----------|----------|-----------|
| 34 | 15 | 44% | ✅ LOW |

**Backend Test Files (2 files):**
- `analyticsService.test.ts` (22 tests)
- `analyticsRoutes.test.ts` (12 tests)

**E2E Test Files (1 file):**
- `transfers/transfer-analytics.spec.ts` (15 tests)

**Missing E2E Coverage:**
- Advanced filtering scenarios
- Date range edge cases

---

### 11. Theme/Branding ❌ CRITICAL GAP

| Backend Tests | E2E Tests | Coverage | Gap Level |
|--------------|-----------|----------|-----------|
| 34 | 0 | 0% | ❌ CRITICAL |

**Backend Test Files (2 files):**
- `themeService.test.ts` (20 tests)
- `themeRoutes.test.ts` (14 tests)

**E2E Test Files:**
- ❌ **NONE**

**Missing E2E Coverage:**
- ❌ Theme customization UI
- ❌ Color picker workflows
- ❌ Theme preset selection
- ❌ Preview theme changes
- ❌ Save/reset theme
- ❌ Theme persistence across sessions

**Priority:** 🔥🔥 **CRITICAL** - Zero E2E coverage for tenant-facing feature

---

### 12. Feature Flags ✅ LOW GAP

| Backend Tests | E2E Tests | Coverage | Gap Level |
|--------------|-----------|----------|-----------|
| 30 | 35 | 117% | ✅ LOW |

**Backend Test Files (2 files):**
- `featureFlagsService.test.ts` (15 tests)
- `featureFlagsRoutes.test.ts` (15 tests)

**E2E Test Files (3 files):**
- `features/feature-flags.spec.ts` (8 tests)
- `features/feature-settings.spec.ts` (13 tests)
- `features/barcode-scanning.spec.ts` (14 tests)

**Missing E2E Coverage:**
- None - well covered

---

### 13. Uploads 🔴 HIGH GAP

| Backend Tests | E2E Tests | Coverage | Gap Level |
|--------------|-----------|----------|-----------|
| 11 | 0 | 0% | 🔴 HIGH |

**Backend Test Files (2 files):**
- `uploadService.test.ts` (4 tests)
- `uploadRoutes.test.ts` (7 tests)

**E2E Test Files:**
- ❌ **NONE**

**Missing E2E Coverage:**
- ❌ File upload UI
- ❌ Upload progress indicators
- ❌ Error handling (file size, type)
- ❌ File preview/download
- ❌ Delete uploaded files

**Priority:** 🔥 **HIGH** - Zero E2E coverage for user-facing feature

---

## Priority Gap Summary

### 🔥🔥 CRITICAL (0% E2E Coverage)
1. **Audit Logs** - 54 backend tests, 0 E2E tests
   - Estimated E2E tests needed: **15-20**
2. **Theme/Branding** - 34 backend tests, 0 E2E tests
   - Estimated E2E tests needed: **15-20**

### 🔥 HIGH (<15% E2E Coverage)
3. **Branches** - 72 backend tests, 9 E2E tests (13%)
   - Estimated E2E tests needed: **15-20** (CRUD flows)
4. **Roles & RBAC** - 71 backend tests, 10 E2E tests (14%)
   - Estimated E2E tests needed: **15-20** (CRUD flows)
5. **Uploads** - 11 backend tests, 0 E2E tests (0%)
   - Estimated E2E tests needed: **10-15**

### ⚠️ MODERATE (15-40% E2E Coverage)
6. **Tenant Users** - 76 backend tests, 28 E2E tests (37%)
   - Estimated E2E tests needed: **10-15** (create/edit flows)
7. **Chat/AI** - 199 backend tests, 62 E2E tests (31%)
   - Estimated E2E tests needed: **10-15** (edge cases)
8. **Authentication** - 18 backend tests, 40 E2E tests (222%)
   - Estimated E2E tests needed: **5-10** (password reset, session expiry)

### ✅ LOW (>30% E2E Coverage)
9. **Products** - 87 backend tests, 28 E2E tests (32%)
   - Estimated E2E tests needed: **5-10** (Activity/Stock Levels tabs)
10. **Stock Management** - 72 backend tests, 23 E2E tests (32%)
11. **Stock Transfers** - 198 backend tests, 67 E2E tests (34%)
    - Estimated E2E tests needed: **10-15** (workflow, partial shipment)
12. **Transfer Analytics** - 34 backend tests, 15 E2E tests (44%)
13. **Feature Flags** - 30 backend tests, 35 E2E tests (117%)

---

## Estimated Test Additions

| Priority | Features | Current E2E | Target E2E | Tests to Add |
|----------|----------|-------------|------------|--------------|
| CRITICAL | Audit Logs, Theme | 0 | 30-40 | 30-40 |
| HIGH | Branches, Roles, Uploads | 19 | 60-75 | 41-56 |
| MODERATE | Users, Chat, Auth | 130 | 155-175 | 25-45 |
| LOW | Products, Stock, Transfers | 133 | 153-173 | 20-40 |
| **TOTAL** | **All Features** | **312** | **428-503** | **116-191** |

**Conservative Estimate:** Add ~120 E2E tests (38% increase)
**Aggressive Estimate:** Add ~190 E2E tests (61% increase)

---

## Notes

- **Backend test quality is excellent** - Comprehensive coverage across service, route, and integration layers
- **E2E tests focus on user flows** - Appropriately higher-level than backend unit tests
- **Critical gaps are administrative features** - Audit Logs, Theme, Roles, Branches
- **User-facing features are well covered** - Products, Stock, Transfers have good E2E coverage
- **Chat/AI has strong coverage** - 62 E2E tests covering most user scenarios

**Recommendation:** Prioritize filling CRITICAL and HIGH gaps in Phase 3 and 4 of the refactoring project.
