# Test Suite Setup

## Current Configuration

**Tests run against your DEVELOPMENT database by default.**

This is intentional and safe because:
1. All test factories use `Date.now()` timestamps for unique data
2. Tests create their own entities with unique values
3. Your seed data is never modified or deleted
4. `cleanDatabase()` is **DISABLED by default** to protect dev data

## How It Works

### Unique Test Data
Every test creates entities with timestamps:
```typescript
const tenant = await createTestTenant();
// Creates: { name: "Test Tenant 1728845123456", slug: "test-tenant-1728845123456" }

const user = await createTestUser();
// Creates: { email: "test-1728845123456@example.com" }
```

This ensures:
- ✅ No conflicts with your seed data
- ✅ No conflicts between test runs
- ✅ Tests can run multiple times without issues
- ✅ You can login to dev after running tests

### Database Cleanup (Disabled)

The `cleanDatabase()` function is **disabled by default**. It does nothing unless you explicitly enable it:

```bash
# To enable cleanup (only if you have a separate test database)
ENABLE_TEST_DB_CLEANUP=true npm run test:accept
```

**WARNING**: Only enable cleanup if you're using a separate test database!

## Test Types

### 1. Per-Test Setup (Most Tests)
Tests that use `beforeEach` create fresh data for each test:
```typescript
beforeEach(async () => {
  // No cleanDatabase() needed - timestamps ensure uniqueness
  testTenant = await createTestTenant();
  testUser = await createTestUser();
});
```

### 2. Shared Setup (Some Tests)
Tests like `auth.test.ts` and `permissions.test.ts` use `beforeAll` and share data across tests. These tests:
- Call `cleanDatabase()` in `beforeAll` (but it's disabled)
- May accumulate data from previous runs
- Still work correctly due to unique timestamps

## Database Growth

Over time, test data will accumulate in your dev database. This is normal and expected. To clean up:

### Option 1: Manual Cleanup (Recommended)
Periodically run your seed script to reset dev data:
```bash
npm run db:seed
```

### Option 2: Enable Auto-Cleanup (Use Separate DB)
If you set up a separate test database:
1. Create a test database: `my_app_test`
2. Set `DATABASE_URL_TEST` environment variable
3. Configure jest to use test database
4. Enable cleanup: `ENABLE_TEST_DB_CLEANUP=true`

## Running Tests

```bash
# Run all tests (safe - won't delete dev data)
npm run test:accept

# Run specific test file
npm run test:accept -- product.test.ts

# Run with cleanup enabled (separate test DB required!)
ENABLE_TEST_DB_CLEANUP=true npm run test:accept
```

## Troubleshooting

### "Too many products/users in database"
This is normal after many test runs. Either:
1. Ignore it (tests still work)
2. Re-seed your dev database: `npm run db:seed`
3. Manually clean up old test data with timestamps in names

### "Tests are failing"
Check if tests assume a clean database state (counting rows, etc). Most tests should work regardless of existing data.

### "I accidentally enabled cleanup on dev database!"
Don't panic:
1. Stop the tests immediately
2. Re-run your seed script: `npm run db:seed`
3. Your data will be restored

## Future: Separate Test Database

To set up a proper isolated test environment:

1. Create test database:
```sql
CREATE DATABASE my_app_test;
```

2. Add to `.env.test`:
```
DATABASE_URL="postgresql://user:pass@localhost:5432/my_app_test"
ENABLE_TEST_DB_CLEANUP=true
```

3. Configure Jest to use test environment

4. Tests will now run against separate database and cleanup safely

## Best Practices

✅ **DO**:
- Run tests frequently - they're safe
- Use factory defaults (let timestamps work)
- Trust that unique data prevents conflicts

❌ **DON'T**:
- Enable `ENABLE_TEST_DB_CLEANUP=true` on dev database
- Hardcode test data values (defeats timestamp uniqueness)
- Assume clean database state in new tests

## Questions?

See `.agent/SOP/test_isolation_pattern.md` for detailed examples of the unique timestamp pattern.
