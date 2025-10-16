# Stock Valuation & Analytics

## Overview

Stock analytics help you understand the financial value of your inventory and how efficiently stock is being managed across branches. The system uses FIFO (First In, First Out) costing to calculate accurate stock valuations.

**What You Can Track:**
- Total stock value by branch (in GBP £)
- Product counts and diversity
- FIFO-based valuation
- Multi-branch aggregated values

## Accessing Stock Analytics

### Via AI Chatbot

The primary way to get stock valuation is through the AI assistant:

**Click the chat icon** in the header and ask:
- "What is our inventory worth?"
- "Show me stock value for Main Warehouse"
- "What's the total stock value across all branches?"
- "How much stock do we have at London HQ?"

The AI will return real-time valuations based on current stock levels and FIFO costs.

### Dashboard (Future)

A visual analytics dashboard with charts and trends is planned but not yet implemented. For now, use the AI chatbot.

## Stock Valuation Metrics

### Total Stock Value

**Definition:**
- Sum of all stock value across branches you have access to
- Calculated using FIFO lot costing
- Expressed in British Pounds (£)

**How It's Calculated:**
1. For each branch, get all stock lots with remaining quantity > 0
2. Multiply `qtyRemaining` × `unitCostPence` for each lot
3. Sum all lot values
4. Convert from pence to pounds (÷ 100)
5. Format as £XX.XX

**Example:**
```
Branch: Main Warehouse
Lot 1: 100 units @ £5.00 = £500.00
Lot 2: 50 units @ £6.50 = £325.00
Lot 3: 200 units @ £4.75 = £950.00
─────────────────────────────────
Total Value: £1,775.00
```

### Branch-Level Metrics

**Branch Name**
- Display name of the branch

**Total Value**
- Stock value for that specific branch
- Formatted as £X,XXX.XX

**Product Count**
- Number of distinct products with stock > 0 at this branch
- Measures product diversity
- Example: 42 products means 42 different SKUs in stock

### Grand Total

**Definition:**
- Sum of stock values across all branches you're a member of

**Use Cases:**
- Understand total inventory investment
- Financial reporting
- Insurance coverage planning
- Audit verification

## Understanding FIFO Valuation

### What is FIFO?

**FIFO** = First In, First Out

When stock is received multiple times at different costs, FIFO assumes the oldest stock is consumed first. This means:
- Remaining stock is valued at the cost of the **most recent receipts**
- Older, cheaper stock is consumed/sold first
- Inventory value reflects current replacement costs

### Why FIFO Matters for Valuation

**Example Scenario:**

**January:** Receive 100 units @ £4.00 each = £400
**February:** Receive 100 units @ £5.00 each = £500
**March:** Sell 150 units

**FIFO Consumption:**
1. First 100 units consumed at £4.00 (January lot)
2. Next 50 units consumed at £5.00 (February lot)

**Remaining Stock:**
- 50 units from February lot @ £5.00 = £250

**Valuation:**
- The 50 remaining units are valued at £5.00 (most recent cost)
- Total stock value = £250

### How Lots Track FIFO

**Stock Lots** (see [Understanding FIFO](../inventory/understanding-fifo.md) for details):
- Created when stock is received
- Track `receivedDate`, `unitCostPence`, `qtyRemaining`
- System automatically consumes oldest lots first
- Valuation uses only lots with `qtyRemaining > 0`

## Filtering Stock Analytics

### By Branch

**All Your Branches (Default)**
- Shows value for each branch separately
- Includes grand total across all branches
- Ask AI: "What is our inventory worth?"

**Specific Branch**
- Focus on a single branch
- Ask AI: "Show me stock value for London Warehouse"
- Ask AI: "What's the inventory value at Store 1?"

**Branch Access Required**
- You can only view stock value for branches you're assigned to
- Contact admin if you need access to other branches

### By Time Period

**Current Snapshot Only**
- Stock valuation is always real-time
- Reflects current inventory levels
- No historical trend analysis yet

**Future Feature:**
- Historical stock value tracking
- Month-over-month trends
- Valuation changes over time

## Interpreting Stock Value

### High Stock Value

**What it means:**
- Large inventory investment
- High product diversity or high unit costs
- Potentially strong sales capacity

**Considerations:**
- Is the value appropriate for sales volume?
- Are you overstocked?
- Is cash tied up unnecessarily?
- Check stock turnover rates

**Actions:**
- Review slow-moving products
- Consider reducing order quantities
- Transfer excess stock to higher-demand branches

### Low Stock Value

**What it means:**
- Lean inventory
- Lower financial risk
- Potentially insufficient stock to meet demand

**Considerations:**
- Are you frequently out of stock?
- Is this intentional (just-in-time inventory)?
- Do you have enough safety stock?

**Actions:**
- Review stock levels vs demand
- Check for recent stockouts
- Consider increasing safety stock for key products

### Uneven Distribution Across Branches

**What it means:**
- One branch holds most of the value
- Other branches may be understocked

**Example:**
```
Main Warehouse: £50,000 (80% of total)
Store 1: £8,000 (13%)
Store 2: £4,500 (7%)
───────────────────────
Grand Total: £62,500
```

**Actions:**
- Evaluate if distribution matches demand
- Consider rebalancing via stock transfers
- Analyze sales by branch to optimize allocation

### Zero Value Despite Having Stock

**Possible Causes:**
1. **No unit cost recorded** - Lots created without `unitCostPence`
2. **All lots consumed** - `qtyRemaining = 0` for all lots
3. **Data integrity issue** - ProductStock shows stock but no lots exist

**Actions:**
- Check stock ledger for the product
- Verify lot creation on stock receipts
- Contact admin if data looks incorrect

