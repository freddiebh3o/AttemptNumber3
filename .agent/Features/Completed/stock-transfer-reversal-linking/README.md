# Stock Transfer Reversal Linking

**Status:** ✅ Complete
**Started:** October 25, 2025
**Completed:** October 25, 2025

## Overview
Enhanced the existing stock transfer reversal system with bidirectional relationship tracking and automatic reason propagation. Users can now navigate between original and reversal transfers in both directions via clickable UI links, and reversal reasons automatically appear on both related transfers for complete audit trails.

## Key Features
- **Bidirectional Navigation**: Navigate from original to reversal transfer AND back again via UI links
- **Reversal Reason Propagation**: Reasons automatically copied to orderNotes with "Reversal of TRF-YYYY-NNNN: {reason}" prefix
- **Complete Audit Trail**: Full visibility into reversal relationships and reasons on both transfers
- **Reversal Chain Support**: Can reverse a reversal transfer (reversal-of-reversal) for operational flexibility
- **Theme-Aware UI**: Reversal information section respects light/dark mode (no hardcoded colors)
- **Performance Optimized**: E2E tests use filtering to efficiently find specific transfers

## Problem Solved

**Before:**
- Could only see reversal relationship in one direction (reversal → original)
- No easy way to navigate from original transfer to its reversal
- Reversal reason only visible on reversal transfer
- Difficult to audit full reversal history

**After:**
- Bidirectional links visible on both original and reversal transfers
- Click transfer number to navigate between related transfers
- Reversal reason visible on both transfers (in reversal section AND orderNotes)
- Complete audit trail with chain integrity (supports reversal-of-reversal)

## Implementation

### Backend
- **Database Schema**: Removed redundant `reversedById` field, updated Prisma relations for bidirectional self-references
- **Migration**: `20251025_remove_redundant_reversedById` - Cleaned up schema to use only `reversedByTransferId`
- **Service Layer**:
  - `reverseStockTransfer()` sets both `reversalOfId` (on reversal) and `reversedByTransferId` (on original)
  - Propagates reversal reason to `orderNotes` with prefix format
  - `getStockTransfer()` eagerly loads both `reversalOf` and `reversedBy` relations
- **OpenAPI**: Added `reversalOf` and `reversedBy` relation objects to transfer schema (id, transferNumber, status, reversalReason)
- **Permission Fix**: Changed `canReverse` check from `isMemberOfSource` to `isMemberOfDestination` (reversal happens at destination)

### Frontend
- **Detail Page**: "Reversal Information" section with clickable links
  - Shows icon + text + clickable transfer number button
  - Displays reversal reason if present
  - Theme-aware styling (no hardcoded colors)
  - `data-testid="reversal-of-section"` for reversal transfers
  - `data-testid="reversed-by-section"` for reversed transfers
  - `data-testid="reversal-of-link"` and `data-testid="reversed-by-link"` for navigation
- **List View**: Reversal badges in status column
  - "Reversal" badge (orange/light, xs) with `data-testid="reversal-badge-{transferNumber}"`
  - "Reversed" badge (red/light, xs) with `data-testid="reversed-badge-{transferNumber}"`
- **Navigation**: Button links use `navigate()` for smooth client-side routing

## Test Coverage
- **8 passing backend tests** (Jest)
- **All E2E tests passing** (Playwright - enhanced existing tests)

### Backend Tests (Jest)
**File:** `api-server/__tests__/features/stockTransfers/transferReversal.test.ts`

