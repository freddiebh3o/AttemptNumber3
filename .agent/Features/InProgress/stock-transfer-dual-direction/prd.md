# Stock Transfer Dual-Direction Initiation - Implementation Plan

**Status:** 📋 Planning
**Priority:** High
**Estimated Effort:** 3-4 days
**Created:** 2025-10-25
**Last Updated:** 2025-10-25

---

## Overview

This feature enables dual-direction transfer workflows, allowing users to either push stock to other branches OR request stock from other branches. This provides operational flexibility for different business scenarios - warehouses can send stock proactively, or retail locations can request stock when needed.

**Key Capabilities:**
- Create PUSH transfers (send stock to another branch - existing behavior)
- Create PULL transfers (request stock from another branch - new behavior)
- Filter transfers by initiation type and initiating branch
- Distinct access control rules based on initiation direction

**Related Documentation:**
- [Stock Transfer System](.agent/System/stock-transfers.md) - Current implementation
- [Database Schema](.agent/System/database-schema.md) - Prisma models reference
- [Testing Overview](.agent/SOP/testing_overview.md) - Testing procedures

---

## Phase 1: Database Schema & Service Layer

**Goal:** Add initiation type and initiating branch tracking, implement dual-direction access control logic

**Relevant Files:**
- [api-server/prisma/schema.prisma](../../../api-server/prisma/schema.prisma) - Add `TransferInitiationType` enum
- [api-server/src/services/stockTransfers/stockTransferService.ts](../../../api-server/src/services/stockTransfers/stockTransferService.ts)
- [api-server/src/services/stockTransfers/transferHelpers.ts](../../../api-server/src/services/stockTransfers/transferHelpers.ts)
- [api-server/src/openapi/paths/stockTransfers.ts](../../../api-server/src/openapi/paths/stockTransfers.ts)

### Backend Implementation

- [ ] Database schema changes (create migration: `add_transfer_initiation_type`)
  - Add `TransferInitiationType` enum: `PUSH`, `PULL`
  - Add `initiationType` field to StockTransfer (default: `PUSH`)
  - Add `initiatedByBranchId` field (references Branch, nullable)
  - Add index on `initiationType` for filtering
- [ ] Prisma client regeneration (`npm run prisma:generate`)
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
- [ ] Backend tests written following [TEST_TEMPLATE.md](../../../api-server/__tests__/TEST_TEMPLATE.md)
  - Test PUSH workflow (source initiates, destination approves)
  - Test PULL workflow (destination requests, source approves)
  - Test access control for both types
  - Test filtering by initiation type and initiatedByMe
  - Test multi-tenant isolation with initiation types
- [ ] Analyze existing transfer tests for conflicts with new access control logic

### Frontend Implementation

- [ ] OpenAPI types regenerated (`npm run openapi:gen`)
- [ ] Update API client with new fields and filters
- [ ] E2E tests written following [GUIDELINES.md](../../../admin-web/e2e/GUIDELINES.md)
  - Test creating PUSH transfer (current behavior)
  - Test creating PULL transfer (request from another branch)
  - Test access control for both types
  - Test filtering by "Initiated by me" vs "Requested from me"
  - Defer UI updates to Phase 2

### Documentation

- [ ] Update System documentation with initiation type logic
- [ ] Update /docs with PUSH vs PULL workflow explanation (new concept for AI assistant)

---

## Phase 2: Frontend UI Integration

**Goal:** Add UI controls for selecting initiation type and filtering by initiation direction

**Relevant Files:**
- [admin-web/src/components/stockTransfers/CreateTransferModal.tsx](../../../admin-web/src/components/stockTransfers/CreateTransferModal.tsx)
- [admin-web/src/pages/StockTransferDetailPage.tsx](../../../admin-web/src/pages/StockTransferDetailPage.tsx)
- [admin-web/src/pages/StockTransfersPage.tsx](../../../admin-web/src/pages/StockTransfersPage.tsx)

### Frontend Implementation

- [ ] Update CreateTransferModal component
  - Add initiation type toggle (SegmentedControl: PUSH/PULL) with **data-testid="initiation-type"**
  - Update branch selection labels based on initiation type:
    - PUSH: "From (My Branch)" → "To Branch"
    - PULL: "Request From Branch" → "To (My Branch)"
  - Auto-fill initiating branch based on user's current branch context
