# Stock Transfer System

## Overview

The Stock Transfer System enables inter-branch inventory transfers with multi-level approval workflows, FIFO cost preservation, and comprehensive analytics. This document provides a comprehensive technical specification of the transfer domain logic, workflows, and integration points.

**Related Documentation:**
- [Database Schema Reference](../database-schema.md) - Tables 17-26 (Stock Transfer tables)
- [Stock Management System](../stock-management.md) - FIFO algorithm and lot tracking
- [Stock Transfers Feature Guide](../../SOP/stock-transfers-feature-guide.md) - User workflows and API reference
- [RBAC System](../rbac-system.md) - Permission requirements

---

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Transfer Lifecycle](#transfer-lifecycle)
3. [Multi-Level Approval Workflow](#multi-level-approval-workflow)
4. [Transfer Templates](#transfer-templates)
5. [Partial Shipment System](#partial-shipment-system)
6. [Transfer Reversal](#transfer-reversal)
7. [Transfer Priority System](#transfer-priority-system)
8. [Analytics & Metrics](#analytics--metrics)
9. [API Endpoints](#api-endpoints)
10. [Service Layer Architecture](#service-layer-architecture)
11. [Integration Points](#integration-points)

---

## Core Concepts

### What is a Stock Transfer?

A **stock transfer** is a formal workflow for moving inventory from one branch (source) to another branch (destination) within the same tenant. Transfers ensure:

- **Accountability:** Multi-step approval process with audit trail
- **Traceability:** Complete history from request to completion
- **Cost Accuracy:** FIFO cost basis preserved across branches
- **Visibility:** Real-time tracking of in-transit inventory
- **Compliance:** Meets UK B2B warehouse operational standards

### Key Characteristics

1. **Branch-to-Branch:** Transfers only between branches within same tenant
2. **Multi-Step Workflow:** REQUESTED → APPROVED → IN_TRANSIT → COMPLETED
3. **FIFO Preservation:** Weighted average cost maintained from source to destination
4. **Partial Support:** Approve/ship/receive less than requested quantity
5. **Reversible:** Completed transfers can be reversed with FIFO lot restoration
6. **Priority-Based:** LOW, NORMAL, HIGH, URGENT priorities
7. **Template-Driven:** Reusable configurations for recurring routes
8. **Metrics-Driven:** Daily aggregated analytics for bottleneck detection

### Transfer Number Format

**Format:** `TRF-{YYYY}-{NNNN}`

**Examples:**
- `TRF-2025-0001` - First transfer of 2025
- `TRF-2025-0042` - 42nd transfer of 2025

**Generation Logic:**
```typescript
async function generateTransferNumber(tenantId: string, tx?) {
  // 1. Query max transfer number for current year
  const maxTransfer = await prisma.stockTransfer.findFirst({
    where: {
      tenantId,
      transferNumber: { startsWith: `TRF-${currentYear}-` }
    },
    orderBy: { transferNumber: 'desc' },
    select: { transferNumber: true }
  })

  // 2. Extract numeric suffix or start from 1
  const lastNumber = maxTransfer
    ? parseInt(maxTransfer.transferNumber.slice(-4))
    : 0

  // 3. Increment and format
  const nextNumber = (lastNumber + 1).toString().padStart(4, '0')

  // 4. Return formatted number
  return `TRF-${currentYear}-${nextNumber}`
}
```

**Collision Handling:**
- Random offset (0-9) added to reduce concurrent collision risk
- Retry logic with exponential backoff (max 3 attempts)
- Handles Prisma P2002 (unique constraint violation) gracefully

---

## Transfer Lifecycle

### State Machine

Transfers follow a strict state machine with validation at each transition:

```
┌─────────────┐
│  REQUESTED  │ ← Initial state
└─────┬───────┘
      │
      ├───→ APPROVED ──→ IN_TRANSIT ──→ PARTIALLY_RECEIVED ──→ COMPLETED
      │                                                               ↓
      ├───→ REJECTED (terminal)                        (Can be reversed)
      │
      └───→ CANCELLED (terminal)
```

### Status Descriptions

| Status | Description | Allowed Actions | Who Can Act |
|--------|-------------|----------------|-------------|
| `REQUESTED` | Transfer created, awaiting approval | Approve, Reject, Cancel | Source: Approve/Reject<br>Requester: Cancel |
| `APPROVED` | Source approved, ready to ship | Ship, Cancel | Source: Ship<br>Requester: Cancel |
| `REJECTED` | Source denied request | None (terminal) | - |
| `IN_TRANSIT` | Shipped from source, in transit | Receive (full/partial) | Destination: Receive |
| `PARTIALLY_RECEIVED` | Some items received, awaiting rest | Receive remaining | Destination: Receive |
| `COMPLETED` | All items fully received | Reverse | Admin: Reverse |
| `CANCELLED` | Cancelled before shipment | None (terminal) | - |

### Workflow Steps

#### 1. Request Transfer (Destination User)

**Who:** User with membership in destination branch
**Permission:** `stock:write`

**Process:**
1. Validate source ≠ destination
2. Validate all products belong to tenant
3. Generate unique transfer number
4. Create `StockTransfer` with status `REQUESTED`
5. Create `StockTransferItem` entries with `qtyRequested`
6. Set `requestedByUserId`, `requestedAt`
7. Record `TRANSFER_REQUEST` audit event

**Result:** Transfer created, appears in source branch's "Inbound Approvals"

---

#### 2. Review Transfer (Source User)

**Who:** User with membership in source branch
**Permission:** `stock:write`

**Approve Process:**
1. Validate transfer is `REQUESTED`
2. Validate user is source branch member
3. Set `qtyApproved` for each item (can adjust down)
4. Update status to `APPROVED`
5. Set `reviewedByUserId`, `reviewedAt`
6. Record `TRANSFER_APPROVE` audit event

**Reject Process:**
1. Validate transfer is `REQUESTED`
2. Validate user is source branch member
3. Store `reviewNotes` (rejection reason)
4. Update status to `REJECTED`
5. Set `reviewedByUserId`, `reviewedAt`
6. Record `TRANSFER_REJECT` audit event

---

#### 3. Ship Transfer (Source User)

**Who:** User with membership in source branch
**Permission:** `stock:write`

**Process:**
1. Validate transfer is `APPROVED`
2. Validate user is source branch member
3. **For each item:**
   - Call `stockService.consumeStock()` with FIFO
   - Track consumed lots: `[{lotId, qty, unitCostPence}]`
   - Calculate weighted average cost
   - Update item:
     - `qtyShipped` = `qtyApproved`
     - `lotsConsumed` = JSON array of consumed lots
     - `avgUnitCostPence` = weighted average
4. Update transfer:
   - Status = `IN_TRANSIT`
   - `shippedByUserId`, `shippedAt`
5. Create `StockLedger` entries:
   - Kind = `CONSUMPTION`
   - Reason = "Transfer {transferNumber}"
6. Record `TRANSFER_SHIP` audit event

**FIFO Integration:**
```typescript
// Example: Ship 150 units from 3 lots
const lots = [
  { lotId: 'lot1', qtyRemaining: 100, unitCostPence: 1200 }, // Oldest
  { lotId: 'lot2', qtyRemaining: 200, unitCostPence: 1300 },
  { lotId: 'lot3', qtyRemaining: 150, unitCostPence: 1250 }
]

// FIFO consumption
lotsConsumed = [
  { lotId: 'lot1', qty: 100, unitCostPence: 1200 }, // Drain lot1
  { lotId: 'lot2', qty: 50, unitCostPence: 1300 }   // Partial lot2
]

// Weighted average: (100 × 1200 + 50 × 1300) / 150 = 1233 pence
avgUnitCostPence = 1233
```

---

#### 4. Receive Transfer (Destination User)

**Who:** User with membership in destination branch
**Permission:** `stock:write`

**Process:**
1. Validate transfer is `IN_TRANSIT` or `PARTIALLY_RECEIVED`
2. Validate user is destination branch member
3. Validate `qtyReceived` + new qty ≤ `qtyShipped`
4. **For each item:**
   - Call `stockService.receiveStock()` with transfer cost basis
   - Create `StockLot` at destination:
     - `unitCostPence` = item's `avgUnitCostPence`
     - `sourceRef` = transfer number
   - Update item: `qtyReceived` += received qty
5. Check if all items fully received:
   - **Yes** → status = `COMPLETED`, set `completedAt`
   - **No** → status = `PARTIALLY_RECEIVED`
6. Create `StockLedger` entries:
   - Kind = `RECEIPT`
   - Reason = "Transfer {transferNumber}"
7. Record `TRANSFER_RECEIVE` audit event

**Partial Receipt Example:**
```
Item: Product A
qtyRequested: 100
qtyApproved: 100
qtyShipped: 100

Receipt 1: Receive 70 units → qtyReceived = 70, status = PARTIALLY_RECEIVED
Receipt 2: Receive 30 units → qtyReceived = 100, status = COMPLETED
```

---

#### 5. Cancel Transfer (Requester or Destination User)

**Who:** User who created request OR destination branch member
**Permission:** `stock:write`

**Process:**
1. Validate transfer is `REQUESTED` or `APPROVED`
2. Validate user is requester OR destination member
3. Update status to `CANCELLED`
4. Record `TRANSFER_CANCEL` audit event

**Note:** Cannot cancel after shipment (IN_TRANSIT). Use reversal instead.

---

## Multi-Level Approval Workflow

### Overview

Multi-level approval enables complex authorization workflows beyond simple source-branch approval. Rules are evaluated conditionally based on transfer characteristics (value, quantity, branches, priority).

**Use Cases:**
- High-value transfers require finance director approval
- Transfers from warehouse to specific retail branches need regional manager approval
- Urgent transfers bypass normal approval and go straight to C-level
- Transfers involving controlled substances require compliance officer approval

### Architecture Components

#### 1. TransferApprovalRule

**Purpose:** Defines when multi-level approval is required and what levels are needed.

**Key Fields:**
- `name` - Rule display name (e.g., "High-Value Transfer Approval")
- `priority` - Evaluation order (higher priority rules checked first)
- `isActive` - Enable/disable rule without deletion
- `approvalMode` - SEQUENTIAL, PARALLEL, or HYBRID
- `conditions` - When this rule applies
- `levels` - Approval hierarchy required

**Approval Modes:**

| Mode | Description | Behavior |
|------|-------------|----------|
| `SEQUENTIAL` | Approvals must occur in level order | Level 1 → Level 2 → Level 3 |
| `PARALLEL` | All levels can approve simultaneously | Level 1, 2, 3 simultaneously |
| `HYBRID` | Level 1 first, then 2+ in parallel | Level 1 → (Level 2 & 3 simultaneously) |

---

#### 2. TransferApprovalCondition

**Purpose:** Defines trigger conditions for approval rules.

**Condition Types:**

| Type | Description | Example |
|------|-------------|---------|
| `TOTAL_QTY_THRESHOLD` | Total units across all items > X | Transfer qty > 1000 units |
| `TOTAL_VALUE_THRESHOLD` | Total value (qty × price) > X pence | Transfer value > £10,000 |
| `SOURCE_BRANCH` | Transfer from specific branch | From "Main Warehouse" |
| `DESTINATION_BRANCH` | Transfer to specific branch | To "Flagship Store" |
| `PRODUCT_CATEGORY` | Product has category X (future) | Category = "Controlled Substances" |

**Evaluation Logic:**
- All conditions in a rule must match (AND logic)
- First matching rule (by priority order) determines workflow
- If no rules match, transfer uses simple source-branch approval

**Example Rule:**
```json
{
  "name": "High-Value Transfer Approval",
  "priority": 100,
  "approvalMode": "SEQUENTIAL",
  "conditions": [
    {
      "conditionType": "TOTAL_VALUE_THRESHOLD",
      "threshold": 1000000  // £10,000 (in pence)
    }
  ],
  "levels": [
    {
      "level": 1,
      "name": "Warehouse Manager",
      "requiredRoleId": "role_warehouse_manager"
    },
    {
      "level": 2,
      "name": "Finance Director",
      "requiredUserId": "user_cfo"
    }
  ]
}
```

---

#### 3. TransferApprovalLevel

**Purpose:** Defines a single approval level in the hierarchy.

**Key Fields:**
- `level` - Numeric level (1, 2, 3, etc.)
- `name` - Display name (e.g., "Manager", "Director", "Finance")
- `requiredRoleId` - Any user with this role can approve (role-based)
- `requiredUserId` - Only this specific user can approve (user-based)

**Approval Authorization:**
- **Role-Based:** Any user with specified role can approve (e.g., any OWNER)
- **User-Based:** Only specific user can approve (e.g., CFO)
- Either `requiredRoleId` OR `requiredUserId` must be set (not both)

---

#### 4. TransferApprovalRecord

**Purpose:** Tracks approval status for each level of a transfer.

**Key Fields:**
- `transferId` - Transfer being approved
- `level` - Which approval level this is
- `levelName` - Display name from approval level
- `status` - PENDING, APPROVED, REJECTED, SKIPPED
- `requiredRoleId` / `requiredUserId` - Who can approve
- `approvedByUserId` - Who actually approved
- `approvedAt` - Approval timestamp
- `notes` - Approver notes/comments

**Lifecycle:**
1. Created when transfer triggers multi-level rule (all levels = PENDING)
2. Eligible approvers submit decisions
3. Status changes: PENDING → APPROVED or REJECTED
4. Transfer progresses only when all levels APPROVED

---

### Approval Workflow Execution

#### Rule Evaluation

**When:** Transfer is created (REQUESTED status)

**Process:**
```typescript
async function evaluateApprovalRules(transfer) {
  // 1. Query active rules ordered by priority (highest first)
  const rules = await prisma.transferApprovalRule.findMany({
    where: { tenantId, isActive: true },
    orderBy: { priority: 'desc' },
    include: { conditions: true, levels: true }
  })

  // 2. Evaluate each rule's conditions
  for (const rule of rules) {
    const matches = rule.conditions.every(condition => {
      switch (condition.conditionType) {
        case 'TOTAL_QTY_THRESHOLD':
          const totalQty = transfer.items.reduce((sum, item) => sum + item.qtyRequested, 0)
          return totalQty > condition.threshold

        case 'TOTAL_VALUE_THRESHOLD':
          const totalValue = transfer.items.reduce((sum, item) => {
            const product = getProduct(item.productId)
            return sum + (item.qtyRequested * product.productPricePence)
          }, 0)
          return totalValue > condition.threshold

        case 'SOURCE_BRANCH':
          return transfer.sourceBranchId === condition.branchId

        case 'DESTINATION_BRANCH':
          return transfer.destinationBranchId === condition.branchId

        default:
          return false
      }
    })

    // 3. If all conditions match, apply this rule
    if (matches) {
      await applyApprovalRule(transfer, rule)
      return
    }
  }

  // 4. No rules matched - use simple source-branch approval
  transfer.requiresMultiLevelApproval = false
}
```

#### Approval Submission

**Endpoint:** `POST /api/stock-transfers/:transferId/approval-levels/:level/approve`

**Process:**
```typescript
async function submitApprovalDecision({ transferId, level, decision, notes, userId }) {
  // 1. Find approval record
  const record = await prisma.transferApprovalRecord.findFirst({
    where: { transferId, level, status: 'PENDING' }
  })

  // 2. Validate approver authorization
  const user = await getUser(userId)
  const authorized =
    (record.requiredRoleId && user.roleId === record.requiredRoleId) ||
    (record.requiredUserId && user.id === record.requiredUserId)

  if (!authorized) throw Errors.permissionDenied('Not authorized to approve this level')

  // 3. Update approval record
  await prisma.transferApprovalRecord.update({
    where: { id: record.id },
    data: {
      status: decision, // APPROVED or REJECTED
      approvedByUserId: userId,
      approvedAt: new Date(),
      notes
    }
  })

  // 4. Check if all levels approved
  const allRecords = await prisma.transferApprovalRecord.findMany({
    where: { transferId }
  })

  const allApproved = allRecords.every(r => r.status === 'APPROVED')
  const anyRejected = allRecords.some(r => r.status === 'REJECTED')

  // 5. Update transfer status
  if (allApproved) {
    await prisma.stockTransfer.update({
      where: { id: transferId },
      data: { status: 'APPROVED' }
    })
  } else if (anyRejected) {
    await prisma.stockTransfer.update({
      where: { id: transferId },
      data: { status: 'REJECTED' }
    })
  }

  // 6. Record audit event
  await auditLogger.log({
    action: 'TRANSFER_APPROVE_LEVEL',
    entityType: 'TRANSFER_APPROVAL_RECORD',
    // ...
  })
}
```

#### Approval Progress Checking

**Endpoint:** `GET /api/stock-transfers/:transferId/approval-progress`

**Response:**
```json
{
  "success": true,
  "data": {
    "requiresMultiLevelApproval": true,
    "approvalMode": "SEQUENTIAL",
    "levels": [
      {
        "level": 1,
        "name": "Warehouse Manager",
        "status": "APPROVED",
        "requiredRole": "WAREHOUSE_MANAGER",
        "approvedBy": { "id": "user1", "name": "Alice" },
        "approvedAt": "2025-01-15T10:00:00Z"
      },
      {
        "level": 2,
        "name": "Finance Director",
        "status": "PENDING",
        "requiredUser": { "id": "user_cfo", "name": "Bob CFO" },
        "canApprove": false  // Current user cannot approve this level
      }
    ],
    "currentLevel": 2,
    "overallStatus": "PENDING_APPROVAL"
  }
}
```

---

## Transfer Templates

### Overview

Transfer templates enable users to save frequently-used transfer configurations for quick reuse, reducing manual entry for recurring transfers.

**Use Cases:**
- Weekly retail store restocking from warehouse
- Monthly transfers between distribution centers
- Seasonal product movements (e.g., summer goods to coastal branches)
- Standard emergency stock requests

### Template Structure

**Database Model:** `StockTransferTemplate`

**Key Fields:**
- `name` - Template display name (e.g., "Weekly Retail Restock")
- `description` - Optional purpose description
- `sourceBranchId` - Default source branch
- `destinationBranchId` - Default destination branch
- `isArchived` - Soft delete flag
- `archivedAt`, `archivedByUserId` - Archival metadata
- `items` - Array of `StockTransferTemplateItem`

**Template Items:**
```typescript
interface StockTransferTemplateItem {
  id: string
  templateId: string
  productId: string
  defaultQty: number  // Default quantity for this product
}
```

### Template Workflow

#### 1. Create Template

**From Scratch:**
```typescript
POST /api/stock-transfers/templates
{
  "name": "Weekly Retail Restock",
  "description": "Standard weekly transfer from warehouse to downtown store",
  "sourceBranchId": "branch_warehouse",
  "destinationBranchId": "branch_retail_downtown",
  "items": [
    { "productId": "product_coffee", "defaultQty": 100 },
    { "productId": "product_tea", "defaultQty": 50 },
    { "productId": "product_sugar", "defaultQty": 75 }
  ]
}
```

**From Existing Transfer:**
```typescript
POST /api/stock-transfers/:transferId/save-as-template
{
  "name": "Holiday Season Restock",
  "description": "Saved from TRF-2025-0042"
}
// Copies source, destination, and all items from transfer
```

#### 2. Use Template

```typescript
POST /api/stock-transfers/from-template/:templateId
{
  "requestNotes": "Week of 2025-01-20",
  "items": [  // Optional: Override default quantities
    { "productId": "product_coffee", "qtyRequested": 150 }  // Increase coffee
  ]
}
```

**Process:**
1. Fetch template with items
2. Create new transfer request:
   - Source/destination from template
   - Items with `defaultQty` (or overridden qty)
   - Generate new transfer number
3. Return created transfer

#### 3. Template Management

**List Templates:**
```typescript
GET /api/stock-transfers/templates?filter=active
// filter: "active" (default), "archived", "all"
```

**Edit Template:**
```typescript
PATCH /api/stock-transfers/templates/:templateId
{
  "name": "Updated Template Name",
  "items": [
    { "productId": "product_coffee", "defaultQty": 120 }  // Updated qty
  ]
}
```

**Archive Template (Soft Delete):**
```typescript
POST /api/stock-transfers/templates/:templateId/archive
```

**Restore Archived Template:**
```typescript
POST /api/stock-transfers/templates/:templateId/restore
```

### Template Archival Pattern

**Purpose:** Hide obsolete templates without losing historical data

**Use Cases:**
- Seasonal routes no longer needed
- Products discontinued
- Workflow changes make template irrelevant

**Behavior:**
- Archived templates hidden from active list by default
- Cannot be used to create new transfers when archived
- All historical data preserved with audit trail
- Can be restored anytime if needed

**Implementation:**
```typescript
// Archive
await prisma.stockTransferTemplate.update({
  where: { id: templateId },
  data: {
    isArchived: true,
    archivedAt: new Date(),
    archivedByUserId: currentUserId
  }
})

// Restore
await prisma.stockTransferTemplate.update({
  where: { id: templateId },
  data: {
    isArchived: false,
    archivedAt: null,
    archivedByUserId: null
  }
})

// Query active templates
const templates = await prisma.stockTransferTemplate.findMany({
  where: { tenantId, isArchived: false }
})
```

---

## Partial Shipment System

### Overview

Partial shipments allow source branches to ship less than the approved quantity in multiple batches when full shipment isn't possible immediately.

**Use Cases:**
- Stock shortage at source (can only ship available units)
- Phased transfers (ship as inventory arrives)
- Split shipments across multiple delivery vehicles
- Backorder scenarios

### Implementation

**Database Field:** `shipmentBatches` (JSON) on `StockTransferItem`

**Structure:**
```typescript
interface ShipmentBatch {
  batchNumber: number          // Sequential batch number (1, 2, 3...)
  qty: number                  // Quantity shipped in this batch
  shippedAt: string            // ISO timestamp
  shippedByUserId: string      // User who shipped this batch
  lotsConsumed: Array<{        // FIFO lots consumed in this batch
    lotId: string
    qty: number
    unitCostPence: number
  }>
}
```

### Workflow

#### 1. Initial Shipment (Partial)

**Request:**
```typescript
POST /api/stock-transfers/:transferId/ship
{
  "items": [
    {
      "itemId": "item1",
      "qtyToShip": 70  // Less than qtyApproved (100)
    }
  ]
}
```

**Process:**
1. Validate `qtyToShip` ≤ `qtyApproved`
2. FIFO consume 70 units from source
3. Calculate weighted average cost for this batch
4. Update item:
   - `qtyShipped` += 70
   - `shipmentBatches` = append new batch
5. Transfer status:
   - If all items partially shipped → `IN_TRANSIT`
   - If some items fully shipped, some pending → `PARTIALLY_SHIPPED` (future status)

**Item State After:**
```json
{
  "itemId": "item1",
  "qtyRequested": 100,
  "qtyApproved": 100,
  "qtyShipped": 70,
  "qtyReceived": 0,
  "shipmentBatches": [
    {
      "batchNumber": 1,
      "qty": 70,
      "shippedAt": "2025-01-15T14:00:00Z",
      "shippedByUserId": "user_alice",
      "lotsConsumed": [
        { "lotId": "lot1", "qty": 50, "unitCostPence": 1200 },
        { "lotId": "lot2", "qty": 20, "unitCostPence": 1150 }
      ]
    }
  ]
}
```

#### 2. Subsequent Shipment

**Request:**
```typescript
POST /api/stock-transfers/:transferId/ship
{
  "items": [
    {
      "itemId": "item1",
      "qtyToShip": 30  // Ship remaining 30 units
    }
  ]
}
```

**Process:**
1. Validate `qtyShipped` + `qtyToShip` ≤ `qtyApproved`
2. FIFO consume 30 units from source
3. Update item:
   - `qtyShipped` += 30 → 100 (now fully shipped)
   - `shipmentBatches` = append batch 2

**Item State After:**
```json
{
  "qtyShipped": 100,
  "shipmentBatches": [
    {
      "batchNumber": 1,
      "qty": 70,
      "shippedAt": "2025-01-15T14:00:00Z",
      "shippedByUserId": "user_alice",
      "lotsConsumed": [...]
    },
    {
      "batchNumber": 2,
      "qty": 30,
      "shippedAt": "2025-01-18T10:00:00Z",
      "shippedByUserId": "user_alice",
      "lotsConsumed": [
        { "lotId": "lot3", "qty": 30, "unitCostPence": 1180 }
      ]
    }
  ]
}
```

### Receiving Partial Shipments

**Destination receives batches as they arrive:**

```typescript
// Receive first batch (70 units)
POST /api/stock-transfers/:transferId/receive
{
  "items": [{ "itemId": "item1", "qtyReceived": 70 }]
}
// Transfer status → PARTIALLY_RECEIVED

// Receive second batch (30 units)
POST /api/stock-transfers/:transferId/receive
{
  "items": [{ "itemId": "item1", "qtyReceived": 30 }]
}
// Transfer status → COMPLETED (all items fully received)
```

### Weighted Average Cost Calculation

**With Partial Shipments:**
```typescript
// Batch 1: 70 units
const batch1Lots = [
  { qty: 50, unitCostPence: 1200 },
  { qty: 20, unitCostPence: 1150 }
]
const batch1AvgCost = (50 × 1200 + 20 × 1150) / 70 = 1186 pence

// Batch 2: 30 units
const batch2Lots = [
  { qty: 30, unitCostPence: 1180 }
]
const batch2AvgCost = 1180 pence

// Overall average for item
const overallAvgCost = (70 × 1186 + 30 × 1180) / 100 = 1184 pence
```

**Destination Lot Creation:**
- Each batch creates separate lot at destination
- Batch 1: Create lot with 70 units @ 1186 pence
- Batch 2: Create lot with 30 units @ 1180 pence
- Maintains granular cost tracking

---

## Transfer Reversal

### Overview

Transfer reversal allows completed transfers to be undone, restoring stock to source branch with FIFO lot restoration and complete audit trail.

**Use Cases:**
- Items damaged or lost during transit (discovered after receipt)
- Transfer created in error
- Destination received wrong products
- Quality control failure at destination

### Reversal Workflow

#### 1. Initiate Reversal

**Endpoint:** `POST /api/stock-transfers/:transferId/reverse`

**Permission:** `stock:write` + admin/OWNER role

**Request:**
```json
{
  "reason": "Items damaged during transit, need to restore source stock",
  "items": [
    {
      "itemId": "item1",
      "qtyToReverse": 100  // Can reverse full or partial quantity
    }
  ]
}
```

**Validations:**
1. Transfer must be `COMPLETED`
2. User must have admin privileges
3. `qtyToReverse` ≤ `qtyReceived` for each item
4. Destination must have sufficient stock

#### 2. Reversal Processing

**Process:**
```typescript
async function reverseStockTransfer({ transferId, reason, items }) {
  await prisma.$transaction(async (tx) => {
    // 1. Load original transfer
    const transfer = await tx.stockTransfer.findUnique({
      where: { id: transferId },
      include: { items: { include: { product: true } } }
    })

    // 2. Create reversal transfer
    const reversalNumber = await generateTransferNumber(tenantId, tx)
    const reversal = await tx.stockTransfer.create({
      data: {
        tenantId,
        transferNumber: reversalNumber,
        sourceBranchId: transfer.destinationBranchId,  // ← Swap
        destinationBranchId: transfer.sourceBranchId,  // ← Swap
        status: 'IN_TRANSIT',  // Auto-approved and shipped
        isReversal: true,
        reversalOfId: transfer.id,
        reversalReason: reason,
        requestedByUserId: currentUserId,
        reviewedByUserId: currentUserId,
        shippedByUserId: currentUserId,
        requestedAt: new Date(),
        reviewedAt: new Date(),
        shippedAt: new Date()
      }
    })

    // 3. Update original transfer
    await tx.stockTransfer.update({
      where: { id: transferId },
      data: { reversedById: reversal.id }
    })

    // 4. Process each item
    for (const item of items) {
      const originalItem = transfer.items.find(i => i.id === item.itemId)

      // 4a. Consume from destination (FIFO)
      const fifoResult = await consumeStock({
        tenantId,
        branchId: transfer.destinationBranchId,  // Original destination
        productId: originalItem.productId,
        qty: item.qtyToReverse,
        reason: `Reversal of transfer ${transfer.transferNumber}`,
        actorUserId: currentUserId
      }, tx)

      // 4b. Restore to source with ORIGINAL cost basis
      await receiveStock({
        tenantId,
        branchId: transfer.sourceBranchId,  // Original source
        productId: originalItem.productId,
        qty: item.qtyToReverse,
        unitCostPence: originalItem.avgUnitCostPence,  // ← Original cost
        sourceRef: `Reversal ${reversalNumber}`,
        occurredAt: new Date(),
        actorUserId: currentUserId
      }, tx)

      // 4c. Create reversal item
      await tx.stockTransferItem.create({
        data: {
          transferId: reversal.id,
          productId: originalItem.productId,
          qtyRequested: item.qtyToReverse,
          qtyApproved: item.qtyToReverse,
          qtyShipped: item.qtyToReverse,
          qtyReceived: 0,  // Will be received at source
          lotsConsumed: fifoResult.lotsConsumed,
          avgUnitCostPence: originalItem.avgUnitCostPence
        }
      })
    }

    // 5. Record audit events
    await auditLogger.log({
      action: 'TRANSFER_REVERSE',
      entityType: 'STOCK_TRANSFER',
      entityId: transfer.id,
      afterJson: {
        reversalTransferId: reversal.id,
        reversalNumber,
        reason
      }
    })

    // 6. Create stock ledger entries
    // REVERSAL ledger entries created by consumeStock/receiveStock with special kind
  }, { isolationLevel: 'Serializable' })
}
```

### FIFO Lot Restoration

**Challenge:** Restore original cost basis, not current destination costs

**Solution:** Use `avgUnitCostPence` from original transfer item

**Example:**
```typescript
// Original Transfer (TRF-2025-0042)
// Source consumed: 100 units @ avg 1200 pence
// Destination received: 100 units @ 1200 pence

// Reversal Transfer (TRF-2025-0091)
// Destination consumes: 100 units (FIFO from destination lots)
// Source receives: 100 units @ 1200 pence ← Original cost preserved
```

**Why This Works:**
- Maintains accounting accuracy (COGS unchanged)
- Prevents cost drift from multiple reversals
- Audit trail shows cost flow

### Reversal Audit Trail

**Events Created:**
1. `TRANSFER_REVERSE` on original transfer
2. `TRANSFER_REQUEST` on reversal transfer (auto-approved/shipped)
3. `STOCK_CONSUME` ledger entries at destination
4. `STOCK_RECEIPT` ledger entries at source
5. Both transfers linked via `reversalOfId` / `reversedById`

**Querying Reversals:**
```typescript
// Find all reversals for a transfer
const reversals = await prisma.stockTransfer.findMany({
  where: { reversalOfId: transferId }
})

// Check if transfer has been reversed
const transfer = await prisma.stockTransfer.findUnique({
  where: { id: transferId },
  include: { reversedBy: true }
})
if (transfer.reversedBy) {
  console.log(`Transfer reversed by ${transfer.reversedBy.transferNumber}`)
}
```

---

## Transfer Priority System

### Overview

Transfer priorities enable source branches to sequence shipments based on urgency, ensuring critical stock moves first.

**Priority Levels:**

| Priority | Use Case | SLA Target |
|----------|----------|------------|
| `URGENT` | Stock-out situation, immediate need | Ship within 2 hours |
| `HIGH` | Promotional event, expedited | Ship same day |
| `NORMAL` | Standard priority (default) | Ship within 2 business days |
| `LOW` | Seasonal overstock, can wait | Ship within 1 week |

### Implementation

**Database Field:** `priority` (Enum) on `StockTransfer`

**Default Value:** `NORMAL`

**Setting Priority:**
```typescript
// At creation
POST /api/stock-transfers
{
  "priority": "URGENT",
  "sourceBranchId": "...",
  "destinationBranchId": "...",
  "items": [...]
}

// Update after creation
PATCH /api/stock-transfers/:transferId/priority
{
  "priority": "HIGH",
  "reason": "Promotional event starting tomorrow"
}
```

### Priority-Based Querying

**List Transfers Sorted by Priority:**
```typescript
GET /api/stock-transfers?sortBy=priority&sortDir=desc

// Returns transfers ordered:
// 1. URGENT transfers
// 2. HIGH transfers
// 3. NORMAL transfers
// 4. LOW transfers
```

**Composite Index for Performance:**
```prisma
@@index([tenantId, status, priority, requestedAt])
```

**Query Pattern:**
```sql
SELECT * FROM StockTransfer
WHERE tenantId = ? AND status = 'APPROVED'
ORDER BY
  CASE priority
    WHEN 'URGENT' THEN 1
    WHEN 'HIGH' THEN 2
    WHEN 'NORMAL' THEN 3
    WHEN 'LOW' THEN 4
  END,
  requestedAt ASC  -- Within same priority, oldest first
```

### Priority Change Audit

**Audit Event:** `TRANSFER_PRIORITY_CHANGE`

**Tracking:**
```json
{
  "action": "TRANSFER_PRIORITY_CHANGE",
  "entityType": "STOCK_TRANSFER",
  "entityId": "transfer_id",
  "beforeJson": { "priority": "NORMAL" },
  "afterJson": { "priority": "URGENT", "reason": "Stock-out at retail store" },
  "actorUserId": "user_alice"
}
```

### UI Indicators

**Badge Colors:**
- URGENT: Red badge with icon
- HIGH: Orange badge
- NORMAL: Blue badge (default)
- LOW: Gray badge

**List Filtering:**
```typescript
GET /api/stock-transfers?priority=URGENT,HIGH
// Returns only urgent and high priority transfers
```

---

## Analytics & Metrics

### Overview

Transfer analytics provide insights into workflow efficiency, bottleneck detection, and branch dependency analysis through daily aggregated metrics.

### Metrics Tables

#### 1. TransferMetrics (Daily Aggregates)

**Purpose:** Track transfer volume and timing metrics per tenant per day

**Key Metrics:**
- **Volume Metrics:**
  - `transfersCreated` - Transfers created on this date
  - `transfersApproved` - Transfers approved
  - `transfersShipped` - Transfers shipped
  - `transfersCompleted` - Transfers completed
  - `transfersRejected` - Transfers rejected
  - `transfersCancelled` - Transfers cancelled

- **Timing Metrics (seconds):**
  - `avgApprovalTime` - REQUESTED → APPROVED
  - `avgShipTime` - APPROVED → IN_TRANSIT
  - `avgReceiveTime` - IN_TRANSIT → COMPLETED
  - `avgTotalTime` - REQUESTED → COMPLETED

**Example Record:**
```json
{
  "tenantId": "tenant_acme",
  "metricDate": "2025-01-15",
  "transfersCreated": 15,
  "transfersApproved": 12,
  "transfersShipped": 10,
  "transfersCompleted": 8,
  "transfersRejected": 2,
  "transfersCancelled": 1,
  "avgApprovalTime": 3600,      // 1 hour
  "avgShipTime": 7200,           // 2 hours
  "avgReceiveTime": 86400,       // 24 hours
  "avgTotalTime": 97200          // 27 hours total
}
```

**Aggregation Job:**
```typescript
// Run nightly at 2 AM
async function aggregateTransferMetrics(date: Date) {
  const transfers = await prisma.stockTransfer.findMany({
    where: {
      OR: [
        { requestedAt: { gte: startOfDay, lt: endOfDay } },
        { reviewedAt: { gte: startOfDay, lt: endOfDay } },
        { shippedAt: { gte: startOfDay, lt: endOfDay } },
        { completedAt: { gte: startOfDay, lt: endOfDay } }
      ]
    }
  })

  const metrics = {
    transfersCreated: transfers.filter(t =>
      isSameDay(t.requestedAt, date)).length,

    transfersApproved: transfers.filter(t =>
      t.status === 'APPROVED' && isSameDay(t.reviewedAt, date)).length,

    avgApprovalTime: calculateAverage(
      transfers
        .filter(t => t.reviewedAt && t.status === 'APPROVED')
        .map(t => differenceInSeconds(t.reviewedAt, t.requestedAt))
    ),

    // ... other metrics
  }

  await prisma.transferMetrics.upsert({
    where: { tenantId_metricDate: { tenantId, metricDate: date } },
    create: { tenantId, metricDate: date, ...metrics },
    update: metrics
  })
}
```

#### 2. TransferRouteMetrics (Branch Dependencies)

**Purpose:** Track transfer volume and completion times between specific branch pairs

**Key Metrics:**
- `sourceBranchId`, `destinationBranchId` - Route definition
- `transferCount` - Number of transfers on this route
- `totalUnits` - Total units transferred
- `avgCompletionTime` - Average REQUESTED → COMPLETED (seconds)

**Example Record:**
```json
{
  "tenantId": "tenant_acme",
  "sourceBranchId": "branch_warehouse",
  "destinationBranchId": "branch_retail_downtown",
  "metricDate": "2025-01-15",
  "transferCount": 5,
  "totalUnits": 850,
  "avgCompletionTime": 93600  // 26 hours average
}
```

**Use Cases:**
- **High-Volume Routes:** Identify busiest branch pairs
- **Bottleneck Detection:** Routes with high completion times
- **Network Visualization:** Sankey diagram or network graph
- **Route Optimization:** Allocate resources to high-volume routes

### Analytics Endpoints

#### Dashboard Summary
```typescript
GET /api/analytics/transfers/summary?from=2025-01-01&to=2025-01-31

Response:
{
  "totalTransfers": 450,
  "completedTransfers": 380,
  "avgCompletionTime": 91800,  // 25.5 hours
  "completionRate": 0.844,      // 84.4%
  "byStatus": {
    "COMPLETED": 380,
    "IN_TRANSIT": 40,
    "REQUESTED": 20,
    "REJECTED": 10
  },
  "byPriority": {
    "URGENT": 15,
    "HIGH": 85,
    "NORMAL": 320,
    "LOW": 30
  }
}
```

#### Bottleneck Analysis
```typescript
GET /api/analytics/transfers/bottlenecks?from=2025-01-01&to=2025-01-31

Response:
{
  "slowestRoutes": [
    {
      "sourceBranch": { "id": "...", "name": "Warehouse A" },
      "destinationBranch": { "id": "...", "name": "Retail Store 5" },
      "avgCompletionTime": 172800,  // 48 hours
      "transferCount": 25
    }
  ],
  "longApprovalTimes": [
    {
      "transferId": "...",
      "transferNumber": "TRF-2025-0123",
      "approvalTime": 86400,  // 24 hours to approve
      "status": "APPROVED"
    }
  ]
}
```

#### Route Network
```typescript
GET /api/analytics/transfers/routes?from=2025-01-01&to=2025-01-31

Response:
{
  "nodes": [
    { "id": "branch_warehouse", "name": "Main Warehouse", "type": "source" },
    { "id": "branch_retail_1", "name": "Downtown Store", "type": "destination" }
  ],
  "edges": [
    {
      "source": "branch_warehouse",
      "target": "branch_retail_1",
      "weight": 850,  // Total units
      "transferCount": 25
    }
  ]
}
```

### Analytics Visualization

**Recommended Charts:**
1. **Time Series:** Transfers created/completed over time
2. **Funnel Chart:** Workflow conversion (Requested → Approved → Shipped → Completed)
3. **Sankey Diagram:** Branch-to-branch flows
4. **Heatmap:** Transfer volume by day of week / hour of day
5. **Box Plot:** Completion time distribution by priority

---

## API Endpoints

**Base Path:** `/api/stock-transfers`

**Authentication:** All endpoints require authenticated user (`requireAuthenticatedUserMiddleware`)

**Permissions:**
- Read operations: `stock:read`
- Write operations: `stock:write`

### Transfer CRUD

| Method | Endpoint | Purpose | Permission |
|--------|----------|---------|------------|
| POST | `/api/stock-transfers` | Create transfer request | `stock:write` |
| GET | `/api/stock-transfers` | List transfers (filtered/paginated) | `stock:read` |
| GET | `/api/stock-transfers/:transferId` | Get transfer details | `stock:read` |
| PATCH | `/api/stock-transfers/:transferId/review` | Approve or reject | `stock:write` |
| POST | `/api/stock-transfers/:transferId/ship` | Ship transfer (FIFO) | `stock:write` |
| POST | `/api/stock-transfers/:transferId/receive` | Receive items | `stock:write` |
| DELETE | `/api/stock-transfers/:transferId` | Cancel transfer | `stock:write` |
| POST | `/api/stock-transfers/:transferId/reverse` | Reverse completed transfer | `stock:write` + admin |
| PATCH | `/api/stock-transfers/:transferId/priority` | Update priority | `stock:write` |

### Multi-Level Approval

| Method | Endpoint | Purpose | Permission |
|--------|----------|---------|------------|
| GET | `/api/stock-transfers/:transferId/approval-progress` | Get approval status | `stock:read` |
| POST | `/api/stock-transfers/:transferId/approval-levels/:level/approve` | Submit approval decision | `stock:write` |

### Templates

| Method | Endpoint | Purpose | Permission |
|--------|----------|---------|------------|
| GET | `/api/stock-transfers/templates` | List templates | `stock:read` |
| POST | `/api/stock-transfers/templates` | Create template | `stock:write` |
| GET | `/api/stock-transfers/templates/:templateId` | Get template details | `stock:read` |
| PATCH | `/api/stock-transfers/templates/:templateId` | Edit template | `stock:write` |
| POST | `/api/stock-transfers/templates/:templateId/archive` | Archive template | `stock:write` |
| POST | `/api/stock-transfers/templates/:templateId/restore` | Restore template | `stock:write` |
| POST | `/api/stock-transfers/from-template/:templateId` | Create transfer from template | `stock:write` |
| POST | `/api/stock-transfers/:transferId/save-as-template` | Save transfer as template | `stock:write` |

### Analytics

| Method | Endpoint | Purpose | Permission |
|--------|----------|---------|------------|
| GET | `/api/analytics/transfers/summary` | Dashboard summary | `reports:view` |
| GET | `/api/analytics/transfers/bottlenecks` | Bottleneck analysis | `reports:view` |
| GET | `/api/analytics/transfers/routes` | Route network data | `reports:view` |
| GET | `/api/analytics/transfers/trends` | Time-series trends | `reports:view` |

**See [Stock Transfers Feature Guide](../../SOP/stock-transfers-feature-guide.md) for detailed API documentation and request/response examples.**

---

## Service Layer Architecture

**Service Files:**
- `api-server/src/services/stockTransfers/stockTransferService.ts` - Core transfer operations
- `api-server/src/services/stockTransfers/transferHelpers.ts` - Utility functions
- `api-server/src/services/stockTransfers/approvalService.ts` - Multi-level approval logic
- `api-server/src/services/stockTransfers/templateService.ts` - Template management
- `api-server/src/services/stockTransfers/analyticsService.ts` - Metrics aggregation

### Core Service Functions

**Transfer Operations:**
- `generateTransferNumber(tenantId, tx?)` - Generate unique transfer numbers
- `createStockTransfer(params)` - Create transfer request with validation
- `reviewStockTransfer(params)` - Approve or reject transfer
- `shipStockTransfer(params)` - Ship with FIFO consumption
- `receiveStockTransfer(params)` - Receive items at destination
- `cancelStockTransfer(params)` - Cancel transfer (pre-shipment)
- `reverseStockTransfer(params)` - Reverse completed transfer
- `updateTransferPriority(params)` - Change transfer priority

**Query Functions:**
- `listStockTransfers(params)` - Filtered, paginated transfer list
- `getStockTransfer(transferId)` - Full transfer details with relations

**Helper Functions:**
- `calculateWeightedAvgCost(lotsConsumed)` - Weighted average from FIFO lots
- `extractLotsConsumed(fifoResult, lots)` - Map FIFO result to lot details
- `assertTransferAccess(params)` - Validate user branch access
- `assertBranchMembership(params)` - Validate specific branch membership

### Transaction Isolation

All transfer operations use **Serializable** isolation level to prevent race conditions:

```typescript
await prisma.$transaction(async (tx) => {
  // Transfer operations
}, { isolationLevel: 'Serializable' })
```

**Why Serializable?**
- Prevents concurrent stock consumption conflicts
- Ensures FIFO order consistency
- Prevents lost updates on aggregate stock levels
- Guarantees transfer number uniqueness

---

## Integration Points

### Stock Management Integration

**Consumes:**
- `stockService.consumeStock()` - FIFO consumption at source (ship)
- `stockService.receiveStock()` - Lot creation at destination (receive)

**Provides:**
- Transfer number in ledger `reason` field
- Cost basis for destination lots
- Audit trail linking transfers to stock movements

### RBAC Integration

**Permissions Required:**
- `stock:read` - View transfers
- `stock:write` - Create, review, ship, receive, cancel
- `branches:manage` - Override branch membership checks
- `reports:view` - Access analytics

**Branch Membership Enforcement:**
- Create: User must be member of destination branch
- Approve/Reject: User must be member of source branch
- Ship: User must be member of source branch
- Receive: User must be member of destination branch

### Audit Trail Integration

**Audit Events:**
- `TRANSFER_REQUEST` - Transfer created
- `TRANSFER_APPROVE` - Transfer approved
- `TRANSFER_REJECT` - Transfer rejected
- `TRANSFER_SHIP` - Transfer shipped
- `TRANSFER_RECEIVE` - Transfer received (full or partial)
- `TRANSFER_CANCEL` - Transfer cancelled
- `TRANSFER_REVERSE` - Transfer reversed
- `TRANSFER_APPROVE_LEVEL` - Multi-level approval submitted
- `TRANSFER_PRIORITY_CHANGE` - Priority updated
- `TRANSFER_SHIP_PARTIAL` - Partial shipment created

**Entity Types:**
- `STOCK_TRANSFER` - Transfer header changes
- `STOCK_TRANSFER_ITEM` - Line item changes
- `TRANSFER_APPROVAL_RECORD` - Approval decisions

### Frontend Integration

**Pages:**
- `/stock-transfers` - List page with filtering/sorting
- `/stock-transfers/:transferId` - Detail page with workflow actions
- `/stock-transfers/templates` - Template management

**Components:**
- `CreateTransferModal` - Transfer request form
- `ReviewTransferModal` - Approve/reject with qty adjustment
- `ReceiveTransferModal` - Partial receipt support
- `TransferWorkflowDiagram` - Visual status guide

---

**Last Updated:** 2025-10-19
**Document Version:** 1.0
**Related:** [Database Schema](../database-schema.md) | [Stock Management](../stock-management.md) | [Feature Guide](../../SOP/stock-transfers-feature-guide.md)
