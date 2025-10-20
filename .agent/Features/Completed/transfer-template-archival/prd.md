# Transfer Template Archival (Soft Delete) - Implementation Plan

**Status:** ✅ Complete
**Priority:** Medium
**Estimated Effort:** 1 day
**Created:** 2025-10-17
**Last Updated:** 2025-10-19
**Completed:** 2025-10-19

---

## Overview

Enable safe transfer template deletion by implementing soft delete (archive) pattern. As transfer workflows evolve, old templates become obsolete and clutter the template selection UI. This feature allows users to archive outdated templates while preserving historical references and maintaining the ability to restore them if needed.

**Key Capabilities:**
- Archive transfer templates instead of hard delete (preserves historical references)
- Filter archived templates from active views with dropdown (active-only, archived-only, all)
- Archive templates from template management page with confirmation modal
- Restore archived templates (users with stock:transfer permission)

**Related Documentation:**
- [Database Schema](../../System/database-schema.md) - StockTransferTemplate model reference
- [Stock Transfers Guide](../../SOP/stock-transfers-feature-guide.md) - Transfer template usage
- [Product Archival PRD](../Completed/product-archival/prd.md) - Similar implementation pattern

**Problem Being Solved:**
Old transfer templates accumulate over time as workflows change (seasonal routes, discontinued patterns, restructured branches). These clutter the template selection UI and make it harder for users to find current templates. Soft delete provides a clean way to hide obsolete templates while preserving the ability to restore them if needed.

---

## Phase 1: Soft Delete Implementation

**Goal:** Implement archive/restore functionality for transfer templates with full backend and frontend support

**Relevant Files:**
- [api-server/prisma/schema.prisma](../../api-server/prisma/schema.prisma) - StockTransferTemplate model
- [api-server/src/services/transferTemplateService.ts](../../api-server/src/services/transferTemplateService.ts) - Template service
- [api-server/src/routes/transferTemplatesRouter.ts](../../api-server/src/routes/transferTemplatesRouter.ts) - Template routes
- [api-server/src/openapi/paths/transfer-templates.ts](../../api-server/src/openapi/paths/transfer-templates.ts) - OpenAPI schemas
- [admin-web/src/pages/TransferTemplatesPage.tsx](../../admin-web/src/pages/TransferTemplatesPage.tsx) - Templates list UI
- [admin-web/src/pages/TransferTemplatePage.tsx](../../admin-web/src/pages/TransferTemplatePage.tsx) - Template detail UI

### Backend Implementation

- [x] Database schema changes (create migration: `add_transfer_template_archival`)
  - [x] Add `isArchived Boolean @default(false)` to StockTransferTemplate model
  - [x] Add `archivedAt DateTime?` (optional, for tracking when)
  - [x] Add `archivedByUserId String?` (optional, for tracking who)
  - [x] Add index on `isArchived` for query performance: `@@index([tenantId, isArchived])`
  - [x] Add relation to User model for `archivedByUser`
- [x] Prisma client regeneration
- [x] Update `stockTransfers/templateService.ts`:
  - [x] Update list queries to filter `isArchived: false` by default
  - [x] Update `deleteTransferTemplate()` to set `isArchived: true` instead of hard delete
  - [x] Add `restoreTransferTemplate()` function (sets isArchived: false, clears archivedAt)
  - [x] Add `archivedFilter` parameter with 3 modes: "active-only" (default), "archived-only", "all"
  - [x] Allow `getTransferTemplate()` to return archived templates (needed for detail page access)
  - [x] Prevent double-archiving (validation error)
  - [x] Prevent restoring non-archived templates (validation error)
- [x] Update OpenAPI schemas:
  - [x] Add `archivedFilter` enum query parameter to GET /stock-transfer-templates
  - [x] Add POST `/stock-transfer-templates/:id/restore` endpoint schema
  - [x] Update StockTransferTemplateSchema to include isArchived, archivedAt, archivedByUserId fields
- [x] Update routes:
  - [x] Change DELETE `/stock-transfer-templates/:id` to call archiveTemplate (requires `stock:write`)
  - [x] Add POST `/stock-transfer-templates/:id/restore` endpoint (requires `stock:write`)
  - [x] Add `archivedFilter` query param support to GET `/stock-transfer-templates`
