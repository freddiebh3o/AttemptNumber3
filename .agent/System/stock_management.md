# Stock Management System

## Overview

The system implements a comprehensive FIFO (First-In, First-Out) inventory management system with:
- **Multi-branch stock tracking** - Each branch maintains separate inventory
- **FIFO lot-based consumption** - Oldest inventory consumed first
- **Append-only audit trail** - Complete history of all stock movements
- **Denormalized aggregates** - Fast queries for on-hand quantities
- **Branch membership** - User access control per branch
- **Unit cost tracking** - Cost basis for COGS calculations
- **Serializable transactions** - Prevents race conditions and negative stock

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  ProductStock (Aggregate)                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ tenantId │ branchId │ productId │ qtyOnHand │ qtyAllocated│  │
│  └──────────────────────────────────────────────────────────┘   │
│  Fast queries for available stock (denormalized)                 │
└─────────────────────────────────────────────────────────────────┘
                          ↑ Updated by
                          │
┌─────────────────────────────────────────────────────────────────┐
│                  StockLot (FIFO Lots)                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ id │ qtyReceived │ qtyRemaining │ unitCostPence │ recvAt │   │
│  │ L1 │     100     │      75      │     1200      │ Jan 1  │   │
│  │ L2 │     200     │     200      │     1300      │ Jan 5  │   │
│  │ L3 │     150     │     150      │     1250      │ Jan 10 │   │
│  └──────────────────────────────────────────────────────────┘   │
│  Individual receipts with unit costs, FIFO ordered by receivedAt │
└─────────────────────────────────────────────────────────────────┘
                          │ Tracks movements in
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│                  StockLedger (Append-Only Log)                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ id │ lotId │ kind        │ qtyDelta │ actor │ occurredAt │   │
│  │ E1 │  L1   │ RECEIPT     │   +100   │ Alice │ Jan 1      │   │
│  │ E2 │  L1   │ CONSUMPTION │    -25   │ Bob   │ Jan 3      │   │
│  │ E3 │  L2   │ RECEIPT     │   +200   │ Alice │ Jan 5      │   │
│  │ E4 │  L1   │ ADJUSTMENT  │    -10   │ Carol │ Jan 7      │   │
│  └──────────────────────────────────────────────────────────┘   │
│  Complete history for compliance, reporting, and reconciliation  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### 1. Stock Lot

**Definition:** An individual receipt of inventory with a specific unit cost and received date.

**Key Fields:**
- `qtyReceived` - Initial quantity received (immutable)
- `qtyRemaining` - Current remaining quantity (decrements on consumption)
- `unitCostPence` - Unit cost in minor units (e.g., 1200 pence = £12.00)
- `receivedAt` - Receipt timestamp (FIFO sort key)

**Example:**
```json
{
  "id": "lot_abc123",
  "tenantId": "tenant_xyz",
  "branchId": "branch_warehouse1",
  "productId": "product_coffee",
  "qtyReceived": 100,
  "qtyRemaining": 75,
  "unitCostPence": 1200,
  "sourceRef": "PO-2025-001",
  "receivedAt": "2025-01-01T10:00:00Z"
}
```

**Lifecycle:**
1. Created on receipt (qtyReceived = qtyRemaining)
2. Decremented on consumption/adjustment (qtyRemaining--)
3. Once qtyRemaining = 0, lot is "depleted" (no longer queried for FIFO)

### 2. Product Stock (Aggregate)

**Definition:** Denormalized summary of stock levels per branch+product.

**Key Fields:**
- `qtyOnHand` - Sum of all lot qtyRemaining
- `qtyAllocated` - Reserved for pending orders (future feature)

**Example:**
```json
{
  "tenantId": "tenant_xyz",
  "branchId": "branch_warehouse1",
  "productId": "product_coffee",
  "qtyOnHand": 425,      // Sum of all lot qtyRemaining
  "qtyAllocated": 0      // Future: reserved for orders
}
```

