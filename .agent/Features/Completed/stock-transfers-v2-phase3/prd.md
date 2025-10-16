# Stock Transfers V2 - Phase 3: Barcode-Based Bulk Receive

**PRD Version:** 1.0
**Date:** 2025-10-14
**Status:** In Progress

This PRD is extracted from the main Stock Transfers V2 enhancement document, focusing on Phase 3: Barcode-Based Bulk Receive.

---

## Goal

Enable warehouse staff to receive transferred items quickly using smartphone barcode scanning, reducing receiving time from 5 minutes to 30 seconds for a typical 10-item transfer.

---

## User Story

**As a receiving clerk**, I want to:
- Open the "Receive Items" screen on my phone
- Scan each item's barcode as I unpack the shipment
- See real-time count of items scanned
- Submit all scanned items at once
- Quickly verify I received everything

---

## Requirements

### 1. Barcode Setup (Prerequisites)

**Product Barcode Storage:**
- Products can have optional barcode field
- Barcode is unique per tenant
- Supported formats:
  - EAN-13 (European Article Number)
  - UPC-A (Universal Product Code)
  - Code 128
  - QR Codes
- Admin can set barcodes via product edit screen

**Database Schema:**
```prisma
model Product {
  // ... existing fields

  barcode      String?  // EAN-13, UPC-A, Code128, or QR code
  barcodeType  String?  // "EAN13", "UPCA", "CODE128", "QR"

  // ... existing relations

  @@unique([tenantId, barcode])  // Barcode unique per tenant
  @@index([barcode])
}
```

### 2. Receiving Flow (Mobile-Optimized)

**Step-by-Step Flow:**

1. User navigates to transfer detail page on phone
2. Clicks "Scan to Receive" button
3. Camera permission requested (if not granted)
4. Camera viewfinder opens with scanning overlay
5. User scans each item's barcode as they unpack:
   - Beep sound on successful scan
   - Green flash confirmation
   - Item appears in "Scanned Items" list with count
6. Validation:
   - If product not in transfer → Error: "Item not in this transfer"
   - If already fully received → Warning: "Already received X of Y"
7. User reviews scanned items:
   ```
   Scanned Items:
   - Widget A: 25 scanned (expected 25) ✓
   - Widget B: 18 scanned (expected 20) ⚠️ 2 missing
   - Widget C: 30 scanned (expected 30) ✓
   ```
8. User clicks "Receive All Scanned Items"
9. System submits receipt with scanned quantities

### 3. Camera Integration

**Implementation:**
- Use HTML5 MediaDevices API (works on iPhone Safari)
- Library: `html5-qrcode` or `@zxing/browser`
- Progressive Web App (PWA) support for better camera access
- No native app required (works in mobile browser)

**Example Code:**
```typescript
import { Html5Qrcode } from 'html5-qrcode';

// Initialize scanner
const scanner = new Html5Qrcode("reader");

// Start scanning
scanner.start(
  { facingMode: "environment" },  // Use rear camera
  {
    fps: 10,
    qrbox: { width: 250, height: 250 },
  },
  (decodedText) => {
    // decodedText = barcode value
    handleBarcodeScanned(decodedText);
  },
  (errorMessage) => {
    // Handle scan errors (optional)
  }
);

// Stop scanning
scanner.stop();
```

**Browser Compatibility:**
- ✅ iOS Safari (iOS 11+)
- ✅ Android Chrome
- ✅ Desktop Chrome (for testing)
- ❌ Older browsers (show manual entry fallback)

### 4. API Endpoints

**Barcode Lookup:**
```
GET /api/products/by-barcode/:barcode
Query params: tenantId, branchId
Response: Product details + available stock at branch
```

**Bulk Receive:**
```
POST /api/stock-transfers/:transferId/receive
Body: {
  items: [
    { productId: "string", qtyReceived: number },
    ...
  ]
}
```
*Note: Existing endpoint, supports multiple items already*

### 5. Frontend Components

**New Components:**

1. **BarcodeScannerModal.tsx**
   - Camera viewfinder with scanning logic
   - Uses `html5-qrcode` library
   - Shows scanned items list with counts
   - Shows expected vs scanned comparison
   - Submit button to receive all

2. **Product Management Updates:**
   - `ProductDetailPage.tsx`: Add "Barcode" field to product form
   - `ProductsPage.tsx`: Show barcode in table (optional column)

**Modified Components:**

1. **StockTransferDetailPage.tsx**
   - Add "Scan to Receive" button (mobile-optimized)
   - Permission check: `stock:write` + destination branch membership

2. **ReceiveTransferModal.tsx**
   - Add "Switch to Barcode Mode" button

### 6. UX Considerations

**Mobile-First Design:**
- Large touch targets (60x60px minimum)
- Camera viewfinder full-screen
- Clear "Tap to Scan" instructions
- Haptic feedback on scan (vibration)
- Audio feedback (beep sound)

