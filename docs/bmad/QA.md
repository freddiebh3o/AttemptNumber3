# QA Plan: Stock Management & Branch Operations

## Acceptance Criteria

### ST-001: Branch Management
- **AC-001-1** - Admin can create branch with unique slug per tenant
- **AC-001-2** - Admin can assign users to branches (many-to-many)
- **AC-001-3** - Non-admin users cannot create/delete branches
- **AC-001-4** - Branch list shows user count and active status

### ST-002: Stock Receipt
- **AC-002-1** - Receipt creates new `StockLot` with qty/cost/timestamp
- **AC-002-2** - `ProductStock.qtyOnHand` increments correctly
- **AC-002-3** - `StockLedger` entry created with kind=RECEIPT
- **AC-002-4** - API returns 400 if qty ≤ 0 or unitCostPence < 0

### ST-003: Stock Adjustment
- **AC-003-1** - Positive adjustment increases `qtyOnHand` and creates ledger entry
- **AC-003-2** - Negative adjustment decreases `qtyOnHand` (fails if insufficient stock)
- **AC-003-3** - Reason field is required (min 3 chars)
- **AC-003-4** - Actor user ID captured in `StockLedger.actorUserId`

## Stage Gates

### Plan (Entry)
- [ ] PRD reviewed by PM and tech lead
- [ ] ARCH reviewed by backend + frontend devs
- [ ] Stories created in GitHub Issues with labels

### Plan (Exit)
- [ ] All acceptance criteria defined
- [ ] API contracts documented in ARCH.md
- [ ] Test data requirements identified

### Build (Entry)
- [ ] Database migrations ready
- [ ] OpenAPI schemas defined for new routes

### Build (Exit)
- [ ] All AC-### items have passing tests
- [ ] OpenAPI types regenerated for frontend
- [ ] No TypeScript errors in both workspaces

### QA (Entry)
- [ ] PR submitted with test evidence
- [ ] All CI checks passing (lint, typecheck, build)

### QA (Exit)
- [ ] Manual testing completed for each AC
- [ ] Audit logs verified for stock operations
- [ ] Permission checks validated (RBAC)

### Release (Entry)
- [ ] QA sign-off on all stories
- [ ] Database migrations tested in staging

### Release (Exit)
- [ ] Deployed to production
- [ ] Smoke tests passed
- [ ] Rollback plan documented