**Purpose:**
- Fast queries for available stock (no need to sum lots)
- Prevents negative stock (enforced in service layer)
- Updated atomically in same transaction as lot changes

### 3. Stock Ledger (Movement Log)

**Definition:** Append-only audit trail of all stock movements.

**Movement Types:**
- `RECEIPT` - Receive new stock into lot (+qty)
- `CONSUMPTION` - Fulfill order / consume stock (-qty)
- `ADJUSTMENT` - Manual correction (+/- qty)
- `REVERSAL` - Undo previous movement (+/- qty, future)

**Key Fields:**
- `kind` - Movement type (enum)
- `qtyDelta` - Quantity change (+/-)
- `lotId` - Associated lot (nullable for adjustments)
- `reason` - Free-text explanation
- `actorUserId` - User who performed action
- `occurredAt` - Movement timestamp

**Example:**
```json
{
  "id": "ledger_def456",
  "tenantId": "tenant_xyz",
  "branchId": "branch_warehouse1",
  "productId": "product_coffee",
  "lotId": "lot_abc123",
  "kind": "CONSUMPTION",
  "qtyDelta": -25,
  "reason": "Order #12345",
  "actorUserId": "user_bob",
  "occurredAt": "2025-01-03T14:30:00Z"
}
```

**Purpose:**
- Complete audit trail for compliance (never deleted)
- Reconciliation and reporting
- Troubleshooting discrepancies
- Historical cost analysis

---

## FIFO Algorithm

### Receipt Flow (Receive Stock)

```typescript
// 1. Validate inputs
if (qty <= 0) throw Error('qty must be > 0')

// 2. Check branch access (user must be member)
await assertBranchAccess({ userId, branchId })

// 3. Check product belongs to tenant
await ensureProductBelongsToTenant({ tenantId, productId })

// 4. Begin serializable transaction
await transaction(async (tx) => {
  // 5. Create new lot
  const lot = await tx.stockLot.create({
    data: {
      tenantId, branchId, productId,
      qtyReceived: 100,
      qtyRemaining: 100,
      unitCostPence: 1200,
      receivedAt: new Date(),
    },
  })

  // 6. Create ledger entry (RECEIPT, +qty)
  const ledger = await tx.stockLedger.create({
    data: {
      tenantId, branchId, productId,
      lotId: lot.id,
      kind: 'RECEIPT',
      qtyDelta: +100,
      actorUserId: userId,
      occurredAt: new Date(),
    },
  })

  // 7. Increment aggregate (qtyOnHand += 100)
  const productStock = await tx.productStock.update({
    where: { tenantId_branchId_productId: { tenantId, branchId, productId } },
    data: { qtyOnHand: { increment: 100 } },
  })

  // 8. Write audit events (best-effort)
  await writeAuditEvent(...)

  return { lot, ledger, productStock }
})
```

**Result:**
- New lot created with full quantity
- Ledger entry records receipt
- Aggregate qtyOnHand increased
- Audit trail updated

### Consumption Flow (FIFO)

