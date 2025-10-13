# Test Isolation Pattern

## Problem

Tests that use hardcoded values (emails, slugs, SKUs) can pollute the seed data used for manual testing. This causes tests to interfere with each other and prevents developers from logging in after running tests.

## Solution

Use factory-generated unique values with timestamps instead of hardcoded values. This ensures each test creates its own isolated data that doesn't conflict with seed data or other tests.

## Pattern Comparison

### ❌ BEFORE (Bad - Hardcoded Values)

```typescript
describe('Stock Transfer Tests', () => {
  let testTenant: Tenant;
  let userDestination: User;
  let product1: Product;
  let sourceBranch: Branch;
  let destinationBranch: Branch;

  beforeEach(async () => {
    await cleanDatabase();

    // BAD: Hardcoded values that might conflict with seed data
    testTenant = await createTestTenant({ slug: 'transfer-test-tenant' });

    userDestination = await createTestUser({
      email: 'dest@test.com'
    });

    product1 = await createTestProduct({
      name: 'Widget A',
      sku: 'WID-A-001',
      tenantId: testTenant.id,
    });

    sourceBranch = await createTestBranch({
      name: 'Source Branch',
      slug: 'source-branch',
      tenantId: testTenant.id,
    });

    destinationBranch = await createTestBranch({
      name: 'Destination Branch',
      slug: 'destination-branch',
      tenantId: testTenant.id,
    });
  });

  it('should create transfer', async () => {
    // Test implementation...
  });
});
```

**Problems with this approach:**
1. ❌ `slug: 'transfer-test-tenant'` might conflict with seed data tenant
2. ❌ `email: 'dest@test.com'` might conflict with seed data user
3. ❌ `sku: 'WID-A-001'` might conflict with seed data product
4. ❌ Branch slugs `source-branch`, `destination-branch` might conflict with seed data
5. ❌ After running tests, seed data is polluted and manual login fails
6. ❌ Tests can interfere with each other if run in parallel

### ✅ AFTER (Good - Factory Defaults with Timestamps)

```typescript
describe('Stock Transfer Tests', () => {
  let testTenant: Tenant;
  let userDestination: User;
  let product1: Product;
  let sourceBranch: Branch;
  let destinationBranch: Branch;

  beforeEach(async () => {
    await cleanDatabase();

    // GOOD: Use factory defaults - they include Date.now() for uniqueness
    testTenant = await createTestTenant();
    // Creates: { name: "Test Tenant 1728845123456", slug: "test-tenant-1728845123456" }

    userDestination = await createTestUser();
    // Creates: { email: "test-1728845123456@example.com" }

    product1 = await createTestProduct({
      tenantId: testTenant.id,
      // Factory will generate: name: "Test Product 1728845123456", sku: "TEST-SKU-1728845123456"
    });

    sourceBranch = await createTestBranch({
      tenantId: testTenant.id,
      // Factory will generate: name: "Test Branch 1728845123457", slug: "test-branch-1728845123457"
    });

    destinationBranch = await createTestBranch({
      tenantId: testTenant.id,
      // Factory will generate: name: "Test Branch 1728845123458", slug: "test-branch-1728845123458"
    });
  });

  afterEach(async () => {
    // Clean up test data (optional but recommended)
    await cleanDatabase();
  });

  it('should create transfer', async () => {
    // Test implementation...
  });
});
```

**Benefits of this approach:**
1. ✅ Each test run creates unique data with timestamps
2. ✅ No conflicts with seed data
3. ✅ Tests can run in parallel without interference
4. ✅ Seed data remains clean for manual testing
5. ✅ Developer can login after running tests
6. ✅ Tests are truly isolated and repeatable

## Factory Reference

Our factory functions already generate unique values by default:

```typescript
// api-server/__tests__/helpers/factories.ts

export async function createTestUser(options: CreateUserOptions = {}): Promise<User> {
  const email = options.email || `test-${Date.now()}@example.com`; // ✅ Unique by default
  const password = options.password || 'password123';
  // ...
}

export async function createTestTenant(options: CreateTenantOptions = {}): Promise<Tenant> {
  const timestamp = Date.now();
  const name = options.name || `Test Tenant ${timestamp}`; // ✅ Unique by default
  const slug = options.slug || `test-tenant-${timestamp}`; // ✅ Unique by default
  // ...
}

export async function createTestProduct(options: CreateProductOptions): Promise<Product> {
  const timestamp = Date.now();
  const name = options.name || `Test Product ${timestamp}`; // ✅ Unique by default
  const sku = options.sku || `TEST-SKU-${timestamp}`; // ✅ Unique by default
  // ...
}

export async function createTestBranch(options: CreateBranchOptions): Promise<Branch> {
  const timestamp = Date.now();
  const name = options.name || `Test Branch ${timestamp}`; // ✅ Unique by default
  const slug = options.slug || `test-branch-${timestamp}`; // ✅ Unique by default
  // ...
}
```

## When to Override Factory Defaults

Only override factory defaults when you need to test specific behavior related to that value:

```typescript
// ✅ Good: Testing duplicate email validation
it('should reject duplicate email', async () => {
  const email = `duplicate-test-${Date.now()}@example.com`;
  await createTestUser({ email });

  // This test specifically needs the same email
  await expect(createTestUser({ email })).rejects.toThrow();
});

// ✅ Good: Testing SKU uniqueness within tenant
it('should reject duplicate SKU within tenant', async () => {
  const tenant = await createTestTenant();
  const sku = `DUP-SKU-${Date.now()}`;

  await createTestProduct({ tenantId: tenant.id, sku });

  // This test specifically needs the same SKU
  await expect(
    createTestProduct({ tenantId: tenant.id, sku })
  ).rejects.toThrow();
});

// ❌ Bad: Overriding just because
it('should create product', async () => {
  const tenant = await createTestTenant();

  // No need to override these - factory defaults work fine
  const product = await createTestProduct({
    tenantId: tenant.id,
    name: 'My Widget', // ❌ Unnecessary override
    sku: 'WID-001', // ❌ Unnecessary override
  });

  expect(product).toBeDefined();
});
```

## Checklist for Test Isolation

When writing or refactoring tests:

- [ ] Use `cleanDatabase()` in `beforeEach` to start with clean slate
- [ ] Use factory defaults (don't override `email`, `slug`, `sku`, `name` unless necessary)
- [ ] Only override factory defaults when testing specific behavior
- [ ] Use `Date.now()` in overrides if you must provide a specific value
- [ ] Consider adding `cleanDatabase()` in `afterEach` for extra safety
- [ ] Verify tests don't pollute seed data (can login manually after running tests)
- [ ] Ensure tests pass when run individually AND in parallel

## Migration Guide

To refactor existing tests:

1. **Find hardcoded values**: Search for `email:`, `slug:`, `sku:`, `name:` in test files
2. **Check if override is necessary**: Is the test validating behavior specific to that value?
3. **Remove unnecessary overrides**: Let factory generate unique values
4. **Add timestamps to necessary overrides**: Use `Date.now()` for uniqueness
5. **Run tests**: Verify they pass
6. **Verify seed data**: Login manually after running tests

Example refactoring session:

```bash
# 1. Run tests
npm run test:accept

# 2. Try to login manually
# If login fails, tests are polluting seed data

# 3. Refactor tests to use factory defaults

# 4. Run tests again
npm run test:accept

# 5. Verify login works
# Success! Tests are properly isolated
```
