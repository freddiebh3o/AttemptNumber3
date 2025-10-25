# Stock Transfer Reversal Linking - Implementation Plan

**Status:** 📋 Planning
**Priority:** High
**Estimated Effort:** 2-3 days
**Created:** 2025-10-25
**Last Updated:** 2025-10-25

---

## Overview

This feature enhances the existing stock transfer reversal system with bidirectional relationship tracking and automatic reason propagation. Users will be able to navigate between original and reversal transfers in both directions, and reversal reasons will automatically appear on both related transfers for complete audit trails.

**Key Capabilities:**
- Bidirectional reversal linking (navigate from original to reversal AND reversal back to original)
- Automatic reversal reason propagation across related transfers
- Complete audit trail visibility for reversed transfers

**Related Documentation:**
- [Stock Transfer System](.agent/System/stock-transfers.md) - Current implementation
- [Database Schema](.agent/System/database-schema.md) - Prisma models reference
- [Testing Overview](.agent/SOP/testing_overview.md) - Testing procedures

---

## Phase 1: Database Schema & Reversal Logic

**Goal:** Add bidirectional reversal relationships to database and implement reason propagation logic

**Relevant Files:**
- [api-server/prisma/schema.prisma](../../../api-server/prisma/schema.prisma) - Lines 387-446 (StockTransfer model)
- [api-server/src/services/stockTransfers/stockTransferService.ts](../../../api-server/src/services/stockTransfers/stockTransferService.ts) - `reverseStockTransfer()` function
- [api-server/src/services/stockTransfers/transferHelpers.ts](../../../api-server/src/services/stockTransfers/transferHelpers.ts)

### Backend Implementation

- [ ] Database schema changes (create migration: `add_reversal_bidirectional_link`)
  - Add `reversedByTransferId` field (String, nullable) - complement to existing `reversalOfId`
  - Add index on `reversedByTransferId` for reversal queries
- [ ] Prisma client regeneration (`npm run prisma:generate`)
- [ ] Update `reverseStockTransfer()` service function
  - Create bidirectional link: set `reversalOfId` on new transfer AND `reversedByTransferId` on original
  - Copy `reversalReason` to new transfer's `orderNotes` field
  - Include prefix in notes: "Reversal of TRF-YYYY-NNNN: {reason}"
- [ ] Update `getStockTransfer()` to eagerly load reversal relationships
  - Include `reversalOf` relation (original transfer if this is reversal)
  - Include `reversedBy` relation (reversal transfer if this was reversed)
- [ ] Update OpenAPI schemas to include reversal relationships in responses
- [ ] Backend tests written following [TEST_TEMPLATE.md](../../../api-server/__tests__/TEST_TEMPLATE.md)
  - Test bidirectional link creation on reversal
  - Test reversal reason propagation to orderNotes
  - Test querying reversal relationships in both directions
  - Test multiple reversals (reversal of reversal) - ensure chain integrity
  - Test multi-tenant isolation with reversal links
- [ ] Analyze [transfer-reversal.spec.ts](../../../admin-web/e2e/features/transfers/transfer-reversal.spec.ts) for conflicts

### Frontend Implementation

- [ ] OpenAPI types regenerated (`npm run openapi:gen`)
- [ ] Update API client to handle reversal relationships in responses
- [ ] E2E tests written following [GUIDELINES.md](../../../admin-web/e2e/GUIDELINES.md)
  - Test reversal creates bidirectional link
  - Test reversal reason appears on both transfers
  - Defer UI updates to Phase 2

### Documentation

- [ ] Update System documentation with reversal linking logic
- [ ] No /docs updates needed (enhancement to existing feature)

---

## Phase 2: Frontend UI Integration

**Goal:** Display reversal relationships and reasons across the transfer UI

**Relevant Files:**
- [admin-web/src/pages/StockTransferDetailPage.tsx](../../../admin-web/src/pages/StockTransferDetailPage.tsx)
- [admin-web/src/pages/StockTransfersPage.tsx](../../../admin-web/src/pages/StockTransfersPage.tsx)
- [admin-web/src/components/stockTransfers/ReverseTransferModal.tsx](../../../admin-web/src/components/stockTransfers/ReverseTransferModal.tsx)

