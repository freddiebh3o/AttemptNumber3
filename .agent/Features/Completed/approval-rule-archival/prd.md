# Approval Rule Archival (Soft Delete Enhancement) - Implementation Plan

**Status:** ✅ Complete
**Priority:** Low
**Estimated Effort:** 0.5-1 day
**Created:** 2025-10-17
**Last Updated:** 2025-10-18
**Completed:** 2025-10-18

---

## Overview

Enhance the existing `isActive` flag on TransferApprovalRule with full archival functionality. Currently, approval rules can be disabled via `isActive: false`, but this still shows them in the UI as "Inactive". True archival completely hides obsolete rules from the UI while preserving them in the database for audit purposes and allowing restoration if needed.

**Key Capabilities:**
- Archive approval rules instead of hard delete (preserves audit trail)
- Full archival on top of existing `isActive` flag (disabled rules can be archived)
- Filter archived rules from active views with dropdown (active-only, archived-only, all)
- Archive rules from rule management page with confirmation modal
- Restore archived rules (users with stock:transfer permission)

**Related Documentation:**
- [Database Schema](../../System/database-schema.md) - TransferApprovalRule model reference
- [Stock Transfers Guide](../../SOP/stock-transfers-feature-guide.md) - Approval workflow
- [Product Archival PRD](../Completed/product-archival/prd.md) - Similar implementation pattern

**Problem Being Solved:**
Disabled approval rules (`isActive: false`) still clutter the rule management UI. As approval workflows evolve, old rules accumulate (outdated thresholds, deprecated conditions, restructured approval chains). Full archival provides complete hiding from UI while maintaining the ability to restore if workflow needs to be reinstated.

**Relationship to isActive Flag:**
- `isActive: false` = Rule disabled but visible in UI (temporary)
- `isArchived: true` = Rule completely hidden from UI (permanent removal from active workflow)
- Both fields can coexist: archived rules inherit their isActive state for restoration

---

## Phase 1: Soft Delete Implementation

**Goal:** Implement archive/restore functionality for approval rules with full backend and frontend support

**Relevant Files:**
- [api-server/prisma/schema.prisma](../../api-server/prisma/schema.prisma) - TransferApprovalRule model
- [api-server/src/services/approvalRuleService.ts](../../api-server/src/services/approvalRuleService.ts) - Approval rule service
- [api-server/src/routes/approvalRulesRouter.ts](../../api-server/src/routes/approvalRulesRouter.ts) - Approval rule routes
- [api-server/src/openapi/paths/approval-rules.ts](../../api-server/src/openapi/paths/approval-rules.ts) - OpenAPI schemas
- [admin-web/src/pages/ApprovalRulesPage.tsx](../../admin-web/src/pages/ApprovalRulesPage.tsx) - Rules list UI
- [admin-web/src/pages/ApprovalRulePage.tsx](../../admin-web/src/pages/ApprovalRulePage.tsx) - Rule detail UI

### Backend Implementation

- [x] Database schema changes (create migration: `add_approval_rule_archival`)
  - [x] Add `isArchived Boolean @default(false)` to TransferApprovalRule model
  - [x] Add `archivedAt DateTime?` (optional, for tracking when)
  - [x] Add `archivedByUserId String?` (optional, for tracking who)
  - [x] Add index on `isArchived` for query performance: `@@index([tenantId, isArchived])`
  - [x] Keep existing `isActive` field (both fields coexist)
- [x] Prisma client regeneration
- [x] Update `approvalRulesService.ts`:
  - [x] Update list queries to filter `isArchived: false` by default
  - [x] Update `deleteRule()` to set `isArchived: true` instead of hard delete
  - [x] Add `restoreRule()` function (sets isArchived: false, clears archivedAt)
  - [x] Add `archivedFilter` parameter with 3 modes: "active-only" (default), "archived-only", "all"
  - [x] Allow `getRule()` to return archived rules (needed for detail page access)
  - [x] Rule evaluation excludes archived rules (isArchived: false AND isActive: true)
  - [x] Preserve isActive state when archiving (restored rules retain original active/inactive state)
