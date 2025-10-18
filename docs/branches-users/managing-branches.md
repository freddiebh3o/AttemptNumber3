# Managing Branches

## Overview

Branches represent physical locations within your organization, such as warehouses, retail stores, or distribution centers. Each branch can have its own inventory, users, and stock movements.

## What is a Branch?

A branch is a location where:
- Stock is stored and managed
- Users are assigned to control access
- Transfers originate from or arrive at
- Stock reports are generated

**Examples:**
- "London Warehouse" - Central distribution warehouse
- "Paris Retail Store" - Customer-facing location
- "US East Distribution" - Regional fulfillment center

## Branch Properties

Each branch has:

**Slug** (Machine-Readable ID)
- 3-40 characters
- Lowercase letters, numbers, and hyphens only
- Must be unique within your organization
- Used in URLs and system references
- Example: `warehouse-london`, `retail-paris`

**Name** (Display Name)
- Human-readable branch name
- Shows in lists, reports, and transfers
- Example: "London Warehouse", "Paris Retail Store"

**Status**
- **Active** - Branch is operational and available for use
- **Inactive** - Branch is temporarily disabled but still accessible

## Creating a Branch

### Prerequisites

You need the **`branches:manage`** permission (available to OWNER and ADMIN roles by default).

### Step 1: Navigate to New Branch

1. Go to **Branches** page from the main menu
2. Click **"New Branch"** button (top right)

### Step 2: Enter Branch Details

The branch form has **only 3 fields**:

**Slug** (required)
- Enter a unique identifier (3-40 characters)
- Use lowercase letters, numbers, and hyphens only
- Example: `warehouse-main`
- **Note:** Avoid spaces or special characters

**Name** (required)
- Enter the display name
- Example: "Main Warehouse"

**Active** (toggle)
- Switch to set Active (ON) or Inactive (OFF)
- New branches are typically set to Active
- Default: Active (ON)

**Important:** There are no additional fields like address, contact details, or user assignments during branch creation. These are managed separately:
- **Address/Contact:** Not yet implemented in the system
- **User Assignments:** Done through the Users page (see [Managing Users](./managing-users.md))

### Step 3: Save

Click **"Save"** to create the branch.

**What Happens Next:**
- Branch is created with a unique ID
- You're redirected to the branch detail page
- Branch appears in the branches list
- Users can now be assigned to this branch

### Validation Errors

**"Slug must match pattern"**
- Slug contains invalid characters
- Use only lowercase letters (a-z), numbers (0-9), and hyphens (-)
- Example: `my-warehouse-01` ✅ | `My Warehouse!` ❌

**"A branch with this slug already exists"**
- Slug must be unique within your organization
- Choose a different slug
- Example: If `warehouse-1` exists, use `warehouse-2`

## Viewing and Editing Branches

### Opening a Branch

From the Branches page, click the **View** button (eye icon) next to any branch to open the branch detail page.

### What You Can Edit

- **Slug** - Change the identifier (updates URLs)
- **Name** - Update the display name
- **Status** - Activate or deactivate the branch

**Important:** Changing the slug updates all system references. The internal ID remains the same, so historical data is preserved.

### Saving Changes

1. Make your changes in the form
2. Click **"Save"**
3. Branch updates immediately
4. All users see the new values

### Branch Tabs

**Overview Tab**
- Edit slug, name, and status
- View created and updated timestamps

**Activity Tab**
- See complete audit trail
- Track who changed what and when
- Filter by date range or action type

## Listing Branches

### Viewing All Branches

Navigate to the **Branches** page to see all branches in your organization.

### Available Filters

Click **"Filters"** to access:

**Search (Name)**
- Search by branch name
- Case-insensitive partial matching
- Example: Search "warehouse" finds "London Warehouse"

**Status**
- Filter by Active or Inactive
- Shows both active and inactive branches

**Archive Filter**
- **Active branches only** (default) - Shows only branches that haven't been archived
- **Archived branches only** - Shows only archived branches
- **All branches (active + archived)** - Shows everything
- Default: Active branches only

**Created Date Range**
- From/To dates
- Find branches created in a specific timeframe

**Updated Date Range**
- From/To dates
- Find recently modified branches

