# Managing Users

## Overview

Users are people in your organization who need access to the inventory system. Each user has an email address, password, role (which defines their permissions), and branch assignments (which control their location access).

## Understanding User Access

A user's access is controlled by two things:

1. **Role** - Defines what actions they can perform (view products, create transfers, manage users, etc.)
2. **Branch Assignments** - Defines which locations they can access (warehouses, stores, etc.)

**Example:**
- **Sarah** has the **EDITOR** role and is assigned to **London Warehouse**
  - She can create products and adjust stock (role permissions)
  - She can only see stock and create transfers for London Warehouse (branch assignment)

## User Properties

**Email Address**
- Unique identifier for the user
- Used for login
- Must be a valid email format
- Example: sarah@company.com

**Password**
- Minimum 8 characters
- Set during user creation
- Can be reset later

**Role**
- One role per user (in this organization)
- Defines permissions (what they can do)
- Examples: OWNER, ADMIN, EDITOR, VIEWER, or custom roles

**Branch Assignments**
- Zero or more branches
- Controls which locations they can access
- Users with no branches may have limited functionality

## Inviting a User

### Prerequisites

You need the **`users:manage`** permission (available to OWNER and ADMIN roles by default).

### Step 1: Navigate to New User

1. Go to **Users** page from the main menu
2. Click **"New User"** or **"Invite User"** button

### Step 2: Enter User Details

**Email** (required)
- Enter the user's email address
- This will be their username for login
- Example: john.smith@company.com

**Password** (required)
- Set initial password (minimum 8 characters)
- User can change this after first login
- Example: Welcome123!

**Role** (required)
- Select from dropdown (OWNER, ADMIN, EDITOR, VIEWER, or custom roles)
- Determines what permissions they have
- See [Roles & Permissions](./roles-permissions.md) for details

**Branches** (optional)
- Use multiselect to assign user to one or more branches
- Leave empty if user doesn't need branch-specific access
- Can be changed later

### Step 3: Save

Click **"Save"** or **"Send Invite"** to create the user.

**What Happens Next:**
- User account is created
- User can now log in with their email and password
- They see only the features their role permits
- They see stock/transfers only for their assigned branches

### Validation Errors

**"Email is required" or "Invalid email format"**
- Enter a valid email address
- Example: user@company.com ✅ | usercompany ❌

**"Password must be at least 8 characters"**
- Choose a longer password
- Example: Welcome123! ✅ | pass ❌

**"A user with this email already exists"**
- Email is already in use in your organization
- Edit the existing user instead
- Or use a different email address

## Editing a User

### Opening a User

From the Users page, click the user's email or view icon.

### What You Can Edit

**Email Address**
- Change the user's email/login
- Updates their username

**Password** (optional)
- Leave blank to keep current password
- Enter a new password to reset it
- Minimum 8 characters

**Role**
- Change their permissions by selecting a different role
- Changes take effect immediately

**Branches**
- Add or remove branch assignments
- Use multiselect dropdown
- Changes affect what stock and transfers they can see

### Saving Changes

1. Make your changes
2. Click **"Save"**
3. Changes apply immediately
4. User may need to refresh their browser to see permission changes

### User Tabs

**Overview Tab**
- Edit email, password, role, branches

**Activity Tab**
- See audit trail of user's actions
- Track what they've created/updated
- Filter by date range or action type

## Listing Users

### Viewing All Users

Navigate to the **Users** page to see everyone in your organization.

### Table Columns

- **Email** - User's login email
- **Role** - Single badge showing assigned role
- **Branches** - Badges for each assigned branch
  - Active branches shown in color
  - Inactive branches shown grayed out
- **Created** - When user was added
- **Updated** - Last modification date
- **Actions** - View, Remove buttons

### Available Filters

Click **"Filters"** to access:

**Search (Email)**
- Search by email address
- Case-insensitive partial matching
- Example: Search "john" finds john.smith@company.com

**Role** (contains)
- Filter by role name (text search)
- Example: Search "ADMIN" finds users with ADMIN role

