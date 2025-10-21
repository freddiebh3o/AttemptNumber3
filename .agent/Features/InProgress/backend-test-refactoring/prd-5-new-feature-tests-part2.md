# PRD 5: New Feature Tests - Part 2 (Advanced Features)

**Status:** 📋 Planning
**Priority:** High
**Estimated Effort:** 4-5 days
**Created:** 2025-10-21
**Last Updated:** 2025-10-21

---

## Overview

Add missing service and route tests for advanced features (Theme, Uploads, Audit Logs, Stock Transfers routes, Transfer Templates routes, Transfer Approvals, Transfer Analytics routes). These features complete the test coverage across all system functionality.

**Key Capabilities:**
- Theme customization and branding testing
- File upload and management testing
- Audit log querying and filtering testing
- Stock transfer HTTP layer testing
- Transfer template application testing
- Approval rule and evaluation testing
- Transfer analytics reporting testing

**Related Documentation:**
- [System Architecture](../../../System/architecture.md) - Feature overview
- [Database Schema](../../../System/database-schema.md) - Data model
- [Stock Management](../../../System/stock-management.md) - Transfer logic
- [Backend Testing Guide](../../../SOP/backend-testing.md) - Testing patterns
- [Test Template](../../../../api-server/__tests__/TEST_TEMPLATE.md) - Test patterns
- [Master PRD](./prd.md) - Overall refactoring plan

---

## Phase 1: Theme Feature

**Goal:** Create service and route tests for tenant theme/branding management

**Relevant Files:**
- [api-server/src/services/theme/tenantThemeService.ts](../../../../api-server/src/services/theme/tenantThemeService.ts) - Implementation
- [api-server/src/routes/tenantThemeRouter.ts](../../../../api-server/src/routes/tenantThemeRouter.ts) - Implementation
- [api-server/__tests__/features/theme/themeService.test.ts](../../../../api-server/__tests__/features/theme/themeService.test.ts) - NEW
- [api-server/__tests__/features/theme/themeRoutes.test.ts](../../../../api-server/__tests__/features/theme/themeRoutes.test.ts) - NEW

### Backend Implementation

- [ ] Create themeService.test.ts
  - [ ] Get theme for tenant (with defaults)
  - [ ] Update theme colors
  - [ ] Update theme preset
  - [ ] Update theme logo URL
  - [ ] Reset theme to defaults
  - [ ] Theme persisted in TenantBranding table
  - [ ] Multi-tenant isolation
  - [ ] Audit log creation
  - [ ] Validate color hex codes
  - [ ] Validate preset enum values

- [ ] Create themeRoutes.test.ts
  - [ ] GET /api/theme - with theme:manage permission
  - [ ] PUT /api/theme - with theme:manage permission
  - [ ] POST /api/theme/reset - with theme:manage permission
  - [ ] Request validation (Zod schemas)
  - [ ] Response envelope format
  - [ ] 401 without authentication
  - [ ] 403 without permission (minimal test)

- [ ] Confirm all tests pass before moving to Phase 2

---

## Phase 2: Uploads Feature

**Goal:** Create service and route tests for file upload management

**Relevant Files:**
- [api-server/src/services/uploadService.ts](../../../../api-server/src/services/uploadService.ts) - Implementation
- [api-server/src/routes/uploadRouter.ts](../../../../api-server/src/routes/uploadRouter.ts) - Implementation
- [api-server/__tests__/features/uploads/uploadService.test.ts](../../../../api-server/__tests__/features/uploads/uploadService.test.ts) - NEW
- [api-server/__tests__/features/uploads/uploadRoutes.test.ts](../../../../api-server/__tests__/features/uploads/uploadRoutes.test.ts) - NEW

### Backend Implementation

- [ ] Create uploadService.test.ts
  - [ ] Process file upload (mock Supabase)
  - [ ] Generate public URL for uploaded file
  - [ ] Get upload metadata by ID
  - [ ] Delete upload (soft delete)
  - [ ] Validate file type (images only)
  - [ ] Validate file size limits
  - [ ] Multi-tenant isolation
  - [ ] Audit log creation

