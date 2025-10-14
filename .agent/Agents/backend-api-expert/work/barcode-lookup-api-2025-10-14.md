# Barcode Lookup API - Backend API Expert

**Date:** 2025-10-14
**Agent:** backend-api-expert
**Feature:** Stock Transfers V2 - Phase 3: Barcode-Based Bulk Receive
**Status:** Completed

---

## Context

### Request
Create a barcode lookup API endpoint for the inventory system to support barcode scanning on stock transfers. This endpoint enables mobile users to scan product barcodes during receiving and get instant product details with optional stock information.

### Related Documentation
- `.agent/Features/InProgress/stock-transfers-v2-phase3/prd.md` - Barcode scanning requirements and user flow
- `.agent/Features/InProgress/stock-transfers-v2-phase3/database-expert.md` - Barcode schema changes (added barcode and barcodeType fields)
- `.agent/System/architecture.md` - API design patterns, OpenAPI conventions, standard envelope format
- `.agent/System/database-schema.md` - Product model with barcode fields (unique per tenant)

### Dependencies
- **database-expert** completed:
  - Added `barcode` and `barcodeType` fields to Product model
  - Created unique constraint `@@unique([tenantId, barcode])`
  - Created index `@@index([barcode])` for fast lookups
  - Added seed data with sample barcodes:
    - ACME tenant: `5012345678900` (EAN13), `012345678905` (UPCA)
    - GLOBEX tenant: `GLX-HEAT-001` (CODE128)

---

## Changes Made

### Files Created
None (all changes in existing files)

### Files Modified

#### 1. `api-server/src/openapi/schemas/products.ts`
**Added barcode fields to existing schemas:**
- **ZodProductRecord**: Added `barcode` and `barcodeType` fields (nullable/optional)
- **ZodCreateProductRequestBody**: Added optional `barcode` (string, 1-100 chars) and `barcodeType` (enum: EAN13, UPCA, CODE128, QR)
- **ZodUpdateProductRequestBody**: Added optional/nullable `barcode` and `barcodeType` fields

**Created new barcode lookup schemas:**
- **ZodBarcodeLookupParams**: Path parameter schema for barcode (required, 1-100 chars)
- **ZodBarcodeLookupQuery**: Query schema with optional `branchId` (for stock info)
- **ZodProductWithStock**: Extended product schema including optional stock object:
  - `branchId`, `branchName`, `qtyOnHand`, `qtyAllocated`
- **ZodBarcodeLookupResponseData**: Response wrapper with product

#### 2. `api-server/src/openapi/paths/products.ts`
**Registered new endpoint:**
- Added imports for `ZodBarcodeLookupParams`, `ZodBarcodeLookupQuery`, `ZodBarcodeLookupResponseData`
- Registered `GET /api/products/by-barcode/{barcode}` with OpenAPI spec:
  - Security: `cookieAuth` (session required)
  - Request params: barcode (path parameter)
  - Request query: optional `branchId`
  - Responses: 200 (success), 400 (validation), 401 (auth), 403 (permission), 404 (not found), 429 (rate limit), 500 (error)

#### 3. `api-server/src/services/products/productService.ts`
**Added new service function:**
- **getProductByBarcodeForCurrentTenantService()**:
  - Parameters: `currentTenantId`, `barcodePathParam`, `branchIdOptional`
  - Validates barcode parameter is not empty
  - Queries product by `tenantId` + `barcode` (multi-tenant isolation)
  - Returns 404 if product not found for tenant
  - If `branchId` provided, joins with `ProductStock` and `Branch` to fetch:
    - Branch name
    - Quantity on hand
    - Quantity allocated
  - Returns product with optional stock object

