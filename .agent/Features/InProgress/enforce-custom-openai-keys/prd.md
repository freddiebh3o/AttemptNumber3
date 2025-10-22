# Enforce Custom OpenAI API Keys for AI Chat Assistant

**Status:** 📋 Planning
**Priority:** High
**Estimated Effort:** 2-3 days
**Created:** 2025-10-20
**Last Updated:** 2025-10-20

---

## Overview

Remove the server-level OpenAI API key fallback for the AI Chat Assistant feature. Currently, tenants can enable the chat assistant without providing their own API key, falling back to the server's `OPENAI_API_KEY` environment variable. This creates cost allocation issues where the developer bears the cost for all tenant usage. Going forward, tenants MUST provide their own OpenAI API key to use the AI Chat Assistant feature.

**Key Capabilities:**
- Tenants must provide a valid OpenAI API key (`sk-...`) to enable the chat assistant
- No server-level fallback key (removes cost burden from developer)
- Frontend validation prevents enabling chat assistant without a valid key
- Backend validation enforces API key requirement
- Clear error messages guide users to provide their own key
- Existing tenants with chat assistant enabled but no custom key will need to add one

**Related Documentation:**
- [Tenant Feature Settings PRD](../../Completed/tenant-feature-settings/prd.md) - Original implementation (with fallback)
- [Feature Flags Usage SOP](../../../SOP/feature_flags_usage.md) - Current feature flag system
- [AI Chatbot System](../../../System/Domain/ai-chatbot.md) - AI chatbot architecture
- [Testing Guide](../../../SOP/testing-overview.md) - Testing strategy

---

## Phase 1: Backend - Remove Fallback & Add Validation

**Goal:** Remove server API key fallback and enforce custom key requirement when enabling chat assistant.

**Relevant Files:**
- [api-server/src/services/chat/apiKeyService.ts](../../../api-server/src/services/chat/apiKeyService.ts)
- [api-server/src/services/tenantFeatureFlagsService.ts](../../../api-server/src/services/tenantFeatureFlagsService.ts)
- [api-server/src/services/chat/chatService.ts](../../../api-server/src/services/chat/chatService.ts)
- [api-server/__tests__/services/tenantFeatureFlags.test.ts](../../../api-server/__tests__/services/tenantFeatureFlags.test.ts)
- [api-server/__tests__/routes/tenantFeatureFlagsRoutes.test.ts](../../../api-server/__tests__/routes/tenantFeatureFlagsRoutes.test.ts)

### Backend Implementation

- [ ] Update seed file so that the acme tenant automatically gets seeded with the OPENAI_API_KEY from the server .env file
- [ ] Update `getOpenAIApiKey()` in [apiKeyService.ts](../../../api-server/src/services/chat/apiKeyService.ts):
  - Remove fallback to `process.env.OPENAI_API_KEY`
  - Only return tenant's `openaiApiKey` if `chatAssistantEnabled=true` AND key exists
  - Return `null` if conditions not met (no fallback)
  - Update JSDoc comments to reflect new behavior
- [ ] Update `updateTenantFeatureFlagsService()` in [tenantFeatureFlagsService.ts](../../../api-server/src/services/tenantFeatureFlagsService.ts):
  - Add validation: If `chatAssistantEnabled=true`, require `openaiApiKey` to be provided
  - Throw validation error if enabling without key: "Cannot enable AI Chat Assistant without providing an OpenAI API key"
  - Allow disabling chat assistant without key (set `chatAssistantEnabled=false`)
  - Allow updating key when chat assistant already enabled
- [ ] Update error handling in `chatService.ts`:
  - Improve error message when API key is `null`
  - Message: "AI Chat Assistant requires an OpenAI API key. Please ask your administrator to add one in Settings > Features"
  - Link to configuration page in error message
- [ ] **Rewrite existing backend tests** (13 service tests + 17 route tests = 30 tests to update):
  - Update service tests in [tenantFeatureFlags.test.ts](../../../api-server/__tests__/services/tenantFeatureFlags.test.ts):
    - Remove tests for server API key fallback (lines 38-52)
    - Update "should return tenant key" test to not use fallback
    - Add test: "should throw error when enabling without API key"
    - Add test: "should allow disabling without API key"
    - Add test: "should return null when chatAssistantEnabled=false"
    - Add test: "should return null when chatAssistantEnabled=true but no key"
  - Update route tests in [tenantFeatureFlagsRoutes.test.ts](../../../api-server/__tests__/routes/tenantFeatureFlagsRoutes.test.ts):
    - Add test: "PUT should reject enabling chat assistant without key (400)"
    - Add test: "PUT should allow enabling chat assistant with valid key"
    - Add test: "PUT should allow disabling chat assistant without key"
    - Update existing tests to not rely on server fallback