```typescript
// 1. Validate inputs
if (qty <= 0) throw Error('qty must be > 0')

// 2. Check branch access
await assertBranchAccess({ userId, branchId })

// 3. Begin serializable transaction
await transaction(async (tx) => {
  // 4. Check sufficient stock
  const productStock = await tx.productStock.findUnique({
    where: { tenantId_branchId_productId: { tenantId, branchId, productId } },
  })
  if (qty > productStock.qtyOnHand) {
    throw Error('Insufficient stock')
  }

  // 5. Query lots in FIFO order (oldest first)
  const lots = await tx.stockLot.findMany({
    where: {
      tenantId, branchId, productId,
      qtyRemaining: { gt: 0 },
    },
    orderBy: [
      { receivedAt: 'asc' },  // ← FIFO: oldest first
      { createdAt: 'asc' },   // ← Tiebreaker
      { id: 'asc' },          // ← Deterministic
    ],
  })

  // 6. Drain lots until qty consumed
  let remaining = 50  // Example: consume 50 units
  for (const lot of lots) {
    if (remaining === 0) break

    const take = Math.min(remaining, lot.qtyRemaining)
    // take = min(50, 75) = 50 from lot_abc123

    // 7. Decrement lot
    await tx.stockLot.update({
      where: { id: lot.id },
      data: { qtyRemaining: { decrement: take } },
    })
    // lot_abc123: qtyRemaining 75 → 25

    // 8. Create ledger entry (CONSUMPTION, -qty)
    await tx.stockLedger.create({
      data: {
        tenantId, branchId, productId,
        lotId: lot.id,
        kind: 'CONSUMPTION',
        qtyDelta: -take,      // -50
        reason: 'Order #12345',
        actorUserId: userId,
      },
    })

    remaining -= take  // remaining = 0
  }

  // 9. Decrement aggregate (qtyOnHand -= 50)
  await tx.productStock.update({
    where: { tenantId_branchId_productId: { tenantId, branchId, productId } },
    data: { qtyOnHand: { decrement: 50 } },
  })

  // 10. Write audit events
  await writeAuditEvent(...)
})
```

**Result:**
- Oldest lot (lot_abc123) drained by 50 units (75 → 25)
- Ledger entry records consumption
- Aggregate qtyOnHand decreased (425 → 375)
- FIFO order preserved

**Why FIFO?**
- Matches physical inventory rotation (prevent spoilage)
- Accurate COGS calculation (older costs first)
- Compliance with accounting standards (GAAP, IFRS)

### Adjustment Flow (+/-)

**Positive Adjustment (Increase Stock):**
- Same as receipt: create new lot, ledger entry (ADJUSTMENT), increment aggregate
- Use case: Stock audit finds extra units, damaged goods recovered

**Negative Adjustment (Decrease Stock):**
- Same as consumption: FIFO drain lots, ledger entry (ADJUSTMENT), decrement aggregate
- Use case: Damaged goods, theft, audit correction

```typescript
if (qtyDelta > 0) {
  // Adjust-up: create lot + ledger (ADJUSTMENT) + increment aggregate
  const lot = await tx.stockLot.create({
    data: {
      qtyReceived: qtyDelta,
      qtyRemaining: qtyDelta,
      unitCostPence: unitCostPence ?? null,
      // ...
    },
  })

  await tx.stockLedger.create({
    data: {
      lotId: lot.id,
      kind: 'ADJUSTMENT',
      qtyDelta: +qtyDelta,
      reason: 'Stock audit found extra units',
      // ...
    },
  })

  await tx.productStock.update({
    data: { qtyOnHand: { increment: qtyDelta } },
  })
}

if (qtyDelta < 0) {
  // Adjust-down: FIFO drain lots + ledger (ADJUSTMENT) + decrement aggregate
  await fifoDecrementLots(tx, {
    qty: Math.abs(qtyDelta),
    kind: 'ADJUSTMENT',
    reason: 'Damaged goods',
    // ...
  })
}
```

---

## Branch Membership & Access Control

### Purpose

**Branch membership** - Users assigned to specific branches for access control.

**Use Cases:**
- Warehouse staff can only manage inventory at their warehouse
- Store managers can only view/adjust stock at their store
- Admins can access all branches (via `branches:manage` permission)

### Enforcement

**Backend:** `assertBranchAccess()` in `stockService.ts`

```typescript
async function assertBranchAccess({
  currentTenantId,
  currentUserId,
  branchId,
  requireMembership = true,
}) {
  // 1. Check branch exists and belongs to tenant
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, tenantId: currentTenantId, isActive: true },
  })
  if (!branch) throw Errors.notFound('Branch not found')

  // 2. Check user is member of branch (unless requireMembership = false)
  if (requireMembership) {
    const membership = await prisma.userBranchMembership.findFirst({
      where: { userId: currentUserId, branchId },
    })
    if (!membership) throw Errors.permissionDenied()
  }
}
```