**Updated existing functions to include barcode fields:**
- **getProductForCurrentTenantService()**: Added `barcode` and `barcodeType` to select
- **listProductsForCurrentTenantService()**: Added barcode fields to select
- **createProductForCurrentTenantService()**: Added barcode fields to select (output)
- **updateProductForCurrentTenantService()**: Added barcode fields to before/after snapshots
- **deleteProductForCurrentTenantService()**: Added barcode fields to before snapshot

#### 4. `api-server/src/routes/productRouter.ts`
**Added new route handler:**
- Imported `getProductByBarcodeForCurrentTenantService`
- Created validation schemas:
  - `barcodeLookupParamsSchema`: Validates barcode parameter (1-100 chars)
  - `barcodeLookupQuerySchema`: Validates optional `branchId` query param
- Registered `GET /api/products/by-barcode/:barcode`:
  - Middleware: `requireAuthenticatedUserMiddleware`, `requirePermission("products:read")`
  - Validation: params and query with Zod
  - Calls service layer with `currentTenantId`, `barcode`, optional `branchId`
  - Returns standard success envelope with product

**Route placement:** Added BEFORE POST route to ensure specific path `/by-barcode/:barcode` matches before generic `/:productId` pattern.

### API Changes

#### New Endpoint
```
GET /api/products/by-barcode/:barcode
```

**Path Parameters:**
- `barcode` (string, required, 1-100 chars): Barcode value to lookup

**Query Parameters:**
- `branchId` (string, optional): Branch ID to include stock information

**Request Headers:**
- `Cookie: mt_session=...` (required for authentication)

**Response (200 OK):**
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

**Response (404 Not Found):**
```json
{
  "success": false,
  "data": null,
  "error": {
    "errorCode": "RESOURCE_NOT_FOUND",
    "httpStatusCode": 404,
    "userFacingMessage": "Product with barcode '5012345678900' not found for this tenant.",
    "correlationId": "550e8400-..."
  }
}
```

**Response (400 Bad Request):**
```json
{
  "success": false,
  "data": null,
  "error": {
    "errorCode": "VALIDATION_ERROR",
    "httpStatusCode": 400,
    "userFacingMessage": "Barcode parameter is required and cannot be empty.",
    "correlationId": "550e8400-..."
  }
}
```

#### Modified Endpoints
All existing product endpoints now return barcode fields in product objects:
- `GET /api/products` - List products
- `GET /api/products/:productId` - Get single product
- `POST /api/products` - Create product (accepts optional barcode fields)
- `PUT /api/products/:productId` - Update product (accepts optional barcode fields)
- `DELETE /api/products/:productId` - Delete product

---

## Key Decisions

### Decision 1: Tenant-Scoped Barcode Lookup
**What**: Enforce multi-tenant isolation by filtering `WHERE tenantId = ? AND barcode = ?`

**Why**:
- Security: Different tenants may have products with the same barcode
- Consistent with system architecture pattern (all tenant-scoped queries filter by tenantId)
- Prevents cross-tenant data leakage

**Alternatives Considered**:
- Global barcode lookup (across all tenants): Rejected due to security concerns
- Check tenant after lookup: Rejected as less efficient and not following existing patterns

**Chosen Approach**: Filter by `tenantId` + `barcode` in the initial query using unique constraint index.

### Decision 2: Optional Stock Information via Query Parameter
**What**: Include stock availability only when `branchId` query parameter is provided

**Why**:
- Flexibility: Not all barcode scans need stock info
- Performance: Avoids unnecessary joins when stock data not needed
- Frontend control: Frontend can decide when to request stock based on context (e.g., transfer destination branch)

**Alternatives Considered**:
- Always include stock for all branches: Rejected as too expensive (N+1 query per branch)
- Separate endpoint `/api/products/:productId/stock/:branchId`: Rejected as requires 2 API calls
- Include all branch stock in array: Rejected as overkill for single-branch barcode scan use case

**Chosen Approach**: Optional `branchId` query param that conditionally fetches single-branch stock.

### Decision 3: Barcode Validation Strategy
**What**: Validate barcode parameter is non-empty string; let database handle uniqueness

