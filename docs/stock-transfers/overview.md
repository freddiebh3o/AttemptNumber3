# Stock Transfers Overview

**What you'll learn:**
- What stock transfers are and when to use them
- How the transfer workflow works
- Understanding transfer statuses
- Who can do what with transfers

---

## What Are Stock Transfers?

Stock transfers move inventory between your branches. For example:
- Moving products from your main warehouse to a retail store
- Redistributing overstock from one location to another
- Emergency transfers when a branch runs out of stock

Each transfer tracks exactly what was requested, approved, shipped, and received.

---

## Basic Workflow

Stock transfers can be initiated in two directions depending on your operational needs:

### Transfer Initiation Types

**PUSH (Send Stock):**
- Source branch initiates and sends stock to another branch
- Common for: Warehouses distributing to stores, centralized inventory management
- Process: Source creates → Destination approves → Source ships → Destination receives

**PULL (Request Stock):**
- Destination branch requests stock from another branch
- Common for: Stores requesting restocks, emergency stock-outs
- Process: Destination creates → Source approves → Source ships → Destination receives

You choose the initiation type when creating a new transfer. Both types follow the same four-step process:

### 1. Request
Either the source (PUSH) or destination (PULL) creates a transfer listing products and quantities.

### 2. Approve
The receiving party reviews the request and either approves it (with quantities they can provide) or rejects it.
- **PUSH:** Destination branch approves receipt
- **PULL:** Source branch approves sending

### 3. Ship
The source branch ships the approved items. Stock is deducted from their inventory at this stage. **A dispatch note PDF is automatically generated** for documentation and compliance.

### 4. Receive
The destination branch receives the items. Stock is added to their inventory.

---

## Transfer Statuses

| Status | What It Means | What Happens Next |
|--------|---------------|-------------------|
| **REQUESTED** (Yellow) | Request submitted, waiting for approval | Source branch reviews |
| **APPROVED** (Blue) | Source confirmed quantities | Source branch ships items |
| **REJECTED** (Red) | Source declined request | Transfer stops here |
| **IN_TRANSIT** (Cyan) | Items shipped, traveling | Destination receives items |
| **PARTIALLY_RECEIVED** (Purple) | Some items received, more expected | Destination receives remaining items |
| **COMPLETED** (Green) | All items received | Can be reversed if needed |
| **CANCELLED** (Gray) | Transfer was cancelled | Transfer stops here |

---

## Who Can Do What?

**To perform transfer actions, you need:**
- `stock:write` permission (Editors and above)
- Membership in the relevant branch

**Branch requirements vary by initiation type:**

**PUSH Transfers (Source Initiates):**
- **Create:** Must be member of source branch (where stock is leaving)
- **Approve:** Must be member of destination branch (where stock is arriving)
- **Ship:** Must be member of source branch
- **Receive:** Must be member of destination branch

**PULL Transfers (Destination Requests):**
- **Create:** Must be member of destination branch (where stock is going)
- **Approve:** Must be member of source branch (where stock is leaving)
- **Ship:** Must be member of source branch
- **Receive:** Must be member of destination branch

---

## Priority Levels

Set priority when creating a transfer to indicate urgency:

- **URGENT** (Red ⚡): Stock-out emergency
- **HIGH** (Orange ⬆️): Promotional event or high demand
- **NORMAL** (Blue —): Regular replenishment (default)
- **LOW** (Gray ⬇️): Overstock redistribution

Priority affects how transfers are sorted in the list - urgent transfers appear first.

---

## Key Features

### Templates
Save frequently used transfers as templates to speed up creation. Useful for:
- Weekly restocking of retail stores
- Standard transfers between specific branches
- Common product sets

### Partial Shipments
If you can't ship all approved quantities at once, you can ship what you have. The transfer stays in APPROVED status until all items are shipped.

### Reversal
Made a mistake? Completed transfers can be reversed, automatically creating a new transfer in the opposite direction.

### Barcode Scanning
Speed up receiving by scanning product barcodes instead of manually entering quantities (if your products have barcodes configured).

---

## Common Scenarios

**Emergency Stock-Out:**
1. Store creates URGENT transfer request
2. Warehouse approves immediately
3. Warehouse ships same day
4. Store receives and confirms

**Regular Weekly Restock:**
1. Store uses saved template
2. Adjusts quantities if needed
3. Submits request
4. Warehouse approves and ships on scheduled day
5. Store receives and confirms

**Overstock Redistribution:**
1. Store with excess inventory creates LOW priority transfer to another store
2. Receiving store approves
3. Both stores coordinate pickup
4. Receiving store confirms receipt

---

## Related Guides

- [Creating Transfers](creating-transfers.md)
- [Approving Transfers](approving-transfers.md)
- [Shipping Transfers](shipping-transfers.md)
- [Dispatch Notes (PDFs)](dispatch-notes.md) - View, download, and print shipment documentation
- [Receiving Transfers](receiving-transfers.md)
- [Transfer Templates](transfer-templates.md)
- [Reversing Transfers](reversing-transfers.md)

---

## Need More Help?

Contact your admin or ask the chat assistant.