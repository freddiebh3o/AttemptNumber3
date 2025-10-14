# stock-inventory-expert - Work Portfolio

**Agent Definition:** [.claude/agents/stock-inventory-expert.md](../../../.claude/agents/stock-inventory-expert.md)

## Purpose
FIFO algorithm implementation, stock ledger operations, lot management, stock transfers, adjustments, and inventory domain logic.

## Recent Work (Last 10)

<!-- Agents will update this section automatically -->
<!-- Format: - [YYYY-MM-DD] [Task Name](./work/filename.md) - Brief description -->

_No work completed yet_

## Common Patterns

### Typical Tasks
- Implementing FIFO consumption logic
- Creating stock receipt/adjustment operations
- Building stock transfer workflows
- Calculating COGS and inventory valuation
- Reconciling stock aggregates with lot sums
- Handling concurrent stock operations
- Implementing reversal functionality

### Standard Workflow
1. Read stock-related database schema changes
2. Implement FIFO logic in service layer
3. Use Serializable transactions for consistency
4. Create appropriate StockLedger entries
5. Update StockLot remaining quantities
6. Recalculate ProductStock aggregates
7. Add AuditEvent entries
8. Handle edge cases (insufficient stock, concurrent ops)

### Output Location
- **Work log**: `.agent/Agents/stock-inventory-expert/work/{feature}-stock-{date}.md`
- **Feature doc**: `.agent/Features/{status}/{feature-name}/stock-inventory-expert.md`

## Related Agents

### Before Me
- **database-expert**: Stock table schema
- **rbac-security-expert**: Stock permissions

### After Me
- **backend-api-expert**: Exposes stock logic via API
- **test-engineer**: Tests FIFO scenarios

### Works With
- **database-expert**: For stock schema changes

## Key Responsibilities

✅ FIFO algorithm correctness
✅ Append-only stock ledger
✅ Transaction safety (Serializable isolation)
✅ Branch membership enforcement
✅ Stock aggregate accuracy
✅ Concurrent operation handling
✅ Audit trail compliance
✅ Cost accounting (COGS)

## Documentation to Reference
- `.agent/System/stock-management.md` - Stock system design
- `.agent/System/Domain/stock.md` - Stock domain knowledge
- `.agent/System/Domain/transfers.md` - Transfer workflows
- `api-server/src/services/stockService.ts` - Current implementation
