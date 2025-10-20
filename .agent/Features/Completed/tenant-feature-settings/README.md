# Tenant Feature Settings

**Status:** ✅ Complete
**Started:** October 20, 2025
**Completed:** October 20, 2025

## Overview
Tenant-specific feature flag management system with UI allowing tenants to control their own OpenAI API keys for the AI Chat Assistant and configure feature availability (chat assistant, barcode scanning). Solves cost allocation issues by enabling tenants to use their own API budgets instead of sharing the server's API key.

## Key Features
- **Tenant-Specific API Keys**: Each tenant can provide their own OpenAI API key for AI Chat Assistant
- **Feature Flag UI**: Admin interface for enabling/disabling features (chat assistant, barcode scanning)
- **Fallback System**: Automatic fallback to server's API key if tenant doesn't provide one
- **Cost Control**: Tenants have full control over their AI costs when using custom keys
- **Validation**: API key format validation (must start with 'sk-')
- **Security**: Permission-based access (`theme:manage` required), password-masked API key input

## Implementation Phases
1. **Phase 1: Backend** - Tenant-specific API key storage & retrieval service
2. **Phase 2: Frontend** - Feature Settings UI with toggles and API key input
3. **Documentation** - System docs, SOPs, and end-user guides

## Test Coverage
- **47 passing tests** (30 backend + 17 frontend E2E)
- 100% pass rate
- Full coverage: API key service, feature flags CRUD, permission enforcement, UI interactions

## Documentation
- [PRD](./prd.md) - Complete product requirements and implementation details
- [System Docs](../../System/Domain/ai-chatbot.md#tenant-specific-api-keys) - Technical architecture and API key fallback
- [SOP](../../SOP/feature_flags_usage.md) - Feature flags usage guide with chatAssistantEnabled documentation
- [End-User Guide](../../../docs/settings/feature-settings.md) - How to configure features via UI

## Key Technologies
- **Backend**: Node.js, Express, Prisma, PostgreSQL (JSON column for feature flags)
- **Frontend**: React, Mantine UI (Switch components, password-masked input)
- **Testing**: Jest (backend), Playwright (E2E)
- **Storage**: Tenant.featureFlags JSON column (no schema migration needed)

## Files Created
### Backend
- `api-server/src/types/tenant.ts` - TenantFeatureFlags interface
- `api-server/src/services/chat/apiKeyService.ts` - Tenant-specific API key retrieval with fallback
- `api-server/src/services/tenantFeatureFlagsService.ts` - Feature flags CRUD operations
- `api-server/__tests__/services/tenantFeatureFlags.test.ts` - Service tests (13 tests)
- `api-server/__tests__/routes/tenantFeatureFlagsRoutes.test.ts` - API route tests (17 tests)

### Frontend
- `admin-web/src/api/tenantFeatureFlags.ts` - API client for feature flags
- `admin-web/src/pages/FeatureSettingsPage.tsx` - Feature settings UI page
- `admin-web/e2e/features/feature-settings.spec.ts` - E2E tests (17 tests)

### Files Modified
- `api-server/src/services/chat/chatService.ts` - Uses tenant API key via apiKeyService
- `api-server/src/routes/tenantThemeRouter.ts` - Added GET/PUT feature flags endpoints
- `api-server/src/openapi/schemas/tenants.ts` - Feature flags OpenAPI schemas
- `api-server/src/openapi/paths/tenants.ts` - Feature flags endpoint documentation
- `admin-web/src/components/shell/SidebarNav.tsx` - Added "Features" nav link
- `admin-web/src/main.tsx` - Added Features page route with permission guard
- `admin-web/e2e/helpers/selectors.ts` - Added FEATURES selectors
- `admin-web/e2e/features/feature-flags.spec.ts` - Fixed barcode scanning test

### Documentation
- `.agent/System/Domain/ai-chatbot.md` - Added tenant-specific API keys section
- `.agent/SOP/feature_flags_usage.md` - Added chatAssistantEnabled and openaiApiKey documentation
- `docs/settings/feature-settings.md` - **NEW** End-user guide for managing features
- `docs/README.md` - Added Feature Settings to documentation index

## Security
- ✅ Permission-based access (`theme:manage` required for Features page)
- ✅ API key format validation (must start with 'sk-')
- ✅ Password-masked API key input in UI
- ✅ Idempotency support for feature flag updates
- ✅ Multi-tenant isolation (all queries filtered by tenantId)
- ⚠️ API keys stored in plaintext (acceptable for MVP, encryption planned for Phase 3)

## Cost Allocation
- **Tenant provides API key**: All chat costs billed to tenant's OpenAI account
- **Tenant uses server key**: All chat costs billed to server's OpenAI account
- **Fallback behavior**: Seamless fallback to server key if tenant key not provided

## API Endpoints
```typescript
GET  /api/tenants/:tenantSlug/feature-flags
PUT  /api/tenants/:tenantSlug/feature-flags
```

## Feature Flags Managed
- `chatAssistantEnabled` (boolean) - Enable/disable AI Chat Assistant
- `openaiApiKey` (string | null) - Tenant's OpenAI API key
- `barcodeScanningEnabled` (boolean) - Enable/disable barcode scanning

## E2E Test Patterns Learned
- **Mantine Switch Components**: Click label text, not hidden input; use `getByTestId().toBeChecked()` to verify state
- **Seed Data Awareness**: Tests must account for default feature flags (ACME has barcodeScanningEnabled: true)
- **State Checking**: Check current state before toggling to avoid accidental disabling
- **Transfer Factory Issue**: `createAndShip()` also receives the transfer, leaving it COMPLETED instead of IN_TRANSIT

## Notes
Built following the standardized PRD template with backend-first workflow, comprehensive test coverage, and full documentation. Successfully integrates with existing AI Chat Assistant, feature flags system, RBAC, and multi-tenant architecture. Provides tenant autonomy for cost control while maintaining seamless fallback to server defaults.
