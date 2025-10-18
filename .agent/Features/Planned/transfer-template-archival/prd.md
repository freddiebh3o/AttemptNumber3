# Transfer Template Archival (Soft Delete) - Implementation Plan

**Status:** 📋 Planning
**Priority:** Medium
**Estimated Effort:** 1 day
**Created:** 2025-10-17
**Last Updated:** 2025-10-17

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

- [ ] Database schema changes (create migration: `add_transfer_template_archival`)
  - [ ] Add `isArchived Boolean @default(false)` to StockTransferTemplate model
  - [ ] Add `archivedAt DateTime?` (optional, for tracking when)
  - [ ] Add `archivedByUserId String?` (optional, for tracking who)
  - [ ] Add index on `isArchived` for query performance: `@@index([tenantId, isArchived])`
- [ ] Prisma client regeneration
- [ ] Update `transferTemplateService.ts`:
  - [ ] Update list queries to filter `isArchived: false` by default
  - [ ] Update `deleteTemplate()` to set `isArchived: true` instead of hard delete
  - [ ] Add `restoreTemplate()` function (sets isArchived: false, clears archivedAt)
  - [ ] Add `archivedFilter` parameter with 3 modes: "active-only" (default), "archived-only", "all"
  - [ ] Allow `getTemplate()` to return archived templates (needed for detail page access)
  - [ ] Template selection for new transfers excludes archived templates
- [ ] Update OpenAPI schemas:
  - [ ] Add `archivedFilter` enum query parameter to GET /transfer-templates
  - [ ] Add POST `/transfer-templates/:id/restore` endpoint schema
  - [ ] Update StockTransferTemplate response schema to include isArchived fields
- [ ] Update routes:
  - [ ] Change DELETE `/transfer-templates/:id` to call archiveTemplate (requires `stock:transfer`)
  - [ ] Add POST `/transfer-templates/:id/restore` endpoint (requires `stock:transfer`)
  - [ ] Add `archivedFilter` query param support to GET `/transfer-templates`
- [ ] Backend tests written and passing
  - [ ] Archive template (should succeed)
  - [ ] Restore archived template
  - [ ] List templates filters archived by default
  - [ ] List templates with archivedFilter='archived-only' shows only archived
  - [ ] List templates with archivedFilter='all' shows all templates
  - [ ] getTemplate() allows access to archived templates
  - [ ] Template selection excludes archived templates
  - [ ] Permission checks (multi-tenant isolation)
  - [ ] Audit trail preservation (UPDATE events for restore)
- [ ] Confirm all backend tests pass before moving to frontend

### Frontend Implementation

- [ ] OpenAPI types regenerated (`npm run openapi:gen`)
- [ ] Update `api/transferTemplates.ts`:
  - [ ] Add `restoreTemplate()` function
  - [ ] Add `archivedFilter` parameter to `listTransferTemplates()`
- [ ] Update TransferTemplatesPage component (list view):
  - [ ] Add archive filter dropdown in FilterBar with 3 options:
    - "Active templates only" (active-only - default)
    - "Archived templates only" (archived-only)
    - "All templates (active + archived)" (all)
  - [ ] Display "Archived" badge on templates in table (data-testid="archived-badge")
  - [ ] Archive filter properly synced with URL params
- [ ] Update TransferTemplatePage component (detail/edit page) with **data-testid attributes**:
  - [ ] Track isArchived state when loading template
  - [ ] Show "Archived" badge in header if template is archived (data-testid="archived-badge")
  - [ ] Add "Archive Template" button in header (data-testid="archive-template-btn")
    - Only visible for active templates with stock:transfer permission
    - Red color, light variant with archive icon
    - Opens confirmation modal before archiving
  - [ ] Add archive confirmation modal with user-friendly explanation
  - [ ] Add "Restore" button for archived templates (data-testid="restore-btn")
  - [ ] Hide Save button when template is archived
  - [ ] Disable "Use Template" action for archived templates
- [ ] Update transfer creation flow:
  - [ ] Template selection dropdown excludes archived templates
  - [ ] No archived templates shown in "Use Template" picker
