# Stock Transfer Dual-Direction (PUSH/PULL)

**Status:** ✅ Complete
**Started:** October 25, 2025
**Completed:** October 25, 2025

## Overview
Enhanced stock transfers with dual-direction initiation types: PUSH (source initiates and sends) and PULL (destination requests from source). This provides operational flexibility for different warehouse workflows - centralized distribution (PUSH) vs. branch-initiated restocking (PULL) - with appropriate access control and approval flows for each direction.

## Key Features
- **PUSH Transfers**: Source branch initiates and sends stock to destination
- **PULL Transfers**: Destination branch requests stock from source
- **Dynamic UI Labels**: Labels change based on initiation type for clarity
- **Access Control**: Branch membership requirements adapt to initiation type
- **List View Filters**: Filter by initiation type (PUSH/PULL) and "Initiated by Me"
- **Visual Indicators**: Color-coded badges (blue for PUSH, grape for PULL)
- **Backward Compatible**: Defaults to PUSH for existing workflows

## Problem Solved

**Before:**
- Only source-initiated transfers supported (implicit PUSH model)
- Destination branches couldn't formally request stock
- No way to distinguish between proactive sends vs. requested transfers
- Access control didn't support destination-initiated workflows

**After:**
- Clear distinction between PUSH (send) and PULL (request) workflows
- Destination branches can initiate transfer requests
- Access control adapts: PUSH requires source membership, PULL requires destination membership
- UI dynamically shows who initiated and who needs to approve
- Filters help users focus on transfers relevant to their role

## Implementation

### Backend
- **Database Schema**: Added `initiationType` enum (`PUSH`, `PULL`), `initiatedByBranchId` field for tracking which branch initiated
- **Migration**: `20251025_add_transfer_dual_direction` - Added initiation type and initiated-by tracking
- **Service Layer**:
  - `createStockTransfer()` handles PUSH vs PULL access control logic
  - PUSH: User must be member of source branch
  - PULL: User must be member of destination branch
  - Sets `initiatedByBranchId` based on initiation type
- **Filtering**: `listStockTransfers()` supports `initiationType` and `initiatedByMe` query params
- **OpenAPI**: Updated schemas with initiation type fields for type-safe frontend integration
- **Backward Compatibility**: Existing transfers default to `PUSH` via migration

### Frontend
- **Create Modal**: SegmentedControl for choosing PUSH/PULL with dynamic branch labels
  - `data-testid="initiation-type"` for toggle control
  - PUSH labels: "From Branch (Sending)" / "To Branch (Receiving)"
  - PULL labels: "Request From Branch" / "To My Branch (Receiving)"
- **Detail Page**: Initiation type badge and initiated-by branch badge
  - `data-testid="transfer-initiation-type"` for PUSH/PULL badge (blue/grape)
  - `data-testid="initiated-by-branch"` for branch name badge
  - Dynamic review button: "Approve Receipt" (PUSH) vs "Approve Request" (PULL)
- **List View**: Filters and badges
  - `data-testid="filter-initiation-type"` for type dropdown
  - `data-testid="filter-initiated-by-me"` for initiated-by dropdown
  - `data-testid="transfer-row-initiation-type"` for row badges

## Test Coverage
- **15 passing backend tests** (Jest)
- **7 new E2E tests** (Playwright - dual-direction workflows)
- **40+ existing E2E tests updated** (transfer-crud, transfer-reversal, transfer-templates, etc.)

### Backend Tests (Jest)
**File:** `api-server/__tests__/features/stockTransfers/transferDualDirection.test.ts`

