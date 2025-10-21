# AUTHENTICAION (1 SUITE - 1 Failing)
- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/auth.test.ts (3 FAILURES)


# HEALTH (1 SUITE - 0 Failing)
- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/health.test.ts (0 FAILURES)


# MIDDLEWARE (5 suites - 1 Failing)

## Failing suites
- session.test.ts

## All tests and commands
- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/middleware/errorHandler.test.ts (0 FAILURES)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/middleware/permissions.test.ts (0 FAILURES)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/middleware/idempotency.test.ts (0 FAILURES)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/middleware/session.test.ts (1 FAILURE)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/middleware/rateLimit.test.ts (0 FAILURES)


# Services (19 suites - 4 Failing)

## Failing suites:
- chat.test.ts
- stockTransfers.test.ts
- transferAnalytics.test.ts
- userTools.test.ts

## All tests and commands 
- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/services/approvalRuleArchival.test.ts (0 Failures)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/services/chat.test.ts (2 Failures)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/services/partialShipment.test.ts (0 Failures)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/services/product.test.ts (0 FAILURES)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/services/stock.test.ts (0 FAILURES)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/services/stockLotRestoration.test.ts (0 FAILURES)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/services/stockTransfers.test.ts (1 FAILURE)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/services/stockTransferTemplates.test.ts (0 FAILURES)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/services/tenantFeatureFlags.test.ts (0 FAILURES)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/services/transferAnalytics.test.ts (1 FAILURES)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/services/transferPriority.test.ts (0 FAILURES)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/services/chat/analyticsService.test.ts (0 FAILURES)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/services/chat/analyticsTools.test.ts (0 FAILURES)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/services/chat/branchTools.test.ts (0 FAILURES)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/services/chat/conversationService.test.ts (0 FAILURES)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/services/chat/productTools.test.ts (0 FAILURES)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/services/chat/stockTools.test.ts (0 FAILURES)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/services/chat/suggestionService.test.ts (0 FAILURES)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/services/chat/templateTools.test.ts (0 FAILURES)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/services/chat/userTools.test.ts (1 FAILURES)

# Routes (11 suites - 2 Failing)

## Failing suites: 
- chatRoutes.test.ts
- productRoutes.test.ts

## All tests and commands
- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/routes/barcodeRoutes.test.ts (0 FAILURES)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/routes/branchArchival.test.ts (0 FAILURES)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/routes/chatRouter.test.ts (0 FAILURES)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/routes/chatRoutes.test.ts (1 FAILURES)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/routes/product-archival-activity.test.ts (0 FAILURES)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/routes/productRoutes.test.ts (1 FAILURE)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/routes/roleArchival.test.ts (0 FAILURES)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/routes/stockRoutes.test.ts (0 FAILURES)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/routes/tenant-users-archival.test.ts (0 FAILURES)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/routes/tenantFeatureFlagsRoutes.test.ts (0 FAILURES)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/routes/tenantUserRoutes.test.ts (0 FAILURES)

# Integration (1 suite - 1 Failing)
- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/integration/chatIntegration.test.ts (8 FAILURES)