**Frontend:** Check `useAuthStore().branchMembershipsCurrentTenant`

```typescript
const branchMemberships = useAuthStore((s) => s.branchMembershipsCurrentTenant)
const canAccessBranch = branchMemberships.some(m => m.branchId === branchId)

if (!canAccessBranch) {
  return <Alert>You don't have access to this branch</Alert>
}
```

### Bypass for Admins

Users with `branches:manage` permission can access all branches without explicit membership.

**Implementation (future):**
```typescript
const hasBranchesManage = req.currentPermissionKeys?.has('branches:manage')
if (hasBranchesManage) {
  requireMembership = false  // Skip membership check
}
```

---

## API Endpoints

### 1. Receive Stock

**Endpoint:** `POST /api/stock/:productId/receive`

**Permission:** `stock:write`

**Request Body:**
```json
{
  "branchId": "branch_warehouse1",
  "qty": 100,
  "unitCostPence": 1200,
  "sourceRef": "PO-2025-001",
  "reason": "Purchase order delivery",
  "occurredAt": "2025-01-01T10:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "lot": {
      "id": "lot_abc123",
      "qtyReceived": 100,
      "qtyRemaining": 100,
      "unitCostPence": 1200,
      "receivedAt": "2025-01-01T10:00:00Z"
    },
    "ledger": {
      "id": "ledger_def456",
      "kind": "RECEIPT",
      "qtyDelta": 100
    },
    "productStock": {
      "qtyOnHand": 425,
      "qtyAllocated": 0
    }
  }
}
```

### 2. Consume Stock (FIFO)

**Endpoint:** `POST /api/stock/:productId/consume`

**Permission:** `stock:allocate`

**Request Body:**
```json
{
  "branchId": "branch_warehouse1",
  "qty": 50,
  "reason": "Order #12345",
  "occurredAt": "2025-01-03T14:30:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "affected": [
      {
        "lotId": "lot_abc123",
        "take": 50,
        "ledgerId": "ledger_ghi789"
      }
    ],
    "productStock": {
      "qtyOnHand": 375,
      "qtyAllocated": 0
    }
  }
}
```

**Error (Insufficient Stock):**
```json
{
  "success": false,
  "error": {
    "errorCode": "CONFLICT_ERROR",
    "httpStatusCode": 409,
    "userFacingMessage": "Insufficient stock to fulfill request.",
    "developerMessage": "Need 50, on-hand 25"
  }
}
```

### 3. Adjust Stock (+/-)

**Endpoint:** `POST /api/stock/:productId/adjust`

**Permission:** `stock:write`

**Request Body:**
```json
{
  "branchId": "branch_warehouse1",
  "qtyDelta": -10,  // Negative for decrease, positive for increase
  "reason": "Damaged goods",
  "occurredAt": "2025-01-07T09:00:00Z",
  "unitCostPence": null  // Only for positive adjustments
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "affected": [
      {
        "lotId": "lot_abc123",
        "take": 10,
        "ledgerId": "ledger_jkl012"
      }
    ],
    "productStock": {
      "qtyOnHand": 365,
      "qtyAllocated": 0
    }
  }
}
```

### 4. Get Stock Levels (Single Branch)

**Endpoint:** `GET /api/stock/:productId/levels?branchId=:branchId`

**Permission:** `stock:read`

