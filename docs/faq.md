# Frequently Asked Questions (FAQ)

## General Platform Questions

### What is this platform for?

This is a multi-tenant inventory management system for organizations with multiple physical locations. It helps you track stock, manage transfers between branches, and maintain accurate FIFO (First In, First Out) costing.

**See:** [Platform Overview](getting-started/platform-overview.md)

### Who can use this platform?

Anyone in your organization with an account:
- **Owners** - Full system control
- **Admins** - Operations management
- **Editors** - Product and stock management
- **Viewers** - Read-only access for auditors/accountants

**See:** [Roles & Permissions](branches-users/roles-permissions.md)

### How do I sign in for the first time?

You'll need three things from your admin:
1. Your email address
2. Temporary password
3. Tenant slug (your organization's identifier)

Enter all three on the sign-in page.

**See:** [Quick Start Guide](getting-started/quick-start-guide.md)

### Can I belong to multiple organizations?

Yes! You can be a member of multiple tenants with the same email address. After signing in, use the tenant switcher to change organizations.

### How do I change my password?

Contact your organization admin to reset your password. Self-service password reset is not yet implemented.

### What browsers are supported?

Modern browsers:
- Chrome (recommended)
- Firefox
- Safari
- Edge

**Avoid:** Internet Explorer (not supported)

## Products

### How do I create a product?

**Requirements:** `products:write` permission (EDITOR, ADMIN, OWNER)

**Steps:**
1. Navigate to **Products** page
2. Click **"New Product"**
3. Enter SKU, name, and price
4. Optional: Add barcode
5. Click **"Save"**

**See:** [Managing Products](products/managing-products.md)

### Can I have the same SKU at different branches?

Yes, SKUs are organization-level identifiers. The same product (SKU) can exist at multiple branches with different stock levels.

### What barcode formats are supported?

- EAN-13 (European Article Number)
- UPC-A (Universal Product Code)
- CODE128
- QR codes

**See:** [Product Barcodes](products/product-barcodes.md)

### Can I delete a product?

Products cannot be permanently deleted. Instead, you can **archive** them to remove from active lists while preserving all historical data.

**To archive a product:**
1. Open the product page
2. Click "Archive Product" button
3. Confirm the action

**Why archiving instead of deleting?**
- Preserves stock history and audit trail
- Can be restored anytime if needed
- Keeps historical reports accurate

**See:** [Archiving Products](products/managing-products.md#archiving-products)

### Why is my product not showing in dropdowns?

**Common reasons:**
- No stock at the selected branch
- Search filter active (clear it)
- Page not refreshed after creating product
- Wrong branch selected

**See:** [Common Issues - Products](troubleshooting/common-issues.md#product-management)

## Stock & Inventory

### How do I check stock levels?

**Navigate to Stock page** or ask AI: "Show me stock levels"

You'll see quantity on hand for each product at your assigned branches.

**See:** [Viewing Stock](inventory/viewing-stock.md)

### What is FIFO?

**FIFO** = First In, First Out

When you receive stock multiple times at different costs, FIFO assumes the oldest stock is used/sold first. This affects inventory valuation and cost of goods sold.

**Example:**
- January: Receive 100 units @ £5.00
- February: Receive 100 units @ £6.00
- March: Sell 150 units

FIFO consumes all 100 January units (£5.00) plus 50 February units (£6.00) first.

**See:** [Understanding FIFO](inventory/understanding-fifo.md)

### How do I adjust stock?

**Requirements:** `stock:write` permission (ADMIN, OWNER)

**Steps:**
1. Navigate to product
2. Click **"Adjust Stock"** tab
3. Select branch and operation (Receive, Adjust, Consume)
4. Enter quantity, unit cost (for receives), and reason
5. Save

**See:** [Adjusting Stock](inventory/adjusting-stock.md)

### Why is my stock valuation different from product price?

Stock valuation uses **FIFO lot costs**, not the current product price.

**Example:**
- Product price: £10.00
- Received 50 units @ £8.00 last month
- **Stock value:** £400 (50 × £8.00), not £500 (50 × £10.00)

**See:** [Stock Analytics](analytics/stock-analytics.md)

### Can I see who adjusted stock?

Yes! Every stock change is logged:
1. Navigate to product
2. Click **"Activity"** tab
3. See all adjustments with timestamp and user

**See:** [Stock Reports](inventory/stock-reports.md)

## Stock Transfers

### What is a stock transfer?

A request to move inventory from one branch to another.

**Example:** Transfer 100 widgets from Main Warehouse to Store 1

**Workflow:** REQUESTED → APPROVED → IN_TRANSIT → COMPLETED

**See:** [Stock Transfers Overview](stock-transfers/overview.md)

### How do I create a transfer?

**Requirements:** `stock:write` permission

**Steps:**
1. Navigate to **Transfers** page
2. Click **"New Transfer"**
3. Select source and destination branches
4. Add products and quantities
5. Set priority
6. Submit

**See:** [Creating Transfers](stock-transfers/creating-transfers.md)

### Why does my transfer need approval?

Your organization may have approval rules based on:
- Transfer value (total cost)
- Specific branches
- Specific products
- Quantity thresholds

**Ask AI:** "Why does transfer [ID] need approval?"

**See:** [Approving Transfers](stock-transfers/approving-transfers.md)

### Who can approve transfers?

Users with:
- `stock:write` permission
- Membership in the source or destination branch
- Matching approval rule criteria

Typically ADMIN or OWNER roles.

### Can I cancel a transfer?

Yes, if:
- Transfer is REQUESTED or APPROVED (not yet shipped)
- You have `stock:write` permission
- You're a member of source/destination branch

**Transfers in IN_TRANSIT or COMPLETED cannot be cancelled**, but completed transfers can be **reversed**.

**See:** [Reversing Transfers](stock-transfers/reversing-transfers.md)

### What if I receive less than was shipped?

During receiving, enter the **actual quantity received**. The system will record the discrepancy in the ledger and activity log.

**See:** [Receiving Transfers](stock-transfers/receiving-transfers.md)

### What are transfer templates?

Pre-configured transfer setups for recurring patterns.

**Example:** Weekly transfer of 50 widgets + 30 gadgets from Warehouse to Store 1

Templates save time by auto-filling products and quantities.

**See:** [Transfer Templates](stock-transfers/transfer-templates.md)

## Users & Permissions

### What's the difference between roles?

| Role | Permissions | Typical Use |
|------|-------------|-------------|
| **OWNER** | All 12 | Company owners, full control |
| **ADMIN** | 10 | Operations managers |
| **EDITOR** | 5 | Warehouse staff, product managers |
| **VIEWER** | 2 | Auditors, accountants (read-only) |

**See:** [Roles & Permissions](branches-users/roles-permissions.md)

### Can I create custom roles?

Yes, if you have `roles:manage` permission (OWNER only by default).

Custom roles let you mix and match permissions for specific job functions.

**Example:** "Stock Receiver" with only `stock:read` and `stock:write`

**See:** [Roles & Permissions - Custom Roles](branches-users/roles-permissions.md#custom-roles)

### Can I delete custom roles?

Custom roles can be **archived** instead of permanently deleted. Archiving hides the role while preserving audit history.

**How to archive:**
1. Open the role from the Roles page
2. Click the red **"Archive"** button
3. Confirm in the modal

**Important:**
- ✅ Custom roles can be archived and restored
- ❌ System roles (OWNER, ADMIN, EDITOR, VIEWER) **cannot be archived**
- ❌ Roles with active users **cannot be archived** (reassign users first)

**See:** [Roles & Permissions - Archiving Roles](branches-users/roles-permissions.md#archiving-custom-roles)

### Can I restore an archived role?

Yes! Archived roles can be restored at any time.

**How to restore:**
1. Go to Roles page
2. Click **"Filters"** and set **"Archived Filter"** to **"Archived roles only"**
3. Open the archived role (it has a red "Archived" badge)
4. Click the green **"Restore"** button

The role is immediately restored with all permissions preserved.

**See:** [Roles & Permissions - Restoring Roles](branches-users/roles-permissions.md#restoring-archived-roles)

### How do I invite a new user?

**Requirements:** `users:manage` permission (ADMIN, OWNER)

**Steps:**
1. Navigate to **Users** page
2. Click **"New User"**
3. Enter email and password
4. Select role
5. Assign to branches
6. Save

**See:** [Managing Users](branches-users/managing-users.md)

### What are branch memberships?

Branch membership determines which locations a user can access.

**Example:**
- User assigned to "Main Warehouse"
- Can only see stock/transfers for Main Warehouse
- Cannot access "Store 1" data

**Important:** Users must be assigned to at least one branch to see any data.

**See:** [Managing Users - Branch Assignments](branches-users/managing-users.md#assigning-users-to-branches)

### Can a user have different roles in different tenants?

Yes! If you're a member of multiple organizations:
- OWNER in Company A
- VIEWER in Company B

Roles are per-tenant, not global.

### How do I remove a user who left the company?

**Use archiving** instead of deleting:

**Requirements:** `users:manage` permission (ADMIN, OWNER)

**Steps:**
1. Navigate to **Users** page
2. Click the user's email
3. Click **"Archive User"** button
4. Confirm in the modal dialog

**What happens:**
- User cannot sign in anymore
- All historical data preserved (audit trail, stock movements, transfers)
- User can be restored if needed
- User hidden from active lists by default

**See:** [Managing Users - Archiving](branches-users/managing-users.md#archiving-a-user)

### Can archived users be restored?

Yes! Archiving is reversible:

**Steps:**
1. Go to **Users** page
2. Click **"Filters"**
3. Change **"Show users"** to **"Archived users only"**
4. Find and click the archived user
5. Click **"Restore"** button

User can sign in immediately after restoration.

**See:** [Managing Users - Restoring](branches-users/managing-users.md#restoring-an-archived-user)

### What error do archived users see when trying to sign in?

"Invalid credentials or your membership has been archived"

This prevents confusion with incorrect password errors and clearly indicates the account is archived.

**Solution:** Contact admin to restore the account if access is needed.

## Branches

### What is a branch?

A physical location where inventory is stored.

**Examples:**
- Warehouses
- Retail stores
- Distribution centers
- Manufacturing facilities

**See:** [Managing Branches](branches-users/managing-branches.md)

### How do I create a branch?

**Requirements:** `branches:manage` permission (ADMIN, OWNER)

**Steps:**
1. Navigate to **Branches** page
2. Click **"New Branch"**
3. Enter slug (URL-friendly ID) and name
4. Set active status
5. Save

**See:** [Managing Branches](branches-users/managing-branches.md)

### What's the difference between slug and name?

**Slug:**
- URL-friendly identifier (lowercase, numbers, hyphens)
- Example: `warehouse-main`
- Used in system references and URLs

**Name:**
- Human-readable display name
- Example: "Main Warehouse"
- Shows in lists and reports

### Can I delete a branch?

Yes! You can **archive** a branch (soft delete):
1. Open the branch detail page
2. Click **"Archive Branch"** button
3. Confirm the action

**What happens:**
- Branch is hidden from active lists
- All historical data is preserved (stock, transfers, users)
- Can be restored anytime via the **"Restore"** button
- Branch becomes read-only until restored

**To view archived branches:**
- Go to Branches page
- Click **"Filters"**
- Set **Archive Filter** to **"Archived branches only"**

**See:** [Managing Branches - Archiving](branches-users/managing-branches.md#archiving-a-branch)

### How do I restore an archived branch?

1. Go to **Branches** page
2. Click **"Filters"**
3. Set **Archive Filter** to **"Archived branches only"** or **"All branches"**
4. Click **"Apply"**
5. Find the archived branch (shows "Archived" badge)
6. Click the **View** button
7. Click **"Restore"** button (blue button)

The branch is immediately restored and available for use again.

**See:** [Managing Branches - Restoring](branches-users/managing-branches.md#restoring-an-archived-branch)

## Analytics & Reports

### How do I view transfer metrics?

**Ask AI chatbot:**
- "Show me transfer metrics for the last 30 days"
- "What's our transfer completion rate?"

**Metrics include:**
- Total transfers, completed, pending, in-transit
- Completion rate
- Average cycle time
- Fill rate

**See:** [Transfer Metrics](analytics/transfer-metrics.md)

### What is stock valuation?

The total financial value of your inventory, calculated using FIFO lot costs.

**Ask AI:** "What is our inventory worth?"

**See:** [Stock Analytics](analytics/stock-analytics.md)

### Can I export reports to Excel?

Not yet. Export functionality is planned but not yet implemented.

**Workaround:**
- Use AI chatbot to get data
- Copy and paste into Excel
- Or take screenshots

### How do I view stock movement history?

1. Navigate to product
2. View stock ledger (shows all receipts, adjustments, consumption)
3. Filter by branch or date range

**See:** [Stock Reports](inventory/stock-reports.md)

## AI Chatbot

### How do I access the chatbot?

Click the **chat icon** 💬 in the top-right corner of the header (next to sign out button).

### What can I ask the chatbot?

**Data queries:**
- "Show me products with low stock"
- "What transfers are pending?"
- "What's our inventory worth?"

**How-to questions:**
- "How do I create a transfer?"
- "How do I approve a transfer?"
- "What permissions do I have?"

**System information:**
- "What branches am I assigned to?"
- "What role do I have?"
- "Show me all users"

### Does the chatbot have access to my data?

Yes, the chatbot pulls **real-time data** from your inventory. It only shows data for:
- Your assigned branches
- Features you have permission to access

**Security:** Same access control as the UI.

### What if the chatbot gives wrong information?

**The AI can sometimes "hallucinate" (make up information).**

**Always verify critical data:**
- Check the actual page (Products, Transfers, etc.)
- UI data is authoritative
- Report discrepancies to admin

**Tips for better results:**
- Ask specific questions (not general)
- Request specific IDs or names
- Use "search" or "show" (pulls real data)
- Avoid "tell me about" (uses AI knowledge)

**See:** [Common Issues - AI Chatbot](troubleshooting/common-issues.md#ai-chatbot)

## Technical Questions

### What currency is used?

British Pounds (GBP £)

Prices and costs are stored in **pence** internally but displayed as **pounds** (£XX.XX).

### Can I use this on mobile?

The platform is responsive and works on mobile browsers, but the experience is optimized for desktop/tablet.

**Best experience:** Desktop with Chrome browser

### How long are sessions?

Sessions typically last **24 hours of inactivity**. After that, you'll be logged out and need to sign in again.

### Is my data backed up?

Yes, the platform uses PostgreSQL (Supabase) with automated backups. Contact your platform administrator for backup schedule details.

### Can I access the API directly?

The platform has a RESTful API, but direct API access is not documented for end users. The UI and AI chatbot are the intended interfaces.

**For developers:** OpenAPI documentation available at `/openapi.json`

## Troubleshooting

### I can't sign in

**See:** [Common Issues - Sign-In & Authentication](troubleshooting/common-issues.md#sign-in--authentication)

**Quick checks:**
- Correct email, password, and tenant slug
- Caps Lock disabled
- Cookies enabled in browser

### I can't see any data

**Likely cause:** Not assigned to any branches

**Solution:**
- Contact your admin
- Request branch membership
- You need at least one branch to see data

### I'm getting "Permission denied" errors

**Cause:** Your role doesn't have the required permission

**Solution:**
- Ask AI: "What permissions do I have?"
- Contact admin to request permission or role change

**See:** [Common Issues - Authentication](troubleshooting/common-issues.md#issue-cant-access-certain-pages)

### Stock levels are wrong

**See:** [Common Issues - Stock Level Incorrect](troubleshooting/common-issues.md#issue-stock-level-incorrect)

**Quick checks:**
- Review stock ledger
- Check for pending transfers
- Verify branch selection
- Adjust stock if needed

### Page is loading slowly

**Solutions:**
- Apply filters to reduce data
- Use pagination (load 20 items at a time)
- Clear browser cache
- Check internet connection

**See:** [Common Issues - Performance](troubleshooting/common-issues.md#performance--browser-issues)

## Getting More Help

### Where can I find detailed guides?

All documentation is accessible through the **AI chatbot**:
- Ask: "How do I [task]?"
- AI will pull from comprehensive guides

**Direct access (if provided):**
- Browse `docs/` folder
- See **[README](README.md)** for full guide index

### Who do I contact for support?

**First:** Try AI chatbot (click chat icon 💬)
**Second:** Contact your organization admin
**Last:** Admin escalates to platform support if needed

**See:** [Common Issues - Getting More Help](troubleshooting/common-issues.md#getting-more-help)

### How do I report a bug?

**For users:**
1. Note exact error message and correlation ID
2. Screenshot if helpful
3. Document steps to reproduce
4. Contact your organization admin

**For admins:**
- Escalate to platform support with correlation ID
- Include server logs if available

### Where can I suggest features?

Contact your organization admin with feature requests. They can consolidate requests and escalate to the platform team.

## Quick Reference

### Permissions Quick Guide

| Permission | What It Allows |
|------------|----------------|
| `products:read` | View products |
| `products:write` | Create/edit/delete products |
| `stock:read` | View stock levels and movements |
| `stock:write` | Receive and adjust stock |
| `stock:allocate` | Ship transfers (consume stock) |
| `users:manage` | Invite and manage users |
| `roles:manage` | Create/edit roles |
| `branches:manage` | Create/edit branches |
| `tenant:manage` | Manage organization settings |
| `theme:manage` | Customize branding |
| `uploads:write` | Upload images/files |
| `reports:view` | Access analytics |

**See:** [Roles & Permissions](branches-users/roles-permissions.md)

### Transfer Status Quick Guide

| Status | Meaning | Next Step |
|--------|---------|-----------|
| **REQUESTED** | Awaiting approval | Approve or reject |
| **APPROVED** | Ready to ship | Ship from source |
| **IN_TRANSIT** | Shipped, en route | Receive at destination |
| **COMPLETED** | Fully received | Done (can reverse if needed) |
| **REJECTED** | Denied approval | Create new request |
| **CANCELLED** | Manually cancelled | Create new request |

**See:** [Stock Transfers Overview](stock-transfers/overview.md)

### Common AI Chatbot Questions

**Data Queries:**
- "Show me products with low stock"
- "What transfers are pending?"
- "What's our inventory worth?"
- "Show me transfer metrics for the last 30 days"
- "What branches am I assigned to?"

**How-To:**
- "How do I create a transfer?"
- "How do I approve a transfer?"
- "How do I adjust stock?"
- "How do I invite a user?"

**System Info:**
- "What role do I have?"
- "What permissions do I have?"
- "What can I do in this system?"

---

**Still have questions?**

Click the **chat icon** 💬 and ask the AI assistant!