- [ ] Backend tests passing (all 30 tests)
- [ ] Confirm all tests pass before moving to frontend

### Documentation

- [ ] Update [ai-chatbot.md](../../../System/Domain/ai-chatbot.md):
  - Remove references to server API key fallback (lines 1020-1030)
  - Update "Tenant-Specific API Keys" section to reflect mandatory requirement
  - Update "API Key Priority" section (remove item 2: Server's Default API Key)
- [ ] Update [feature_flags_usage.md](../../../SOP/feature_flags_usage.md):
  - Update `chatAssistantEnabled` flag description (line 273-283)
  - Update `openaiApiKey` flag description (line 285-295)
  - Remove "fallback to system default" language

---

## Phase 2: Frontend - Add Validation & Improve UX

**Goal:** Add frontend validation to prevent enabling chat assistant without API key, improve error messages.

**Relevant Files:**
- [admin-web/src/pages/FeatureSettingsPage.tsx](../../../admin-web/src/pages/FeatureSettingsPage.tsx)
- [admin-web/e2e/features/feature-settings.spec.ts](../../../admin-web/e2e/features/feature-settings.spec.ts)

### Frontend Implementation

- [ ] OpenAPI types regenerated (run `npm run openapi:gen` from admin-web)
- [ ] Update `FeatureSettingsPage.tsx`:
  - Add validation: Cannot save if `chatAssistantEnabled=true` AND `openaiApiKey` is empty
  - Show inline validation error: "API key required to enable chat assistant"
  - Disable "Save Settings" button when validation fails
  - Add visual indicator (red border) on API key input when invalid
  - Update help text: "Required to enable AI Chat Assistant. Leave blank to disable feature."
  - Update Alert component text to reflect mandatory requirement
  - Add `data-testid="validation-error-api-key"` for validation error message
- [ ] **Rewrite existing E2E tests** (17 tests in [feature-settings.spec.ts](../../../admin-web/e2e/features/feature-settings.spec.ts)):
  - Remove tests that rely on server fallback
  - Add test: "should prevent enabling chat assistant without API key"
  - Add test: "should show validation error when enabling without key"
  - Add test: "should allow enabling chat assistant with valid key"
  - Add test: "should allow disabling chat assistant without key"
  - Add test: "should clear validation error when key is provided"
  - Add test: "should disable save button when validation fails"
  - Update existing "save settings" test to provide API key
  - Update role-based permission tests to account for new validation
- [ ] E2E tests passing (all 17+ tests)

### Documentation

- [ ] Update [feature-settings.md](../../../docs/settings/feature-settings.md) (user-facing docs for AI assistant):
  - Add section explaining mandatory API key requirement
  - Add instructions on how to get an OpenAI API key
  - Add troubleshooting section for "cannot enable" errors
  - Update screenshots if applicable

---

## Phase 3: Final Documentation & Migration Guide

**Goal:** Update all documentation to reflect new mandatory key requirement and provide migration guide for existing users.

### Documentation

- [ ] Update [README.md](../../../docs/README.md):
  - Update AI Chat Assistant section if mentioned
  - Link to updated feature-settings.md
- [ ] Update [faq.md](../../../docs/faq.md):
  - Add FAQ: "Why do I need my own OpenAI API key?"
  - Add FAQ: "Where do I get an OpenAI API key?"
  - Add FAQ: "What happens if I don't provide an API key?"
- [ ] Update [CLAUDE.md](../../../CLAUDE.md):
  - Update environment variables section
  - Note that `OPENAI_API_KEY` is no longer used as fallback for tenant chat
  - Clarify that server key only used for system-level operations (if any)
- [ ] Create migration guide in [docs/settings/feature-settings.md](../../../docs/settings/feature-settings.md):
  - Section: "Migrating from Server-Level API Keys"
  - Explain change and why it was made
  - Instructions for tenants to add their own keys
  - Cost implications and billing information

---

## Testing Strategy

### Backend Tests (Jest)

**Service Layer:** (13 tests to rewrite in [tenantFeatureFlags.test.ts](../../../api-server/__tests__/services/tenantFeatureFlags.test.ts))
- [ ] Test `getOpenAIApiKey()` returns tenant key when `chatAssistantEnabled=true` and key exists
- [ ] Test `getOpenAIApiKey()` returns `null` when `chatAssistantEnabled=false`
- [ ] Test `getOpenAIApiKey()` returns `null` when `chatAssistantEnabled=true` but no key
- [ ] Test `getOpenAIApiKey()` returns `null` when key is empty string
- [ ] Test `updateTenantFeatureFlagsService()` throws error when enabling without key
- [ ] Test `updateTenantFeatureFlagsService()` allows enabling with valid key
- [ ] Test `updateTenantFeatureFlagsService()` allows disabling without key
- [ ] Test `updateTenantFeatureFlagsService()` validates key format (starts with `sk-`)
- [ ] Test partial updates work correctly
- [ ] Test setting key to `null` after previously set
- [ ] Test tenant not found error handling

**API Routes:** (17 tests to rewrite in [tenantFeatureFlagsRoutes.test.ts](../../../api-server/__tests__/routes/tenantFeatureFlagsRoutes.test.ts))
- [ ] Test GET returns current flags correctly
- [ ] Test GET requires `theme:manage` permission
- [ ] Test PUT rejects enabling without key (400 validation error)
- [ ] Test PUT allows enabling with valid key
- [ ] Test PUT allows disabling without key
- [ ] Test PUT validates key format
- [ ] Test PUT requires `theme:manage` permission
- [ ] Test PUT supports idempotency
- [ ] Test PUT with invalid tenant slug (404)
- [ ] Test cross-tenant access prevention

### Frontend Tests (Playwright E2E)

**User Flows:** (17+ tests in [feature-settings.spec.ts](../../../admin-web/e2e/features/feature-settings.spec.ts))
- [ ] Test cannot enable chat assistant without API key
- [ ] Test validation error shown when enabling without key
- [ ] Test save button disabled when validation fails
- [ ] Test can enable chat assistant with valid key
- [ ] Test can disable chat assistant without key
- [ ] Test validation error clears when key provided
- [ ] Test API key input shows red border when invalid
- [ ] Test help text reflects mandatory requirement
- [ ] Test alert message reflects mandatory requirement
- [ ] Test form state persistence
- [ ] Test navigation and permission checks

**Permission-Based UI:**
- [ ] Test OWNER can update feature flags
- [ ] Test ADMIN can update feature flags
- [ ] Test EDITOR cannot access feature settings page
- [ ] Test VIEWER cannot access feature settings page

---

## Success Metrics

- [ ] No server-level API key fallback (cost burden removed from developer)
- [ ] Frontend validation prevents invalid configurations
- [ ] Backend validation enforces API key requirement
- [ ] All 30+ backend tests passing (13 service + 17 route)
- [ ] All 17+ E2E tests passing
- [ ] Clear error messages guide users to correct actions
- [ ] Documentation updated to reflect mandatory requirement
- [ ] Migration guide available for existing users

---

## Notes & Decisions

**Key Design Decisions:**
1. **Mandatory Key on Enable:** Require API key at the moment of enabling (not allowing "enable now, add key later")
   - Rationale: Prevents invalid configurations, clearer user expectations
2. **Frontend Validation:** Validate on frontend before save attempt
   - Rationale: Better UX than backend error, immediate feedback
3. **Allow Disabling Without Key:** Can set `chatAssistantEnabled=false` without providing key
   - Rationale: Allows tenants to disable feature if they remove key or billing expires
4. **Keep `openaiApiKey` as Nullable:** Don't make it required in type definition
   - Rationale: Key only required when feature is enabled, not always

**Known Limitations:**
- Existing tenants with `chatAssistantEnabled=true` but no `openaiApiKey` will need to add one (breaking change)
- Server-level `OPENAI_API_KEY` environment variable no longer used for tenant chat (can be removed if not used elsewhere)

**Migration Impact:**
- Tenants currently using chat assistant with server fallback will lose access until they add their own key
- Mitigation: Clear migration guide, error messages with instructions

**Future Enhancements (Out of Scope):**
- API key encryption at rest (currently plaintext)
- Usage tracking per tenant (monitor API costs)
- API key rotation/expiry alerts
- Multi-key support (fallback to secondary key)
- Key validation on save (test against OpenAI API before accepting)

---

**Template Version:** 1.0
**Created:** 2025-10-20
