# Architecture: Stock Management & Branch Operations

## Modules

### Backend (`api-server/src/`)
- `routes/branchRouter.ts` - Branch CRUD endpoints
- `routes/stockRouter.ts` - Stock operations (receipt, adjust, consume)
- `services/branches/` - Branch business logic
- `services/stockService.ts` - FIFO lot management
- `middleware/permissionMiddleware.ts` - RBAC enforcement

### Frontend (`admin-web/src/`)
- `pages/BranchesPage.tsx` - Branch list/management
- `pages/BranchPage.tsx` - Single branch detail/edit
- `api/branches.ts` - Branch API client
- `api/stock.ts` - Stock operation API client

### Database (Prisma models)
- `Branch` - Physical locations within tenant
- `ProductStock` - Aggregated stock per branch+product
- `StockLot` - FIFO lots with unit cost and received date
- `StockLedger` - Append-only movement log

## Key Routes

### Branches
```typescript
GET    /api/branches                    → { branches: Branch[] }
POST   /api/branches                    → { branch: Branch }
GET    /api/branches/:branchId          → { branch: Branch }
PUT    /api/branches/:branchId          → { branch: Branch }
DELETE /api/branches/:branchId          → { success: true }
```

### Stock Operations
```typescript
POST /api/stock/receive
→ { productId, branchId, qty, unitCostPence, sourceRef? }
→ { lot: StockLot, productStock: ProductStock }

POST /api/stock/adjust
→ { productId, branchId, qtyDelta, reason }
→ { ledgerEntry: StockLedger, productStock: ProductStock }

POST /api/stock/consume
→ { productId, branchId, qty, reason }
→ { ledgerEntries: StockLedger[], lotsAffected: StockLot[] }
```

## Non-Functional Requirements
1. **Atomicity** - Stock operations use DB transactions (all-or-nothing)
2. **Auditability** - All movements logged in `StockLedger` with actor/timestamp
3. **Tenant isolation** - All queries filtered by `req.currentTenantId`

## Technical Risks
1. **Race conditions** - Use Prisma transactions + optimistic locking on `ProductStock`
2. **FIFO edge cases** - Consuming more than available in single lot → drain multiple lots
3. **Negative stock** - Prevent consumption beyond available qty → validation in service layer
