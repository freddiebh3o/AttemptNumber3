# Test Suite Commands (Updated Structure - October 2025)

## CORE (2 suites)

### Failing suites
- auth.test.ts (previously had 3 failures)

### All tests and commands
- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/core/auth.test.ts (ALL PASSING)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/core/health.test.ts


## FEATURES: AUTH (1 suite - NEW)

### All tests and commands
- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/auth/authService.test.ts


## MIDDLEWARE (8 suites)

### Failing suites
- session.test.ts (previously had 1 failure)

### All tests and commands
- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/middleware/errorHandler.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/middleware/permissions.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/middleware/idempotency.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/middleware/session.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/middleware/rateLimit.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/middleware/requestId.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/middleware/zodValidation.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/middleware/httpLogging.test.ts


## PERMISSIONS (12 suites - NEW: RBAC Permission Matrix Tests)

### All tests and commands
- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/permissions/products.permissions.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/permissions/stock.permissions.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/permissions/branches.permissions.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/permissions/tenantUsers.permissions.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/permissions/roles.permissions.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/permissions/theme.permissions.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/permissions/auditLogs.permissions.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/permissions/stockTransfers.permissions.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/permissions/transferTemplates.permissions.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/permissions/transferApprovals.permissions.test.ts (FIXED - ready to verify)

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/permissions/transferAnalytics.permissions.test.ts (FIXED - endpoints updated)


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


## FEATURES: BRANCHES (3 suites)

### All tests and commands
- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/branches/branchService.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/branches/branchRoutes.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/branches/branchArchival.test.ts


## FEATURES: TENANT USERS (3 suites)

### All tests and commands
- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/tenantUsers/tenantUserService.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/tenantUsers/tenantUserRoutes.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/tenantUsers/tenantUserArchival.test.ts


## FEATURES: ROLES (3 suites)

### All tests and commands
- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/roles/roleService.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/roles/roleRoutes.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/roles/roleArchival.test.ts


## FEATURES: THEME (2 suites - NEW: PRD-5 Phase 1)

### All tests and commands
- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/theme/themeService.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/theme/themeRoutes.test.ts


## FEATURES: UPLOADS (2 suites - NEW: PRD-5 Phase 2)

### All tests and commands
- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/uploads/uploadService.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/uploads/uploadRoutes.test.ts


## FEATURES: AUDIT LOGS (2 suites - NEW: PRD-5 Phase 3)

### All tests and commands
- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/auditLogs/auditLogService.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/auditLogs/auditLogRoutes.test.ts


## FEATURES: STOCK TRANSFERS (13 suites - EXPANDED: PRD-5 Phase 4-6 + Delivery Fields + Reversal Linking + Dual-Direction)

### Failing suites
- transferService.test.ts (previously had 1 failure)

### All tests and commands
- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/stockTransfers/transferService.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/stockTransfers/transferRoutes.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/stockTransfers/partialShipment.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/stockTransfers/transferPriority.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/stockTransfers/transferDeliveryFields.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/stockTransfers/transferReversal.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/stockTransfers/transferDualDirection.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/stockTransfers/templates/templateService.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/stockTransfers/templates/templateRoutes.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/stockTransfers/approvals/approvalRuleArchival.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/stockTransfers/approvals/approvalRulesService.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/stockTransfers/approvals/approvalEvaluation.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/stockTransfers/approvals/approvalRulesRoutes.test.ts


## FEATURES: TRANSFER ANALYTICS (2 suites - EXPANDED: PRD-5 Phase 7)

### Failing suites
- analyticsService.test.ts (previously had 1 failure)

### All tests and commands
- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/transferAnalytics/analyticsService.test.ts

- node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/features/transferAnalytics/analyticsRoutes.test.ts


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

**Total Suites:** 72 (was 71 - added 1 for dual-direction initiation)

**PRD-5 New Test Files (12 total):**
1. features/theme/themeService.test.ts (Phase 1)
2. features/theme/themeRoutes.test.ts (Phase 1)
3. features/uploads/uploadService.test.ts (Phase 2)
4. features/uploads/uploadRoutes.test.ts (Phase 2)
5. features/auditLogs/auditLogService.test.ts (Phase 3)
6. features/auditLogs/auditLogRoutes.test.ts (Phase 3)
7. features/stockTransfers/transferRoutes.test.ts (Phase 4)
8. features/stockTransfers/templates/templateRoutes.test.ts (Phase 5)
9. features/stockTransfers/approvals/approvalRulesService.test.ts (Phase 6)
10. features/stockTransfers/approvals/approvalEvaluation.test.ts (Phase 6)
11. features/stockTransfers/approvals/approvalRulesRoutes.test.ts (Phase 6)
12. features/transferAnalytics/analyticsRoutes.test.ts (Phase 7)

**Note:** Some tests have TypeScript type errors that need fixing (primarily enum name mismatches in approval tests)

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

# All permission tests
node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js __tests__/permissions/
```