- [ ] E2E tests written and passing
  - [ ] Archive template from detail page (with confirmation modal)
  - [ ] Cancel archive confirmation modal (verify no changes)
  - [ ] Restore archived template from detail page
  - [ ] Filter dropdown shows only archived templates
  - [ ] Filter dropdown shows all templates (active + archived)
  - [ ] Verify archived templates accessible via direct URL
  - [ ] Verify permission checks for archive/restore actions (VIEWER role)
  - [ ] Verify archived templates not shown in template picker
  - [ ] Clear archive filter resets to default (active only)

### Documentation

- [ ] Update user guide with archive/restore workflows
- [ ] Document archive filter and permissions
- [ ] Add troubleshooting and common tasks
- [ ] Update [Database Schema](../../System/database-schema.md) with isArchived field (optional)
- [ ] Update [Stock Transfers Guide](../../SOP/stock-transfers-feature-guide.md) with template archival

---

## Testing Strategy

### Backend Tests (Jest)

**Service Layer:**
- [ ] Archive template succeeds
- [ ] Archive template updates isArchived, archivedAt, archivedByUserId
- [ ] Restore template clears archive fields
- [ ] List templates excludes archived by default
- [ ] List templates with archivedFilter='archived-only' returns only archived
- [ ] List templates with archivedFilter='all' returns all templates
- [ ] getTemplate() allows access to archived templates
- [ ] Template selection for new transfers excludes archived
- [ ] Multi-tenant isolation (cannot archive other tenant's templates)
- [ ] Audit trail preservation (UPDATE events for restore)

**API Routes:**
- [ ] DELETE /transfer-templates/:id sets isArchived instead of deleting
- [ ] POST /transfer-templates/:id/restore restores archived template
- [ ] GET /transfer-templates with archivedFilter parameter works correctly
- [ ] GET /transfer-templates/:id returns archived templates (for detail page access)

### Frontend Tests (Playwright E2E)

**User Flows:**
- [ ] Archive template from detail page (with confirmation modal)
- [ ] Cancel archive confirmation (verify no changes made)
- [ ] Use archive filter dropdown to show only archived templates
- [ ] Use archive filter dropdown to show all templates (active + archived)
- [ ] Restore archived template from detail page
- [ ] Archived badge displayed correctly in list views
- [ ] Archived templates hidden by default in list view
- [ ] Archived templates accessible via direct URL to detail page
- [ ] Archive confirmation modal displays with correct messaging
- [ ] Clear archive filter resets to default state

**Template Selection:**
- [ ] Archived templates not shown in template picker during transfer creation
- [ ] Active templates shown in template picker
- [ ] "Use Template" button hidden for archived templates

**Permission-Based UI:**
- [ ] Users with stock:transfer can archive and restore templates
- [ ] Users without stock:transfer (VIEWER) cannot see archive/restore buttons
- [ ] Archive button only shown for active templates
- [ ] Restore button only shown for archived templates

---

## Success Metrics

- [ ] Transfer templates can be archived without errors
- [ ] Backend tests all passing (template service tests)
- [ ] Archived templates excluded from active views by default
- [ ] Three-way archive filter working (active-only, archived-only, all)
- [ ] Restore functionality working with audit trail
- [ ] All existing tests continue to pass (backward compatible)
- [ ] UI shows archive filter dropdown in FilterBar
- [ ] Archive confirmation modal with user-friendly messaging
- [ ] Archived templates excluded from template picker (UX improvement)
- [ ] Archived templates accessible on detail pages for restore
- [ ] Archive/restore buttons only visible to users with stock:transfer
- [ ] E2E tests written and passing (comprehensive Playwright tests)
- [ ] User documentation updated with archive workflows

---

## Notes & Decisions

**Key Design Decisions:**
- **Soft delete over hard delete** - Preserves historical references in case template needs to be restored
- **Archive terminology** - Using "Archive" in UI instead of "Delete" to clarify it's reversible
- **Three-way filter** - Dropdown with 3 options (active-only, archived-only, all) for better control
- **Archive from detail page** - Archive action on detail page with confirmation modal (consistent with other archival features)
- **Confirmation modal** - User-friendly explanation: "This template will be hidden from your active template list and cannot be used to create new transfers. All historical data will be preserved and the template can be restored at any time."
- **Permission level** - Reusing existing `stock:transfer` permission (no new permission needed)
- **Optional tracking fields** - Including archivedAt and archivedByUserId for audit trail
- **Archived template access** - Allow detail page access for restoration
- **Template picker exclusion** - Archived templates excluded from "Use Template" dropdown (key UX improvement)

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
