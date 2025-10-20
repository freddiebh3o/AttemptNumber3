# Feature Flags Usage Guide

This document provides guidance on how to use the feature flags system for controlling per-tenant feature availability.

## Overview

Feature flags allow you to enable or disable features on a per-tenant basis without deploying code changes. This is useful for:
- Gradual feature rollout to specific clients
- Premium feature gating for different pricing tiers
- A/B testing of new features
- Client-specific customization
- Safe deployment of experimental features

## Architecture

**Storage**: Feature flags are stored as a JSON column (`featureFlags`) on the `Tenant` model in the database.

**Format**:
```json
{
  "barcodeScanningEnabled": false,
  "barcodeScanningMode": null,
  "futureFeature": true
}
```

**Benefits**:
- No schema migrations needed when adding new flags
- Flexible per-tenant configuration
- Default values ensure safe fallback

## Backend Usage

### 1. Reading Feature Flags

Feature flags are automatically included in the `/api/auth/me` response:

```typescript
// In any authenticated route
const featureFlags = req.currentTenant?.featureFlags ?? {};
const barcodeScanningEnabled = featureFlags.barcodeScanningEnabled ?? false;
```

### 2. Enforcing Feature Flags in API Endpoints (Optional)

You can optionally validate feature flags in API endpoints:

```typescript
// In barcode scanning endpoint
if (!req.currentTenant?.featureFlags?.barcodeScanningEnabled) {
  throw Errors.forbidden('Barcode scanning not enabled for this tenant');
}
```

**Note**: For Phase 1, backend enforcement is optional. Frontend checks are sufficient for most use cases.

### 3. Updating Feature Flags

Feature flags can be updated via SQL or Prisma:

**SQL:**
```sql
UPDATE "Tenant"
SET "featureFlags" = '{"barcodeScanningEnabled": true, "barcodeScanningMode": "camera"}'
WHERE "tenantSlug" = 'acme';
```

**Prisma:**
```typescript
await prisma.tenant.update({
  where: { tenantSlug: 'acme' },
  data: {
    featureFlags: {
      barcodeScanningEnabled: true,
      barcodeScanningMode: 'camera',
    },
  },
});
```

## Managing Feature Flags via UI

### Features Page (`/settings/features`)

Tenants can manage their own feature flags through the **System > Features** page in the admin UI.

**Requirements:**
- User must have `theme:manage` permission (owner/admin roles)
- Accessible via sidebar: System > Features

**Available Settings:**
1. **AI Chat Assistant**
   - Toggle: Enable/disable chat assistant feature
   - Input: OpenAI API Key (optional, password-masked)
   - Help text: "Leave blank to use system default"

2. **Barcode Scanning**
   - Toggle: Enable/disable barcode scanning feature
   - Help text: "Allow users to scan product barcodes with camera"

**API Endpoints Used:**
```typescript
GET /api/tenants/:tenantSlug/feature-flags
PUT /api/tenants/:tenantSlug/feature-flags
```

**Validation:**
- OpenAI API key must start with `sk-` if provided
- Partial updates supported (only changed fields are updated)

## Frontend Usage

### 1. Accessing Feature Flags

Feature flags are automatically loaded into the auth store when the user signs in.

**Via Hook (Recommended):**
```typescript
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

function MyComponent() {
  const barcodeScanningEnabled = useFeatureFlag('barcodeScanningEnabled');
  const chatAssistantEnabled = useFeatureFlag('chatAssistantEnabled');

  return (
    <>
      {barcodeScanningEnabled && (
        <Button>Scan Barcode</Button>
      )}
      {chatAssistantEnabled && (
        <ChatTriggerButton />
      )}
    </>
  );
}
```

**For Non-Boolean Values:**
```typescript
import { useFeatureFlagValue } from '@/hooks/useFeatureFlag';

function MyComponent() {
  const scanningMode = useFeatureFlagValue<string>('barcodeScanningMode');

  if (scanningMode === 'camera') {
    return <CameraScanner />;
  } else if (scanningMode === 'hardware') {
    return <HardwareScanner />;
  }

  return null;
}
```

