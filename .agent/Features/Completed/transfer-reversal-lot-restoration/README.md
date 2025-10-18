# Transfer Reversal Lot Restoration

**Status:** ✅ Complete
**Started:** January 18, 2025
**Completed:** October 18, 2025

## Overview
Enhanced transfer reversal functionality to restore stock to the **exact same lots** it came from, preserving FIFO (First-In-First-Out) age, unit costs, and lot traceability. This ensures accurate inventory aging and cost accounting when transfers are reversed.

## Key Features
- **Lot Restoration**: Stock returns to original lots (not new lots)
- **FIFO Preservation**: Original `receivedAt` timestamps maintained (older stock stays older)
- **Cost Accuracy**: Unit costs preserved exactly as they were
- **REVERSAL Ledger Entries**: Distinct from RECEIPT entries for audit clarity
- **Multi-Lot Support**: Handles transfers that consumed from multiple lots
- **Backward Compatible**: Existing reversal API and UI unchanged

## Problem Solved

**Before (Legacy Behavior):**
- Reversed stock created **new lots** with today's date
- FIFO order disrupted (old stock became "new")
- Cost averaging artificially changed
- Audit trail lost original receipt dates

**After (Lot Restoration):**
- Reversed stock returns to **original lot IDs**
- FIFO age preserved (Dec 1 stock remains Dec 1 stock)
- Costs unchanged (no artificial averaging)
- Full traceability to original receipt

## Implementation

### Backend
- **Core Logic**: `restoreLotQuantities()` function in `stockService.ts`
  - Reads `lotsConsumed` JSON from shipment batches
  - Increments `qtyRemaining` on original lots
  - Creates REVERSAL ledger entries (not RECEIPT)
- **Database**: Uses existing `lotsConsumed` field (no schema changes)
- **Transaction Safety**: All operations within database transaction
- **Multi-Tenant**: Enforces tenant isolation on all operations

### Frontend
- **No UI Changes**: Reversal button/dialog works exactly the same
- **E2E Test Helpers**: Added `StockFactory.getLots()` and `StockFactory.getLedger()`
- **Transfer Factory**: Enhanced with `receive()` method for complete test flows

## Test Coverage
- **33 passing tests** (22 backend + 11 frontend E2E)
- **Backend Tests (Jest)**: `stockLotRestoration.test.ts` with 22 comprehensive tests
  - Basic lot restoration (single lot)
  - Multi-lot restoration (2+ lots consumed)
  - Multi-batch shipments (shipped in multiple batches)
  - Edge cases (additional stock, partial consumption, 15+ lots)
  - REVERSAL ledger entries validation
- **Frontend Tests (Playwright E2E)**: `transfer-reversal-lot-restoration.spec.ts` with 11 tests
  - Lot ID verification (same lot restored)
  - receivedAt timestamp preservation
  - REVERSAL entries in stock ledger UI
  - Multi-lot scenarios
  - UI integration (correct quantities displayed)

## Documentation
- [PRD](./prd.md) - Complete implementation plan with all phases
- [Reversing Transfers Guide](../../../docs/stock-transfers/reversing-transfers.md) - User documentation with lot restoration examples
- [Understanding FIFO](../../../docs/inventory/understanding-fifo.md) - FIFO behavior including reversals

## Key Files

### Backend
- `api-server/src/services/stockService.ts` - `restoreLotQuantities()` function (lines 450-550)
- `api-server/src/services/stockTransfers/transferHelpers.ts` - Helper to find lot consumptions
- `api-server/__tests__/services/stockLotRestoration.test.ts` - 22 comprehensive tests

### Frontend/E2E
- `admin-web/e2e/stock/transfer-reversal-lot-restoration.spec.ts` - 11 E2E tests
- `admin-web/e2e/helpers/factories.ts` - Enhanced with `StockFactory.getLots()`, `StockFactory.getLedger()`, `TransferFactory.receive()`

### Documentation
- `docs/stock-transfers/reversing-transfers.md` - Updated with lot restoration section
- `docs/inventory/understanding-fifo.md` - Added reversal behavior documentation

## Architecture Decisions

**Why Restore Lots Instead of Creating New Ones?**
1. **FIFO Accuracy**: Maintains true inventory age for accurate rotation
2. **Cost Integrity**: Prevents artificial cost averaging from re-receipting
3. **Audit Trail**: Preserves original receipt dates and costs for compliance
4. **Reversibility**: Reversing a reversal truly restores previous state

**Using Existing `lotsConsumed` Data:**
- Already tracked during shipment for FIFO cost calculation
- No schema changes needed
- Format: `[{ lotId, qtyConsumed, receivedAt, unitCostPence }]`

**REVERSAL vs RECEIPT Ledger Entries:**
- REVERSAL distinguishes reversed stock from new receipts
- Helps identify reversed operations in reports
- Maintains clear audit trail

**Transaction Safety:**
- All lot updates wrapped in database transaction
- Failures roll back completely
- Prevents partial restoration

## Example Scenario

**Initial State:**
```
Warehouse has Coffee Beans:
- Lot A: 100 units @ £12.00 (Dec 1)
- Lot B: 50 units @ £13.00 (Dec 15)
```

**Transfer (Dec 20):**
```
Ship 120 units to Store
FIFO consumes: All 100 from Lot A + 20 from Lot B

Warehouse now has:
- Lot B: 30 units @ £13.00 (Dec 15)
```

**Reversal (Jan 5):**
```
Stock returns to Warehouse and restores original lots:
- Lot A: 100 units @ £12.00 (Dec 1) ← Original date preserved!
- Lot B: 50 units @ £13.00 (Dec 15) ← Fully restored

Ledger shows:
- Store: REVERSAL entry (-120 units)
- Warehouse: REVERSAL entry (+120 units, "Reversal of TRF-001")
```

## Success Metrics
- ✅ 100% of reversals restore to original lots (0% new lot creation)
- ✅ FIFO age preserved in all test scenarios
- ✅ 33 tests passing (22 backend + 11 E2E)
- ✅ Zero regressions in existing transfer functionality
- ✅ User documentation updated and ingested for AI assistant

## Security
- ✅ Multi-tenant isolation (only restore tenant's lots)
- ✅ Permission-based access (`stock:write` required)
- ✅ Audit trail via REVERSAL ledger entries
- ✅ Transaction safety (atomic operations)

## Known Limitations
- Transfers must be COMPLETED before reversal (same as before)
- Partial reversals not supported (must reverse entire transfer)
- Timeline UI enhancement deferred (shows reversal but not in timeline)

## Future Enhancements
- Timeline UI showing reversal event in transfer detail page
- Bulk reversal operations
- Partial transfer reversals (reverse specific items)

## Notes
This feature maintains backward compatibility while significantly improving inventory accuracy. The implementation is production-grade with comprehensive test coverage, transaction safety, and complete user documentation. The lot restoration behavior is automatic and transparent to users - the UI remains unchanged while the underlying logic ensures FIFO integrity.
