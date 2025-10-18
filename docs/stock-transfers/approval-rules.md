# Managing Approval Rules

**What you'll learn:**
- What approval rules are and when to use them
- Creating and configuring approval rules
- Managing active and inactive rules
- Archiving and restoring rules
- Understanding approval modes (Sequential, Parallel, Hybrid)
- Troubleshooting common issues

---

## Prerequisites

**You need:**
- `stock:write` permission (Admin role or higher)
- Understanding of your organization's approval workflow requirements

**Your role:** You're configuring automated approval workflows for stock transfers.

---

## What Are Approval Rules?

Approval rules automatically determine when stock transfers require approval before proceeding. Instead of manually reviewing every transfer, you can set up rules that:

- **Trigger based on conditions** (quantity, value, branches)
- **Require specific approvers** (by role)
- **Support multi-level workflows** (Manager → Director → Finance)

### When to Use Approval Rules

**Use approval rules when:**
- High-value transfers need oversight (e.g., over £1000)
- Large quantities need verification (e.g., over 100 units)
- Specific branches have special requirements
- Compliance requires documented approvals
- You want to prevent unauthorized large transfers

**Don't use approval rules when:**
- All transfers can be self-approved
- Your workflow is completely manual
- You have very few transfers
- Rules would slow down critical operations

---

## Creating an Approval Rule

### Step 1: Navigate to Approval Rules

1. Go to **Stock Management** → **Stock Transfers**
2. Click **Approval Rules** tab
3. Click **Create Rule** button

### Step 2: Enter Basic Information

**Rule Name** (required)
- Clear, descriptive name
- Example: "High Value Transfers - Manager Approval"

**Description** (optional but recommended)
- Explain when this rule applies
- Example: "Requires manager approval for transfers over £1000"

**Priority** (required)
- Lower numbers = higher priority
- If multiple rules match, the highest priority (lowest number) wins
- Example: Priority 1 for critical rules, Priority 10 for general rules

**Active Status**
- Toggle ON to activate rule immediately
- Toggle OFF to save as inactive (can activate later)

### Step 3: Configure Conditions

Conditions determine **when** the rule applies. Add one or more:

**Total Quantity Threshold**
- Triggers when total units being transferred exceeds this number
- Example: 100 (any transfer of 100+ units total)

**Total Value Threshold**
- Triggers when total transfer value exceeds this amount (in pence)
- Example: 100000 (£1000.00)
- Value calculated as: sum of (quantity × unit price) for all products

**Specific Source Branch**
- Triggers only for transfers **from** this branch
- Example: Select "Warehouse A" if only outbound from that location needs approval

**Specific Destination Branch**
- Triggers only for transfers **to** this branch
- Example: Select "Retail Store" if only inbound to that location needs approval

**Multiple Conditions:**
- ALL conditions must be met (AND logic)
- Example: Quantity > 100 AND Value > £1000 (both must be true)

### Step 4: Define Approval Levels

Each level represents a person or role that must approve:

**Level 1** (required)
- First approver in the chain
- Example: Manager

**Level 2+** (optional)
- Additional levels for complex workflows
- Example: Director, Finance

**For each level:**

1. **Level Name** (required)
   - Descriptive label shown in UI
   - Example: "Manager Approval", "Director Sign-Off"

2. **Required Role** (required)
   - Which role can approve this level
   - Select from dropdown: ADMIN, OWNER, or custom roles
   - Example: Select "ADMIN" for manager level

3. **Order**
   - Levels processed in numerical order (1, 2, 3...)
   - Cannot skip levels

### Step 5: Choose Approval Mode

**Sequential (most common)**
- Levels approved one at a time, in order
- Level 2 cannot approve until Level 1 is done
- **Use when:** Clear hierarchy, each level reviews previous decision
- Example: Manager → Director → Finance (in order)

**Parallel**
- All levels can approve simultaneously
- Transfer proceeds when ALL levels have approved
- **Use when:** Independent reviewers, no dependencies
- Example: Compliance + Finance + Operations (all at once)

**Hybrid**
- Mix of sequential and parallel
- Configure specific dependencies per level
- **Use when:** Complex workflows with partial parallel paths
- Example: (Manager + Compliance) → Director (both L1 complete before L2)

### Step 6: Save and Activate

1. Review all settings
2. Click **Create Rule**
3. Rule appears in list with "Active" or "Inactive" badge

---

## Managing Existing Rules

### Viewing Rules

**Active Rules Only** (default view)
- Shows rules currently in effect
- Archived rules are hidden

**Archived Rules Only**
- Shows previously archived rules
- Can restore from here

