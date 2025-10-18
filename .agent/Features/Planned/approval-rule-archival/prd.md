# Approval Rule Archival (Soft Delete Enhancement) - Implementation Plan

**Status:** 📋 Planning
**Priority:** Low
**Estimated Effort:** 0.5-1 day
**Created:** 2025-10-17
**Last Updated:** 2025-10-17

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

- [ ] Database schema changes (create migration: `add_approval_rule_archival`)
  - [ ] Add `isArchived Boolean @default(false)` to TransferApprovalRule model
  - [ ] Add `archivedAt DateTime?` (optional, for tracking when)
  - [ ] Add `archivedByUserId String?` (optional, for tracking who)
  - [ ] Add index on `isArchived` for query performance: `@@index([tenantId, isArchived])`
  - [ ] Keep existing `isActive` field (both fields coexist)
- [ ] Prisma client regeneration
- [ ] Update `approvalRuleService.ts`:
  - [ ] Update list queries to filter `isArchived: false` by default
  - [ ] Update `deleteRule()` to set `isArchived: true` instead of hard delete
  - [ ] Add `restoreRule()` function (sets isArchived: false, clears archivedAt)
  - [ ] Add `archivedFilter` parameter with 3 modes: "active-only" (default), "archived-only", "all"
  - [ ] Allow `getRule()` to return archived rules (needed for detail page access)
  - [ ] Rule evaluation excludes archived rules (isArchived: false AND isActive: true)
  - [ ] Preserve isActive state when archiving (restored rules retain original active/inactive state)
- [ ] Update OpenAPI schemas:
  - [ ] Add `archivedFilter` enum query parameter to GET /approval-rules
  - [ ] Add POST `/approval-rules/:id/restore` endpoint schema
  - [ ] Update TransferApprovalRule response schema to include isArchived fields
- [ ] Update routes:
  - [ ] Change DELETE `/approval-rules/:id` to call archiveRule (requires `stock:transfer`)
  - [ ] Add POST `/approval-rules/:id/restore` endpoint (requires `stock:transfer`)
  - [ ] Add `archivedFilter` query param support to GET `/approval-rules`
- [ ] Backend tests written and passing
  - [ ] Archive rule (should succeed)
  - [ ] Restore archived rule preserves original isActive state
  - [ ] List rules filters archived by default
  - [ ] List rules with archivedFilter='archived-only' shows only archived
  - [ ] List rules with archivedFilter='all' shows all rules
  - [ ] getRule() allows access to archived rules
  - [ ] Rule evaluation excludes archived rules
  - [ ] Permission checks (multi-tenant isolation)
  - [ ] Audit trail preservation (UPDATE events for restore)
- [ ] Confirm all backend tests pass before moving to frontend

### Frontend Implementation

- [ ] OpenAPI types regenerated (`npm run openapi:gen`)
- [ ] Update `api/approvalRules.ts`:
  - [ ] Add `restoreRule()` function
  - [ ] Add `archivedFilter` parameter to `listApprovalRules()`
- [ ] Update ApprovalRulesPage component (list view):
  - [ ] Add archive filter dropdown in FilterBar with 3 options:
    - "Active rules only" (active-only - default)
    - "Archived rules only" (archived-only)
    - "All rules (active + archived)" (all)
  - [ ] Display "Archived" badge on rules in table (data-testid="archived-badge")
  - [ ] Display "Inactive" badge on rules where isActive: false (data-testid="inactive-badge")
  - [ ] Archive filter properly synced with URL params
- [ ] Update ApprovalRulePage component (detail/edit page) with **data-testid attributes**:
  - [ ] Track isArchived and isActive state when loading rule
  - [ ] Show "Archived" badge in header if rule is archived (data-testid="archived-badge")
  - [ ] Show "Inactive" badge if rule is inactive (data-testid="inactive-badge")
  - [ ] Add "Archive Rule" button in header (data-testid="archive-rule-btn")
    - Only visible for non-archived rules with stock:transfer permission
    - Red color, light variant with archive icon
    - Opens confirmation modal before archiving
  - [ ] Add archive confirmation modal with user-friendly explanation
  - [ ] Add "Restore" button for archived rules (data-testid="restore-btn")
  - [ ] Hide Save button when rule is archived
  - [ ] Disable isActive toggle when rule is archived
- [ ] E2E tests written and passing
  - [ ] Archive rule from detail page (with confirmation modal)
  - [ ] Cancel archive confirmation modal (verify no changes)
  - [ ] Restore archived rule from detail page
  - [ ] Restored rule retains original isActive state
  - [ ] Filter dropdown shows only archived rules
  - [ ] Filter dropdown shows all rules (active + archived)
  - [ ] Verify archived rules accessible via direct URL
  - [ ] Verify permission checks for archive/restore actions (VIEWER role)
  - [ ] Verify archived rules not evaluated in approval workflow
  - [ ] Clear archive filter resets to default (active only)

### Documentation

- [ ] Update user guide with archive/restore workflows
- [ ] Document archive vs inactive states (isArchived vs isActive)
- [ ] Document archive filter and permissions
- [ ] Add troubleshooting and common tasks
- [ ] Update [Database Schema](../../System/database-schema.md) with isArchived field (optional)
- [ ] Update [Stock Transfers Guide](../../SOP/stock-transfers-feature-guide.md) with rule archival

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

- [ ] Approval rules can be archived without errors
- [ ] Backend tests all passing (approval rule service tests)
- [ ] Archived rules completely hidden from active views (vs inactive which shows)
- [ ] Three-way archive filter working (active-only, archived-only, all)
- [ ] Restore functionality working with audit trail
- [ ] Restored rules preserve original isActive state
- [ ] All existing tests continue to pass (backward compatible)
- [ ] UI shows archive filter dropdown in FilterBar
- [ ] Archive confirmation modal with user-friendly messaging
- [ ] Archived rules excluded from approval evaluation (workflow not affected)
- [ ] Archived rules accessible on detail pages for restore
- [ ] Archive/restore buttons only visible to users with stock:transfer
- [ ] E2E tests written and passing (comprehensive Playwright tests)
- [ ] User documentation updated with archive workflows and state clarification

---

## Notes & Decisions

**Key Design Decisions:**
- **Enhancement of isActive** - Archive is a stronger version of "inactive", completely hiding from UI
- **State preservation** - Restored rules retain their original isActive state (active or inactive)
- **Archive terminology** - Using "Archive" in UI instead of "Delete" to clarify it's reversible
- **Three-way filter** - Dropdown with 3 options (active-only, archived-only, all) for better control
- **Archive from detail page** - Archive action on detail page with confirmation modal (consistent with other archival features)
- **Confirmation modal** - User-friendly explanation: "This approval rule will be completely hidden from the UI and will not be evaluated in the approval workflow. All historical data will be preserved and the rule can be restored at any time."
- **Permission level** - Reusing existing `stock:transfer` permission (no new permission needed)
- **Optional tracking fields** - Including archivedAt and archivedByUserId for audit trail
- **Archived rule access** - Allow detail page access for restoration
- **Rule evaluation** - Archived rules completely excluded from approval workflow (isArchived: false AND isActive: true)

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

**Template Version:** 1.0
**Created:** 2025-10-17
