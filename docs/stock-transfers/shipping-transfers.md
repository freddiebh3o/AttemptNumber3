# Shipping Stock Transfers

**What you'll learn:**
- How to ship an approved transfer
- Shipping partial quantities
- What happens to your inventory
- Using barcode scanning for shipping (if enabled)

---

## Prerequisites

**You need:**
- `stock:write` permission (Editor role or higher)
- Membership in the source branch (where stock is leaving from)
- Transfer must be in **APPROVED** status (blue)

**Your role:** You're sending stock from your branch to another branch.

---

## Shipping a Transfer

### Step 1: Find the Transfer

1. Go to **Stock Management** → **Stock Transfers**
2. Click the **Outbound (From My Branches)** tab
3. Look for transfers with status **APPROVED** (blue)
4. Click on the transfer to open details

### Step 2: Review What to Ship

The transfer details show:
- What products to ship
- How many of each (approved quantities)
- Where it's going (destination branch)

### Step 3: Ship All Items

1. Click **Ship Transfer** button
2. Review the shipping quantities (pre-filled with approved amounts)
3. Click **Ship All**

**What happens:**
- Stock is deducted from your inventory using FIFO (oldest stock first)
- **Dispatch note PDF is automatically generated** (branded document with all shipment details)
- Status changes to **IN_TRANSIT** (cyan)
- Destination branch can now receive the items
- Transfer shows as "Shipped" with date and who shipped it

**About the Dispatch Note:**
After shipping, a "View Dispatch Note" button appears on the transfer. Click it to:
- Preview the PDF (shows what was shipped, lot numbers, costs)
- Download the PDF for your records
- Print the PDF to include with the physical shipment

See [Dispatch Notes Guide](dispatch-notes.md) for more details.

---

## Partial Shipments

If you don't have all the approved stock available, you can ship what you have.

### When to Ship Partial

- You approved 100 units but only have 60 in stock
- You need to ship urgent items first, rest later
- Stock is coming in batches

### How to Ship Partial

1. Click **Ship Transfer** button
2. **Adjust quantities** to what you're shipping now:
   - Example: Approved 100, shipping 60
3. Click **Ship Selected Items**

**What happens:**
- Stock is deducted for what you shipped
- Status remains **APPROVED** (not IN_TRANSIT yet)
- Transfer shows "Partial shipment: 60 of 100 shipped"
- You can ship the remaining 40 units later

### Shipping Remaining Items

When more stock arrives:

1. Open the same transfer
2. Click **Ship Remaining Items** button
3. Enter quantities for what you're shipping now
4. Click **Ship**

**When all approved items are shipped:**
- Status changes to **IN_TRANSIT**
- Destination branch can start receiving

---

## Understanding FIFO Stock Consumption

When you ship items, the system automatically uses FIFO (First In, First Out):

**Example:**
You have 100 widgets in stock from three different receipts:
- 40 units received Jan 1 at £5 each
- 30 units received Jan 10 at £6 each
- 30 units received Jan 15 at £7 each

When you ship 50 units:
- System takes all 40 from Jan 1 receipt (£5 each)
- System takes 10 from Jan 10 receipt (£6 each)
- Remaining 20 from Jan 10 and all Jan 15 stock stays in inventory

**Why this matters:**
- Older stock ships first (prevents expiry issues)
- Cost tracking is accurate
- You don't need to choose which stock to ship - it's automatic

---

## Shipment History

If you ship a transfer in multiple batches, each shipment is tracked separately.

**On the transfer detail page, you'll see:**

```
Shipment History
Shipment 1: 60 units shipped on Jan 15, 2025 by Alice
Shipment 2: 40 units shipped on Jan 17, 2025 by Bob
Total: 100 units shipped
```

This helps track when items left your warehouse and who handled them.

---

## Barcode Scanning for Shipping (If Enabled)

If your products have barcodes, you can scan items as you pack them (feature depends on configuration).

### How to Scan While Shipping

1. Click **Scan to Ship** button (if available)
2. Allow camera access on your phone
3. Scan each product's barcode as you pack it
4. See real-time count: "Widget A: 10 scanned (shipping 10)"
5. Click **Ship Scanned Items**

**Benefits:**
- Faster than manual entry
- Reduces errors
- Real-time confirmation of what's being packed

See [Barcode Scanning Guide](../inventory/barcode-scanning.md) for setup details.

---

## Common Questions

**Q: What if I don't have the approved quantity in stock?**
A: Ship what you have using partial shipment. The system will let you ship the rest later. The destination branch will know it's a partial shipment.

**Q: Can I ship more than what was approved?**
A: No. You can only ship up to the approved quantity. If they need more, they should create a new transfer.

**Q: What happens if I make a mistake while shipping?**
A: Contact your admin. If the transfer is completed, you may need to reverse it (see [Reversing Transfers](reversing-transfers.md)).

**Q: Why don't I see the Ship Transfer button?**
A: Either the transfer isn't in APPROVED status yet, or you're not a member of the source branch.

**Q: How long do I have to ship after approving?**
A: There's no automatic deadline, but try to ship within your organization's standard timeframe. Urgent transfers should ship same-day or next-day.

**Q: Can someone else ship a transfer I approved?**
A: Yes. Any member of the source branch with `stock:write` permission can ship approved transfers.

**Q: Will shipping affect my inventory count?**
A: Yes. As soon as you ship, stock is deducted from your branch's inventory. The destination branch will see it added when they receive.

---

## What Happens Next?

After you ship a transfer:

1. Status is **IN_TRANSIT** (cyan) - if all approved items shipped
2. Or status stays **APPROVED** (blue) - if partial shipment
3. Stock is deducted from your inventory
4. Destination branch receives notification
5. They receive and confirm the items
6. Transfer is completed

See [Receiving Transfers](receiving-transfers.md) for what happens at the destination.

---

## Related Guides

- [Overview](overview.md) - Understanding the transfer workflow
- [Approving Transfers](approving-transfers.md) - How to approve before shipping
- [Receiving Transfers](receiving-transfers.md) - What happens at destination
- [Understanding FIFO](../inventory/understanding-fifo.md) - How stock consumption works

---

## Need More Help?

Contact your admin or ask the chat assistant.