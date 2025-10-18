# Understanding FIFO (First-In-First-Out)

## What is FIFO?

FIFO (First-In-First-Out) is the inventory method used throughout the system. It means the oldest stock is always used first, matching real-world best practices for inventory management.

## Why FIFO Matters

**Accurate Costs**: When you sell or transfer products, the system uses the actual cost of the oldest stock first, giving you accurate profit calculations.

**Real-World Practice**: FIFO matches how most warehouses operate - using older stock before newer stock prevents spoilage and obsolescence.

**Better Reporting**: Your inventory value and cost of goods sold (COGS) reflect true economic reality.

## How FIFO Works

### Stock Lots

Every time you receive inventory, the system creates a "stock lot" that tracks:

- **Quantity received** - How many units came in
- **Quantity remaining** - How many are still available
- **Unit cost** - The price per unit (e.g., £12.00)
- **Received date** - When this lot was received

**Example:**

You receive 100 units of Coffee Beans on January 1st at £12.00/unit:
- Lot created with 100 units remaining
- Cost locked in at £12.00/unit
- Received date: January 1st

### Automatic FIFO Consumption

When stock is used (via transfers or consumption), the system automatically:

1. Sorts all lots by received date (oldest first)
2. Takes from the oldest lot until it's depleted
3. Moves to the next oldest lot
4. Continues until the full quantity is fulfilled

**Example:**

You have three lots of Coffee Beans:
- Lot A: 50 units @ £12.00 (Jan 1)
- Lot B: 200 units @ £13.00 (Jan 5)
- Lot C: 150 units @ £12.50 (Jan 10)

If you need to ship 150 units:
1. Take all 50 from Lot A (oldest)
2. Take 100 from Lot B (next oldest)
3. Lots C and remaining B are left for future use

Your cost for this shipment:
- (50 × £12.00) + (100 × £13.00) = £1,900
- Average: £12.67 per unit

## Viewing FIFO Lot Information

### On Product Pages

Navigate to any product and view the "Stock Levels" tab to see:

- **Total quantity on hand** at each branch
- **Individual lots** with:
  - Quantity remaining
  - Unit cost
  - Received date (older dates = used first)
  - Source reference (PO or transfer)

### On Transfer Pages

When creating or viewing transfers, you can see:

- **Available stock** before shipping
- **Lot breakdown** showing which lots were consumed
- **Average cost** calculated using FIFO

## FIFO and Stock Adjustments

When you manually adjust stock:

**Increasing Stock (+)**:
- Creates a new lot with today's date and the cost you specify
- This lot becomes the "newest" and will be used last

**Decreasing Stock (-)**:
- Uses FIFO to remove from oldest lots first
- Preserves accurate cost tracking even for adjustments

## FIFO and Transfer Reversals

**What Makes Reversals Special:**

When you reverse a completed transfer, the system doesn't just add stock back - it **restores stock to the exact same lots** it came from. This is crucial for maintaining FIFO accuracy.

**How It Works:**

1. **Original Transfer** consumes stock via FIFO (oldest first)
   - The system tracks which specific lots were used
   - Records lot IDs, quantities consumed, and original received dates

2. **Reversal** restores stock to those exact lots
   - Same lot IDs (not new lots)
   - Same received dates (FIFO age preserved)
   - Same unit costs (accurate cost tracking)

**Example:**

You have Coffee Beans:
- Lot A: 100 units @ £12.00 (Dec 1)
- Lot B: 50 units @ £13.00 (Dec 15)

Transfer 120 units to Store (Dec 20):
- Consumes all 100 from Lot A (oldest)
- Consumes 20 from Lot B (next oldest)
- You now have: Lot B with 30 units remaining

Reverse the transfer (Jan 5):
- Stock returns to Lot A: **100 units @ £12.00 (Dec 1)** ← Original date preserved!
- Stock returns to Lot B: 50 units @ £13.00 (Dec 15) ← Fully restored
- FIFO order maintained: Lot A is still oldest, will be used first

**Why This Matters:**

✅ **Accurate Aging**: Reversed stock maintains its true age - 2-month-old stock stays 2 months old
✅ **Cost Integrity**: No artificial cost averaging - costs stay exactly as they were
✅ **True FIFO**: Oldest stock remains oldest, preventing FIFO queue disruption
✅ **Audit Trail**: Can trace stock back to original receipt date and cost

## Cost Calculations

The system tracks costs automatically:

- **Current inventory value**: Sum of (qty remaining × unit cost) across all lots
- **Transfer costs**: Calculated using FIFO when lots are consumed
- **Average costs**: Weighted average based on actual lot costs used

**You don't need to manually calculate anything** - the system handles FIFO automatically.

## Key Takeaways

✅ Oldest stock is always used first
✅ Costs are tracked accurately per lot
✅ You can view lot details on product pages
✅ FIFO happens automatically during transfers and consumption
✅ Manual adjustments also follow FIFO rules
✅ Transfer reversals restore stock to original lots (preserving FIFO age)
✅ Reversed stock maintains its original received date and cost

FIFO ensures your inventory and financial reports are accurate and compliant with standard accounting practices. The lot restoration feature on reversals maintains this accuracy even when operations are undone.
