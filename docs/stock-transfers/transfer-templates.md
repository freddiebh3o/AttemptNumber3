# Transfer Templates

**What you'll learn:**
- What templates are and when to use them
- How to create a template
- Using templates to create transfers quickly
- Managing your templates (edit, duplicate, archive, restore)

---

## What Are Templates?

Templates are saved transfer configurations that you can reuse. Instead of selecting the same branches and products every time, create a template once and use it repeatedly.

**Good use cases:**
- Weekly restocking of retail stores
- Monthly inventory rebalancing between warehouses
- Seasonal transfers (summer products to beach locations)
- Standard emergency stock-out responses

---

## Creating a Template

### Step 1: Access Templates

1. Go to **Stock Management** → **Transfer Templates** in the sidebar
2. Click **Create Template** button

### Step 2: Configure Template

1. **Template Name**: Give it a clear name
   - Good: "Weekly Store #5 Restock"
   - Avoid: "Template 1"
2. **Source Branch**: Select where stock comes from
3. **Destination Branch**: Select where stock goes
4. **Add Products**: Click **Add Item** for each product
   - Select product
   - Enter default quantity
   - Repeat for all products you typically transfer
5. Click **Save Template**

**Tips:**
- Use descriptive names that explain when/why you'd use this template
- Set reasonable default quantities (you can adjust when using the template)
- Include all products you typically transfer together

---

## Using a Template

### Quick Transfer from Template

1. Go to **Stock Management** → **Stock Transfers**
2. Click **New Transfer Request**
3. Click **Use Template** button
4. Select your template from the list
5. **The form pre-fills with:**
   - Source and destination branches
   - Products and quantities from template
6. **Adjust if needed:**
   - Change quantities (e.g., need more/less this week)
   - Change branches (use same products, different locations)
   - Add or remove products
   - Set priority
   - Add request notes
7. Click **Create Transfer Request**

**What happens:**
- Transfer is created with status REQUESTED
- Template remains saved (not affected by creating transfers)
- You can use the same template again

---

## Managing Templates

### Viewing All Templates

1. Go to **Stock Management** → **Transfer Templates**
2. See list of all your templates showing:
   - Template name and description
   - Source → Destination branches
   - Number of products included
   - Archive status badge (if archived)

### Filtering Templates

Use the **Show Templates** dropdown to filter what you see:
- **Active templates only** (default) - Shows only templates you can currently use
- **Archived templates only** - Shows templates you've archived
- **All templates (active + archived)** - Shows everything

**Tip:** Use filters to find old templates you've archived or to clean up your active template list.

### Editing a Template

1. Find the template in the list
2. Click the blue **Edit** button (pencil icon)
3. Modify:
   - Template name or description
   - Source or destination branches
   - Add/remove products
   - Change default quantities
4. Click **Save Changes**

**Note:** Editing a template doesn't affect transfers already created from it.

### Duplicating a Template

If you want a similar template with small changes:

1. Find the template in the list
2. Click the cyan **Duplicate** button (copy icon)
3. Modal opens with all the template's data pre-filled
4. Change the name and adjust as needed
5. Click **Duplicate Template** to save

**Example:**
- Original: "Weekly Store #5 Restock"
- Duplicate it and rename to: "Weekly Store #6 Restock"
- Adjust the destination branch and products
- Save as a new template

### Archiving a Template

When a template becomes obsolete (seasonal route ended, branches closed, workflow changed), archive it instead of deleting:

1. Find the template in the list
2. Click the red **Archive** button (archive icon)
3. Read the confirmation message
4. Click **Archive Template** to confirm

**What happens when you archive:**
- Template is hidden from the active templates list
- Template cannot be used to create new transfers
- All historical data is preserved
- You can restore it anytime if needed

**When to archive:**
- Seasonal templates at end of season
- Templates for discontinued products
- Old workflow templates replaced by new ones
- Branch-specific templates when branches close

**Tip:** Archive instead of delete - you never know when you might need that old template again!

### Restoring an Archived Template

If you need an archived template again:

1. Change filter to **Archived templates only** or **All templates**
2. Find the archived template (marked with "Archived" badge)
3. Click the green **Restore** button (restore icon)
4. Confirm restoration
5. Template returns to your active templates list and can be used again

**Common reasons to restore:**
- Seasonal template needed again
- Workflow change reversed
- Branch reopened

---

## Template Best Practices

### Naming Conventions

Use names that tell you:
- **Frequency**: "Weekly", "Monthly", "Seasonal"
- **Purpose**: "Restock", "Emergency", "Rebalance"
- **Location**: "Store #5", "Main Warehouse"

**Examples:**
- "Weekly Retail Restock - Store A"
- "Emergency Stock-Out - Fast-Moving Products"
- "Monthly Overstock Redistribution"

### Organizing Templates

Group similar templates:
- All weekly restocks for different stores
- Seasonal templates (summer products, winter products)
- Emergency templates (stock-outs, urgent needs)

### Maintenance

**Review templates regularly:**
- Update product lists when items change
- Archive obsolete templates (don't delete - you might need them later)
- Adjust default quantities based on usage trends
- Use the archive filter to clean up your active template list seasonally

---

## Common Questions

**Q: Can other users see my templates?**
A: Templates are typically visible to all users with access to the branches involved, but this depends on your organization's setup.

**Q: Can I create a template from an existing transfer?**
A: Not directly, but you can create a new template and manually add the same products and branches.

**Q: What happens if a product in my template is discontinued?**
A: When you use the template, you'll see a warning about the missing product. Remove it before creating the transfer.

**Q: Can I have templates with the same name?**
A: Yes, but it's confusing. Use unique, descriptive names.

**Q: Do I need special permissions to create templates?**
A: You need `stock:write` permission (Editor role or higher).

**Q: Can I change the branches when using a template?**
A: Yes. The template provides defaults, but you can change anything before creating the transfer.

**Q: What's the difference between archiving and deleting?**
A: Archiving hides the template but keeps all data so you can restore it. The system uses soft delete (archive) instead of permanently removing templates.

**Q: Can I see who archived a template and when?**
A: Yes, this information is tracked in the system audit logs (admin access required).

**Q: What happens to transfers I created from an archived template?**
A: Nothing - existing transfers are completely unaffected. Only the template itself is archived.

**Q: Can viewers archive templates?**
A: No, you need `stock:write` permission (Editor role or higher) to archive or restore templates.

---

## Example Workflow

**Setting up weekly restocking:**

1. **Monday**: Create template "Weekly Store #5 Restock"
   - Source: Main Warehouse
   - Destination: Store #5
   - Products: 20 common items with typical quantities

2. **Every Friday**: Use template to create transfer
   - Select template "Weekly Store #5 Restock"
   - Adjust quantities based on current stock levels
   - Set priority to NORMAL
   - Create transfer

3. **Monthly**: Review template
   - Edit template to add new products that are selling well
   - Remove slow-moving items
   - Update default quantities based on trends

4. **End of Season**: Archive template
   - If this was a seasonal route, archive it for next year
   - Filter to "Archived templates only" to review what you've archived
   - Next season, restore the template and update products/quantities

---

## Related Guides

- [Creating Transfers](creating-transfers.md) - How to create transfers (with or without templates)
- [Overview](overview.md) - Understanding the transfer workflow
- [Managing Products](../products/managing-products.md) - How to set up products

---

## Need More Help?

Contact your admin or ask the chat assistant.