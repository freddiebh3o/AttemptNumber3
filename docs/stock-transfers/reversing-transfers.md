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
- Stock is removed using FIFO (oldest lots first)

**Original Source Branch:**
- Stock is **restored to the exact same lots** it came from
- Example: Had 50 widgets → now has 150 widgets
- **Important:** Items return to their original lots, NOT as new inventory

**Lot Restoration (FIFO Preservation):**

When a transfer is reversed, the system intelligently restores stock to maintain FIFO accuracy:

- **Original lot IDs are preserved** - stock returns to the same lots it came from
- **Received dates stay the same** - FIFO age is unchanged (older stock remains older)
- **Unit costs are preserved** - maintains accurate cost accounting
- **FIFO order is maintained** - reversal doesn't disrupt the FIFO queue

**Example:**

Original Transfer (Jan 10):
- Warehouse had 3 lots:
  - Lot A: 100 units @ £10.00 (received Dec 1)
  - Lot B: 50 units @ £12.00 (received Dec 15)
  - Lot C: 75 units @ £11.00 (received Dec 20)
- Transfer ships 120 units → consumes all of Lot A + 20 from Lot B via FIFO
- Warehouse now has:
  - Lot B: 30 units remaining (Dec 15)
  - Lot C: 75 units (Dec 20)

Reversal (Jan 20):
- Stock returns to Warehouse and **restores original lots**:
  - Lot A: **100 units @ £10.00 (Dec 1)** ← Fully restored with original date!
  - Lot B: **50 units @ £12.00 (Dec 15)** ← Restored to full quantity
  - Lot C: 75 units @ £11.00 (Dec 20) ← Unchanged
- FIFO order preserved: Lot A is still oldest, will be used first in future transfers
- **No new lots created** - stock returns to its original location in the FIFO queue

This ensures:
- ✅ Accurate cost tracking (costs don't get artificially re-averaged)
- ✅ True FIFO age (older inventory stays older)
- ✅ Audit trail accuracy (can trace stock back to original receipt)
- ✅ Reversible operations (reversing a reversal restores to previous state)

---

## Audit Trail

All reversals are comprehensively tracked:

**Transfer Level:**
- Both transfers show who initiated the reversal
- Both transfers show when reversal occurred
- Reversal reason is stored in notes
- Bidirectional links between original and reversal transfers

**Stock Ledger:**
- Destination branch: Shows deductions with kind **"REVERSAL"** (not "CONSUMPTION")
- Source branch: Shows additions with kind **"REVERSAL"** (not "RECEIPT")
- Ledger entries include reference to transfer number
- Reversal reason appears in ledger for traceability

**Key Difference:**
- Normal transfers create **RECEIPT** entries at destination
- Reversals create **REVERSAL** entries at source (where stock returns)
- This distinction helps identify reversed stock in reports and audits

**Example audit trail:**
```
Jan 15: Transfer TRF-001 completed (Warehouse → Store #5)
        - Warehouse: CONSUMPTION ledger entry (-120 units)
        - Store #5: RECEIPT ledger entry (+120 units)

Jan 20: Transfer TRF-001 reversed by Alice
        - Store #5: REVERSAL ledger entry (-120 units, "Reversal of TRF-001")
        - Warehouse: REVERSAL ledger entry (+120 units, "Reversal of TRF-001")

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

**Q: Does reversed stock create new lots?**
A: No! This is a key feature. Reversed stock returns to the **exact same lots** it came from, preserving FIFO age and cost. You won't see new lots created - the original lots simply get their quantities restored.

**Q: What happens to FIFO order when I reverse a transfer?**
A: FIFO order is perfectly preserved. Stock returns to its original position in the FIFO queue with the same received dates. Older stock remains older, maintaining accurate cost tracking and aging.

**Q: How can I tell if stock came from a reversal?**
A: Check the stock ledger - you'll see "REVERSAL" entries (not "RECEIPT"). The ledger entry will reference the original transfer number (e.g., "Reversal of transfer TRF-001").

**Q: What happens if the original source branch doesn't have space for returned items?**
A: Stock is added regardless of capacity. Branch managers should monitor inventory levels.

**Q: Can I cancel a reversal after clicking the button?**
A: No. Reversal happens immediately and cannot be undone. If you reversed by mistake, reverse the reversal to restore stock.

**Q: Why don't I see the Reverse Transfer button?**
A: Either the transfer isn't in COMPLETED status, or you're not a member of the destination branch.

**Q: Does reversing a transfer notify anyone?**
A: Both branches see the new reversal transfer in their transfers list. Check if your organization has notifications configured.

**Q: What if I reversed stock but then received new stock at the same cost?**
A: The reversed stock and new stock will be in separate lots with different received dates. The reversed stock will have its original (older) received date, so it will still be used first via FIFO.

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