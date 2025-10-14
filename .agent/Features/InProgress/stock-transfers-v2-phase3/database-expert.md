# Database Expert - Stock Transfers V2 Phase 3

**Feature:** Stock Transfers V2 - Phase 3: Barcode-Based Bulk Receive
**Agent:** database-expert
**Date:** 2025-10-14
**Status:** ✅ Completed

---

## Summary

Added barcode support to the Product model to enable barcode-based bulk receiving in stock transfers. This allows warehouse staff to quickly scan product barcodes on their phones during receiving.

---

## Schema Changes

### Product Model - Barcode Fields Added

```prisma
model Product {
  id       String @id @default(cuid())
  tenantId String
  tenant   Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  productName       String
  productSku        String
  productPricePence Int

  // NEW: Barcode fields
  barcode     String?  // Barcode value (EAN-13, UPC-A, Code128, QR)
  barcodeType String?  // Barcode format type

  entityVersion Int @default(1)

  // ... relations

  @@unique([tenantId, productSku])
  @@unique([tenantId, barcode])  // NEW: Unique constraint
  @@index([tenantId])
  @@index([barcode])  // NEW: Index for fast lookups
}
```

**Key Features:**
- Optional barcode fields (not all products have barcodes)
- Tenant-scoped uniqueness (same barcode allowed in different tenants)
- Fast lookups via index
- Supports multiple formats: EAN13, UPCA, CODE128, QR

---

## Migration

**Migration ID:** `20251014000000_add_barcode_to_products`

**Migration File:** `api-server/prisma/migrations/20251014000000_add_barcode_to_products/migration.sql`

**SQL:**
```sql
-- Add barcode columns
ALTER TABLE "public"."Product" ADD COLUMN "barcode" TEXT;
ALTER TABLE "public"."Product" ADD COLUMN "barcodeType" TEXT;

-- Create index for fast lookups
CREATE INDEX "Product_barcode_idx" ON "public"."Product"("barcode");

-- Create unique constraint (tenant-scoped)
CREATE UNIQUE INDEX "Product_tenantId_barcode_key" ON "public"."Product"("tenantId", "barcode");
```

**Status:** ✅ Applied successfully to database

**Breaking Changes:** None (fields are optional)

**Rollback:** Remove columns and indexes (acceptable data loss - optional fields)

---

## Seed Data

Updated `api-server/prisma/seed.ts` with sample barcodes:

| Product | SKU | Barcode | Type | Tenant |
|---------|-----|---------|------|--------|
| Acme Anvil | ACME-SKU-001 | `5012345678900` | EAN13 | Acme |
| Acme Rocket Skates | ACME-SKU-002 | `012345678905` | UPCA | Acme |
| Globex Heat Lamp | GLOBEX-SKU-001 | `GLX-HEAT-001` | CODE128 | Globex |
| Globex Shrink Ray | GLOBEX-SKU-002 | *(no barcode)* | - | Globex |

**Purpose:** Test different barcode formats and demonstrate optional field

---

## Design Decisions

### 1. Optional Barcode Fields
- **Why**: Not all products have barcodes, allows gradual adoption
- **Impact**: No breaking changes, existing products work fine

### 2. Tenant-Scoped Uniqueness
- **Why**: Multi-tenant isolation, different tenants may have same barcode
- **Constraint**: `@@unique([tenantId, barcode])`
- **Consistent with**: Other unique constraints like `[tenantId, productSku]`

### 3. String Type for barcodeType
- **Why**: Flexibility for future formats without migration
- **Validation**: Application layer enforces allowed values
- **Allowed Values**: EAN13, UPCA, CODE128, QR

### 4. Single Index Strategy
- **Index**: `@@index([barcode])` for fast lookups
- **Why**: Unique constraint already creates composite index
- **Query Pattern**: `WHERE tenantId = ? AND barcode = ?`

---

## Performance

**Lookup Performance:**
- Barcode lookup: O(log n) via index
- Unique constraint check: O(log n) via composite index
- No impact on products without barcodes (nullable fields)

**Storage:**
- Minimal overhead (~50 bytes per product with barcode)
- No overhead for products without barcodes (NULL)

---

## Next Steps for Other Agents

### Backend API Expert
- [ ] Create barcode lookup endpoint: `GET /api/products/by-barcode/:barcode`
  - Filter by tenantId (multi-tenant)
  - Return product details + stock availability
- [ ] Update Product OpenAPI schemas with barcode fields
- [ ] Add validation:
  - Barcode format matches type (regex)
  - Barcode uniqueness per tenant
  - BarcodeType in allowed list
- [ ] Reference seed data for test barcode formats

### Frontend Expert
- [ ] Add barcode field to ProductDetailPage form
- [ ] Add barcodeType dropdown (EAN13, UPCA, CODE128, QR)
- [ ] Create BarcodeScannerModal component (html5-qrcode library)
- [ ] Add "Scan to Receive" button on StockTransferDetailPage
- [ ] Use test barcodes from seed data for development

### Test Engineer
- [ ] Backend tests:
  - Barcode lookup by tenantId + barcode
  - Unique constraint validation
  - Cross-tenant isolation
  - Null barcode handling
- [ ] Frontend E2E tests:
  - Add barcode to product
  - Validate barcode format
  - Barcode scanning flow

---

## Files Changed

### Modified
- `api-server/prisma/schema.prisma` - Added barcode fields to Product model
- `api-server/prisma/seed.ts` - Added sample barcodes to 3 products

### Created
- `api-server/prisma/migrations/20251014000000_add_barcode_to_products/migration.sql` - Migration file

---

## Testing

### Manual Testing Completed
- [x] Migration applied successfully
- [x] Schema updated with barcode fields
- [x] Seed data created with sample barcodes
- [x] Unique constraint enforced (tested via Prisma Studio)

### Pending Testing
- [ ] Backend API barcode lookup (pending backend-api-expert)
- [ ] Frontend barcode input/validation (pending frontend-expert)
- [ ] Barcode scanning flow (pending frontend-expert)

---

## Known Issues

**Prisma Client Generation Blocked:**
- File lock on query engine (API server running)
- **Solution**: Restart API server
- **Severity**: Low (auto-regenerates on server restart)

---

## References

- **PRD**: `.agent/Features/InProgress/stock-transfers-v2-phase3/prd.md`
- **Work Output**: `.agent/Agents/database-expert/work/stock-transfers-barcode-schema-2025-10-14.md`
- **Schema Docs**: `.agent/System/database-schema.md`

---

**Completed:** 2025-10-14
**Ready for:** backend-api-expert, frontend-expert
