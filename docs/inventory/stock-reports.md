# Stock Reports and Analytics

## Overview

The system captures detailed data about all stock movements, costs, and inventory levels. This guide explains how to view and analyze your inventory data.

## Available Reports

### Stock Movement History

Track all inventory changes over time through the Stock Ledger.

**What It Shows:**
- Every receipt, consumption, adjustment, and reversal
- Who performed each action
- Exact quantities and timestamps
- Reasons provided for changes

**How to Access:**
Navigate to: **Product Detail Page → Stock Movements Tab**

**Filtering Options:**
- **Date range** - View activity within specific timeframe
- **Branch** - Show movements at one location
- **Movement type** - Filter by RECEIPT, CONSUMPTION, ADJUSTMENT
- **Quantity range** - Find large movements (e.g., > 100 units)
- **User** - See actions by specific person

**Example Use Cases:**
- Investigate unexpected stock decreases
- Audit adjustments made by users
- Track receiving patterns from suppliers
- Reconcile physical counts against system records

### Stock Valuation Reports

Calculate the total value of your inventory using FIFO costs.

**Current Inventory Value:**

Formula: Sum of (quantity remaining × unit cost) across all lots

**Example:**

```
Coffee Beans - Main Warehouse

Lot 1: 75 units × £12.00 = £900.00
Lot 2: 200 units × £13.00 = £2,600.00
Lot 3: 150 units × £12.50 = £1,875.00

Total Value: £5,375.00
```

**How to Calculate:**
1. View product's Stock Levels tab
2. Expand branch to see all lots
3. Multiply each lot's (remaining qty × unit cost)
4. Sum all lots for total value

**By Branch:**
- Repeat for each branch where product is stocked
- Aggregate across all products for branch-level inventory value

**By Product:**
- Sum across all branches for total product value
- Useful for ABC analysis (high-value vs low-value inventory)

### Cost of Goods Sold (COGS) Tracking

Track the cost of inventory consumed through transfers or sales.

**How FIFO Affects COGS:**

When stock is consumed, the system uses FIFO to determine accurate costs.

**Example:**

You have:
- 100 units @ £12.00 (Jan 1)
- 200 units @ £13.00 (Jan 5)

You ship 150 units:
- Take 100 from Jan 1 lot: 100 × £12.00 = £1,200
- Take 50 from Jan 5 lot: 50 × £13.00 = £650
- **Total COGS: £1,850** (weighted avg: £12.33/unit)

**Viewing COGS:**
- Stock transfer detail pages show "Average Cost" per item
- Ledger entries can be analyzed to calculate COGS for any period
- Use the `lotsConsumed` data from transfers to see exact cost breakdown

### Low Stock Alerts (Future Enhancement)

Identify products that need reordering.

**Current Approach:**
Manually review Stock Levels tab and note products with low quantities.

**Planned Features:**
- Automatic alerts when stock falls below threshold
- Reorder point calculation based on consumption rate
- Email notifications to procurement team

### Stock Aging Analysis

Understand how long inventory has been sitting.

**Current Approach:**
1. View lot details on Stock Levels tab
2. Check "Received Date" for each lot
3. Calculate age: (Today - Received Date)
4. Identify old inventory for promotions or write-offs

**Lot Age Example:**

```
Product: Coffee Beans

Lot 1: 75 units (received Jan 1) - Age: 15 days
Lot 2: 200 units (received Jan 5) - Age: 11 days
Lot 3: 150 units (received Jan 10) - Age: 6 days

Oldest inventory: 15 days (Lot 1)
```

**Use Cases:**
- Identify slow-moving inventory
- Prioritize products for sales/promotions
- Detect obsolete stock before it becomes unsellable
- Plan for seasonal clearance

## Analyzing Stock Patterns

### Consumption Rate Analysis

Calculate how quickly you use inventory.

**Manual Calculation:**

1. Open Stock Ledger for a product
2. Filter by movement type: CONSUMPTION
3. Filter by date range (e.g., last 30 days)
4. Sum total quantity consumed
5. Divide by number of days

**Example:**

```
Coffee Beans - Last 30 Days

Jan 15: -50 units (Transfer TRF-001)
Jan 12: -30 units (Transfer TRF-002)
Jan 8: -80 units (Transfer TRF-003)
Jan 3: -40 units (Transfer TRF-004)

Total consumed: 200 units
Daily average: 200 ÷ 30 = 6.7 units/day
```

**Use this to:**
- Set reorder points (e.g., reorder when < 30 days supply)
- Forecast future demand
- Optimize transfer quantities

### Adjustment Pattern Analysis

Track where inventory issues occur most frequently.

**What to Look For:**

