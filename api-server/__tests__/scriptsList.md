# Test Suite Commands (Updated Structure - October 2025)

## CORE (2 suites)

### Failing suites
- auth.test.ts (previously had 3 failures)

### All tests and commands
- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/core/auth.test.ts (ALL PASSING)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/core/health.test.ts


## MIDDLEWARE (5 suites)

### Failing suites
- session.test.ts (previously had 1 failure)

### All tests and commands
- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/middleware/errorHandler.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/middleware/permissions.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/middleware/idempotency.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/middleware/session.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/middleware/rateLimit.test.ts


## PERMISSIONS (3 suites - NEW: RBAC Permission Matrix Tests)

### All tests and commands
- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/permissions/products.permissions.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/permissions/stock.permissions.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/permissions/branches.permissions.test.ts


## FEATURES: PRODUCTS (4 suites)

### Failing suites
- productRoutes.test.ts (previously had 1 failure)

### All tests and commands
- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/products/productService.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/products/productRoutes.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/products/productArchival.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/products/barcodes.test.ts


## FEATURES: STOCK (3 suites)

### All tests and commands
- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/stock/stockService.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/stock/stockRoutes.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/stock/stockLotRestoration.test.ts


## FEATURES: BRANCHES (1 suite)

### All tests and commands
- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/branches/branchArchival.test.ts


## FEATURES: TENANT USERS (2 suites)

### All tests and commands
- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/tenantUsers/tenantUserRoutes.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/tenantUsers/tenantUserArchival.test.ts


## FEATURES: ROLES (1 suite)

### All tests and commands
- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/roles/roleArchival.test.ts


## FEATURES: STOCK TRANSFERS (5 suites)

### Failing suites
- transferService.test.ts (previously had 1 failure)

### All tests and commands
- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/stockTransfers/transferService.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/stockTransfers/partialShipment.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/stockTransfers/transferPriority.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/stockTransfers/templates/templateService.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/stockTransfers/approvals/approvalRuleArchival.test.ts


## FEATURES: TRANSFER ANALYTICS (1 suite)

### Failing suites
- analyticsService.test.ts (previously had 1 failure)

### All tests and commands
- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/transferAnalytics/analyticsService.test.ts


## FEATURES: FEATURE FLAGS (2 suites)

### All tests and commands
- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/featureFlags/featureFlagsService.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/featureFlags/featureFlagsRoutes.test.ts


## FEATURES: CHAT (13 suites)

### Failing suites
- chatService.test.ts (previously had 2 failures)
- chatRoutes.test.ts (previously had 1 failure)
- chatIntegration.test.ts (previously had 8 failures)
- tools/userTools.test.ts (previously had 1 failure)

### All tests and commands
- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/chat/chatService.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/chat/chatRouter.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/chat/chatIntegration.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/chat/conversationService.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/chat/suggestionService.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/chat/analyticsService.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/chat/tools/productTools.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/chat/tools/stockTools.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/chat/tools/branchTools.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/chat/tools/userTools.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/chat/tools/templateTools.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/chat/tools/analyticsTools.test.ts


## SUMMARY

**Total Suites:** 39 (was 37 - now includes chatRouter and chatRoutes separately)

**Previously Failing Suites (9 total):**
1. core/auth.test.ts (3 failures)
2. middleware/session.test.ts (1 failure)
3. features/chat/chatService.test.ts (2 failures)
4. features/stockTransfers/transferService.test.ts (1 failure)
5. features/transferAnalytics/analyticsService.test.ts (1 failure)
6. features/chat/tools/userTools.test.ts (1 failure)
7. features/chat/chatRoutes.test.ts (1 failure)
8. features/products/productRoutes.test.ts (1 failure)
9. features/chat/chatIntegration.test.ts (8 failures)

**Run all tests:**
```bash
cd api-server
npm run test:accept
```

**Run specific feature group:**
```bash
# All products tests
node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/products/

# All chat tests
node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/chat/

# All stock tests
node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/stock/

# All core tests
node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/core/

# All middleware tests
node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/middleware/
```
