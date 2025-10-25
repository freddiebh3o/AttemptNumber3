# Stock Transfer Delivery Fields - Implementation Plan

**Status:** 📋 Planning
**Priority:** High
**Estimated Effort:** 2-3 days
**Created:** 2025-10-25
**Last Updated:** 2025-10-25

---

## Overview

This feature adds delivery planning capabilities to stock transfers by introducing expected delivery dates and order notes fields. Users will be able to plan operational logistics more effectively by setting expected delivery dates and communicating additional context through order notes during the transfer workflow.

**Key Capabilities:**
- Track expected/requested delivery dates for better operational planning
- Add order notes for communication between branches during transfer workflow
- Filter transfers by expected delivery date ranges

**Related Documentation:**
- [Stock Transfer System](.agent/System/stock-transfers.md) - Current implementation
- [Database Schema](.agent/System/database-schema.md) - Prisma models reference
- [Testing Overview](.agent/SOP/testing_overview.md) - Testing procedures

---

## Phase 1: Database Schema & Service Layer

**Goal:** Extend database schema with new fields for delivery dates and notes, update service layer to handle them

**Relevant Files:**
- [api-server/prisma/schema.prisma](../../../api-server/prisma/schema.prisma) - Lines 387-446 (StockTransfer model)
- [api-server/src/services/stockTransfers/stockTransferService.ts](../../../api-server/src/services/stockTransfers/stockTransferService.ts)
- [api-server/src/openapi/paths/stockTransfers.ts](../../../api-server/src/openapi/paths/stockTransfers.ts)

### Backend Implementation

- [ ] Database schema changes (create migration: `add_transfer_delivery_fields`)
  - Add `expectedDeliveryDate` field (DateTime, nullable)
  - Add `orderNotes` field (String, nullable)
  - Add index on `expectedDeliveryDate` for filtering
- [ ] Prisma client regeneration (`npm run prisma:generate`)
- [ ] Update `createStockTransfer()` to accept new fields
- [ ] Update `listStockTransfers()` to filter by expected delivery date range
- [ ] Update `getStockTransfer()` to include new fields in response
- [ ] Update OpenAPI schemas for create/update/list requests with new fields
- [ ] Backend tests written following [TEST_TEMPLATE.md](../../../api-server/__tests__/TEST_TEMPLATE.md)
  - Test expected delivery date validation (future dates only)
  - Test order notes max length constraints
  - Test expected delivery date filtering in list endpoint
  - Test multi-tenant isolation with new fields
- [ ] Analyze existing transfer tests for conflicts with new fields

### Frontend Implementation

- [ ] OpenAPI types regenerated (`npm run openapi:gen`)
- [ ] Update `createStockTransferApiRequest()` with new fields
- [ ] Update `listStockTransfersApiRequest()` with delivery date filters
- [ ] E2E tests written following [GUIDELINES.md](../../../admin-web/e2e/GUIDELINES.md)
  - Test creating transfer with delivery date and notes
  - Test filtering by delivery date range
  - Defer UI updates to Phase 2

### Documentation

- [ ] Update System documentation with new schema fields
- [ ] No /docs updates needed (no new concepts)

---

## Phase 2: Frontend UI Integration

**Goal:** Display delivery date and order notes fields across the transfer UI

**Relevant Files:**
- [admin-web/src/components/stockTransfers/CreateTransferModal.tsx](../../../admin-web/src/components/stockTransfers/CreateTransferModal.tsx)
- [admin-web/src/pages/StockTransferDetailPage.tsx](../../../admin-web/src/pages/StockTransferDetailPage.tsx)
- [admin-web/src/pages/StockTransfersPage.tsx](../../../admin-web/src/pages/StockTransfersPage.tsx)

### Frontend Implementation

- [ ] Update CreateTransferModal component
  - Add expected delivery date picker (DateInput) with **data-testid="expected-delivery-date"**
  - Add order notes textarea (Textarea) with **data-testid="order-notes"**
- [ ] Update StockTransferDetailPage component
  - Display expected delivery date in header section with **data-testid="transfer-expected-delivery"**
  - Display order notes in dedicated section with **data-testid="transfer-order-notes"**
- [ ] Update StockTransfersPage list view
  - Add expected delivery date column with **data-testid="transfer-row-delivery-date"**
  - Add expected delivery date range filter (DateRangePicker) with **data-testid="filter-delivery-date-range"**
- [ ] E2E tests passing following [GUIDELINES.md](../../../admin-web/e2e/GUIDELINES.md)
  - Test creating transfer with delivery date and notes
  - Test delivery date filter functionality
  - Test permission-based UI (OWNER, ADMIN, EDITOR, VIEWER roles)
- [ ] Update [scriptsList.md](../../../api-server/__tests__/scriptsList.md) if any test file names changed

### Documentation

- [ ] Update SOP documentation with new UI workflows (if procedures changed)
- [ ] No /docs updates needed (UI only)

---

## Testing Strategy

### Backend Tests (Jest)

**Service Layer:**
- [ ] Expected delivery date validation (must be future date if provided)
- [ ] Order notes max length constraints
- [ ] Multi-tenant isolation with new fields
- [ ] Edge case: delivery date in past (validation error)
- [ ] Edge case: very long order notes (max length)

**API Routes:**
- [ ] Create transfer with new fields (authenticated request)
- [ ] List transfers filtered by delivery date range
- [ ] Get transfer with new fields included
- [ ] Permission middleware enforcement (stock:read, stock:write)
- [ ] Request validation for new fields

### Frontend Tests (Playwright E2E)

**User Flows:**
- [ ] Create transfer with delivery date and order notes
- [ ] Filter transfers by expected delivery date range
- [ ] View delivery date and notes on detail page
- [ ] Edit transfer to update delivery date and notes

**Permission-Based UI:**
- [ ] OWNER: Can create, edit transfers with new fields
- [ ] ADMIN: Can create, edit transfers with new fields
- [ ] EDITOR: Can create, edit transfers with new fields
- [ ] VIEWER: Read-only access to new fields

---

## Success Metrics

- [ ] All new fields stored and retrieved correctly across transfer lifecycle
- [ ] Expected delivery date filters work accurately
- [ ] Order notes display correctly on detail page
- [ ] All existing transfer E2E tests still pass (no regressions)
- [ ] All backend Jest tests pass (227+ tests)
- [ ] All frontend Playwright tests pass (124+ tests)

---

## Notes & Decisions

**Key Design Decisions:**
- **Expected Delivery Date**: Optional field, no validation for past dates on existing transfers (only on creation/update)
- **Order Notes**: Free-text field with reasonable max length (e.g., 2000 characters) for operational flexibility

**Known Limitations:**
- Expected delivery date is planning-only (no automatic notifications when date approaches)
- No validation for delivery date conflicts (multiple transfers to same branch on same day)

**Future Enhancements (Out of Scope):**
- Delivery date notifications/alerts
- Automatic delivery scheduling/routing
- Capacity planning based on expected delivery dates

---

**Template Version:** 1.0
**Created:** 2025-10-25