- [ ] Create uploadRoutes.test.ts
  - [ ] POST /api/uploads - with uploads:write permission
  - [ ] GET /api/uploads/:id - with uploads:write permission
  - [ ] DELETE /api/uploads/:id - with uploads:write permission
  - [ ] Multipart form data handling
  - [ ] Request validation (file type, size)
  - [ ] Response envelope format
  - [ ] 401 without authentication
  - [ ] 403 without permission (minimal test)

- [ ] Confirm all tests pass before moving to Phase 3

---

## Phase 3: Audit Logs Feature

**Goal:** Create service and route tests for audit log querying

**Relevant Files:**
- [api-server/src/services/auditLoggerService.ts](../../../../api-server/src/services/auditLoggerService.ts) - Implementation
- [api-server/src/routes/auditLoggerRouter.ts](../../../../api-server/src/routes/auditLoggerRouter.ts) - Implementation
- [api-server/__tests__/features/auditLogs/auditLogService.test.ts](../../../../api-server/__tests__/features/auditLogs/auditLogService.test.ts) - NEW
- [api-server/__tests__/features/auditLogs/auditLogRoutes.test.ts](../../../../api-server/__tests__/features/auditLogs/auditLogRoutes.test.ts) - NEW

### Backend Implementation

- [ ] Create auditLogService.test.ts
  - [ ] Query audit logs for tenant
  - [ ] Filter by entityType (PRODUCT, BRANCH, etc.)
  - [ ] Filter by action (CREATE, UPDATE, DELETE)
  - [ ] Filter by actorUserId
  - [ ] Filter by date range
  - [ ] Pagination support
  - [ ] Multi-tenant isolation (cannot see other tenant logs)
  - [ ] Get audit log by ID
  - [ ] Audit log immutability (cannot update/delete)

- [ ] Create auditLogRoutes.test.ts
  - [ ] GET /api/audit-logs (list) - with tenant:manage permission
  - [ ] GET /api/audit-logs/:id - with tenant:manage permission
  - [ ] Query parameter filtering (entityType, action, userId, dateRange)
  - [ ] Request validation (Zod schemas)
  - [ ] Response envelope format
  - [ ] 401 without authentication
  - [ ] 403 without permission (minimal test)

- [ ] Confirm all tests pass before moving to Phase 4

---

## Phase 4: Stock Transfers Routes

**Goal:** Create route tests for stock transfer endpoints (service tests exist)

**Relevant Files:**
- [api-server/src/routes/stockTransfersRouter.ts](../../../../api-server/src/routes/stockTransfersRouter.ts) - Implementation
- [api-server/__tests__/features/stockTransfers/transferRoutes.test.ts](../../../../api-server/__tests__/features/stockTransfers/transferRoutes.test.ts) - NEW

### Backend Implementation

- [ ] Create transferRoutes.test.ts
  - [ ] GET /api/stock-transfers (list) - with stock:read permission
  - [ ] GET /api/stock-transfers/:id - with stock:read permission
  - [ ] POST /api/stock-transfers (create) - with stock:write permission
  - [ ] PUT /api/stock-transfers/:id (update) - with stock:write permission
  - [ ] POST /api/stock-transfers/:id/receive - with stock:write permission
  - [ ] POST /api/stock-transfers/:id/reverse - with stock:write permission
  - [ ] POST /api/stock-transfers/:id/approve - with stock:write permission
  - [ ] Request validation (Zod schemas)
  - [ ] Response envelope format
  - [ ] 401 without authentication
  - [ ] 403 without permission (minimal test)

- [ ] Confirm all tests pass before moving to Phase 5

---

## Phase 5: Transfer Templates Routes

**Goal:** Create route tests for transfer template endpoints (service tests exist)

**Relevant Files:**
- [api-server/src/routes/stockTransferTemplatesRouter.ts](../../../../api-server/src/routes/stockTransferTemplatesRouter.ts) - Implementation
- [api-server/__tests__/features/stockTransfers/templates/templateRoutes.test.ts](../../../../api-server/__tests__/features/stockTransfers/templates/templateRoutes.test.ts) - NEW

