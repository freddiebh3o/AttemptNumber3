# Managing Products

## Overview

Products are the items you buy, sell, stock, and transfer in your inventory system. Each product has a unique SKU, price, and optional barcode for tracking.

## Creating Products

### Step 1: Access the New Product Form

1. Navigate to the **Products** page from the main menu
2. Click the **"New product"** button (top right)

### Step 2: Enter Product Details

**Required Fields:**
- **Product Name** - The display name (1-200 characters)
  - Example: "Acme Anvil 50kg"
- **SKU** - Unique stock keeping unit code (1-100 characters)
  - Example: "ANV-50KG-001"
  - **Cannot be changed** after creation
  - Must be unique within your organization
- **Price (GBP)** - Selling price in British pounds
  - Example: £149.99
  - Must be ≥ £0.00

**Optional Fields:**
- **Barcode** - Product barcode number (if barcode feature is enabled)
  - Example: "5012345678900"
- **Barcode Type** - Select from dropdown:
  - EAN-13 (standard retail barcode)
  - UPC-A (North American)
  - CODE128 (alphanumeric)
  - QR Code

### Step 3: Save

Click **"Save"** to create the product.

**What Happens Next:**
- You're redirected to the new product's FIFO tab
- A welcome banner suggests setting initial stock levels
- You can now add opening inventory using "Adjust stock"

## Editing Products

### Opening a Product

From the Products page, click the **eye icon** on any product row.

### What You Can Edit

- **Product Name** - Update the display name
- **Price** - Change the selling price
- **Barcode** - Add, update, or remove barcode
- **Barcode Type** - Change barcode format

### What You CANNOT Edit

- **SKU** - Locked after creation to protect inventory integrity
  - If you need to change the SKU, create a new product

### Saving Changes

1. Make your changes in the form
2. Click **"Save"**
3. The product updates and you stay on the same page

### Optimistic Locking (Conflict Prevention)

The system prevents conflicting edits by multiple users:

- Each product has a **version number** (visible in Overview tab)
- When saving, the system checks if anyone else modified the product
- If someone else saved changes first, you'll see: **"The product was modified by someone else. Please reload and try again."**
- Simply reload the page to see the latest version and re-apply your changes

## Archiving Products

### What is Archiving?

**Archive** (soft delete) removes products from your active product list while preserving all historical data. Archived products can be restored at any time.

**Why Archive Instead of Delete?**
- Preserves complete audit trail and stock history
- Allows restoration if needed
- Keeps historical reporting accurate
- Protects data integrity

### How to Archive a Product

1. Open the product you want to archive (click the eye icon)
2. Click the **"Archive Product"** button (red button in the header)
3. Review the confirmation dialog
4. Click **"Archive"** to confirm

**What Happens:**
- Product is hidden from the active products list
- "Archived" badge appears on the product
- All stock history and data is preserved
- Product can be restored at any time

### Viewing Archived Products

To see archived products:

1. Open the **Products** page
2. Click the **"Filters"** button
3. In the **"Archived Status"** dropdown, select:
   - **"Active products only"** (default) - Shows only active products
   - **"Archived products only"** - Shows only archived products
   - **"All products (active + archived)"** - Shows everything
4. Click **"Apply filters"**

Archived products display an **"Archived"** badge next to their name.

### Restoring Archived Products

To restore an archived product:

1. Filter to view archived products (see above)
2. Open the archived product (click the eye icon)
3. Click the **"Restore"** button (blue button in the header)
4. Product returns to active status immediately

**What Happens:**
- Product reappears in your active products list
- "Archived" badge is removed
- All previous data remains intact
- Product can be edited and used normally

### When to Archive

Archive products that are:
- No longer sold or stocked
- Discontinued or obsolete
- Seasonal items out of season
- Being replaced by a different product

**Best Practice:** Archive products instead of deleting them to maintain data integrity and historical accuracy.

## Searching and Filtering Products

### Opening the Filter Panel

Click the **"Filters"** button on the Products page.

### Available Filters

**1. Search (Name or SKU)**
- Type any part of the product name or SKU
- Case-insensitive matching
- Example: Search "anvil" finds "Acme Anvil Product"

**2. Archived Status**
- **Active products only** (default) - Shows only products in active use
- **Archived products only** - Shows only archived products
- **All products (active + archived)** - Shows everything
- Archived products display an "Archived" badge

**3. Price Range**
- **Min price** - Minimum price in pounds (e.g., £50.00)
- **Max price** - Maximum price in pounds (e.g., £200.00)
- Finds products within this range (inclusive)

**4. Created Date Range**
- **Created from** - Start date
- **Created to** - End date
- Find products added within this timeframe

**5. Updated Date Range**
- **Updated from** - Start date
- **Updated to** - End date
- Find products modified within this timeframe

### Applying Filters

1. Select your filter criteria
2. Click **"Apply"**
3. Active filters appear as colored chips below the filter bar
4. Click **X** on any chip to remove that filter
5. Click **"Clear all"** to reset all filters

### Sorting Products

Click any column header to sort:
- **Name** - Alphabetical (A-Z or Z-A)
- **Price** - Low to high or high to low
- **Created** - Newest first or oldest first
- **Updated** - Most recently modified first

Click the same header again to reverse the sort direction.

## Viewing Product Details

### Product Tabs

When viewing a product, you'll see several tabs:

**1. Overview Tab**
- Product name, SKU, price
- Barcode and barcode type (if set)
- Entity version number (for tracking changes)