- [ ] Update StockTransferDetailPage component
  - Display initiation type badge with **data-testid="transfer-initiation-type"**
  - Show "Initiated by" branch badge with **data-testid="initiated-by-branch"**
  - Update action button labels based on type:
    - PUSH: "Approve Receipt" (destination)
    - PULL: "Approve Request" (source)
- [ ] Update StockTransfersPage list view
  - Add initiation type filter dropdown with **data-testid="filter-initiation-type"**
  - Add "Initiated by me" toggle filter with **data-testid="filter-initiated-by-me"**
  - Add initiation type badge in transfer row with **data-testid="transfer-row-initiation-type"**
- [ ] E2E tests passing following [GUIDELINES.md](../../../admin-web/e2e/GUIDELINES.md)
  - Test creating PUSH transfer with correct labels
  - Test creating PULL transfer with correct labels
  - Test initiation type and "Initiated by me" filters
  - Test permission-based UI (OWNER, ADMIN, EDITOR, VIEWER roles)
- [ ] Update [scriptsList.md](../../../api-server/__tests__/scriptsList.md) if any test file names changed

### Documentation

- [ ] Update SOP documentation with dual-direction workflows
- [ ] No /docs updates needed (covered in Phase 1)

---

## Testing Strategy

### Backend Tests (Jest)

**Service Layer:**
- [ ] PUSH workflow (source initiates, destination approves)
- [ ] PULL workflow (destination requests, source approves)
- [ ] Initiation type access control (PUSH vs PULL)
- [ ] Multi-tenant isolation with initiation types
- [ ] Edge case: user not in source branch trying PUSH (access denied)
- [ ] Edge case: user not in destination branch trying PULL (access denied)

**API Routes:**
- [ ] Create transfer with initiation type (authenticated request)
- [ ] List transfers filtered by initiation type
- [ ] List transfers filtered by initiatedByMe
- [ ] Get transfer with initiation type included
- [ ] Permission middleware enforcement (stock:write for create)
- [ ] Request validation for initiation type

### Frontend Tests (Playwright E2E)

**User Flows:**
- [ ] Create PUSH transfer (send stock to another branch)
- [ ] Create PULL transfer (request stock from another branch)
- [ ] Filter transfers by initiation type (PUSH/PULL)
- [ ] Filter transfers by "Initiated by me"
- [ ] Approve PUSH transfer (destination user)
- [ ] Approve PULL transfer (source user)

**Permission-Based UI:**
- [ ] OWNER: Can create and approve both PUSH and PULL transfers
- [ ] ADMIN: Can create and approve both PUSH and PULL transfers
- [ ] EDITOR: Can create PUSH/PULL, limited approval access
- [ ] VIEWER: Read-only access (no create/approve actions)

---

## Success Metrics

- [ ] Users can create transfers in both directions (PUSH and PULL)
- [ ] Access control enforces correct branch membership for each type
- [ ] Initiation type filters work accurately
- [ ] UI labels adapt correctly based on initiation type
- [ ] All existing transfer E2E tests still pass (no regressions)
- [ ] All backend Jest tests pass (227+ tests)
- [ ] All frontend Playwright tests pass (124+ tests)

---

## Notes & Decisions

**Key Design Decisions:**
- **Initiation Type Default**: Default to `PUSH` (existing behavior) to maintain backward compatibility with current workflows
- **Access Control**: PUSH requires source membership for create, destination for approve; PULL reverses this logic
- **Branch Context**: Initiating branch auto-fills based on user's current branch context (not user-selectable)
- **Immutability**: Initiation type cannot be changed after transfer creation (workflow consistency)

**Known Limitations:**
- Initiation type cannot be changed after transfer creation
- User must have branch membership to initiate (no cross-branch initiation without membership)
- No bulk transfer creation for mixed PUSH/PULL types

**Future Enhancements (Out of Scope):**
- Automatic PULL requests based on low stock triggers
- Recurring transfer schedules (weekly restocking)
- Multi-branch PULL requests (request from multiple sources simultaneously)
- Transfer templates for common PUSH/PULL patterns

---

**Template Version:** 1.0
**Created:** 2025-10-25