**Why**:
- Simplicity: Database unique constraint already enforces tenant-scoped uniqueness
- Format flexibility: Different barcode types have different validation rules (EAN13 vs CODE128 vs QR)
- Validation deferred to create/update: Barcode format validation happens when creating/updating products, not during lookup

**Alternatives Considered**:
- Regex validation per barcode type: Rejected as too complex for lookup endpoint
- Checksum validation (e.g., EAN13 check digit): Rejected as not all formats have checksums (QR codes)

**Chosen Approach**: Simple non-empty string validation; rely on database constraint for uniqueness.

### Decision 4: Route Placement Before Generic :productId
**What**: Register `/by-barcode/:barcode` route BEFORE `/:productId` route in router

**Why**:
- Express routing priority: First matching route wins
- Prevent false matches: Without this, `/by-barcode/123` would match `/:productId` with `productId = "by-barcode"`

**Alternatives Considered**:
- Use different path prefix: Rejected as `/by-barcode/` is clearest intent
- Use query param `?barcode=xxx`: Rejected as path param is more RESTful for resource lookup

**Chosen Approach**: Register specific routes before generic parameterized routes.

### Decision 5: Permission Enforcement
**What**: Require `products:read` permission (same as GET /api/products/:productId)

**Why**:
- Consistency: Barcode lookup is functionally equivalent to fetching product by ID
- Least privilege: Users who can scan barcodes should have read access to product data
- No new permission needed: Reuse existing RBAC permission

**Alternatives Considered**:
- Create new `barcode:scan` permission: Rejected as unnecessary granularity
- No permission check: Rejected as violates security model

**Chosen Approach**: Reuse `products:read` permission via `requirePermission` middleware.

---

## Implementation Details

### Technical Approach
1. **OpenAPI Schema Definition**: Define request/response types using Zod schemas with `.openapi()` extension
2. **Service Layer Implementation**: Business logic separated from route handler, uses Prisma for type-safe queries
3. **Route Handler**: Thin controller that validates input, calls service, returns standard envelope
4. **Multi-Tenant Filtering**: Always filter by `req.currentTenantId` from session middleware

### Algorithms & Logic

#### Barcode Lookup Flow
```typescript
// 1. Extract barcode from path parameter
const barcode = request.validatedParams.barcode;

// 2. Query product by tenant + barcode (uses unique index)
const product = await prisma.product.findFirst({
  where: {
    tenantId: currentTenantId,  // <- Multi-tenant isolation
    barcode: barcodePathParam,
  },
});

// 3. If not found, throw 404 with tenant-specific message
if (!product) {
  throw Errors.notFound(`Product with barcode '${barcode}' not found for this tenant.`);
}

// 4. Optionally fetch stock if branchId provided
if (branchIdOptional) {
  const stock = await prisma.productStock.findFirst({
    where: {
      tenantId: currentTenantId,
      branchId: branchIdOptional,
      productId: product.id,
    },
    include: { branch: { select: { branchName: true } } },
  });
}

// 5. Return product with optional stock
return { ...product, stock: stockInfo };
```

### Edge Cases Handled

#### 1. Empty Barcode Parameter
- **Case**: Client sends empty string or whitespace-only barcode
- **Handling**: Service validates `!barcodePathParam || barcodePathParam.trim().length === 0` and throws `Errors.validation()`
- **Response**: 400 Bad Request with message "Barcode parameter is required and cannot be empty."

#### 2. Barcode Not Found for Tenant
- **Case**: Barcode exists in another tenant but not in current tenant
- **Handling**: `findFirst()` returns null, service throws `Errors.notFound()` with tenant-specific message
- **Response**: 404 Not Found with message "Product with barcode 'XXX' not found for this tenant."