**2. Stock Levels Tab**
- Summary of stock across all branches
- Shows quantity on hand, allocated, and open lots per branch
- Read-only overview

**3. FIFO Tab**
- Detailed stock management for a specific branch
- Shows individual stock lots with costs and received dates
- Allows stock adjustments
- Displays full stock ledger (movement history)

**4. Activity Tab**
- Complete audit trail of changes
- Product edits (name, price, barcode changes)
- Stock movements (receipts, adjustments, consumption)
- Filterable by actor, date, and type

## Product Activity History

### Accessing Activity

1. Open any product (edit mode)
2. Click the **"Activity"** tab

### What's Tracked

**Product Changes:**
- Name updated: Shows before/after values
- Price changed: Shows old and new prices
- Barcode modified: Shows changes with before/after

**Stock Movements:**
- RECEIPT - Stock received into inventory
- ADJUSTMENT - Manual increase/decrease
- CONSUMPTION - Stock used/shipped
- REVERSAL - Transaction reversal

### Filtering Activity

Click **"Filters"** in the Activity tab:

- **Type** - All, Product changes only, or Stock movements only
- **Actor** - Filter by user who made the change
- **Date Range** - "Occurred from" and "Occurred to"

### Activity Views

**Table View** (default):
- When, Type, Summary, Actor columns
- Shows details of each change
- Sortable and paginated

**Timeline View**:
- Visual timeline layout
- Color-coded (blue = product changes, purple = stock)
- Same filtering options

## Pagination

**Viewing More Products:**
- Use **Prev** and **Next** buttons to navigate pages
- Change **items per page** (1-100, default: 20)
- Page indicator shows current position

**Range Text:**
- "Showing 1-20 of 150" when total is known
- "≈ Showing 1-20" when approximate

## Permissions Required

To manage products, you need:

- **`products:read`** - View products and details (including archived products)
- **`products:write`** - Create, edit, archive, and restore products

**Default Role Access:**
- **OWNER, ADMIN, EDITOR** - Full access (read + write)
- **VIEWER** - Read-only (cannot create/edit/archive/restore)

**Archive/Restore Permissions:**
- Archive and Restore buttons only appear if you have `products:write` permission
- Viewers can see archived products but cannot archive or restore them

If you can't see the "New product" or "Archive Product" buttons, contact your admin to request `products:write` permission.

## Best Practices

✅ **Use clear SKU naming** - Make SKUs meaningful (e.g., "ANVIL-50KG" not "PRD001")
✅ **Set accurate prices** - Price in the system should match your actual selling price
✅ **Add barcodes** - Speeds up receiving and transfers if barcode scanning is available
✅ **Archive instead of delete** - Preserves historical data and allows restoration if needed
✅ **Use the archived filter** - Review archived products periodically to ensure they should stay archived
✅ **Use filters** - Quickly find products instead of scrolling through pages
✅ **Check activity logs** - Investigate unexpected price changes or modifications

## Common Tasks

### Task: Update Multiple Product Prices

1. Filter products by category or name
2. Open each product one by one
3. Update the price
4. Save and move to the next

**Future Enhancement:** Bulk price update feature

### Task: Find All Products Created This Week

1. Click "Filters"
2. Set **Created from** to last Monday's date
3. Set **Created to** to today's date
4. Click "Apply"

### Task: Verify SKU Uniqueness

When creating a product, if you enter a duplicate SKU:
- System shows error: **"A product with this SKU already exists for this tenant"**
- Choose a different SKU

### Task: Check Who Changed a Product Price

1. Open the product (edit mode)
2. Click "Activity" tab
3. Filter by **Type: Product changes only**
4. Look for "Price changed" entries
5. Actor column shows who made the change

### Task: Archive Seasonal Products at End of Season

1. Use the search filter to find seasonal products (e.g., "summer")
2. Open each product one by one
3. Click "Archive Product" button
4. Confirm the archive action
5. Products are hidden from active list but data is preserved

### Task: Review and Restore Archived Products

1. Click "Filters" button
2. Select **"Archived products only"** from Archived Status dropdown
3. Click "Apply filters"
4. Review the list of archived products
5. Open any product you want to restore
6. Click the "Restore" button
7. Product returns to active status immediately

## Troubleshooting

**"Product not found" error**
- Product may have been archived
- Use the archived filter to check: Filters → "Archived products only"
- Check with your admin or review audit logs

**Can't see "Archive Product" button**
- You need `products:write` permission
- Contact your admin to request access
- Viewers can see products but cannot archive/restore them

**Can't find an archived product in the list**
- By default, only active products are shown
- Click "Filters" and select "Archived products only" or "All products"
- Archived products display an "Archived" badge

**"Permission denied" (403 error)**
- You need `products:write` permission for archive/restore actions
- Contact your admin

**"The product was modified by someone else"**
- Another user saved changes while you were editing
- Reload the page to see their changes
- Re-apply your edits and save again

**Can't change SKU**
- SKU is locked after creation to protect data integrity
- If you must change it, archive the old product and create a new one

**Barcode fields not visible**
- Barcode feature may be disabled
- Check with your admin about enabling the `barcodeScanningEnabled` feature flag

**Accidentally archived a product**
- Use the archived filter to find it
- Open the product and click "Restore"
- Product returns to active status immediately

**Related Guides:**
- [Product Barcodes](./product-barcodes.md) - Barcode scanning and lookup
- [Viewing Stock](../inventory/viewing-stock.md) - Checking product stock levels
- [Adjusting Stock](../inventory/adjusting-stock.md) - Managing product inventory
