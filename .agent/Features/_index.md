# Features Index

This directory tracks all features throughout their lifecycle: from planning to completion. Features are organized by status to provide clear visibility into what's been built, what's in progress, and what's planned.

---

## Quick Navigation

| Status | Directory | Description |
|--------|-----------|-------------|
| **Completed** | [Completed/](#completed-features) | Shipped features with full documentation |
| **In Progress** | [InProgress/](#in-progress-features) | Features currently being implemented |
| **Planned** | [Planned/](#planned-features) | Roadmap and backlog items |

---

## Directory Structure

```
Features/
├── _index.md                    # This file
├── Completed/                   # Shipped features (flat, alphabetical)
│   ├── approval-rule-archival/
│   ├── e2e-test-refactoring/
│   ├── product-archival/
│   ├── session-expiration/
│   ├── stock-transfers-v1/
│   ├── stock-transfers-v2/
│   └── testing-implementation/
├── InProgress/                  # Active development
│   └── (feature folders)
└── Planned/                     # Backlog
    └── (feature folders)
```

**Why Flat Structure?**
- Features organized alphabetically by name for easier discovery
- "Did we do Suppliers?" → Just look for "suppliers-feature" folder
- Completion dates tracked in each feature's README.md metadata
- Simpler navigation (no nested date folders)
- Human-friendly: developers think in features, not completion dates

---

## Completed Features

Organized alphabetically by feature name in Completed/ folder. Listed here by completion date for temporal context.

### October 2025

#### Enforce Custom OpenAI API Keys
**Path:** `Completed/enforce-custom-openai-keys/`
**Status:** ✅ Completed
**Completion Date:** 2025-10-24

**Overview:**
Removed the server-level OpenAI API key fallback for the AI Chat Assistant feature. Tenants must now provide their own OpenAI API key to use the chat assistant, eliminating cost burden from the developer and providing tenants with full control over AI usage costs.

**Key Features:**
- Mandatory OpenAI API key requirement for AI Chat Assistant
- Frontend validation prevents enabling without valid API key
- Backend validation enforces requirement (defense in depth)
- API key format validation (must start with "sk-")
- Comprehensive migration guide for existing users
- Troubleshooting documentation
- Cost transparency (tenants pay directly via OpenAI)

**Documentation:**
- [README.md](./Completed/enforce-custom-openai-keys/README.md) - Feature summary and patterns
- [prd.md](./Completed/enforce-custom-openai-keys/prd.md) - Full PRD with implementation details
- [docs/settings/feature-settings.md](../../docs/settings/feature-settings.md) - User-facing setup guide

**Backend Changes:**
- Updated `apiKeyService.ts` - Removed server fallback, returns `null` if no tenant key
- Updated `tenantFeatureFlagsService.ts` - Added validation requiring key when enabling chat
- Updated `chatService.ts` - Improved error messages with configuration links

**Frontend Changes:**
- Updated `FeatureSettingsPage.tsx` - Frontend validation, format checks, auto-clearing errors
- Added validation error Alert component with `data-testid="alert-validation-error"`
- Updated help text and alerts to reflect mandatory requirement

**Testing:**
- 30 backend tests (13 service + 17 route) - All validation scenarios
- 16 E2E tests - Validation flows, permissions, Mantine Switch patterns
- Fixed strict mode violations (scoped text searches to Alert component)
- Established Mantine Switch interaction pattern in E2E Guidelines

**Developer Documentation:**
- Updated `CLAUDE.md` - Marked `OPENAI_API_KEY` as deprecated for tenant fallback
- Updated `.agent/System/Domain/ai-chatbot.md` - Removed fallback references
- Updated `.agent/SOP/feature_flags_usage.md` - Mandatory requirement emphasis
- Updated `admin-web/e2e/GUIDELINES.md` - Mantine Switch pattern documentation

**User Documentation:**
- Updated `docs/settings/feature-settings.md` - Setup guide, troubleshooting, migration
- Updated `docs/README.md` - Warnings and references
- Updated `docs/faq.md` - 3 new FAQs about API key requirements

---

#### Approval Rule Archival
**Path:** `Completed/approval-rule-archival/`
**Status:** ✅ Completed
**Completion Date:** 2025-10-18

**Overview:**
Soft delete enhancement for transfer approval rules, allowing rules to be archived (hidden from UI) and restored while preserving all historical data and original state.

**Key Features:**
- Archive approval rules (soft delete with audit trail)
- Restore archived rules with original isActive state preserved
- Three-way archive filter (active-only, archived-only, all)
- Archived and inactive badges in UI
- Archive/restore confirmation modals with user-friendly messaging
- Permission-based UI controls (stock:write required)
- Idempotent archive/restore operations in test factories

**Documentation:**
- [prd.md](./Completed/approval-rule-archival/prd.md) - Full PRD with implementation details

**Database Changes:**
- Added `isArchived` boolean field to `TransferApprovalRule`
- Added `archivedAt` timestamp field
- Added `archivedByUserId` foreign key field
- Updated unique constraint to allow duplicate priorities for archived rules

**API Changes:**
- Added `archivedFilter` query parameter to list endpoint (active-only | archived-only | all)
- Added `POST /api/transfer-approval-rules/{ruleId}/restore` endpoint
- Updated `DELETE` endpoint behavior (now archives instead of hard deletes)

**Testing:**
- 14 backend tests (Jest) - Archive/restore service tests
- 19 frontend tests (Playwright) - Archive flow, restore flow, filters, permissions, UI state

---

### January 2025

#### Stock Transfers v1
**Path:** `Completed/stock-transfers-v1/`
**Status:** ✅ Completed
**Completion Date:** January 2025

**Overview:**
Base implementation of stock transfer functionality allowing inventory movement between branches within a tenant.

**Key Features:**
- Transfer stock between branches
- FIFO lot consumption at source branch
- Automatic receipt at destination branch
- Transaction-based transfers (atomic operations)
- Audit trail via StockLedger
- Branch membership validation

**Documentation:**
- [README.md](./Completed/stock-transfers-v1/README.md) - Feature overview
- [prd.md](./Completed/stock-transfers-v1/prd.md) - Full PRD and implementation plan

**Database Changes:**
- Added `StockTransfer` table
- Added `transferId` to `StockLedger` entries
- New ledger entry types: `TRANSFER_OUT`, `TRANSFER_IN`

**Permissions:**
- `stock:transfer` - Permission to create stock transfers

---

---

#### Session Expiration Handler
**Path:** `Completed/session-expiration/`
**Status:** ✅ Completed
**Completion Date:** January 2025

**Overview:**
Graceful session expiration handling with automatic sign-in redirect and post-auth return navigation.

**Key Features:**
- Detect expired sessions (401 responses)
- Preserve intended destination URL
- Redirect to sign-in with return URL
- Automatic redirect after successful authentication
- Show user-friendly "session expired" message

**Documentation:**
- [README.md](./Completed/session-expiration/README.md) - Feature overview
- [prd.md](./Completed/session-expiration/prd.md) - Implementation details

**Implementation:**
- Enhanced HTTP client error handling
- Added return URL state management
- Updated sign-in flow to support redirects
- Improved user experience during session timeout

---

#### Stock Transfer Dispatch Notes
**Path:** `Completed/stock-transfer-dispatch-notes/`
**Status:** ✅ Completed
**Completion Date:** 2025-01-25

**Overview:**
Automated PDF dispatch note generation for stock transfers using Puppeteer with HTML/CSS templates. PDFs are auto-generated when transfers are shipped and stored in Supabase Storage for audit compliance and fast access. Users can preview, download, print, and regenerate dispatch notes with tenant-specific branding.

**Key Features:**
- Auto-generate branded dispatch note PDF on transfer shipment
- Preview dispatch note in modal with embedded PDF viewer
- Download and print dispatch notes from UI
- Regenerate PDFs if template or data changes
- Tenant branding applied (logo, colors, company info)
- Multi-tenant isolation in Supabase Storage

**Technical Highlights:**
- Puppeteer for HTML→PDF conversion
- Supabase Storage private bucket (`stock-transfer-pdfs`)
- CSP headers configured for iframe embedding
- 3-second fallback timer for PDF iframe onLoad
- Permission-based UI (`stock:read` for view, `stock:write` for regenerate)

**Documentation:**
- [README.md](./Completed/stock-transfer-dispatch-notes/README.md) - Feature completion summary
- [prd.md](./Completed/stock-transfer-dispatch-notes/prd.md) - Full PRD with all phases
- [dispatch-notes.md](../../docs/stock-transfers/dispatch-notes.md) - User guide

**Database Changes:**
- Added `dispatchNotePdfUrl` field to `StockTransfer` table
- Stores public URL from Supabase Storage

**Testing:**
- 24 backend tests (10 PDF service + 14 integration)
- 11 frontend E2E tests (auto-gen, preview, regeneration, permissions)
- Total: 35 tests passing

**Dependencies:**
- Puppeteer npm package (bundles Chromium)
- Supabase Storage bucket setup

---

#### Testing Implementation
**Path:** `Completed/testing-implementation/`
**Status:** ✅ Completed
**Completion Date:** January 2025

**Overview:**
Comprehensive testing infrastructure with 299 passing tests covering backend (Jest) and frontend (Playwright E2E).

**Key Achievements:**
- **Backend:** 227 Jest integration tests with real PostgreSQL database
- **Frontend:** 72 Playwright E2E tests covering user flows
- **Test Helpers:** Reusable factories and helpers for common test scenarios
- **RBAC Testing:** Permission-based testing across all user roles
- **Stock Testing:** FIFO logic validation
- **Flakiness Resolution:** Patterns for reliable, isolated tests

**Documentation:**
- [README.md](./Completed/testing-implementation/README.md) - Testing overview
- [prd.md](./Completed/testing-implementation/prd.md) - Testing strategy
- [issues.md](./Completed/testing-implementation/issues.md) - Resolved test issues

**Test Coverage:**
- Authentication & RBAC: 46 tests
- Stock Management FIFO: 23 tests
- Product Service: 27 tests
- API Routes: 70 tests
- Middleware: 58 tests
- Frontend E2E: 72 tests

**SOPs Created:**
- `.agent/SOP/testing-overview.md`
- `.agent/SOP/backend-testing.md`
- `.agent/SOP/frontend-testing.md`
- `.agent/SOP/test-flakiness.md`
- `.agent/SOP/troubleshooting-tests.md`

---

## In Progress Features

### Backend Test Refactoring
**Path:** `InProgress/backend-test-refactoring/`
**Status:** 📋 Planning
**Started:** 2025-10-21

**Overview:**
Comprehensive refactoring of 39 backend test files into a feature-based, hierarchical organization with complete RBAC coverage and standardized test patterns. This will establish a maintainable test structure, create comprehensive permission test coverage, and fill gaps in middleware and feature testing.

**Phases:**
- **PRD 1: Test Template & Structure** - 📋 Planned (standardized template + new directory structure + move 39 tests)
- **PRD 2: Permission Test Suite** - 📋 Planned (12 comprehensive RBAC permission test files)
- **PRD 3: New Middleware Tests** - 📋 Planned (3 missing middleware test files)
- **PRD 4: New Feature Tests Part 1** - 📋 Planned (8 core feature test files)
- **PRD 5: New Feature Tests Part 2** - 📋 Planned (12 advanced feature test files)

**Documentation:**
- [Master PRD](./InProgress/backend-test-refactoring/prd.md) - Overall refactoring plan and progress tracking
- [PRD 1](./InProgress/backend-test-refactoring/prd-1-test-template-and-structure.md) - Test template & directory structure
- [PRD 2](./InProgress/backend-test-refactoring/prd-2-permission-test-suite.md) - Permission test suite
- [PRD 3](./InProgress/backend-test-refactoring/prd-3-new-middleware-tests.md) - New middleware tests
- [PRD 4](./InProgress/backend-test-refactoring/prd-4-new-feature-tests-part1.md) - Core feature tests
- [PRD 5](./InProgress/backend-test-refactoring/prd-5-new-feature-tests-part2.md) - Advanced feature tests

**Expected Outcomes:**
- 39 existing test files reorganized into feature-based structure
- 12 new permission test files (comprehensive RBAC coverage)
- 3 new middleware test files (100% middleware coverage)
- 20 new feature test files (service + route coverage)
- Total: ~74 well-organized test files with 400+ passing backend tests (up from 227)

**Next Steps:**
- Begin PRD 1 implementation (test template + directory structure + file moves)

---

### Stock Transfers v2 Enhancements
**Path:** `InProgress/stock-transfers-v2/`
**Status:** ⏳ In Progress
**Started:** January 2025

**Overview:**
Multi-phase enhancement to stock transfers adding templates, reversals, approval delegation, barcode scanning, and analytics.

**Phases:**
- **Phase 1: Templates & Reversal** - ✅ Complete (backend, frontend, testing)
- **Phase 2: Approval Delegation** - ⏳ In Progress (backend ✅, frontend ✅, backend unit tests pending)
- **Phase 3: Barcode Scanning** - ✅ Complete (backend, frontend, E2E tests passing)
- **Phase 4: Analytics Dashboard** - 📋 Planned

**Key Features (Phase 1 Complete):**
- Transfer templates for recurring transfers
- Transfer reversal with FIFO cost preservation
- Template CRUD with search/filtering
- E2E tests passing

**Key Features (Phase 2 In Progress):**
- Multi-level approval workflows
- Approval rules with conditions
- Sequential/parallel approval modes
- Frontend approval UI complete
- Backend unit tests pending

**Key Features (Phase 3 Complete):**
- Barcode scanning modal with camera/manual modes
- Product lookup by barcode
- Bulk receive via barcode scanning
- 14 comprehensive E2E tests passing

**Documentation:**
- [README.md](./InProgress/stock-transfers-v2/README.md) - Feature overview
- [prd.md](./InProgress/stock-transfers-v2/prd.md) - Complete PRD with all 4 phases

**Database Changes:**
- Added `TransferTemplate` and `TransferTemplateItem` tables (Phase 1)
- Added approval tables: `TransferApprovalRule`, `TransferApprovalCondition`, `TransferApprovalLevel`, `TransferApprovalRecord` (Phase 2)
- Added barcode fields to `Product` table (Phase 3)

**Next Steps:**
- Complete backend unit tests for Phase 2
- Begin Phase 4 (Analytics dashboard) planning

### Feature Flags System
**Path:** `InProgress/feature-flags-system/`
**Status:** ✅ Phase 1 Complete
**Started:** January 14, 2025
**Completed:** January 14, 2025

**Overview:**
Tenant-level feature flag system for controlling feature availability on a per-tenant basis without code changes.

**Phases:**
- **Phase 1: Core Infrastructure** - ✅ Complete (all tests passing)
- **Phase 2: Admin UI for Feature Management** - 📋 Planned
- **Phase 3: Analytics & Monitoring** - 📋 Planned

**Key Features (Phase 1 Complete):**
- JSON-based feature flags on Tenant model
- Backend API includes flags in auth response
- Frontend hooks for checking feature flags
- Conditional UI rendering based on flags
- ACME tenant has barcode scanning enabled (testing)
- Globex tenant has barcode scanning disabled
- 9 E2E tests for feature flag behavior (all passing)

**Documentation:**
- [prd.md](./InProgress/feature-flags-system/prd.md) - Complete PRD with 3 phases
- [.agent/SOP/feature_flags_usage.md](../../SOP/feature_flags_usage.md) - Usage guide

**Database Changes:**
- Added `featureFlags Json?` column to `Tenant` table

**Current Feature Flags:**
- `barcodeScanningEnabled` (boolean) - Controls barcode scanning features
- `barcodeScanningMode` ('camera' | 'hardware' | 'both' | null) - Scanning mode

**Next Steps:**
- Phase 2: Admin UI for managing feature flags (when needed)
- Phase 3: Analytics and feature adoption tracking (when needed)

**To add a feature to InProgress:**
```bash
mkdir -p .agent/Features/InProgress/{feature-name}
# Create README.md and prd.md using template below
```

---

## Planned Features

**Status:** Currently empty

_No features are currently in the backlog._

**To add a feature to Planned:**
```bash
mkdir -p .agent/Features/Planned/{feature-name}
# Create README.md and prd.md using template below
```

**Potential future features:**
- Suppliers management
- Purchase orders
- Sales orders
- Inventory reporting dashboard
- Multi-warehouse advanced features
- Product categories/tags
- Low stock alerts
- Expiry date tracking
- Serial number tracking

---

## Feature Folder Template

When creating a new feature folder, use this structure:

```
{feature-name}/
├── README.md          # Feature overview and status
├── prd.md             # Product requirements document
└── {agent-name}.md    # Agent-specific outputs (optional)
```

### README.md Template

```markdown
# {Feature Name}

**Status:** 🚧 In Progress | 📋 Planned | ✅ Completed
**Start Date:** {date}
**Target Date:** {date}
**Completion Date:** {date} (if completed)

## Overview
{Brief description of what this feature does and why it's needed}

## Key Features
- {Feature 1}
- {Feature 2}
- {Feature 3}

## Documentation
- [PRD](./prd.md) - Product requirements and implementation plan
- [Agent Outputs](./database-expert.md) - Database expert work (if exists)

## Database Changes
- {Table or field changes}

## API Changes
- {New endpoints or modifications}

## Frontend Changes
- {New pages, components, or UI updates}

## Permissions
- {New permissions added}

## Testing
- Backend tests: {location or description}
- Frontend tests: {location or description}

## Related Work
- Commits: {git commit hashes or range}
- Pull Requests: {PR links}

## Notes
{Important context, decisions, or lessons learned}
```

### prd.md Template

```markdown
# Feature: {Name}

## PRD (Product Requirements Document)

### Goals
- Primary goal: {main objective}
- Secondary goals:
  - {goal 1}
  - {goal 2}

### User Stories
- As a {role}, I want to {action}, so that {benefit}
- As a {role}, I want to {action}, so that {benefit}

### Requirements

#### Functional Requirements
1. {Requirement 1}
2. {Requirement 2}
3. {Requirement 3}

#### Non-Functional Requirements
1. Performance: {criteria}
2. Security: {criteria}
3. Usability: {criteria}

### Acceptance Criteria
- [ ] {Criterion 1}
- [ ] {Criterion 2}
- [ ] {Criterion 3}

---

## Implementation Plan

### Phase 1: Database Changes

**New Tables:**
- {TableName}: {description}

**Modified Tables:**
- {TableName}: {changes}

**Migrations:**
```bash
npm run db:migrate -- --name {migration_name}
```

### Phase 2: Backend Implementation

**Services:**
- `{serviceName}Service.ts` - {description}

**Routes:**
- `POST /api/{resource}` - {description}
- `GET /api/{resource}/:id` - {description}
- `PUT /api/{resource}/:id` - {description}
- `DELETE /api/{resource}/:id` - {description}

**OpenAPI Schemas:**
- Define in `src/openapi/paths/{resource}.ts`

**Middleware:**
- Authentication: `requireAuthenticatedUserMiddleware`
- Permissions: `requirePermission('{permission}')`

### Phase 3: RBAC (if needed)

**New Permissions:**
- `{resource}:read` - View {resource}
- `{resource}:write` - Create/update {resource}
- `{resource}:delete` - Delete {resource}

**Role Assignments:**
- OWNER: all permissions
- ADMIN: all permissions
- EDITOR: read, write
- VIEWER: read only

### Phase 4: Frontend Implementation

**Pages:**
- `{Resource}Page.tsx` - List view
- `{Resource}DetailPage.tsx` - Detail/edit view

**Components:**
- `{Resource}Form.tsx` - Create/edit form
- `{Resource}Table.tsx` - Data table

**API Client:**
- `src/api/{resource}.ts` - API wrapper functions

**Routes:**
```tsx
{
  path: '/:tenantSlug/{resource}',
  element: <RequirePermission perm="{resource}:read"><{Resource}Page /></RequirePermission>
}
```

### Phase 5: Testing

**Backend Tests:**
- `__tests__/{resource}Service.test.ts` - Service layer tests
- `__tests__/routes/{resource}.test.ts` - API endpoint tests
- Test all RBAC roles (owner, admin, editor, viewer)
- Test multi-tenant isolation

**Frontend Tests:**
- `e2e/{resource}.spec.ts` - E2E user flows
- Test CRUD operations
- Test permission-based UI
- Test error handling

### Phase 6: Documentation

**System Docs to Update:**
- `.agent/System/database-schema.md` - Add new tables
- `.agent/System/rbac-system.md` - Add new permissions (if any)
- `.agent/System/architecture.md` - Update if architectural changes

**SOP Updates:**
- Update relevant SOPs if new patterns introduced

---

## Technical Decisions

### Decision 1: {Title}
**Context:** {why this decision was needed}
**Options Considered:**
- Option A: {pros/cons}
- Option B: {pros/cons}

**Decision:** {chosen option}
**Rationale:** {why}

### Decision 2: {Title}
{...}

---

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| {Risk 1} | High/Med/Low | High/Med/Low | {How to mitigate} |
| {Risk 2} | High/Med/Low | High/Med/Low | {How to mitigate} |

---

## Timeline

- **Week 1:** Database schema + migrations
- **Week 2:** Backend API implementation
- **Week 3:** Frontend UI implementation
- **Week 4:** Testing + bug fixes

---

## Success Metrics

- [ ] All acceptance criteria met
- [ ] Test coverage ≥ 80%
- [ ] No P0/P1 bugs
- [ ] Documentation updated
- [ ] Code review approved
- [ ] Deployed to production

---

**Last Updated:** {date}
**Status:** {Planned | In Progress | Completed}
```

---

## Feature Lifecycle Workflow

### 1. Planning Phase
```bash
# Create planned feature folder
mkdir -p .agent/Features/Planned/{feature-name}

# Create README.md and prd.md using templates above
# Fill in requirements, user stories, acceptance criteria
```

### 2. Development Phase
```bash
# Move to InProgress when starting work
mv .agent/Features/Planned/{feature-name} \
   .agent/Features/InProgress/{feature-name}

# Update README.md status to "In Progress"
# Add start date

# As agents work on the feature, they add:
# - database-expert.md
# - backend-api-expert.md
# - frontend-expert.md
# - test-engineer.md
# - etc.
```

### 3. Completion Phase
```bash
# Update README.md with completion date FIRST
# Then move to Completed/ (flat structure by feature name)
mv .agent/Features/InProgress/{feature-name} \
   .agent/Features/Completed/{feature-name}

# Update README.md:
# - Status: "Completed"
# - Completion date (e.g., "2025-01-15")
# - Git commit hashes
# - Final notes

# Update this index file (_index.md) to add feature to chronological list
```

### 4. Archive Strategy

**Retention:**
- Keep all completed features indefinitely
- Organize alphabetically by feature name for easy discovery
- Completion dates stored in each feature's README.md metadata

**When to archive:**
- Feature is fully deployed to production
- All tests are passing
- Documentation is updated
- No outstanding issues
- README.md contains completion date

**Why Feature-Name Organization:**
- Human-friendly: "Did we do Suppliers?" → look for "suppliers-feature" alphabetically
- Simpler navigation: no nested date folders
- Date information preserved in README.md
- Easier to find features by name than by completion date

---

## Agent Integration

When agents work on features, they create outputs in two locations:

**1. Agent Work Log:**
`.agent/Agents/{agent-name}/work/{feature}-{date}.md`

**2. Feature Folder:**
`.agent/Features/{status}/{feature-name}/{agent-name}.md`

**Example:**
```
database-expert working on "suppliers" feature creates:
- .agent/Agents/database-expert/work/suppliers-schema-2025-01-15.md
- .agent/Features/InProgress/suppliers/database-expert.md
```

**See:** `.agent/Agents/_index.md` for agent registry and capabilities

---

## Statistics

**Completed Features:** 3
- Stock Transfers v1
- Session Expiration Handler
- Testing Implementation

**In Progress:** 3
- Backend Test Refactoring (5 PRDs - 📋 Planning)
- Stock Transfers v2 (Phase 1 ✅, Phase 2 ⏳, Phase 3 ✅, Phase 4 📋)
- Feature Flags System (Phase 1 ✅, Phases 2-3 📋)

**Planned:** 0

**Total Tests Added:** 308 (227 backend + 81 frontend)
- Original: 299 tests
- Barcode scanning: 14 frontend tests (stock-transfers-v2 Phase 3)
- Feature flags: 9 frontend tests
- Total: 227 backend + 72 + 14 = 86 frontend, but stock-transfers barcode tests overlap, so 72 + 9 = 81 unique frontend

**Database Tables Added:** 6
- StockTransfer, TransferTemplate (Stock Transfers v1)
- TransferApprovalRule, TransferApprovalCondition, TransferApprovalLevel, TransferApprovalRecord (Stock Transfers v2 Phase 2)

**Database Columns Added:** 3
- Product: barcode, barcodeType (Stock Transfers v2 Phase 3)
- Tenant: featureFlags (Feature Flags Phase 1)

**New Permissions:** 1 (stock:transfer)

---

## Related Documentation

- **System Docs:** `.agent/System/_index.md` - Architecture and design docs
- **SOPs:** `.agent/SOP/_index.md` - Standard operating procedures
- **Agents:** `.agent/Agents/_index.md` - Agent registry and work logs
- **Main Index:** `.agent/README.md` - Master documentation index

---

**Last Updated:** 2025-10-21
**Total Features:** 3 completed, 3 in progress (Backend Test Refactoring + Stock Transfers v2 + Feature Flags), 0 planned
**Next Review:** Begin PRD 1 of Backend Test Refactoring; Complete Phase 2 of Stock Transfers v2; Move Feature Flags to Completed when all phases done