**Show users** (Archive filter)
- **Active users only** (default) - Shows only active users
- **Archived users only** - Shows only archived users
- **All users (active + archived)** - Shows all users
- Archived users display a gray "Archived" badge

**Created Date Range**
- From/To dates
- Find users added in a specific timeframe

**Updated Date Range**
- From/To dates
- Find recently modified users

### Sorting

Click column headers to sort by:
- **Email** - Alphabetical
- **Role** - Role name alphabetical
- **Created** - Newest or oldest first
- **Updated** - Recently modified first

## Assigning Users to Branches

### Why Assign Users to Branches?

Branch assignments control:
- Which locations' stock users can view
- Which branches they can create transfers from/to
- Which locations they can receive shipments at
- Which branches they can adjust stock for

### How to Assign

**During User Creation:**
1. In the "Branches" field, use the multiselect dropdown
2. Select one or more branches
3. Save

**For Existing Users:**
1. Open the user (edit mode)
2. Find the "Branches" multiselect field
3. Add or remove branches
4. Save

### What Happens

**User assigned to "London Warehouse":**
- Can view stock levels at London Warehouse
- Can create transfers FROM London Warehouse
- Can receive transfers AT London Warehouse
- Can adjust stock at London Warehouse
- **Cannot** access other branches unless also assigned to them

**User with no branch assignments:**
- May have limited functionality
- Can view organization-wide data (if permissions allow)
- Cannot perform branch-specific operations (transfers, stock adjustments)

### Viewing User's Branches

In the users list, the "Branches" column shows all assigned branches as badges:
- **Blue/colored badges** - Active branches
- **Gray badges** - Inactive branches (still assigned but hidden in operations)

## Changing a User's Role

### When to Change Roles

- Promoting a user (EDITOR → ADMIN)
- Adjusting permissions (VIEWER → EDITOR)
- Removing access (any role → VIEWER for read-only)

### How to Change

1. Open the user
2. In the **Role** dropdown, select the new role
3. Click **"Save"**
4. Changes apply immediately

**Important:** User's permissions update instantly. They may need to refresh their browser to see UI changes.

### Permission Changes

**Upgrading (VIEWER → EDITOR):**
- User gains new permissions
- New buttons and features appear
- Can now perform actions previously blocked

**Downgrading (ADMIN → EDITOR):**
- User loses permissions
- Some buttons may disappear
- Actions they previously could do are now blocked

## Resetting a User's Password

### How to Reset

1. Open the user (edit mode)
2. In the **Password** field, enter a new password
   - Leave blank to keep current password
   - Enter text to change it
3. Click **"Save"**

**Security Note:** The user should change this password after their next login.

### Temporary Passwords

