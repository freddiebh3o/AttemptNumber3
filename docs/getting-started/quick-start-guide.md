# Quick Start Guide

## Welcome to the Platform!

This guide will walk you through your first login, help you understand the interface, and get you started with common tasks.

**Time to complete:** 10-15 minutes

## Before You Start

You should have received:
- **Email address** - Your login email
- **Temporary password** - From your admin
- **Tenant slug** - Your organization identifier (e.g., `acme`)
- **Role assignment** - Your role (OWNER, ADMIN, EDITOR, or VIEWER)

If you don't have this information, contact your organization administrator.

## Step 1: First Sign-In

### Navigate to the Platform

Open your browser and go to the platform URL provided by your admin.

### Enter Your Credentials

You'll see the sign-in page with three fields:

**Email**
- Enter your full email address
- Example: `john.doe@acme.com`

**Password**
- Enter the temporary password provided by your admin
- Case-sensitive

**Tenant**
- Enter your organization's tenant slug
- Lowercase only, no spaces
- Example: `acme`, `techcorp`, `mycompany`

**Click "Sign In"**

### First Login Security

**You may be prompted to:**
- Change your password (recommended)
- Verify your email (if enabled)
- Accept terms of service

**Password Requirements:**
- Minimum 8 characters
- Mix of uppercase and lowercase letters
- At least one number
- At least one special character

## Step 2: Understanding the Interface

After signing in, you'll see the main dashboard.

### Header Bar (Top)

**Left Side:**
- **Logo** - Click to return to home page
- **Tenant name** - Shows your current organization

**Right Side:**
- **AI Chat Icon** 💬 - Open chatbot assistant
- **Theme Icon** 🎨 - Customize appearance (OWNER/ADMIN only)
- **User Menu** 👤 - Your name/email
  - Switch tenant (if member of multiple)
  - Sign out

### Sidebar (Left)

**Main Navigation:**
- **Products** - Manage product catalog
- **Stock** - View inventory levels
- **Transfers** - Stock transfer requests
- **Branches** - Location management (if you have `branches:manage`)
- **Users** - User management (if you have `users:manage`)
- **Roles** - Permission management (if you have `roles:manage`)
- **Analytics** - Reports and metrics (if you have `reports:view`)

**Menu visibility:**
- Only shows pages you have permission to access
- Contact admin if you need access to hidden pages

### Main Content Area

- Shows content for the selected page
- Tables are sortable, filterable, and paginated
- Most pages have "New [Item]" button in top-right

## Step 3: Try the AI Chatbot

The AI assistant is the fastest way to get help and query data.

### Open the Chat

Click the **chat icon** 💬 in the top-right corner of the header.

### Ask Your First Question

Try one of these:

**For everyone:**
- "What can I do in this system?"
- "What role do I have?"
- "Show me my permissions"

**If you have products access:**
- "How many products do we have?"
- "Show me all products"

**If you have stock access:**
- "What is our inventory worth?"
- "Show me stock levels"

**If you have transfers access:**
- "Show me pending transfers"
- "How many transfers are in transit?"

### Understanding Responses

The AI will:
- Answer in conversational language
- Pull real-time data from your inventory
- Only show data for branches you're assigned to
- Provide step-by-step instructions when asked "how do I..."

### Chatbot Tips

✅ **Do:**
- Ask in natural language
- Be specific (e.g., "transfers at Main Warehouse")
- Follow up with related questions

❌ **Don't:**
- Use technical jargon or SQL
- Ask about branches you're not a member of
- Expect the AI to perform destructive actions (delete, etc.)

## Step 4: Explore Your Role

What you can do depends on your role. Let's explore!

### VIEWER Role (Read-Only)

**What you can access:**
- Products page (view only)
- Stock page (view only)
- Transfers page (view your branches only)

**Try these tasks:**
1. Navigate to **Products**
2. Search for a product
3. Click a product to view details
4. Check the **Activity** tab to see history
5. Navigate to **Stock**
6. View stock levels at your branches
7. Ask AI: "What's our inventory worth?"

**You cannot:**
- Create or edit products
- Adjust stock levels
- Create or approve transfers
- Manage users or branches

### EDITOR Role (Product & Stock Management)

**What you can access:**
- Everything VIEWER can do
- Plus: Create/edit products
- Plus: Allocate stock (ship transfers)

