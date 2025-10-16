# Platform Overview

## What is This Platform?

This is a multi-tenant inventory management system designed to help organizations track stock, manage transfers between locations, and maintain accurate inventory records using FIFO (First In, First Out) accounting.

**Key Capabilities:**
- Track inventory across multiple branches (warehouses, stores, etc.)
- Transfer stock between locations with approval workflows
- Manage products with barcodes and pricing
- Control access with role-based permissions
- Generate analytics and reports
- Get help from AI-powered chatbot assistant

## Who Uses This Platform?

### By Organization Type

**Retail Chains**
- Manage stock across multiple store locations
- Transfer inventory from central warehouse to retail stores
- Track product costs and valuation

**Wholesalers & Distributors**
- Coordinate stock between regional distribution centers
- Fulfill transfer requests from customers/partners
- Monitor inventory levels and turnover

**Multi-Location Businesses**
- Any company with inventory at multiple physical locations
- Need to move stock between locations
- Require audit trails and approval workflows

### By User Role

**Owners & Executives (OWNER role)**
- Full system access
- Configure organization settings
- Manage users and permissions
- View all analytics and reports

**Operations Managers (ADMIN role)**
- Manage day-to-day operations
- Approve stock transfers
- Oversee inventory across branches
- Manage users

**Warehouse Staff (EDITOR role)**
- Create and fulfill stock transfers
- Receive shipments
- Adjust inventory levels
- Manage products

**Auditors & Accountants (VIEWER role)**
- Read-only access
- View inventory levels and valuations
- Review transfer history
- Generate reports

## Core Concepts

### Multi-Tenancy

**What it means:**
- Multiple organizations share the same platform
- Each organization (tenant) has completely isolated data
- You can belong to multiple organizations

**How it works:**
1. Each organization has a unique **tenant slug** (e.g., `acme`, `techcorp`)
2. Users can be members of multiple tenants
3. Switch between organizations via the tenant selector
4. URLs include tenant: `/acme/products`, `/techcorp/branches`

**Example:**
- You work for both ACME Corp and Tech Industries
- Sign in once with your email/password
- Select "ACME Corp" to manage their inventory
- Switch to "Tech Industries" for their inventory
- Data is completely separate

### Branches

**What they are:**
- Physical locations where inventory is stored
- Examples: Warehouses, retail stores, distribution centers

**Why they matter:**
- Stock is tracked per branch
- Transfers move stock between branches
- Users are assigned to branches to control access
- Reports and analytics can be filtered by branch

**Example:**
```
ACME Corp has 3 branches:
├── Main Warehouse (london-warehouse)
├── Paris Store (paris-retail)
└── US Distribution (us-dist-east)
```

**See:** [Managing Branches](../branches-users/managing-branches.md)

### Products

**What they are:**
- Items your organization buys, stores, and sells
- Each product has SKU, name, price, and optional barcode

**Key features:**
- Unique SKU per tenant (e.g., `WIDGET-001`)
- Unit price in GBP pence
- Support for multiple barcode formats (EAN-13, UPC-A, CODE128, QR)
- Activity tracking (who created/updated, when)

**Example:**
```
Product: Wireless Mouse
SKU: MOUSE-WL-001
Price: £25.99
Barcode: 5012345678900 (EAN-13)
```

**See:** [Managing Products](../products/managing-products.md)

### Stock & Inventory

**How stock is tracked:**
- Stock is tracked **per branch per product**
- Uses FIFO (First In, First Out) costing method
- Every stock movement creates an audit trail

**Stock components:**

**ProductStock (Aggregated Level)**
- Shows current quantity on hand at each branch
- Denormalized for fast lookups
- Example: "50 units of WIDGET-001 at London Warehouse"

**StockLot (FIFO Level)**
- Individual receipts of stock with unit cost and date
- Oldest lots consumed first (FIFO)
- Tracks `qtyRemaining` for each lot

**StockLedger (Audit Trail)**
- Append-only log of all stock movements
- Types: RECEIPT, ADJUSTMENT, CONSUMPTION, REVERSAL
- Every change tracked with timestamp and user

**See:** [Understanding FIFO](../inventory/understanding-fifo.md)

### Stock Transfers

**What they are:**
- Requests to move stock from one branch to another
- Example: Transfer 100 units from Warehouse to Store

**Transfer lifecycle:**
```
REQUESTED → APPROVED → IN_TRANSIT → COMPLETED
     ↓           ↓
  REJECTED    CANCELLED
```

**Key features:**
- Multi-level approval workflows (1-3 approvers)
- Priority levels (URGENT, HIGH, NORMAL, LOW)
- Partial shipments and receiving
- Discrepancy handling
- Transfer templates for recurring patterns

**Example:**
```
Transfer: TRF-2025-0001
From: Main Warehouse
To: Paris Store
Status: IN_TRANSIT
Items: 50x WIDGET-001, 30x GADGET-002
Priority: URGENT
```

