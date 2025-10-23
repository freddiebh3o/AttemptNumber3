# Enforce Custom OpenAI API Keys for AI Chat Assistant

**Completed:** 2025-10-24
**Duration:** 2 days
**Status:** ✅ Complete - All phases implemented and documented

---

## Summary

Removed the server-level OpenAI API key fallback for the AI Chat Assistant feature. Tenants must now provide their own OpenAI API key to use the chat assistant, eliminating cost burden from the developer and providing tenants with full control over AI usage costs.

## What Was Done

### Phase 1: Backend - Remove Fallback & Add Validation ✅
**Goal:** Remove server API key fallback and enforce custom key requirement when enabling chat assistant.

#### Backend Implementation
- **Updated `apiKeyService.ts`:**
  - Removed fallback to `process.env.OPENAI_API_KEY`
  - Only returns tenant's `openaiApiKey` if `chatAssistantEnabled=true` AND key exists
  - Returns `null` if conditions not met (no server fallback)

- **Updated `tenantFeatureFlagsService.ts`:**
  - Added validation: Cannot enable chat assistant without providing API key
  - Throws validation error: "Cannot enable AI Chat Assistant without providing an OpenAI API key"
  - Allows disabling chat assistant without key

- **Updated `chatService.ts`:**
  - Improved error message when API key is `null`
  - Links to configuration page in error message

#### Backend Testing
- **Rewrote 30 backend tests** (13 service + 17 route tests):
  - Removed all server fallback tests
  - Added validation requirement tests
  - All tests passing ✅

#### System Documentation
- **Updated [.agent/System/Domain/ai-chatbot.md](.agent/System/Domain/ai-chatbot.md):**
  - Removed server API key fallback references
  - Updated "Tenant-Specific API Keys" section
  - Removed fallback chain documentation

- **Updated [.agent/SOP/feature_flags_usage.md](.agent/SOP/feature_flags_usage.md):**
  - Updated `chatAssistantEnabled` flag description
  - Updated `openaiApiKey` flag description
  - Removed "fallback to system default" language

---

### Phase 2: Frontend - Add Validation & Improve UX ✅
**Goal:** Add frontend validation to prevent enabling chat assistant without API key, improve error messages.

#### Frontend Implementation
- **Updated `FeatureSettingsPage.tsx`:**
  - Added frontend validation: Cannot save if `chatAssistantEnabled=true` AND `openaiApiKey` is empty
  - Shows inline validation error Alert component with `data-testid="alert-validation-error"`
  - Validates API key format (must start with "sk-")
  - Auto-clears validation error when user makes changes
  - Updated description text and Alert to reflect mandatory requirement

#### E2E Testing
- **Rewrote 16 E2E tests** in `feature-settings.spec.ts`:
  - Removed server fallback tests
  - Added 5 new validation tests:
    - "should prevent enabling chat assistant without API key (frontend validation)"
    - "should allow enabling chat assistant WITH valid API key"
    - "should validate API key format (must start with sk-)"
    - "should clear validation error when user fixes the issue"
    - "should allow disabling chat assistant without providing key"
  - Fixed Mantine Switch selector patterns (click label instead of hidden checkbox)
  - Fixed strict mode violations (scoped text searches to Alert component)
  - Fixed TypeScript errors in `page.evaluate()` with `@ts-expect-error` comments

- **Added `ALERT_VALIDATION_ERROR` selector** to `selectors.ts`

- **Updated [admin-web/e2e/GUIDELINES.md](../../../admin-web/e2e/GUIDELINES.md):**
  - Added comprehensive "Mantine Switch (Toggle) Pattern" section
  - Documents correct label-clicking pattern for Mantine switches
  - Explains why force clicking hidden checkboxes fails

---

### Phase 3: Final Documentation & Migration Guide ✅
**Goal:** Update all documentation to reflect new mandatory key requirement and provide migration guide for existing users.

#### User Documentation
- **Updated [docs/settings/feature-settings.md](../../../docs/settings/feature-settings.md):**
  - Added mandatory API key requirement warnings
  - Added "How to Get an OpenAI API Key" step-by-step guide
  - Added "Troubleshooting" section (3 common issues)
  - Added "Migrating from Server-Level API Keys" section
  - Added cost considerations and billing information
  - Updated "Last Updated" date to 2025-10-24

- **Updated [docs/README.md](../../../docs/README.md):**
  - Added mandatory key warnings to AI Chat Assistant section
  - Updated Settings & Administration documentation
  - Added migration notice to "Recent additions" section
  - Updated "Last Updated" date to 2025-10-24

- **Updated [docs/faq.md](../../../docs/faq.md):**
  - Added 3 new FAQs in AI Chatbot section:
    - "Why do I need my own OpenAI API key?"
    - "Where do I get an OpenAI API key?" (with detailed step-by-step)
    - "What happens if I don't provide an API key?"
  - Updated existing "How do I access the chatbot?" FAQ

