# Backend Test Template

**Purpose:** Standardized patterns for backend test files (Jest + Supertest)

**Version:** 1.0
**Last Updated:** 2025-10-21

---

## Table of Contents

1. [Test Naming Conventions](#test-naming-conventions)
2. [Service Test Pattern](#service-test-pattern)
3. [Route Test Pattern](#route-test-pattern)
4. [Permission Test Pattern](#permission-test-pattern)
5. [Common Patterns](#common-patterns)
6. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
7. [Test Isolation](#test-isolation)
8. [Examples from Codebase](#examples-from-codebase)

---

## Test Naming Conventions

### ✅ DO: Use Descriptive, Meaningful Names

Test names should clearly describe **what** is being tested and **why** it matters:

```typescript
// ✅ GOOD - Descriptive suite names
describe('[ST-007] Product Service', () => {
  describe('[AC-007-1] createProductForCurrentTenantService - Create Product', () => {
    it('should create a product with valid data', async () => { ... });
    it('should create audit log entry', async () => { ... });
    it('should reject duplicate SKU in same tenant', async () => { ... });
    it('should allow same SKU in different tenants', async () => { ... });
  });

  describe('[AC-007-2] getProductForCurrentTenantService - Get Product', () => {
    it('should retrieve product by ID', async () => { ... });
    it('should throw not found for non-existent product', async () => { ... });
    it('should not allow access to product from different tenant', async () => { ... });
  });
});
```

**Naming Structure:**
- **Top-level `describe`**: `[ST-XXX] Feature Name` (e.g., `[ST-007] Product Service`)
- **Nested `describe`**: `[AC-XXX-Y] functionName - Action` (e.g., `[AC-007-1] createProduct - Create Product`)
- **Test `it`**: `should [expected behavior]` (e.g., `should create product with valid data`)

**Why this structure?**
- `[ST-XXX]` = Story/Suite number (for traceability)
- `[AC-XXX-Y]` = Acceptance Criteria number (maps to requirements)
- Function name + action makes it clear what's being tested
- `should` statements describe expected behavior clearly

### ❌ DON'T: Use PRD Phase Numbers or Generic Names

**ANTI-PATTERN: PRD phase numbers in test names**

```typescript
// ❌ BAD - Phase numbers are not descriptive
describe('[PHASE-1-1] restoreLotQuantities Function', () => { ... });
describe('[PHASE-1-2] reverseLotsAtBranch Helper', () => { ... });
describe('[PHASE-2-1] Complex FIFO Scenarios', () => { ... });

// ✅ GOOD - Descriptive functional names
describe('[LOT-RESTORE-1] restoreLotQuantities - Restore Stock Lot Quantities', () => { ... });
describe('[LOT-RESTORE-2] reverseLotsAtBranch - Reverse Lots at Branch', () => { ... });
describe('[FIFO-COMPLEX] Complex FIFO Consumption Scenarios', () => { ... });
```

**Why avoid phase numbers?**
- Phase numbers are **temporary** (only relevant during development)
- They don't describe **what** is being tested
- They become **meaningless** after the PRD is complete
- Future developers won't know what "PHASE-1-1" means
- Test names should be **timeless** and **self-documenting**

### Test Name Examples by Type

**Service Tests:**
```typescript
describe('[PRODUCT-SVC] Product Service', () => {
  describe('createProduct - Create New Product', () => { ... });
  describe('updateProduct - Update Existing Product', () => { ... });
  describe('deleteProduct - Archive Product (Soft Delete)', () => { ... });
});
```

**Route Tests:**
```typescript
describe('[PRODUCT-API] Product API Routes', () => {
  describe('POST /api/products - Create Product', () => { ... });
  describe('GET /api/products/:id - Get Product by ID', () => { ... });
  describe('PUT /api/products/:id - Update Product', () => { ... });
});
```

**Middleware Tests:**
```typescript
describe('[MIDDLEWARE-SESSION] Session Middleware', () => {
  describe('sessionMiddleware - Set Current User and Tenant', () => { ... });
  describe('requireAuthenticatedUserMiddleware - Require Authentication', () => { ... });
});
```

---

## Service Test Pattern

**Purpose:** Test business logic in isolation (no HTTP layer)

**Focus:** Domain logic, validation, data transformations, multi-tenancy

**File Location:** `__tests__/features/{feature}/{feature}Service.test.ts`

### Template Structure

```typescript
// api-server/__tests__/features/products/productService.test.ts
import {
  createProductForCurrentTenantService,
  getProductForCurrentTenantService,
  updateProductForCurrentTenantService,
  deleteProductForCurrentTenantService,
} from '../../../src/services/products/productService.js';
import {
  createTestUser,
  createTestTenant,
  createTestProduct,
} from '../../helpers/factories.js';
import { prismaClientInstance as prisma } from '../../../src/db/prismaClient.js';

describe('[PRODUCT-SVC] Product Service', () => {
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;

  beforeEach(async () => {
    // Create fresh test data for each test
    testTenant = await createTestTenant();
    testUser = await createTestUser();
  });

  describe('createProduct - Create New Product', () => {
    it('should create a product with valid data', async () => {
      const result = await createProductForCurrentTenantService({
        currentTenantId: testTenant.id,
        productNameInputValue: 'Test Widget',
        productSkuInputValue: 'WIDGET-001',
        productPricePenceInputValue: 1500,
        auditContextOptional: { actorUserId: testUser.id },
      });

      // Assert the result
      expect(result).toBeDefined();
      expect(result.productName).toBe('Test Widget');
      expect(result.productSku).toBe('WIDGET-001');
      expect(result.productPricePence).toBe(1500);
      expect(result.tenantId).toBe(testTenant.id);
    });

    it('should create audit log entry', async () => {
      const result = await createProductForCurrentTenantService({
        currentTenantId: testTenant.id,
        productNameInputValue: 'Audited Product',
        productSkuInputValue: 'AUDIT-001',
        productPricePenceInputValue: 2000,
        auditContextOptional: { actorUserId: testUser.id },
      });

      // Verify audit log was created
      const auditEntry = await prisma.auditEvent.findFirst({
        where: {
          entityId: result.id,
          action: 'CREATE',
        },
      });

      expect(auditEntry).toBeDefined();
      expect(auditEntry?.entityType).toBe('PRODUCT');
      expect(auditEntry?.actorUserId).toBe(testUser.id);
    });

    it('should reject duplicate SKU in same tenant', async () => {
      // Create first product
      await createProductForCurrentTenantService({
        currentTenantId: testTenant.id,
        productNameInputValue: 'First Product',
        productSkuInputValue: 'DUPE-001',
        productPricePenceInputValue: 1000,
      });

      // Attempt to create duplicate - should throw
      await expect(
        createProductForCurrentTenantService({
          currentTenantId: testTenant.id,
          productNameInputValue: 'Second Product',
          productSkuInputValue: 'DUPE-001', // Duplicate SKU
          productPricePenceInputValue: 2000,
        })
      ).rejects.toThrow('already exists');
    });

    it('should allow same SKU in different tenants', async () => {
      const tenant2 = await createTestTenant();

      // Create product in first tenant
      await createProductForCurrentTenantService({
        currentTenantId: testTenant.id,
        productNameInputValue: 'Product Tenant 1',
        productSkuInputValue: 'SHARED-SKU',
        productPricePenceInputValue: 1000,
      });

      // Same SKU in different tenant - should succeed
      const result2 = await createProductForCurrentTenantService({
        currentTenantId: tenant2.id,
        productNameInputValue: 'Product Tenant 2',
        productSkuInputValue: 'SHARED-SKU',
        productPricePenceInputValue: 2000,
      });

      expect(result2).toBeDefined();
      expect(result2.productSku).toBe('SHARED-SKU');
      expect(result2.tenantId).toBe(tenant2.id);
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should not allow access to product from different tenant', async () => {
      const tenant2 = await createTestTenant();
      const otherProduct = await createTestProduct({
        tenantId: tenant2.id,
      });

      // Attempt to get product from different tenant - should throw
      await expect(
        getProductForCurrentTenantService({
          currentTenantId: testTenant.id,
          productIdPathParam: otherProduct.id,
        })
      ).rejects.toThrow('not found');
    });
  });
});
```

### Service Test Checklist

**What to test:**
- ✅ CRUD operations (Create, Read, Update, Delete, Restore if applicable)
- ✅ Business rule validation (e.g., duplicate SKU checks)
- ✅ Data transformations and calculations
- ✅ Error cases (not found, validation errors, conflicts)
- ✅ Multi-tenant isolation (cannot access other tenant's data)
- ✅ Audit log creation (CREATE, UPDATE, DELETE actions)
- ✅ Edge cases (empty data, large datasets, boundary conditions)

**What NOT to test:**
- ❌ HTTP request/response (that's for route tests)
- ❌ Permission enforcement (that's for permission tests)
- ❌ Request validation (that's for route tests with Zod)

---

## Route Test Pattern

**Purpose:** Test HTTP layer (request/response, validation, authentication)

**Focus:** Express router, middleware, request/response format, basic permissions

**File Location:** `__tests__/features/{feature}/{feature}Routes.test.ts`

### Template Structure

```typescript
// api-server/__tests__/features/products/productRoutes.test.ts
import request from 'supertest';
import express, { type Express } from 'express';
import { productRouter } from '../../../src/routes/productRouter.js';
import { sessionMiddleware } from '../../../src/middleware/sessionMiddleware.js';
import { standardErrorHandler } from '../../../src/middleware/errorHandler.js';
import cookieParser from 'cookie-parser';
import {
  createTestUser,
  createTestTenant,
  createTestProduct,
  createTestRoleWithPermissions,
  createTestMembership,
} from '../../helpers/factories.js';
import { createSessionCookie } from '../../helpers/auth.js';
import { ROLE_DEFS } from '../../../src/rbac/catalog.js';

describe('[PRODUCT-API] Product API Routes', () => {
  let app: Express;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let sessionCookie: string;

  beforeAll(async () => {
    // Setup Express app with router and middleware
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(sessionMiddleware);
    app.use('/api/products', productRouter);
    app.use(standardErrorHandler);
  });

  beforeEach(async () => {
    // Create fresh test data for each test
    testTenant = await createTestTenant();
    testUser = await createTestUser();

    // Create role with required permissions
    const role = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ROLE_DEFS.EDITOR, // Has products:read and products:write
    });

    await createTestMembership({
      userId: testUser.id,
      tenantId: testTenant.id,
      roleId: role.id,
    });

    sessionCookie = createSessionCookie(testUser.id, testTenant.id);
  });

  describe('POST /api/products - Create Product', () => {
    it('should create product with valid data', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Cookie', sessionCookie)
        .send({
          productName: 'Test Widget',
          productSku: 'WIDGET-001',
          productPricePence: 1500,
        });

      // Assert HTTP response
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.product).toBeDefined();
      expect(response.body.data.product.productName).toBe('Test Widget');
    });

    it('should reject without authentication', async () => {
      const response = await request(app)
        .post('/api/products')
        .send({
          productName: 'Test',
          productSku: 'TEST-001',
          productPricePence: 1000,
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject without products:write permission', async () => {
      // Create user with read-only permissions
      const viewer = await createTestUser();
      const viewerRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ROLE_DEFS.VIEWER, // Only has products:read
      });
      await createTestMembership({
        userId: viewer.id,
        tenantId: testTenant.id,
        roleId: viewerRole.id,
      });

      const viewerCookie = createSessionCookie(viewer.id, testTenant.id);

      const response = await request(app)
        .post('/api/products')
        .set('Cookie', viewerCookie)
        .send({
          productName: 'Test',
          productSku: 'TEST-001',
          productPricePence: 1000,
        });

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Cookie', sessionCookie)
        .send({
          productName: '', // Empty name (invalid)
          productSku: 'invalid sku', // Invalid SKU format
          productPricePence: -100, // Negative price (invalid)
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error?.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should support idempotency with Idempotency-Key header', async () => {
      const idempotencyKey = 'test-key-123';
      const requestBody = {
        productName: 'Idempotent Product',
        productSku: 'IDEMP-001',
        productPricePence: 1500,
      };

      // First request
      const response1 = await request(app)
        .post('/api/products')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send(requestBody);

      expect(response1.status).toBe(201);
      const productId = response1.body.data.product.id;

      // Second request with same key - should return same response
      const response2 = await request(app)
        .post('/api/products')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send(requestBody);

      expect(response2.status).toBe(201);
      expect(response2.body.data.product.id).toBe(productId);
    });
  });

  describe('GET /api/products/:id - Get Product by ID', () => {
    it('should get product by ID', async () => {
      const product = await createTestProduct({
        name: 'Get Test Product',
        sku: 'GET-001',
        tenantId: testTenant.id,
        pricePence: 2500,
      });

      const response = await request(app)
        .get(`/api/products/${product.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.product.id).toBe(product.id);
      expect(response.body.data.product.productName).toBe('Get Test Product');
    });

    it('should return 404 for non-existent product', async () => {
      const response = await request(app)
        .get('/api/products/non-existent-id')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
      expect(response.body.error?.errorCode).toBe('RESOURCE_NOT_FOUND');
    });

    it('should not allow access to other tenant products', async () => {
      const otherTenant = await createTestTenant();
      const otherProduct = await createTestProduct({
        tenantId: otherTenant.id,
      });

      const response = await request(app)
        .get(`/api/products/${otherProduct.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
    });
  });
});
```

### Route Test Checklist

**What to test:**
- ✅ HTTP methods (GET, POST, PUT, DELETE)
- ✅ Request validation (Zod schemas, body/query/params)
- ✅ Response format (envelope: `{ success, data, error }`)
- ✅ Response status codes (200, 201, 400, 401, 403, 404, 409, etc.)
- ✅ Authentication requirement (401 without session cookie)
- ✅ Basic permission check (1 happy path, 1 denied path)
- ✅ Idempotency support (where applicable)
- ✅ Cross-tenant isolation (404 for other tenant's resources)

**What NOT to test:**
- ❌ Comprehensive permission matrix (that's for `permissions/` tests)
- ❌ Complex business logic (that's for service tests)
- ❌ Database internals (that's for service tests)

**NOTE:** Route tests should have **minimal permission testing** (just verify it works and it's blocked). Full permission matrix testing belongs in the `permissions/` directory.

---

## Permission Test Pattern

**Purpose:** Comprehensive RBAC testing (all roles × all endpoints)

**Focus:** Permission enforcement, role-based access, cross-tenant isolation

**File Location:** `__tests__/permissions/{feature}.permissions.test.ts`

### Template Structure

```typescript
// api-server/__tests__/permissions/products.permissions.test.ts
import request from 'supertest';
import express, { type Express } from 'express';
import { productRouter } from '../../src/routes/productRouter.js';
import { sessionMiddleware } from '../../src/middleware/sessionMiddleware.js';
import { standardErrorHandler } from '../../src/middleware/errorHandler.js';
import cookieParser from 'cookie-parser';
import {
  createTestUser,
  createTestTenant,
  createTestProduct,
  createTestRoleWithPermissions,
  createTestMembership,
} from '../helpers/factories.js';
import { createSessionCookie } from '../helpers/auth.js';
import { ROLE_DEFS } from '../../src/rbac/catalog.js';

describe('[RBAC] Products Permissions', () => {
  let app: Express;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;

  // Users for each role
  let ownerUser: Awaited<ReturnType<typeof createTestUser>>;
  let adminUser: Awaited<ReturnType<typeof createTestUser>>;
  let editorUser: Awaited<ReturnType<typeof createTestUser>>;
  let viewerUser: Awaited<ReturnType<typeof createTestUser>>;

  // Session cookies for each role
  let ownerCookie: string;
  let adminCookie: string;
  let editorCookie: string;
  let viewerCookie: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(sessionMiddleware);
    app.use('/api/products', productRouter);
    app.use(standardErrorHandler);
  });

  beforeEach(async () => {
    testTenant = await createTestTenant();

    // Create users for each role
    ownerUser = await createTestUser();
    adminUser = await createTestUser();
    editorUser = await createTestUser();
    viewerUser = await createTestUser();

    // Create roles
    const ownerRole = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ROLE_DEFS.OWNER,
    });
    const adminRole = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ROLE_DEFS.ADMIN,
    });
    const editorRole = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ROLE_DEFS.EDITOR,
    });
    const viewerRole = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ROLE_DEFS.VIEWER,
    });

    // Create memberships
    await createTestMembership({ userId: ownerUser.id, tenantId: testTenant.id, roleId: ownerRole.id });
    await createTestMembership({ userId: adminUser.id, tenantId: testTenant.id, roleId: adminRole.id });
    await createTestMembership({ userId: editorUser.id, tenantId: testTenant.id, roleId: editorRole.id });
    await createTestMembership({ userId: viewerUser.id, tenantId: testTenant.id, roleId: viewerRole.id });

    // Create session cookies
    ownerCookie = createSessionCookie(ownerUser.id, testTenant.id);
    adminCookie = createSessionCookie(adminUser.id, testTenant.id);
    editorCookie = createSessionCookie(editorUser.id, testTenant.id);
    viewerCookie = createSessionCookie(viewerUser.id, testTenant.id);
  });

  describe('GET /api/products - List Products', () => {
    it('OWNER - should allow access', async () => {
      const response = await request(app)
        .get('/api/products')
        .set('Cookie', ownerCookie);

      expect(response.status).toBe(200);
    });

    it('ADMIN - should allow access', async () => {
      const response = await request(app)
        .get('/api/products')
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
    });

    it('EDITOR - should allow access (has products:read)', async () => {
      const response = await request(app)
        .get('/api/products')
        .set('Cookie', editorCookie);

      expect(response.status).toBe(200);
    });

    it('VIEWER - should allow access (has products:read)', async () => {
      const response = await request(app)
        .get('/api/products')
        .set('Cookie', viewerCookie);

      expect(response.status).toBe(200);
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app).get('/api/products');

      expect(response.status).toBe(401);
      expect(response.body.error?.errorCode).toBe('AUTH_REQUIRED');
    });
  });

  describe('POST /api/products - Create Product', () => {
    const requestBody = {
      productName: 'Test Product',
      productSku: 'TEST-001',
      productPricePence: 1000,
    };

    it('OWNER - should allow (has products:write)', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Cookie', ownerCookie)
        .send(requestBody);

      expect(response.status).toBe(201);
    });

    it('ADMIN - should allow (has products:write)', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Cookie', adminCookie)
        .send({ ...requestBody, productSku: 'TEST-002' });

      expect(response.status).toBe(201);
    });

    it('EDITOR - should allow (has products:write)', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Cookie', editorCookie)
        .send({ ...requestBody, productSku: 'TEST-003' });

      expect(response.status).toBe(201);
    });

    it('VIEWER - should deny (lacks products:write)', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Cookie', viewerCookie)
        .send(requestBody);

      expect(response.status).toBe(403);
      expect(response.body.error?.errorCode).toBe('PERMISSION_DENIED');
    });

    it('Unauthenticated - should deny (401)', async () => {
      const response = await request(app)
        .post('/api/products')
        .send(requestBody);

      expect(response.status).toBe(401);
    });

    it('Custom role with permission - should allow', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read', 'products:write'],
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .post('/api/products')
        .set('Cookie', customCookie)
        .send({ ...requestBody, productSku: 'CUSTOM-001' });

      expect(response.status).toBe(201);
    });

    it('Custom role without permission - should deny', async () => {
      const customUser = await createTestUser();
      const customRole = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'], // Missing products:write
      });
      await createTestMembership({
        userId: customUser.id,
        tenantId: testTenant.id,
        roleId: customRole.id,
      });
      const customCookie = createSessionCookie(customUser.id, testTenant.id);

      const response = await request(app)
        .post('/api/products')
        .set('Cookie', customCookie)
        .send(requestBody);

      expect(response.status).toBe(403);
    });
  });

  describe('Cross-Tenant Isolation', () => {
    it('should not allow access to other tenant products', async () => {
      const otherTenant = await createTestTenant();
      const otherProduct = await createTestProduct({
        tenantId: otherTenant.id,
      });

      const response = await request(app)
        .get(`/api/products/${otherProduct.id}`)
        .set('Cookie', ownerCookie); // Using owner from first tenant

      expect(response.status).toBe(404);
    });
  });
});
```

### Permission Test Checklist

**What to test:**
- ✅ All HTTP methods (GET, POST, PUT, DELETE, restore, etc.)
- ✅ All system roles (OWNER, ADMIN, EDITOR, VIEWER)
- ✅ Custom roles (with and without permission)
- ✅ Unauthenticated requests (401)
- ✅ Cross-tenant isolation (404 for other tenant's resources)
- ✅ Edge case: User with no tenant membership (403)

**Matrix Testing Approach:**
- Test **every endpoint** with **every role**
- Document which roles should succeed and which should fail
- Verify correct HTTP status codes (200/201 for allowed, 403 for denied, 401 for unauthenticated)

---

## Common Patterns

### 1. Test Data Setup (beforeEach)

Always create fresh test data in `beforeEach` to ensure test isolation:

```typescript
beforeEach(async () => {
  testTenant = await createTestTenant();
  testUser = await createTestUser();

  // Create role and membership if needed
  const role = await createTestRoleWithPermissions({
    tenantId: testTenant.id,
    permissionKeys: ['products:read', 'products:write'],
  });

  await createTestMembership({
    userId: testUser.id,
    tenantId: testTenant.id,
    roleId: role.id,
  });
});
```

### 2. Use Factory Helpers

Always use factory helpers from `__tests__/helpers/factories.ts`:

```typescript
// ✅ GOOD - Use factories
const tenant = await createTestTenant();
const user = await createTestUser();
const product = await createTestProduct({ tenantId: tenant.id });

// ❌ BAD - Direct Prisma calls in tests
const tenant = await prisma.tenant.create({ ... });
```

**Why?** Factories handle:
- Unique timestamps for test isolation
- Required field defaults
- Relationships (foreign keys)
- Consistent test data structure

### 3. Test Error Cases with `.rejects.toThrow()`

```typescript
it('should reject duplicate SKU', async () => {
  await createProductForCurrentTenantService({
    currentTenantId: testTenant.id,
    productSkuInputValue: 'DUPE-001',
    // ... other fields
  });

  // Attempt duplicate - should throw
  await expect(
    createProductForCurrentTenantService({
      currentTenantId: testTenant.id,
      productSkuInputValue: 'DUPE-001', // Same SKU
      // ... other fields
    })
  ).rejects.toThrow('already exists');
});
```

### 4. Multi-Tenant Isolation Testing

Always test that users cannot access other tenants' data:

```typescript
it('should not allow access to product from different tenant', async () => {
  const tenant2 = await createTestTenant();
  const otherProduct = await createTestProduct({
    tenantId: tenant2.id,
  });

  await expect(
    getProductForCurrentTenantService({
      currentTenantId: testTenant.id,
      productIdPathParam: otherProduct.id,
    })
  ).rejects.toThrow('not found');
});
```

### 5. Session Cookie Pattern (Route Tests)

```typescript
// Create session cookie from user and tenant IDs
const sessionCookie = createSessionCookie(testUser.id, testTenant.id);

// Use in HTTP requests
const response = await request(app)
  .post('/api/products')
  .set('Cookie', sessionCookie)
  .send({ ... });
```

### 6. Audit Log Verification

```typescript
it('should create audit log entry', async () => {
  const result = await createProductForCurrentTenantService({
    currentTenantId: testTenant.id,
    // ... fields
    auditContextOptional: { actorUserId: testUser.id },
  });

  const auditEntry = await prisma.auditEvent.findFirst({
    where: {
      entityId: result.id,
      action: 'CREATE',
    },
  });

  expect(auditEntry).toBeDefined();
  expect(auditEntry?.entityType).toBe('PRODUCT');
  expect(auditEntry?.actorUserId).toBe(testUser.id);
});
```

---

## Anti-Patterns to Avoid

### ❌ 1. Using PRD Phase Numbers in Test Names

```typescript
// ❌ BAD - Phase numbers are temporary and meaningless after PRD is done
describe('[PHASE-1-1] restoreLotQuantities Function', () => { ... });
describe('[PHASE-2-3] Complex FIFO Edge Cases', () => { ... });

// ✅ GOOD - Descriptive functional names that are timeless
describe('[LOT-RESTORE] restoreLotQuantities - Restore Stock Lot Quantities', () => { ... });
describe('[FIFO-EDGE] Complex FIFO Edge Cases', () => { ... });
```

**Why bad?**
- Phase numbers only make sense during PRD development
- Future developers won't know what "PHASE-1-1" means
- Test names should be self-documenting and timeless

### ❌ 2. Hardcoding Test Data

```typescript
// ❌ BAD - Hardcoded values can conflict between test runs
const user = await createTestUser({ email: 'test@example.com' });
const tenant = await createTestTenant({ slug: 'test-tenant' });

// ✅ GOOD - Use factory defaults (timestamp-based uniqueness)
const user = await createTestUser();
const tenant = await createTestTenant();
```

### ❌ 3. Testing Business Logic in Route Tests

```typescript
// ❌ BAD - Complex business logic testing in route test
it('should calculate FIFO cost correctly on product update', async () => {
  // ... 50 lines of FIFO setup and calculation verification
});

// ✅ GOOD - Business logic in service test, route test just checks HTTP
// In route test:
it('should update product and return 200', async () => {
  const response = await request(app).put('/api/products/123').send({ ... });
  expect(response.status).toBe(200);
});

// In service test:
it('should calculate FIFO cost correctly', async () => {
  // ... detailed FIFO logic testing
});
```

### ❌ 4. Testing All Permissions in Route Tests

```typescript
// ❌ BAD - Testing all roles in route test
describe('POST /api/products', () => {
  it('OWNER should allow', async () => { ... });
  it('ADMIN should allow', async () => { ... });
  it('EDITOR should allow', async () => { ... });
  it('VIEWER should deny', async () => { ... });
  it('Custom role with permission should allow', async () => { ... });
  it('Custom role without permission should deny', async () => { ... });
});

// ✅ GOOD - Minimal permission check in route test
describe('POST /api/products', () => {
  it('should create product with valid data', async () => { ... });
  it('should reject without authentication', async () => { ... });
  it('should reject without products:write permission', async () => { ... }); // One denied case
});

// Full permission matrix in permissions/products.permissions.test.ts
```

### ❌ 5. Not Testing Multi-Tenant Isolation

```typescript
// ❌ BAD - Only testing happy path for same tenant
it('should get product by ID', async () => {
  const product = await createTestProduct({ tenantId: testTenant.id });
  const result = await getProduct(product.id);
  expect(result.id).toBe(product.id);
});

// ✅ GOOD - Also test cross-tenant isolation
it('should not allow access to product from different tenant', async () => {
  const tenant2 = await createTestTenant();
  const otherProduct = await createTestProduct({ tenantId: tenant2.id });

  await expect(
    getProductForCurrentTenantService({
      currentTenantId: testTenant.id,
      productIdPathParam: otherProduct.id,
    })
  ).rejects.toThrow('not found');
});
```

### ❌ 6. Using Generic Test Names

```typescript
// ❌ BAD - Generic, unclear names
it('should work', async () => { ... });
it('test case 1', async () => { ... });
it('should return data', async () => { ... });

// ✅ GOOD - Specific, descriptive names
it('should create product with valid data', async () => { ... });
it('should reject duplicate SKU in same tenant', async () => { ... });
it('should return 404 for non-existent product', async () => { ... });
```

---

## Test Isolation

### Use Fresh Test Data

Always create fresh data in `beforeEach`:

```typescript
beforeEach(async () => {
  // Fresh data for each test
  testTenant = await createTestTenant();
  testUser = await createTestUser();
});
```

### Timestamp-Based Uniqueness

Factory helpers use `Date.now()` for unique values:

```typescript
// Factories automatically generate unique values
const tenant1 = await createTestTenant(); // slug: "test-tenant-1698845123456"
const tenant2 = await createTestTenant(); // slug: "test-tenant-1698845123789"
```

### No Database Cleanup Needed

Tests run against dev database but use unique timestamps, so cleanup is optional. See `__tests__/README.md` for details.

---

## Examples from Codebase

**High-Quality Examples:**
- [__tests__/services/product.test.ts](../services/product.test.ts) - Excellent service test pattern
- [__tests__/routes/productRoutes.test.ts](../routes/productRoutes.test.ts) - Excellent route test pattern
- [__tests__/middleware/permissions.test.ts](../middleware/permissions.test.ts) - Good permission testing (but should move to `permissions/`)

**Examples to Refactor:**
- [__tests__/services/stockLotRestoration.test.ts](../services/stockLotRestoration.test.ts) - Uses `[PHASE-X-Y]` naming (anti-pattern)

---

## Summary Checklist

**Before writing a new test:**
- [ ] Use descriptive suite names: `[FEATURE-TYPE] Feature Name`
- [ ] Avoid PRD phase numbers in test names
- [ ] Use `should [expected behavior]` for test descriptions
- [ ] Choose correct test type (service, route, or permission)
- [ ] Use factory helpers for test data
- [ ] Create fresh data in `beforeEach`
- [ ] Test multi-tenant isolation
- [ ] Test error cases and edge cases
- [ ] Follow separation of concerns (business logic in service tests, HTTP in route tests, RBAC in permission tests)

**After writing tests:**
- [ ] All tests pass independently (`npm run test:accept`)
- [ ] Test names are clear and descriptive
- [ ] No hardcoded test data values
- [ ] Multi-tenant isolation verified
- [ ] Error cases covered
- [ ] Audit logs verified (where applicable)

---

**Questions?** See [Backend Testing Guide](../../.agent/SOP/backend-testing.md) for more details.

**Last Updated:** 2025-10-21
**Version:** 1.0