## Product Counts

### What Product Count Means

**Definition:**
- Number of distinct products (SKUs) with stock > 0 at a branch

**Example:**
- Product Count = 42 means 42 different products in stock
- Doesn't indicate quantities, just variety

### High Product Count

**What it means:**
- Wide product selection
- Diverse inventory
- Potentially serving many customer needs

**Considerations:**
- Are all products moving?
- Is storage capacity sufficient?
- Are you spreading investment too thin?

**Actions:**
- Identify slow-moving SKUs
- Consider consolidating product range
- Review ABC analysis (high/medium/low value items)

### Low Product Count

**What it means:**
- Focused product range
- Potentially specialized branch
- Lower complexity to manage

**Considerations:**
- Is this intentional specialization?
- Are you missing sales opportunities?
- Do customers want more variety?

**Actions:**
- Review customer requests for unavailable products
- Consider expanding range if demand exists
- Compare to other branches for benchmarking

## Common Questions

### "Why is my stock value different from my colleague's?"

**Reason:** Branch membership filtering
- Each user sees totals for their assigned branches only
- Your colleague may have access to different branches
- Contact admin if you need access to more branches

### "Stock value seems too low - is this correct?"

**Possible Causes:**
1. **No unit costs** - Lots created without cost data (value = £0)
2. **Old data** - Stock not updated recently
3. **Recent consumption** - Large order reduced inventory
4. **Branch access** - You're only seeing a subset of branches

**Actions:**
- Ask AI for specific branch values to isolate the issue
- Check stock levels for key products
- Verify lot costs are being recorded on receipts
- Contact admin to verify data

### "Can I see historical stock value?"

**Not yet:**
- System only provides current snapshot
- Historical tracking not implemented
- Future feature planned

**Workaround:**
- Export stock reports monthly
- Manually track in spreadsheet
- Use stock ledger to trace movements

### "Why doesn't product count match the value?"

**Explanation:**
- Product count is number of SKUs (variety)
- Value is total financial worth (quantity × cost)
- Example: 10 products could be £100 (low value) or £10,000 (high value)

### "Can I export stock valuation to Excel?"

**Not yet:**
- Export functionality not implemented
- Currently view-only through AI chatbot
- Future: CSV/Excel export planned

### "How often is stock value updated?"

**Real-time:**
- Valuation is calculated on demand
- Reflects current stock levels and lot costs
- No caching or delays

## Use Cases

### Monthly Financial Reporting

**Questions to Ask AI:**
1. "What is our inventory worth?"
2. "Show me stock value by branch"
3. "What's the total stock value?"

**What to Report:**
- Grand total stock value
- Breakdown by branch
- Month-over-month change (manual calculation)

### Branch Performance Review

**Questions to Ask AI:**
1. "Show me stock value for Main Warehouse"
2. "How many products do we have at Store 1?"
3. "What's the stock value at London HQ?"

**What to Evaluate:**
- Is stock value appropriate for branch size/sales?
- Is product diversity sufficient?
- Should we rebalance inventory?

### Inventory Audit Preparation

**Questions to Ask AI:**
1. "What is our total inventory worth?"
2. "Show me stock value for each branch"
3. "List all branches with stock"

**What to Document:**
- Pre-audit valuation snapshot
- Branch-by-branch breakdown
- Compare to physical count results

### Insurance Coverage Verification

**Questions to Ask AI:**
1. "What's the total stock value across all branches?"
2. "Show me stock value for Main Warehouse" (highest value branch)

**What to Check:**
- Is insurance coverage sufficient?
- Have valuations increased beyond policy limits?
- Update coverage if needed

### Identifying Overstock/Understock

**Questions to Ask AI:**
1. "What's the stock value at each branch?"
2. "How many products do we have at [Branch]?"

**What to Look For:**
- Disproportionate value at one branch
- Low product counts despite high value (few high-cost items)
- High product counts despite low value (many low-value items)

**Actions:**
- Create stock transfers to rebalance
- Adjust purchasing patterns
- Review demand forecasts

## Stock Valuation vs Stock Levels

### Stock Value (This Guide)

**What it measures:** Financial worth
**How it's calculated:** Quantity × FIFO unit cost
**Use for:** Financial reporting, insurance, audits
**Ask AI:** "What is our inventory worth?"

### Stock Levels (See [Viewing Stock](../inventory/viewing-stock.md))

**What it measures:** Physical quantities
**How it's calculated:** Sum of `qtyOnHand` per product
**Use for:** Order planning, fulfillment, replenishment
**Ask AI:** "Show me stock levels for Product X"

### When to Use Each

**Use Stock Value When:**
- Reporting to finance/accounting
- Calculating working capital
- Planning insurance coverage
- Conducting audits

**Use Stock Levels When:**
- Fulfilling customer orders
- Planning replenishment
- Creating stock transfers
- Managing day-to-day operations

## Permissions Required

**To view stock analytics:**
- No specific permission required (all authenticated users)
- Must be a member of at least one branch
- Can only see valuations for your assigned branches

**Branch Access:**
- Managed through Users page
- Contact admin to request branch membership

## Related Guides

- [Understanding FIFO](../inventory/understanding-fifo.md) - How FIFO costing works
- [Viewing Stock](../inventory/viewing-stock.md) - Check physical stock levels
- [Adjusting Stock](../inventory/adjusting-stock.md) - Receiving and adjustments
- [Stock Reports](../inventory/stock-reports.md) - Ledger and movement reports
- [Managing Branches](../branches-users/managing-branches.md) - Branch setup
- [Transfer Metrics](./transfer-metrics.md) - Transfer performance analytics
