# Backend API Expert - Stock Transfers V2 Phase 3

**Feature:** Stock Transfers V2 - Phase 3: Barcode-Based Bulk Receive
**Agent:** backend-api-expert
**Date:** 2025-10-14
**Status:** ✅ Completed

---

## Summary

Implemented barcode lookup API endpoint to support barcode scanning during stock transfer receiving. The endpoint allows mobile users to scan product barcodes and instantly retrieve product details with optional stock availability information.

---

## API Endpoint Created

### GET /api/products/by-barcode/:barcode

**Purpose:** Look up product by barcode with optional branch stock information

**Authentication:** Required (session cookie)

**Authorization:** Requires `products:read` permission

**Path Parameters:**
- `barcode` (string, required): Barcode value to lookup (1-100 chars)

**Query Parameters:**
- `branchId` (string, optional): Branch ID to include stock information

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "product": {
      "id": "clx123...",
      "tenantId": "tenant_acme",
      "productName": "Acme Anvil",
      "productSku": "ACME-SKU-001",
      "productPricePence": 5000,
      "barcode": "5012345678900",
      "barcodeType": "EAN13",
      "entityVersion": 1,
      "createdAt": "2025-10-14T10:00:00Z",
      "updatedAt": "2025-10-14T10:00:00Z",
      "stock": {
        "branchId": "branch_warehouse1",
        "branchName": "Main Warehouse",
        "qtyOnHand": 150,
        "qtyAllocated": 0
      }
    }
  }
}
```

**Error Responses:**
- **400 Bad Request**: Barcode parameter is empty or invalid
- **401 Unauthorized**: No session cookie provided
- **403 Forbidden**: User lacks `products:read` permission
- **404 Not Found**: Barcode not found for current tenant
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Unexpected error

---

## OpenAPI Schemas Added

### Request Schemas
- **ZodBarcodeLookupParams**: Path parameter validation for barcode
- **ZodBarcodeLookupQuery**: Query parameter validation for optional branchId

### Response Schemas
- **ZodProductWithStock**: Extended product schema with optional stock object
- **ZodBarcodeLookupResponseData**: Response envelope wrapper

### Updated Schemas
- **ZodProductRecord**: Added `barcode` and `barcodeType` fields (nullable/optional)
- **ZodCreateProductRequestBody**: Added optional barcode fields
- **ZodUpdateProductRequestBody**: Added optional/nullable barcode fields

---

## Service Layer Implementation

### New Function: `getProductByBarcodeForCurrentTenantService()`

**Location:** `api-server/src/services/products/productService.ts`

**Parameters:**
```typescript
{
  currentTenantId: string;      // From session middleware
  barcodePathParam: string;     // Barcode to lookup
  branchIdOptional?: string;    // Optional branch for stock info
}
```

**Logic:**
1. Validate barcode parameter is non-empty
2. Query product by `tenantId` + `barcode` (multi-tenant isolation)
3. Return 404 if product not found for tenant
4. If `branchId` provided, fetch stock from `ProductStock` + `Branch` join
5. Return product with optional stock object

**Multi-Tenant Enforcement:**
```typescript
const product = await prisma.product.findFirst({
  where: {
    tenantId: currentTenantId,  // Always filter by tenant
    barcode: barcodePathParam,
  },
});
```

**Performance:**
- Uses indexed lookup: `@@index([barcode])`
- Unique constraint: `@@unique([tenantId, barcode])`
- Selective field projection (no SELECT *)
- Optional stock join only when needed

---

## Route Handler

**Location:** `api-server/src/routes/productRouter.ts`

**Middleware Stack:**
1. `requireAuthenticatedUserMiddleware` - Ensures session exists, sets `req.currentTenantId`
2. `requirePermission("products:read")` - Checks RBAC permission
3. `validateRequestParamsWithZod(barcodeLookupParamsSchema)` - Validates barcode parameter
4. `validateRequestQueryWithZod(barcodeLookupQuerySchema)` - Validates optional branchId
5. Route handler - Calls service, returns standard envelope

**Route Placement:**
- Registered BEFORE `/:productId` route to prevent false matches
- Path: `/by-barcode/:barcode` is more specific than `/:productId`

---

## Key Design Decisions

### 1. Tenant-Scoped Barcode Uniqueness
- **Decision**: Filter by `tenantId` + `barcode` in database query
- **Rationale**: Multi-tenant isolation; different tenants may have same barcode
- **Security**: Prevents cross-tenant data leakage

### 2. Optional Stock via Query Parameter
- **Decision**: Include stock only when `branchId` query param provided
- **Rationale**: Flexibility (not all scans need stock), performance (avoids unnecessary joins)
- **Frontend Control**: Frontend decides when to request stock based on context

### 3. Permission Reuse
- **Decision**: Require `products:read` permission (same as GET /api/products/:productId)
- **Rationale**: Barcode lookup is functionally equivalent to fetching product by ID
- **Consistency**: No new permission needed

### 4. Error Handling Strategy
- **Empty Barcode**: 400 validation error
- **Not Found**: 404 with tenant-specific message
- **Missing Stock**: Returns `stock: null` (graceful degradation, not an error)

---

## Sample Barcodes for Testing

From database seed data:

### ACME Tenant
- `5012345678900` - Acme Anvil (EAN13)
- `012345678905` - Acme Rocket Skates (UPCA)

### GLOBEX Tenant
- `GLX-HEAT-001` - Globex Heat Lamp (CODE128)

### Test Scenarios
1. **Happy Path**: Scan `5012345678900` as ACME user → Returns Acme Anvil
2. **Multi-Tenant Isolation**: Scan `GLX-HEAT-001` as ACME user → Returns 404
3. **With Stock**: Scan `5012345678900?branchId=<branch-id>` → Returns product + stock
4. **Without Stock**: Scan barcode without branchId → Returns product only
5. **Not Found**: Scan `9999999999999` → Returns 404

---

## Changes to Existing Product Endpoints

All product endpoints now include barcode fields in responses:
- `GET /api/products` - List products (includes barcode in each item)
- `GET /api/products/:productId` - Get single product (includes barcode)
- `POST /api/products` - Create product (accepts optional barcode fields)
- `PUT /api/products/:productId` - Update product (accepts optional barcode fields)
- `DELETE /api/products/:productId` - Delete product (audit includes barcode)

**Schema Updates:**
- All service functions updated to select `barcode` and `barcodeType` fields
- Create, update, delete functions include barcode in audit snapshots

---

## Integration Notes

### For Frontend Expert
**API Usage:**
```typescript
// Type-safe API call after openapi:gen
import type { paths } from '@/types/openapi';