**Response:**
```json
{
  "success": true,
  "data": {
    "productStock": {
      "tenantId": "tenant_xyz",
      "branchId": "branch_warehouse1",
      "productId": "product_coffee",
      "qtyOnHand": 365,
      "qtyAllocated": 0
    },
    "lots": [
      {
        "id": "lot_abc123",
        "qtyReceived": 100,
        "qtyRemaining": 15,
        "unitCostPence": 1200,
        "receivedAt": "2025-01-01T10:00:00Z"
      },
      {
        "id": "lot_def456",
        "qtyReceived": 200,
        "qtyRemaining": 200,
        "unitCostPence": 1300,
        "receivedAt": "2025-01-05T14:00:00Z"
      },
      {
        "id": "lot_ghi789",
        "qtyReceived": 150,
        "qtyRemaining": 150,
        "unitCostPence": 1250,
        "receivedAt": "2025-01-10T11:00:00Z"
      }
    ]
  }
}
```

### 5. Get Stock Levels (All Branches)

**Endpoint:** `GET /api/stock/:productId/levels-bulk`

**Permission:** `stock:read`

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "branchId": "branch_warehouse1",
        "branchName": "Main Warehouse",
        "productStock": {
          "qtyOnHand": 365,
          "qtyAllocated": 0
        },
        "lots": [...]
      },
      {
        "branchId": "branch_store1",
        "branchName": "Downtown Store",
        "productStock": {
          "qtyOnHand": 50,
          "qtyAllocated": 0
        },
        "lots": [...]
      }
    ]
  }
}
```

### 6. List Stock Movements (Ledger)

**Endpoint:** `GET /api/stock/:productId/ledger`

**Permission:** `stock:read`

**Query Parameters:**
- `branchId` (optional) - Filter by branch
- `limit` (optional, default: 20, max: 100) - Page size
- `cursor` (optional) - Pagination cursor
- `sortDir` (optional, default: `desc`) - Sort direction (newest first)
- `occurredFrom` (optional) - Filter by date range (ISO)
- `occurredTo` (optional) - Filter by date range (ISO)
- `kinds` (optional) - Filter by movement types (comma-separated)
- `minQty` (optional) - Filter by qty delta
- `maxQty` (optional) - Filter by qty delta

**Example:**
```
GET /api/stock/product_coffee/ledger?branchId=branch_warehouse1&limit=10&kinds=RECEIPT,CONSUMPTION
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "ledger_jkl012",
        "branchId": "branch_warehouse1",
        "productId": "product_coffee",
        "lotId": "lot_abc123",
        "kind": "ADJUSTMENT",
        "qtyDelta": -10,
        "reason": "Damaged goods",
        "actorUserId": "user_carol",
        "occurredAt": "2025-01-07T09:00:00Z"
      },
      {
        "id": "ledger_ghi789",
        "branchId": "branch_warehouse1",
        "productId": "product_coffee",
        "lotId": "lot_abc123",
        "kind": "CONSUMPTION",
        "qtyDelta": -50,
        "reason": "Order #12345",
        "actorUserId": "user_bob",
        "occurredAt": "2025-01-03T14:30:00Z"
      }
    ],
    "pageInfo": {
      "hasNextPage": true,
      "nextCursor": "ledger_ghi789"
    },
    "applied": {
      "limit": 10,
      "sort": { "field": "occurredAt", "direction": "desc" },
      "filters": {
        "productId": "product_coffee",
        "branchId": "branch_warehouse1",
        "kinds": ["RECEIPT", "CONSUMPTION"]
      }
    }
  }
}
```

---

## Transaction Isolation

### Serializable Transactions

All stock operations use **Serializable** isolation level to prevent race conditions:

```typescript
await prisma.$transaction(async (tx) => {
  // Stock operations here
}, { isolationLevel: 'Serializable' })
```

**Why Serializable?**
- Prevents phantom reads (concurrent lot creation)
- Prevents non-repeatable reads (concurrent qtyRemaining updates)
- Prevents lost updates (concurrent aggregate updates)
- Ensures FIFO order consistency

**Trade-off:**
- Higher lock contention (slower for concurrent writes)
- Retry logic needed for serialization failures
- Acceptable for inventory operations (correctness > speed)

### Concurrent Operations Example

**Scenario:** Two users simultaneously consume stock from same product/branch.

```
Time  | User A                     | User B
------|----------------------------|----------------------------
T1    | BEGIN TRANSACTION          |
T2    |                            | BEGIN TRANSACTION
T3    | Query lots (FIFO)          |
T4    |                            | Query lots (FIFO)
T5    | Update lot (decrement 25)  |
T6    |                            | Update lot (decrement 30)
T7    | COMMIT                     |
T8    |                            | COMMIT (fails, retries)
```

**Without Serializable:**
- Both users query same lots at T3/T4
- Both update same lot at T5/T6
- Lost update: only last write (30) persists, 25 is lost
- Aggregate qtyOnHand incorrect

**With Serializable:**
- User A commits at T7
- User B's transaction detects conflict at T8
- User B's transaction aborted, must retry
- Retry: User B queries lots again (with A's changes), commits successfully
- Aggregate qtyOnHand correct

---

## Audit Trail Integration

Every stock operation creates audit events for compliance:

### Audit Event Types

| Entity Type | Action | Description |
|-------------|--------|-------------|
| `STOCK_LEDGER` | `STOCK_RECEIVE` | Stock received into lot |
| `STOCK_LEDGER` | `STOCK_CONSUME` | Stock consumed (FIFO) |
| `STOCK_LEDGER` | `STOCK_ADJUST` | Manual adjustment (+/-) |
| `STOCK_LOT` | `CREATE` | New lot created |
| `PRODUCT_STOCK` | `UPDATE` | Aggregate qtyOnHand changed |

### Example Audit Event

```json
{
  "id": "audit_xyz123",
  "tenantId": "tenant_abc",
  "actorUserId": "user_alice",
  "entityType": "STOCK_LEDGER",
  "entityId": "ledger_def456",
  "action": "STOCK_RECEIVE",
  "entityName": null,
  "beforeJson": null,
  "afterJson": {
    "id": "ledger_def456",
    "kind": "RECEIPT",
    "qtyDelta": 100,
    "lotId": "lot_abc123",
    "reason": "Purchase order delivery"
  },
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0 ...",
  "createdAt": "2025-01-01T10:00:00Z"
}
```

**Purpose:**
- Compliance (who changed what, when, why)
- Troubleshooting (trace discrepancies)
- Reporting (stock movement history)
- Forensics (detect fraud, errors)

---

## Cost Accounting (COGS)

### Unit Cost Tracking

Each lot stores `unitCostPence` for cost basis calculations:

```json
{
  "lotId": "lot_abc123",
  "qtyReceived": 100,
  "qtyRemaining": 25,
  "unitCostPence": 1200,  // £12.00 per unit
  "receivedAt": "2025-01-01T10:00:00Z"
}
```

### FIFO Cost Calculation

When consuming stock, FIFO ensures oldest costs are used:

**Example:**
- Lot 1: 100 units @ £12.00 (received Jan 1)
- Lot 2: 200 units @ £13.00 (received Jan 5)
- Lot 3: 150 units @ £12.50 (received Jan 10)

**Consume 150 units:**
1. Take 100 from Lot 1 @ £12.00 = £1,200
2. Take 50 from Lot 2 @ £13.00 = £650
3. **Total COGS:** £1,850

**Ledger entries:**
```json
[
  {
    "lotId": "lot_1",
    "kind": "CONSUMPTION",
    "qtyDelta": -100,
    "unitCostPence": 1200  // From lot metadata
  },
  {
    "lotId": "lot_2",
    "kind": "CONSUMPTION",
    "qtyDelta": -50,
    "unitCostPence": 1300  // From lot metadata
  }
]
```

### COGS Reporting (Future)

Query ledger entries with lot unit costs:

```sql
SELECT
  sl.lotId,
  sl.qtyDelta,
  lot.unitCostPence,
  (ABS(sl.qtyDelta) * lot.unitCostPence) AS costBasis