- Bidirectional link creation on reversal
- Reversal relationships loading via `getStockTransfer()`
- Reversal reason propagation to `orderNotes` with proper prefix
- Reversal without reason (null `orderNotes`)
- Reversal reason visibility on both transfers when queried
- Multi-tenant isolation (cannot access other tenant's reversals)
- Prevent double reversal
- Reversal chain integrity (reversal-of-reversal)

**Run command:**
```bash
cd api-server
node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/stockTransfers/transferReversal.test.ts
```

### Frontend Tests (Playwright E2E)
**File:** `admin-web/e2e/features/transfers/transfer-reversal.spec.ts`

Enhanced existing tests with:
- Complete 16-step flow: create → approve → ship → receive → reverse → verify bidirectional links → navigate both directions
- Reversal badges in list view (with COMPLETED status filtering)
- Bidirectional navigation test (both reversal→original and original→reversal)
- Reversal reason display in detail section and orderNotes
- Performance optimization: All tests filter for COMPLETED status before searching

**Run command:**
```bash
cd admin-web
npm run test:accept -- transfer-reversal
```

## Documentation
- [PRD](./prd.md) - Complete implementation plan with Phases 1 & 2
- User documentation: Feature is self-explanatory in UI (no separate guide needed)

## Key Files

### Backend
- `api-server/prisma/schema.prisma` - StockTransfer model with bidirectional relations (lines 387-453)
- `api-server/prisma/migrations/20251025_remove_redundant_reversedById/migration.sql` - Schema cleanup
- `api-server/src/services/stockTransfers/stockTransferService.ts` - Reversal logic updates (lines 1324-1536)
- `api-server/src/openapi/paths/stockTransfers.ts` - Added `reversalOf` and `reversedBy` objects (lines 84-117)
- `api-server/__tests__/features/stockTransfers/transferReversal.test.ts` - 8 comprehensive backend tests

### Frontend
- `admin-web/src/pages/StockTransferDetailPage.tsx` - Reversal Information section (lines 505-572)
- `admin-web/src/pages/StockTransfersPage.tsx` - Reversal badges in list view (lines 1408-1428)
- `admin-web/e2e/features/transfers/transfer-reversal.spec.ts` - Enhanced E2E tests with filtering

## Architecture Decisions

**Why Bidirectional Links?**
1. **User Experience**: Users need to navigate in both directions (from original to reversal AND back)
2. **Query Efficiency**: Having both `reversalOfId` and `reversedByTransferId` avoids complex JOIN queries
3. **Audit Clarity**: Immediately visible which transfers are linked without additional lookups

**Reversal Reason Propagation Strategy:**
- Stored in `reversalReason` field for structured access
- Copied to `orderNotes` with prefix for visibility in general transfer details
- Prefix format: `"Reversal of TRF-YYYY-NNNN: {reason}"` provides context

**Supporting Reversal-of-Reversal:**
- **Use Case**: Warehouse → Store (original), Store → Warehouse (reversal - "damaged"), Warehouse → Store (reversal of reversal - "mistake, not damaged")
- **Implementation**: No validation preventing reversal of reversal transfers
- **Chain Integrity**: Fully tested with proper bidirectional links at each level
- **Audit Trail**: Complete chain preserved (original ← reversal1 ← reversal2)

**Theme-Aware UI:**
- Removed hardcoded `backgroundColor: '#FFF9DB'`
- Replaced colored Alert components with simple Box components
- UI adapts to user's light/dark theme preference

**Permission Fix:**
- Changed `canReverse` from checking source membership to destination membership
- Logic: Reversals are initiated at the destination branch (where stock was received)

## Example Scenarios

### Creating and Navigating Reversal
```
1. User completes transfer: Warehouse → Store (100 widgets)
2. User reverses transfer with reason: "Damaged during shipping"
3. System creates reversal: Store → Warehouse (100 widgets)
4. System sets:
   - reversal.reversalOfId = original.id
   - original.reversedByTransferId = reversal.id
   - reversal.orderNotes = "Reversal of TRF-2025-123: Damaged during shipping"

5. User views original transfer detail page:
   - Sees "This transfer has been reversed by: TRF-2025-124" (clickable)
   - Clicks link → navigates to reversal transfer

6. User views reversal transfer detail page:
   - Sees "This is a reversal of: TRF-2025-123" (clickable)
   - Sees "Reason: Damaged during shipping"
   - Clicks link → navigates back to original transfer
```

### Reversal-of-Reversal Chain
```
1. Original: Warehouse → Store (transfer A)
2. First Reversal: Store → Warehouse (transfer B reverses A)
   - B.reversalOfId = A.id
   - A.reversedByTransferId = B.id

3. Second Reversal: Warehouse → Store (transfer C reverses B)
   - C.reversalOfId = B.id
   - B.reversedByTransferId = C.id

Chain: A ← B ← C (each link bidirectional)
```

## Success Metrics
- ✅ Reversal creates bidirectional links visible on both transfers
- ✅ Reversal reason propagates to orderNotes with proper prefix
- ✅ Users can navigate between transfers via clickable UI links
- ✅ All backend tests pass (235 total, +8 new)
- ✅ All E2E tests pass (enhanced existing tests)
- ✅ UI is theme-aware (no regressions in light/dark mode)
- ✅ No performance regressions (E2E tests use filtering)

## Security
- ✅ Multi-tenant isolation enforced (cannot access other tenant's reversal links)
- ✅ Permission-based access (`stock:write` required to reverse)
- ✅ Proper branch membership checks (must be member of destination branch)
- ✅ Bidirectional links only created within same tenant

## Known Limitations
- OpenAPI types require manual regeneration: `cd admin-web && npm run openapi:gen` (after starting API server)
- Reversal reason limited to free text (no structured reason taxonomy)
- No automatic notifications when reversal occurs
- Reversal chain can become complex with multiple levels (though fully supported)

## Future Enhancements
- Structured reversal reason dropdown (predefined categories)
- Reversal approval workflow for high-value transfers
- Email notifications when transfers are reversed
- Reversal timeline visualization in UI
- Bulk reversal operations

## Notes
This feature enhances the existing reversal system without breaking changes. All existing reversal functionality continues to work, with the addition of bidirectional navigation and reason propagation. The implementation follows established patterns (data-testid attributes, theme-aware styling, permission checks) for consistency with the rest of the application.

**Important:** Users must regenerate OpenAPI types after starting the API server:
```bash
cd api-server && npm run dev  # Start API server first
cd admin-web && npm run openapi:gen  # Then regenerate types
```

**Performance Note:** E2E tests were optimized to filter for COMPLETED status before searching for specific transfers, dramatically reducing test execution time when working with large datasets (hundreds of seeded transfers).