type BarcodeLookupResponse = paths['/api/products/by-barcode/{barcode}']['get']['responses']['200']['content']['application/json'];

// Lookup without stock
const response = await fetch(`/api/products/by-barcode/${barcode}`, {
  credentials: 'include',
});

// Lookup with stock
const response = await fetch(`/api/products/by-barcode/${barcode}?branchId=${branchId}`, {
  credentials: 'include',
});

const data: BarcodeLookupResponse = await response.json();
if (data.success) {
  const product = data.data.product;
  const stock = product.stock; // May be null
}
```

**Error Handling:**
```typescript
if (!response.ok) {
  if (response.status === 404) {
    // Show "Item not in this transfer" message
  } else if (response.status === 400) {
    // Show validation error
  } else if (response.status === 403) {
    // Redirect to access denied
  }
}
```

### For Integration Orchestrator
**Actions Required:**
1. Restart API server to load OpenAPI spec changes
2. Run `npm run openapi:gen` in `admin-web/` workspace
3. Verify `admin-web/src/types/openapi.d.ts` includes new endpoint types

**Breaking Changes:** None (all changes are additive)

### For Test Engineer
**Test Coverage Needed:**

**Backend Unit Tests:**
- Service function: `getProductByBarcodeForCurrentTenantService()`
  - Happy path: Barcode found, returns product
  - Happy path with stock: Barcode + branchId, returns product + stock
  - Not found: Non-existent barcode returns 404
  - Multi-tenant: Same barcode in different tenants isolated
  - Validation: Empty barcode throws validation error
  - Stock edge cases: Invalid branchId, no stock record (returns null)

**E2E Tests:**
- Barcode scanning flow (may require manual camera testing)
- API integration with barcode scanner modal
- Permission checks (different roles)

---

## Files Changed

### Modified Files
1. **`api-server/src/openapi/schemas/products.ts`**
   - Added barcode fields to ZodProductRecord
   - Updated Create/Update schemas with barcode fields
   - Created barcode lookup schemas

2. **`api-server/src/openapi/paths/products.ts`**
   - Registered GET /api/products/by-barcode/:barcode endpoint
   - Imported barcode lookup schemas

3. **`api-server/src/services/products/productService.ts`**
   - Created `getProductByBarcodeForCurrentTenantService()` function
   - Updated all existing functions to include barcode fields in select

4. **`api-server/src/routes/productRouter.ts`**
   - Added barcode lookup route handler
   - Created validation schemas for barcode params/query
   - Imported barcode service function

---

## Performance & Security

### Performance
- **Indexed Lookup**: O(log n) via `@@index([barcode])`
- **Composite Unique Constraint**: `@@unique([tenantId, barcode])` ensures fast tenant-scoped lookup
- **Selective Projection**: Only fetch needed fields (no SELECT *)
- **Optional Join**: Stock query only when branchId provided
- **Expected Response Time**: 10-30ms (no stock), 20-50ms (with stock)

### Security
- **Multi-Tenant Isolation**: Always filter by `currentTenantId` from session
- **Permission Enforcement**: `requirePermission("products:read")` middleware
- **Input Validation**: Zod schemas validate barcode parameter
- **SQL Injection Protection**: Prisma parameterized queries
- **Rate Limiting**: 600 requests/minute per IP+session (general API limit)

---

## Next Steps

### Pending Work
- [ ] **integration-orchestrator**: Regenerate OpenAPI types (`npm run openapi:gen`)
- [ ] **frontend-expert**: Implement BarcodeScannerModal component
  - Install `html5-qrcode` library
  - Create camera-based scanner
  - Call barcode lookup endpoint
  - Display scanned items list
- [ ] **frontend-expert**: Add barcode fields to ProductDetailPage form
  - Add barcode input field
  - Add barcodeType dropdown (EAN13, UPCA, CODE128, QR)
  - Validate uniqueness on create/update
- [ ] **test-engineer**: Write backend unit tests for barcode lookup
- [ ] **test-engineer**: Write E2E tests for barcode scanning flow

### Ready For
- ✅ Integration orchestrator (OpenAPI regeneration)
- ✅ Frontend implementation (API contract complete)
- ✅ Test engineer (service layer testable)

---

## References

- **Work Output**: `.agent/Agents/backend-api-expert/work/barcode-lookup-api-2025-10-14.md`
- **PRD**: `.agent/Features/InProgress/stock-transfers-v2-phase3/prd.md`
- **Database Schema**: `.agent/Features/InProgress/stock-transfers-v2-phase3/database-expert.md`
- **API Architecture**: `.agent/System/architecture.md`

---

## UPDATE: Product CRUD Barcode Field Handling Fix (2025-10-14)

### Critical Bug Fixed
**Issue:** Product CREATE/UPDATE endpoints were not accepting barcode fields in request body, causing 8/23 backend tests to fail.

**Root Cause:**
- Service functions (`createProductForCurrentTenantService`, `updateProductForCurrentTenantService`) did not accept barcode parameters
- Route handlers did not extract barcode fields from request body
- Route validation schemas did not include barcode fields

**Fix Applied:**
1. **Service Layer (`productService.ts`)**:
   - Added `barcode?: string` and `barcodeType?: string` parameters to create function
   - Added `barcode?: string | null | undefined` and `barcodeType?: string | null | undefined` to update function
   - Include barcode fields in Prisma `create()` and `updateMany()` operations
   - Enhanced error handling to detect barcode uniqueness violations

2. **Route Layer (`productRouter.ts`)**:
   - Added barcode fields to `createBodySchema` with `.trim()` validation
   - Added barcode fields to `updateBodySchema` as optional/nullable
   - Updated POST handler to extract and pass barcode fields
   - Updated PUT handler to check field presence with `'barcode' in validatedBody`

**Test Results:**
- Before: 15/23 tests passing (65%)
- After: 23/23 tests passing (100%)
- All barcode CRUD scenarios now working

**Impact:**
- Frontend can now create products with barcodes
- Frontend can update/remove product barcodes
- Barcode scanning feature unblocked for deployment
- No breaking changes to existing API

**Detailed Documentation:**
- `.agent/Agents/backend-api-expert/work/barcode-product-service-fix-2025-10-14.md`

---

**Completed:** 2025-10-14 (Initial API), 2025-10-14 (CRUD Fix)
**Status:** ✅ Fully Complete - Ready for deployment
**Ready for:** integration-orchestrator (final verification), frontend-expert, test-engineer
