# Product Deletion with Related Records

**Status:** PLANNED
**Priority:** LOW
**Created:** 2025-10-15
**Category:** Bug Fix / Data Management

## Problem Statement

Products cannot be deleted when they have related records (ProductStock, StockLot, StockLedger, or StockTransferItem) due to foreign key constraints with `onDelete: Restrict` in the Prisma schema. This results in database errors when attempting to delete products that have been used in any stock operations or transfers.

### Current Behavior

When attempting to delete a product with related records, the API returns a database error:

```
PrismaClientKnownRequestError: Foreign key constraint violated on the constraint: ProductStock_productId_fkey
```

This happens because:
1. Product has foreign key constraints with `onDelete: Restrict` on:
   - `ProductStock` (aggregated stock per branch)
   - `StockLot` (FIFO lots)
   - `StockLedger` (append-only stock movement log)
   - `StockTransferItem` (transfer line items)

2. When stock operations occur (adjustments, transfers, receipts), these tables create records referencing the product

3. The `onDelete: Restrict` constraint prevents product deletion to maintain referential integrity

### Impact

- **E2E Tests:** Test cleanup fails when trying to delete products used in transfers, causing verbose error logs
- **User Experience:** Users cannot delete products that have historical stock records, even if current stock is zero
- **Data Management:** No clean way to archive or remove obsolete products from the active product list

## Proposed Solution

### Option 1: Soft Delete (Recommended)

Add a `deletedAt` (or `isArchived`) field to the Product model and use soft delete pattern:

**Pros:**
- Preserves all historical data and audit trails
- No cascade deletion risks
- Simple to implement
- Can show/hide archived products in UI

**Cons:**
- Products remain in database permanently
- Need to filter archived products in most queries

**Implementation:**
1. Add `deletedAt DateTime?` or `isArchived Boolean @default(false)` to Product model
2. Update product queries to filter by `deletedAt IS NULL` or `isArchived = false`
3. Change DELETE endpoint to update `deletedAt` instead of actual deletion
4. Add UI toggle to show/hide archived products
5. Add "Restore Product" functionality for admins

### Option 2: Cascade Delete with Safety Checks

Change `onDelete: Restrict` to `onDelete: Cascade` for related records:

**Pros:**
- Clean removal of all related data
- Simpler for users to understand
- Reduces database size

**Cons:**
- **HIGH RISK:** Deletes historical stock movements and ledger entries (breaks audit trail)
- Loss of transfer history
- Cannot recover deleted data
- Violates audit requirements for stock movements

**NOT RECOMMENDED** due to audit trail requirements

### Option 3: Manual Cleanup Service

Create a service method that checks and cleans up related records before deletion:

**Pros:**
- Controlled deletion process
- Can add business logic validation (e.g., prevent delete if product has transfers in last 30 days)
- Can preserve critical audit data while removing others

**Cons:**
- Complex implementation
- Still risks losing historical data
- May not satisfy all edge cases

## Recommended Approach

**Implement Option 1: Soft Delete**

This is the safest and most maintainable solution that:
- Preserves audit trails (critical for stock management systems)
- Allows users to "delete" obsolete products from active views
- Maintains referential integrity
- Can be reversed if needed
- Aligns with best practices for multi-tenant SaaS applications

## Acceptance Criteria

1. **Schema Changes:**
   - [ ] Add `isArchived Boolean @default(false)` to Product model
   - [ ] Create migration
   - [ ] Update seed data to set `isArchived = false` for existing products

2. **Backend:**
   - [ ] Update product queries to filter `isArchived = false` by default
   - [ ] Change DELETE `/api/products/:id` to set `isArchived = true`
   - [ ] Add GET `/api/products?includeArchived=true` query param
   - [ ] Add POST `/api/products/:id/restore` endpoint (admin only)
   - [ ] Add permission check: only OWNER/ADMIN can archive products

3. **Frontend:**
   - [ ] Update product list to filter archived products by default
   - [ ] Add "Show Archived Products" toggle on products page
   - [ ] Display archived badge on archived products
   - [ ] Change "Delete" button label to "Archive"
   - [ ] Add "Restore" button for archived products (visible to admins only)
   - [ ] Update confirmation modal: "Archive this product? It will be hidden but can be restored later."

4. **Testing:**
   - [ ] Backend unit tests for archive/restore functionality
   - [ ] E2E tests for archiving products with related records (should succeed)
   - [ ] E2E tests for filtering archived products
   - [ ] E2E tests for restoring archived products

## Technical Notes

### Schema Changes
```prisma
model Product {
  id             String    @id @default(cuid())
  tenantId       String
  productName    String
  productSku     String
  isArchived     Boolean   @default(false) // NEW
  archivedAt     DateTime? // OPTIONAL: track when archived
  archivedByUserId String? // OPTIONAL: track who archived it

  // ... existing fields and relations
}
```

### Query Pattern
```typescript
// Default: only active products
const products = await prisma.product.findMany({
  where: {
    tenantId,
    isArchived: false, // Filter archived by default
  },
});

// Include archived when explicitly requested
const allProducts = await prisma.product.findMany({
  where: {
    tenantId,
    ...(includeArchived ? {} : { isArchived: false }),
  },
});
```

## Related Issues

- E2E test cleanup failures (admin-web/e2e/transfer-analytics-phase4.spec.ts)
- Unable to delete products with stock history

## Estimated Effort

- **Backend:** 2-3 hours
- **Frontend:** 2-3 hours
- **Testing:** 2 hours
- **Total:** 6-8 hours

## Dependencies

None - can be implemented independently

## Migration Strategy

1. Add `isArchived` field with default `false` to Product model
2. Run migration (existing products will have `isArchived = false`)
3. Deploy backend changes (backward compatible - all queries still work)
4. Deploy frontend changes
5. No data migration needed
