# Creating Stock Transfers

**What you'll learn:**
- How to create a new transfer request
- What information you need
- Setting priorities and adding notes
- Using templates to save time

---

## Prerequisites

**You need:**
- `stock:write` permission (Editor role or higher)
- Membership in the appropriate branch (depends on transfer type - see below)

**You'll need to know:**
- Whether you're sending (PUSH) or requesting (PULL) stock
- Which branch has the stock (source)
- Which branch needs the stock (destination)
- What products and how much of each

---

## Creating a Transfer Request

### Step 1: Start New Transfer

1. Go to **Stock Management** → **Stock Transfers** in the sidebar
2. Click **New Transfer Request** button (top right)

### Step 2: Choose Initiation Type

Select how you're initiating this transfer:

**PUSH (Send Stock):**
- Choose this when you're proactively sending stock to another branch
- You must be a member of the source branch
- Common scenarios: Warehouse distributing to stores, rebalancing inventory
- The destination branch will approve your shipment

**PULL (Request Stock):**
- Choose this when you need to request stock from another branch
- You must be a member of the destination branch
- Common scenarios: Store requesting restock, emergency stock-out
- The source branch will approve your request

**Not sure which to choose?**
- If you HAVE the stock and want to send it → Choose PUSH
- If you NEED the stock and want to request it → Choose PULL

### Step 3: Select Branches

The branch selection labels change based on your initiation type:

**For PUSH transfers:**
1. **From Branch (Sending)**: Select your branch (where stock is leaving)
2. **To Branch (Receiving)**: Select the destination branch

**For PULL transfers:**
1. **Request From Branch**: Select where you want stock from
2. **To My Branch (Receiving)**: Select your branch (where stock is going)

### Step 4: Add Items

1. Click **Add Item** button
2. Search for the product you need
3. Enter the quantity you're requesting
4. Repeat for each product you need

**Tips:**
- You must add at least one item
- You can add multiple items to one transfer
- Use the search box to quickly find products
- Quantities must be whole numbers

### Step 5: Set Priority (Optional)

Choose how urgent this transfer is:

- **URGENT**: Stock-out emergency (red)
- **HIGH**: Promotional event or high demand (orange)
- **NORMAL**: Regular replenishment (default, blue)
- **LOW**: Overstock redistribution (gray)

The source branch will see urgent transfers first when reviewing requests.

### Step 6: Add Request Notes (Optional)

Add a note explaining why you need this transfer:
- "Low stock - expecting busy weekend"
- "New product launch on Friday"
- "Redistributing excess inventory"

This helps the source branch understand your needs and prioritize.

### Step 7: Submit Request

Click **Create Transfer Request**

**What happens:**
- Transfer is created with status REQUESTED (yellow)
- Transfer number is assigned (e.g., TRF-2025-001)
- The reviewing party is notified:
  - **PUSH:** Destination branch reviews your shipment
  - **PULL:** Source branch reviews your request
- You can view it in your transfers list (filter by "Initiated by me" to see transfers you created)

---

## Using Templates

If you regularly transfer the same products between the same branches, save time with templates.

### Create from Template

1. Click **New Transfer Request**
2. Click **Use Template** button
3. Select a template from the list
4. The form pre-fills with:
   - Source and destination branches
   - Products and default quantities
5. Adjust quantities or change branches if needed
6. Add notes if needed
7. Click **Create Transfer Request**

### When to Use Templates

- Weekly restocking of retail stores
- Monthly inventory rebalancing
- Standard transfers for seasonal products

See [Transfer Templates](transfer-templates.md) for how to create and manage templates.

---

## Common Questions

**Q: Should I use PUSH or PULL?**
A: It depends on who has authority to initiate:
- Use PUSH if you control the source branch and want to send stock
- Use PULL if you control the destination branch and need to request stock

**Q: Can I create a transfer if I'm not a member of the initiating branch?**
A: No. For PUSH, you must be in the source branch. For PULL, you must be in the destination branch.

**Q: Can I change the initiation type after creating?**
A: No, the initiation type is set when you create the transfer and cannot be changed. If you need to switch, cancel and create a new transfer.

**Q: What if I'm not sure how much I need?**
A: Enter your best estimate. The approving party can adjust quantities if needed. You can also create another transfer later.

**Q: Can I edit a transfer after creating it?**
A: You can change the priority while it's in REQUESTED status. To change items or quantities, you'll need to cancel and create a new transfer.

**Q: How long does approval take?**
A: This depends on your organization's workflow. Urgent transfers are typically reviewed first. The approving party receives notifications of new requests.

---

## What Happens Next?

After you create a transfer:

1. Status is **REQUESTED** (yellow)
2. The reviewing party evaluates your transfer:
   - **PUSH:** Destination branch reviews your shipment proposal
   - **PULL:** Source branch reviews your stock request
3. They either:
   - **Approve** it (with quantities they can provide)
   - **Reject** it (with a reason)
4. If approved, source branch ships the items
5. Destination branch receives the items and confirms receipt

---

## Related Guides

- [Overview](overview.md) - Understanding the transfer workflow
- [Approving Transfers](approving-transfers.md) - If you need to approve requests
- [Transfer Templates](transfer-templates.md) - Save time with templates
- [Transfer Priorities](overview.md#priority-levels) - When to use each priority level

---

## Need More Help?

Contact your admin or ask the chat assistant.