**Error Handling:**
- Camera permission denied → Show manual entry fallback
- Barcode not found → Show error, allow manual search
- Product not in transfer → Show error, don't add to list
- Already fully received → Show warning, allow over-receive with confirmation

**Accessibility:**
- Manual entry always available as fallback
- Voice feedback for visually impaired users (optional)
- Keyboard shortcuts for desktop testing

---

## Acceptance Criteria

### Database
- [ ] Products can have barcodes stored (unique per tenant)
- [ ] Barcode field has proper index
- [ ] Barcode type field supports all formats (EAN13, UPCA, CODE128, QR)

### Backend
- [ ] Product lookup by barcode endpoint works
- [ ] Returns product details + stock availability
- [ ] Multi-tenant filtering enforced
- [ ] Existing receive endpoint handles bulk items

### Frontend - Product Management
- [ ] Admin can add/edit barcodes on product page
- [ ] Barcode validation (format, uniqueness)
- [ ] Products table shows barcode column (optional)

### Frontend - Barcode Scanning
- [ ] User can click "Scan to Receive" on transfer detail page (mobile)
- [ ] Camera permission requested and granted
- [ ] Camera viewfinder opens with scanning overlay
- [ ] User can scan product barcodes (EAN-13, UPC-A, Code128, QR)
- [ ] Scanned items appear in list with counts
- [ ] System validates scanned items are in transfer
- [ ] System prevents over-receiving (with warning)
- [ ] User can review scanned items before submitting
- [ ] User can manually adjust quantities before submit
- [ ] "Receive All Scanned Items" submits bulk receipt
- [ ] Audio/haptic feedback on successful scan
- [ ] Manual entry fallback if camera unavailable
- [ ] Works on iPhone Safari (iOS 11+)
- [ ] Works on Android Chrome
- [ ] Responsive design for mobile (large touch targets)

### Permissions & Security
- [ ] `stock:write` permission required for scanning/receiving
- [ ] User must be in destination branch to receive
- [ ] Barcode lookup respects tenant isolation

### Testing
- [ ] Backend tests for barcode lookup
- [ ] Backend tests for bulk receive with scanned items
- [ ] E2E tests for barcode scanning workflow (may require manual camera testing)
- [ ] E2E tests for manual entry fallback
- [ ] Test barcode uniqueness validation
- [ ] Test multi-tenant isolation on barcode lookup

---

## Implementation Plan

### Step 1: Database Schema (database-expert)
- Add barcode and barcodeType fields to Product model
- Create migration
- Update seed data with sample barcodes
- Document schema changes

### Step 2: Backend API (backend-api-expert)
- Create barcode lookup endpoint
- Add OpenAPI schema for barcode endpoints
- Implement validation and error handling
- Test multi-tenant isolation

### Step 3: Frontend UI (frontend-expert)
- Install barcode scanning library (`html5-qrcode`)
- Create BarcodeScannerModal component
- Update StockTransferDetailPage with "Scan to Receive" button
- Add barcode field to ProductDetailPage
- Update ProductsPage table with barcode column
- Implement camera integration
- Add audio/haptic feedback
- Implement fallback for unsupported browsers

### Step 4: Testing (test-engineer)
- Backend unit tests for barcode lookup
- Backend unit tests for bulk receive
- E2E tests for product barcode management
- E2E tests for barcode scanning workflow
- Manual camera testing on iOS/Android

### Step 5: Integration (integration-orchestrator)
- Regenerate OpenAPI types
- Run full build and typecheck
- Create deployment checklist
- Update system documentation
- Verify barcode scanning works on target devices

---

## Technical Decisions

### Why html5-qrcode over @zxing/browser?
- Better iOS Safari support
- Simpler API
- Good documentation
- Active maintenance

### Why Web-based over Native App?
- No app installation required
- Works in mobile browser
- Faster deployment
- Lower maintenance cost
- Can be enhanced to PWA later

### Why Optional Barcode Field?
- Not all products have barcodes
- Manual entry fallback always available
- Gradual adoption possible

---

## Future Enhancements (Out of Scope for Phase 3)

- Offline support with Service Worker
- Barcode generation for products without barcodes
- Print barcode labels from system
- Bulk barcode import from CSV
- Advanced barcode formats (Data Matrix, PDF417)

---

## Success Metrics

- Percentage of transfers received via barcode scanning
- Time to receive transfer (barcode vs manual)
- Barcode scan error rate
- User adoption rate (% using barcode feature)
- Reduction in receiving errors

---

## Related Documentation

- [Stock Transfers V2 Main PRD](./../stock-transfers-v2/prd.md)
- [System: Stock Management](./../../System/stock-management.md)
- [System: Database Schema](./../../System/database-schema.md)
- [SOP: Stock Transfers Feature Guide](./../../SOP/stock-transfers-feature-guide.md)

---

**Last Updated:** 2025-10-14
**Document Version:** 1.0