1. Open Stock Ledger
2. Filter by movement type: ADJUSTMENT
3. Group by branch or product
4. Look for patterns:
   - Same branch repeatedly adjusting down? → Theft or damage issue
   - Specific product always adjusted? → Quality issue with supplier
   - Same user making frequent adjustments? → Training issue

**Red Flags:**

❌ Frequent large negative adjustments at one branch
❌ Adjustments without reasons provided
❌ Adjustments shortly after receiving (receiving errors?)
❌ Pattern of adjustments on specific days (internal theft?)

### Transfer Performance

Analyze how efficiently inventory moves between branches.

**Metrics to Track:**

- **Average transfer cycle time** - Time from REQUESTED to COMPLETED
- **Full vs partial shipments** - How often you ship less than requested?
- **Transfer volumes** - Which routes are most active?
- **Approval delays** - Time spent in PENDING_APPROVAL status

**Current Access:**
- View individual transfer details to track dates
- Manually calculate cycle times
- Future: Automated dashboard with these metrics

## Generating Custom Reports (API Access)

For advanced users or developers, the system provides API endpoints for custom reporting.

### Stock Ledger API

**Endpoint:** `GET /api/stock/ledger`

**Parameters:**
- `branchId` - Filter by branch
- `productId` - Filter by product
- `kinds` - Filter by type (RECEIPT, CONSUMPTION, etc.)
- `occurredFrom` / `occurredTo` - Date range
- `minQty` / `maxQty` - Quantity filters
- `sortDir` - asc or desc
- `limit` - Pagination (max 100)

**Returns:**
All matching ledger entries with full details.

### Bulk Stock Levels API

**Endpoint:** `GET /api/stock/levels/bulk`

**Parameters:**
- `productId` - Get stock at all branches for a product

**Returns:**
- Stock levels across all branches
- Individual lot details included
- Single call (faster than checking each branch separately)

### Example: Inventory Valuation Report

```
GET /api/stock/levels/bulk?productId=prod_123

Response includes all lots:
[
  {
    branchId: "branch_abc",
    branchName: "Main Warehouse",
    qtyOnHand: 425,
    lots: [
      { qtyRemaining: 75, unitCostPence: 1200, receivedAt: "2025-01-01" },
      { qtyRemaining: 200, unitCostPence: 1300, receivedAt: "2025-01-05" },
      { qtyRemaining: 150, unitCostPence: 1250, receivedAt: "2025-01-10" }
    ]
  }
]

Calculate: (75*12.00) + (200*13.00) + (150*12.50) = £5,375
```

## Report Best Practices

### Regular Cycle Counts

Compare physical counts to system records:

1. Count physical inventory at a branch
2. Check Stock Levels tab for system quantity
3. If discrepancy:
   - Review Stock Ledger for recent movements
   - Investigate unreported consumption/damage
   - Adjust stock with detailed reason

### Monthly Reconciliation

End-of-month inventory checks:

- **Inventory Valuation**: Calculate total value using lot costs
- **Adjustment Review**: Audit all adjustments made during month
- **Consumption Analysis**: Identify top-moving products
- **Aging Analysis**: Flag old inventory for action

### Cost Variance Tracking

Monitor how FIFO costs change over time:

1. Record weighted average cost of inventory each month
2. Compare to previous months
3. Identify cost increases/decreases
4. Use for pricing decisions and supplier negotiations

## Tips for Accurate Reporting

✅ Always provide detailed reasons for adjustments - improves audit trail
✅ Conduct regular cycle counts to verify system accuracy
✅ Review Stock Ledger frequently to catch issues early
✅ Use date filters to focus on specific periods
✅ Export data via API for advanced analysis in Excel/BI tools

## Future Enhancements

Planned reporting features:

- **Automated dashboards** - Real-time visualization of key metrics
- **Low stock alerts** - Email notifications when inventory drops below threshold
- **ABC analysis** - Classify inventory by value/importance
- **Forecast reporting** - Predict future inventory needs based on historical consumption
- **Multi-period comparisons** - Month-over-month, year-over-year analysis

## Quick Reference

| Report Type | Where to Find It | What It Shows |
|-------------|------------------|---------------|
| Movement History | Product → Stock Movements | All receipts, consumption, adjustments |
| Current Value | Product → Stock Levels | Lot-by-lot cost breakdown |
| COGS | Transfer details | Cost of consumed inventory |
| Lot Aging | Product → Stock Levels | Received dates per lot |
| Adjustments | Ledger filtered by ADJUSTMENT | All manual corrections |
| Consumption Rate | Ledger filtered by CONSUMPTION | Usage patterns over time |

**Related Guides:**
- [Understanding FIFO](./understanding-fifo.md) - How costs are calculated
- [Viewing Stock](./viewing-stock.md) - Accessing stock level data
- [Adjusting Stock](./adjusting-stock.md) - Making corrections
