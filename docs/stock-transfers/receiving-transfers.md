# Receiving Stock Transfers

**What you'll learn:**
- How to receive incoming stock
- Handling partial receipts
- Using barcode scanning to receive faster
- Dealing with discrepancies

---

## Prerequisites

**You need:**
- `stock:write` permission (Editor role or higher)
- Membership in the destination branch (where stock is arriving)
- Transfer must be in **IN_TRANSIT** or **PARTIALLY_RECEIVED** status

**Your role:** You're receiving stock that was shipped to your branch.

---

## Receiving a Transfer

### Step 1: Find the Transfer

1. Go to **Stock Management** → **Stock Transfers**
2. Click the **Inbound (To My Branches)** tab
3. Look for transfers with status **IN_TRANSIT** (cyan) or **PARTIALLY_RECEIVED** (purple)
4. Click on the transfer to open details

### Step 2: Review What's Expected

The transfer details show:
- What products you should be receiving
- How many of each (shipped quantities)
- Where it came from (source branch)
- When it was shipped

### Step 3: Receive Items

**Method 1: Manual Entry**
1. Click **Receive Items** button
2. For each product, enter the quantity you actually received
3. Verify counts match what was shipped
4. Click **Receive All Items**

**Method 2: Barcode Scanning** (if enabled)
1. Click **Scan to Receive** button
2. Allow camera access on your phone/device
3. Scan each product's barcode as you unpack
4. See real-time count: "Widget A: 10 scanned of 10 expected"
5. Review all scanned items
6. Click **Receive All Scanned Items**

**What happens:**
- Stock is added to your branch's inventory
- Status changes to **COMPLETED** (green) if all items received
- Or status changes to **PARTIALLY_RECEIVED** (purple) if some items still expected
- Transfer shows as "Received" with date and who received it

---

## Partial Receipts

Sometimes you don't receive all items at once. This is normal and the system handles it.

### When This Happens

- Items shipped in multiple batches
- Some items arrived damaged (don't receive damaged units)
- Courier delivered part of the shipment

### How to Handle

1. Click **Receive Items** button
2. **Enter only what you actually received**:
   - Expected 100, received 75 → enter 75
3. Click **Receive Selected Items**

**What happens:**
- Stock is added for what you received (75 units)
- Status becomes **PARTIALLY_RECEIVED** (purple)
- Transfer shows "75 of 100 received"
- You can receive the remaining 25 units later

### Receiving Remaining Items

When the rest arrives:

1. Open the same transfer (status PARTIALLY_RECEIVED)
2. Click **Receive Remaining Items** button
3. Enter quantities for what just arrived
4. Click **Receive**

**When all items are received:**
- Status changes to **COMPLETED** (green)
- Transfer is finished

---

## Barcode Scanning (Fast Receiving)

If your products have barcodes configured, scanning speeds up receiving significantly.

### Using the Scanner

1. Click **Scan to Receive** button
2. Allow camera permission when prompted
3. Hold your phone camera over each product's barcode
4. Hear a beep + see green notification = successful scan
5. Watch counts update in real-time
6. If you scanned wrong item, tap to remove it
7. When done scanning, review the list
8. Click **Receive All Scanned Items**

### Scanner Features

**Real-time feedback:**
```
Widget A: ✓ 10 scanned (expected 10)
Gizmo B: ⚠️ 15 scanned (expected 10) - Over-received
Doohickey C: 5 scanned (expected 10) - Still expecting 5
```

**Error handling:**
- Scanned wrong product? Remove it with the X button
- Product not in transfer? Shows error message
- Over-receiving? Shows warning (you can confirm or adjust)

**Switch to manual:**
- Click **Manual Entry** button if camera stops working
- Your scanned counts are preserved
- You can adjust quantities manually

### Troubleshooting Scans

**Barcode not recognized:**
- Product might not have barcode configured (admin must add it)
- Try different angle or lighting
- Use manual entry instead

**Camera not working:**
- Grant camera permission in browser settings
- Try different browser (Chrome works best)
- Fall back to manual entry

---

## Handling Discrepancies

### You Received Less Than Shipped

**Example:** Transfer says 100 units shipped, you only received 95

**What to do:**
1. Receive only what you got: enter 95
2. Add a note: "5 units missing - box damaged in transit"
3. Contact source branch to clarify
4. Depending on investigation:
   - Source may ship the 5 missing units (new transfer)
   - Or adjust records if items were lost in transit

### You Received More Than Expected

**Example:** Transfer says 10 units shipped, you received 15

**What to do:**
1. System warns you: "Over-receiving detected"
2. Review the items - did you scan correctly?
3. Options:
   - **Receive 10 only** (correct amount) - recommended
   - **Receive all 15** (with confirmation) - only if you're sure
4. Add a note explaining the discrepancy
5. Contact source branch to clarify

### Damaged Items

**If items arrived damaged:**
1. **Don't receive damaged units** - only receive good units
2. Example: 100 shipped, 10 damaged → receive 90
3. Add note: "10 units damaged in transit"
4. Take photos if needed for insurance
5. Contact source branch and logistics team

---

## Common Questions

**Q: What happens if I receive the wrong quantity?**
A: Stock is added based on what you enter. If you made a mistake, contact your admin to adjust inventory and potentially reverse the transfer.

**Q: Can I receive items before they're marked as shipped?**
A: No. Transfer must be in IN_TRANSIT status first. If items arrived but status is still APPROVED, ask the source branch to mark them as shipped.

**Q: How long do I have to receive after items arrive?**
A: Receive as soon as possible after physical delivery. This keeps inventory counts accurate.

**Q: Can someone else receive a transfer that was sent to my branch?**
A: Yes. Any member of the destination branch with `stock:write` permission can receive transfers.

**Q: What if the barcode scanner isn't working?**
A: Use manual entry instead. Click **Manual Entry** button to switch modes.

**Q: Can I partially receive and then receive more later?**
A: Yes. Receive what you got, and the transfer status becomes PARTIALLY_RECEIVED. Receive the rest when it arrives.

**Q: Will receiving affect my inventory count immediately?**
A: Yes. As soon as you receive, stock is added to your branch's inventory.

---

## What Happens Next?

After you receive all items:

1. Status changes to **COMPLETED** (green)
2. Stock is added to your inventory
3. Transfer is finished
4. If needed, you can reverse the transfer later (see [Reversing Transfers](reversing-transfers.md))

---

## Related Guides

- [Overview](overview.md) - Understanding the transfer workflow
- [Shipping Transfers](shipping-transfers.md) - What happens before receiving
- [Reversing Transfers](reversing-transfers.md) - How to undo a completed transfer
- [Barcode Setup](../products/managing-products.md#adding-barcodes) - How to add barcodes to products

---

## Need More Help?

Contact your admin or ask the chat assistant.