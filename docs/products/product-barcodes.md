# Product Barcodes

## Overview

Barcodes allow you to quickly identify products during receiving, transfers, and stock management. The system supports multiple barcode formats and provides barcode lookup functionality.

**Note:** Barcode features are only available if your organization has enabled the `barcodeScanningEnabled` feature flag. Contact your admin if you don't see barcode fields.

## Supported Barcode Types

The system supports four barcode formats:

### 1. EAN-13 (European Article Number)
- **Format:** 13-digit number
- **Example:** 5012345678900
- **Use Case:** Most common for retail products worldwide
- **Best For:** Consumer packaged goods, grocery items

### 2. UPC-A (Universal Product Code)
- **Format:** 12-digit number
- **Example:** 012345678905
- **Use Case:** Standard in North America
- **Best For:** Retail products sold in the US/Canada

### 3. CODE128 (Code 128)
- **Format:** Variable-length alphanumeric
- **Example:** ABC-12345 or XYZ789
- **Use Case:** Warehouse, logistics, internal inventory
- **Best For:** Custom product codes, internal SKUs

### 4. QR Code
- **Format:** 2D matrix barcode
- **Example:** Can encode URLs, text, or product identifiers
- **Use Case:** Mobile scanning, high data density
- **Best For:** Products with extensive metadata or app integration

## Adding Barcodes to Products

### During Product Creation

1. Navigate to **Products** page
2. Click **"New product"**
3. Fill in required fields (name, SKU, price)
4. **Barcode** field - Enter the barcode number
   - Example: 5012345678900
5. **Barcode Type** - Select from dropdown
   - Choose EAN-13, UPC-A, CODE128, or QR Code
6. Click **"Save"**

### Adding Barcode to Existing Product

1. Open the product (click eye icon from product list)
2. In the edit form, find the **Barcode** field
3. Enter the barcode number
4. Select the **Barcode Type** from dropdown
5. Click **"Save"**

### Barcode Validation

**Uniqueness Requirement:**
- Barcodes must be unique within your organization
- If you enter a duplicate barcode, you'll see: **"A product with this barcode already exists for this tenant"**
- Each barcode can only be assigned to one product

**Format Requirements:**
- Maximum length: 100 characters
- No special validation for barcode number format (system trusts your input)
- Barcode type is required if barcode number is provided

## Using Barcode Lookup

### Quick Product Lookup

The system provides a barcode lookup API for scanning or entering barcodes to find products.

**Endpoint:** `/api/products/by-barcode/{barcode}`

**How It Works:**
1. Scan or type a barcode value
2. System searches for matching product in your organization
3. Returns product details instantly
4. Optionally includes stock level for a specific branch

**Example Use Cases:**
- Receiving shipments - scan to verify product
- Stock transfers - scan to add items quickly
- Inventory counts - scan to identify products

### Barcode Lookup with Stock Information

When looking up a barcode, you can optionally request current stock levels:

**Query Parameter:** `?branchId={branchId}`

**Example:**
- Lookup barcode: 5012345678900
- At branch: Warehouse location
- Returns: Product details + current qty on hand at that warehouse

**Benefits:**
- See if stock is available before creating a transfer
- Verify received quantities against expected stock levels
- Quick stock checks during cycle counts

## Barcode Integration Points

### 1. Stock Receiving

When receiving stock into a branch:
- Scan product barcode
- System identifies the product automatically
- Enter received quantity
- System creates stock lot with current date

**Workflow:**
1. Open receiving interface
2. Scan barcode using handheld scanner or mobile device
3. System looks up product via barcode
4. Confirm quantity and unit cost
5. Complete receipt

### 2. Stock Transfers

During transfer creation and fulfillment:

**Creating Transfers:**
- Scan barcode to add products to transfer request
- Faster than searching by name or SKU

**Shipping Transfers:**
- Scan each item during picking
- Verify you're shipping the correct products
- Reduce picking errors

**Receiving Transfers:**
- Scan incoming items
- Match against expected transfer items
- Flag discrepancies immediately

### 3. Product Search

Barcodes are searchable alongside product name and SKU:

1. Go to **Products** page
2. Click **"Filters"**
3. In the search box, enter the barcode number
4. System finds products matching the barcode

**Behavior:**
- Searches barcode field just like name/SKU
- Case-insensitive matching
- Partial matches supported

## Editing Barcodes

### Changing a Barcode