### Sorting

Click column headers to sort by:
- **Name** - Alphabetical (A-Z or Z-A)
- **Created** - Newest or oldest first
- **Updated** - Recently modified first
- **Status** - Active first or inactive first

### Pagination

- **Items per page:** 1-100 (default: 20)
- **Navigation:** Prev/Next buttons
- **Current position:** "Showing 1-20 of 45"

## Archiving a Branch

### When to Archive

Archive a branch when:
- Location is permanently closed
- Branch is being consolidated with another location
- You want to hide old branches from active lists
- You need to "delete" a branch but preserve all historical data

**Important:** Archiving is a soft delete - the branch is hidden from active lists but all historical data (stock movements, transfers, user assignments) is preserved and can be restored at any time.

### How to Archive

1. Click the **View** button next to the branch (or open any branch detail page)
2. Click the **"Archive Branch"** button (red button with archive icon)
3. Review the confirmation modal:
   - "This branch will be hidden from your active branch list but can be restored at any time."
   - "All stock history, transfers, and user assignments will be preserved."
4. Click **"Archive"** to confirm

**Note:** You cannot archive branches from the list view. You must open the branch detail page first.

### What Happens When Archived

**Immediately:**
- Branch is hidden from the active branches list
- Branch shows an "Archived" badge when viewing
- Edit and Save buttons are hidden (branch becomes read-only)
- Branch no longer appears in dropdowns for new operations

**Preserved:**
- All historical stock movements remain intact
- Past transfers still reference the branch
- Stock ledger entries remain visible
- User branch memberships are preserved
- Complete audit trail is maintained

**Access:**
- Archived branches can still be accessed via direct URL
- Use the Archive Filter to view archived branches
- All historical data remains queryable in reports

## Restoring an Archived Branch

### When to Restore

Restore a branch when:
- Location has reopened
- Branch was archived by mistake
- You need to reactivate operations at that location

### How to Restore

1. Go to the **Branches** page
2. Click **"Filters"**
3. Set **Archive Filter** to **"Archived branches only"** or **"All branches"**
4. Click **"Apply"**
5. Find the archived branch (shows "Archived" badge)
6. Click the **View** button
7. Click the **"Restore"** button (blue button)
8. Branch is immediately restored and returned to active status

**Note:** Restoring a branch makes it available for new operations again. All preserved historical data remains intact.

## Branch Memberships

### What is Branch Membership?

Branch membership controls which users can access which branches. Users are assigned to branches to:
- View stock at that location
- Create transfers from/to that branch
- Receive shipments at that branch
- Adjust stock at that branch

### How Memberships Work

- A user can be assigned to **multiple branches**
- A user with **no branch assignments** may have limited access
- Branch membership is managed through the user edit page (not branch page)
- All stock operations require the user to be a member of the relevant branch

### Viewing Branch Members

Currently, there's no dedicated "Members" tab on the branch page. To see who has access to a branch:

1. Go to **Users** page
2. Look at the "Branches" column
3. Find users showing this branch as a badge

### Assigning Users to Branches