### Backend Implementation

- [ ] Create templateRoutes.test.ts
  - [ ] GET /api/transfer-templates (list) - with stock:read permission
  - [ ] GET /api/transfer-templates/:id - with stock:read permission
  - [ ] POST /api/transfer-templates - with stock:write permission
  - [ ] PUT /api/transfer-templates/:id - with stock:write permission
  - [ ] DELETE /api/transfer-templates/:id - with stock:write permission
  - [ ] POST /api/transfer-templates/:id/apply - with stock:write permission
  - [ ] Request validation (Zod schemas)
  - [ ] Response envelope format
  - [ ] 401 without authentication
  - [ ] 403 without permission (minimal test)

- [ ] Confirm all tests pass before moving to Phase 6

---

## Phase 6: Transfer Approvals Feature

**Goal:** Create service and route tests for approval rules and evaluation

**Relevant Files:**
- [api-server/src/services/stockTransfers/approvalRulesService.ts](../../../../api-server/src/services/stockTransfers/approvalRulesService.ts) - Implementation
- [api-server/src/services/stockTransfers/approvalEvaluationService.ts](../../../../api-server/src/services/stockTransfers/approvalEvaluationService.ts) - Implementation
- [api-server/src/routes/transferApprovalRulesRouter.ts](../../../../api-server/src/routes/transferApprovalRulesRouter.ts) - Implementation
- [api-server/__tests__/features/stockTransfers/approvals/approvalRulesService.test.ts](../../../../api-server/__tests__/features/stockTransfers/approvals/approvalRulesService.test.ts) - NEW
- [api-server/__tests__/features/stockTransfers/approvals/approvalEvaluation.test.ts](../../../../api-server/__tests__/features/stockTransfers/approvals/approvalEvaluation.test.ts) - NEW
- [api-server/__tests__/features/stockTransfers/approvals/approvalRulesRoutes.test.ts](../../../../api-server/__tests__/features/stockTransfers/approvals/approvalRulesRoutes.test.ts) - NEW

### Backend Implementation

- [ ] Create approvalRulesService.test.ts
  - [ ] Create approval rule with conditions
  - [ ] Create approval rule with levels
  - [ ] List approval rules for tenant
  - [ ] Get approval rule by ID (with conditions and levels)
  - [ ] Update approval rule
  - [ ] Archive approval rule
  - [ ] Restore approval rule
  - [ ] Multi-tenant isolation
  - [ ] Audit log creation

- [ ] Create approvalEvaluation.test.ts
  - [ ] Evaluate transfer against rules (no approval needed)
  - [ ] Evaluate transfer requiring approval (quantity threshold)
  - [ ] Evaluate transfer requiring approval (value threshold)
  - [ ] Evaluate transfer requiring approval (branch-specific)
  - [ ] Sequential approval mode (levels)
  - [ ] Concurrent approval mode (any level)
  - [ ] Multiple rules matching (priority ordering)
  - [ ] No rules match (auto-approve)
  - [ ] Record approval decisions

- [ ] Create approvalRulesRoutes.test.ts
  - [ ] GET /api/approval-rules (list) - with stock:read permission
  - [ ] GET /api/approval-rules/:id - with stock:read permission
  - [ ] POST /api/approval-rules - with stock:write + tenant:manage permissions
  - [ ] PUT /api/approval-rules/:id - with stock:write + tenant:manage permissions
  - [ ] DELETE /api/approval-rules/:id - with stock:write + tenant:manage permissions
  - [ ] POST /api/approval-rules/:id/restore - with stock:write + tenant:manage permissions
  - [ ] Request validation (Zod schemas)
  - [ ] Response envelope format
  - [ ] 401 without authentication
  - [ ] 403 without permission (minimal test)

- [ ] Confirm all tests pass before moving to Phase 7

---

## Phase 7: Transfer Analytics Routes

**Goal:** Create route tests for transfer analytics endpoints (service tests exist)

