# PRD: Stock Management & Branch Operations (Sprint 1)

## Problem
Multi-location businesses need accurate stock tracking with FIFO costing and branch-level inventory management. Without proper lot tracking and movement logs, businesses lose visibility into stock valuation and can't reconcile inventory discrepancies.

## Users
- **Warehouse Managers** - Receive stock, adjust quantities, view branch inventory
- **System Administrators** - Set up branches, assign users to locations
- **Finance/Operations** - Need accurate FIFO valuations for reporting

## Scope (This Sprint)
✅ Branch CRUD operations with user assignments
✅ Stock receipt creation (new lots with unit cost)
✅ Stock adjustments (positive/negative with audit trail)
✅ FIFO consumption logic (drain oldest lots first)
✅ View branch stock levels and lot details
❌ Stock transfers between branches (future)
❌ Stock allocation/reservation (future)

## User Stories

### ST-001: Branch Management
**As a** system administrator
**I want to** create and manage branches with user assignments
**So that** I can organize inventory by physical location

### ST-002: Stock Receipt
**As a** warehouse manager
**I want to** record stock receipts with unit cost and quantity
**So that** new inventory is tracked in FIFO lots with accurate valuation

### ST-003: Stock Adjustment
**As a** warehouse manager
**I want to** adjust stock quantities (up/down) with a reason
**So that** I can correct discrepancies and maintain audit trail

## Success Metrics
1. **Stock accuracy** - 95%+ match between system and physical counts
2. **API latency** - P95 < 500ms for stock operations
3. **Audit completeness** - 100% of stock movements logged with actor/timestamp

## Risks
- **Concurrent writes** - Two users adjusting same product simultaneously → use DB transactions
- **FIFO complexity** - Draining multiple lots correctly → comprehensive unit tests
- **Permission model** - Branch-level access control not fully implemented → start with tenant-level checks

## Milestones
- **Week 1** - Branch CRUD + API tests
- **Week 2** - Stock receipt/adjustment + FIFO consumption
- **Week 3** - UI integration + QA validation