#### Developer Documentation
- **Updated [CLAUDE.md](../../../CLAUDE.md):**
  - Marked `OPENAI_API_KEY` environment variable as deprecated for tenant fallback
  - Clarified it's only for system-level AI operations (if any)
  - Not used as fallback for tenant chat

---

## Key Results

### Success Metrics
- ✅ **No server-level API key fallback** - Cost burden removed from developer
- ✅ **Frontend validation** - Prevents invalid configurations
- ✅ **Backend validation** - Enforces API key requirement (defense in depth)
- ✅ **All 30 backend tests passing** (13 service + 17 route)
- ✅ **All 16 E2E tests passing** (validation, permissions, functionality)
- ✅ **Clear error messages** - Guide users to correct actions
- ✅ **Documentation updated** - Reflects mandatory requirement
- ✅ **Migration guide available** - For existing users

### Files Modified

#### Backend (5 files)
- `api-server/src/services/chat/apiKeyService.ts`
- `api-server/src/services/tenantFeatureFlagsService.ts`
- `api-server/src/services/chat/chatService.ts`
- `api-server/__tests__/features/featureFlags/featureFlagsService.test.ts` (13 tests)
- `api-server/__tests__/features/featureFlags/featureFlagsRoutes.test.ts` (17 tests)

#### Frontend (3 files)
- `admin-web/src/pages/FeatureSettingsPage.tsx`
- `admin-web/e2e/features/settings/feature-settings.spec.ts` (16 tests)
- `admin-web/e2e/helpers/selectors.ts`

#### Documentation (8 files)
- `.agent/System/Domain/ai-chatbot.md`
- `.agent/SOP/feature_flags_usage.md`
- `admin-web/e2e/GUIDELINES.md`
- `docs/settings/feature-settings.md`
- `docs/README.md`
- `docs/faq.md`
- `CLAUDE.md`
- `.agent/Features/Completed/enforce-custom-openai-keys/prd.md`

---

## Key Technical Patterns Established

### Frontend Validation Pattern
```typescript
// Frontend validation before API call
const handleSave = async () => {
  // Validate: Cannot enable chat assistant without API key
  if (featureFlags.chatAssistantEnabled && !featureFlags.openaiApiKey) {
    setValidationError('Please provide an OpenAI API key to enable the AI Chat Assistant');
    return;
  }

  // Validate API key format (must start with sk-)
  if (featureFlags.openaiApiKey && !featureFlags.openaiApiKey.startsWith('sk-')) {
    setValidationError('OpenAI API key must start with "sk-"');
    return;
  }

  // Clear validation error and proceed with save
  setValidationError(null);
  await saveFeatureFlags();
}
```

### Backend Validation (Defense in Depth)
```typescript
// Service layer validation
export async function updateTenantFeatureFlagsService(
  tenantId: string,
  updatedFlags: Partial<TenantFeatureFlags>
): Promise<TenantFeatureFlags> {
  // Validate: Cannot enable chat assistant without an API key
  if (updatedFlags.chatAssistantEnabled) {
    if (!updatedFlags.openaiApiKey) {
      throw Errors.validation(
        'Cannot enable AI Chat Assistant without providing an OpenAI API key',
        'Please provide a valid OpenAI API key (starting with "sk-") to enable the chat assistant'
      );
    }
  }

  // Proceed with update
  return await prisma.tenantFeatureFlags.update({ /* ... */ });
}
```

### Mantine Switch E2E Pattern
```typescript
// Click the label element (visible, interactive) instead of hidden checkbox
const switchLabel = page.locator(
  'label:has-text("Enable AI Chat Assistant"):has(input[data-testid="toggle-chat-assistant"])'
);
await switchLabel.click();

// Check state using the input's data-testid
const isChecked = await page.getByTestId('toggle-chat-assistant').isChecked();
```

### Scoped Text Assertions (Avoid Strict Mode Violations)
```typescript
// ❌ BAD: Matches text in both Alert and TextInput error
await expect(page.getByText(/please provide an openai api key/i)).toBeVisible();

// ✅ GOOD: Scoped to Alert component only
const validationAlert = page.getByTestId('alert-validation-error');
await expect(validationAlert).toBeVisible();
await expect(validationAlert.getByText(/please provide an openai api key/i)).toBeVisible();
```

---

## Impact on Users

### Before
- Tenants could enable AI Chat Assistant without providing an API key
- System used server-level `OPENAI_API_KEY` as fallback
- Developer bore the cost for all tenant AI usage
- No visibility into individual tenant costs

### After
- **Tenants MUST provide their own OpenAI API key** to enable chat assistant
- No server-level fallback
- Tenants have full control and visibility over AI costs via OpenAI dashboard
- Clear error messages and validation guide users through setup