**All Rules (Active + Archived)**
- Complete view of all rules ever created

### Editing a Rule

1. Find the rule in the list
2. Click the **Edit** icon (pencil)
3. Modify any settings:
   - Basic info (name, description, priority)
   - Conditions (thresholds, branches)
   - Levels (add/remove/modify)
   - Approval mode
4. Click **Update Rule**

**Note:** Changes apply to new transfers only. Existing in-progress transfers use the original rule version.

### Toggling Active/Inactive

**To deactivate a rule:**
- Toggle the **Active** switch to OFF
- Rule remains visible but won't evaluate new transfers
- Existing in-progress transfers using this rule continue normally

**To reactivate:**
- Toggle the **Active** switch back to ON
- Rule starts evaluating new transfers immediately

**Use cases:**
- Temporarily disable seasonal rules
- Test new rules before full activation
- Pause rules during special events

---

## Archiving and Restoring Rules

### Understanding Archive vs Inactive

**Inactive (isActive: false)**
- Rule is visible in the default view
- Rule is not evaluated for new transfers
- Can be quickly toggled back to active
- **Use when:** Temporary pause, testing, seasonal

**Archived (isArchived: true)**
- Rule is **completely hidden** from default UI
- Rule is **not evaluated** in approval workflow
- Requires filter change to view
- Can be restored at any time
- **Use when:** Obsolete rules, replaced workflows, cleanup

**Key difference:** Inactive = paused but visible; Archived = hidden from view

### Archiving a Rule

**When to archive:**
- Rule is no longer relevant (workflow changed)
- Rule was replaced by a better version
- Rule was created for a temporary project
- Cleaning up old/test rules

**How to archive:**

1. Find the rule in the list (must be in Active or All view)
2. Click the **Archive** icon (folder/archive symbol)
3. Review the confirmation dialog:
   - Explains rule will be hidden from UI
   - Confirms workflow will not evaluate it
   - Reassures historical data is preserved
4. Click **Archive Rule**

**What happens:**
- Rule disappears from default (Active) view
- Rule no longer evaluates new transfers
- Historical data remains intact (audit trail preserved)
- Can be restored at any time

### Restoring an Archived Rule

**When to restore:**
- Workflow requirements changed back
- Rule was archived by mistake
- Seasonal rule needed again

**How to restore:**

1. Change filter to **Archived Rules Only** or **All Rules**
2. Find the archived rule (gray "Archived" badge)
3. Click the **Restore** icon (archive-off symbol)
4. Review the confirmation dialog:
   - Explains rule will be visible again
   - Confirms original active/inactive state will be preserved
5. Click **Restore Rule**

**What happens:**
- Rule reappears in active/inactive view
- Rule's original isActive state is preserved:
  - If it was active before archiving → restored as active
  - If it was inactive before archiving → restored as inactive
- Toggle the Active switch if you want to change the state

**State Preservation Example:**

```
Before Archive: "High Value Rule" (Active: YES, Priority: 1)
After Archive:  Hidden from view
After Restore:  "High Value Rule" (Active: YES, Priority: 1) ← same state
```

---

## Understanding Approval Modes

### Sequential Mode

**How it works:**
1. Transfer created → matches rule
2. Level 1 approvers notified
3. Level 1 must approve before Level 2 can act
4. Level 2 approves after Level 1
5. Continue until all levels approved

**Workflow:**
```
Manager (L1) → PENDING ⏳
Director (L2) → PENDING ⏳ (waiting for L1)
Finance (L3) → PENDING ⏳ (waiting for L2)

After Manager approves:
Manager (L1) → APPROVED ✓
Director (L2) → PENDING ⏳ (can now approve)
Finance (L3) → PENDING ⏳ (still waiting)
```

**Best for:**
- Clear hierarchies
- Each level reviews previous decision
- Compliance requiring ordered approvals

### Parallel Mode

**How it works:**
1. Transfer created → matches rule
2. ALL levels notified simultaneously
3. All approvers can act independently
4. Transfer proceeds when ALL have approved

**Workflow:**
```
Manager (L1) → PENDING ⏳ (can approve now)
Finance (L2) → PENDING ⏳ (can approve now)
Compliance (L3) → PENDING ⏳ (can approve now)

No waiting - all approve independently
```

**Best for:**
- Independent reviews
- No dependencies between approvers
- Faster processing (parallel vs sequential)

### Hybrid Mode

**How it works:**
- Complex workflows with partial dependencies
- Some levels parallel, others sequential
- Configured per level