FROM StockLedger sl
JOIN StockLot lot ON sl.lotId = lot.id
WHERE sl.kind = 'CONSUMPTION'
  AND sl.occurredAt BETWEEN '2025-01-01' AND '2025-01-31'
ORDER BY sl.occurredAt DESC
```

---

## Edge Cases & Error Handling

### 1. Insufficient Stock

**Scenario:** User tries to consume more stock than available.

**Error:**
```json
{
  "errorCode": "CONFLICT_ERROR",
  "httpStatusCode": 409,
  "userFacingMessage": "Insufficient stock to fulfill request.",
  "developerMessage": "Need 100, on-hand 25"
}
```

**Frontend Handling:**
- Show available stock before consumption
- Validate quantity client-side (prevent submission)
- Display error message with available quantity

### 2. Negative Stock Prevention

**Enforcement:** Check `qtyOnHand` before FIFO consumption.

```typescript
const productStock = await tx.productStock.findUnique({
  where: { tenantId_branchId_productId: { tenantId, branchId, productId } },
})

if (qty > productStock.qtyOnHand) {
  throw Errors.conflict('Insufficient stock', `Need ${qty}, on-hand ${productStock.qtyOnHand}`)
}
```

**Why Pre-Check?**
- Prevents FIFO loop from running (performance)
- Clear error message with exact shortfall
- Fails fast before lot updates

### 3. Lot Depletion

**Scenario:** Lot qtyRemaining reaches 0.

**Behavior:**
- Lot still exists in database (not deleted)
- No longer queried for FIFO (WHERE qtyRemaining > 0)
- Ledger entries still reference lot (historical data)

**Why Keep Depleted Lots?**
- Audit trail integrity (ledger references lot)
- Cost basis for COGS calculations
- Historical reporting (what was in stock when)

### 4. Concurrent Serialization Failures

**Scenario:** Two users consume stock simultaneously, serialization conflict.

**Error:**
```
Prisma error P2034: Transaction failed due to write conflict
```

**Handling:**
- Backend: Retry with exponential backoff (future)
- Frontend: Show "Please try again" message
- User: Refresh page and retry

### 5. Branch Inactive

**Scenario:** User tries to receive stock at inactive branch.

**Error:**
```json
{
  "errorCode": "NOT_FOUND",
  "userFacingMessage": "Branch not found for this tenant."
}
```

**Prevention:**
- Frontend: Filter branch dropdown to `isActive: true` only
- Backend: Check `branch.isActive` in `assertBranchAccess()`

### 6. Product Not Found

**Scenario:** Product deleted after page load, user tries to receive stock.

**Error:**
```json
{
  "errorCode": "NOT_FOUND",
  "userFacingMessage": "Product not found for this tenant."
}
```

**Prevention:**
- Products use `onDelete: Restrict` for stock relations
- Cannot delete product with stock lots/ledger entries
- Must consume all stock first, then delete product

---

## Reporting & Analytics (Future)

### Stock Movement Report

**Query:** All movements for date range, grouped by product/branch.

```sql
SELECT
  p.productName,
  b.branchName,
  sl.kind,
  SUM(sl.qtyDelta) AS totalQtyDelta,
  COUNT(*) AS movementCount