**Via Auth Store (Direct Access):**
```typescript
import { useAuthStore } from '@/stores/auth';

function MyComponent() {
  const featureFlags = useAuthStore((s) => s.currentTenant?.featureFlags ?? {});
  const barcodeScanningEnabled = featureFlags.barcodeScanningEnabled ?? false;

  // ... component logic
}
```

### 2. UI Patterns

**Hiding Features:**
```typescript
{featureEnabled && (
  <Button onClick={handleFeature}>
    Use Feature
  </Button>
)}
```

**Conditional Variants:**
```typescript
<Button
  variant={featureEnabled ? "filled" : "light"}
  onClick={handleAction}
>
  {featureEnabled ? "New Action" : "Fallback Action"}
</Button>
```

**Feature Teaser:**
```typescript
{!featureEnabled && (
  <Alert color="blue">
    This feature is not available for your plan. Contact sales to upgrade.
  </Alert>
)}
```

## Adding New Feature Flags

### Step 1: Update Seed Data (Development)

Add default value to seed file:

```typescript
// api-server/prisma/seed.ts
await prisma.tenant.upsert({
  where: { tenantSlug: 'acme' },
  create: {
    // ...
    featureFlags: {
      barcodeScanningEnabled: true,
      barcodeScanningMode: 'camera',
      myNewFeature: false, // NEW FEATURE
    },
  },
});
```

### Step 2: Document the Flag

Add to the PRD and this SOP:

```typescript
// Feature Flag Schema
interface TenantFeatureFlags {
  // Barcode Scanning
  barcodeScanningEnabled: boolean;
  barcodeScanningMode: 'camera' | 'hardware' | 'both' | null;

  // My New Feature
  myNewFeature: boolean; // Description of what this controls
}
```

### Step 3: Implement Frontend Checks

Use the `useFeatureFlag` hook to conditionally show/hide UI:

```typescript
const myNewFeatureEnabled = useFeatureFlag('myNewFeature');

{myNewFeatureEnabled && (
  <NewFeatureComponent />
)}
```

### Step 4: (Optional) Add Backend Validation

If the feature requires server-side enforcement:

```typescript
if (!req.currentTenant?.featureFlags?.myNewFeature) {
  throw Errors.forbidden('Feature not enabled for this tenant');
}
```

### Step 5: Update E2E Tests

Update tests to verify feature flag behavior:

```typescript
test('should hide feature when flag disabled', async ({ page }) => {
  await signIn(page, TEST_USERS.viewerGlobex); // Globex has flag disabled

  await page.goto('/acme/my-page');

  // Verify feature is hidden
  await expect(page.getByRole('button', { name: /new feature/i })).not.toBeVisible();
});
```

## Current Feature Flags

### `chatAssistantEnabled` (boolean)
- **Default**: `false`
- **Purpose**: Controls whether the AI Chat Assistant feature is available for the tenant
- **Affects**:
  - Visibility of chat trigger button in the UI
  - Access to `/api/chat` endpoint
  - Whether tenant's OpenAI API key is used (if provided)
- **UI Management**: Configurable via **System > Features** page (requires `theme:manage` permission)
- **Cost Control**: When enabled, tenant can provide their own OpenAI API key to control costs
- **Related Flags**: Works with `openaiApiKey` (string | null) for tenant-specific API keys
- **Test Tenant**: Can be enabled per tenant via Features page

### `openaiApiKey` (string | null)
- **Default**: `null`
- **Purpose**: Tenant-specific OpenAI API key for the AI Chat Assistant
- **Validation**: Must start with `sk-` if provided
- **Fallback**: If not provided, uses server's `OPENAI_API_KEY` environment variable
- **Security**: Stored in plaintext (MVP), password-masked in UI
- **UI Management**: Configurable via **System > Features** page (requires `theme:manage` permission)
- **Cost Allocation**:
  - If provided: All chat costs billed to tenant's OpenAI account
  - If null: All chat costs billed to server's OpenAI account