1. Open the product (edit mode)
2. Update the **Barcode** field with new number
3. Update **Barcode Type** if the format changed
4. Click **"Save"**

**Important:**
- Ensure the new barcode is unique
- Old barcode is no longer linked to this product
- Product history will show the barcode change

### Removing a Barcode

1. Open the product
2. Clear the **Barcode** field (delete the text)
3. Barcode Type becomes optional and can be cleared
4. Click **"Save"**

**Effect:**
- Product no longer has a barcode
- Cannot be looked up via barcode scan
- Can re-add a barcode later

## Barcode Best Practices

✅ **Use standard formats** - EAN-13 or UPC-A for retail products that have official barcodes
✅ **Generate internal codes** - Use CODE128 for custom products without official barcodes
✅ **Test scans first** - Verify barcode scans correctly before printing labels
✅ **Keep barcodes consistent** - Don't change barcodes unless absolutely necessary
✅ **Document barcode source** - Note where official barcodes came from (supplier, GS1, etc.)
✅ **Print high quality labels** - Poor print quality causes scan failures

## Common Barcode Workflows

### Workflow: Adding Barcodes to Existing Products

**Scenario:** You have 100 products without barcodes and need to add them.

1. Obtain official barcodes (from GS1 or supplier)
2. Create a spreadsheet mapping SKU → Barcode
3. For each product:
   - Open product by SKU
   - Enter barcode number
   - Select barcode type
   - Save
4. Test barcode lookup for a few products to verify

### Workflow: Barcode Scanning During Receiving

**Scenario:** Receiving a shipment of mixed products.

1. Open receiving interface (future feature)
2. For each box:
   - Scan product barcode
   - System displays product name and current stock
   - Enter quantity received
   - Confirm unit cost
   - Submit receipt
3. Repeat for all items
4. Review total received quantity

### Workflow: Using Barcodes for Inventory Counts

**Scenario:** Physical inventory count using barcode scanner.

1. Generate count sheet with expected products per location
2. Walk through warehouse with scanner
3. For each item:
   - Scan barcode
   - Enter counted quantity
   - System compares to expected
4. Flag discrepancies for investigation
5. Adjust stock based on count results

## Troubleshooting

**"Barcode fields not visible"**
- Barcode feature may be disabled
- Check with admin about `barcodeScanningEnabled` feature flag
- Once enabled, refresh the page

**"A product with this barcode already exists"**
- Barcode must be unique per organization
- Check if the barcode is already assigned to another product
- Use product search with the barcode to find the existing product
- Consider if you need to update the existing product instead

**"Barcode not scanning"**
- Verify barcode type matches the actual barcode format
  - EAN-13 barcodes won't scan if marked as UPC-A
- Check label print quality (smudges, fading)
- Ensure scanner is configured for the correct barcode types
- Try manual entry to verify the barcode number is correct

**"Barcode lookup returns no results"**
- Double-check the barcode number for typos
- Verify the product exists in your system
- Check that the barcode field is populated (not empty)
- Confirm you're in the correct tenant/organization

**"Can't decide which barcode type to use"**
- **Have official retail barcode?** → Use EAN-13 (Europe) or UPC-A (North America)
- **Custom/internal products?** → Use CODE128 (flexible format)
- **Need to encode extra data?** → Use QR Code
- **Not sure?** → Contact your supplier or use CODE128 as default

## Barcode Label Printing (Future)

Planned features for barcode management:

- **Label generation** - Print barcode labels from product page
- **Bulk label printing** - Generate labels for multiple products
- **Custom templates** - Design label layouts with product info
- **Mobile scanning** - Use smartphone camera to scan barcodes
- **Batch barcode assignment** - Upload CSV to add barcodes to many products at once

## Security and Permissions

**Barcode Viewing:**
- Requires `products:read` permission
- All users who can view products can see barcodes

**Barcode Editing:**
- Requires `products:write` permission
- Same permission as editing product name/price

**Barcode Lookup API:**
- Requires authentication (logged in user)
- Respects tenant isolation (only finds products in your organization)
- Branch-specific stock requires branch membership

## Related Guides

- [Managing Products](./managing-products.md) - Creating and editing products
- [Stock Receiving](../stock-transfers/receiving-transfers.md) - Using barcodes during receiving
- [Stock Transfers](../stock-transfers/creating-transfers.md) - Barcode scanning in transfers
- [Inventory Management](../inventory/viewing-stock.md) - Stock levels and lot tracking
