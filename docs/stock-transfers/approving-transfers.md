# Approving Stock Transfers

**What you'll learn:**
- How to review transfer requests
- Approving with full or partial quantities
- When and how to reject transfers
- Multi-level approval workflows

---

## Prerequisites

**You need:**
- `stock:write` permission (Editor role or higher)
- Membership in the source branch (where stock is leaving from)

**Your role:** You're reviewing requests from other branches asking for your stock.

---

## Reviewing a Transfer Request

### Step 1: Find the Transfer

1. Go to **Stock Management** → **Stock Transfers**
2. Click the **Inbound (To My Branches)** tab
3. Look for transfers with status **REQUESTED** (yellow)
4. Urgent transfers (red ⚡) appear at the top

### Step 2: Review the Details

Click on a transfer to see:
- Which branch is requesting stock
- What products they need and how much
- Why they need it (request notes)
- Priority level
- When it was requested

Check your inventory to see if you have the requested quantities available.

---

## Approving a Transfer

### Full Approval (You Have Everything)

1. Click **Review Transfer** button
2. Select **Approve** option
3. Review the quantities - they're pre-filled with what was requested
4. Add optional review notes (e.g., "Approved - shipping tomorrow")
5. Click **Approve Transfer**

**What happens:**
- Status changes to APPROVED (blue)
- You can now ship the items
- Destination branch is notified

### Partial Approval (You Have Some, Not All)

If you don't have enough stock for all requested quantities:

1. Click **Review Transfer** button
2. Select **Approve** option
3. **Adjust the quantities** to what you can provide:
   - Example: They requested 100 units, you approve 60 units
4. To exclude an item entirely, set its quantity to 0
5. Add a note explaining the partial approval
6. Click **Approve Transfer**

**What happens:**
- Status changes to APPROVED (blue)
- You'll only be able to ship the approved quantities
- Destination branch sees the adjusted quantities

**Tips:**
- Be realistic about what you can provide
- Explain in notes why you're approving less
- Destination branch can create another transfer later for the rest

---

## Rejecting a Transfer

If you can't fulfill the request at all:

1. Click **Review Transfer** button
2. Select **Reject** option
3. **Enter a rejection reason** (required):
   - "Insufficient stock - won't have more until next week"
   - "Product discontinued - no longer available"
   - "Branch closed for renovation"
4. Click **Reject Transfer**

**What happens:**
- Status changes to REJECTED (red)
- Transfer cannot proceed further
- Destination branch is notified with your reason
- No stock is moved

---

## Multi-Level Approval

Some transfers require approval from multiple people before proceeding. This happens when an **Approval Rule** matches the transfer conditions.

Approval rules are configured by admins and can trigger based on:
- Transfer value exceeds a threshold (e.g., over £1000)
- Transfer quantity exceeds a limit (e.g., over 100 units)
- Transfer involves specific branches with special rules

**Learn more:** See [Managing Approval Rules](approval-rules.md) for complete guide on creating and configuring rules.

### How It Works

On the transfer detail page, you'll see:

```
Approval Progress
Level 1: Manager - APPROVED ✓ (by Alice, Jan 15)
Level 2: Director - PENDING ⏳ (waiting for Bob)
Level 3: Finance - PENDING ⏳ (waiting for Carol)
```

### Your Role

**If you're an authorized approver for a level:**
1. You'll see **Approve Level X** and **Reject Level X** buttons
2. Review the transfer details
3. Click the appropriate button for your level
4. Add any notes
5. Submit your decision

**If all levels are approved:** Status → APPROVED (ready to ship)

**If any level is rejected:** Status → REJECTED (entire transfer stops)

**If you're not an approver:**
- You'll see the progress but no action buttons
- Wait for the designated approvers to act
- Contact your manager if stuck

---

## Common Questions

**Q: Can I approve more than what was requested?**
A: No. You can only approve up to the requested quantity. If the destination needs more, they should create a new transfer.

**Q: What if I approve it but later realize I don't have the stock?**
A: You can ship partial quantities. See [Shipping Transfers](shipping-transfers.md) for details.

**Q: Can I change my approval decision?**
A: No. Once approved or rejected, the decision is final. Contact your admin if you made a mistake.

**Q: Why don't I see the Review Transfer button?**
A: Either you're not a member of the source branch, or the transfer is no longer in REQUESTED status.

**Q: How long do I have to approve a request?**
A: There's no automatic timeout, but urgent transfers should be reviewed quickly. Check transfers daily to keep operations moving.

**Q: What if the requester made a mistake in their request?**
A: Reject the transfer with a note explaining the issue. They can create a corrected request.

---

## What Happens Next?

After you approve a transfer:

1. Status is **APPROVED** (blue)
2. You or another member of your branch ships the items
3. Stock is deducted when shipping
4. Destination branch receives and confirms
5. Transfer is completed

See [Shipping Transfers](shipping-transfers.md) for next steps.

---

## Related Guides

- [Overview](overview.md) - Understanding the transfer workflow
- [Managing Approval Rules](approval-rules.md) - Configure automated approval workflows
- [Shipping Transfers](shipping-transfers.md) - How to ship after approving
- [Creating Transfers](creating-transfers.md) - How transfers are created

---

## Need More Help?

Contact your admin or ask the chat assistant.