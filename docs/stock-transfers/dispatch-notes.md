# Dispatch Notes (PDFs)

**What you'll learn:**
- What dispatch notes are and why they're important
- How to view, download, and print dispatch notes
- When dispatch notes are generated
- How to regenerate a dispatch note if needed

---

## What Are Dispatch Notes?

Dispatch notes are PDF documents that automatically generate when you ship a stock transfer. They provide physical documentation of what was shipped, serving as:

- **Packing slips** to include with the shipment
- **Audit records** for compliance and tracking
- **Proof of shipment** with exact quantities and costs
- **Inventory reconciliation** documents

Each dispatch note includes:
- Transfer number and shipment date
- Source and destination branch details
- Complete list of shipped items (name, SKU, quantity)
- Lot numbers for traceability
- Unit costs (FIFO-calculated)
- Your company branding (logo, colors)
- Who shipped the items and when

---

## When Are Dispatch Notes Created?

Dispatch notes are **automatically generated** when:
- You ship a transfer (status changes to IN_TRANSIT)
- All approved items are shipped (partial shipments don't trigger PDF until complete)

The PDF generates in the background (takes 1-3 seconds) and becomes available immediately on the transfer detail page.

---

## Viewing Dispatch Notes

### Step 1: Find the Transfer

1. Go to **Stock Management** → **Stock Transfers**
2. Open any transfer with status:
   - **IN_TRANSIT** (cyan)
   - **PARTIALLY_RECEIVED** (purple)
   - **COMPLETED** (green)

### Step 2: View the PDF

1. Look for the **"View Dispatch Note"** button (appears after shipment)
2. Click the button
3. PDF preview modal opens with embedded viewer

**What you see:**
- Full dispatch note PDF displayed in browser
- Download button (saves PDF to your computer)
- Print button (opens browser print dialog)
- Close button (closes the preview)

---

## Downloading Dispatch Notes

### For Your Records

1. Click **"View Dispatch Note"** on the transfer
2. In the preview modal, click **"Download"**
3. PDF saves to your downloads folder as `TRF-2025-XXXX.pdf`

**Use cases:**
- Attach to email for destination branch
- Print and include with physical shipment
- Archive for compliance (keep 7 years for UK tax purposes)
- Include in month-end inventory reports

---

## Printing Dispatch Notes

### To Include with Shipment

**Option 1: Print from Preview**
1. Click **"View Dispatch Note"** on the transfer
2. Click **"Print"** button in modal
3. Browser print dialog opens
4. Select printer and print

**Option 2: Download Then Print**
1. Download the PDF (see above)
2. Open downloaded file
3. Print using your PDF viewer (Adobe, browser, etc.)

**Pro tip:** Print 2 copies - one for the shipment box, one for your records.

---

## Regenerating Dispatch Notes

Sometimes you need to regenerate a dispatch note (for example, if your company branding changed or there was a data correction).

### Who Can Regenerate

**Permission required:** `stock:write` (Editor role or higher)

### When to Regenerate

- Company logo or branding updated
- Noticed an error in the original PDF
- Template was improved (better formatting, more details)

**Note:** Regenerating creates a new PDF with current data. The old PDF is replaced (not versioned).

### How to Regenerate

1. Open the transfer detail page
2. Look for **"Regenerate PDF"** button (next to "View Dispatch Note")
3. Click the button
4. New PDF generates (takes 1-3 seconds)
5. Success notification appears
6. "View Dispatch Note" now shows the new PDF

---

## Technical Details

### Storage

- PDFs stored in secure cloud storage (Supabase)
- Each tenant has isolated storage (you can't see other companies' PDFs)
- File naming: `TRF-2025-0001.pdf` (transfer number)
- Files persist indefinitely for audit compliance

### Security

- **Authentication required:** Must be logged in to view
- **Permission-based:** Need `stock:read` to view, `stock:write` to regenerate
- **Multi-tenant isolation:** Can only access your company's PDFs

### Performance

- PDF generation adds 1-3 seconds to shipping workflow
- Subsequent views are instant (PDF already generated)
- Download and print are standard browser operations

---

## Common Questions

**Q: Can I view dispatch notes for old transfers?**
A: Yes. Any transfer that was shipped has a dispatch note available. Click "View Dispatch Note" on any completed transfer.

**Q: What if the dispatch note didn't generate?**
A: Rare, but if it fails, you'll see an error message. Contact your admin to regenerate it using the "Regenerate PDF" button.

**Q: Can I customize what appears on the dispatch note?**
A: The template is standardized, but your company branding (logo, colors, name) is automatically included. Contact your admin to update branding in Settings.

**Q: Why don't I see the "View Dispatch Note" button?**
A: The button only appears after a transfer is shipped (status IN_TRANSIT or later). Transfers in REQUESTED or APPROVED status don't have dispatch notes yet.

**Q: Can destination branch users view the dispatch note?**
A: Yes. Anyone with `stock:read` permission can view dispatch notes for transfers they have access to.

**Q: Does regenerating change the transfer data?**
A: No. Regenerating only creates a new PDF from the current transfer data. It doesn't change quantities, costs, or any transfer details.

**Q: Can I delete a dispatch note?**
A: No. Dispatch notes are permanent for audit compliance. If there's an issue, regenerate it with corrected data.

**Q: How long are dispatch notes kept?**
A: Indefinitely. They're stored in cloud storage and available as long as the transfer exists in the system.

---

## Best Practices

### For Source Branch (Shipping)

1. **Print before packing:** Generate and print dispatch note before packing items
2. **Include in shipment:** Place printed copy in box (waterproof bag recommended)
3. **Keep copy:** Download PDF for your records before shipping
4. **Check accuracy:** Review dispatch note for correct quantities before shipping

### For Destination Branch (Receiving)

1. **Match to shipment:** Compare physical items to dispatch note
2. **Report discrepancies:** If received quantities don't match, document before receiving in system
3. **File for records:** Keep dispatch note with receiving paperwork

### For Audit/Compliance

1. **Monthly archives:** Download all dispatch notes at month-end
2. **Retention policy:** Keep for 7 years (UK tax requirement)
3. **Include in audits:** Provide dispatch notes when auditors request shipment proof

---

## Related Guides

- [Shipping Transfers](shipping-transfers.md) - How to ship and trigger dispatch note generation
- [Receiving Transfers](receiving-transfers.md) - Using dispatch notes when receiving
- [Overview](overview.md) - Understanding the full transfer workflow

---

## Need More Help?

Contact your admin or ask the chat assistant.
