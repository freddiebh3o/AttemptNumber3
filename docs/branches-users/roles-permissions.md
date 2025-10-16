# Roles & Permissions

## Overview

The system uses Role-Based Access Control (RBAC) to manage what users can see and do. Each user has one role per organization, and that role defines their permissions.

**Key Concepts:**
- **Permission** - A specific action (e.g., "View products", "Manage users")
- **Role** - A collection of permissions (e.g., "ADMIN", "EDITOR")
- **User** - Has one role per organization, inherits all permissions from that role

## Understanding Permissions

Permissions are granular capabilities that control access to features and actions.

### Permission Categories

**Products (2 permissions)**
- `products:read` - View products and details
- `products:write` - Create, edit, and delete products

**Users & Roles (2 permissions)**
- `users:manage` - Invite and manage users
- `roles:manage` - Create and edit roles and permissions

**Organization (1 permission)**
- `tenant:manage` - Manage organization settings

**Theming & Uploads (2 permissions)**
- `theme:manage` - Customize tenant branding and theme
- `uploads:write` - Upload images and files

**Branches (1 permission)**
- `branches:manage` - Create, edit, and deactivate branches

**Inventory (3 permissions)**
- `stock:read` - View stock levels, lots, and movements
- `stock:write` - Receive stock and adjust inventory
- `stock:allocate` - Allocate and consume stock for orders

**Analytics (1 permission)**
- `reports:view` - Access analytics reports and dashboards

**Total: 12 permissions**

## System Roles

The system provides four default roles that cannot be deleted or edited. These are called "system roles."

### OWNER (12 permissions)
**Full access** - All permissions across the entire system

**Permissions:**
- products:read, products:write
- users:manage, roles:manage, tenant:manage
- theme:manage, uploads:write
- branches:manage, stock:read, stock:write, stock:allocate
- reports:view

**Use Case:**
- Company owners and executives
- Primary administrators with complete control
- Users who need to manage everything

### ADMIN (10 permissions)
**Administrative access** - Everything except role/tenant management

**Permissions:**
- products:read, products:write
- users:manage
- theme:manage, uploads:write
- branches:manage, stock:read, stock:write, stock:allocate
- reports:view

**Missing (vs OWNER):**
- ❌ roles:manage - Cannot create/edit roles
- ❌ tenant:manage - Cannot manage organization settings

**Use Case:**
- Operational managers
- Senior staff who manage users and inventory
- Users who need broad access but not full control

### EDITOR (5 permissions)
**Editing access** - Can manage products and stock

**Permissions:**
- products:read, products:write
- uploads:write
- stock:read, stock:allocate

**Missing (vs ADMIN):**
- ❌ users:manage - Cannot manage users
- ❌ branches:manage - Cannot create/edit branches
- ❌ stock:write - Cannot receive stock or adjust inventory
- ❌ reports:view - Cannot view analytics
- ❌ theme:manage, tenant:manage, roles:manage

**Use Case:**
- Product managers
- Warehouse staff who fulfill orders
- Users who update products and allocate stock

### VIEWER (2 permissions)
**Read-only access** - View products and stock only

**Permissions:**
- products:read
- stock:read

**Missing:**
- ❌ All write permissions
- Cannot create, edit, or delete anything

**Use Case:**
- Auditors and accountants
- External partners who need visibility
- Users who only need to view data

## Custom Roles

You can create custom roles with specific permission combinations tailored to your needs.

### When to Create Custom Roles

**Scenario 1: Stock Receiver**
- A user who only receives shipments and adjusts stock
- Permissions needed: `stock:read`, `stock:write`
- Create role: "Stock Receiver"

**Scenario 2: Product Manager (No Stock)**
- A user who manages product catalog but not inventory
- Permissions needed: `products:read`, `products:write`, `uploads:write`
- Create role: "Product Manager"

**Scenario 3: Branch Manager**
- A user who manages a specific location
- Permissions needed: `branches:manage`, `stock:read`, `stock:write`, `stock:allocate`
- Create role: "Branch Manager"

**Scenario 4: Read-Only Admin**
- A user who can view everything but change nothing
- Permissions needed: All `:read` permissions
- Create role: "Auditor"

### Creating a Custom Role

**Step 1: Navigate to Roles**
1. Go to **Roles** page from main menu
2. Click **"New role"** button

**Step 2: Enter Role Details**

**Name** (required)
- Enter a descriptive role name
- Example: "Stock Receiver", "Product Manager"
- Must be unique within your organization

**Permissions** (select at least one)
- Use the multiselect to choose permissions
- Permissions are grouped by category
- Format: `category:action — Description`
- Example: `products:read — View products`

**Step 3: Save**

