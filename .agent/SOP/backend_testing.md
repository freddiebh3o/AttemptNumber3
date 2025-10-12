# Backend Testing Guide (Jest)

**Purpose:** Guide for writing backend tests using Jest, Supertest, and real database testing.

**Last Updated:** 2025-10-12

---

## Table of Contents

1. [Setup](#setup)
2. [Writing Tests](#writing-tests)
3. [Test Helpers](#test-helpers)
4. [Common Patterns](#common-patterns)
5. [Best Practices](#best-practices)

---

## Setup

### Test Infrastructure Files

```
api-server/__tests__/
├── helpers/
│   ├── db.ts         # Database setup/cleanup
│   ├── auth.ts       # Session cookie helpers
│   └── factories.ts  # Test data factories
└── fixtures/
    └── testData.ts   # Static test data
```

### Required Setup Before Tests

**1. Seed RBAC Permissions:**
```bash
cd api-server
npm run seed:rbac
```

**2. Run Migrations:**
```bash
npm run db:migrate
```

**3. (Optional) Seed Test Data:**
```bash
npm run db:seed
```

---

## Writing Tests

### Basic Test Structure

```typescript
import request from 'supertest';
import app from '../src/app';
import { cleanDatabase, createTestTenant, createTestUser } from './helpers/db';
import { createSessionCookie } from './helpers/auth';

describe('Product Routes', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  test('should create a product', async () => {
    // Setup: Create test data
    const tenant = await createTestTenant();
    const user = await createTestUser(tenant.id, 'OWNER');
    const sessionCookie = createSessionCookie(user.id, tenant.id);

    // Execute: Make request
    const response = await request(app)
      .post('/api/products')
      .set('Cookie', sessionCookie)
      .send({
        name: 'Test Product',
        sku: 'TEST-001',
        priceInPence: 1000,
      });

    // Assert: Check response
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.product).toMatchObject({
      name: 'Test Product',
      sku: 'TEST-001',
    });
  });
});
```

### Pattern: Authentication Tests

```typescript
import { createSessionCookie } from './helpers/auth';

test('should require authentication', async () => {
  // No cookie = 401
  const response = await request(app).get('/api/products');

  expect(response.status).toBe(401);
  expect(response.body.error.errorCode).toBe('AUTH_REQUIRED');
});

test('should authenticate with valid session', async () => {
  const tenant = await createTestTenant();
  const user = await createTestUser(tenant.id, 'OWNER');
  const sessionCookie = createSessionCookie(user.id, tenant.id);

  const response = await request(app)
    .get('/api/auth/me')
    .set('Cookie', sessionCookie);

  expect(response.status).toBe(200);
  expect(response.body.data.user.id).toBe(user.id);
});
```

### Pattern: Permission Tests

```typescript
import { createTestRoleWithPermissions } from './helpers/db';

test('should require products:write permission', async () => {
  const tenant = await createTestTenant();

  // Create user with viewer role (no products:write)
  const role = await createTestRoleWithPermissions(tenant.id, ['products:read']);
  const user = await createTestUser(tenant.id, role.id);
  const sessionCookie = createSessionCookie(user.id, tenant.id);

  const response = await request(app)
    .post('/api/products')
    .set('Cookie', sessionCookie)
    .send({ name: 'Product', sku: 'SKU', priceInPence: 100 });

  expect(response.status).toBe(403);
  expect(response.body.error.errorCode).toBe('PERMISSION_DENIED');
});
```

### Pattern: Multi-Tenant Isolation Tests

```typescript
test('should isolate products between tenants', async () => {
  // Create two tenants
  const tenant1 = await createTestTenant('Tenant 1');
  const tenant2 = await createTestTenant('Tenant 2');

  // Create user for each tenant
  const user1 = await createTestUser(tenant1.id, 'OWNER');
  const user2 = await createTestUser(tenant2.id, 'OWNER');

  // Create product in tenant 1
  const product1 = await createTestProduct(tenant1.id, { name: 'Product 1' });

  // User from tenant 2 should NOT see product from tenant 1
  const sessionCookie2 = createSessionCookie(user2.id, tenant2.id);
  const response = await request(app)
    .get(`/api/products/${product1.id}`)
    .set('Cookie', sessionCookie2);

  expect(response.status).toBe(404);
  expect(response.body.error.errorCode).toBe('RESOURCE_NOT_FOUND');
});
```

### Pattern: Service Layer Tests

```typescript
import { productService } from '../src/services/productService';
import prisma from '../src/lib/prisma';

describe('Product Service', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  test('should create product with audit log', async () => {
    const tenant = await createTestTenant();
    const user = await createTestUser(tenant.id, 'OWNER');

    const product = await productService.createProduct({
      tenantId: tenant.id,
      currentUserId: user.id,
      name: 'Product',
      sku: 'SKU-001',
      priceInPence: 1000,
    });

    // Check product was created
    expect(product).toMatchObject({
      name: 'Product',
      sku: 'SKU-001',
      entityVersion: 1,
    });

    // Check audit log was created
    const auditEvents = await prisma.auditEvent.findMany({
      where: { entityId: product.id },
    });
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0].action).toBe('CREATE');
  });
});
```

### Pattern: FIFO Stock Tests

```typescript
import { stockService } from '../src/services/stockService';

describe('Stock FIFO', () => {
  test('should consume from oldest lot first', async () => {
    const tenant = await createTestTenant();
    const branch = await createTestBranch(tenant.id);
    const product = await createTestProduct(tenant.id);
    const user = await createTestUser(tenant.id, 'OWNER');

    // Create two lots (older lot first)
    const lot1 = await stockService.receiveStock({
      tenantId: tenant.id,
      branchId: branch.id,
      productId: product.id,
      currentUserId: user.id,
      qty: 10,
      unitCostInPence: 100,
      receivedAt: new Date('2024-01-01'),
    });

    const lot2 = await stockService.receiveStock({
      tenantId: tenant.id,
      branchId: branch.id,
      productId: product.id,
      currentUserId: user.id,
      qty: 5,
      unitCostInPence: 150,
      receivedAt: new Date('2024-01-02'),
    });

    // Consume 12 units (should drain lot1 and take 2 from lot2)
    await stockService.consumeStock({
      tenantId: tenant.id,
      branchId: branch.id,
      productId: product.id,
      currentUserId: user.id,
      qty: 12,
    });

    // Check remaining quantities
    const remainingLots = await prisma.stockLot.findMany({
      where: { productId: product.id, qtyRemaining: { gt: 0 } },
      orderBy: { receivedAt: 'asc' },
    });

    expect(remainingLots).toHaveLength(1);
    expect(remainingLots[0].id).toBe(lot2.id);
    expect(remainingLots[0].qtyRemaining).toBe(3); // 5 - 2
  });
});
```

---

## Test Helpers

### Database Helpers (`helpers/db.ts`)

```typescript
import prisma from '../../src/lib/prisma';

// Clean database before each test
export async function cleanDatabase() {
  // Delete in correct order (children first, parents last)
  await prisma.stockLedger.deleteMany();
  await prisma.stockLot.deleteMany();
  await prisma.productStock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.userBranchMembership.deleteMany();
  await prisma.userTenantMembership.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
}

// Create test tenant
export async function createTestTenant(name = 'Test Tenant') {
  return await prisma.tenant.create({
    data: {
      tenantName: name,
      tenantSlug: name.toLowerCase().replace(/\s+/g, '-'),
    },
  });
}

// Create test user with role
export async function createTestUser(
  tenantId: string,
  roleIdOrName: string = 'OWNER'
) {
  const user = await prisma.user.create({
    data: {
      userEmailAddress: `test-${Date.now()}@example.com`,
      userPasswordHash: 'hashed-password',
      userDisplayName: 'Test User',
    },
  });

  // Get role
  const role = await prisma.role.findFirst({
    where: {
      OR: [
        { id: roleIdOrName },
        { roleName: roleIdOrName, tenantId },
      ],
    },
  });

  if (!role) throw new Error(`Role ${roleIdOrName} not found`);

  // Create membership
  await prisma.userTenantMembership.create({
    data: {
      userId: user.id,
      tenantId,
      roleId: role.id,
    },
  });

  return user;
}

// Create test role with specific permissions
export async function createTestRoleWithPermissions(
  tenantId: string,
  permissionKeys: string[]
) {
  const permissions = await prisma.permission.findMany({
    where: { key: { in: permissionKeys } },
  });

  const role = await prisma.role.create({
    data: {
      tenantId,
      roleName: `test-role-${Date.now()}`,
      rolePermissions: {
        create: permissions.map(p => ({ permissionId: p.id })),
      },
    },
  });

  return role;
}
```

### Authentication Helpers (`helpers/auth.ts`)

```typescript
import jwt from 'jsonwebtoken';

const SESSION_JWT_SECRET = process.env.SESSION_JWT_SECRET || 'test-secret';
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'mt_session';

export function createSessionCookie(userId: string, tenantId: string): string {
  const token = jwt.sign(
    { currentUserId: userId, currentTenantId: tenantId },
    SESSION_JWT_SECRET
  );
  return `${SESSION_COOKIE_NAME}=${token}`;
}
```

### Factory Helpers (`helpers/factories.ts`)

```typescript
import prisma from '../../src/lib/prisma';

export async function createTestProduct(
  tenantId: string,
  overrides: Partial<{ name: string; sku: string; priceInPence: number }> = {}
) {
  return await prisma.product.create({
    data: {
      tenantId,
      name: overrides.name || `Product ${Date.now()}`,
      sku: overrides.sku || `SKU-${Date.now()}`,
      priceInPence: overrides.priceInPence || 1000,
      entityVersion: 1,
    },
  });
}

export async function createTestBranch(tenantId: string, name = 'Test Branch') {
  return await prisma.branch.create({
    data: {
      tenantId,
      branchName: name,
      branchAddress: '123 Test St',
    },
  });
}
```

---

## Common Patterns

### Pattern 1: Test Data Cleanup

Always clean database before each test to ensure isolation:

```typescript
beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
});
```

### Pattern 2: Request Validation

Test request body validation with Zod schemas:

```typescript
test('should validate request body', async () => {
  const response = await request(app)
    .post('/api/products')
    .set('Cookie', sessionCookie)
    .send({
      name: '', // Invalid: empty name
      sku: 'SKU',
      // Missing priceInPence
    });

  expect(response.status).toBe(400);
  expect(response.body.error.errorCode).toBe('VALIDATION_ERROR');
});
```

### Pattern 3: Idempotency Testing

Test idempotency middleware with duplicate requests:

```typescript
test('should handle duplicate requests with same idempotency key', async () => {
  const idempotencyKey = 'unique-key-123';

  // First request
  const response1 = await request(app)
    .post('/api/products')
    .set('Cookie', sessionCookie)
    .set('Idempotency-Key', idempotencyKey)
    .send({ name: 'Product', sku: 'SKU', priceInPence: 1000 });

  expect(response1.status).toBe(201);

  // Second request with same key
  const response2 = await request(app)
    .post('/api/products')
    .set('Cookie', sessionCookie)
    .set('Idempotency-Key', idempotencyKey)
    .send({ name: 'Product', sku: 'SKU', priceInPence: 1000 });

  // Should return cached response
  expect(response2.status).toBe(201);
  expect(response2.body).toEqual(response1.body);

  // Only one product should exist
  const products = await prisma.product.findMany();
  expect(products).toHaveLength(1);
});
```

### Pattern 4: Rate Limiting

Test rate limiting with multiple requests:

```typescript
test('should rate limit excessive requests', async () => {
  // Make requests up to the limit
  for (let i = 0; i < 10; i++) {
    await request(app)
      .get('/api/products')
      .set('Cookie', sessionCookie);
  }

  // Next request should be rate limited
  const response = await request(app)
    .get('/api/products')
    .set('Cookie', sessionCookie);

  expect(response.status).toBe(429);
  expect(response.body.error.errorCode).toBe('RATE_LIMITED');
  expect(response.headers['x-ratelimit-remaining']).toBe('0');
});
```

---

## Best Practices

### ✅ DO

1. **Clean database before each test** - Ensures test isolation
2. **Use real database** - Don't mock Prisma or the database
3. **Test complete request flow** - Use Supertest to test HTTP layer
4. **Use test helpers** - DRY principle with factories and utilities
5. **Test error cases** - Validation errors, permission errors, not found, etc.
6. **Use descriptive test names** - "should create product with valid data"
7. **Test multi-tenant isolation** - Verify data segregation
8. **Check audit logs** - Verify mutations create audit events

### ❌ DON'T

1. **Don't mock the database** - Use real PostgreSQL with transactions
2. **Don't share state between tests** - Each test should be independent
3. **Don't hardcode IDs** - Use factories to create data dynamically
4. **Don't skip cleanup** - Always clean database in afterAll/beforeEach
5. **Don't test implementation details** - Test behavior, not internals
6. **Don't use magic numbers** - Use constants or variables with clear names

---

## Key Learnings

### Schema Field Names
- Use exact field names from Prisma schema
- Example: `userEmailAddress` not `email`

### Prisma Types
- Import with `import type { ... }` for type-only imports
- IDs are strings (cuid), not numbers

### Database Cleanup Order
- Delete children first, parents last
- Foreign key constraints require correct order

### Permission Testing
- Use `createTestRoleWithPermissions(permissionKeys)` not `createTestRole(permissionIds)`
- Permission keys from `api-server/src/rbac/catalog.ts`

### Stock Operations
- Require both `UserTenantMembership` AND `UserBranchMembership`
- FIFO consumption drains oldest lots first
- StockLedger uses `qtyDelta`, not before/after fields

---

## Running Tests

```bash
# Run all tests
npm run test:accept

# Run specific test file
npm run test:accept auth.test.ts

# Run in watch mode (TDD)
npm run test:accept:watch

# Run with coverage
npm run test:accept:coverage

# Run tests matching pattern
npm run test:accept -- -t "should create product"
```

---

**Next Steps:**
- Review existing tests in `__tests__/` directory
- Follow patterns documented here
- See [Troubleshooting Guide](./troubleshooting_tests.md) if you encounter issues
