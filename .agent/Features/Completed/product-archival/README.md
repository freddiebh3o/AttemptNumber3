# Product Archival (Soft Delete)

**Status:** ✅ Complete
**Started:** October 15, 2025
**Completed:** October 17, 2025

## Overview
Implemented soft delete (archive) pattern for products to safely remove products from active views while preserving all historical data and audit trails. Products with stock history can now be archived and restored without data loss.

## Key Features
- **Archive Products**: Hide products from active views with confirmation modal
- **Restore Products**: Return archived products to active status
- **Three-way Filter**: View active, archived, or all products via dropdown
- **Preserved Data**: All stock history, audit logs, and related records remain intact
- **Permission-based**: Archive/restore buttons only visible to users with `products:write`
- **Accessible**: Archived products accessible via direct URL for restoration

## Implementation
### Backend
- **Database Migration**: Added `isArchived`, `archivedAt`, `archivedByUserId` fields to Product model
- **Service Updates**: Modified `productService.ts` with archive/restore functions and `archivedFilter` parameter
- **API Endpoints**:
  - `DELETE /api/products/:id` - Archives product (soft delete)
  - `POST /api/products/:id/restore` - Restores archived product
  - `GET /api/products` - Supports `archivedFilter` query parameter (no-archived, only-archived, both)
- **Backward Compatibility**: Maintained existing `includeArchived` parameter

### Frontend
- **Archive from Detail Page**: Archive button with confirmation modal ("Archive Product?")
- **Filter Dropdown**: Three-way filter in Products page FilterBar (replaces checkbox)
- **Restore Button**: Blue restore button on archived product detail pages
- **Archived Badge**: Gray badge displayed on archived products in list and detail views
- **Data-testid Attributes**: Added for E2E testing (archived-badge, archive-product-btn, restore-btn)

## Test Coverage
- **46 passing tests** (38 backend + 8 frontend E2E)
- **Backend Tests (Jest)**: Service layer, API routes, permissions, multi-tenant isolation
- **Frontend Tests (Playwright E2E)**: Archive flow, restore flow, filter dropdown, permission checks, modal confirmation
- 100% coverage of archive/restore functionality

## Documentation
- [PRD](./prd.md) - Complete implementation plan and notes
- [User Guide](../../docs/products/managing-products.md#archiving-products) - End-user documentation

## Key Files
### Backend
- `api-server/prisma/migrations/.../add_product_archival/migration.sql` - Database schema
- `api-server/src/services/productService.ts` - Archive/restore logic
- `api-server/src/routes/productsRouter.ts` - API endpoints
- `api-server/src/openapi/paths/products.ts` - OpenAPI schemas
- `api-server/__tests__/services/product.test.ts` - Service tests (4 new tests)

### Frontend
- `admin-web/src/pages/ProductsPage.tsx` - Archive filter dropdown
- `admin-web/src/pages/ProductPage.tsx` - Archive/restore buttons and modal
- `admin-web/src/api/products.ts` - API client functions
- `admin-web/e2e/product-archive.spec.ts` - E2E tests (8 comprehensive tests)

### Documentation
- `docs/products/managing-products.md` - Updated user guide with archive workflows

## Architecture Decisions
- **Soft Delete Over Hard Delete**: Preserves audit trail for stock movements and transfers
- **Archive Terminology**: Using "Archive" in UI instead of "Delete" to clarify reversibility
- **Three-way Filter**: Changed from simple toggle to dropdown (no-archived, only-archived, both) for better UX
- **Archive from Detail Page**: Moved action from table to detail page with confirmation modal
- **Permission Reuse**: Using existing `products:write` permission (no new permission needed)
- **Detail Page Access**: Removed `isArchived` filter from `getProduct()` to allow restoration access

## Security
- ✅ Multi-tenant isolation (archive only tenant's products)
- ✅ Permission-based access (`products:write` required)
- ✅ Audit trail preservation (archivedAt, archivedByUserId tracked)
- ✅ Foreign key constraints respected (no data loss)

## Known Limitations
- Archived products remain in database permanently (not true deletion)
- SKU uniqueness constraint still applies to archived products
- Bulk archive/restore operations not implemented (future enhancement)

## Notes
Built with production-grade patterns including optimistic locking, confirmation modals, comprehensive test coverage, and complete user documentation. Fully integrated with existing RBAC, multi-tenant architecture, and audit system.
