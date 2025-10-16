# Feature Flags System: Tenant-Level Feature Control

## Status
- [x] Planned
- [x] Phase 1: Core Feature Flags Infrastructure - **✅ COMPLETE**
- [ ] Phase 2: Admin UI for Feature Management
- [ ] Phase 3: Feature Flag Analytics & Monitoring

---

## Overview

This document outlines the implementation of a tenant-level feature flags system that allows per-tenant control over application features. This enables:
- Gradual feature rollout to specific clients
- Premium feature gating for different pricing tiers
- A/B testing of new features
- Safe deployment of experimental features
- Client-specific customization

**Initial Use Case:** Control barcode scanning feature availability per tenant

**Related Documents:**
- [Stock Transfers V2 - Phase 3](../stock-transfers-v2/prd.md#phase-3-barcode-based-bulk-receive)
- [Barcode Scanning Implementation](../stock-transfers-v2/prd.md#enhancement-8-bulk-receive-with-barcode-scanning)

---

## Problem Statement

### Current Situation

Currently, all features are either:
- **Globally enabled** for all tenants (can't disable per client)
- **Permission-gated** (all/nothing - user either has permission or doesn't)

This creates problems:
1. **No gradual rollout** - New features go live for everyone at once
2. **No premium features** - Can't offer different feature sets for different pricing tiers
3. **No client customization** - Can't enable/disable features per client needs
4. **No A/B testing** - Can't test features with subset of clients
5. **Risk of breaking changes** - All clients affected by experimental features

### Specific Example: Barcode Scanning

The barcode scanning feature (Phase 3) has different implementations:
- **Camera-based scanning** (Phase 3) - Works with smartphones/webcams, suitable for light-duty operations
- **Hardware scanner integration** (Future) - Works with industrial scanners (Zebra, Honeywell), suitable for high-volume warehouses

**Problem:**
- Not all clients need barcode scanning
- Some clients want camera-based, others want hardware scanners
- Some clients may want both options
- Can't deploy to all clients at once (different hardware requirements)

**Solution:**
Per-tenant feature flags to control:
1. Whether barcode scanning is enabled
2. Which scanning mode(s) are available
3. Scanner-specific configuration

---

## Phase 1: Core Feature Flags Infrastructure

**Goal:** Implement basic tenant-level feature flag system with support for barcode scanning control.

**Estimated Effort:** 1 day
**Complexity:** Low
**Priority:** High (blocks safe deployment of Phase 3)

**Status:** ✅ COMPLETE (2025-01-14)

### Architecture

**Feature Flag Storage:**
- Stored as JSON column on `Tenant` model
- Flexible schema allows adding new flags without migrations
- Per-tenant configuration
- Default values ensure safe fallback

**Feature Flag Schema:**
```typescript
interface TenantFeatureFlags {
  // Barcode Scanning
  barcodeScanningEnabled: boolean;
  barcodeScanningMode: 'camera' | 'hardware' | 'both' | null;

  // Future features can be added here without schema changes
  // offlineScanningEnabled?: boolean;
  // voicePickingEnabled?: boolean;
  // advancedReportingEnabled?: boolean;
}
```

**Default Values:**
```json
{
  "barcodeScanningEnabled": false,
  "barcodeScanningMode": null
}
```

### Database Schema Changes

**Update `Tenant` Model:**
```prisma
model Tenant {
  // ... existing fields

  featureFlags  Json?  // Flexible JSON for feature flags

  // ... existing relations
}
```

**Migration:**
```sql
ALTER TABLE "Tenant" ADD COLUMN "featureFlags" JSONB DEFAULT '{"barcodeScanningEnabled": false, "barcodeScanningMode": null}';
```

### Backend Implementation

**1. Seed Data Updates**

Enable barcode scanning for test tenant (ACME Corp):
```typescript
// In seed.ts
await prisma.tenant.update({
  where: { tenantSlug: 'acme' },
  data: {
    featureFlags: {
      barcodeScanningEnabled: true,
      barcodeScanningMode: 'camera',
    }
  }
});
```

**2. API Response Updates**

Include feature flags in tenant data returned to frontend:
- `GET /api/auth/me` - Include current tenant's feature flags
- `GET /api/tenants/:tenantId` - Include feature flags in response

**3. Optional API Validation**

Add optional validation to barcode endpoints:
```typescript
// In barcode lookup endpoint
if (!req.currentTenant?.featureFlags?.barcodeScanningEnabled) {
  throw Errors.forbidden('Barcode scanning not enabled for this tenant');
}
```

### Frontend Implementation

**1. Auth Store Updates**

Add feature flags to auth store:
```typescript
// stores/auth.ts
interface AuthState {
  // ... existing fields
  currentTenant: {
    // ... existing tenant fields
    featureFlags: TenantFeatureFlags;
  } | null;
}
```

**2. Feature Flag Hook**

Create reusable hook:
```typescript
// hooks/useFeatureFlag.ts
export function useFeatureFlag(flagKey: keyof TenantFeatureFlags): boolean {
  const currentTenant = useAuthStore(state => state.currentTenant);
  return currentTenant?.featureFlags?.[flagKey] ?? false;
}

// Usage:
const canUseBarcodeScanning = useFeatureFlag('barcodeScanningEnabled');
```

**3. UI Updates**

**StockTransferDetailPage.tsx:**
- Hide "Scan to Receive" button if `barcodeScanningEnabled` is false
- Only show for IN_TRANSIT transfers + destination branch members + has permission

```typescript
const canUseBarcodeScanning =
  transfer.status === 'IN_TRANSIT' &&
  isDestinationBranchMember &&
  hasPerm('stock:write') &&
  useFeatureFlag('barcodeScanningEnabled'); // NEW

{canUseBarcodeScanning && (
  <Button onClick={() => setBarcodeScanModalOpened(true)}>
    <IconBarcode size={16} />
    Scan to Receive
  </Button>
)}
```

**ProductDetailPage.tsx (ProductOverviewTab):**
- Hide barcode fields if `barcodeScanningEnabled` is false

```typescript
const canManageBarcodes = useFeatureFlag('barcodeScanningEnabled');

{canManageBarcodes && (
  <>
    <Select label="Barcode Type" {...} />
    <TextInput label="Barcode" {...} />
  </>
)}
```

### Testing

**Manual Testing:**
1. ✅ Verify ACME tenant can see barcode scanning features
2. ✅ Verify other tenants cannot see barcode scanning features
3. ✅ Verify feature flag is included in auth response
4. ✅ Verify UI elements properly hidden/shown based on flag

**E2E Tests:**
- Update existing barcode E2E tests to use ACME tenant (has flag enabled)
- Add test: Verify barcode features hidden for tenant without flag

---

## Phase 2: Admin UI for Feature Management

**Goal:** Provide UI for administrators to manage feature flags per tenant.

**Estimated Effort:** 2 days
**Complexity:** Medium
**Priority:** Medium (nice-to-have, not critical)

**Status:** 📝 Planned

### Features

**Tenant Settings Page:**
- New section: "Feature Flags"
- List all available feature flags with descriptions
- Toggle switches to enable/disable per feature
- Dropdown for multi-value flags (e.g., `barcodeScanningMode`)
- Save button with confirmation

**Permission Requirements:**
- Only system admins can manage feature flags
- Tenant owners can VIEW but not EDIT their flags
- Regular users cannot see feature flags section

### API Endpoints

**Feature Flag Management:**
- `GET /api/tenants/:tenantId/feature-flags` - Get all flags
- `PATCH /api/tenants/:tenantId/feature-flags` - Update flags (admin only)
- `GET /api/feature-flags/catalog` - Get list of all available flags with descriptions

### UI Components

**New Page:**
- `TenantFeatureFlagsPage.tsx` - Manage feature flags for a tenant

**New Components:**
- `FeatureFlagToggle.tsx` - Individual flag toggle with description
- `FeatureFlagConfig.tsx` - Complex flag configuration (e.g., mode selection)

---

## Phase 3: Feature Flag Analytics & Monitoring

**Goal:** Track feature flag usage and provide insights.

**Estimated Effort:** 1-2 days
**Complexity:** Medium
**Priority:** Low (future enhancement)

**Status:** 📋 Backlog

### Features

**Analytics Dashboard:**
- Feature adoption rates (% of tenants with each flag enabled)
- Feature usage metrics (how often feature is used when enabled)
- Flag change history (audit trail)

**Monitoring:**
- Alert when feature flag causes errors
- Track performance impact of enabled features
- A/B test results (conversion rates, usage patterns)

---

## Future Feature Flags

Once infrastructure is in place, we can easily add new feature flags:

### Scanning-Related Flags
```typescript
{
  // Current
  barcodeScanningEnabled: boolean,
  barcodeScanningMode: 'camera' | 'hardware' | 'both' | null,

  // Future
  offlineScanningEnabled: boolean,        // Allow offline scan sync
  voicePickingEnabled: boolean,           // Voice-guided picking
  rfidScanningEnabled: boolean,           // RFID tag scanning
  batchScanningEnabled: boolean,          // Scan entire pallet at once
}
```

### Warehouse Features
```typescript
{
  advancedInventoryEnabled: boolean,      // Lot tracking, serial numbers
  crossDockingEnabled: boolean,           // Direct ship without storage
  wavePicking: boolean,                   // Batch picking optimization
  putawayOptimization: boolean,           // AI-suggested bin locations
}
```

### Reporting & Analytics
```typescript
{
  advancedReportsEnabled: boolean,        // Premium reporting features
  customDashboardsEnabled: boolean,       // User-created dashboards
  exportToExcelEnabled: boolean,          // Bulk data exports
}
```

### Integrations
```typescript
{
  erpIntegrationEnabled: boolean,         // ERP sync (SAP, Oracle, etc.)
  ecommerceIntegrationEnabled: boolean,   // Shopify, WooCommerce
  shippingIntegrationEnabled: boolean,    // FedEx, UPS, DHL
  accountingIntegrationEnabled: boolean,  // QuickBooks, Xero
}
```

---

## Acceptance Criteria

### Phase 1: Core Infrastructure

- [x] `featureFlags` JSON column added to `Tenant` model
- [x] Migration created and applied
- [x] Seed data updated with default feature flags
- [x] ACME tenant enabled for barcode scanning (testing)
- [x] Auth API includes feature flags in response
- [x] Frontend auth store includes feature flags
- [x] `useFeatureFlag()` hook created
- [x] "Scan to Receive" button hidden if flag disabled
- [x] Barcode fields on Product page hidden if flag disabled
- [x] SOP documentation created
- [x] E2E tests created for ACME tenant (9 tests)
- [x] E2E tests verify features hidden for Globex tenant
- [x] All feature flag E2E tests passing

### Phase 2: Admin UI (Future)

- [ ] Tenant Settings page includes Feature Flags section
- [ ] Admin can enable/disable feature flags per tenant
- [ ] Non-admins cannot edit feature flags
- [ ] Changes logged in audit trail
- [ ] Feature flag catalog endpoint created
- [ ] UI shows descriptions for each flag

### Phase 3: Analytics (Future)

- [ ] Dashboard shows feature adoption rates
- [ ] Dashboard shows feature usage metrics
- [ ] Audit trail tracks all flag changes
- [ ] Alerts configured for feature-related errors

---

## Migration Plan

### Phase 1 Rollout (Immediate)

1. **Apply Migration:**
   ```bash
   cd api-server
   npm run db:migrate -- --name add_tenant_feature_flags
   ```

2. **Deploy Backend:**
   - API includes feature flags in auth response
   - Optional: API validation on barcode endpoints

3. **Deploy Frontend:**
   - UI checks feature flags before showing barcode features
   - Graceful degradation if feature disabled

4. **Enable for Test Tenant:**
   ```sql
   UPDATE "Tenant"
   SET "featureFlags" = '{"barcodeScanningEnabled": true, "barcodeScanningMode": "camera"}'
   WHERE "tenantSlug" = 'acme';
   ```

5. **Test with ACME tenant:**
   - Verify barcode features visible
   - Run E2E tests

6. **Gradually Enable for Clients:**
   - Enable per client request
   - Monitor for issues
   - Expand to more clients as validated

---

## Documentation Updates

### Developer Documentation

**New SOP:** `.agent/SOP/feature_flags_usage.md`
- How to add new feature flags
- How to check feature flags in code
- Best practices for feature flag naming
- When to use feature flags vs permissions

**Updated Docs:**
- `.agent/System/database_schema.md` - Document featureFlags column
- `.agent/System/frontend_architecture.md` - Document useFeatureFlag hook

### User Documentation

**Admin Guide:**
- How to enable/disable features per tenant
- What each feature flag does
- Feature flag vs permission (when to use which)

---

## Related Documentation

- [Stock Transfers V2](stock-transfers-v2/prd.md)
- [Database Schema Reference](../../System/database_schema.md)
- [Frontend Architecture](../../System/frontend_architecture.md)
- [RBAC System Design](../../System/rbac_system.md)

---

**Last Updated:** 2025-01-14
**Document Version:** 1.2
**Status:** Phase 1 Complete | All Tests Passing ✅
