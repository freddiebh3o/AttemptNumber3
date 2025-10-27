# Features Permission Restructuring - Implementation Plan

**Status:** ✅ Complete
**Priority:** High
**Estimated Effort:** 0.5 days
**Created:** 2025-10-27
**Last Updated:** 2025-10-27

---

## Overview

Currently, tenant feature settings (AI Chat Assistant and Barcode Scanning toggles) are protected by the `theme:manage` permission. This is semantically incorrect as feature management is distinct from theme/branding management. This refactoring introduces dedicated permissions for feature management with stricter access control.

**Key Capabilities:**
- Separate permissions for reading vs managing feature settings
- Only OWNER role can modify feature flags (high-privilege operation affecting billing)
- All authenticated roles can view feature settings (transparency)
- Backend enforcement prevents unauthorized modifications

**Related Documentation:**
- [RBAC System](../../System/rbac-system.md) - Permission catalog and role definitions
- [Feature Flags Usage](../../SOP/feature_flags_usage.md) - How feature flags work
- [Backend Testing Guide](../../../api-server/__tests__/TEST_TEMPLATE.md) - Testing patterns

---

## Phase 1: Backend Permission Changes

**Goal:** Create new permissions and update RBAC catalog to properly control feature access

**Relevant Files:**
- [api-server/src/rbac/catalog.ts](../../../api-server/src/rbac/catalog.ts)
- [api-server/src/utils/permissions.ts](../../../api-server/src/utils/permissions.ts)
- [api-server/src/routes/tenantThemeRouter.ts](../../../api-server/src/routes/tenantThemeRouter.ts)

### Backend Implementation

- [x] Add `features:read` permission to PERMISSIONS array in catalog.ts
- [x] Add `features:manage` permission to PERMISSIONS array in catalog.ts
- [x] Update ROLE_DEFS in catalog.ts:
  - OWNER: Add `features:manage` (only role with write access)
  - ADMIN: Add `features:read` (view-only)
  - EDITOR: Add `features:read` (view-only)
  - VIEWER: Add `features:read` (view-only)
- [x] Add both permissions to PERMISSION_KEYS array in permissions.ts
- [x] Update GET /api/tenants/:tenantSlug/feature-flags route (line 238):
  - Change `requirePermission('theme:manage')` to `requirePermission('features:read')`
- [x] Update PUT /api/tenants/:tenantSlug/feature-flags route (line 257):
  - Change `requirePermission('theme:manage')` to `requirePermission('features:manage')`
- [x] Run `npm run seed:rbac` to sync permissions to database

### Testing

- [x] Update backend permission tests in theme.permissions.test.ts:
  - GET feature-flags tests (lines 340-431): Expect all roles to have access
  - PUT feature-flags tests (lines 433-538): Expect ONLY OWNER to have access
  - Update custom role tests to use new permissions
- [x] Run backend tests: `npm run test:accept permissions/theme.permissions.test.ts`

---

## Phase 2: Frontend Permission Changes

**Goal:** Update frontend routing and UI to reflect new permission model with read-only state

**Relevant Files:**
- [admin-web/src/main.tsx](../../../admin-web/src/main.tsx)
- [admin-web/src/pages/FeatureSettingsPage.tsx](../../../admin-web/src/pages/FeatureSettingsPage.tsx)
- [admin-web/e2e/features/settings/feature-settings.spec.ts](../../../admin-web/e2e/features/settings/feature-settings.spec.ts)

### Frontend Implementation

- [x] Regenerate OpenAPI types (if needed): `npm run openapi:gen` from admin-web
- [x] Update settings/features route in main.tsx (line 134):
  - Change `<RequirePermission perm="theme:manage">` to `<RequirePermission perm="features:read">`
- [x] Update FeatureSettingsPage.tsx to handle read-only state:
  - Import `useAuthStore` and check for `features:manage` permission
  - Disable all form inputs (switches and text inputs) when user lacks `features:manage`
  - Hide or disable Save button when user lacks `features:manage`
  - Add **data-testid** attribute for read-only alert: `alert-read-only`
  - Show informational alert explaining why page is read-only
- [x] Add visual indication (Alert component) when in read-only mode

### Testing

- [x] Update E2E tests in feature-settings.spec.ts:
  - Update permission check tests (lines 258-307):
    - OWNER: Should see editable page and Save button enabled
    - ADMIN/EDITOR/VIEWER: Should see read-only page with disabled inputs
  - Add new test: "admin should see read-only feature settings page"
  - Add new test: "editor should see read-only feature settings page"
  - Add new test: "viewer should see read-only feature settings page"
  - Update navigation tests to verify all roles can access the page
- [x] Run E2E tests: `npm run test:accept features/settings/feature-settings.spec.ts`

### Documentation

- [x] Update user guide documentation (docs/settings/feature-settings.md)
  - Updated access level information
  - Added read-only mode explanation
  - Clarified permission requirements
  - Updated FAQ section

---

## Testing Strategy

### Backend Tests (Jest)

**Permission Enforcement:**
- [x] GET feature-flags accessible by all system roles (OWNER, ADMIN, EDITOR, VIEWER)
- [x] PUT feature-flags accessible ONLY by OWNER role
- [x] Custom role with `features:read` can GET but not PUT
- [x] Custom role with `features:manage` can both GET and PUT
- [x] Unauthenticated requests denied with 401
- [x] Cross-tenant access denied with 403

### Frontend Tests (Playwright E2E)

**Permission-Based UI:**
- [x] OWNER: Full access, can toggle and save features
- [x] ADMIN: Read-only access, sees disabled inputs and no Save button
- [x] EDITOR: Read-only access, sees disabled inputs and no Save button
- [x] VIEWER: Read-only access, sees disabled inputs and no Save button

**Navigation:**
- [x] All roles can access /settings/features route
- [x] Features link visible to all roles in System menu

---

## Success Metrics

- [x] `features:read` and `features:manage` permissions exist in catalog
- [x] ONLY OWNER role has `features:manage` permission
- [x] All system roles have `features:read` permission
- [x] Backend tests pass with new permission expectations
- [x] Frontend E2E tests pass with read-only UI for non-owners
- [x] No breaking changes to existing theme:manage functionality

---

## Notes & Decisions

**Key Design Decisions:**
- Chose read-only UI over permission denied for better UX (users can see current settings)
- Backend enforces write permission as final security layer (defense in depth)
- Only OWNER can manage features because it affects tenant billing and capabilities
- All roles can read features for transparency about enabled capabilities

**Known Limitations:**
- Existing tenants in production will need RBAC re-seeding to get new permissions
- Custom roles will need manual assignment of new permissions if desired

**Future Enhancements (Out of Scope):**
- Permission audit log showing who changed feature settings
- Separate permissions for individual features (e.g., `chat:manage`, `barcode:manage`)
- Role-based feature visibility (hide certain features from certain roles)

---

**Template Version:** 1.0
**Created:** 2025-10-27