### Migration Path
Existing tenants who previously used the chat assistant without providing their own key must:
1. Get an OpenAI API key from [OpenAI Platform](https://platform.openai.com/)
2. Navigate to Settings → Features
3. Enter the API key in the "OpenAI API Key" field
4. Ensure "Enable AI Chat Assistant" toggle is ON
5. Click "Save Settings"

**Cost:** Approximately $0.01-0.03 per chat interaction (varies by model and message length)

---

## Key Design Decisions

### 1. Mandatory Key on Enable
**Decision:** Require API key at the moment of enabling (not allowing "enable now, add key later")

**Rationale:** Prevents invalid configurations, clearer user expectations

### 2. Frontend Validation
**Decision:** Validate on frontend before save attempt

**Rationale:** Better UX than backend error, immediate feedback

### 3. Defense in Depth
**Decision:** Both frontend and backend validate the requirement

**Rationale:** Backend validation prevents circumventing frontend validation (security/data integrity)

### 4. Allow Disabling Without Key
**Decision:** Can set `chatAssistantEnabled=false` without providing key

**Rationale:** Allows tenants to disable feature if they remove key or billing expires

### 5. Keep `openaiApiKey` as Nullable
**Decision:** Don't make it required in type definition

**Rationale:** Key only required when feature is enabled, not always

---

## Known Limitations

- **Breaking change:** Existing tenants with `chatAssistantEnabled=true` but no `openaiApiKey` will need to add one
- API keys stored in plaintext in database (encryption at rest planned for future)
- Server-level `OPENAI_API_KEY` environment variable deprecated (can be removed if not used elsewhere)

---

## Future Enhancements (Out of Scope)

- API key encryption at rest
- Usage tracking per tenant (monitor API costs)
- API key rotation/expiry alerts
- Multi-key support (fallback to secondary key)
- Key validation on save (test against OpenAI API before accepting)
- API key usage analytics in admin dashboard

---

## Testing Summary

### Backend Tests (30 total)
**Service Layer (13 tests):**
- ✅ Returns tenant key when `chatAssistantEnabled=true` and key exists
- ✅ Returns `null` when `chatAssistantEnabled=false`
- ✅ Returns `null` when `chatAssistantEnabled=true` but no key
- ✅ Throws error when enabling without key
- ✅ Allows enabling with valid key
- ✅ Allows disabling without key
- ✅ Validates key format (starts with `sk-`)
- ✅ Partial updates work correctly
- ✅ Setting key to `null` after previously set
- ✅ Tenant not found error handling
- ✅ ... and 3 more

**API Routes (17 tests):**
- ✅ GET returns current flags correctly
- ✅ GET requires `theme:manage` permission
- ✅ PUT rejects enabling without key (400 validation error)
- ✅ PUT allows enabling with valid key
- ✅ PUT allows disabling without key
- ✅ PUT validates key format
- ✅ PUT requires `theme:manage` permission
- ✅ PUT supports idempotency
- ✅ PUT with invalid tenant slug (404)
- ✅ Cross-tenant access prevention
- ✅ ... and 7 more

### Frontend Tests (16 total)
**Validation Tests:**
- ✅ Prevents enabling chat assistant without API key (frontend validation)
- ✅ Allows enabling chat assistant WITH valid API key
- ✅ Validates API key format (must start with sk-)
- ✅ Clears validation error when user fixes the issue
- ✅ Allows disabling chat assistant without providing key
- ✅ Persists settings after page refresh

**Functionality Tests:**
- ✅ Owner can access Features page via System menu
- ✅ Displays all feature toggles and inputs
- ✅ Shows updated alert message about mandatory API key
- ✅ Enables and saves barcode scanning feature independently

**Permission Tests:**
- ✅ Owner can access Features page
- ✅ Admin can access Features page
- ✅ Editor cannot see Features nav link
- ✅ Viewer cannot see Features nav link

**Backend Validation Fallback:**
- ✅ Shows backend error if frontend validation bypassed (defense in depth)

---

## Related Documentation

- **PRD:** [prd.md](./prd.md)
- **System Docs:** [.agent/System/Domain/ai-chatbot.md](../../System/Domain/ai-chatbot.md)
- **SOP:** [.agent/SOP/feature_flags_usage.md](../../SOP/feature_flags_usage.md)
- **User Docs:** [docs/settings/feature-settings.md](../../../docs/settings/feature-settings.md)
- **E2E Guidelines:** [admin-web/e2e/GUIDELINES.md](../../../admin-web/e2e/GUIDELINES.md)

---

## Timeline

**Day 1 (2025-10-23):**
- Phase 1: Backend implementation and testing
- Updated system documentation
- Phase 2: Frontend implementation and E2E testing
- Fixed Mantine Switch selector patterns

**Day 2 (2025-10-24):**
- Fixed E2E test strict mode violations and TypeScript errors
- Phase 3: All documentation updates
- Created migration guide
- Updated user-facing documentation
- Moved to completed directory

---

**Total Impact:** 16 files modified, 46 tests rewritten/added, comprehensive documentation for seamless user migration.
