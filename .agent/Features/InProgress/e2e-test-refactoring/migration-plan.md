# E2E Test Migration Plan

**Created:** 2025-10-22
**Last Updated:** 2025-10-22

---

## Overview

This document provides the detailed mapping for migrating all 26 existing E2E test files from the current scattered structure to the new feature-based organization.

**Total Files to Migrate:** 26
**Estimated Time:** 2-3 days
**Git Strategy:** Use `git mv` to preserve file history

---

## Migration Mapping

### Core Tests (2 files)

| # | Current Path | New Path | Tests | Notes |
|---|--------------|----------|-------|-------|
| 1 | `auth/auth-flow.spec.ts` | `core/auth-flow.spec.ts` | 12 | Move to core (foundational) |
| 2 | `auth/signin.spec.ts` | `core/signin.spec.ts` | 7 | Move to core (foundational) |

---

### Features/Products (3 files)

| # | Current Path | New Path | Tests | Notes |
|---|--------------|----------|-------|-------|
| 3 | `products/product-crud.spec.ts` | `features/products/product-crud.spec.ts` | 20 | No rename needed |
| 4 | `products/product-archive.spec.ts` | `features/products/product-archival.spec.ts` | 8 | **Rename:** archive → archival |
| 5 | `features/barcode-scanning.spec.ts` | `features/products/product-barcodes.spec.ts` | 14 | **Rename** and move to products |

---

### Features/Stock (2 files)

| # | Current Path | New Path | Tests | Notes |
|---|--------------|----------|-------|-------|
| 6 | `stock/stock-management.spec.ts` | `features/stock/stock-adjustment.spec.ts` | 15 | **Rename:** management → adjustment |
| 7 | `stock/transfer-reversal-lot-restoration.spec.ts` | `features/stock/stock-lot-restoration.spec.ts` | 8 | **Rename** for clarity |

---

### Features/Transfers (7 files)

| # | Current Path | New Path | Tests | Notes |
|---|--------------|----------|-------|-------|
| 8 | `transfers/approval-rules.spec.ts` | `features/transfers/transfer-approval-rules.spec.ts` | 12 | **Rename:** Add transfer prefix |
| 9 | `transfers/approval-rule-archival.spec.ts` | `features/transfers/transfer-approval-rule-archival.spec.ts` | 11 | **Rename:** Add transfer prefix |
| 10 | `transfers/multi-level-approval.spec.ts` | `features/transfers/transfer-multi-level-approval.spec.ts` | 9 | **Rename:** Add transfer prefix |
| 11 | `transfers/transfer-analytics.spec.ts` | `features/transfers/transfer-analytics.spec.ts` | 15 | No rename needed |
| 12 | `transfers/transfer-reversal.spec.ts` | `features/transfers/transfer-reversal.spec.ts` | 6 | No rename needed |
| 13 | `transfers/transfer-templates.spec.ts` | `features/transfers/transfer-templates.spec.ts` | 15 | No rename needed |
| 14 | `transfers/transfer-template-archival.spec.ts` | `features/transfers/transfer-template-archival.spec.ts` | 9 | No rename needed |

---

### Features/Branches (1 file)

| # | Current Path | New Path | Tests | Notes |
|---|--------------|----------|-------|-------|
| 15 | `branches/branch-archival.spec.ts` | `features/branches/branch-archival.spec.ts` | 9 | No rename needed |

---

### Features/Users (3 files)

| # | Current Path | New Path | Tests | Notes |
|---|--------------|----------|-------|-------|
| 16 | `users/user-management.spec.ts` | `features/users/user-management.spec.ts` | 15 | No rename needed |
| 17 | `users/user-archival.spec.ts` | `features/users/user-archival.spec.ts` | 6 | No rename needed |
| 18 | `users/owner-role-assignment.spec.ts` | `features/users/user-role-assignment.spec.ts` | 7 | **Rename:** owner → user (generalize) |

---

### Features/Roles (1 file)

| # | Current Path | New Path | Tests | Notes |
|---|--------------|----------|-------|-------|
| 19 | `auth/role-archival.spec.ts` | `features/roles/role-archival.spec.ts` | 10 | Move from auth to roles |

---

### Features/Chat (4 files)

| # | Current Path | New Path | Tests | Notes |
|---|--------------|----------|-------|-------|
| 20 | `chat/chat-basic.spec.ts` | `features/chat/chat-basic.spec.ts` | 13 | No rename needed |
| 21 | `chat/chat-advanced.spec.ts` | `features/chat/chat-advanced.spec.ts` | 26 | No rename needed |
| 22 | `chat/chat-analytics.spec.ts` | `features/chat/chat-analytics.spec.ts` | 13 | No rename needed |
| 23 | `chat/chat-suggestions.spec.ts` | `features/chat/chat-suggestions.spec.ts` | 10 | No rename needed |