Click **"Save"** to create the role.

**What Happens Next:**
- Role appears in the roles list
- You can now assign users to this role
- Role can be edited or deleted later (unlike system roles)

### Editing a Custom Role

**Opening a Role:**
1. From Roles page, click the role name or eye icon
2. System roles show "System roles cannot be edited" message

**What You Can Edit:**
- **Name** - Change the role display name
- **Permissions** - Add or remove permissions

**Saving Changes:**
1. Make your changes
2. Click **"Save"**
3. Changes apply immediately to all users with this role

**Impact on Users:**
- Users with this role get new permissions instantly
- Users may need to refresh their browser to see UI changes
- Removed permissions immediately block access to those features

### Deleting a Custom Role

**How to Delete:**
From the Roles page, click the **red trash icon** next to the custom role.

**Important:**
- Cannot delete system roles (OWNER, ADMIN, EDITOR, VIEWER)
- Cannot delete roles currently assigned to users
- Deletion is permanent (no undo)

**Error: "Role is in use by users"**
- This role is assigned to one or more users
- Reassign those users to a different role first
- Then delete the role

## Assigning Roles to Users

### During User Creation

1. Go to **Users** page
2. Click **"New User"**
3. Fill in email and password
4. In the **Role** dropdown, select the role
   - System roles: OWNER, ADMIN, EDITOR, VIEWER
   - Custom roles: Any roles you've created
5. Save

### For Existing Users

1. Go to **Users** page
2. Click the user's email
3. In the **Role** dropdown, select a different role
4. Click **"Save"**
5. Changes apply immediately