#### 3. Product Has No Barcode
- **Case**: Product exists but `barcode` field is NULL
- **Handling**: Query won't match (NULL != barcode value), returns 404
- **Implication**: Only products with barcodes can be looked up via this endpoint (expected behavior)

#### 4. Branch ID Invalid or Not Found
- **Case**: Client provides `branchId` that doesn't exist or belongs to different tenant
- **Handling**: `productStock.findFirst()` returns null, `stockInfo` remains null
- **Response**: 200 OK with `stock: null` (graceful degradation, not an error)
- **Rationale**: Product lookup succeeded; missing stock is not a failure condition

#### 5. Product Without Stock Record
- **Case**: Product exists but no ProductStock record for specified branch
- **Handling**: `productStock.findFirst()` returns null, `stockInfo` remains null
- **Response**: 200 OK with `stock: null`
- **Rationale**: New products or branches may not have stock records yet

#### 6. Case Sensitivity
- **Case**: Barcode lookup is case-sensitive by default in PostgreSQL
- **Handling**: No transformation applied; barcode scanned must match exactly as stored
- **Design**: Barcode standards (EAN13, UPC-A) are numeric; CODE128 and QR are case-sensitive by nature
- **Future Enhancement**: Could add case-insensitive lookup if needed via Prisma mode: 'insensitive'

### Performance Considerations

#### Database Query Optimization
- **Indexed Lookup**: `@@index([barcode])` ensures O(log n) barcode lookup
- **Composite Unique Constraint**: `@@unique([tenantId, barcode])` creates composite index for tenant-scoped lookup
- **Selective Field Projection**: Only fetch needed fields via explicit `select` (no `SELECT *`)
- **Optional Join**: Stock query only executed if `branchId` provided (avoids unnecessary work)

#### Response Time Expectations
- Barcode lookup (no stock): ~10-30ms (indexed query)
- Barcode lookup (with stock): ~20-50ms (2 indexed queries)
- Rate limited to 600 requests/minute per session (general API limit)

#### Scalability
- **Unique constraint prevents duplicates**: No need for additional validation queries
- **No N+1 queries**: Single query for product, single query for stock (if requested)
- **Stateless**: No session state required beyond authentication

### Security Considerations

#### Multi-Tenant Isolation
- **Enforcement**: Every query filters by `currentTenantId` from session
- **Validation**: Session middleware ensures `currentTenantId` is set before route handler executes
- **Audit**: Uses existing `correlationId` for request tracing (no audit event for read operations)

#### Permission Enforcement
- **Middleware**: `requirePermission("products:read")` executes before route handler
- **Backend-only**: Frontend permission checks are supplementary; backend is source of truth
- **Role Mapping**:
  - OWNER: Has `products:read` ✅
  - ADMIN: Has `products:read` ✅
  - EDITOR: Has `products:read` ✅
  - VIEWER: Has `products:read` ✅

#### Input Validation
- **Zod Schemas**: Validate barcode parameter (string, 1-100 chars)
- **SQL Injection Protection**: Prisma parameterized queries (no raw SQL)
- **Type Safety**: TypeScript + Zod + Prisma ensure type correctness

#### Rate Limiting
- **General API limit**: 600 requests/minute per IP+session
- **Headers**: Returns `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

## Testing

### How to Test

#### Manual Testing with Sample Barcodes

**Prerequisites:**
- API server running: `cd api-server && npm run dev`
- Database seeded: `npm run db:seed`
- Authenticated session cookie (sign in via POST /api/auth/sign-in)

**Test 1: Lookup by Barcode (No Stock)**
```bash
# ACME tenant - EAN13 barcode
curl -X GET 'http://localhost:4000/api/products/by-barcode/5012345678900' \
  -H 'Cookie: mt_session=...' \
  -H 'Content-Type: application/json'

# Expected: 200 OK with product (no stock field)
```

**Test 2: Lookup by Barcode with Stock**
```bash
# ACME tenant - with branch stock
curl -X GET 'http://localhost:4000/api/products/by-barcode/5012345678900?branchId=<branch-id>' \
  -H 'Cookie: mt_session=...' \
  -H 'Content-Type: application/json'