**Example:**
```
Level 1a: Manager → Can approve immediately
Level 1b: Compliance → Can approve immediately
Level 2: Director → Waits for BOTH 1a and 1b

(Manager + Compliance in parallel, then Director sequentially)
```

**Best for:**
- Complex organizational structures
- Mixed approval patterns
- Advanced workflows

---

## Common Questions

**Q: Can I have multiple rules for the same transfer?**
A: Only the highest priority (lowest number) matching rule is used. If multiple rules match, the one with the lowest priority number wins.

**Q: What happens to in-progress transfers when I edit a rule?**
A: In-progress transfers use the original rule configuration. Only new transfers use the updated rule.

**Q: Can I delete a rule completely?**
A: No. You can archive it to hide it, but all rules are preserved for audit trail purposes.

**Q: What if I archive a rule while transfers are using it?**
A: In-progress transfers continue with the original rule. New transfers won't use the archived rule.

**Q: Can I restore a rule and make it active immediately?**
A: Yes. If the rule was active before archiving, it's restored as active. You can also toggle the Active switch after restoring.

**Q: Why do I see "Inactive" and "Archived" badges?**
A: Inactive = rule is paused but visible. Archived = rule is hidden from default view. Both mean the rule won't evaluate new transfers.

**Q: Can I change a rule's priority?**
A: Yes, edit the rule and change the priority number. Lower numbers = higher priority.

**Q: What if no rules match a transfer?**
A: The transfer proceeds without requiring approval (status goes straight to APPROVED).

**Q: Can I test a rule without activating it?**
A: Yes, create it as inactive, then test by toggling it on briefly, then back off.

**Q: What permissions do I need to archive rules?**
A: `stock:write` permission (Admin role or higher).

---

## Troubleshooting

### Rule Not Triggering

**Problem:** Created a rule but transfers aren't requiring approval

**Check:**
1. Is the rule **Active**? (toggle must be ON)
2. Is the rule **Archived**? (shouldn't be in archived view)
3. Do the transfer conditions match? (check quantity, value, branches)
4. Is there a higher priority rule? (lower number = higher priority)
5. Are you testing with the correct transfer type?

**Debug steps:**
1. Switch filter to "All Rules" - confirm rule exists
2. Check rule priority vs other rules
3. Verify conditions match your test transfer
4. Check Activity Log for rule creation/changes

### Cannot Find Archived Rule

**Problem:** Archived a rule and now can't find it

**Solution:**
1. Change the filter dropdown to **"Archived Rules Only"** or **"All Rules"**
2. Look for gray "Archived" badge
3. Rules are never deleted, only hidden

### Restored Rule Not Evaluating

**Problem:** Restored a rule but it's not working

**Check:**
1. Is it **Active**? (check the toggle switch)
2. Restored rules keep their original active/inactive state
3. If it was inactive before archiving, toggle Active ON after restoring

### Wrong Approvers

**Problem:** Transfer shows wrong people as approvers

**Check:**
1. Verify rule levels have correct **Required Role** selected
2. Check if users have that role in their membership
3. Verify users are members of the source branch
4. Review rule configuration in edit mode

### Multiple Rules Confusing

**Problem:** Can't predict which rule will apply

**Solution:**
1. Use clear priority numbers (1 = highest priority)
2. Document rule purpose in description
3. Test with inactive rules first
4. Archive obsolete rules to reduce confusion
5. Consider consolidating overlapping rules

---

## Best Practices

**Naming:**
- ✅ "High Value (>£1000) - Manager Approval"
- ❌ "Rule 1"

**Priorities:**
- Use gaps (10, 20, 30) so you can insert rules later
- Critical rules: 1-10
- General rules: 11-50
- Test rules: 90+

**Conditions:**
- Start simple (one condition)
- Add complexity as needed
- Document why each condition exists

**Levels:**
- Minimum levels = faster approvals
- Maximum levels = better oversight
- Find balance for your organization

**Active/Inactive:**
- Inactive for testing new rules
- Inactive for seasonal rules (reactivate when needed)
- Archive when truly obsolete

**Archiving:**
- Archive replaced rules (not delete)
- Archive test/experimental rules after learning
- Keep active view clean with only current rules
- Review quarterly and archive obsolete rules

---

## Related Guides

- [Approving Transfers](approving-transfers.md) - How to approve transfers that trigger these rules
- [Creating Transfers](creating-transfers.md) - How approval rules affect transfer creation
- [Stock Transfers Overview](overview.md) - Understanding the complete workflow
- [Roles & Permissions](../branches-users/roles-permissions.md) - Understanding required roles

---

## Need More Help?

Contact your admin or ask the chat assistant: "How do approval rules work?"