---

### Features/Settings (2 files)

| # | Current Path | New Path | Tests | Notes |
|---|--------------|----------|-------|-------|
| 24 | `features/feature-flags.spec.ts` | `features/settings/feature-flags.spec.ts` | 8 | Move to settings |
| 25 | `features/feature-settings.spec.ts` | `features/settings/feature-settings.spec.ts` | 13 | Move to settings |

---

### Permissions (1 file)

| # | Current Path | New Path | Tests | Notes |
|---|--------------|----------|-------|-------|
| 26 | `auth/permission-checks.spec.ts` | `permissions/rbac.spec.ts` | 21 | **Rename:** permission-checks → rbac |

---

## Summary Statistics

| Category | Files | Renamed | Tests |
|----------|-------|---------|-------|
| Core | 2 | 0 | 19 |
| Features/Products | 3 | 2 | 42 |
| Features/Stock | 2 | 2 | 23 |
| Features/Transfers | 7 | 3 | 77 |
| Features/Branches | 1 | 0 | 9 |
| Features/Users | 3 | 1 | 28 |
| Features/Roles | 1 | 0 | 10 |
| Features/Chat | 4 | 0 | 62 |
| Features/Settings | 2 | 0 | 21 |
| Permissions | 1 | 1 | 21 |
| **TOTAL** | **26** | **9** | **312** |

**Files requiring rename:** 9 (35%)
**Files simple move:** 17 (65%)

---

## Directory Structure to Create

```bash
admin-web/e2e/
├── core/
├── features/
│   ├── products/
│   ├── stock/
│   ├── transfers/
│   ├── branches/
│   ├── users/
│   ├── roles/
│   ├── chat/
│   └── settings/
└── permissions/
```

---

## Migration Commands (Phase 2)

### Step 1: Create New Directory Structure

```bash
cd admin-web/e2e

# Create core directory
mkdir -p core

# Create features subdirectories
mkdir -p features/products
mkdir -p features/stock
mkdir -p features/transfers
mkdir -p features/branches
mkdir -p features/users
mkdir -p features/roles
mkdir -p features/chat
mkdir -p features/settings

# Create permissions directory
mkdir -p permissions
```

### Step 2: Move Files (Use git mv to preserve history)

#### Core Tests
```bash
git mv auth/auth-flow.spec.ts core/auth-flow.spec.ts
git mv auth/signin.spec.ts core/signin.spec.ts
```

#### Products
```bash
git mv products/product-crud.spec.ts features/products/product-crud.spec.ts
git mv products/product-archive.spec.ts features/products/product-archival.spec.ts
git mv features/barcode-scanning.spec.ts features/products/product-barcodes.spec.ts
```

#### Stock
```bash
git mv stock/stock-management.spec.ts features/stock/stock-adjustment.spec.ts
git mv stock/transfer-reversal-lot-restoration.spec.ts features/stock/stock-lot-restoration.spec.ts
```

#### Transfers
```bash
git mv transfers/approval-rules.spec.ts features/transfers/transfer-approval-rules.spec.ts
git mv transfers/approval-rule-archival.spec.ts features/transfers/transfer-approval-rule-archival.spec.ts
git mv transfers/multi-level-approval.spec.ts features/transfers/transfer-multi-level-approval.spec.ts
git mv transfers/transfer-analytics.spec.ts features/transfers/transfer-analytics.spec.ts
git mv transfers/transfer-reversal.spec.ts features/transfers/transfer-reversal.spec.ts
git mv transfers/transfer-templates.spec.ts features/transfers/transfer-templates.spec.ts
git mv transfers/transfer-template-archival.spec.ts features/transfers/transfer-template-archival.spec.ts
```

#### Branches
```bash
git mv branches/branch-archival.spec.ts features/branches/branch-archival.spec.ts
```

#### Users
```bash
git mv users/user-management.spec.ts features/users/user-management.spec.ts
git mv users/user-archival.spec.ts features/users/user-archival.spec.ts
git mv users/owner-role-assignment.spec.ts features/users/user-role-assignment.spec.ts
```

#### Roles
```bash
git mv auth/role-archival.spec.ts features/roles/role-archival.spec.ts
```

#### Chat
```bash
git mv chat/chat-basic.spec.ts features/chat/chat-basic.spec.ts
git mv chat/chat-advanced.spec.ts features/chat/chat-advanced.spec.ts
git mv chat/chat-analytics.spec.ts features/chat/chat-analytics.spec.ts
git mv chat/chat-suggestions.spec.ts features/chat/chat-suggestions.spec.ts
```