When resetting for a user:
1. Generate a strong temporary password
2. Communicate it securely (don't email plain text)
3. Instruct them to change it immediately after login

## Archiving a User

### What is Archiving?

**Archiving** is a safe way to deactivate a user's access while preserving all their historical data and audit trails. Unlike permanent deletion, archived users:

- **Cannot sign in** to the organization
- Are **hidden from active user lists** by default
- Have **all historical data preserved** (stock movements, transfers, audit logs)
- Can be **restored at any time** if needed

**Use archiving when:**
- An employee leaves the company
- A contractor's engagement ends
- Access should be temporarily revoked
- You want to preserve complete audit trail

### How to Archive

1. Open the user's detail page (click their email from the Users list)
2. Click the **"Archive User"** button (red button with archive icon)
3. Review the confirmation dialog:
   - "This user membership will be deactivated and the user will not be able to sign in."
   - "All history and related data will be preserved and this membership can be restored at any time."
4. Click **"Archive"** to confirm

**Confirmation Required:** A modal dialog appears to prevent accidental archival.

### What Happens When You Archive

✅ **User is deactivated:**
- Cannot sign in to your organization anymore
- Receives clear error message if sign-in attempted: "Invalid credentials or your membership has been archived"
- Removed from tenant switcher dropdown (if they have other tenants)

✅ **Data is preserved:**
- All audit logs remain intact
- Stock movements they created are preserved
- Transfers they created/approved are preserved
- Activity history is fully accessible
- Can view their historical data from the detail page

✅ **User is hidden by default:**
- Not shown in the Users list (unless filter changed)
- Not selectable in forms or dropdowns
- Appears as "Archived" in their user detail page

### Cannot Archive Yourself

You cannot archive your own user membership (button is hidden). This prevents accidental lockout. Ask another admin to archive your account if necessary.

### Viewing Archived Users

By default, the Users list shows only **active users**. To see archived users:

1. Go to the **Users** page
2. Click **"Filters"**
3. Find the **"Show users"** dropdown
4. Select one of:
   - **"Active users only"** (default) - Hides archived users
   - **"Archived users only"** - Shows only archived users
   - **"All users (active + archived)"** - Shows everyone

**Archived Badge:** Archived users display a gray **"Archived"** badge next to their email in the table.

### Restoring an Archived User

If a user needs to be reactivated (e.g., employee returns, contractor renewed):

1. Filter to show archived users (see above)
2. Click the archived user's email to open their detail page
3. You'll see:
   - Gray **"Archived"** badge in the header
   - Yellow warning alert: "This user membership has been archived and cannot sign in"
   - Blue **"Restore"** button
4. Click **"Restore"**
5. User is immediately reactivated

**What Happens:**
- User can sign in again immediately
- User reappears in active user lists
- All their historical data remains intact
- No data loss from archive/restore cycle

### Archive vs Delete

**Archive (Recommended):**
- ✅ User cannot sign in
- ✅ All data preserved
- ✅ Can be reversed anytime
- ✅ Audit trail intact
- ✅ Safe for users with stock/transfer history

**Delete (Not Available):**
- ❌ Permanently removes membership
- ❌ Cannot be undone
- ❌ May break audit trail references
- ❌ Not available for users with related records

**Best Practice:** Always use archive instead of delete for user deactivation.

## User Activity Tracking

### Accessing Activity

1. Open any user
2. Click the **"Activity"** tab

### What's Tracked

- **Products created/updated** - Shows what products user managed
- **Stock adjustments** - Tracks inventory changes user made
- **Transfers created** - Shows transfer requests user initiated
- **User account changes** - Email updates, role changes, branch reassignments

### Filtering Activity

Click **"Filters"** to narrow down:
- **Date range** - Occurred from/to
- **Action type** - Created, Updated, etc.
- **Entity type** - Products, Transfers, Stock, etc.

### Use Cases

- Investigate who made a change
- Audit user actions for compliance
- Review user productivity
- Troubleshoot data issues

## Permissions Required

**To view users:**
- `users:manage` permission

**To create/edit/remove users:**
- `users:manage` permission

**Default Role Access:**
- **OWNER** - Full access ✅
- **ADMIN** - Full access ✅
- **EDITOR** - No access ❌
- **VIEWER** - No access ❌

If you can't see the Users menu or "New User" button, contact your admin to request `users:manage` permission.

## Best Practices

✅ **Assign appropriate roles** - Don't give OWNER to everyone; use VIEWER for read-only access
✅ **Limit branch assignments** - Only assign branches user actually needs
✅ **Use strong passwords** - Minimum 8 chars, include numbers/symbols
✅ **Archive instead of delete** - Use archive for departing employees (preserves audit trail)
✅ **Review users regularly** - Archive inactive users to maintain security
✅ **Track activity** - Use activity logs to audit user actions
✅ **Document role changes** - Note why you promoted/downgraded users
✅ **Periodic access review** - Monthly audit of archived vs active users

## Common Tasks

### Task: Promote a User

**Scenario:** User needs more permissions.

1. Open the user
2. Change **Role** from EDITOR to ADMIN
3. Save

### Task: Restrict a User to Read-Only

**Scenario:** User should only view data, not make changes.

1. Open the user
2. Change **Role** to VIEWER
3. Save

### Task: Archive a Departing Employee

**Scenario:** Employee leaves the company, needs access removed.

1. Open the user's detail page
2. Click **"Archive User"**
3. Review confirmation dialog
4. Click **"Archive"** to confirm
5. User can no longer sign in

**Result:** User deactivated, all historical data preserved.

### Task: Restore a Returning Employee

**Scenario:** Contractor returns after 6 months, needs access restored.

1. Go to **Users** page
2. Click **"Filters"**
3. Change **"Show users"** to **"Archived users only"**
4. Click **"Apply"**
5. Find and click the user
6. Click **"Restore"** button
7. User can sign in immediately

### Task: Find All Archived Users

1. Go to **Users** page
2. Click **"Filters"**
3. In **"Show users"** dropdown, select **"Archived users only"**
4. Click **"Apply"**

### Task: Move User to Different Branch

**Scenario:** User transferred from London to Paris location.

1. Open the user
2. In **Branches** multiselect:
   - Deselect "London Warehouse"
   - Select "Paris Warehouse"
3. Save

### Task: Find All Admins

1. Go to **Users** page
2. Click **"Filters"**
3. In **Role** field, type "ADMIN"
4. Click **"Apply"**

### Task: Find Users Without Branch Assignments

Currently no direct filter. Review the "Branches" column and look for empty entries.

### Task: Bulk User Import

**Current State:** Not yet available.
**Workaround:** Create users one by one using the form.
**Future Enhancement:** CSV import for bulk user creation.

## Troubleshooting

**"Email is required" or "Invalid email format"**
- Use a valid email: user@company.com
- Don't use invalid formats like "user" or "user@"

**"Password must be at least 8 characters"**
- Use longer passwords
- Example: Welcome2024!

**"A user with this email already exists"**
- Email already in use in this organization
- Edit existing user or use different email
- Check if user was previously removed and needs re-invitation

**"Permission denied" (403 error)**
- You need `users:manage` permission
- Contact OWNER or ADMIN to grant access

**"User not found" (404 error)**
- User may have been removed
- Verify you're in the correct organization
- Check spelling of user ID/email

**User can't see certain features**
- Check their **Role** - They may lack permissions
- Check their **Branch assignments** - They may not be assigned to required branches
- Have them refresh their browser after role/branch changes

**User can't access specific branch**
- Verify user is assigned to that branch
- Edit user → check **Branches** multiselect
- Save if changes needed

**Password reset not working**
- Ensure password is at least 8 characters
- Try a different password
- Check for special character requirements (if any)

**Can't archive a user**
- You cannot archive yourself (button is hidden for your own account)
- Ask another admin with `users:manage` permission
- Verify you have the correct permissions

**"Invalid credentials or your membership has been archived"**
- User account has been archived and cannot sign in
- Contact admin to restore the user if access needed
- Admin: Filter for archived users and click Restore

**Cannot see "Archive User" button**
- You may lack `users:manage` permission
- Button is hidden for your own user account (self-protection)
- Contact OWNER or ADMIN for access

**Archived user still appears in list**
- Check archive filter - ensure it's set to "Active users only"
- Clear all filters and reapply
- Refresh the page

## Security Tips

🔒 **Use unique passwords** - Don't reuse passwords across accounts
🔒 **Review permissions regularly** - Audit user roles quarterly
🔒 **Archive inactive users** - Archive (not delete) accounts for users who left
🔒 **Verify archived status** - Periodically check that archived users cannot sign in
🔒 **Limit OWNER role** - Only assign to trusted executives
🔒 **Monitor activity logs** - Watch for suspicious behavior
🔒 **Use principle of least privilege** - Give minimum necessary permissions
🔒 **Restore carefully** - Verify user identity before restoring archived accounts

## Related Guides

- [Roles & Permissions](./roles-permissions.md) - Understanding what each role can do
- [Managing Branches](./managing-branches.md) - Creating and managing locations
- [Stock Transfers](../stock-transfers/creating-transfers.md) - How branch assignments affect transfers
- [Viewing Stock](../inventory/viewing-stock.md) - Branch-specific stock visibility