- **Related Documentation**: [AI Chatbot System - Tenant-Specific API Keys](../System/Domain/ai-chatbot.md#tenant-specific-api-keys)

### `barcodeScanningEnabled` (boolean)
- **Default**: `false`
- **Purpose**: Controls whether barcode scanning features are available
- **Affects**:
  - "Scan to Receive" button on stock transfer detail page
  - Barcode fields on product edit page
  - Barcode API endpoints (optional enforcement)
- **UI Management**: Configurable via **System > Features** page (requires `theme:manage` permission)
- **Test Tenant**: ACME (`barcodeScanningEnabled: true`)

### `barcodeScanningMode` (string | null)
- **Default**: `null`
- **Purpose**: Specifies which barcode scanning mode is available
- **Values**: `'camera'`, `'hardware'`, `'both'`, `null`
- **Current**: Only `'camera'` mode is implemented (Phase 3)
- **Future**: `'hardware'` mode for industrial scanners (Phase 4+)

## Best Practices

### 1. Default to Disabled
Always default new features to `false` or `null` to ensure safe rollout:

```typescript
const featureEnabled = featureFlags.newFeature ?? false; // Safe default
```

### 2. Use Feature Flags for New Features
When implementing a new feature that:
- Requires gradual rollout
- May have different hardware/software requirements
- Is experimental or beta
- Is premium (requires higher pricing tier)

Use a feature flag instead of releasing to all tenants at once.

### 3. Don't Overuse Feature Flags
Feature flags should NOT be used for:
- Permanent configuration (use environment variables instead)
- User-level settings (use user preferences instead)
- Permission-based access control (use RBAC system instead)

### 4. Document Flag Purpose and Impact
Always document:
- What the flag controls
- Default value
- Which UI elements are affected
- Which API endpoints are affected
- Test tenant(s) with the flag enabled

### 5. Clean Up Old Flags
When a feature is fully rolled out and stable:
1. Remove the feature flag checks from code
2. Remove the flag from the schema documentation
3. Optionally remove from database (or leave as historical data)

## Feature Flags vs Permissions

**Use Feature Flags when**:
- Feature availability differs by tenant (client-to-client)
- Feature has different implementations per tenant
- Feature is experimental or being gradually rolled out
- Example: Barcode scanning (some clients need it, others don't)

**Use Permissions (RBAC) when**:
- Access control is role-based within a tenant
- User-level authorization is needed
- Action requires specific privileges
- Example: Creating products, managing users, viewing reports

**Can Use Both**:
```typescript
const canManageStock = hasPerm('stock:write');
const barcodeScanningEnabled = useFeatureFlag('barcodeScanningEnabled');

const canScanBarcodes = canManageStock && barcodeScanningEnabled;
```

## Troubleshooting

### Feature Not Showing Despite Flag Being Enabled

1. **Check Frontend Auth Store**:
   - Open browser dev tools
   - Check if `featureFlags` is in the auth state
   - Verify the flag value is correct

2. **Refresh Auth State**:
   - Sign out and sign in again
   - Auth state is cached in Zustand store

3. **Check Backend Response**:
   - Open Network tab in dev tools
   - Check `/api/auth/me` response
   - Verify `currentTenant.featureFlags` is populated

4. **Verify Database Value**:
   ```sql
   SELECT "tenantSlug", "featureFlags"
   FROM "Tenant"
   WHERE "tenantSlug" = 'your-tenant';
   ```

### Feature Flag Not Persisting After Seed

- Re-run seed: `npm run db:seed`
- Check seed file for typos
- Verify Prisma schema has `featureFlags Json?` column

### TypeScript Errors on Feature Flag Access

Feature flags are typed as `Record<string, any>`, so you may need to cast:

```typescript
const mode = featureFlags.barcodeScanningMode as 'camera' | 'hardware' | 'both' | null;
```

## Future Enhancements (Phase 2+)

### Admin UI for Feature Flags
- Tenant settings page with feature flag toggles
- Only system admins can edit flags
- Audit trail for flag changes

### Feature Flag Analytics
- Track feature adoption rates
- Monitor feature usage metrics
- A/B test results

### Feature Flag Catalog API
- `GET /api/feature-flags/catalog` - List all available flags with descriptions
- Used by admin UI to show flag options

---

**Last Updated**: 2025-10-20
**Version**: 1.1
**Status**: Phase 2 Complete (UI Management Added)