### Frontend Implementation

- [ ] Update StockTransferDetailPage component
  - Display reversal links section (if `reversalOf` or `reversedBy` exists):
    - Link to original transfer if this is reversal with **data-testid="reversal-of-link"**
    - Link to reversal transfer if this was reversed with **data-testid="reversed-by-link"**
    - Display reversal reason from orderNotes if applicable with **data-testid="reversal-reason"**
- [ ] Update StockTransfersPage list view
  - Add reversal status badge in status column (show icon if transfer is reversal or has been reversed) with **data-testid="transfer-row-reversal-badge"**
- [ ] Update ReverseTransferModal component
  - Pre-populate reversal reason textarea with **data-testid="reversal-reason-input"**
  - Show warning that reason will appear on both transfers
- [ ] E2E tests passing following [GUIDELINES.md](../../../admin-web/e2e/GUIDELINES.md)
  - Test reversal links display on both transfers
  - Test reversal reason visibility
  - Test navigation between reversal-linked transfers via UI links
  - Test permission-based UI (OWNER, ADMIN, EDITOR, VIEWER roles)
- [ ] Update [scriptsList.md](../../../api-server/__tests__/scriptsList.md) if any test file names changed

### Documentation

- [ ] Update SOP documentation with reversal linking workflows (if procedures changed)
- [ ] No /docs updates needed (UI enhancement)

---

## Testing Strategy

### Backend Tests (Jest)

**Service Layer:**
- [ ] Bidirectional reversal link creation and integrity
- [ ] Reversal reason propagation to orderNotes
- [ ] Multi-tenant isolation with reversal links
- [ ] Edge case: reversal of reversal (chain integrity)
- [ ] Edge case: reversal without reason (empty notes)

**API Routes:**
- [ ] Get transfer with reversal relationships loaded
- [ ] Reverse transfer creates both link directions
- [ ] Permission middleware enforcement (stock:write for reversal)
- [ ] Request validation for reversal operation

### Frontend Tests (Playwright E2E)

**User Flows:**
- [ ] Reverse transfer and verify bidirectional links appear
- [ ] Verify reversal reason appears on both original and reversal transfers
- [ ] Navigate between reversal-linked transfers via UI links
- [ ] Create reversal without reason (optional field)

**Permission-Based UI:**
- [ ] OWNER: Can reverse transfers and see reversal links
- [ ] ADMIN: Can reverse transfers and see reversal links
- [ ] EDITOR: Cannot reverse (view reversal links only)
- [ ] VIEWER: Read-only access to reversal information

---

## Success Metrics

- [ ] Reversal creates bidirectional links visible in UI on both transfers
- [ ] Reversal reason propagates correctly to orderNotes with proper prefix
- [ ] Users can navigate between original and reversal transfers via UI links
- [ ] All existing transfer E2E tests still pass (no regressions)
- [ ] All backend Jest tests pass (227+ tests)
- [ ] All frontend Playwright tests pass (124+ tests)

---

## Notes & Decisions

**Key Design Decisions:**
- **Reversal Reason Storage**: Store reversal reason in `orderNotes` field of reversal transfer with prefix "Reversal of TRF-YYYY-NNNN: {reason}" to maintain single source of truth while keeping reason visible
- **Bidirectional Links**: Both `reversalOfId` and `reversedByTransferId` stored for efficient queries in both directions without needing complex JOIN logic
- **Reason Propagation**: Automatic propagation ensures audit trail completeness without manual duplication

**Known Limitations:**
- Reversal reason limited to text (no structured reason codes)
- Reversal chain complexity increases with multiple reversals (reversal of reversal)
- Reason stored in orderNotes field (shares space with general order notes)

**Future Enhancements (Out of Scope):**
- Structured reversal reason taxonomy (dropdown with predefined reasons)
- Reversal approval workflow for high-value transfers
- Automated reversal suggestions based on transfer patterns

---

**Template Version:** 1.0
**Created:** 2025-10-25