**See:** [Managing Users - Changing a User's Role](./managing-users.md#changing-a-users-role)

## Searching and Filtering Roles

### Available Filters

**Search (name contains)**
- Partial match on role name
- Example: Search "admin" finds "ADMIN" and "Sub Admin"

**Exact name**
- Exact role name match
- Example: "ADMIN" finds only the ADMIN role

**System role**
- **System** - Show only system roles (OWNER, ADMIN, EDITOR, VIEWER)
- **Custom** - Show only custom roles you created
- **Any** - Show both

**Permissions (any/all)**
- **Any** - Roles with ANY of the selected permissions
- **All** - Roles with ALL of the selected permissions
- Example: Filter by `products:write` and `stock:write` with "All" finds roles with both

**Created/Updated Date Ranges**
- Filter by when role was created or modified
- Useful for finding recently added custom roles

### Sorting Roles

Click column headers to sort:
- **Name** - Alphabetical (A-Z or Z-A)
- **Created** - Newest or oldest first
- **Updated** - Recently modified first

## Permission-Based UI

The system automatically shows or hides features based on your permissions.

### Menu Visibility

**What you see in the main menu:**
- **Products** - Shown if you have `products:read`
- **Branches** - Shown if you have `branches:manage`
- **Users** - Shown if you have `users:manage`
- **Roles** - Shown if you have `roles:manage`
- **Analytics** - Shown if you have `reports:view`
- **Settings** - Shown if you have `tenant:manage` or `theme:manage`

### Button Visibility

**Common buttons that appear/disappear:**
- **"New Product"** - Requires `products:write`
- **"Adjust Stock"** - Requires `stock:write`
- **"New User"** - Requires `users:manage`
- **"New Role"** - Requires `roles:manage`
- **"New Branch"** - Requires `branches:manage`
- **Delete icons** - Require corresponding write permissions

### Page Access

If you try to access a page without permission:
- You'll see **"Permission denied"** message
- Or be redirected to home page
- Check with your admin if you need access

## Permission Enforcement

Permissions are enforced in two places:

### 1. Backend (API)
- Every API endpoint checks your permissions
- Invalid requests return **403 Forbidden** error
- Ensures data security even if frontend is bypassed

### 2. Frontend (UI)
- Buttons and menus hidden based on permissions
- Prevents confusion and accidental unauthorized actions
- Provides better user experience

**Example:**
- User with VIEWER role (only `products:read`)
- Backend: Blocks POST /api/products with 403 error
- Frontend: Hides "New Product" button entirely

## Role Activity Tracking

### Accessing Activity

1. Open any role
2. Click the **"Activity"** tab

### What's Tracked

**Role changes:**
- Name updated - Shows before/after values
- Permissions changed - Lists added/removed permissions
- Role created - Initial setup
- Role deleted - Deletion record

**Actor information:**
- Who made each change
- When it occurred (date and time)

### Filtering Activity

Click **"Filters"** in Activity tab:
- **Date range** - Occurred from/to
- **Action type** - Created, Updated, Deleted
- **Actor** - Filter by specific user

### Use Cases

- Audit permission changes
- Track who modified roles
- Investigate security incidents
- Compliance reporting

## Permissions Required

**To view roles:**
- `roles:manage` permission

**To create/edit/delete roles:**
- `roles:manage` permission

**Default Role Access:**
- **OWNER** - Full access ✅
- **ADMIN** - No access ❌
- **EDITOR** - No access ❌
- **VIEWER** - No access ❌

If you can't see the Roles menu, contact your admin to request `roles:manage` permission.

## Best Practices

✅ **Use system roles first** - Start with OWNER, ADMIN, EDITOR, VIEWER before creating custom
✅ **Principle of least privilege** - Give users minimum permissions needed for their job
✅ **Name roles clearly** - "Stock Receiver" is better than "Role 1"
✅ **Review permissions regularly** - Audit roles quarterly to ensure they're still appropriate
✅ **Document custom roles** - Keep notes on why each custom role exists and who should have it
✅ **Test before assigning** - Create a test user with the role to verify permissions work as expected
✅ **Avoid permission creep** - Don't keep adding permissions to a role; create a new role instead

## Common Tasks

### Task: Create "Stock Manager" Role

**Scenario:** User needs to manage all inventory operations but not products.

1. Go to **Roles** page
2. Click **"New role"**
3. Name: "Stock Manager"
4. Select permissions:
   - stock:read
   - stock:write
   - stock:allocate
   - branches:manage (to see all locations)
5. Save

### Task: Find Roles with Product Write Access

1. Go to **Roles** page
2. Click **"Filters"**
3. In **Permissions** multiselect, select `products:write`
4. Keep match mode as "Any"
5. Click **"Apply"**

### Task: Duplicate ADMIN Role with Extra Permission

**Scenario:** Create a custom role like ADMIN but with `tenant:manage`.

1. Go to **Roles** page
2. Note ADMIN permissions (10 total)
3. Click **"New role"**
4. Name: "Senior Admin"
5. Select all ADMIN permissions:
   - products:read, products:write
   - users:manage
   - theme:manage, uploads:write
   - branches:manage, stock:read, stock:write, stock:allocate
   - reports:view
6. Add: `tenant:manage`
7. Save

### Task: Downgrade All Editors to Viewers

1. Go to **Users** page
2. Click **"Filters"**
3. In **Role** field, type "EDITOR"
4. Click **"Apply"**
5. For each user:
   - Click user email
   - Change **Role** to VIEWER
   - Save

### Task: Delete Unused Custom Roles

1. Go to **Roles** page
2. Click **"Filters"**
3. Set **System role** to "Custom"
4. Click **"Apply"**
5. For each role, click **trash icon** to delete
6. If error "Role is in use", reassign users first

## Troubleshooting

**"Permission denied" (403 error)**
- Your role lacks the required permission
- Contact admin to request the permission
- Admin may need to edit your role or assign you a different role

**Can't see Roles menu**
- You need `roles:manage` permission
- Only OWNER role has this by default
- Ask your admin to grant this permission

**Can't edit a role**
- System roles (OWNER, ADMIN, EDITOR, VIEWER) cannot be edited
- Custom roles can be edited by users with `roles:manage`
- Check if you have `roles:manage` permission

**Can't delete a role**
- System roles cannot be deleted
- Custom roles assigned to users cannot be deleted
- Reassign users to different roles first
- Then delete the custom role

**"Role is in use by users"**
- This role is assigned to one or more users
- Go to **Users** page
- Find users with this role (filter by role name)
- Change their role to something else
- Return to **Roles** page and delete

**Custom role permissions not working**
- Verify the role has the necessary permissions
- Check that user has the custom role assigned
- User may need to refresh browser (Ctrl+Shift+R)
- If still failing, check with admin

**User can't access feature after role change**
- New role may not have required permission
- Compare old role vs new role permissions
- Either restore old role or add permission to new role

**Too many custom roles**
- Consolidate similar roles
- Review if roles are still needed
- Delete unused roles to reduce complexity

## Security Tips

🔒 **Protect roles:manage** - Only give to trusted admins
🔒 **Audit permission changes** - Review role activity logs monthly
🔒 **Use VIEWER for external users** - Give read-only access to partners/auditors
🔒 **Document role purposes** - Keep notes on why each custom role exists
🔒 **Test in staging** - Try new roles in test environment first
🔒 **Principle of least privilege** - Start with minimal permissions, add as needed

## Related Guides

- [Managing Users](./managing-users.md) - Assigning roles to users
- [Managing Branches](./managing-branches.md) - Branch-based access control
- [Stock Transfers](../stock-transfers/creating-transfers.md) - Permission requirements
- [Viewing Stock](../inventory/viewing-stock.md) - Stock visibility and permissions