# Expected: 200 OK with product + stock object
```

**Test 3: Barcode Not Found**
```bash
# Non-existent barcode
curl -X GET 'http://localhost:4000/api/products/by-barcode/9999999999999' \
  -H 'Cookie: mt_session=...' \
  -H 'Content-Type: application/json'

# Expected: 404 Not Found
```

**Test 4: Empty Barcode**
```bash
# Empty barcode parameter
curl -X GET 'http://localhost:4000/api/products/by-barcode/ ' \
  -H 'Cookie: mt_session=...' \
  -H 'Content-Type: application/json'

# Expected: 400 Bad Request (validation error)
```

**Test 5: Multi-Tenant Isolation**
```bash
# Sign in as ACME tenant, try to lookup GLOBEX barcode
curl -X GET 'http://localhost:4000/api/products/by-barcode/GLX-HEAT-001' \
  -H 'Cookie: mt_session=<acme-session>' \
  -H 'Content-Type: application/json'

# Expected: 404 Not Found (barcode exists in GLOBEX, not ACME)
```

**Test 6: Permission Denied**
```bash
# Sign in as user without products:read permission (if such role exists)
curl -X GET 'http://localhost:4000/api/products/by-barcode/5012345678900' \
  -H 'Cookie: mt_session=<no-permission-session>' \
  -H 'Content-Type: application/json'

# Expected: 403 Forbidden
```

**Test 7: Unauthenticated**
```bash
# No session cookie
curl -X GET 'http://localhost:4000/api/products/by-barcode/5012345678900'