- [x] Update OpenAPI schemas:
  - [x] Add `archivedFilter` enum query parameter to GET /transfer-approval-rules
  - [x] Add POST `/transfer-approval-rules/:id/restore` endpoint schema
  - [x] Update TransferApprovalRule response schema to include isArchived fields
- [x] Update routes:
  - [x] Change DELETE `/transfer-approval-rules/:id` to call archiveRule (requires `stock:write`)
  - [x] Add POST `/transfer-approval-rules/:id/restore` endpoint (requires `stock:write`)
  - [x] Add `archivedFilter` query param support to GET `/transfer-approval-rules`
- [x] Backend tests written and passing (14 tests total)
  - [x] Archive rule (should succeed)
  - [x] Restore archived rule preserves original isActive state
  - [x] List rules filters archived by default
  - [x] List rules with archivedFilter='archived-only' shows only archived
  - [x] List rules with archivedFilter='all' shows all rules
  - [x] getRule() allows access to archived rules
  - [x] Rule evaluation excludes archived rules
  - [x] Permission checks (multi-tenant isolation)
  - [x] Audit trail preservation (UPDATE events for restore)
- [x] Confirm all backend tests pass before moving to frontend

### Frontend Implementation

- [x] OpenAPI types regenerated (`npm run openapi:gen`)
- [x] Update `api/approvalRules.ts`:
  - [x] Add `restoreRule()` function
  - [x] Add `archivedFilter` parameter to `listApprovalRules()`
- [x] Update ApprovalRulesPage component (list view):
  - [x] Add archive filter dropdown in FilterBar with 3 options:
    - "Active rules only" (active-only - default)
    - "Archived rules only" (archived-only)
    - "All rules (active + archived)" (all)
  - [x] Display "Archived" badge on rules in table (data-testid="approval-rule-archived-badge")
  - [x] Display "Inactive" badge on rules where isActive: false (data-testid="approval-rule-inactive-badge")
  - [x] Archive filter properly synced with URL params
  - [x] Add archive/restore buttons to table row actions
    - [x] Archive button for non-archived rules (data-testid="archive-approval-rule-btn")
    - [x] Restore button for archived rules (data-testid="restore-approval-rule-btn")
    - [x] Disable isActive toggle for archived rules
- [x] Add archive and restore confirmation modals
  - [x] Archive modal with user-friendly explanation
  - [x] Restore modal explaining state preservation
- [x] E2E tests written and passing (19 tests total, all passing)
  - [x] Archive rule from list page (with confirmation modal)
  - [x] Cancel archive confirmation modal (verify no changes)
  - [x] Restore archived rule from archived filter view
  - [x] Restored rule retains original isActive state (inactive)
  - [x] Restored rule retains original isActive state (active)
  - [x] Filter dropdown shows only archived rules
  - [x] Filter dropdown shows all rules (active + archived)
  - [x] Default filter shows active-only
  - [x] Clear archive filter resets to default (active only)
  - [x] Verify permission checks for archive/restore actions (VIEWER role)
  - [x] Verify permission checks for admins (stock:write permission)
  - [x] Verify archived rules have disabled isActive toggle
  - [x] Verify both archived and inactive badges display correctly

### Documentation

- [x] Update user guide with archive/restore workflows
  - [x] Created [/docs/stock-transfers/approval-rules.md](/docs/stock-transfers/approval-rules.md) - comprehensive 450+ line guide
  - [x] Covers creating rules, managing rules, archiving/restoring, approval modes, troubleshooting
- [x] Document archive vs inactive states (isArchived vs isActive)
  - [x] Dedicated section in approval-rules.md explaining difference
  - [x] Visual examples and use cases for each state
- [x] Document archive filter and permissions
  - [x] Three-way filter documented (active-only, archived-only, all)
  - [x] Permission requirements (stock:write) clearly stated
