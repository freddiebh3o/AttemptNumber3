# Stock Transfers Feature Guide

## Overview

The Stock Transfers feature enables users to transfer inventory between different branches/warehouses within the same tenant. This guide provides a comprehensive explanation of how the feature works from both a technical and user perspective.

**Status:** Phase 1 ✅ | Phase 2 ✅ | Phase 3 ✅ | Phase 4 ✅ | Phase 5 ✅ | Phase 6 ✅ | Phase 7 ✅ | Phase 8 ✅ | ✅ **PRODUCTION READY**

**Related Documents:**
- [Implementation Plan](../Tasks/stock_transfers_feature.md)
- [Stock Management System](../System/stock_management.md)
- [Database Schema Reference](../System/database_schema.md)

---

## Table of Contents

1. [Concept Overview](#concept-overview)
2. [User Workflows](#user-workflows)
3. [Technical Architecture](#technical-architecture)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Service Layer](#service-layer)
7. [Frontend Components](#frontend-components)
8. [Access Control](#access-control)
9. [FIFO Integration](#fifo-integration)
10. [Audit Trail](#audit-trail)
11. [Testing Strategy](#testing-strategy)
12. [Troubleshooting](#troubleshooting)

---

## Concept Overview

### What is a Stock Transfer?

A stock transfer is a formal workflow for moving inventory from one branch (source) to another branch (destination) within the same tenant. The transfer follows a multi-step approval workflow to ensure proper authorization and tracking.

### Why Use Stock Transfers?

- **Accountability:** Every transfer requires approval from the source branch
- **Traceability:** Complete audit trail from request to completion
- **Cost Accuracy:** Transfers preserve FIFO cost basis across branches
- **Inventory Visibility:** Real-time tracking of in-transit stock
- **Compliance:** Meets UK B2B warehouse best practices

### Key Characteristics

1. **Branch-to-Branch:** Transfers only occur within the same tenant
2. **Approval Workflow:** Multi-step process (Request → Approve → Ship → Receive)
3. **FIFO Preservation:** Cost basis maintained from source to destination
4. **Partial Support:** Can approve/receive less than requested
5. **Audit Trail:** Every state change and stock movement logged

---

## User Workflows

### Workflow 1: Request Transfer (Destination Branch User)

**Who:** User with membership in the destination branch
**When:** When stock is needed from another branch
**Permission Required:** `stock:write`

**Steps:**
1. Navigate to Stock Transfers page
2. Click "New Transfer Request"
3. Select source branch (where stock will come from)
4. Add products with requested quantities
5. Add optional request notes (e.g., "Stock running low at retail store")
6. Submit request

**Result:** Transfer created with status `REQUESTED`, awaiting source branch approval

---

### Workflow 2: Approve Transfer (Source Branch User)

**Who:** User with membership in the source branch
**When:** Source branch manager reviews incoming transfer requests
**Permission Required:** `stock:write`

**Steps:**
1. View transfer request in "Inbound Approvals" list
2. Review requested products and quantities
3. Check available stock at source branch
4. Decide to Approve or Reject:
   - **Approve:** Optionally adjust quantities (can approve less than requested)
   - **Reject:** Provide rejection reason in notes
5. Submit decision

**Result:**
- If approved: Transfer status → `APPROVED`, ready to ship
- If rejected: Transfer status → `REJECTED` (terminal state)

---

### Workflow 3: Ship Transfer (Source Branch User)

**Who:** User with membership in the source branch
**When:** After transfer is approved, ready to physically ship
**Permission Required:** `stock:write`

**Steps:**
1. View approved transfers in "Ready to Ship" list
2. Click "Ship Transfer"
3. Confirm shipment

**What Happens Behind the Scenes:**
1. System consumes stock from source branch using FIFO
2. Stock deducted from source `ProductStock` aggregate
3. `StockLot` entries at source depleted (oldest first)
4. `StockLedger` entries created with type `CONSUMPTION` and transfer number
5. Transfer status → `IN_TRANSIT`
6. Weighted average unit cost calculated and stored on transfer items

**Result:** Stock removed from source, transfer marked as in-transit

---

### Dispatch Note PDF Generation

**What:** Automatically generated PDF document when transfer is shipped
**Purpose:** Physical documentation for shipments, compliance, and audit trails

**Auto-Generation:**
When a transfer is shipped (status changes to `IN_TRANSIT`), the system automatically:
1. Generates a branded PDF dispatch note using Puppeteer
2. Uploads PDF to Supabase Storage (`stock-transfer-pdfs/{tenantId}/TRF-YYYY-NNNN.pdf`)
3. Saves public URL to `StockTransfer.dispatchNotePdfUrl`

**PDF Contents:**
- Transfer number and shipment date
- Source and destination branch details (name, address, phone)
- Complete list of shipped items (product name, SKU, quantity, lot numbers)
- Shipping user name and timestamp
- Tenant branding (logo, colors, company name)

**Viewing Dispatch Notes:**
- **Permission Required:** `stock:read`
- **Button Location:** Transfer detail page (appears after shipment)
- **Button Label:** "View Dispatch Note"
- **Display:** Opens modal with embedded PDF viewer
- **Actions Available:**
  - Download PDF (Content-Disposition: attachment)
  - Print PDF (triggers browser print dialog)
  - Close modal

**Regenerating PDFs:**
- **Permission Required:** `stock:write`
- **When to Use:** Template updated, branding changed, or data correction
- **Button Location:** Transfer detail page
- **Button Label:** "Regenerate PDF"
- **What Happens:** Generates new PDF from current transfer data, replaces old URL

**Storage & Access:**
- PDFs stored in Supabase Storage private bucket
- File path: `{tenantId}/TRF-{year}-{number}.pdf`
- Multi-tenant isolation enforced
- PDFs served through authenticated API endpoint
- CSP headers configured to allow iframe embedding

**Technical Details:**
- PDF generation adds ~1-3 seconds to shipment workflow
- Puppeteer launches headless Chrome for HTML→PDF conversion
- PDFs are immutable once generated (intentional for audit trail)
- Regenerate creates new PDF but doesn't preserve history

---

### Workflow 4: Receive Transfer (Destination Branch User)

**Who:** User with membership in the destination branch
**When:** Items arrive at destination branch
**Permission Required:** `stock:write`

**Steps:**
1. View in-transit transfers in "Awaiting Receipt" list
2. Click "Receive Items"
3. Enter quantities received for each product (can receive partial)
4. Submit receipt

**What Happens Behind the Scenes:**
1. System creates stock lots at destination with transfer cost basis
2. Stock added to destination `ProductStock` aggregate
3. New `StockLot` entries created at destination
4. `StockLedger` entries created with type `RECEIPT` and transfer number
5. Transfer status updated:
   - If all items fully received → `COMPLETED`
   - If partially received → `PARTIALLY_RECEIVED`

**Result:** Stock added to destination inventory, transfer progresses or completes

---

### Workflow 5: Cancel Transfer (Requester)

**Who:** User who created the request
**When:** Before transfer is approved
**Permission Required:** `stock:write`

**Steps:**
1. View transfer in `REQUESTED` status
2. Click "Cancel Transfer"
3. Confirm cancellation

**Result:** Transfer status → `CANCELLED` (terminal state), no stock movement occurs

---

## Technical Architecture

### State Machine

Stock transfers follow a strict state machine to ensure data integrity:

```
REQUESTED
  ├─> APPROVED ──> IN_TRANSIT ──> PARTIALLY_RECEIVED ──> COMPLETED
  ├─> REJECTED (terminal)
  └─> CANCELLED (terminal)
```

**State Descriptions:**

| Status | Description | Allowed Actions | Who Can Act |
|--------|-------------|----------------|-------------|
| `REQUESTED` | Initial state after creation | Approve, Reject, Cancel | Source branch users (approve/reject), Requester (cancel) |
| `APPROVED` | Source approved, ready to ship | Ship | Source branch users |
| `REJECTED` | Source denied request | None (terminal) | - |
| `IN_TRANSIT` | Shipped from source, awaiting receipt | Receive (full or partial) | Destination branch users |
| `PARTIALLY_RECEIVED` | Some items received | Receive remaining | Destination branch users |
| `COMPLETED` | All items fully received | None (terminal) | - |
| `CANCELLED` | Cancelled before approval | None (terminal) | - |

---

### Transfer Number Format

Each transfer gets a unique auto-generated number:

**Format:** `TRF-{YYYY}-{NNNN}`

**Example:** `TRF-2025-0042`

**Generation Logic:**
1. Query max transfer number for tenant
2. Extract numeric suffix
3. Increment by 1
4. Zero-pad to 4 digits
5. Combine with year prefix

---

## Database Schema

### Phase 1 Implementation ✅ COMPLETED

**Migration:** `20251012214357_add_stock_transfers`
**Migration File:** `api-server/prisma/migrations/20251012214357_add_stock_transfers/migration.sql`

#### New Enums

**StockTransferStatus:**
```prisma
enum StockTransferStatus {
  REQUESTED           // Initial state after creation
  APPROVED            // Source approved, ready to ship
  REJECTED            // Source denied (terminal)
  IN_TRANSIT          // Shipped from source
  PARTIALLY_RECEIVED  // Some items received
  COMPLETED           // All items received (terminal)
  CANCELLED           // Cancelled before approval (terminal)
}
```

#### New Tables

**StockTransfer:**
- **Purpose:** Primary entity representing the transfer workflow
- **Key Fields:**
  - `id` (String, PK) - CUID identifier
  - `tenantId` (String, FK → Tenant) - Multi-tenant isolation
  - `transferNumber` (String) - Human-readable ID (e.g., "TRF-2025-001")
  - `sourceBranchId` (String, FK → Branch) - Where stock comes from
  - `destinationBranchId` (String, FK → Branch) - Where stock goes to
  - `status` (StockTransferStatus) - Current workflow state
  - `requestedByUserId` (String, FK → User) - Transfer initiator
  - `reviewedByUserId` (String?, FK → User) - Approver/rejector
  - `shippedByUserId` (String?, FK → User) - Shipper
  - `requestedAt`, `reviewedAt`, `shippedAt`, `completedAt` (DateTime) - Workflow timestamps
  - `requestNotes`, `reviewNotes` (Text) - Context and rejection reasons
- **Indexes:**
  - `[tenantId, status, createdAt]` - List transfers by status
  - `[sourceBranchId, status]` - Outbound transfers for branch
  - `[destinationBranchId, status]` - Inbound transfers for branch
  - `[requestedByUserId]` - User's transfer history
- **Unique Constraint:** `[tenantId, transferNumber]` - Transfer numbers unique per tenant

**StockTransferItem:**
- **Purpose:** Line items for each product in the transfer
- **Key Fields:**
  - `id` (String, PK) - CUID identifier
  - `transferId` (String, FK → StockTransfer) - Parent transfer
  - `productId` (String, FK → Product) - Product being transferred
  - `qtyRequested` (Int) - Initial quantity requested
  - `qtyApproved` (Int?) - Approved quantity (may differ from requested)
  - `qtyShipped` (Int, default 0) - Actually shipped quantity
  - `qtyReceived` (Int, default 0) - Cumulatively received quantity
  - `lotsConsumed` (JSONB) - FIFO lots consumed: `[{lotId, qty, unitCostPence}]`
  - `avgUnitCostPence` (Int?) - Weighted average cost of shipped items
- **Indexes:**
  - `[productId]` - Find transfers for a product
- **Unique Constraint:** `[transferId, productId]` - One line item per product per transfer

#### Audit Enums

**New AuditAction values:**
- `TRANSFER_REQUEST` - Transfer created
- `TRANSFER_APPROVE` - Transfer approved
- `TRANSFER_REJECT` - Transfer rejected
- `TRANSFER_SHIP` - Transfer shipped (FIFO consumption occurred)
- `TRANSFER_RECEIVE` - Transfer received (full or partial)
- `TRANSFER_CANCEL` - Transfer cancelled

**New AuditEntityType values:**
- `STOCK_TRANSFER` - For transfer header changes
- `STOCK_TRANSFER_ITEM` - For line item changes

#### Seed Data

**Sample Transfers Created:**
1. **TRF-2025-001** (COMPLETED) - Warehouse → Retail #1
   - Product: Acme Anvil (SKU-001)
   - Qty: 50 units
   - Cost: 1200 pence/unit
   - Timeline: Requested 2025-01-15 → Completed 2025-01-16

2. **TRF-2025-002** (IN_TRANSIT) - Warehouse → Retail #1
   - Product: Acme Rocket Skates (SKU-002)
   - Qty: 30 units
   - Cost: 3500 pence/unit
   - Timeline: Requested 2025-01-20 → Shipped 2025-01-20 → Awaiting receipt

3. **TRF-2025-003** (REQUESTED) - Warehouse → Retail #1
   - Products: Anvil (100 units), Rocket Skates (75 units)
   - Timeline: Requested 2025-01-22 → Awaiting approval

#### Relations Added to Existing Models

**Tenant:**
```prisma
stockTransfers StockTransfer[]
```

**Branch:**
```prisma
transfersAsSource      StockTransfer[] @relation("TransferSource")
transfersAsDestination StockTransfer[] @relation("TransferDestination")
```

**User:**
```prisma
transfersRequested StockTransfer[] @relation("TransferRequester")
transfersReviewed  StockTransfer[] @relation("TransferReviewer")
transfersShipped   StockTransfer[] @relation("TransferShipper")
```

**Product:**
```prisma
transferItems StockTransferItem[]
```

---

## API Endpoints

### Phase 3 Implementation ✅ COMPLETED

**Router File:** `api-server/src/routes/stockTransfersRouter.ts`
**OpenAPI Schemas:** `api-server/src/openapi/paths/stockTransfers.ts`
**Registered In:** `api-server/src/routes/index.ts` (mounted at `/api/stock-transfers`)

#### Endpoint Summary

| Method | Endpoint | Purpose | Permission | Status Code |
|--------|----------|---------|------------|-------------|
| POST | `/api/stock-transfers` | Create transfer request | `stock:write` | 200 |
| GET | `/api/stock-transfers` | List transfers (filtered/paginated) | `stock:read` | 200 |
| GET | `/api/stock-transfers/:transferId` | Get transfer details | `stock:read` | 200 |
| PATCH | `/api/stock-transfers/:transferId/review` | Approve or reject transfer | `stock:write` | 200 |
| POST | `/api/stock-transfers/:transferId/ship` | Ship approved transfer (FIFO) | `stock:write` | 200 |
| POST | `/api/stock-transfers/:transferId/receive` | Receive items at destination | `stock:write` | 200 |
| DELETE | `/api/stock-transfers/:transferId` | Cancel transfer (REQUESTED only) | `stock:write` | 200 |

#### 1. POST `/api/stock-transfers` - Create Transfer Request

**Request Body:**
```json
{
  "sourceBranchId": "string",
  "destinationBranchId": "string",
  "requestNotes": "string (optional, max 1000 chars)",
  "items": [
    {
      "productId": "string",
      "qtyRequested": "number (min 1)"
    }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "transfer_id",
    "transferNumber": "TRF-2025-0042",
    "status": "REQUESTED",
    "sourceBranchId": "...",
    "destinationBranchId": "...",
    "requestedByUserId": "...",
    "requestedAt": "ISO_DATE",
    "items": [...],
    ...
  }
}
```

#### 2. GET `/api/stock-transfers` - List Transfers

**Query Parameters:**
- `branchId` (optional): Filter by specific branch
- `direction` (optional): `inbound` | `outbound` (relative to branchId)
- `status` (optional): Comma-separated list (e.g., "REQUESTED,APPROVED")
- `q` (optional): Search by transfer number (case-insensitive contains)
- `sortBy` (optional): `requestedAt` | `updatedAt` | `transferNumber` | `status` (default: `requestedAt`)
- `sortDir` (optional): `asc` | `desc` (default: `desc`)
- `requestedAtFrom` (optional): ISO date string - filter transfers requested after this date
- `requestedAtTo` (optional): ISO date string - filter transfers requested before this date
- `shippedAtFrom` (optional): ISO date string - filter transfers shipped after this date
- `shippedAtTo` (optional): ISO date string - filter transfers shipped before this date
- `limit` (optional): 1-100, default 20
- `cursor` (optional): Pagination cursor (transfer ID)
- `includeTotal` (optional): `true` | `false` - include total count in response (default: false)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "items": [ ...transfers... ],
    "pageInfo": {
      "hasNextPage": false,
      "nextCursor": null,
      "totalCount": 42  // Only present if includeTotal=true
    }
  }
}
```

**Filtering Behavior:**
- If `branchId` provided:
  - `direction=inbound` → transfers WHERE `destinationBranchId = branchId`
  - `direction=outbound` → transfers WHERE `sourceBranchId = branchId`
  - No direction → transfers WHERE source OR destination = branchId
- If `branchId` NOT provided:
  - Returns transfers where user is member of source OR destination branch

#### 3. GET `/api/stock-transfers/:transferId` - Get Transfer Details

**Response (200):**
Full transfer object with:
- All items with product details
- Source and destination branch details
- Requester, reviewer, shipper user details
- FIFO lot consumption details (if shipped)

#### 4. PATCH `/api/stock-transfers/:transferId/review` - Review Transfer

**Request Body:**
```json
{
  "action": "approve" | "reject",
  "reviewNotes": "string (optional, max 1000 chars)",
  "items": [ // Optional, only for approve
    {
      "itemId": "string",
      "qtyApproved": "number (min 0)" // 0 = don't ship this item
    }
  ]
}
```

**Notes:**
- If `items` not provided for approval, defaults to `qtyRequested` for all items
- If rejecting, `reviewNotes` recommended but optional
- Status changes: REQUESTED → APPROVED or REJECTED

#### 5. POST `/api/stock-transfers/:transferId/ship` - Ship Transfer

**Request Body:** None (empty POST)

**What Happens:**
1. Validates transfer is APPROVED
2. For each item, calls FIFO `consumeStock()` at source branch
3. Tracks consumed lots and calculates weighted average cost
4. Updates items with `qtyShipped`, `lotsConsumed`, `avgUnitCostPence`
5. Updates transfer status to IN_TRANSIT
6. Creates CONSUMPTION ledger entries with transfer number

**Response (200):**
Updated transfer with shipping details

#### 6. POST `/api/stock-transfers/:transferId/receive` - Receive Items

**Request Body:**
```json
{
  "items": [
    {
      "itemId": "string",
      "qtyReceived": "number (min 1)"
    }
  ]
}
```

**What Happens:**
1. Validates transfer is IN_TRANSIT or PARTIALLY_RECEIVED
2. Validates received quantities don't exceed shipped quantities
3. For each item, calls `receiveStock()` at destination with transfer cost basis
4. Updates items with incremented `qtyReceived`
5. Checks if all items fully received:
   - Yes → status = COMPLETED, set `completedAt`
   - No → status = PARTIALLY_RECEIVED
6. Creates RECEIPT ledger entries with transfer number

**Response (200):**
Updated transfer with receipt details

#### 7. DELETE `/api/stock-transfers/:transferId` - Cancel Transfer

**Notes:**
- Only allowed if status = REQUESTED
- User must be requester OR member of destination branch
- Updates status to CANCELLED
- No stock movements occur

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Transfer cancelled successfully"
  }
}
```

#### OpenAPI Integration

All endpoints are documented in OpenAPI spec at `/openapi.json`:
- Tag: `Stock Transfers`
- All request/response schemas defined with Zod
- Available in Swagger UI at `/docs`

#### Security & Access Control

- All endpoints require authentication (`requireAuthenticatedUserMiddleware`)
- Permissions:
  - `stock:read` for GET endpoints (list, get details)
  - `stock:write` for all mutating operations (create, review, ship, receive, cancel)
- Branch membership enforced at service layer:
  - Create: User must be member of destination branch
  - Review: User must be member of source branch
  - Ship: User must be member of source branch
  - Receive: User must be member of destination branch
  - Cancel: User must be requester OR member of destination branch

#### Error Handling

All endpoints use standard error envelope:
```json
{
  "success": false,
  "data": null,
  "error": {
    "errorCode": "VALIDATION_ERROR",
    "httpStatusCode": 400,
    "userFacingMessage": "...",
    "developerMessage": "...",
    "correlationId": "uuid"
  }
}
```

Common error scenarios:
- 400: Validation errors (invalid quantities, missing fields)
- 401: Not authenticated
- 403: Permission denied or branch membership violation
- 404: Transfer or item not found
- 409: Conflict (wrong status for operation, insufficient stock)

---

## Service Layer

### Phase 2 Implementation ✅ COMPLETED

**Service File:** `api-server/src/services/stockTransfers/stockTransferService.ts`
**Helpers File:** `api-server/src/services/stockTransfers/transferHelpers.ts`

#### Core Service Functions

**1. `generateTransferNumber(tenantId, tx?)`**
- Generates unique transfer numbers per tenant
- Format: `TRF-{YYYY}-{NNNN}`
- Increments based on existing transfers for the year
- Example: `TRF-2025-0042`

**2. `createStockTransfer(params)`**
- **Validates:** User is member of destination branch
- **Validates:** Source and destination branches are different
- **Validates:** All products exist and belong to tenant
- **Creates:** Transfer with REQUESTED status
- **Creates:** Transfer items with requested quantities
- **Audit:** Writes `TRANSFER_REQUEST` event

**3. `reviewStockTransfer(params)` (Approve/Reject)**
- **Validates:** User is member of source branch
- **Validates:** Transfer is in REQUESTED status
- **Approve:** Updates status to APPROVED, sets `qtyApproved` for each item
- **Reject:** Updates status to REJECTED, stores rejection reason
- **Audit:** Writes `TRANSFER_APPROVE` or `TRANSFER_REJECT` event

**4. `shipStockTransfer(params)`**
- **Validates:** User is member of source branch
- **Validates:** Transfer is in APPROVED status
- **Process:**
  1. For each item, calls `consumeStock()` with FIFO
  2. Tracks consumed lots: `[{lotId, qty, unitCostPence}]`
  3. Calculates weighted average unit cost
  4. Updates items with `qtyShipped`, `lotsConsumed`, `avgUnitCostPence`
  5. Updates transfer status to IN_TRANSIT
- **Transaction:** Serializable isolation level
- **Audit:** Writes `TRANSFER_SHIP` event + FIFO ledger entries

**5. `receiveStockTransfer(params)`**
- **Validates:** User is member of destination branch
- **Validates:** Transfer is IN_TRANSIT or PARTIALLY_RECEIVED
- **Validates:** Received quantities don't exceed shipped quantities
- **Process:**
  1. For each item, calls `receiveStock()` with transfer cost basis
  2. Updates items with incremented `qtyReceived`
  3. Checks if all items fully received → COMPLETED, else PARTIALLY_RECEIVED
- **Transaction:** Serializable isolation level
- **Audit:** Writes `TRANSFER_RECEIVE` event + receipt ledger entries

**6. `cancelStockTransfer(params)`**
- **Validates:** Transfer is in REQUESTED status only
- **Validates:** User is requester or member of destination branch
- **Updates:** Status to CANCELLED
- **Audit:** Writes `TRANSFER_CANCEL` event

**7. `listStockTransfers(params)`**
- **Filters:**
  - By user's branch memberships (inbound/outbound)
  - By specific branch + direction (inbound/outbound)
  - By status (comma-separated)
- **Pagination:** Cursor-based, limit 1-100 items
- **Returns:** Transfer list with items, branches, users

**8. `getStockTransfer(params)`**
- **Validates:** User has access (member of source or destination)
- **Returns:** Full transfer details with all relations

#### Helper Functions

**File:** `api-server/src/services/stockTransfers/transferHelpers.ts`

**`calculateWeightedAvgCost(lotsConsumed)`**
- Calculates weighted average from FIFO lots
- Formula: `Σ(qty × cost) / Σ(qty)`
- Returns rounded pence value

**`extractLotsConsumed(fifoResult, lots)`**
- Extracts lot consumption details from FIFO result
- Maps `{lotId, qty}` → `{lotId, qty, unitCostPence}`

**`assertTransferAccess(params)`**
- Checks user is member of source OR destination branch
- Throws `permissionDenied` if not

**`assertBranchMembership(params)`**
- Checks user is member of specific branch
- Throws `permissionDenied` with custom message if not

#### Audit Logger Integration

**File:** `api-server/src/services/auditLoggerService.ts`

Added whitelist cases for:
- `STOCK_TRANSFER` - Captures transfer header changes (status, actors, timestamps, notes)
- `STOCK_TRANSFER_ITEM` - Captures line item changes (quantities, costs)

All sensitive fields (passwords, tokens) automatically redacted

---

## Frontend Components

### Phase 4 Implementation ✅ COMPLETED

**Files Created:**
- `admin-web/src/api/stockTransfers.ts` - API client module
- `admin-web/src/pages/StockTransfersPage.tsx` - List page
- `admin-web/src/pages/StockTransferDetailPage.tsx` - Detail page
- `admin-web/src/components/stockTransfers/CreateTransferModal.tsx` - Create modal
- `admin-web/src/components/stockTransfers/ReviewTransferModal.tsx` - Review modal
- `admin-web/src/components/stockTransfers/ReceiveTransferModal.tsx` - Receive modal

**Files Modified:**
- `admin-web/src/main.tsx` - Routes registered
- `admin-web/src/components/shell/SidebarNav.tsx` - Navigation link added

#### API Client Module

**File:** `admin-web/src/api/stockTransfers.ts`

Type-safe API client with 7 functions:
- `listStockTransfersApiRequest(params?)` - List transfers with filtering
- `getStockTransferApiRequest(transferId)` - Get transfer details
- `createStockTransferApiRequest(data)` - Create transfer request
- `reviewStockTransferApiRequest(transferId, data)` - Approve or reject
- `shipStockTransferApiRequest(transferId)` - Ship transfer
- `receiveStockTransferApiRequest(transferId, data)` - Receive items
- `cancelStockTransferApiRequest(transferId)` - Cancel transfer

All functions use OpenAPI-derived types for full type safety.

#### Stock Transfers List Page

**Route:** `/:tenantSlug/stock-transfers`
**Permission:** `stock:read`

**Features:**
- **Tabs:** Inbound / Outbound (relative to user's branches)
- **Transfer Workflow Diagram:**
  - Collapsible visual helper showing all transfer statuses and transitions
  - Color-coded badges matching table (REQUESTED → APPROVED/REJECTED → IN_TRANSIT → PARTIAL/COMPLETED)
  - Tooltips explaining each status
  - Terminal states marked with icons (✓ COMPLETED, ✗ REJECTED, ⊗ CANCELLED)
  - Theme-aware (adapts to light/dark mode)
  - Smooth collapse animation
- **Advanced Filtering (FilterBar):**
  - Search by transfer number (text input, case-insensitive)
  - Status dropdown (all statuses available)
  - Requested date range (from/to date pickers)
  - Shipped date range (from/to date pickers)
  - Apply/Clear buttons
  - Keyboard support (Enter to apply filters)
- **Active Filter Chips:**
  - Visual badges showing currently applied filters
  - Individual clear buttons (X) on each chip
  - "Clear all" button when multiple filters active
- **Sortable Table Columns:**
  - Transfer Number (clickable, sortable)
  - Status (sortable)
  - Source Branch → Destination Branch
  - Item Count
  - Requested Date (sortable)
  - Sort indicators (↑/↓ arrows) on active column
- **Pagination:**
  - Cursor-based pagination (Prev/Next buttons)
  - Page number indicator
  - Per-page limit control (1-100 items, default 20)
  - Total count display (e.g., "Showing 15 of 42 transfers")
- **Additional Actions:**
  - "New Transfer Request" button (opens CreateTransferModal)
  - Refresh button
  - Copy shareable link button (URL includes all filters/sort/page state)
- **URL-Driven State:**
  - All filters, sorting, and pagination stored in URL query parameters
  - Shareable links with full state
  - Browser back/forward navigation support
  - State persists across page refreshes
- **Navigation:** Click row to view detail page

#### Stock Transfer Detail Page

**Route:** `/:tenantSlug/stock-transfers/:transferId`
**Permission:** `stock:read`

**Features:**
- **Header:**
  - Transfer Number
  - Status Badge
  - Timeline showing workflow progression
- **Branch Route:** Visual "Source → Destination" display
- **Items Table:**
  - Product name
  - Quantities: Requested / Approved / Shipped / Received
  - Progress bars showing completion
- **Context-Aware Actions:**
  - Approve / Reject (if REQUESTED and user in source branch)
  - Ship (if APPROVED and user in source branch)
  - Receive (if IN_TRANSIT and user in destination branch)
  - Cancel (if REQUESTED)
- **Notes Section:** Display request notes and review notes

#### Create Transfer Modal

**Trigger:** "New Transfer Request" button on list page

**Fields:**
- Source Branch (Select)
- Destination Branch (Select)
- Products (Dynamic list with Add/Remove)
  - Product (Select)
  - Quantity (Number input)
- Request Notes (Textarea, optional)

**Validation:**
- Source ≠ Destination
- At least 1 item required
- All quantities > 0

#### Review Transfer Modal

**Trigger:** "Approve" or "Reject" button on detail page

**Fields:**
- Action (Radio: Approve / Reject)
- If Approve:
  - Table showing each item with editable Qty Approved field
  - Default = Qty Requested
  - Can approve 0 (exclude item)
- Review Notes (Textarea, optional for approve, recommended for reject)

**Features:**
- Shows request notes for context
- Can approve partial quantities

#### Receive Transfer Modal

**Trigger:** "Receive Items" button on detail page

**Fields:**
- Table showing each item:
  - Product name
  - Qty Shipped
  - Qty Received so far
  - Progress bar
  - Qty to Receive Now (Number input, max = shipped - received)

**Features:**
- Supports partial receipt (can receive in multiple batches)
- Auto-filters out fully received items
- Shows remaining quantity validation

#### Navigation

**Location:** Sidebar (after Branches, before Audit Log)
**Label:** "Stock Transfers"
**Icon:** IconTruckDelivery (Tabler Icons)
**Visibility:** Only if user has `stock:read` permission

**All Navigation Icons (Phase 8):**
- Products: IconPackage
- Users: IconUsers
- Theme: IconPalette
- Roles: IconShield
- Branches: IconBuilding
- Audit Log: IconHistory
- Stock Transfers: IconTruckDelivery

All navigation items now have consistent iconography for better visual navigation.

---

## Access Control

### Branch Membership Enforcement

All transfer operations require appropriate branch membership:

**Create Request:**
- User must be member of destination branch
- Validates source and destination are different branches
- Validates both branches belong to same tenant

**Approve/Reject:**
- User must be member of source branch
- Only transfers in `REQUESTED` status can be reviewed

**Ship:**
- User must be member of source branch
- Only transfers in `APPROVED` status can be shipped
- User must have `UserBranchMembership` to consume stock

**Receive:**
- User must be member of destination branch
- Only transfers in `IN_TRANSIT` or `PARTIALLY_RECEIVED` can be received

**View Transfer:**
- User must be member of either source or destination branch
- OR user must have `branches:manage` permission (admin)

---

## FIFO Integration

### Cost Basis Preservation

Stock transfers preserve FIFO cost accounting:

**At Ship (Source):**
1. Call `consumeStock()` service for approved quantity
2. FIFO algorithm drains oldest lots first
3. Track consumed lots: `{ lotId, qty, unitCostPence }`
4. Calculate weighted average: `Σ(qty × cost) / Σ(qty)`
5. Store on transfer item: `lotsConsumed`, `avgUnitCostPence`

**At Receive (Destination):**
1. Call `receiveStock()` service for received quantity
2. Create new stock lot at destination
3. Use `avgUnitCostPence` from transfer item as lot cost
4. Set `receivedDate` to current timestamp

**Result:** Cost basis flows from source to destination, maintaining accurate COGS

---

## Audit Trail

Every transfer operation creates audit events:

| Action | Audit Entry | Snapshot Includes |
|--------|-------------|-------------------|
| Create | `TRANSFER_REQUEST` on `STOCK_TRANSFER` | Transfer number, branches, status, requester |
| Approve | `TRANSFER_APPROVE` on `STOCK_TRANSFER` | Reviewer, approved quantities, review timestamp |
| Reject | `TRANSFER_REJECT` on `STOCK_TRANSFER` | Reviewer, rejection notes, review timestamp |
| Ship | `TRANSFER_SHIP` on `STOCK_TRANSFER` | Shipper, shipped quantities, FIFO costs, ship timestamp |
| Receive | `TRANSFER_RECEIVE` on `STOCK_TRANSFER` | Received quantities, remaining quantities, completion status |
| Cancel | `TRANSFER_CANCEL` on `STOCK_TRANSFER` | Cancellation timestamp |

Additionally:
- `StockLedger` entries link back to transfer via `reason` field (e.g., "Transfer TRF-2025-001")
- Each API call has unique `correlationId` for request tracing

---

## Testing Strategy

### Phase 5 Implementation ✅ COMPLETED

**Test File:** `api-server/__tests__/services/stockTransfers.test.ts`
**Test Count:** 23 passing tests
**Test Coverage:** All critical workflows and edge cases

#### Test Suite Structure

**[AC-007-1] generateTransferNumber (2 tests)**
- ✅ Generates transfer number with correct format (TRF-YYYY-NNNN)
- ✅ Increments transfer numbers correctly

**[AC-007-2] createStockTransfer (4 tests)**
- ✅ Creates transfer request with REQUESTED status
- ✅ Rejects if source and destination are the same
- ✅ Rejects if user is not member of destination branch
- ✅ Rejects if no items provided

**[AC-007-3] reviewStockTransfer - Approve (4 tests)**
- ✅ Approves transfer and sets qtyApproved
- ✅ Defaults qtyApproved to qtyRequested if not provided
- ✅ Rejects if user is not member of source branch
- ✅ Rejects if transfer is not in REQUESTED status

**[AC-007-4] reviewStockTransfer - Reject (1 test)**
- ✅ Rejects transfer with reason

**[AC-007-5] shipStockTransfer - FIFO Integration (4 tests)**
- ✅ Ships transfer and consumes stock using FIFO
- ✅ Creates CONSUMPTION ledger entries with transfer number
- ✅ Rejects if insufficient stock at source
- ✅ Rejects if transfer is not APPROVED

**[AC-007-6] receiveStockTransfer (4 tests)**
- ✅ Receives transfer and creates stock lots at destination
- ✅ Supports partial receipt across multiple batches
- ✅ Rejects if receiving more than shipped
- ✅ Rejects if user is not member of destination branch

**[AC-007-7] cancelStockTransfer (2 tests)**
- ✅ Cancels transfer in REQUESTED status
- ✅ Rejects cancellation if not in REQUESTED status

**[AC-007-8] listStockTransfers (2 tests)**
- ✅ Lists transfers by direction (inbound/outbound)
- ✅ Filters by status correctly

#### Test Verification

All tests pass with proper:
- Database cleanup between tests
- Multi-tenant isolation
- FIFO cost tracking validation
- Branch membership enforcement
- State machine validation
- Audit trail verification

#### Manual Testing

✅ Complete end-to-end workflow tested manually:
- User successfully transferred stock from warehouse to retail store
- FIFO consumption worked correctly
- Cost basis preserved across branches
- All state transitions functioned as expected

---

## Troubleshooting

### Common Issues

#### Issue: "Insufficient stock to ship transfer"

**Cause:** Source branch doesn't have enough stock to fulfill approved quantities

**Solution:**
1. Check available stock at source: `GET /api/products/{productId}/stock?branchId={sourceBranchId}`
2. Reduce approved quantities in transfer review
3. Receive more stock at source before shipping
4. Or: Implement partial shipment feature (future enhancement)

---

#### Issue: "Permission denied" when approving transfer

**Cause:** User is not a member of the source branch

**Solution:**
1. Verify user has `UserBranchMembership` for source branch
2. Check user's role has `stock:write` permission
3. Admin can use `branches:manage` to override

---

#### Issue: "Cannot receive more than shipped quantity"

**Cause:** Attempted to receive more items than were shipped

**Solution:**
1. Check `qtyShipped` vs `qtyReceived` on transfer item
2. Frontend should enforce max input validation
3. Only allow receiving: `qtyShipped - qtyReceived`

---

#### Issue: Transfer stuck in `IN_TRANSIT`

**Cause:** Items shipped but never fully received at destination

**Solution:**
1. Check if partial receipt occurred: `qtyReceived < qtyShipped`
2. Destination user should complete receipt
3. For lost/damaged items: Manual adjustment at destination (future: add "Transfer Loss" flow)

---

## Transfer Templates

Transfer templates allow users to save frequently-used transfer configurations for quick reuse.

**Key Features:**
- Create templates with predefined source/destination branches and product lists
- Edit templates to update products and quantities
- Duplicate templates for similar routes
- Archive obsolete templates (soft delete - preserves history, can restore)
- Filter templates: active-only (default), archived-only, all

**Template Archival:**
- Archive templates when they become obsolete (seasonal routes, discontinued products, workflow changes)
- Archived templates are hidden from active list and cannot be used to create new transfers
- All historical data preserved with audit trail (archivedAt, archivedByUserId)
- Restore archived templates anytime if needed
- Permission required: `stock:write`

**Database Fields:**
- `isArchived` (Boolean, default false)
- `archivedAt` (DateTime, nullable)
- `archivedByUserId` (String, nullable, FK → User)
- Index: `[tenantId, isArchived]` for filtering performance

**User Documentation:** See [docs/stock-transfers/transfer-templates.md](../../docs/stock-transfers/transfer-templates.md)

---

## Future Enhancements

*(From Implementation Plan - Out of Scope)*

1. Multi-product FIFO optimization
2. ~~Transfer templates~~ ✅ **IMPLEMENTED** (with archival support)
3. Recurring transfers
4. Multi-level approval workflow
5. In-transit tracking with logistics providers
6. Cost override capability
7. ~~Transfer reversal~~ ✅ **IMPLEMENTED**
8. Bulk receive via barcode scanning
9. ~~Transfer analytics dashboards~~ ✅ **IMPLEMENTED**
10. Email notifications
11. ~~Transfer prioritization~~ ✅ **IMPLEMENTED**
12. ~~Partial shipment support~~ ✅ **IMPLEMENTED**

---

## Change Log

### 2025-10-19 - Transfer Template Archival (Phase 5)
- ✅ Implemented transfer template soft delete (archive/restore)
- ✅ Added `isArchived`, `archivedAt`, `archivedByUserId` fields to StockTransferTemplate model
- ✅ Backend: Archive and restore API endpoints with validation
- ✅ Frontend: Archive filter dropdown (active-only, archived-only, all)
- ✅ Frontend: Archive/restore buttons with confirmation modals
- ✅ Frontend: Template edit functionality (bonus feature)
- ✅ E2E Tests: 11 comprehensive Playwright tests
- ✅ Documentation: User guide and SOP updates
- ✅ Route consistency: Moved to `/stock-transfers/templates`
- Migration: `20251019182901_add_transfer_template_archival`

### 2025-10-13 - Phases 6, 7, 8 Completion & Production Ready
- ✅ Completed Phase 6: Advanced Filtering & Sorting (Backend)
- ✅ Completed Phase 7: Advanced Filtering & Sorting (Frontend)
- ✅ Completed Phase 8: UX Enhancements & Bug Fixes

**Phase 6 - Backend Enhancements:**
- Updated `stockTransferService.ts` to support comprehensive filtering:
  - Search by transfer number (case-insensitive)
  - Sort by: requestedAt, updatedAt, transferNumber, status
  - Sort direction: asc/desc
  - Date range filters: requestedAtFrom/To, shippedAtFrom/To
  - Optional total count for pagination UI
- Updated `stockTransfersRouter.ts` to parse all new query parameters
- Updated OpenAPI schema with new filter/sort parameters and totalCount response field
- All backend changes tested and type-checked successfully

**Phase 7 - Frontend Complete Rewrite:**
- Completely rewrote `StockTransfersPage.tsx` with advanced features:
  - URL-driven state management (all filters/sort/page in URL)
  - FilterBar integration with 6 filter inputs
  - Active filter chips with individual clear buttons
  - Sortable table headers (Transfer #, Status, Requested Date)
  - Cursor-based pagination with Prev/Next controls
  - Per-page limit control (1-100, default 20)
  - Total count display
  - Copy shareable link button
  - Browser back/forward navigation support
- Updated `stockTransfers.ts` API client with all new parameters
- Fixed DatePickerInput TypeScript type handling
- Achieved feature parity with Products/Users pages

**Phase 8 - UX Polish & Critical Fixes:**
- Added icons to all navigation items (Products, Users, Theme, Roles, Branches, Audit Log, Stock Transfers)
- Created visual Transfer Workflow diagram:
  - Shows all statuses and transitions with tooltips
  - Color-coded badges matching table
  - Terminal states marked with icons (✓ ✗ ⊗)
  - Collapsible with smooth animation (Show/Hide button)
  - Theme-aware (light/dark mode compatible)
- Added terminal state icons to transfer table badges
- Fixed critical bug: Transfer number race condition
  - Implemented random offset (0-9) to reduce collisions
  - Added retry logic with exponential backoff (max 3 attempts)
  - Handles Prisma P2002 errors gracefully
  - No user-facing errors for concurrent requests
- All features tested and working in both light and dark themes

**Summary:**
Stock Transfers feature now has:
- ✅ Complete CRUD operations with approval workflow
- ✅ FIFO cost preservation across branches
- ✅ Advanced filtering, sorting, and pagination
- ✅ Professional UX with visual workflow helper
- ✅ Theme support (light/dark modes)
- ✅ URL-driven state for shareable links
- ✅ Production-ready bug fixes
- ✅ Feature parity with Products/Users pages
- **🎉 PRODUCTION READY - All 8 Phases Complete**

### 2025-10-12 - Phase 5 Completion & Feature Complete
- ✅ Completed Phase 5: Testing
- Created comprehensive test suite with 23 passing tests
- Test file: `api-server/__tests__/services/stockTransfers.test.ts`
- Test coverage includes:
  - Transfer number generation and incrementing
  - Create transfer with all validations
  - Approve/reject workflow with partial quantities
  - Ship transfer with FIFO integration and ledger entries
  - Receive transfer with partial receipt support
  - Cancel transfer with status validation
  - List and filter transfers by direction and status
- Fixed database cleanup order to include stock transfer tables
- All tests passing with proper isolation and cleanup
- Manual end-to-end testing confirmed working
- **🎉 FEATURE COMPLETE - Ready for Production**

### 2025-10-12 - Phase 4 Completion
- ✅ Completed Phase 4: Frontend Implementation
- Created complete UI with 6 new files:
  - API client module with type-safe functions
  - Stock Transfers List Page (with tabs and filters)
  - Stock Transfer Detail Page (with timeline and context-aware actions)
  - Create Transfer Modal (product selector, branch selection)
  - Review Transfer Modal (approve/reject with qty adjustment)
  - Receive Transfer Modal (partial receipt support)
- Modified 2 files:
  - Registered routes in main router
  - Added navigation link to sidebar
- Features implemented:
  - Inbound/Outbound tabs for branch-specific views
  - Status-based filtering (7 statuses)
  - Context-aware action buttons (based on transfer status and branch membership)
  - Progress bars showing transfer completion
  - Timeline visualization of workflow
  - Partial approval and partial receipt support
  - Full type safety with OpenAPI-derived types
  - Loading states and error handling
  - Permission-based UI visibility
- All components follow existing codebase patterns
- Responsive design using Mantine UI components

### 2025-10-12 - Phase 3 Completion
- ✅ Completed Phase 3: API Layer
- Created `stockTransfersRouter.ts` with 7 endpoints:
  - POST /api/stock-transfers (create request)
  - GET /api/stock-transfers (list with filters/pagination)
  - GET /api/stock-transfers/:transferId (get details)
  - PATCH /api/stock-transfers/:transferId/review (approve/reject)
  - POST /api/stock-transfers/:transferId/ship (ship with FIFO)
  - POST /api/stock-transfers/:transferId/receive (receive items)
  - DELETE /api/stock-transfers/:transferId (cancel)
- Created OpenAPI schemas in `stockTransfers.ts`:
  - Defined all request/response schemas with Zod
  - Registered all paths in OpenAPI registry
  - Added "Stock Transfers" tag to spec
- Router registered at `/api/stock-transfers` in routes/index.ts
- All endpoints follow standard patterns:
  - Authentication required
  - Permission enforcement (`stock:read` or `stock:write`)
  - Standard success/error envelope
  - Correlation IDs for tracing
  - Audit context propagation
- Type-safe with TypeScript (all typecheck errors resolved)
- Comprehensive API documentation in this guide

### 2025-10-12 - Phase 2 Completion
- ✅ Completed Phase 2: Backend Services
- Implemented `stockTransferService.ts` with 8 core functions:
  - generateTransferNumber, createStockTransfer, reviewStockTransfer
  - shipStockTransfer (with FIFO integration), receiveStockTransfer
  - cancelStockTransfer, listStockTransfers, getStockTransfer
- Implemented `transferHelpers.ts` with 4 utility functions
- Updated audit logger to whitelist STOCK_TRANSFER and STOCK_TRANSFER_ITEM
- Full FIFO cost preservation: weighted average calculation, lot tracking
- Serializable transactions for ship and receive operations
- Comprehensive validation and access control enforcement

### 2025-10-12 - Phase 1 Completion
- ✅ Completed Phase 1: Database Schema & Migration
- Created migration `20251012214357_add_stock_transfers`
- Added `StockTransfer` and `StockTransferItem` models
- Added `StockTransferStatus` enum with 7 states
- Added 6 new audit actions and 2 new audit entity types
- Updated seed data with 3 sample transfers
- Added relations to Tenant, Branch, User, and Product models
- Comprehensive documentation of database schema

### 2025-10-12 - Initial Creation
- Created SOP document structure
- Documented Phase 1 database schema design
- Added user workflows and state machine
- Added access control and FIFO integration overview

---

**Last Updated:** 2025-10-13
**Document Version:** 2.0 (All 8 Phases Complete)
**Feature Status:** Phase 1 ✅ | Phase 2 ✅ | Phase 3 ✅ | Phase 4 ✅ | Phase 5 ✅ | Phase 6 ✅ | Phase 7 ✅ | Phase 8 ✅ | ✅ **PRODUCTION READY**
