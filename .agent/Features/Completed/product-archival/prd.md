# Product Archival (Soft Delete) - Implementation Plan

**Status:** ✅ Complete (Backend, Frontend, and E2E Tests All Passing)
**Priority:** Low
**Estimated Effort:** 1 day (6-8 hours)
**Created:** 2025-10-15
**Last Updated:** 2025-10-17
**Completed:** 2025-10-17

---

## Overview

Enable safe product deletion by implementing soft delete (archive) pattern. Currently, products cannot be deleted when they have related records (ProductStock, StockLot, StockLedger, or StockTransferItem) due to foreign key constraints. This causes E2E test cleanup failures and prevents users from removing obsolete products.

**Key Capabilities:**
- Archive products instead of hard delete (preserves audit trail)
- Filter archived products from active views with dropdown (no-archived, only-archived, both)
- Archive products from detail page with confirmation modal
- Restore archived products (users with products:write permission)

**Related Documentation:**
- [Database Schema](../../System/database-schema.md#product) - Product model reference
- [RBAC System](../../System/rbac-system.md) - Permission enforcement

**Problem Being Solved:**
Products with stock history cannot be deleted due to `onDelete: Restrict` foreign key constraints, causing database errors and test failures. Soft delete preserves historical data while allowing users to "remove" obsolete products from active lists.

**Progress Summary:**
- ✅ **Backend Complete** - Migration created, service updated, API endpoints implemented
- ✅ **Backend Tests Passing** - 38 service tests passing (includes 4 new tests for archive functionality)
- ✅ **Frontend UI Complete** - Archive/restore functionality fully implemented with improved UX
- ✅ **E2E Tests Complete** - 8 comprehensive Playwright tests covering all archive/restore flows

---

## Phase 1: Soft Delete Implementation

**Goal:** Implement archive/restore functionality for products with full backend and frontend support

**Relevant Files:**
- [api-server/prisma/schema.prisma](../../api-server/prisma/schema.prisma) - Product model
- [api-server/src/services/productService.ts](../../api-server/src/services/productService.ts) - Product service
- [api-server/src/routes/productsRouter.ts](../../api-server/src/routes/productsRouter.ts) - Product routes
- [api-server/src/openapi/paths/products.ts](../../api-server/src/openapi/paths/products.ts) - OpenAPI schemas
- [admin-web/src/pages/ProductsPage.tsx](../../admin-web/src/pages/ProductsPage.tsx) - Products list UI
- [admin-web/src/pages/ProductDetailPage.tsx](../../admin-web/src/pages/ProductDetailPage.tsx) - Product detail UI

### Backend Implementation

- [x] Database schema changes (create migration: `add_product_archival`)
  - [x] Add `isArchived Boolean @default(false)` to Product model
  - [x] Add `archivedAt DateTime?` (optional, for tracking when)
  - [x] Add `archivedByUserId String?` (optional, for tracking who)
  - [x] Add index on `isArchived` for query performance
- [x] Prisma client regeneration
- [x] Update `productService.ts`:
  - [x] Update list queries to filter `isArchived: false` by default
  - [x] Update `deleteProduct()` to set `isArchived: true` instead of hard delete
  - [x] Add `restoreProduct()` function (sets isArchived: false, clears archivedAt)
  - [x] Add `includeArchived` parameter (backward compat) and `archivedFilter` parameter (new)
  - [x] **Allow `getProduct()` to return archived products** (needed for detail page access)
  - [x] Added `archivedFilter` with 3 modes: "no-archived" (default), "only-archived", "both"
- [x] Update OpenAPI schemas:
  - [x] Add `includeArchived` query parameter to GET /products (backward compat)
  - [x] Add `archivedFilter` enum query parameter to GET /products (new)
  - [x] Add POST `/products/:id/restore` endpoint schema
  - [x] Update Product response schema to include isArchived fields
- [x] Update routes:
  - [x] Change DELETE `/products/:id` to call archiveProduct (requires `products:write`)
  - [x] Add POST `/products/:id/restore` endpoint (requires `products:write`)
  - [x] Add `archivedFilter` query param support to GET `/products`
- [x] Backend tests written and passing (38 service tests total)
  - [x] Archive product with related records (should succeed)
  - [x] Restore archived product
  - [x] List products filters archived by default
  - [x] List products with includeArchived=true shows all (backward compat)
  - [x] **NEW: List products with archivedFilter='only-archived' shows only archived**
  - [x] **NEW: List products with archivedFilter='both' shows all products**
  - [x] **NEW: List products with archivedFilter='no-archived' excludes archived**
  - [x] **NEW: getProduct() allows access to archived products**
  - [x] Permission checks (multi-tenant isolation)
  - [x] Chat tool compatibility maintained
- [x] Confirm all backend tests pass before moving to frontend

### Frontend Implementation

- [x] OpenAPI types regenerated (`npm run openapi:gen`)
- [x] Update `api/products.ts`:
  - [x] Add `restoreProduct()` function
  - [x] Add `archivedFilter` parameter to `listProducts()`
  - [x] Maintain backward compatibility with `includeArchived` param
- [x] Update ProductsPage component (list view):
  - [x] **REMOVED: Archive/delete button from table rows** (cleaner UX)
  - [x] **ADDED: Archive filter dropdown in FilterBar** with 3 options:
    - "Active products only" (no-archived - default)
    - "Archived products only" (only-archived)
    - "All products (active + archived)" (both)
  - [x] Display "Archived" badge on products in table (data-testid="archived-badge")
  - [x] Archive filter properly synced with URL params
  - [x] Archive filter works on first click (fixed override param passing)
- [x] Update ProductPage component (detail/edit page) with **data-testid attributes**:
  - [x] Track isArchived state when loading product
  - [x] Show "Archived" badge in header if product is archived (data-testid="archived-badge")
  - [x] **ADDED: "Archive Product" button** in header (data-testid="archive-product-btn")
    - Only visible for active products with products:write permission
    - Red color, light variant with archive icon
    - Opens confirmation modal before archiving
  - [x] **ADDED: Archive confirmation modal** with user-friendly explanation
    - "Archive Product?" title
    - Explains product will be hidden but can be restored
    - Cancel and Archive buttons
  - [x] Add "Restore" button for archived products (data-testid="restore-btn")
  - [x] Hide Save button when product is archived
  - [x] **FIXED: Archived products accessible on detail pages** (removed isArchived filter from getProduct)
- [x] E2E tests written and passing (8 comprehensive tests)
  - [x] Archive product from detail page (with confirmation modal)
  - [x] Cancel archive confirmation modal (verify no changes)
  - [x] Restore archived product from detail page
  - [x] Filter dropdown shows only archived products
  - [x] Filter dropdown shows all products (active + archived)
  - [x] Verify archived products accessible via direct URL
  - [x] Verify permission checks for archive/restore actions (VIEWER role)
  - [x] Clear archive filter resets to default (active only)

### Documentation

- [x] Update user guide with archive/restore workflows
- [x] Document archive filter and permissions
- [x] Add troubleshooting and common tasks
- [ ] Update [Database Schema](../../System/database-schema.md) with isArchived field (optional - can be done as needed)
- [ ] Update E2E test cleanup patterns to use archive instead of delete (optional - existing patterns work fine)

---

## Testing Strategy

### Backend Tests (Jest) ✅ COMPLETE

**Service Layer:** (38 tests passing - includes 4 new tests)
- [x] Archive product with stock records succeeds
- [x] Archive product updates isArchived, archivedAt, archivedByUserId
- [x] Restore product clears archive fields
- [x] List products excludes archived by default
- [x] List products with includeArchived=true shows all (backward compat)
- [x] **NEW: List products with archivedFilter='only-archived' returns only archived**
- [x] **NEW: List products with archivedFilter='both' returns all products**
- [x] **NEW: List products with archivedFilter='no-archived' excludes archived**
- [x] **NEW: getProduct() allows access to archived products**
- [x] Multi-tenant isolation (cannot archive other tenant's products)
- [x] Audit trail preservation (UPDATE events for restore)
- [x] Optimistic locking with entityVersion
- [x] SKU uniqueness constraints

**API Routes:** (Tests covered in service layer)
- [x] DELETE /products/:id sets isArchived instead of deleting
- [x] POST /products/:id/restore restores archived product
- [x] GET /products with archivedFilter parameter works correctly
- [x] GET /products/:id returns archived products (for detail page access)

**Chat Tools:** (Backward compatibility maintained)
- [x] Search products excludes archived by default
- [x] Count products excludes archived
- [x] All existing tool tests still passing

### Frontend Tests (Playwright E2E) ✅ COMPLETE

**Test File:** `admin-web/e2e/product-archive.spec.ts` (8 tests, all passing)

**User Flows Tested:**
- [x] Archive product from detail page (with confirmation modal)
- [x] Cancel archive confirmation (verify no changes made)
- [x] Use archive filter dropdown to show only archived products
- [x] Use archive filter dropdown to show all products (active + archived)
- [x] Restore archived product from detail page
- [x] Archived badge displayed correctly in list views (checked via data-testid)
- [x] Archived products hidden by default in list view (verified via badge count)
- [x] Archived products accessible via direct URL to detail page
- [x] Archive confirmation modal displays with correct messaging
- [x] Clear archive filter resets to default state

**Permission-Based UI Tested:**
- [x] Users with products:write can archive and restore products
- [x] Users without products:write (VIEWER) cannot see archive/restore buttons
- [x] Archive button only shown for active products
- [x] Restore button only shown for archived products

**Key Testing Patterns Used:**
- Helper functions: `signIn()`, `createProductViaAPI()`, `deleteProductViaAPI()`
- Badge-based verification (not product names) to avoid false positives
- Proper waiting: `waitForLoadState('networkidle')` before assertions
- Selector hierarchy: `getByRole()` → `getByLabel()` → `getByTestId()`
- Cleanup with try/finally blocks to ensure test data deletion

---

## Success Metrics

- [x] Products with stock history can be archived without errors ✅
- [x] Backend tests all passing (38 product service tests) ✅
- [x] Archived products excluded from active views by default ✅
- [x] Three-way archive filter working (no-archived, only-archived, both) ✅
- [x] Restore functionality working with audit trail ✅
- [x] All existing tests continue to pass (backward compatible) ✅
- [x] UI shows archive filter dropdown in FilterBar ✅
- [x] Archive confirmation modal with user-friendly messaging ✅
- [x] Archived products accessible on detail pages for restore ✅
- [x] Archive/restore buttons only visible to users with products:write ✅
- [x] E2E tests written and passing (8 comprehensive Playwright tests) ✅
- [x] User documentation updated with archive workflows and troubleshooting ✅

---

## Notes & Decisions

**Key Design Decisions:**
- **Soft delete over hard delete** - Preserves audit trail for stock movements and transfers
- **Archive terminology** - Using "Archive" in UI instead of "Delete" to clarify it's reversible
- **Three-way filter** - Changed from simple toggle to dropdown with 3 options for better control
- **Archive from detail page** - Moved archive action from list table to detail page with confirmation modal (cleaner UX)
- **Confirmation modal** - Added user-friendly explanation: "This product will be hidden from your active product list but can be restored at any time. All stock history and related data will be preserved."
- **Permission level** - Reusing existing `products:write` permission (no new permission needed)
- **Optional tracking fields** - Including archivedAt and archivedByUserId for better audit trail
- **Archived product access** - Removed isArchived filter from getProduct() to allow detail page access for restoration

**Implementation Changes During Development:**
- Initially planned checkbox toggle → Changed to Select dropdown with 3 options
- Initially planned archive button in table → Moved to detail page only
- Initially blocked archived products on detail pages → Fixed to allow access
- Added `archivedFilter` parameter alongside `includeArchived` for backward compatibility

**E2E Testing Lessons Learned:**
- API response structure: `data.data.product.id` (not `data.data.id`)
- Always verify badge presence (not product names) to avoid false positives from previous test data
- Check actual modal content before writing assertions (don't assume text)
- Use `waitForLoadState('networkidle')` for consistent page loading
- Badge counting is more reliable than visibility checks for list filtering tests

**Known Limitations:**
- Archived products remain in database permanently (not a true delete)
- SKU uniqueness constraint still applies to archived products (may need `@@unique([tenantId, productSku, isArchived])` if SKU reuse is required)

**Future Enhancements (Out of Scope):**
- Bulk archive/restore operations
- Scheduled permanent deletion of archived products (after X days)
- Archive reasons/notes field
- Archive history timeline (show who archived/restored and when)

---

**Template Version:** 1.0
**Created:** 2025-10-17