- [x] Add troubleshooting and common tasks
  - [x] Updated [/docs/troubleshooting/common-issues.md](/docs/troubleshooting/common-issues.md)
  - [x] Added "Approval Rule Not Triggering" section
  - [x] Added "Can't Find Archived Approval Rule" section
  - [x] Updated "Transfer Stuck in REQUESTED Status" with approval rule context
- [x] Update user documentation index
  - [x] Updated [/docs/README.md](/docs/README.md) to include approval rules guide
  - [x] Added to Stock Transfers section with proper ordering
- [x] Cross-reference existing docs
  - [x] Updated [/docs/stock-transfers/approving-transfers.md](/docs/stock-transfers/approving-transfers.md)
  - [x] Added reference to approval rules guide in multi-level approval section

---

## Testing Strategy

### Backend Tests (Jest)

**Service Layer:**
- [ ] Archive rule succeeds
- [ ] Archive rule updates isArchived, archivedAt, archivedByUserId
- [ ] Restore rule clears archive fields and preserves isActive state
- [ ] List rules excludes archived by default
- [ ] List rules with archivedFilter='archived-only' returns only archived
- [ ] List rules with archivedFilter='all' returns all rules
- [ ] getRule() allows access to archived rules
- [ ] Rule evaluation excludes archived rules (only non-archived, active rules)
- [ ] Multi-tenant isolation (cannot archive other tenant's rules)
- [ ] Audit trail preservation (UPDATE events for restore)

**API Routes:**
- [ ] DELETE /approval-rules/:id sets isArchived instead of deleting
- [ ] POST /approval-rules/:id/restore restores archived rule
- [ ] GET /approval-rules with archivedFilter parameter works correctly
- [ ] GET /approval-rules/:id returns archived rules (for detail page access)

### Frontend Tests (Playwright E2E)

**User Flows:**
- [ ] Archive rule from detail page (with confirmation modal)
- [ ] Cancel archive confirmation (verify no changes made)
- [ ] Use archive filter dropdown to show only archived rules
- [ ] Use archive filter dropdown to show all rules (active + archived)
- [ ] Restore archived rule from detail page
- [ ] Archived badge displayed correctly in list views
- [ ] Inactive badge displayed correctly for isActive: false rules
- [ ] Archived rules hidden by default in list view
- [ ] Archived rules accessible via direct URL to detail page
- [ ] Archive confirmation modal displays with correct messaging
- [ ] Clear archive filter resets to default state

**State Management:**
- [ ] Restored rule shows original isActive state (active or inactive)
- [ ] isActive toggle disabled when rule is archived
- [ ] Both badges shown correctly when rule is archived AND inactive

**Permission-Based UI:**
- [ ] Users with stock:transfer can archive and restore rules
- [ ] Users without stock:transfer (VIEWER) cannot see archive/restore buttons
- [ ] Archive button shown for all non-archived rules (active or inactive)
- [ ] Restore button only shown for archived rules

---

## Success Metrics

- [x] Approval rules can be archived without errors
- [x] Backend tests all passing (14 approval rule archival service tests)
- [x] Archived rules completely hidden from active views (vs inactive which shows)
- [x] Three-way archive filter working (active-only, archived-only, all)
- [x] Restore functionality working with audit trail
- [x] Restored rules preserve original isActive state
- [x] All existing tests continue to pass (backward compatible)
- [x] UI shows archive filter dropdown in FilterBar
- [x] Archive confirmation modal with user-friendly messaging
- [x] Archived rules excluded from approval evaluation (workflow not affected)
- [x] Archive/restore buttons only visible to users with stock:write permission
- [x] E2E tests written and passing (19 comprehensive Playwright tests)
- [x] Factory methods handle idempotent archive/restore operations
- [ ] User documentation updated with archive workflows and state clarification

---

## Notes & Decisions

**Key Design Decisions:**
- **Enhancement of isActive** - Archive is a stronger version of "inactive", completely hiding from UI
- **State preservation** - Restored rules retain their original isActive state (active or inactive)
- **Archive terminology** - Using "Archive" in UI instead of "Delete" to clarify it's reversible
- **Three-way filter** - Dropdown with 3 options (active-only, archived-only, all) for better control
- **Archive from detail page** - Archive action on detail page with confirmation modal (consistent with product archival)
- **No delete from table** - Removed delete/trash icon from table rows, forcing users to view rule details before archiving (intentional friction)
- **View-only table action** - Changed edit/pencil icon to view/eye icon in table (consistent with products table pattern)
- **Confirmation modal** - User-friendly explanation: "This approval rule will be completely hidden from the UI and will not be evaluated in the approval workflow. All historical data will be preserved and the rule can be restored at any time."
- **Permission level** - Reusing existing `stock:write` permission (same as product archival)
- **Optional tracking fields** - Including archivedAt and archivedByUserId for audit trail
- **Archived rule access** - Allow detail page access for restoration
- **Rule evaluation** - Archived rules completely excluded from approval workflow (isArchived: false AND isActive: true)
- **Read-only archived rules** - Form fields disabled when rule is archived (prevents accidental edits)

**State Combinations:**
| isActive | isArchived | Behavior |
|----------|-----------|----------|
| true | false | Active rule (evaluated in workflow) |
| false | false | Inactive rule (visible in UI, not evaluated) |
| true | true | Archived active rule (hidden, restorable to active) |
| false | true | Archived inactive rule (hidden, restorable to inactive) |

**Related Constraints:**
- TransferApprovalCondition uses `onDelete: Cascade` (conditions deleted with rule - but we archive instead)
- TransferApprovalLevel uses `onDelete: Cascade` (levels deleted with rule - but we archive instead)
- No direct foreign key constraints from TransferApprovalRecord to rules (historical approval records preserved)

**Known Limitations:**
- Archived rules remain in database permanently (not a true delete)
- Rule name not unique (multiple rules can have same name, even if one archived)
- Historical approval records don't reference rules directly (no broken references from archival)
- Both isActive and isArchived need to be checked for proper filtering

**Future Enhancements (Out of Scope):**
- Bulk archive/restore operations
- Scheduled permanent deletion of archived rules (after X days)
- Archive reasons/notes field (e.g., "Threshold outdated", "Workflow restructured")
- Archive history timeline (show who archived/restored and when)
- Rule usage statistics (show how many transfers matched rule before archival)
- Smart suggestions: "This rule hasn't matched any transfers in 6 months. Archive it?"
- Cascade archival warning: "This rule has 3 approval levels and 5 conditions"
- Auto-disable before archive workflow (isActive: false → wait 30 days → archive)

---

## Implementation Notes

### Backend Implementation (Completed 2025-10-18)

**Database Migration:** `20251018220811_add_approval_rule_archival`
- Added `isArchived`, `archivedAt`, `archivedByUserId` fields to `TransferApprovalRule`
- Added composite index `[tenantId, isArchived]` for efficient filtering
- Migration applied successfully to production database

**Service Layer Updates:**
- File: `api-server/src/services/stockTransfers/approvalRulesService.ts`
  - Modified `listApprovalRules()` to support `archivedFilter` parameter (active-only, archived-only, all)
  - Converted `deleteApprovalRule()` from hard delete to soft delete (sets isArchived: true)
  - Added `restoreApprovalRule()` function to unarchive rules
  - Both functions preserve `isActive` state for proper restoration
- File: `api-server/src/services/stockTransfers/approvalEvaluationService.ts`
  - Updated rule evaluation to exclude archived rules (`isArchived: false AND isActive: true`)

**API Layer Updates:**
- File: `api-server/src/openapi/paths/transferApprovalRules.ts`
  - Added `isArchived`, `archivedAt`, `archivedByUserId` to response schema
  - Added `archivedFilter` enum query parameter to GET endpoint
  - Updated DELETE endpoint to return full archived rule
  - Added POST `/transfer-approval-rules/:ruleId/restore` endpoint
- File: `api-server/src/routes/transferApprovalRulesRouter.ts`
  - Updated GET route to accept `archivedFilter` query parameter
  - Modified DELETE route to call archive function
  - Added POST restore route (requires `stock:write` permission)

**Test Coverage:**
- File: `api-server/__tests__/services/approvalRuleArchival.test.ts`
- **14 comprehensive tests, all passing:**
  - Archive operations (3 tests)
  - Restore operations (3 tests)
  - List filtering with all modes (4 tests)
  - Get archived rule by ID (1 test)
  - Rule evaluation exclusion (1 test)
  - Multi-tenant isolation (2 tests)

**Key Implementation Details:**
- Permission requirement: `stock:write` (reused existing permission)
- Audit trail: Archive and restore operations logged to `AuditEvent` table
- State preservation: `isActive` field value maintained through archive/restore cycle
- Default behavior: List endpoints filter to non-archived rules by default
- Multi-tenant security: All operations validated against `tenantId`

**Next Steps:**
- ✅ Frontend implementation completed
- ✅ OpenAPI type regeneration completed
- ✅ E2E tests written and passing

### Frontend Implementation (Completed 2025-10-18)

**API Client Updates:**
- File: `admin-web/src/api/transferApprovalRules.ts`
  - Added `archivedFilter` parameter to `listApprovalRulesApiRequest()` (active-only, archived-only, all)
  - Added `restoreApprovalRuleApiRequest()` function
  - Updated comments to clarify soft delete behavior

**Factory Updates:**
- File: `admin-web/e2e/helpers/factories.ts`
  - Added `archive()` method to ApprovalRuleFactory
  - Added `restore()` method to ApprovalRuleFactory
  - Added `getAll()` method with archivedFilter support
  - Made operations idempotent (gracefully handle already-archived/already-restored states)
  - Made `delete()` an alias for `archive()` for backward compatibility

**Selector Constants:**
- File: `admin-web/e2e/helpers/selectors.ts`
  - Added `APPROVAL_RULE` selector group with data-testid constants
  - Includes: ARCHIVE_BUTTON, RESTORE_BUTTON, ARCHIVED_BADGE, INACTIVE_BADGE, ARCHIVED_FILTER_SELECT

**UI Component Updates:**
- File: `admin-web/src/pages/TransferApprovalRulesPage.tsx`
  - Added archive filter Select dropdown with 3 options (active-only, archived-only, all)
  - Added "Archived" badge (gray) for archived rules
  - Added "Inactive" badge (yellow) for inactive but non-archived rules
  - Updated row actions to show archive icon (IconArchive) for active rules
  - Updated row actions to show restore icon (IconArchiveOff) for archived rules
  - Disabled isActive toggle for archived rules
  - Hide edit button for archived rules
  - Archive filter synced with URL query params
  - Added archive confirmation modal with user-friendly explanation
  - Added restore confirmation modal explaining state preservation
  - Updated notification messages to say "archived" instead of "deleted"

**Test Coverage:**
- File: `admin-web/e2e/transfers/approval-rule-archival.spec.ts`
- **19 comprehensive E2E tests, all passing:**
  - Archive Flow (2 tests): Archive with confirmation, cancel confirmation
  - Restore Flow (2 tests): Restore inactive rule, restore active rule
  - Filter Functionality (5 tests): Default active-only, archived-only, all, clear filter, badge visibility
  - Permissions (3 tests): Viewer restrictions, admin permissions, button visibility
  - UI State (2 tests): Disabled toggle, dual badge display

**Key Implementation Details:**
- Permission requirement: `stock:write` (consistent with product archival)
- Archive filter default: "active-only" (archived rules hidden by default)
- State preservation: Restored rules retain original `isActive` value
- Badge logic: Show "Archived" if archived; show "Inactive" if inactive AND not archived
- Idempotent operations: Factory methods handle duplicate archive/restore gracefully
- URL sync: Archive filter parameter persisted in query string

---

**Template Version:** 1.0
**Created:** 2025-10-17
**Backend Completed:** 2025-10-18
**Frontend Completed:** 2025-10-18
**Full Implementation Complete:** 2025-10-18
