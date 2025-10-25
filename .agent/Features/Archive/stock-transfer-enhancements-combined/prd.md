# Stock Transfer Enhancements - Implementation Plan

**Status:** 📋 Planning
**Priority:** High
**Estimated Effort:** 5-7 days
**Created:** 2025-10-24
**Last Updated:** 2025-10-24

---

## Overview

This feature enhances the existing stock transfer system with improved reversal tracking, delivery planning, and bidirectional workflow support. Users will be able to track reversal relationships across transfers, plan deliveries with expected dates, add detailed order notes, and initiate transfers in both directions (push stock to branches OR request stock from branches).

**Key Capabilities:**
- Bidirectional reversal linking with reason propagation across related transfers
- Expected/requested delivery date tracking for better operational planning
- Order notes for communication between branches during transfer workflow
- Dual-direction transfer initiation (push to others OR pull from others)

**Related Documentation:**
- [Stock Transfer System](../../System/stock-transfers.md) - Current implementation
- [Database Schema](../../System/database-schema.md) - Prisma models reference
- [Testing Overview](../../SOP/testing_overview.md) - Testing procedures

---

## Phase 1: Core Data Model Extensions

**Goal:** Extend database schema with new fields for delivery dates, notes, and bidirectional reversal links

**Relevant Files:**
- [api-server/prisma/schema.prisma](../../../api-server/prisma/schema.prisma) - Lines 387-446 (StockTransfer model)
- [api-server/src/services/stockTransfers/stockTransferService.ts](../../../api-server/src/services/stockTransfers/stockTransferService.ts)
- [api-server/src/openapi/paths/stockTransfers.ts](../../../api-server/src/openapi/paths/stockTransfers.ts)

### Backend Implementation

- [ ] Database schema changes (create migration: `add_transfer_enhancements`)
  - Add `expectedDeliveryDate` field (DateTime, nullable)
  - Add `orderNotes` field (String, nullable)
  - Add `reversedByTransferId` field (String, nullable) - bidirectional link complement
  - Add index on `expectedDeliveryDate` for filtering
  - Add index on `reversedByTransferId` for reversal queries
- [ ] Prisma client regeneration (`npm run prisma:generate`)
- [ ] Update `createStockTransfer()` to accept new fields
- [ ] Update `listStockTransfers()` to filter by expected delivery date range
- [ ] Update `getStockTransfer()` to include reversal relationships (both directions)
- [ ] Update OpenAPI schemas for create/update/list requests with new fields
- [ ] Backend tests written following [TEST_TEMPLATE.md](../../../api-server/__tests__/TEST_TEMPLATE.md)
  - Test expected delivery date validation (future dates only)
  - Test order notes max length constraints
  - Test expected delivery date filtering in list endpoint
  - Test multi-tenant isolation with new fields

### Frontend Implementation

- [ ] OpenAPI types regenerated (`npm run openapi:gen`)
- [ ] Update `createStockTransferApiRequest()` with new fields
- [ ] Update `listStockTransfersApiRequest()` with delivery date filters
- [ ] E2E tests written following [GUIDELINES.md](../../../admin-web/e2e/GUIDELINES.md)
  - Test creating transfer with delivery date and notes
  - Test filtering by delivery date range
  - Defer UI updates to Phase 4

### Documentation

- [ ] Update System documentation with new schema fields
- [ ] No /docs updates needed (no new concepts)

---

## Phase 2: Reversal Linking Enhancement

**Goal:** Implement bidirectional reversal relationships and propagate reversal reasons across linked transfers

**Relevant Files:**
- [api-server/src/services/stockTransfers/stockTransferService.ts](../../../api-server/src/services/stockTransfers/stockTransferService.ts) - `reverseStockTransfer()` function
- [api-server/src/services/stockTransfers/transferHelpers.ts](../../../api-server/src/services/stockTransfers/transferHelpers.ts)

### Backend Implementation

- [ ] Update `reverseStockTransfer()` service function
  - Create bidirectional link: set `reversalOfId` on new transfer AND `reversedByTransferId` on original
  - Copy `reversalReason` to new transfer's `orderNotes` field
  - Include prefix in notes: "Reversal of TRF-YYYY-NNNN: {reason}"
- [ ] Update `getStockTransfer()` to eagerly load reversal relationships
  - Include `reversalOf` relation (original transfer if this is reversal)
  - Include `reversedBy` relation (reversal transfer if this was reversed)
- [ ] Backend tests passing
  - Test bidirectional link creation on reversal
  - Test reversal reason propagation to orderNotes
  - Test querying reversal relationships in both directions
  - Test multiple reversals (reversal of reversal) - ensure chain integrity