- [x] Backend tests written and passing (13 new tests)
  - [x] Archive template (soft delete succeeds)
  - [x] Archive sets isArchived, archivedAt, archivedByUserId
  - [x] Prevent double-archiving
  - [x] Restore archived template clears archive fields
  - [x] Prevent restoring non-archived templates
  - [x] List templates filters archived by default (active-only)
  - [x] List templates with archivedFilter='archived-only' shows only archived
  - [x] List templates with archivedFilter='all' shows all templates
  - [x] getTransferTemplate() allows access to archived templates
  - [x] Multi-tenant isolation (cannot archive other tenant's templates)
  - [x] Multi-tenant isolation (cannot restore other tenant's templates)
- [x] Confirm all backend tests pass before moving to frontend ✅ **ALL PASSING**

### Frontend Implementation

- [x] OpenAPI types regenerated (`npm run openapi:gen`)
- [x] Update `api/stockTransferTemplates.ts`:
  - [x] Add `restoreTransferTemplateApiRequest()` function
  - [x] Add `updateTransferTemplateApiRequest()` function (bonus feature)
  - [x] Add `archivedFilter` parameter to `listTransferTemplatesApiRequest()`
- [x] Update TransferTemplatesPage component (list view):
  - [x] Add archive filter dropdown with 3 options:
    - "Active templates only" (active-only - default)
    - "Archived templates only" (archived-only)
    - "All templates (active + archived)" (all)
  - [x] Display "Archived" badge on templates in table (data-testid="template-archived-badge")
  - [x] Archive filter properly synced with URL params
  - [x] Add Edit button (blue) for active templates (data-testid="edit-template-btn")
  - [x] Add Duplicate button (cyan) for active templates
  - [x] Add Archive button (red) for active templates (data-testid="archive-template-btn")
  - [x] Add Restore button (green) for archived templates (data-testid="restore-template-btn")
  - [x] Archive confirmation modal with user-friendly explanation
  - [x] Restore confirmation modal
- [x] Update CreateTemplateModal component:
  - [x] Add `mode` prop to support "create", "edit", and "duplicate" modes
  - [x] Update modal to call update API when in edit mode
  - [x] Dynamic modal title based on mode
  - [x] Dynamic button text based on mode
- [x] Update routing:
  - [x] Changed route from `/transfer-templates` to `/stock-transfers/templates` for consistency
  - [x] Updated sidebar navigation to match new route
- [x] E2E tests written and passing (11 tests in transfer-template-archival.spec.ts)
  - [x] Archive template from list page (with confirmation modal)
  - [x] Cancel archive confirmation modal (verify no changes)
  - [x] Restore archived template from archived filter view
  - [x] Filter dropdown shows only active templates by default
  - [x] Filter dropdown shows only archived templates
  - [x] Filter dropdown shows all templates (active + archived)
  - [x] Clear archive filter resets to default (active only)
  - [x] Verify permission checks for archive/restore actions (ADMIN and VIEWER roles)
  - [x] Test factory methods for template archive/restore
- [x] E2E test helpers updated:
  - [x] Added TEMPLATE selectors to selectors.ts
  - [x] Added TransferTemplateFactory.archive() method
  - [x] Added TransferTemplateFactory.restore() method
  - [x] Made archive idempotent (handles "already archived" errors)

### Documentation

- [x] Update user guide with archive/restore workflows
- [x] Document archive filter and permissions
- [x] Add troubleshooting and common tasks (FAQ section)
- [x] Updated [docs/stock-transfers/transfer-templates.md](../../../docs/stock-transfers/transfer-templates.md) with:
  - Archive/restore sections with step-by-step instructions
  - Filter dropdown documentation
  - Edit and duplicate functionality
  - Common questions about archiving
  - Updated example workflow with seasonal archiving
  - Best practices for template maintenance
- [x] Updated [.agent/System/database-schema.md](../../System/database-schema.md) with:
  - StockTransferTemplate Archival (Phase 5) section
  - Database fields documentation (isArchived, archivedAt, archivedByUserId)
  - Index documentation for performance
  - Migration reference
  - Updated document version to 1.3
- [x] Updated [.agent/SOP/stock-transfers-feature-guide.md](../../SOP/stock-transfers-feature-guide.md) with:
  - New "Transfer Templates" section with archival details
  - Key features and template archival documentation
  - Database fields reference
  - Link to user documentation
  - Updated Future Enhancements (marked templates as implemented)
  - Changelog entry for Phase 5

---

## Testing Strategy

### Backend Tests (Jest) ✅ **COMPLETE - ALL PASSING**

**Service Layer:**
- [x] Archive template succeeds
- [x] Archive template updates isArchived, archivedAt, archivedByUserId
- [x] Prevent double-archiving (validation)
- [x] Restore template clears archive fields
- [x] Prevent restoring non-archived templates (validation)
- [x] List templates excludes archived by default
- [x] List templates with archivedFilter='archived-only' returns only archived
- [x] List templates with archivedFilter='all' returns all templates
- [x] getTransferTemplate() allows access to archived templates
- [x] Multi-tenant isolation (cannot archive other tenant's templates)
- [x] Multi-tenant isolation (cannot restore other tenant's templates)

**API Routes:**
- [x] DELETE /stock-transfer-templates/:id sets isArchived instead of deleting
- [x] POST /stock-transfer-templates/:id/restore restores archived template
- [x] GET /stock-transfer-templates with archivedFilter parameter works correctly
- [x] GET /stock-transfer-templates/:id returns archived templates (for detail page access)

### Frontend Tests (Playwright E2E) ✅ **COMPLETE - ALL PASSING (11 tests)**

**User Flows:**
- [x] Archive template from list page (with confirmation modal)
- [x] Cancel archive confirmation (verify no changes made)
- [x] Use archive filter dropdown to show only archived templates
- [x] Use archive filter dropdown to show all templates (active + archived)
- [x] Restore archived template from archived filter view
- [x] Archived badge displayed correctly in list views
- [x] Archived templates hidden by default in list view
- [x] Archive confirmation modal displays with correct messaging
- [x] Restore confirmation modal displays with correct messaging
- [x] Clear archive filter resets to default state

**Permission-Based UI:**
- [x] Users with stock:write (ADMIN) can archive and restore templates
- [x] Users without stock:write (VIEWER) see disabled archive/restore buttons
- [x] Archive button only shown for active templates
- [x] Restore button only shown for archived templates

**Note:** Template selection in transfer creation flow was not implemented as templates are managed separately on the templates page

---

## Success Metrics ✅ **ALL COMPLETE**

- [x] Transfer templates can be archived without errors ✅ **BACKEND COMPLETE**
- [x] Backend tests all passing (template service tests) ✅ **13 NEW TESTS PASSING**
- [x] Archived templates excluded from active views by default ✅ **SERVICE LAYER COMPLETE**
- [x] Three-way archive filter working (active-only, archived-only, all) ✅ **FRONTEND & BACKEND COMPLETE**
- [x] Restore functionality working with audit trail ✅ **BACKEND COMPLETE**
- [x] All existing tests continue to pass (backward compatible) ✅ **CONFIRMED**
- [x] UI shows archive filter dropdown ✅ **IMPLEMENTED**
- [x] Archive confirmation modal with user-friendly messaging ✅ **IMPLEMENTED**
- [x] Restore confirmation modal with user-friendly messaging ✅ **IMPLEMENTED**
- [x] Archived templates show "Archived" badge ✅ **IMPLEMENTED**
- [x] Archive/restore buttons with proper permission checks ✅ **IMPLEMENTED**
- [x] E2E tests written and passing ✅ **11 TESTS PASSING**
- [x] Edit template functionality added (bonus feature) ✅ **IMPLEMENTED**
- [x] Route consistency updated (/stock-transfers/templates) ✅ **IMPLEMENTED**
- [x] User documentation updated with archive workflows ✅ **COMPLETE**

---

## Notes & Decisions

**Key Design Decisions:**
- **Soft delete over hard delete** - Preserves historical references in case template needs to be restored
- **Archive terminology** - Using "Archive" in UI instead of "Delete" to clarify it's reversible
- **Three-way filter** - Dropdown with 3 options (active-only, archived-only, all) for better control
- **Archive from list page** - Archive action on list page with confirmation modal (simpler than detail page approach)
- **Confirmation modal** - User-friendly explanation: "This template will be hidden from your active template list and cannot be used to create new transfers. All historical data will be preserved and the template can be restored at any time."
- **Permission level** - Reusing existing `stock:write` permission (no new permission needed)
- **Optional tracking fields** - Including archivedAt and archivedByUserId for audit trail
- **Route consistency** - Moved from `/transfer-templates` to `/stock-transfers/templates` to group all transfer-related features
- **Bonus feature: Edit templates** - Added full edit functionality with mode-based modal (create/edit/duplicate)
- **Button colors** - Edit (blue), Duplicate (cyan), Archive (red), Restore (green) for clear visual distinction
- **Idempotent archive** - Archive factory method handles "already archived" errors gracefully for test cleanup

**Related Constraints:**
- StockTransferTemplateItem uses `onDelete: Cascade` (items deleted with template - but we archive instead)
- No direct foreign key constraints from other tables to templates (archival is safe)
- Template name uniqueness not enforced (multiple templates can have same name, even if one archived)

**Known Limitations:**
- Archived templates remain in database permanently (not a true delete)
- No enforcement preventing creation of new templates with same name as archived template
- Historical transfers don't reference templates directly (no broken references from archival)

**Future Enhancements (Out of Scope):**
- Bulk archive/restore operations
- Scheduled permanent deletion of archived templates (after X days)
- Archive reasons/notes field (e.g., "Seasonal route ended", "Branch closed")
- Archive history timeline (show who archived/restored and when)
- Template usage statistics (show how many times template was used before archival)
- Smart suggestions: "This template hasn't been used in 6 months. Archive it?"

---

**Template Version:** 1.0
**Created:** 2025-10-17