FROM StockLedger sl
JOIN Product p ON sl.productId = p.id
JOIN Branch b ON sl.branchId = b.id
WHERE sl.tenantId = ?
  AND sl.occurredAt BETWEEN ? AND ?
GROUP BY p.productName, b.branchName, sl.kind
ORDER BY p.productName, b.branchName, sl.kind
```

### Stock Valuation Report

**Query:** Current stock value by branch.

```sql
SELECT
  b.branchName,
  p.productName,
  lot.qtyRemaining,
  lot.unitCostPence,
  (lot.qtyRemaining * lot.unitCostPence) / 100.0 AS valuePounds
FROM StockLot lot
JOIN Product p ON lot.productId = p.id
JOIN Branch b ON lot.branchId = b.id
WHERE lot.tenantId = ?
  AND lot.qtyRemaining > 0
ORDER BY b.branchName, valuePounds DESC
```

### Slow-Moving Inventory Report

**Query:** Lots with no consumption in last 90 days.

```sql
SELECT
  p.productName,
  b.branchName,
  lot.qtyRemaining,
  lot.receivedAt,
  DATEDIFF(NOW(), lot.receivedAt) AS daysOld
FROM StockLot lot
JOIN Product p ON lot.productId = p.id
JOIN Branch b ON lot.branchId = b.id
LEFT JOIN StockLedger sl ON sl.lotId = lot.id
  AND sl.kind = 'CONSUMPTION'
  AND sl.occurredAt > DATE_SUB(NOW(), INTERVAL 90 DAY)