**See:** [Stock Transfers Overview](../stock-transfers/overview.md)

### Roles & Permissions

**How access control works:**
- Each user has **one role per tenant**
- Roles contain **permissions** (e.g., `products:write`)
- UI adapts based on permissions (buttons hidden, pages restricted)

**System roles:**

| Role | Permissions | Use Case |
|------|-------------|----------|
| **OWNER** | All 12 permissions | Company owners, full control |
| **ADMIN** | 10 permissions | Operations managers, day-to-day management |
| **EDITOR** | 5 permissions | Warehouse staff, product/stock management |
| **VIEWER** | 2 permissions | Auditors, read-only access |

**Custom roles:**
- Create roles with specific permission combinations
- Example: "Stock Receiver" with only `stock:read` and `stock:write`

**See:** [Roles & Permissions](../branches-users/roles-permissions.md)

### Branch Membership

**What it is:**
- Assigning a user to specific branches
- Controls which branches' data they can access

**Why it matters:**
- Users can only see stock/transfers for their assigned branches
- Warehouse staff should only access their location
- Managers might access multiple branches

**Example:**
```
User: john@acme.com
Role: EDITOR
Branches: Main Warehouse, Paris Store

John can:
✅ View stock at Main Warehouse and Paris Store
✅ Create transfers between these two branches
❌ View stock at US Distribution (not a member)
❌ Create transfers involving US Distribution
```

