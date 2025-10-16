# Adjusting Stock Levels

## When to Adjust Stock

Manual stock adjustments are used to correct inventory when:

- **Damaged goods** discovered during receiving or storage
- **Theft or shrinkage** found during cycle counts
- **Overages** discovered during physical inventory audits
- **Data entry errors** that need correction
- **Spoilage or expiration** (food, chemicals, etc.)

**Note**: Normal stock movements (receiving from suppliers, transfers between branches) should use their dedicated workflows, not manual adjustments.

## How to Adjust Stock

### Step 1: Navigate to Product

1. Go to the Products page
2. Find the product you need to adjust
3. Click on the product name

### Step 2: Open Adjustment Dialog

Look for the **"Adjust Stock"** button (typically in the Stock Levels tab or actions menu).

### Step 3: Enter Adjustment Details

**For Increasing Stock (+)**:

Fill in:
- **Branch** - Where you're adding stock
- **Quantity** - Positive number (e.g., 20)
- **Unit Cost** - Required! Cost per unit in pounds (e.g., 12.50 for £12.50)
- **Reason** - Optional but recommended (e.g., "Found during audit")

Click **Submit**.

**What Happens:**
- Creates a new stock lot at the specified branch
- Lot has today's date (becomes newest lot for FIFO)
- Increases "On Hand" quantity
- Creates ADJUSTMENT ledger entry

**Example:**
```
Quantity: +50
Unit Cost: £13.00
Reason: "Overages found during cycle count"

Result: New lot created with 50 units @ £13.00
```

**For Decreasing Stock (-)**:

Fill in:
- **Branch** - Where you're removing stock
- **Quantity** - Negative number (e.g., -10)
- **Reason** - Strongly recommended (e.g., "5 units damaged, 5 units stolen")

Click **Submit**.

**What Happens:**
- Uses FIFO to remove stock from oldest lots first
- Decreases "On Hand" quantity
- Creates ADJUSTMENT ledger entries (one per lot consumed)
- Reason stored for audit trail

**Example:**
```
Quantity: -75
Reason: "Damaged during warehouse reorganization"

Result:
- 50 units removed from oldest lot (Jan 1)
- 25 units removed from next lot (Jan 5)
- Total inventory reduced by 75
```

## Important Rules

### Validation Rules

- **Cannot go negative**: System prevents adjustments that would reduce total stock below zero
- **Quantity cannot be zero**: Must adjust by at least 1 unit
- **Unit cost required for increases**: System needs to know the cost basis for new inventory
- **Branch membership enforced**: You must be a member of the branch you're adjusting

### FIFO Behavior

When decreasing stock:
- System automatically uses FIFO (oldest lots first)
- You don't choose which lots to remove
- Multiple ledger entries created if adjustment spans multiple lots

**Example:**

Current lots:
- Lot A: 40 units @ £10.00 (Jan 1)
- Lot B: 100 units @ £11.00 (Jan 10)

Adjustment: -60 units

Result:
- Lot A fully consumed (40 units)
- Lot B reduced by 20 units (now 80 remaining)
- Two ledger entries: ADJUSTMENT (-40, Lot A), ADJUSTMENT (-20, Lot B)

## Permissions Required

To adjust stock, you need:
- **`stock:write`** permission
- **Branch membership** for the branch you're adjusting

Contact your admin if you don't have access.

## Best Practices

### Always Provide Reasons

Even though reasons are optional, **always document why** you're adjusting:

✅ Good reasons:
- "10 units damaged during receiving - pallet dropped"
- "Cycle count found 15 extra units"
- "3 units stolen during break-in on Jan 5"
- "Correcting data entry error from PO-2025-042"

❌ Vague reasons:
- "Adjustment"
- "Fix"
- "Correction"

### Document Before Adjusting

Take photos or notes of physical issues before making adjustments, especially for:
- Insurance claims (theft, damage)
- Vendor credits (receiving damage)
- Internal accountability

### Small, Frequent Adjustments

Instead of one large adjustment, break it down:
- Adjust as you discover issues
- Makes audit trail clearer
- Easier to track patterns (e.g., specific storage area has high damage rate)

### Use Correct Unit Costs

When increasing stock, use the actual cost you paid:
- Check your purchase order or invoice
- Use current market price if cost unknown
- Don't guess - accurate costs matter for reporting

## Viewing Adjustment History

All adjustments are recorded in the Stock Ledger:

1. Navigate to: **Product → Stock Movements tab**
2. Filter by movement type: **ADJUSTMENT**
3. Review:
   - Who made the adjustment
   - When it was made
   - Quantity changed
   - Reason provided

## Common Scenarios

### Scenario 1: Damaged Goods During Receiving

You receive 100 units of Coffee Beans, but 5 are damaged.

**Correct approach:**
1. Receive full 100 units normally (creates lot with 100 units)
2. Immediately adjust -5 units with reason "Damaged during receiving"
3. Note PO number for vendor credit

### Scenario 2: Physical Count Discrepancy

Cycle count shows 85 units, but system shows 100.

**Correct approach:**
1. Investigate first (recent transfers? Unreported damage?)
2. If true discrepancy, adjust -15 units
3. Reason: "Cycle count Jan 15 - units not found, shrinkage suspected"

### Scenario 3: Data Entry Error

Someone accidentally entered 1000 units instead of 100.

**Correct approach:**
1. Adjust -900 units
2. Reason: "Correcting data entry error from PO-2025-XXX - should be 100 not 1000"
3. Note who made original error for training

### Scenario 4: Found Inventory

During warehouse reorganization, you find 20 units of a product that wasn't in the system.

**Correct approach:**
1. Adjust +20 units
2. Provide unit cost (estimate current market value if unknown)
3. Reason: "Found during warehouse reorganization in Aisle 5B - not previously recorded"

## Troubleshooting

**"Cannot adjust - would result in negative stock"**
- Check current stock levels
- You may have entered a larger quantity than available
- Verify you're adjusting the correct branch

**"Unit cost required"**
- For positive adjustments, you must specify cost
- Check your invoice or PO for the correct cost
- If unknown, use current market price

**"Permission denied"**
- You need `stock:write` permission
- You must be a member of the branch
- Contact your admin to request access

**"Cannot find product"**
- Verify product exists and isn't archived
- Check you're in the correct tenant
- Ensure you have access to view this product

## Quick Reference

| Action | Quantity | Cost Required? | Effect |
|--------|----------|----------------|--------|
| Add stock | Positive (+) | Yes | Creates new lot |
| Remove stock | Negative (-) | No | Uses FIFO to consume lots |
| Reason | - | Recommended | Documents why in ledger |

**Related Guides:**
- [Understanding FIFO](./understanding-fifo.md) - How lot consumption works
- [Viewing Stock](./viewing-stock.md) - Checking current levels and lots
- [Stock Reports](./stock-reports.md) - Analyzing adjustment patterns