WHERE lot.tenantId = ?
  AND lot.qtyRemaining > 0
  AND sl.id IS NULL  -- No recent consumption
ORDER BY daysOld DESC
```

---

## Performance Considerations

### 1. FIFO Query Optimization

**Index:** `@@index([tenantId, branchId, productId, receivedAt])`

```sql
-- Efficient: uses composite index
SELECT * FROM StockLot
WHERE tenantId = ?
  AND branchId = ?
  AND productId = ?
  AND qtyRemaining > 0
ORDER BY receivedAt ASC
```

**Why Composite Index?**
- Filters and sorts in single index scan
- No filesort needed (order by indexed column)
- Fast for typical FIFO queries (< 10ms)

### 2. Aggregate Denormalization

**Pattern:** Store `qtyOnHand` in `ProductStock` instead of summing lots.

```typescript
// ❌ SLOW - Sum lots every query
const qtyOnHand = await prisma.stockLot.aggregate({
  where: { tenantId, branchId, productId },
  _sum: { qtyRemaining: true },
})

// ✅ FAST - Read denormalized aggregate
const productStock = await prisma.productStock.findUnique({
  where: { tenantId_branchId_productId: { tenantId, branchId, productId } },
  select: { qtyOnHand: true },
})
```

**Trade-off:**
- Write cost: Update aggregate on every stock operation
- Read benefit: Instant aggregate queries (no joins/sums)
- Acceptable: More reads than writes for stock levels

### 3. Ledger Pagination

**Pattern:** Cursor-based pagination for large ledger history.

```typescript
const ledger = await prisma.stockLedger.findMany({
  where: { tenantId, productId },
  take: 21,  // Fetch limit + 1 to detect hasNextPage
  cursor: { id: cursorId },
  skip: 1,   // Skip cursor itself
  orderBy: { occurredAt: 'desc' },
})

const hasNextPage = ledger.length > 20
const items = hasNextPage ? ledger.slice(0, 20) : ledger
const nextCursor = hasNextPage ? items[items.length - 1].id : null
```

**Benefits:**
- Constant-time pagination (no offset scan)
- Works with any filter (dates, kinds, etc.)
- Scales to millions of ledger entries

### 4. Bulk Stock Levels

**Pattern:** Parallel queries for multi-branch stock levels.

```typescript
const branches = await prisma.branch.findMany({
  where: { tenantId, isActive: true },
})

const results = await Promise.all(
  branches.map(async (branch) => {
    const [productStock, lots] = await Promise.all([
      prisma.productStock.findUnique({ ... }),
      prisma.stockLot.findMany({ ... }),
    ])
    return { branch, productStock, lots }
  })
)
```

**Benefits:**
- Parallel execution (N branches in ~same time as 1)
- No N+1 query problem
- Fast for typical use (< 10 branches)

---

## Related Documentation

- [Project Architecture](./project_architecture.md)
- [Database Schema Reference](./database_schema.md)
- [RBAC System Design](./rbac_system.md)

---

**Last Updated:** 2025-10-11
**Document Version:** 1.0