**See:** [Managing Users - Branch Assignments](../branches-users/managing-users.md#assigning-users-to-branches)

## Platform Features

### Product Management

**What you can do:**
- Create and edit products (name, SKU, price)
- Add barcodes for scanning
- Search and filter products
- View product activity history
- Check stock levels across branches

**Permissions needed:**
- `products:read` - View products
- `products:write` - Create/edit/delete products

**See:** [Managing Products](../products/managing-products.md)

### Inventory Tracking

**What you can do:**
- View current stock levels by branch
- Receive new stock with unit costs
- Adjust stock for corrections (damage, theft, count errors)
- View stock movement history (ledger)
- Check FIFO lot details
- Generate stock reports

**Permissions needed:**
- `stock:read` - View stock levels and movements
- `stock:write` - Receive and adjust stock

**See:**
- [Viewing Stock](../inventory/viewing-stock.md)
- [Adjusting Stock](../inventory/adjusting-stock.md)
- [Stock Reports](../inventory/stock-reports.md)

### Stock Transfers

**What you can do:**
- Request transfers between branches
- Approve/reject transfer requests
- Ship transfers with lot selection (FIFO)
- Receive transfers and handle discrepancies
- Use templates for recurring transfers
- Reverse completed transfers (with approval)
- Track transfer status and history

**Permissions needed:**
- `stock:read` - View transfers
- `stock:write` - Create and receive transfers
- `stock:allocate` - Ship transfers (consume stock)

**See:** [Stock Transfers Overview](../stock-transfers/overview.md)

### User & Branch Management

**What you can do:**
- Invite new users to your organization
- Assign roles and permissions
- Assign users to branches
- Create and manage custom roles
- Create and manage branches
- Track user activity

**Permissions needed:**
- `users:manage` - Invite and manage users
- `roles:manage` - Create/edit roles and permissions
- `branches:manage` - Create/edit branches

**See:**
- [Managing Users](../branches-users/managing-users.md)
- [Roles & Permissions](../branches-users/roles-permissions.md)
- [Managing Branches](../branches-users/managing-branches.md)

### Analytics & Reporting

**What you can do:**
- View transfer performance metrics (completion rates, cycle time)
- Check stock valuation (FIFO-based)
- Analyze branch performance (inbound/outbound)
- Track fill rates and accuracy
- Generate stock reports (ledger, movements)

**Permissions needed:**
- `reports:view` - Access analytics dashboards
- `stock:read` - View stock reports

**See:**
- [Transfer Metrics](../analytics/transfer-metrics.md)
- [Stock Analytics](../analytics/stock-analytics.md)
- [Stock Reports](../inventory/stock-reports.md)

### AI Chatbot Assistant

**What it is:**
- AI-powered assistant to help navigate the platform
- Ask questions in natural language
- Get real-time data from your inventory

**What you can ask:**
- "Show me products with low stock"
- "What transfers are pending approval?"
- "What's our inventory worth?"
- "How do I create a stock transfer?"
- "What permissions does ADMIN role have?"

**How to access:**
- Click the **chat icon** in the header (next to sign out)
- Type your question
- Get instant answers with real data

**See:** Just click the chat icon and start asking!

## Platform Architecture

### Frontend (Admin Web)

**Technology:**
- React with TypeScript
- Mantine UI component library
- Vite for fast development

**Features:**
- Responsive design (desktop and mobile)
- Theme customization per tenant
- Real-time updates
- Accessibility-focused

### Backend (API Server)

**Technology:**
- Node.js with Express
- PostgreSQL database (Supabase)
- Prisma ORM
- OpenAI GPT-4 for chatbot

**Features:**
- RESTful API
- Cookie-based authentication
- Multi-tenant data isolation
- Audit logging
- Rate limiting and idempotency

### Security

**Authentication:**
- Email + password sign-in
- Session cookies (signed JWT)
- Tenant-scoped sessions

**Authorization:**
- Role-Based Access Control (RBAC)
- Permission checks on every API call
- Branch membership filtering
- Tenant isolation enforced at database level

**Audit Trail:**
- All changes logged in `AuditEvent` table
- Who, what, when for every modification
- API request/response logging
- Correlation IDs for debugging

## Common Workflows

### Daily Operations Workflow

**Morning: Check Inventory**
1. Sign in to platform
2. Navigate to **Stock** page
3. Review stock levels at your branch
4. Check for low stock alerts
5. Use AI chatbot: "Show me products with low stock"

**Throughout Day: Fulfill Transfers**
1. Navigate to **Transfers** page
2. Filter by "Inbound" transfers (coming to your branch)
3. For transfers in IN_TRANSIT status, click to receive
4. Verify quantities received
5. Report discrepancies if needed
6. Complete receipt

**End of Day: Stock Adjustments**
1. If physical count differs from system
2. Navigate to product → Adjust Stock
3. Enter reason (damage, theft, count error)
4. System creates adjustment record

### Weekly Manager Workflow

**Monday: Review Pending Approvals**
1. Navigate to **Transfers** page
2. Filter by "Needs My Approval"
3. Review each transfer request
4. Approve or reject with notes
5. Use AI: "Show me pending approvals"

**Wednesday: Transfer Metrics Review**
1. Click **chat icon**
2. Ask: "Show transfer metrics for the last 7 days"
3. Review completion rates and cycle times
4. Investigate delays if cycle time is high

**Friday: Stock Valuation**
1. Click **chat icon**
2. Ask: "What is our inventory worth?"
3. Review by branch
4. Compare to previous week (manual tracking for now)

### Monthly Admin Workflow

**Week 1: User Review**
1. Navigate to **Users** page
2. Review active users
3. Remove inactive users
4. Update roles/permissions as needed
5. Add new users if team changed

**Week 2: Product Cleanup**
1. Navigate to **Products** page
2. Use AI: "Show me products with no stock"
3. Archive or delete obsolete products
4. Update pricing if needed

**Week 3: Analytics Review**
1. Generate transfer metrics (last 30 days)
2. Review branch performance
3. Identify bottlenecks (long cycle times, low fill rates)
4. Plan process improvements

**Week 4: Audit Preparation**
1. Generate stock valuation report
2. Export stock ledger for key products
3. Review discrepancies and adjustments
4. Document any anomalies

## Getting Help

### AI Chatbot

**Best for:**
- Quick questions about features
- Real-time data queries
- How-to guidance

**Access:**
- Click chat icon in header
- Ask in natural language

### Documentation

**Best for:**
- Detailed step-by-step guides
- Understanding concepts (FIFO, roles, etc.)
- Reference information

**Access:**
- Ask AI: "How do I [task]?" (AI uses this documentation)
- Browse guides directly (if provided access)

### Activity Logs

**Best for:**
- Understanding what changed
- Troubleshooting unexpected data
- Audit trail for compliance

**Access:**
- Every entity (product, transfer, user, etc.) has Activity tab
- Filter by date, action type, user
- See before/after values for changes

### Support Contact

**If you need help:**
1. Try the AI chatbot first
2. Check documentation
3. Review activity logs for clues
4. Contact your organization admin
5. Escalate to platform support if needed

## Next Steps

**New to the platform?**
- Read the [Quick Start Guide](./quick-start-guide.md)
- Follow first-login walkthrough
- Explore with VIEWER role first (read-only)

**Ready to manage inventory?**
- Review [Understanding FIFO](../inventory/understanding-fifo.md)
- Learn [Viewing Stock](../inventory/viewing-stock.md)
- Practice [Adjusting Stock](../inventory/adjusting-stock.md)

**Need to transfer stock?**
- Read [Stock Transfers Overview](../stock-transfers/overview.md)
- Learn [Creating Transfers](../stock-transfers/creating-transfers.md)
- Understand [Approval Workflows](../stock-transfers/approving-transfers.md)

**Managing a team?**
- Review [Managing Users](../branches-users/managing-users.md)
- Understand [Roles & Permissions](../branches-users/roles-permissions.md)
- Set up [Branches](../branches-users/managing-branches.md)

**Analyzing performance?**
- Check [Transfer Metrics](../analytics/transfer-metrics.md)
- Review [Stock Analytics](../analytics/stock-analytics.md)

**Just ask the AI:**
- Click the chat icon
- Type: "I'm new here, what can I do?"
- Get personalized guidance based on your role