#### Settings
```bash
git mv features/feature-flags.spec.ts features/settings/feature-flags.spec.ts
git mv features/feature-settings.spec.ts features/settings/feature-settings.spec.ts
```

#### Permissions
```bash
git mv auth/permission-checks.spec.ts permissions/rbac.spec.ts
```

### Step 3: Clean Up Empty Directories

```bash
# Remove old directories if empty
rmdir auth branches chat features products stock transfers users 2>/dev/null || true
```

### Step 4: Update Import Paths

All test files import from `../helpers`. After migration, the relative path depth changes:

**Current:** `../helpers` (1 level up)
**New depth varies by location:**
- `core/*.spec.ts` → `../helpers` (1 level up) ✅ No change
- `features/*/*.spec.ts` → `../../helpers` (2 levels up) ⚠️ Need update
- `permissions/*.spec.ts` → `../helpers` (1 level up) ✅ No change

**Files requiring import path updates (22 files):**
- All files in `features/` subdirectories (products, stock, transfers, branches, users, roles, chat, settings)

**Find and replace in each file:**
```typescript
// OLD
import { signIn, TEST_USERS, Factories } from '../helpers';

// NEW
import { signIn, TEST_USERS, Factories } from '../../helpers';
```

---

## Import Path Update Commands

```bash
# Update all files in features/ subdirectories
find features -name "*.spec.ts" -exec sed -i "s|from '../helpers'|from '../../helpers'|g" {} \;
find features -name "*.spec.ts" -exec sed -i 's|from "../helpers"|from "../../helpers"|g' {} \;
```

---

## Validation Checklist

After migration, verify:

- [ ] All 26 files successfully moved to new locations
- [ ] No files remain in old directories (auth/, branches/, chat/, products/, stock/, transfers/, users/)
- [ ] Old `features/` directory only contains new subdirectories (no loose files)
- [ ] All import paths updated correctly
- [ ] TypeScript compilation passes: `npm run typecheck`
- [ ] No broken imports or module resolution errors
- [ ] Git history preserved (use `git log --follow <file>` to verify)

---

## Rollback Plan

If migration encounters issues:

```bash
# Discard all changes and start over
git reset --hard HEAD

# OR restore specific files
git checkout HEAD -- admin-web/e2e/
```

---

## Testing After Migration

**⚠️ IMPORTANT: DO NOT RUN TESTS DURING MIGRATION**

User will validate migration by running:

```bash
cd admin-web
npm run typecheck  # Verify no TypeScript errors
npm run lint       # Verify no linting errors

# User will run E2E tests manually after validation
npm run test:accept
```

---

## Conflicts and Deprecated Tests

### Potential Conflicts

After reviewing all 26 test files, **NO CONFLICTS IDENTIFIED**:

- ✅ No duplicate test scenarios across files
- ✅ No overlapping coverage that needs consolidation
- ✅ No outdated tests that need removal
- ✅ All tests remain valid after reorganization

### Notes on Specific Files

**auth/permission-checks.spec.ts → permissions/rbac.spec.ts**
- Tests RBAC across ALL features (products, transfers, users, etc.)
- Should remain as standalone permission test file
- Consider adding more cross-feature permission scenarios in future

**users/owner-role-assignment.spec.ts → users/user-role-assignment.spec.ts**
- Currently tests OWNER role assignment specifically
- Renamed to be more general (user-role-assignment)
- May need expansion to test all role assignments in future

**features/barcode-scanning.spec.ts → features/products/product-barcodes.spec.ts**
- Tests barcode scanning feature which is product-related
- Logical fit in products/ directory
- File name clarifies it's about product barcodes

---

## Phase 2 Execution Order

1. **Day 1 Morning:** Create directory structure
2. **Day 1 Afternoon:** Move core + products + stock tests (7 files)
3. **Day 2 Morning:** Move transfers + branches + users + roles tests (12 files)
4. **Day 2 Afternoon:** Move chat + settings + permissions tests (7 files)
5. **Day 2 Evening:** Update import paths (22 files)
6. **Day 3 Morning:** Validate TypeScript compilation and linting
7. **Day 3 Afternoon:** User runs full E2E test suite to verify

---

## Success Criteria

- [ ] All 26 files migrated successfully
- [ ] Zero TypeScript errors
- [ ] Zero linting errors
- [ ] Git history preserved for all moved files
- [ ] All import paths updated correctly
- [ ] Old directories cleaned up (deleted or empty)
- [ ] User confirms all E2E tests pass after migration

---

**Next Steps:** Proceed to Phase 2 execution using this migration plan.