See [Managing Users - Assigning Users to Branches](./managing-users.md#assigning-users-to-branches)

## Branch Activity History

### Accessing Activity

1. Open any branch
2. Click the **"Activity"** tab

### What's Tracked

- **Branch created** - Who created it and when
- **Name changed** - Before/after values
- **Slug changed** - Before/after values
- **Status changed** - Activated or deactivated
- **Actor** - User who made each change

### Filtering Activity

Click **"Filters"** to narrow down:
- **Date range** - Occurred from/to
- **Action type** - Created, Updated, etc.
- **Actor** - Filter by specific user

### Activity Views

**Table View** (default)
- When, Type, Summary, Actor columns
- Shows before/after values
- Sortable and paginated

## Best Practices

✅ **Use descriptive slugs** - `warehouse-london` is better than `loc-01`
✅ **Keep names clear** - "London Warehouse" is better than "LW"
✅ **Archive instead of inactivate** - Use archive for permanently closed branches, keeps data intact
✅ **Use status toggle for temporary changes** - Set to Inactive for temporary closures, Active for operations
✅ **Archive preserves everything** - Stock history, transfers, and user assignments remain intact
✅ **Assign users to appropriate branches** - Controls access and visibility
✅ **Review activity logs** - Track changes and troubleshoot issues
✅ **Use consistent naming** - Follow a pattern like "City + Type" (e.g., "Paris Retail")
✅ **Filter to find archived branches** - Use Archive Filter to review or restore old branches

## Common Tasks

### Task: Create Multiple Branches

For bulk setup:
1. Plan your branch structure (slugs and names)
2. Create branches one by one using the form
3. Assign users to each branch after creation

**Future Enhancement:** Bulk branch import via CSV

### Task: Rename a Branch

1. Open the branch
2. Update the **Name** field
3. Optionally update the **Slug** if URL needs to change
4. Save

**Note:** Changing the slug updates URLs but preserves all historical data via internal ID.

### Task: Move Users Between Branches

1. Go to **Users** page
2. Open the user you want to reassign
3. Use the **Branches** multiselect to add/remove branches
4. Save

### Task: Find Archived Branches

1. Go to **Branches** page
2. Click **"Filters"**
3. Set **Archive Filter** to **"Archived branches only"**
4. Click **"Apply"**
5. View all archived branches with "Archived" badges

### Task: Archive Multiple Branches

1. Open each branch detail page individually
2. Click **"Archive Branch"** button
3. Confirm the archive action
4. Repeat for each branch

**Note:** There's no bulk archive feature yet. Each branch must be archived individually.

### Task: Restore an Archived Branch

1. Go to **Branches** page
2. Click **"Filters"**
3. Set **Archive Filter** to **"Archived branches only"**
4. Click **"Apply"**
5. Click **View** button on the archived branch
6. Click **"Restore"** button
7. Branch is immediately restored

### Task: View All Branches (Active and Archived)

1. Go to **Branches** page
2. Click **"Filters"**
3. Set **Archive Filter** to **"All branches (active + archived)"**
4. Click **"Apply"**
5. Active and archived branches both appear (archived ones have badges)

## Permissions Required

**To view branches:**
- `branches:manage` permission

**To create/edit/deactivate branches:**
- `branches:manage` permission

**Default Role Access:**
- **OWNER** - Full access ✅
- **ADMIN** - Full access ✅
- **EDITOR** - No access ❌
- **VIEWER** - No access ❌

If you can't see the Branches menu or "New Branch" button, contact your admin to request `branches:manage` permission.

## Troubleshooting

**"Slug must be lowercase, numbers, hyphen (3–40 chars)"**
- Remove spaces, uppercase letters, and special characters
- Valid: `warehouse-1`, `retail-ny`
- Invalid: `Warehouse 1`, `retail_NY!`

**"A branch with this slug already exists"**
- Slugs must be unique
- Try: `warehouse-london-2` or `warehouse-east-london`
- Check existing branches to avoid conflicts

**"Permission denied" (403 error)**
- You need `branches:manage` permission
- Contact your admin (OWNER or ADMIN role)

**"Branch not found" (404 error)**
- Branch may have been deleted
- Check the branches list
- Verify you're in the correct organization

**Can't delete a branch**
- There's no permanent deletion (by design)
- Use the **"Archive Branch"** button on the branch detail page
- Archived branches are hidden from active lists but data is preserved
- Archived branches can be restored at any time

**Branch appears in some places but not others**
- Check if branch is **Archived**
- Archived branches are hidden from active lists and dropdowns
- Use the Archive Filter to view archived branches
- Restore the branch if it should be active

**Can't edit an archived branch**
- This is by design - archived branches are read-only
- Click the **"Restore"** button first to enable editing
- Once restored, you can edit the branch normally

**Archived branch not appearing in list**
- Default view shows only active branches
- Click **"Filters"** and change **Archive Filter** to **"Archived branches only"** or **"All branches"**
- Click **"Apply"** to see archived branches

## Related Guides

- [Managing Users](./managing-users.md) - Assigning users to branches
- [Roles & Permissions](./roles-permissions.md) - Understanding branch access control
- [Stock Transfers](../stock-transfers/creating-transfers.md) - Using branches in transfers
- [Viewing Stock](../inventory/viewing-stock.md) - Branch-specific stock levels