**Try these tasks:**
1. Navigate to **Products**
2. Click **"New Product"**
3. Fill in name, SKU, price
4. Save the product
5. Navigate to **Transfers**
6. Find a transfer in IN_TRANSIT status
7. Click to ship (if you're at source branch)
8. Select FIFO lots to allocate
9. Complete shipment

**You cannot:**
- Receive stock or adjust inventory
- Approve transfers
- Manage users or roles

### ADMIN Role (Operations Management)

**What you can access:**
- Everything EDITOR can do
- Plus: Manage users
- Plus: Receive and adjust stock
- Plus: Approve transfers
- Plus: Manage branches
- Plus: View analytics

**Try these tasks:**
1. Navigate to **Users**
2. Click **"New User"**
3. Invite a new team member
4. Navigate to **Transfers**
5. Filter by "Needs My Approval"
6. Review and approve a transfer
7. Navigate to **Branches**
8. Create a new branch
9. Ask AI: "Show transfer metrics for the last 30 days"

**You cannot:**
- Create or edit roles
- Manage organization settings

### OWNER Role (Full Control)

**What you can access:**
- Everything ADMIN can do
- Plus: Create/edit roles and permissions
- Plus: Manage organization settings
- Plus: Customize theme

**Try these tasks:**
1. Navigate to **Roles**
2. Click **"New Role"**
3. Create a custom role (e.g., "Stock Receiver")
4. Select specific permissions
5. Navigate to **Users**
6. Assign the new role to a user
7. Click **theme icon** 🎨
8. Customize brand colors
9. Preview and save

## Step 5: Common First Tasks

### Task: View Your Assigned Branches

**Why:** You can only access stock and transfers for your assigned branches.

**How:**
1. Click **user menu** (your name) in top-right
2. Look for "Branch Memberships" section
3. See list of branches you're assigned to

**Alternative:**
- Ask AI: "What branches am I assigned to?"

**If you need access to more branches:**
- Contact your organization admin
- They can assign you through **Users** page

### Task: Check Stock Levels

**Why:** See what inventory you have on hand.

**How:**
1. Navigate to **Stock** page
2. Use search box to find specific products
3. Filter by branch if you have multiple
4. Click a product to see:
   - Quantity on hand
   - FIFO lots with costs
   - Recent movements

**Alternative:**
- Ask AI: "Show me stock levels at [Branch Name]"
- Ask AI: "What products are low on stock?"

### Task: Create Your First Product

**Requires:** `products:write` permission (EDITOR, ADMIN, OWNER)

**How:**
1. Navigate to **Products** page
2. Click **"New Product"**
3. Fill in required fields:
   - **SKU** - Unique product identifier (e.g., `WIDGET-001`)
   - **Name** - Display name (e.g., "Blue Widget")
   - **Unit Price** - Price in GBP (e.g., `25.99`)
4. Optional: Add barcode
5. Click **"Save"**
6. Product appears in products list

**Tips:**
- SKU must be unique within your organization
- Price is in British Pounds (GBP)
- You can edit products later

### Task: Request a Stock Transfer

**Requires:** `stock:write` permission (EDITOR, ADMIN, OWNER)

**Why:** Move stock from one branch to another.

**How:**
1. Navigate to **Transfers** page
2. Click **"New Transfer"**
3. Select **Source Branch** (where stock comes from)
4. Select **Destination Branch** (where stock goes)
5. Set **Priority** (URGENT, HIGH, NORMAL, LOW)
6. Add products:
   - Click **"Add Product"**
   - Select product from dropdown
   - Enter quantity requested
7. Add optional notes
8. Click **"Submit Transfer"**
9. Transfer enters REQUESTED status
10. Awaits approval (if required)

**Alternative:**
- Use a transfer template for recurring patterns
- Ask AI: "How do I create a transfer?"

### Task: Receive a Shipment

**Requires:** `stock:write` permission (ADMIN, OWNER)

**Why:** Add new stock to your branch.

**How:**
1. Navigate to **Products** page
2. Find the product you're receiving
3. Click the product to open details
4. Click **"Adjust Stock"** tab
5. Select your branch
6. Choose **"Receive Stock"** operation
7. Enter:
   - **Quantity** received
   - **Unit Cost** (in pence, e.g., `2599` for £25.99)
   - **Reason** (e.g., "Supplier delivery")
8. Click **"Save"**
9. Stock increases at your branch
10. New FIFO lot created

**Result:**
- Stock level increases
- New lot added with cost and date
- Stock ledger entry created
- Activity log updated

## Step 6: Customize Your Experience

### Set Your Theme Preferences

**OWNER/ADMIN only:**
1. Click **theme icon** 🎨 in header
2. Choose preset or customize:
   - Primary color
   - Secondary color
   - Font preferences
3. Preview changes
4. Save

**All users:**
- System respects your organization's theme
- Dark/light mode (if supported)

### Adjust Page Settings

**Items per page:**
- Most tables have "Per page" selector
- Choose 10, 20, 50, or 100 items
- Preference saved in URL

**Sorting:**
- Click column headers to sort
- Arrow indicates current sort direction
- Most pages remember your preference

**Filters:**
- Click **"Filters"** button
- Set search/date/status filters
- Click **"Apply"**
- Filters persist in URL (shareable)

### Keyboard Shortcuts

**Global:**
- `Esc` - Close modal/dialog
- `Tab` - Navigate form fields

**Tables:**
- `Enter` on row - Open detail page
- `Arrow keys` - Navigate cells

**Forms:**
- `Enter` - Submit form
- `Shift + Enter` - New line in textarea

## Step 7: Get Help When Stuck

### Use the AI Chatbot First

**Click chat icon** 💬 and ask:
- "How do I [task]?"
- "Why can't I see [feature]?"
- "What does [term] mean?"
- "Show me [data]"

The AI has access to all documentation and your real-time data.

### Check Activity Logs

**If something unexpected happened:**
1. Navigate to the affected item (product, transfer, etc.)
2. Click **"Activity"** tab
3. Review recent changes
4. Filter by date or user
5. See "before" and "after" values

**Use cases:**
- "Who changed this product price?"
- "When was this transfer approved?"
- "What stock adjustments were made today?"

### Review Your Permissions

**If you can't access a feature:**
1. Ask AI: "What permissions do I have?"
2. Check if the feature requires a permission you don't have
3. Contact admin to request the permission

**Common permission issues:**
- Can't create products → Need `products:write`
- Can't adjust stock → Need `stock:write`
- Can't approve transfers → Need `stock:write` + approval rules
- Can't invite users → Need `users:manage`

### Contact Your Admin

**If still stuck:**
1. Note the exact error message (if any)
2. Note what you were trying to do
3. Take a screenshot if helpful
4. Contact your organization admin
5. Provide correlation ID if shown in error

## Step 8: Next Steps by Role

### VIEWER - Learn to Analyze

**Recommended guides:**
1. [Viewing Stock](../inventory/viewing-stock.md)
2. [Stock Reports](../inventory/stock-reports.md)
3. [Transfer Metrics](../analytics/transfer-metrics.md)
4. [Stock Analytics](../analytics/stock-analytics.md)

**Practice:**
- Generate stock reports
- Review transfer history
- Analyze completion rates

### EDITOR - Learn Inventory Basics

**Recommended guides:**
1. [Managing Products](../products/managing-products.md)
2. [Stock Transfers Overview](../stock-transfers/overview.md)
3. [Creating Transfers](../stock-transfers/creating-transfers.md)
4. [Shipping Transfers](../stock-transfers/shipping-transfers.md)

**Practice:**
- Create products with barcodes
- Request stock transfers
- Ship transfers using FIFO

### ADMIN - Learn Operations

**Recommended guides:**
1. [Approving Transfers](../stock-transfers/approving-transfers.md)
2. [Receiving Transfers](../stock-transfers/receiving-transfers.md)
3. [Adjusting Stock](../inventory/adjusting-stock.md)
4. [Managing Users](../branches-users/managing-users.md)
5. [Managing Branches](../branches-users/managing-branches.md)

**Practice:**
- Set up approval workflows
- Receive shipments accurately
- Invite and assign users
- Create branches

### OWNER - Learn System Administration

**Recommended guides:**
1. [Roles & Permissions](../branches-users/roles-permissions.md)
2. [Understanding FIFO](../inventory/understanding-fifo.md)
3. [Transfer Templates](../stock-transfers/transfer-templates.md)
4. All analytics guides

**Practice:**
- Create custom roles
- Design transfer templates
- Review organization-wide metrics
- Customize theme

## Tips for Success

### Daily Habits

**Morning routine:**
1. Check pending transfers (if applicable)
2. Review low stock alerts
3. Approve urgent transfers

**End of day:**
1. Complete any in-progress receives
2. Update stock if physical count differs
3. Review today's activity logs

### Weekly Check-Ins

**Every Monday:**
- Review metrics from last week
- Plan transfers for the week
- Check for stuck/delayed transfers

**Every Friday:**
- Generate stock valuation report
- Review completed transfers
- Plan for next week

### Continuous Learning

**Explore gradually:**
- Master one feature before moving to next
- Use AI chatbot to ask questions
- Read relevant guides when needed
- Don't try to learn everything at once

**Start small:**
- Begin with read-only exploration
- Then try creating test data
- Graduate to real operations

**Ask for help:**
- Use AI chatbot liberally
- Contact admin when stuck
- Share learnings with team

## Common Mistakes to Avoid

❌ **Skipping branch assignment**
- Always ensure users are assigned to correct branches
- Users without branch access can't see any data

❌ **Forgetting to save**
- Click "Save" after making changes
- Changes aren't auto-saved

❌ **Ignoring validation errors**
- Red error messages indicate required fixes
- Address all errors before saving

❌ **Creating duplicate SKUs**
- Each product needs unique SKU
- System will reject duplicates

❌ **Not recording unit costs**
- Always enter unit cost when receiving stock
- Needed for accurate FIFO valuation

❌ **Approving without review**
- Check transfer details before approving
- Verify quantities and branches

❌ **Receiving without checking**
- Count physical inventory before receiving
- Report discrepancies accurately

## You're Ready!

You've completed the quick start guide. You should now be able to:
- ✅ Sign in to the platform
- ✅ Navigate the interface
- ✅ Use the AI chatbot
- ✅ Understand your role and permissions
- ✅ Perform basic tasks
- ✅ Get help when needed

**Continue learning:**
- Explore features relevant to your role
- Read detailed guides for specific tasks
- Ask the AI chatbot questions
- Practice with test data before real operations

**Need more help?**
- Ask AI: "I'm new here, what should I learn next?"
- Contact your organization admin
- Review the [Platform Overview](./platform-overview.md)

Welcome aboard! 🎉