- [ ] Confirm all existing reversal tests still pass
- [ ] Analyze [transfer-reversal.spec.ts](../../../admin-web/e2e/features/transfers/transfer-reversal.spec.ts) for conflicts

### Frontend Implementation

- [ ] Update API client to handle reversal relationships in responses
- [ ] E2E tests passing
  - Test reversal creates bidirectional link
  - Test reversal reason appears on both transfers
  - Defer UI updates to Phase 4

### Documentation

- [ ] Update System documentation with reversal linking logic
- [ ] No /docs updates needed

---

## Phase 3: Transfer Initiation Direction

**Goal:** Support dual-direction transfer workflows - push stock to branches OR request stock from branches

**Relevant Files:**
- [api-server/prisma/schema.prisma](../../../api-server/prisma/schema.prisma) - Add `initiationType` enum
- [api-server/src/services/stockTransfers/stockTransferService.ts](../../../api-server/src/services/stockTransfers/stockTransferService.ts)
- [api-server/src/services/stockTransfers/transferHelpers.ts](../../../api-server/src/services/stockTransfers/transferHelpers.ts)

### Backend Implementation

- [ ] Database schema changes (create migration: `add_transfer_initiation_type`)
  - Add `TransferInitiationType` enum: `PUSH`, `PULL`
  - Add `initiationType` field to StockTransfer (default: `PUSH`)
  - Add `initiatedByBranchId` field (references Branch, nullable)
  - Add index on `initiationType` for filtering
- [ ] Prisma client regeneration
- [ ] Update `createStockTransfer()` service function
  - Accept `initiationType` parameter
  - Set `initiatedByBranchId` based on user's current branch context
  - PUSH: source branch initiates (existing behavior)
  - PULL: destination branch initiates (new behavior)
- [ ] Update access control logic in `transferHelpers.ts`
  - `assertTransferAccess()`: allow access if user in initiating branch
  - Create validation: PUSH requires source branch membership, PULL requires destination membership
  - Review validation: PUSH requires destination membership, PULL requires source membership