**Relevant Files:**
- [api-server/src/routes/transferAnalyticsRouter.ts](../../../../api-server/src/routes/transferAnalyticsRouter.ts) - Implementation
- [api-server/__tests__/features/transferAnalytics/analyticsRoutes.test.ts](../../../../api-server/__tests__/features/transferAnalytics/analyticsRoutes.test.ts) - NEW

### Backend Implementation

- [ ] Create analyticsRoutes.test.ts
  - [ ] GET /api/transfer-analytics/summary - with reports:view permission
  - [ ] GET /api/transfer-analytics/by-branch - with reports:view permission
  - [ ] GET /api/transfer-analytics/by-product - with reports:view permission
  - [ ] GET /api/transfer-analytics/trends - with reports:view permission
  - [ ] Query parameter filtering (dateRange, branchId, etc.)
  - [ ] Request validation (Zod schemas)
  - [ ] Response envelope format
  - [ ] 401 without authentication
  - [ ] 403 without permission (minimal test)

- [ ] Confirm all tests pass

---

## Testing Strategy

### Service Tests

**Pattern:**
- Direct service function calls (no HTTP)
- Focus on business logic and domain rules
- Test complex workflows (approval evaluation)
- Verify data transformations
- Test edge cases and error handling

### Route Tests

**Pattern:**
- Express router with middleware
- Supertest for HTTP requests
- Validate request/response formats
- Test authentication and basic authorization
- Minimal permission testing (full coverage in permissions/)

### Integration Points

**Special considerations:**
- Uploads: Mock Supabase client for file operations
- Approvals: Complex rule evaluation logic requires thorough testing
- Analytics: Date range queries and aggregations
- Multi-tenant isolation critical for all features

---

## Success Metrics

- [ ] 12 new test files created (6 service + 6 route)
- [ ] themeService.test.ts: 10+ tests passing
- [ ] themeRoutes.test.ts: 7+ tests passing
- [ ] uploadService.test.ts: 8+ tests passing
- [ ] uploadRoutes.test.ts: 7+ tests passing
- [ ] auditLogService.test.ts: 9+ tests passing
- [ ] auditLogRoutes.test.ts: 7+ tests passing
- [ ] transferRoutes.test.ts: 10+ tests passing
- [ ] templateRoutes.test.ts: 10+ tests passing
- [ ] approvalRulesService.test.ts: 9+ tests passing
- [ ] approvalEvaluation.test.ts: 9+ tests passing
- [ ] approvalRulesRoutes.test.ts: 10+ tests passing
- [ ] analyticsRoutes.test.ts: 8+ tests passing
- [ ] All new tests passing (~110+ new tests total)
- [ ] 100% feature coverage achieved
- [ ] All service and route patterns documented in TEST_TEMPLATE.md

---

## Notes & Decisions

**Key Design Decisions:**

1. **Mock Supabase for upload tests**
   - **Rationale:** Avoid external dependencies in unit tests
   - **Alternative:** Use real Supabase (rejected: slow, flaky, requires credentials)

2. **Comprehensive approval evaluation testing**
   - **Rationale:** Complex business logic with many edge cases
   - **Alternative:** Minimal coverage (rejected: approval bugs are high-risk)

3. **Route tests for transfers even though service tests exist**
   - **Rationale:** HTTP layer validation is distinct from service logic
   - **Alternative:** Skip route tests (rejected: incomplete coverage)

4. **Separate approval rules and evaluation tests**
   - **Rationale:** CRUD logic separate from evaluation algorithm
   - **Alternative:** Combined file (rejected: too large, mixed concerns)

5. **Analytics route tests without service tests**
   - **Rationale:** Service tests exist, only need HTTP layer coverage
   - **Alternative:** Add service tests too (rejected: already covered)

**Known Limitations:**
- Upload tests don't cover actual file storage (mocked)
- Approval evaluation tests may be slow (complex setup)
- Analytics tests may need significant seed data
- Theme tests limited to color/preset validation (no visual testing)

**Future Enhancements (Out of Scope):**
- Integration tests with real Supabase
- Visual regression testing for theme changes
- Load testing for analytics queries
- Approval workflow UI testing (E2E)

---

**Template Version:** 1.0
**Created:** 2025-10-21