- Create PUSH transfer (source membership required)
- Create PULL transfer (destination membership required)
- Access control: Cannot create PUSH without source membership
- Access control: Cannot create PULL without destination membership
- PUSH sets `initiatedByBranchId` to source branch
- PULL sets `initiatedByBranchId` to destination branch
- Filter by initiation type (PUSH, PULL)
- Filter by "Initiated by Me" (current user's branches)
- Multi-tenant isolation
- Backward compatibility (existing transfers default to PUSH)

**Run command:**
```bash
cd api-server
npm run test:accept -- transferDualDirection
```

### Frontend Tests (Playwright E2E)
**File:** `admin-web/e2e/features/transfers/transfer-dual-direction.spec.ts`

- Create PUSH transfer with correct labels and badges
- Create PULL transfer with correct labels and badges
- PUSH transfer detail page shows correct badges and review button
- PULL transfer detail page shows correct badges and review button
- Filter by initiation type (PUSH)
- Filter by initiation type (PULL)
- Filter by "Initiated by Me"

**Run command:**
```bash
cd admin-web
npm run test:accept -- transfer-dual-direction
```

### Updated Existing Tests
- **transfer-crud.spec.ts**: Updated "source branch" → "from branch", "destination branch" → "to branch"
- **transfer-reversal.spec.ts**: Fixed test logic to properly identify reversed transfers vs reversal transfers
- **transfer-templates.spec.ts**: Updated branch labels
- **transfer-delivery-fields.spec.ts**: Updated branch labels
- **transfer-multi-level-approval.spec.ts**: Updated branch labels

## Documentation
- [PRD](./prd.md) - Complete implementation plan with both phases
- User guides updated:
  - [docs/stock-transfers/overview.md](../../../docs/stock-transfers/overview.md) - Added "Transfer Initiation Types" section
  - [docs/stock-transfers/creating-transfers.md](../../../docs/stock-transfers/creating-transfers.md) - Added initiation type selection guide
- AI assistant knowledge base ingested (696 chunks)

## Key Files

### Backend
- [api-server/prisma/schema.prisma](../../../api-server/prisma/schema.prisma) - StockTransfer model with `initiationType` and `initiatedByBranchId`
- [api-server/prisma/migrations/20251025_add_transfer_dual_direction/migration.sql](../../../api-server/prisma/migrations/20251025_add_transfer_dual_direction/migration.sql) - Schema migration
- [api-server/src/services/stockTransfers/stockTransferService.ts](../../../api-server/src/services/stockTransfers/stockTransferService.ts) - PUSH/PULL access control logic
- [api-server/src/openapi/paths/stockTransfers.ts](../../../api-server/src/openapi/paths/stockTransfers.ts) - Updated schemas with initiation type
- [api-server/__tests__/features/stockTransfers/transferDualDirection.test.ts](../../../api-server/__tests__/features/stockTransfers/transferDualDirection.test.ts) - 15 backend tests

### Frontend
- [admin-web/src/components/stockTransfers/CreateTransferModal.tsx](../../../admin-web/src/components/stockTransfers/CreateTransferModal.tsx) - SegmentedControl and dynamic labels
- [admin-web/src/pages/StockTransferDetailPage.tsx](../../../admin-web/src/pages/StockTransferDetailPage.tsx) - Initiation type badges and dynamic review button
- [admin-web/src/pages/StockTransfersPage.tsx](../../../admin-web/src/pages/StockTransfersPage.tsx) - Filters for initiation type and initiated-by
- [admin-web/src/api/stockTransfers.ts](../../../admin-web/src/api/stockTransfers.ts) - API client with new query params
- [admin-web/e2e/features/transfers/transfer-dual-direction.spec.ts](../../../admin-web/e2e/features/transfers/transfer-dual-direction.spec.ts) - 7 E2E tests

## Architecture Decisions

**Why PUSH/PULL Model?**
1. **Real-World Workflows**: Warehouses push to stores (distribution), stores pull from warehouses (restocking)
2. **Access Control Clarity**: Who can initiate is clear (source for PUSH, destination for PULL)
3. **Approval Logic**: Initiator vs approver roles are explicit (PUSH: destination approves receipt, PULL: source approves request)

**Initiation Type Strategy:**
- Enum field (`PUSH`, `PULL`) rather than boolean for extensibility
- Immutable after creation (no changing direction mid-workflow)
- Default to `PUSH` for backward compatibility with existing workflows

**Initiated-By Tracking:**
- `initiatedByBranchId` stores which branch initiated the transfer
- PUSH: `initiatedByBranchId = sourceBranchId`
- PULL: `initiatedByBranchId = destinationBranchId`
- Powers "Initiated by Me" filter for personalized views

**Access Control Logic:**
- **PUSH Creation**: Requires source branch membership (you must have the stock)
- **PULL Creation**: Requires destination branch membership (you must be requesting to your branch)
- **Review/Approval**: Opposite branch from initiator must approve
- **Shipping/Receiving**: Same as previous logic (source ships, destination receives)

**UI Dynamic Labels:**
- Labels change based on selected initiation type for clarity
- PUSH: "From Branch (Sending)" → "To Branch (Receiving)"
- PULL: "Request From Branch" → "To My Branch (Receiving)"
- Prevents user confusion about directionality

**Filter Design:**
- Initiation type filter: All/PUSH/PULL dropdown
- "Initiated by Me" filter: All/Initiated by Me/Requested from Me dropdown
- Combination of filters allows focused views (e.g., "Show me all PULL requests I need to approve")

## Example Scenarios

### PUSH Transfer (Warehouse Distribution)
```
Scenario: Central warehouse distributes inventory to retail store

1. Warehouse manager signs in, navigates to Stock Transfers
2. Clicks "Create Stock Transfer"
3. Selects "PUSH (Send Stock)" (default)
4. Selects:
   - From Branch (Sending): Central Warehouse
   - To Branch (Receiving): Downtown Store
   - Items: 100 units Coffee Beans
5. Clicks "Create Transfer"

System:
- Sets initiationType = PUSH
- Sets initiatedByBranchId = Central Warehouse ID
- Requires warehouse manager to have Central Warehouse membership
- Transfer shows blue "PUSH (Send)" badge
- Downtown Store must approve receipt
```

### PULL Transfer (Store Requests Restock)
```
Scenario: Retail store requests emergency restock from warehouse

1. Store manager signs in, navigates to Stock Transfers
2. Clicks "Create Stock Transfer"
3. Selects "PULL (Request Stock)"
4. Labels update dynamically:
   - Request From Branch: Central Warehouse
   - To My Branch (Receiving): Downtown Store
5. Adds:
   - Items: 50 units Coffee Beans
   - Order Notes: "Urgent - running low on stock"
6. Clicks "Create Transfer"

System:
- Sets initiationType = PULL
- Sets initiatedByBranchId = Downtown Store ID
- Requires store manager to have Downtown Store membership
- Transfer shows grape "PULL (Request)" badge
- Central Warehouse must approve request
```

### Filtering Transfers
```
User opens Stock Transfers page:

1. Filters by "PULL (Request)" transfers
   - Sees only transfers where destinations requested stock

2. Filters by "Initiated by Me"
   - Sees only transfers where their branches initiated

3. Combines filters: "PULL" + "Requested from Me"
   - Sees only PULL transfers requesting stock from their branches
   - These are transfers they need to approve
```

## Success Metrics
- ✅ PUSH and PULL workflows fully functional end-to-end
- ✅ Access control correctly enforces branch membership requirements
- ✅ UI dynamically updates labels based on initiation type
- ✅ Filters allow users to focus on relevant transfers
- ✅ 15 new backend tests passing (242 total backend tests)
- ✅ 7 new E2E tests passing (131 total frontend tests)
- ✅ 40+ existing E2E tests updated with no regressions
- ✅ Documentation updated and ingested into AI assistant

## Security
- ✅ Multi-tenant isolation (tenantId filtering enforced)
- ✅ Permission-based access (`stock:read`, `stock:write` required)
- ✅ Branch membership validation (PUSH: source, PULL: destination)
- ✅ Initiation type immutable after creation (no direction changes mid-workflow)
- ✅ Approval logic enforces correct reviewing branch

## Known Limitations
- Initiation type cannot be changed after transfer creation
- No validation preventing PULL requests for items not available at source
- Filter combinations can be complex with many active filters
- No automatic routing/optimization for PULL requests

## Future Enhancements
- **Stock Availability Validation**: Prevent PULL requests for items source doesn't have
- **Automatic Request Approval**: Auto-approve PULL requests based on rules
- **Request Templates**: Save common PULL request configurations
- **Bulk Operations**: Create multiple PULL requests at once (e.g., monthly restock)
- **Smart Routing**: Suggest best source branch for PULL requests
- **Notifications**: Alert source branches when PULL requests are created

## Notes
This feature provides essential workflow flexibility while maintaining backward compatibility with existing PUSH-only transfers. The implementation follows established patterns (SegmentedControl, dynamic labels, color-coded badges, data-testid attributes) for consistency with the rest of the application. All tests pass with comprehensive coverage of both PUSH and PULL workflows.

**Important:** Users must regenerate OpenAPI types after starting the API server:
```bash
cd api-server && npm run dev  # Start API server first
cd admin-web && npm run openapi:gen  # Then regenerate types
```

**Testing Note:** Existing transfer tests were updated to work with new UI labels ("from branch" instead of "source branch", "to branch" instead of "destination branch"). All 131 frontend E2E tests now passing with dual-direction support.
