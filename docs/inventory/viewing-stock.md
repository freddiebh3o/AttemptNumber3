# Viewing Stock Levels

## Overview

You can view current stock levels across all branches, see individual lot details, and track inventory movements through the system.

## Viewing Stock on Product Pages

### Step 1: Navigate to Product

1. Go to the Products page from the main menu
2. Find the product you want to check (use search or browse)
3. Click on the product name

### Step 2: View Stock Levels Tab

Click the **"Stock Levels"** tab to see:

**Summary Information:**
- **Quantity On Hand** - Total available units at each branch
- **Quantity Allocated** - Reserved stock (for future use)
- **Open Lots** - Number of active stock lots at this branch

**Branch Breakdown:**
- Separate row for each branch where this product has stock
- Quick glance at which locations have inventory

### Step 3: View Lot Details (Optional)

Click on a branch row to expand and see individual lots:

**Each lot shows:**
- **Quantity remaining** (out of original received quantity)
- **Unit cost** (price per unit, e.g., £12.00)
- **Received date** (determines FIFO order)
- **Source reference** (if available - PO number or transfer ID)

**Example:**

```
Coffee Beans - Main Warehouse

Total On Hand: 425 units | Allocated: 50 units | Open Lots: 3

Lot 1: 75 units @ £12.00/unit (received Jan 1, 2025)
Lot 2: 200 units @ £13.00/unit (received Jan 5, 2025)
Lot 3: 150 units @ £12.50/unit (received Jan 10, 2025)
```

## Viewing Stock During Transfers

When creating or reviewing stock transfers, stock levels are displayed automatically:

### While Creating Transfers

1. Select the source branch (where stock comes from)
2. Select the destination branch
3. Add products to the transfer
4. **Available stock** shows next to each product
5. System prevents you from requesting more than available

### While Approving Transfers

1. Review the requested quantity
2. Check available stock at source branch
3. Approve full or partial quantity based on availability

### While Shipping Transfers

1. System shows available stock before shipping
2. View which specific lots will be consumed (FIFO order)
3. See the cost breakdown per lot

## Viewing Stock Movements (Ledger)

Track the history of all stock changes:

### Accessing the Ledger

Navigate to: **Product Detail → Stock Movements tab** (or via API)

### What You'll See

Each entry shows:
- **Movement type**:
  - RECEIPT - Stock received into inventory
  - CONSUMPTION - Stock used/transferred out
  - ADJUSTMENT - Manual correction
  - REVERSAL - Undoing previous movement (future)
- **Quantity change** (+ or -)
- **Date and time**
- **User** who performed the action
- **Reason** (if provided)
- **Related lot** (which lot was affected)

### Filtering the Ledger

You can filter by:
- **Branch** - Show movements at specific location
- **Date range** - View activity within timeframe
- **Movement type** - Only receipts, only consumption, etc.
- **Quantity range** - Find large movements (e.g., > 100 units)

### Example Ledger View

```
Product: Coffee Beans | Branch: Main Warehouse

Jan 10, 2025 | RECEIPT    | +150 units | John Smith | "PO-2025-003 received"
Jan 8, 2025  | CONSUMPTION | -50 units  | Jane Doe   | "Transfer TRF-2025-0042"
Jan 5, 2025  | RECEIPT    | +200 units | John Smith | "PO-2025-002 received"
Jan 3, 2025  | CONSUMPTION | -80 units  | Jane Doe   | "Transfer TRF-2025-0035"
Jan 1, 2025  | RECEIPT    | +100 units | John Smith | "PO-2025-001 received"
```

## Bulk Stock Viewing

For efficiency, you can view stock across multiple branches at once:

### Using Bulk API Endpoint

Developers/reports can call: `GET /api/stock/levels/bulk?productId=...`

This returns:
- All branches' stock levels for a product
- Lot details included
- Single API call (faster than checking each branch individually)

## Understanding Stock Status Indicators

**On Hand (Green)** - Available for use
**Allocated (Yellow)** - Reserved but not yet shipped
**In Transit (Blue)** - Currently being transferred (future enhancement)
**Low Stock (Red)** - Below reorder threshold (future)

## Refresh Stock Data

Stock levels update automatically when:
- Transfers are shipped or received
- Manual adjustments are made
- New receipts are created

Click the **Refresh** button on the Stock Levels tab to get the latest data.

## Permissions Required

To view stock levels, you need:
- **`stock:read`** permission
- **Branch membership** for the branches you want to view

If you can't see stock for a branch, contact your admin to add you as a member.

## Tips for Effective Stock Viewing

✅ Check stock levels BEFORE creating transfers to avoid over-requesting
✅ Use the ledger to investigate discrepancies or unexpected changes
✅ Expand lot details to understand cost basis and age of inventory
✅ Filter the ledger by date range when reconciling inventory counts
✅ Review "Allocated" quantities to understand committed stock

## Quick Reference

| What You Want | Where to Look |
|---------------|---------------|
| Total stock at branches | Product → Stock Levels tab |
| Individual lot details | Product → Stock Levels → Expand branch |
| Stock movement history | Product → Stock Movements tab |
| Available stock for transfer | Transfer creation page (auto-displayed) |
| Stock across all branches | Bulk API endpoint |

Need to adjust stock levels? See [Adjusting Stock](./adjusting-stock.md).