- [ ] Update `listStockTransfers()` filters
  - Add `initiationType` filter
  - Add `initiatedByMe` boolean filter (filters by user's branch memberships)
- [ ] Update OpenAPI schemas for new fields and filters
- [ ] Backend tests passing following [TEST_TEMPLATE.md](../../../api-server/__tests__/TEST_TEMPLATE.md)
  - Test PUSH workflow (source initiates, destination approves)
  - Test PULL workflow (destination requests, source approves)
  - Test access control for both types
  - Test filtering by initiation type and initiatedByMe
  - Test multi-tenant isolation with initiation types
- [ ] Analyze existing transfer tests for conflicts with new access control logic

### Frontend Implementation

- [ ] OpenAPI types regenerated
- [ ] Update API client with new fields and filters
- [ ] E2E tests passing following [GUIDELINES.md](../../../admin-web/e2e/GUIDELINES.md)
  - Test creating PUSH transfer (current behavior)
  - Test creating PULL transfer (request from another branch)
  - Test access control for both types
  - Test filtering by "Initiated by me" vs "Requested from me"
  - Defer UI updates to Phase 4

### Documentation

- [ ] Update System documentation with initiation type logic
- [ ] Update /docs with PUSH vs PULL workflow explanation (new concept for AI assistant)

---

## Phase 4: Frontend UI Integration

**Goal:** Display all new fields and reversal relationships across the transfer UI

**Relevant Files:**
- [admin-web/src/components/stockTransfers/CreateTransferModal.tsx](../../../admin-web/src/components/stockTransfers/CreateTransferModal.tsx)
- [admin-web/src/pages/StockTransferDetailPage.tsx](../../../admin-web/src/pages/StockTransferDetailPage.tsx)
- [admin-web/src/pages/StockTransfersPage.tsx](../../../admin-web/src/pages/StockTransfersPage.tsx)

### Frontend Implementation

- [ ] Update CreateTransferModal component
  - Add expected delivery date picker (DateInput) with **data-testid="expected-delivery-date"**
  - Add order notes textarea (Textarea) with **data-testid="order-notes"**
  - Add initiation type toggle (SegmentedControl: PUSH/PULL) with **data-testid="initiation-type"**
  - Update branch selection labels based on initiation type:
    - PUSH: "From (My Branch)" → "To Branch"
    - PULL: "Request From Branch" → "To (My Branch)"
- [ ] Update StockTransferDetailPage component
  - Display expected delivery date in header section with **data-testid="transfer-expected-delivery"**
  - Display order notes in dedicated section with **data-testid="transfer-order-notes"**
  - Display initiation type badge with **data-testid="transfer-initiation-type"**
  - Display reversal links section (if `reversalOf` or `reversedBy` exists):
    - Link to original transfer if this is reversal with **data-testid="reversal-of-link"**
    - Link to reversal transfer if this was reversed with **data-testid="reversed-by-link"**
    - Display reversal reason from orderNotes if applicable with **data-testid="reversal-reason"**
  - Show "Initiated by" branch badge with **data-testid="initiated-by-branch"**
- [ ] Update StockTransfersPage list view
  - Add expected delivery date column with **data-testid="transfer-row-delivery-date"**
  - Add initiation type filter dropdown with **data-testid="filter-initiation-type"**
  - Add "Initiated by me" toggle filter with **data-testid="filter-initiated-by-me"**
  - Add expected delivery date range filter (DateRangePicker) with **data-testid="filter-delivery-date-range"**
  - Add reversal status badge in status column (show icon if transfer is reversal or has been reversed) with **data-testid="transfer-row-reversal-badge"**
- [ ] Update ReverseTransferModal component
  - Pre-populate reversal reason textarea with **data-testid="reversal-reason-input"**
  - Show warning that reason will appear on both transfers
- [ ] E2E tests passing following [GUIDELINES.md](../../../admin-web/e2e/GUIDELINES.md)
  - Test creating transfer with delivery date, notes, and initiation type
  - Test delivery date and initiation type filters
  - Test reversal links display on both transfers
  - Test reversal reason visibility
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
- [ ] Bidirectional reversal link creation and integrity
- [ ] Reversal reason propagation to orderNotes
- [ ] Initiation type access control (PUSH vs PULL)
- [ ] Multi-tenant isolation with all new fields
- [ ] Edge case: reversal of reversal (chain integrity)
- [ ] Edge case: transfer with delivery date in past (validation error)

**API Routes:**
- [ ] Create transfer with new fields (authenticated request)
- [ ] List transfers filtered by delivery date range
- [ ] List transfers filtered by initiation type and initiatedByMe
- [ ] Get transfer with reversal relationships loaded
- [ ] Permission middleware enforcement (stock:read, stock:write)
- [ ] Request validation for new fields

### Frontend Tests (Playwright E2E)

**User Flows:**
- [ ] Create PUSH transfer with delivery date and order notes
- [ ] Create PULL transfer (request from another branch)
- [ ] Filter transfers by expected delivery date range
- [ ] Filter transfers by initiation type
- [ ] Filter transfers by "Initiated by me"
- [ ] Reverse transfer and verify bidirectional links appear
- [ ] Verify reversal reason appears on both original and reversal transfers
- [ ] Navigate between reversal-linked transfers via UI links

**Permission-Based UI:**
- [ ] OWNER: Can create, approve, ship, receive, reverse transfers
- [ ] ADMIN: Can create, approve, ship, receive, reverse transfers
- [ ] EDITOR: Can create, ship, receive (no approve/reverse)
- [ ] VIEWER: Read-only access (no create/modify actions)

---

## Success Metrics

- [ ] All new fields stored and retrieved correctly across transfer lifecycle
- [ ] Reversal creates bidirectional links visible in UI on both transfers
- [ ] Users can create transfers in both directions (PUSH and PULL)
- [ ] Expected delivery date filters work accurately
- [ ] All existing transfer E2E tests still pass (no regressions)
- [ ] All backend Jest tests pass (227+ tests)
- [ ] All frontend Playwright tests pass (124+ tests)

---

## Notes & Decisions

**Key Design Decisions:**
- **Reversal Reason Storage**: Store reversal reason in `orderNotes` field of reversal transfer with prefix "Reversal of TRF-YYYY-NNNN: {reason}" to maintain single source of truth while keeping reason visible
- **Initiation Type Default**: Default to `PUSH` (existing behavior) to maintain backward compatibility with current workflows
- **Expected Delivery Date**: Optional field, no validation for past dates on existing transfers (only on creation/update)
- **Access Control**: PUSH requires source membership for create, destination for approve; PULL reverses this logic
- **Bidirectional Links**: Both `reversalOfId` and `reversedByTransferId` stored for efficient queries in both directions

**Known Limitations:**
- Expected delivery date is planning-only (no automatic notifications when date approaches)
- Reversal reason limited to text (no structured reason codes)
- Initiation type cannot be changed after transfer creation
- No validation for delivery date conflicts (multiple transfers to same branch on same day)

**Future Enhancements (Out of Scope):**
- Delivery date notifications/alerts
- Structured reversal reason taxonomy
- Automatic delivery scheduling/routing
- Capacity planning based on expected delivery dates
- PDF generation for dispatch notes and purchase orders (separate feature)

---

**Template Version:** 1.0
**Created:** 2025-10-24