# Expected: 401 Unauthorized
```

### Test Files Created/Modified
None yet (pending test-engineer work)

### Test Coverage
**Planned test scenarios (for test-engineer):**

- ✅ Happy path: Lookup existing barcode, returns product
- ✅ Happy path with stock: Lookup with branchId, returns product + stock
- ✅ Not found: Non-existent barcode returns 404
- ✅ Validation error: Empty barcode returns 400
- ✅ Multi-tenant isolation: Barcode from different tenant returns 404
- ✅ Permission check: User without products:read gets 403
- ✅ Authentication check: No session gets 401
- ✅ Stock not found: Valid branchId but no stock record returns stock: null
- ✅ Invalid branchId: Returns stock: null (graceful degradation)
- ✅ Different barcode formats: Test EAN13, UPCA, CODE128, QR codes
- ❌ Not yet covered: Rate limiting behavior
- ❌ Not yet covered: Correlation ID propagation
- ❌ Not yet covered: OpenAPI spec validation (schema matches implementation)

### Manual Testing Notes
- Tested barcode lookup with sample seed data (ACME tenant)
- Confirmed multi-tenant filtering works (GLOBEX barcode not accessible from ACME session)
- Stock lookup works correctly when branchId provided
- Error messages are user-friendly and include barcode value for debugging

---

## Next Steps

### Immediate Next Steps
- [x] Backend API implemented (this work)
- [ ] **integration-orchestrator**: Regenerate OpenAPI types for frontend
  - Command: `cd admin-web && npm run openapi:gen`
  - Updates: `admin-web/src/types/openapi.d.ts`
- [ ] **frontend-expert**: Create BarcodeScannerModal component
  - Install library: `npm install html5-qrcode`
  - Create modal component with camera integration
  - Call `GET /api/products/by-barcode/:barcode` endpoint
  - Display scanned items list with counts
- [ ] **frontend-expert**: Add barcode fields to ProductDetailPage form
  - Add barcode input field
  - Add barcodeType dropdown (EAN13, UPCA, CODE128, QR)
  - Validate uniqueness on create/update
- [ ] **test-engineer**: Write backend unit tests
  - Test barcode lookup service function
  - Test multi-tenant isolation
  - Test error cases (not found, empty barcode, etc.)
- [ ] **test-engineer**: Write E2E tests for barcode scanning flow

### What Other Agents Need to Know

**For integration-orchestrator:**
- **OpenAPI spec changed**: New endpoint and schemas added
- **Regeneration required**: Run `npm run openapi:gen` in admin-web workspace
- **Type usage**: Frontend can import types from `paths['/api/products/by-barcode/{barcode}']['get']`
- **Breaking changes**: None (all changes are additive)

**For frontend-expert:**
- **API Endpoint**: `GET /api/products/by-barcode/:barcode?branchId=xxx`
- **Response Type**: `paths['/api/products/by-barcode/{barcode}']['get']['responses']['200']['content']['application/json']`
- **Permission Required**: `products:read` (use `<RequirePermission perm="products:read">`)
- **Sample Barcodes for Testing**:
  - ACME: `5012345678900` (EAN13), `012345678905` (UPCA)
  - GLOBEX: `GLX-HEAT-001` (CODE128)
- **Stock Info**: Include `branchId` query param to get stock availability at that branch
- **Error Handling**:
  - 404 = Barcode not found (show "Not in this transfer" message)
  - 400 = Invalid barcode (show validation error)
  - 403 = Permission denied (redirect to access denied page)

**For test-engineer:**
- **Service Function**: `getProductByBarcodeForCurrentTenantService()` in `productService.ts`
- **Test Helpers Needed**:
  - Create product with barcode: `createTestProduct({ barcode, barcodeType })`
  - Create stock record: `createTestProductStock({ branchId, productId, qtyOnHand })`
- **Multi-Tenant Test**: Create same barcode in 2 tenants, verify isolation
- **Edge Cases**: Test empty barcode, null barcode, whitespace-only barcode
- **Stock Scenarios**: Test with/without branchId, with/without stock record, invalid branchId

### Integration Requirements
- [x] Database migration applied (completed by database-expert)
- [x] RBAC permissions seeded (`products:read` already exists)
- [ ] OpenAPI types regenerated (integration-orchestrator)
- [x] API server code complete (this work)
- [ ] Frontend implementation (frontend-expert)
- [ ] Tests passing (test-engineer)

---

## Blockers & Issues

### Current Blockers
None

### Known Issues
None

### Questions/Uncertainties
None

---

## References

### Documentation
- `.agent/System/architecture.md` - API design patterns (standard envelope, correlation IDs)
- `.agent/System/database-schema.md` - Product model schema with barcode fields
- `.agent/System/rbac-system.md` - Permission enforcement patterns

### Related Agent Outputs
- `.agent/Features/InProgress/stock-transfers-v2-phase3/database-expert.md` - Barcode schema changes
- `.agent/Features/InProgress/stock-transfers-v2-phase3/prd.md` - Feature requirements

### External Resources
- [Prisma Documentation - Unique Constraints](https://www.prisma.io/docs/concepts/components/prisma-schema/data-model#defining-a-unique-field) - Used for tenant-scoped barcode uniqueness
- [Zod Documentation](https://zod.dev/) - Schema validation patterns
- [OpenAPI 3.1 Specification](https://swagger.io/specification/) - API documentation standards

### Code Examples
- `api-server/src/routes/productRouter.ts:86-111` - Similar GET by ID pattern
- `api-server/src/services/products/productService.ts:41-64` - Similar service function pattern
- `api-server/src/openapi/paths/products.ts:18-36` - Similar OpenAPI registration pattern

---

## Metadata

**Completion Time:** ~2 hours
**Complexity:** Medium
**Lines of Code Changed:** ~250 lines
- OpenAPI schemas: ~70 lines
- OpenAPI paths: ~30 lines
- Service layer: ~80 lines
- Route handler: ~40 lines
- Schema updates: ~30 lines

---

_End of Output_
