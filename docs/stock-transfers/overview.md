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

The transfer process has four main steps:

### 1. Request (Destination Branch)
The branch that needs stock creates a transfer request listing what products and quantities they need.

### 2. Approve (Source Branch)
The branch that has the stock reviews the request and either approves it (with quantities they can provide) or rejects it.

### 3. Ship (Source Branch)
The source branch ships the approved items. Stock is deducted from their inventory at this stage.

### 4. Receive (Destination Branch)
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

**Branch requirements:**
- **Request transfers:** Must be member of destination branch (where stock is going)
- **Approve/ship transfers:** Must be member of source branch (where stock is leaving)
- **Receive transfers:** Must be member of destination branch

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
- [Receiving Transfers](receiving-transfers.md)
- [Transfer Templates](transfer-templates.md)
- [Reversing Transfers](reversing-transfers.md)

---

## Need More Help?

Contact your admin or ask the chat assistant.