# Reversing Stock Transfers

**What you'll learn:**
- When and why to reverse a transfer
- How to reverse a completed transfer
- What happens to inventory
- Tracking reversed transfers

---

## What Is a Reversal?

A reversal undoes a completed transfer by automatically creating a new transfer in the opposite direction with the same items and quantities.

**Example:**
```
Original Transfer:
Warehouse → Store #5 (100 widgets, 50 gizmos) [COMPLETED]

Reversal Creates:
Store #5 → Warehouse (100 widgets, 50 gizmos) [COMPLETED immediately]
```

---

## When to Reverse a Transfer

**Common scenarios:**
- **Wrong destination:** Items were sent to the wrong branch
- **Defective products:** Items need to be returned to warehouse
- **Customer returns:** Products returned to store need to go back to warehouse
- **Overstock correction:** Sent too many units by mistake
- **Cancelled order:** Items no longer needed at destination

---

## Prerequisites

**You need:**
- `stock:write` permission (Editor role or higher)
- Membership in the destination branch of the ORIGINAL transfer (where items were received)
- Transfer must be in **COMPLETED** status (green)

**Important:** Only completed transfers can be reversed. Transfers in other statuses cannot be reversed - cancel or adjust them instead.

---

## How to Reverse a Transfer

### Step 1: Find the Transfer

1. Go to **Stock Management** → **Stock Transfers**
2. Look for the completed transfer you want to reverse
3. Click on it to open details

### Step 2: Initiate Reversal

1. Click **Reverse Transfer** button (orange)
2. Review the reversal summary:
   - Shows original transfer details
   - Shows what will be reversed (all items that were received)
   - Shows new transfer direction (destination → source)

### Step 3: Confirm Reversal

1. **Optional:** Enter a reason for reversal
   - "Items were defective"
   - "Wrong branch - should have gone to Store #3"
   - "Customer returned products"
2. Click **Reverse Transfer** button

**What happens immediately:**
- New transfer is created in opposite direction
- New transfer is **auto-approved** (no manual approval needed)
- New transfer is **auto-shipped** (no manual shipping needed)
- New transfer status is **COMPLETED** immediately
- Stock is moved automatically:
  - Deducted from original destination
  - Added back to original source

---

## Understanding the Reversal Transfer

### What's Automatically Created

The reversal creates a brand new transfer with:

| Field | Value |
|-------|-------|
| **Source** | Original destination branch |
| **Destination** | Original source branch |
| **Items** | Exact same products and quantities received |
| **Status** | COMPLETED (immediately) |
| **Link** | Shows "This is a reversal of TRF-XXX" |

### Original Transfer Changes

The original transfer gets:
- Badge showing "This transfer has been reversed by TRF-XXX"
- Link to the reversal transfer
- Remains in COMPLETED status (not changed)

### Navigation

You can navigate between linked transfers:
- Original transfer → click "View reversal" → see reversal transfer
- Reversal transfer → click "View original" → see original transfer

---

## Inventory Impact

**Immediate stock changes:**

**Original Destination Branch:**
- Stock is deducted for all reversed items
- Example: Had 100 widgets → now has 0 widgets

**Original Source Branch:**
- Stock is added back for all reversed items
- Example: Had 50 widgets → now has 150 widgets

**Cost Basis:**
- Items return with their original cost
- FIFO lots are recreated with original received dates
- Maintains accurate cost accounting

---

## Audit Trail

All reversals are tracked:
- Both transfers show who initiated the reversal
- Both transfers show when reversal occurred
- Reversal reason is stored in notes
- Stock ledger shows movements for both directions

**Example audit trail:**
```
Jan 15: Transfer TRF-001 completed (Warehouse → Store #5)
Jan 20: Transfer TRF-001 reversed by Alice
Jan 20: Transfer TRF-042 created as reversal (Store #5 → Warehouse)
```

---

## Partial Reversals

**Currently not supported.** You must reverse the entire transfer.

**If you only need to return some items:**
1. Don't use reversal
2. Create a new transfer manually
3. Select only the items you're returning
4. Follow normal transfer workflow (request → approve → ship → receive)

---

## Common Questions

**Q: Can I reverse a partially received transfer?**
A: No. Only transfers with status COMPLETED can be reversed. Wait until all items are received.

**Q: What if I only want to return some of the items?**
A: Create a new manual transfer for just those items. Reversal always returns everything.

**Q: Can I reverse a reversal?**
A: Yes. The reversal transfer is a normal completed transfer, so you can reverse it again if needed. This effectively re-does the original transfer.

**Q: What happens if the original source branch doesn't have space for returned items?**
A: Stock is added regardless of capacity. Branch managers should monitor inventory levels.

**Q: Can I cancel a reversal after clicking the button?**
A: No. Reversal happens immediately and cannot be undone. If you reversed by mistake, reverse the reversal to restore stock.

**Q: Why don't I see the Reverse Transfer button?**
A: Either the transfer isn't in COMPLETED status, or you're not a member of the destination branch.

**Q: Does reversing a transfer notify anyone?**
A: Both branches see the new reversal transfer in their transfers list. Check if your organization has notifications configured.

---

## Best Practices

**Before reversing:**
1. **Verify it's the correct transfer** - check transfer number
2. **Confirm with the other branch** - let them know items are coming back
3. **Document the reason** - helps with auditing later
4. **Check inventory impact** - ensure destination has the items to return

**After reversing:**
1. **Verify stock counts** - check both branches show correct inventory
2. **Communicate with teams** - inform relevant people of the reversal
3. **Update any related records** - purchase orders, sales orders, etc.

---

## Example Scenarios

### Scenario 1: Wrong Destination

**Problem:** Transfer sent to Store #5 but should have gone to Store #3

**Solution:**
1. Reverse the transfer (Store #5 → Warehouse)
2. Create new transfer (Warehouse → Store #3)
3. Both transfers complete normally

### Scenario 2: Defective Products

**Problem:** All items received were defective

**Solution:**
1. Reverse the transfer to return items to warehouse
2. Add note: "All units defective - quality issue"
3. Warehouse receives items for inspection/disposal
4. Create new transfer with replacement products

### Scenario 3: Customer Returned Items

**Problem:** Store sold 50 units to customer, customer returned them, store wants to send back to warehouse

**Solution:**
- **Don't use reversal** (only 50 units, not the full transfer)
- Create new manual transfer (Store → Warehouse) for 50 units
- Follow normal transfer workflow

---

## Related Guides

- [Overview](overview.md) - Understanding the transfer workflow
- [Receiving Transfers](receiving-transfers.md) - What happens when reversals arrive
- [Creating Transfers](creating-transfers.md) - How to create manual returns instead

---

## Need More Help?

Contact your admin or ask the chat assistant.