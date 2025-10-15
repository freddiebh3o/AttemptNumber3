# Database Schema Reference

## Overview

PostgreSQL database managed by Prisma ORM with multi-tenant row-level isolation.

**Schema Location:** `api-server/prisma/schema.prisma`

---

## Entity Relationship Diagram (ERD)

```
┌──────────────────────────────────────────────────────────────────┐
│                        Global Entities                           │
└──────────────────────────────────────────────────────────────────┘

                        ┌────────────┐
                        │   User     │ (Global - can belong to many tenants)
                        ├────────────┤
                        │ id         │ PK
                        │ email      │ UNIQUE
                        │ password   │
                        └──────┬─────┘
                               │
                               │ 1:N
                               ↓
                   ┌───────────────────────┐
                   │ UserTenantMembership  │
                   ├───────────────────────┤
                   │ id                    │ PK
                   │ userId                │ FK → User
                   │ tenantId              │ FK → Tenant
                   │ roleId                │ FK → Role
                   └───────────┬───────────┘
                               │
                               │ N:1
                               ↓
                        ┌────────────┐
                        │   Tenant   │ (Tenant - organization)
                        ├────────────┤
                        │ id         │ PK
                        │ slug       │ UNIQUE
                        │ name       │
                        └──────┬─────┘
                               │
                ┌──────────────┼──────────────┬──────────────┬───────────┐
                │              │              │              │           │
                │ 1:N          │ 1:N          │ 1:N          │ 1:N       │ 1:1
                ↓              ↓              ↓              ↓           ↓
          ┌─────────┐    ┌─────────┐    ┌─────────┐   ┌──────────┐  ┌──────────────┐
          │ Product │    │ Branch  │    │  Role   │   │AuditEvent│  │TenantBranding│
          ├─────────┤    ├─────────┤    ├─────────┤   ├──────────┤  ├──────────────┤
          │ id      │    │ id      │    │ id      │   │ id       │  │ tenantId (PK)│
          │tenantId │    │tenantId │    │tenantId │   │tenantId  │  │ presetKey    │
          │ sku     │    │ slug    │    │ name    │   │entityType│  │ overridesJson│
          │ name    │    │ name    │    │isSystem │   │ action   │  │ logoUrl      │
          │pricePence│   │isActive │    └────┬────┘   │actorId   │  └──────────────┘
          │version  │    └────┬────┘         │        │beforeJson│
          └────┬────┘         │              │        │afterJson │
               │              │              │ N:M    └──────────┘
               │ 1:N          │ 1:N          ↓
               ↓              ↓         ┌───────────────┐
       ┌──────────────┐  ┌──────────────┐  │RolePermission│
       │ ProductStock │  │UserBranchMem │  ├──────────────┤
       ├──────────────┤  ├──────────────┤  │ roleId       │ FK → Role
       │ id           │  │ id           │  │permissionId  │ FK → Permission
       │ tenantId     │  │ userId       │  └──────────────┘
       │ branchId     │  │ tenantId     │         ↓
       │ productId    │  │ branchId     │    ┌────────────┐
       │ qtyOnHand    │  └──────────────┘    │ Permission │ (Global catalog)
       │qtyAllocated  │                      ├────────────┤
       └──────────────┘                      │ id         │ PK
               │                             │ key        │ UNIQUE
               │ 1:N                         │description │
               ↓                             └────────────┘
       ┌──────────────┐
       │  StockLot    │ (FIFO lots)
       ├──────────────┤
       │ id           │
       │ tenantId     │
       │ branchId     │
       │ productId    │
       │qtyReceived   │
       │qtyRemaining  │
       │unitCostPence │
       │receivedAt    │
       └──────┬───────┘
              │
              │ 1:N
              ↓
       ┌──────────────┐
       │ StockLedger  │ (Append-only log)
       ├──────────────┤
       │ id           │
       │ tenantId     │
       │ branchId     │
       │ productId    │
       │ lotId        │ FK → StockLot (nullable)
       │ kind         │ ENUM (RECEIPT, CONSUMPTION, ADJUSTMENT, REVERSAL)
       │ qtyDelta     │ (+/-)
       │ reason       │
       │ actorUserId  │
       │ occurredAt   │
       └──────────────┘
```

---

## Core Tables

### 1. User (Global)

**Purpose:** Global user accounts that can belong to multiple tenants.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PK | Unique user identifier |
| `userEmailAddress` | String | UNIQUE, NOT NULL | Email for sign-in |
| `userHashedPassword` | String | NOT NULL | bcrypt hashed password |
| `createdAt` | DateTime | DEFAULT now() | Account creation timestamp |
| `updatedAt` | DateTime | AUTO UPDATE | Last modification timestamp |

**Indexes:**
- `@@index([createdAt])`
- `@@index([updatedAt])`

**Relations:**
- `memberships` → UserTenantMembership[] (tenant memberships)
- `branchMemberships` → UserBranchMembership[] (branch assignments)
- `stockLedgerEvents` → StockLedger[] (stock actions performed)
- `auditEvents` → AuditEvent[] (audit trail as actor)

---

### 2. Tenant

**Purpose:** Organization/company entity. Top-level isolation boundary.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PK | Unique tenant identifier |
| `tenantSlug` | String | UNIQUE, NOT NULL | URL-safe identifier (e.g., "acme-corp") |
| `tenantName` | String | NOT NULL | Display name (e.g., "Acme Corporation") |
| `createdAt` | DateTime | DEFAULT now() | Tenant creation timestamp |
| `updatedAt` | DateTime | AUTO UPDATE | Last modification timestamp |

**Relations:**
- `memberships` → UserTenantMembership[] (users in this tenant)
- `products` → Product[] (tenant's products)
- `branches` → Branch[] (tenant's locations)
- `roles` → Role[] (custom roles)
- `branding` → TenantBranding? (theme configuration)
- `auditEvents` → AuditEvent[] (audit trail)

---

### 3. UserTenantMembership (Join Table)

**Purpose:** Links users to tenants with role assignment.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PK | Unique membership identifier |
| `userId` | String | FK → User, NOT NULL | User reference |
| `tenantId` | String | FK → Tenant, NOT NULL | Tenant reference |
| `roleId` | String | FK → Role, NOT NULL | Assigned role |
| `createdAt` | DateTime | DEFAULT now() | Membership creation timestamp |
| `updatedAt` | DateTime | AUTO UPDATE | Last modification timestamp |

**Unique Constraints:**
- `@@unique([userId, tenantId])` - User can only belong to tenant once

**Indexes:**
- `@@index([roleId])`

**Relations:**
- `user` → User
- `tenant` → Tenant
- `role` → Role

---

### 4. Permission (Global Catalog)

**Purpose:** Global catalog of permission keys used across all tenants.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PK | Unique permission identifier |
| `key` | String | UNIQUE, NOT NULL | Machine-readable key (e.g., "products:read") |
| `description` | String | NOT NULL | Human-readable description |
| `createdAt` | DateTime | DEFAULT now() | Permission creation timestamp |
| `updatedAt` | DateTime | AUTO UPDATE | Last modification timestamp |

**Relations:**
- `roles` → RolePermission[] (roles with this permission)

**Example Permissions:**
```typescript
{
  key: 'products:read',
  description: 'View products'
},
{
  key: 'products:write',
  description: 'Create/update/delete products'
},
{
  key: 'users:manage',
  description: 'Invite or manage tenant users'
}
```

---

### 5. Role

**Purpose:** Custom roles per tenant with permission assignments.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PK | Unique role identifier |
| `tenantId` | String | FK → Tenant, NULLABLE | Tenant scope (null = global template) |
| `name` | String | NOT NULL | Role name (e.g., "OWNER", "Catalog Editor") |
| `description` | String | NULLABLE | Role purpose description |
| `isSystem` | Boolean | DEFAULT false | Seeded system roles (OWNER, ADMIN, etc.) |
| `createdAt` | DateTime | DEFAULT now() | Role creation timestamp |
| `updatedAt` | DateTime | AUTO UPDATE | Last modification timestamp |

**Unique Constraints:**
- `@@unique([tenantId, name])` - Role name unique per tenant

**Indexes:**
- `@@index([tenantId])`

**Relations:**
- `tenant` → Tenant? (nullable for global templates)
- `permissions` → RolePermission[] (assigned permissions)
- `memberships` → UserTenantMembership[] (users with this role)

**System Roles:**
- `OWNER` - Full access (12 permissions)
- `ADMIN` - Manage users and operations (10 permissions)
- `EDITOR` - Edit products and allocate stock (5 permissions)
- `VIEWER` - Read-only access (2 permissions)

---

### 6. RolePermission (Join Table)

**Purpose:** Many-to-many mapping between roles and permissions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `roleId` | String | FK → Role, PK | Role reference |
| `permissionId` | String | FK → Permission, PK | Permission reference |

**Composite Primary Key:**
- `@@id([roleId, permissionId])`

**Indexes:**
- `@@index([permissionId])`

**Relations:**
- `role` → Role (onDelete: Cascade)
- `permission` → Permission (onDelete: Cascade)

**Delete Behavior:**
- Deleting a role cascades to remove all permission mappings
- Deleting a permission cascades to remove from all roles

---

### 7. Product

**Purpose:** Tenant-scoped product catalog with optimistic locking and barcode support.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PK | Unique product identifier |
| `tenantId` | String | FK → Tenant, NOT NULL | Tenant ownership |
| `productName` | String | NOT NULL | Product display name |
| `productSku` | String | NOT NULL | Stock-keeping unit (SKU) |
| `productPricePence` | Int | NOT NULL | Price in minor units (pence/cents) |
| `barcode` | String | NULLABLE | Barcode value (EAN-13, UPC-A, Code128, QR) |
| `barcodeType` | String | NULLABLE | Barcode format type (EAN13, UPCA, CODE128, QR) |
| `entityVersion` | Int | DEFAULT 1 | Optimistic locking version |
| `createdAt` | DateTime | DEFAULT now() | Product creation timestamp |
| `updatedAt` | DateTime | AUTO UPDATE | Last modification timestamp |

**Unique Constraints:**
- `@@unique([tenantId, productSku])` - SKU unique per tenant
- `@@unique([tenantId, barcode])` - Barcode unique per tenant (when present)

**Indexes:**
- `@@index([tenantId])`
- `@@index([barcode])` - Fast barcode lookups
- `@@index([createdAt])`
- `@@index([updatedAt])`

**Relations:**
- `tenant` → Tenant
- `stocks` → ProductStock[] (stock levels per branch)
- `stockLots` → StockLot[] (FIFO lots)
- `stockLedgers` → StockLedger[] (movement history)
- `transferItems` → StockTransferItem[] (transfer line items)
- `transferTemplateItems` → StockTransferTemplateItem[] (template items)

**Notes:**
- Prices stored in minor units (100 pence = £1.00)
- `entityVersion` incremented on every update for conflict detection
- Barcode fields optional (not all products have barcodes)
- Supported barcode formats: EAN13, UPCA, CODE128, QR
- Barcode uniqueness scoped to tenant (multi-tenant isolation)

---

### 8. Branch

**Purpose:** Physical locations within a tenant (warehouses, stores, etc.).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PK | Unique branch identifier |
| `tenantId` | String | FK → Tenant, NOT NULL | Tenant ownership |
| `branchSlug` | String | NOT NULL | URL-safe identifier (e.g., "warehouse-1") |
| `branchName` | String | NOT NULL | Display name (e.g., "Main Warehouse") |
| `isActive` | Boolean | DEFAULT true | Operational status |
| `createdAt` | DateTime | DEFAULT now() | Branch creation timestamp |
| `updatedAt` | DateTime | AUTO UPDATE | Last modification timestamp |

**Unique Constraints:**
- `@@unique([tenantId, branchSlug])` - Slug unique per tenant

**Indexes:**
- `@@index([tenantId])`
- `@@index([tenantId, branchName])`

**Relations:**
- `tenant` → Tenant
- `memberships` → UserBranchMembership[] (assigned users)
- `productStocks` → ProductStock[] (stock levels)
- `stockLots` → StockLot[] (inventory lots)
- `stockLedgers` → StockLedger[] (movement log)

---

### 9. UserBranchMembership (Join Table)

**Purpose:** Assigns users to specific branches for access control.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PK | Unique membership identifier |
| `userId` | String | FK → User, NOT NULL | User reference |
| `tenantId` | String | FK → Tenant, NOT NULL | Tenant reference |
| `branchId` | String | FK → Branch, NOT NULL | Branch reference |
| `createdAt` | DateTime | DEFAULT now() | Membership creation timestamp |
| `updatedAt` | DateTime | AUTO UPDATE | Last modification timestamp |

**Unique Constraints:**
- `@@unique([userId, branchId])` - User can only belong to branch once

**Indexes:**
- `@@index([tenantId])`
- `@@index([userId])`
- `@@index([branchId])`

**Relations:**
- `user` → User (onDelete: Cascade)
- `tenant` → Tenant (onDelete: Cascade)
- `branch` → Branch (onDelete: Cascade)

---

### 10. ProductStock (Aggregate)

**Purpose:** Denormalized aggregate stock quantity per branch+product.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PK | Unique stock record identifier |
| `tenantId` | String | FK → Tenant, NOT NULL | Tenant ownership |
| `branchId` | String | FK → Branch, NOT NULL | Branch location |
| `productId` | String | FK → Product, NOT NULL | Product reference |
| `qtyOnHand` | Int | DEFAULT 0 | Available quantity (sum of lot qtyRemaining) |
| `qtyAllocated` | Int | DEFAULT 0 | Reserved for orders (future feature) |
| `createdAt` | DateTime | DEFAULT now() | Record creation timestamp |
| `updatedAt` | DateTime | AUTO UPDATE | Last modification timestamp |

**Unique Constraints:**
- `@@unique([tenantId, branchId, productId])` - One stock record per branch+product

**Indexes:**
- `@@index([branchId])`
- `@@index([productId])`

**Relations:**
- `tenant` → Tenant (onDelete: Cascade)
- `branch` → Branch (onDelete: Cascade)
- `product` → Product (onDelete: Restrict)

**Notes:**
- Updated via triggers/service layer when StockLot changes
- `qtyAllocated` for future order allocation feature

---

### 11. StockLot (FIFO Lots)

**Purpose:** Individual inventory receipts with unit cost and received date for FIFO consumption.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PK | Unique lot identifier |
| `tenantId` | String | FK → Tenant, NOT NULL | Tenant ownership |
| `branchId` | String | FK → Branch, NOT NULL | Branch location |
| `productId` | String | FK → Product, NOT NULL | Product reference |
| `qtyReceived` | Int | NOT NULL | Initial received quantity |
| `qtyRemaining` | Int | NOT NULL | Remaining quantity (decrements on consumption) |
| `unitCostPence` | Int | NULLABLE | Unit cost in minor units (pence/cents) |
| `sourceRef` | String | NULLABLE | PO/transfer reference (future) |
| `receivedAt` | DateTime | DEFAULT now() | Receipt timestamp (FIFO sort key) |
| `createdAt` | DateTime | DEFAULT now() | Record creation timestamp |
| `updatedAt` | DateTime | AUTO UPDATE | Last modification timestamp |

**Indexes:**
- `@@index([tenantId, branchId, productId, receivedAt])` - **FIFO query optimization**
- `@@index([branchId, productId])`

**Relations:**
- `tenant` → Tenant (onDelete: Cascade)
- `branch` → Branch (onDelete: Cascade)
- `product` → Product (onDelete: Restrict)
- `ledgerEntries` → StockLedger[] (movements from this lot)

**FIFO Logic:**
```sql
-- Consume stock (oldest first)
SELECT * FROM StockLot
WHERE tenantId = ? AND branchId = ? AND productId = ?
  AND qtyRemaining > 0
ORDER BY receivedAt ASC
```

---

### 12. StockLedger (Append-Only Log)

**Purpose:** Immutable audit trail of all stock movements.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PK | Unique ledger entry identifier |
| `tenantId` | String | FK → Tenant, NOT NULL | Tenant ownership |
| `branchId` | String | FK → Branch, NOT NULL | Branch location |
| `productId` | String | FK → Product, NOT NULL | Product reference |
| `lotId` | String | FK → StockLot, NULLABLE | Associated lot (if applicable) |
| `kind` | Enum | NOT NULL | Movement type (see below) |
| `qtyDelta` | Int | NOT NULL | Quantity change (+/-) |
| `reason` | String | NULLABLE | Free-text reason (e.g., "Damaged goods") |
| `actorUserId` | String | FK → User, NULLABLE | User who performed action |
| `occurredAt` | DateTime | DEFAULT now() | Movement timestamp |
| `createdAt` | DateTime | DEFAULT now() | Record creation timestamp |

**Enum: StockMovementKind**
- `RECEIPT` - Receive new stock into lot (+qty)
- `ADJUSTMENT` - Manual correction (+/- qty)
- `CONSUMPTION` - Fulfill order / consume stock (-qty)
- `REVERSAL` - Undo previous movement (+/- qty)

**Indexes:**
- `@@index([tenantId, branchId, productId, occurredAt])`
- `@@index([kind])`

**Relations:**
- `tenant` → Tenant (onDelete: Cascade)
- `branch` → Branch (onDelete: Cascade)
- `product` → Product (onDelete: Restrict)
- `lot` → StockLot? (onDelete: SetNull)
- `actorUser` → User? (onDelete: SetNull)

**Notes:**
- **Append-only** - Never updated or deleted
- Used for audit trails, reports, and reconciliation
- `qtyDelta` positive for receipts, negative for consumption

---

### 13. AuditEvent (Compliance Log)

**Purpose:** Append-only audit trail for all entity changes (CUD operations).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PK | Unique audit event identifier |
| `tenantId` | String | FK → Tenant, NOT NULL | Tenant ownership |
| `actorUserId` | String | FK → User, NULLABLE | User who performed action |
| `entityType` | Enum | NOT NULL | Entity type (see below) |
| `entityId` | String | NOT NULL | Entity identifier |
| `action` | Enum | NOT NULL | Action type (see below) |
| `entityName` | String | NULLABLE | Denormalized display name |
| `beforeJson` | JSON | NULLABLE | State snapshot before change |
| `afterJson` | JSON | NULLABLE | State snapshot after change |
| `diffJson` | JSON | NULLABLE | Compact patch-style diff |
| `correlationId` | String | NULLABLE | Request tracing ID |
| `ip` | String | NULLABLE | Client IP address |
| `userAgent` | String | NULLABLE | Client user agent |
| `createdAt` | DateTime | DEFAULT now() | Event timestamp |

**Enum: AuditEntityType**
- `PRODUCT`, `BRANCH`, `STOCK_LOT`, `STOCK_LEDGER`, `PRODUCT_STOCK`
- `USER`, `ROLE`, `TENANT`, `TENANT_BRANDING`

**Enum: AuditAction**
- `CREATE`, `UPDATE`, `DELETE`
- `STOCK_RECEIVE`, `STOCK_ADJUST`, `STOCK_CONSUME`
- `ROLE_ASSIGN`, `ROLE_REVOKE`
- `LOGIN`, `LOGOUT`
- `THEME_UPDATE`, `THEME_LOGO_UPDATE`

**Indexes:**
- `@@index([tenantId, entityType, entityId, createdAt])` - Entity history
- `@@index([actorUserId, createdAt])` - User activity
- `@@index([action, createdAt])` - Action filtering
- `@@index([correlationId])` - Request tracing

**Relations:**
- `tenant` → Tenant (onDelete: Cascade)
- `actorUser` → User? (onDelete: SetNull)

**Notes:**
- **Append-only** - Never updated or deleted
- `beforeJson`/`afterJson` contain whitelisted fields only
- Used for compliance, troubleshooting, activity feeds

---

### 14. TenantBranding

**Purpose:** Tenant-specific theme and logo customization.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `tenantId` | String (FK → Tenant) | PK | Tenant identifier (one-to-one) |
| `presetKey` | String | NULLABLE | Theme preset name (e.g., "ocean", "sunset") |
| `overridesJson` | JSON | NULLABLE | Custom theme overrides (colors, fonts, etc.) |
| `logoUrl` | String | NULLABLE | Public URL for tenant logo |
| `createdAt` | DateTime | DEFAULT now() | Record creation timestamp |
| `updatedAt` | DateTime | AUTO UPDATE | Last modification timestamp |

**Relations:**
- `tenant` → Tenant (onDelete: Cascade)

**Example overridesJson:**
```json
{
  "primaryColor": "blue",
  "primaryShade": 6,
  "colors": {
    "brand": ["#e3f2fd", "#bbdefb", "#90caf9", "#64b5f6", "#42a5f5", "#2196f3", "#1e88e5", "#1976d2", "#1565c0", "#0d47a1"]
  },
  "defaultRadius": "md",
  "fontFamily": "Inter, sans-serif"
}
```

---

### 15. IdempotencyRecord

**Purpose:** Store idempotent responses to prevent duplicate processing.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PK | Unique record identifier |
| `idempotencyKey` | String | UNIQUE, NOT NULL | Client-provided unique key |
| `requestFingerprint` | String | NOT NULL | Hash of method+path+body+user+tenant |
| `storedResponseJson` | JSON | NOT NULL | Serialized response envelope |
| `expiresAt` | DateTime | NOT NULL | TTL expiration (24 hours) |
| `createdAt` | DateTime | DEFAULT now() | Record creation timestamp |
| `updatedAt` | DateTime | AUTO UPDATE | Last modification timestamp |

**Indexes:**
- `@@index([expiresAt])` - Cleanup expired records

**Notes:**
- TTL: 24 hours (configurable)
- Cleanup via cron job (future) or on-demand
- Prevents duplicate charges, double-posting, race conditions

---

### 16. ApiRequestLog

**Purpose:** HTTP request/response logging for debugging and analytics.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PK | Unique log entry identifier |
| `tenantId` | String | NULLABLE | Tenant context (if authenticated) |
| `userId` | String | NULLABLE | User context (if authenticated) |
| `method` | String | NOT NULL | HTTP method (GET, POST, etc.) |
| `path` | String | NOT NULL | Request path |
| `routeKey` | String | NULLABLE | Normalized route (e.g., "GET /api/products/:id") |
| `query` | String | NULLABLE | Query string |
| `ip` | String | NULLABLE | Client IP address |
| `userAgent` | String | NULLABLE | Client user agent |
| `statusCode` | Int | NOT NULL | HTTP response status code |
| `durationMs` | Int | NOT NULL | Request duration in milliseconds |
| `errorCode` | String | NULLABLE | Application error code (if error) |
| `correlationId` | String | NULLABLE | Request tracing ID |
| `reqBody` | String | NULLABLE | Truncated/masked request body |
| `resBody` | String | NULLABLE | Truncated/masked response body |
| `createdAt` | DateTime | DEFAULT now() | Log timestamp |

**Indexes:**
- `@@index([tenantId, createdAt])`
- `@@index([userId, createdAt])`
- `@@index([routeKey, createdAt])`
- `@@index([statusCode, createdAt])`
- `@@index([correlationId])`

**Notes:**
- Bodies truncated to 1000 chars
- Sensitive fields masked (password, token, etc.)
- Retention policy: 30 days (configurable)

---

## Migration Workflow

### Creating Migrations

```bash
# 1. Edit schema.prisma
# 2. Regenerate Prisma client
npm run prisma:generate

# 3. Create migration (dev)
npm run db:migrate -- --name add_suppliers

# 4. Apply migrations (CI/prod)
npm run db:deploy
```

### Migration Strategy

**Development:**
- Interactive migrations via `prisma migrate dev`
- Writes migration files to `prisma/migrations/`
- Auto-applies migrations and regenerates client

**Production:**
- Non-interactive via `prisma migrate deploy`
- Applies pending migrations only
- No schema changes or client regeneration
- Run in `npm run start` (see `api-server/package.json`)

**Rollback:**
- Prisma does not support automatic rollbacks
- Manual rollback: restore database backup or write reverse migration

---

## Seed Data

**Seed Script:** `api-server/prisma/seed.ts`

**Run:**
```bash
npm run db:seed
```

**Seeded Data:**
1. **Permissions** - Global RBAC catalog
2. **Tenants** - Demo tenants (Acme Corp, Beta Inc)
3. **Roles** - System roles (OWNER, ADMIN, EDITOR, VIEWER)
4. **Users** - Test users with memberships
5. **Products** - Sample products per tenant
6. **Branches** - Demo branches per tenant
7. **Stock Lots** - Initial inventory

**Reset Database (Destructive):**
```bash
npm run db:reset:dev  # Drop DB, re-apply migrations, re-seed
```

---

## Query Patterns

### Multi-Tenant Filtering (CRITICAL)

**Always filter by tenantId:**
```typescript
const products = await prisma.product.findMany({
  where: { tenantId: req.currentTenantId }, // ← REQUIRED
})
```

**Never expose data across tenants:**
```typescript
// BAD - exposes all tenants
const products = await prisma.product.findMany()

// GOOD - tenant-scoped
const products = await prisma.product.findMany({
  where: { tenantId: req.currentTenantId },
})
```

### Optimistic Locking Pattern

```typescript
// 1. Read current version
const product = await prisma.product.findUnique({
  where: { id: productId },
  select: { entityVersion: true },
})

// 2. Update with version check
const updated = await prisma.product.update({
  where: {
    id: productId,
    entityVersion: product.entityVersion, // ← Conflict detection
  },
  data: {
    productName: newName,
    entityVersion: { increment: 1 }, // ← Increment version
  },
})

// 3. Handle conflict
if (!updated) {
  throw new Error('CONFLICT: Product was modified by another user')
}
```

### FIFO Stock Consumption

```typescript
// Query oldest lots first
const lots = await prisma.stockLot.findMany({
  where: {
    tenantId,
    branchId,
    productId,
    qtyRemaining: { gt: 0 },
  },
  orderBy: { receivedAt: 'asc' }, // ← FIFO order
})

// Drain lots until qty consumed
let remaining = qtyToConsume
for (const lot of lots) {
  const consumeFromLot = Math.min(remaining, lot.qtyRemaining)

  await prisma.stockLot.update({
    where: { id: lot.id },
    data: { qtyRemaining: { decrement: consumeFromLot } },
  })

  await prisma.stockLedger.create({
    data: {
      tenantId,
      branchId,
      productId,
      lotId: lot.id,
      kind: 'CONSUMPTION',
      qtyDelta: -consumeFromLot,
      actorUserId: req.currentUserId,
    },
  })

  remaining -= consumeFromLot
  if (remaining === 0) break
}
```

### Audit Event Creation

```typescript
await prisma.auditEvent.create({
  data: {
    tenantId: req.currentTenantId,
    actorUserId: req.currentUserId,
    entityType: 'PRODUCT',
    entityId: product.id,
    action: 'UPDATE',
    entityName: product.productName,
    beforeJson: { productPricePence: 1200 },
    afterJson: { productPricePence: 1500 },
    correlationId: req.correlationId,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  },
})
```

---

## Performance Considerations

### 1. Indexed Queries
- Always filter by indexed columns first (tenantId, branchId, productId)
- Use composite indexes for multi-column filters
- Avoid `contains` / `startsWith` on large text fields without indexes

### 2. Selective Field Projection
```typescript
// BAD - fetch all fields
const products = await prisma.product.findMany()

// GOOD - select only needed fields
const products = await prisma.product.findMany({
  select: { id: true, productName: true, productSku: true },
})
```

### 3. Pagination
```typescript
const products = await prisma.product.findMany({
  where: { tenantId },
  skip: (page - 1) * pageSize,
  take: pageSize,
  orderBy: { createdAt: 'desc' },
})
```

### 4. Transaction Batching
```typescript
await prisma.$transaction([
  prisma.stockLot.update({ ... }),
  prisma.productStock.update({ ... }),
  prisma.stockLedger.create({ ... }),
])
```

---

## Related Documentation

- [Project Architecture](./project_architecture.md)
- [RBAC System Design](./rbac_system.md)
- [Stock Management System](./stock_management.md)

---

## Phase 4 Additions (2025-10-14)

### TransferMetrics (Analytics)

**Purpose:** Pre-computed daily metrics for transfer analytics dashboard.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PK | Unique metric record identifier |
| `tenantId` | String | FK → Tenant, NOT NULL | Tenant ownership |
| `metricDate` | Date | NOT NULL | Date for this metric snapshot |
| `transfersCreated` | Int | DEFAULT 0 | Transfers created on this date |
| `transfersApproved` | Int | DEFAULT 0 | Transfers approved on this date |
| `transfersShipped` | Int | DEFAULT 0 | Transfers shipped on this date |
| `transfersCompleted` | Int | DEFAULT 0 | Transfers completed on this date |
| `transfersRejected` | Int | DEFAULT 0 | Transfers rejected on this date |
| `transfersCancelled` | Int | DEFAULT 0 | Transfers cancelled on this date |
| `avgApprovalTime` | Int | NULLABLE | Average time (seconds) REQUESTED → APPROVED |
| `avgShipTime` | Int | NULLABLE | Average time (seconds) APPROVED → IN_TRANSIT |
| `avgReceiveTime` | Int | NULLABLE | Average time (seconds) IN_TRANSIT → COMPLETED |
| `avgTotalTime` | Int | NULLABLE | Average time (seconds) REQUESTED → COMPLETED |
| `createdAt` | DateTime | DEFAULT now() | Record creation timestamp |
| `updatedAt` | DateTime | AUTO UPDATE | Last modification timestamp |

**Unique Constraints:**
- `@@unique([tenantId, metricDate])` - One metric record per tenant per day

**Indexes:**
- `@@index([tenantId, metricDate])`

**Relations:**
- `tenant` → Tenant (onDelete: Cascade)

**Notes:**
- Populated by nightly aggregation job
- Enables fast dashboard queries without real-time aggregation
- Daily granularity balances detail vs. storage

---

### TransferRouteMetrics (Branch Dependencies)

**Purpose:** Track transfer volume and completion times between specific branches.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PK | Unique metric record identifier |
| `tenantId` | String | FK → Tenant, NOT NULL | Tenant ownership |
| `sourceBranchId` | String | FK → Branch, NOT NULL | Source branch reference |
| `destinationBranchId` | String | FK → Branch, NOT NULL | Destination branch reference |
| `metricDate` | Date | NOT NULL | Date for this metric snapshot |
| `transferCount` | Int | DEFAULT 0 | Number of transfers on this route |
| `totalUnits` | Int | DEFAULT 0 | Total units transferred on this route |
| `avgCompletionTime` | Int | NULLABLE | Average completion time (seconds) |
| `createdAt` | DateTime | DEFAULT now() | Record creation timestamp |
| `updatedAt` | DateTime | AUTO UPDATE | Last modification timestamp |

**Unique Constraints:**
- `@@unique([tenantId, sourceBranchId, destinationBranchId, metricDate])` - One metric per route per day

**Indexes:**
- `@@index([tenantId, metricDate])`

**Relations:**
- `tenant` → Tenant (onDelete: Cascade)
- `sourceBranch` → Branch (onDelete: Cascade)
- `destinationBranch` → Branch (onDelete: Cascade)

**Notes:**
- Enables branch dependency visualization
- Shows high-volume routes and bottlenecks
- Supports network graph or Sankey diagram rendering

---

### StockTransfer Updates (Phase 4)

**New Field:**
- `priority` - TransferPriority enum (LOW, NORMAL, HIGH, URGENT), DEFAULT NORMAL

**Updated Index:**
- Old: `@@index([tenantId, status, createdAt])`
- New: `@@index([tenantId, status, priority, requestedAt])`
- Reason: Supports queries sorted by priority then date

**New Enum:**
```typescript
enum TransferPriority {
  LOW      // Seasonal overstock, can wait
  NORMAL   // Standard priority (default)
  HIGH     // Promotional event, expedited
  URGENT   // Stock-out situation, immediate
}
```

---

### StockTransferItem Updates (Phase 4)

**New Field:**
- `shipmentBatches` - JSON (nullable)
- Stores array of partial shipment records:
  ```json
  [
    {
      "batchNumber": 1,
      "qty": 70,
      "shippedAt": "2025-01-15T14:00:00Z",
      "shippedByUserId": "cuid123",
      "lotsConsumed": [
        { "lotId": "lot1", "qty": 50, "unitCostPence": 1200 },
        { "lotId": "lot2", "qty": 20, "unitCostPence": 1150 }
      ]
    },
    {
      "batchNumber": 2,
      "qty": 30,
      "shippedAt": "2025-01-18T10:00:00Z",
      "shippedByUserId": "cuid456",
      "lotsConsumed": [
        { "lotId": "lot3", "qty": 30, "unitCostPence": 1180 }
      ]
    }
  ]
  ```

**Purpose:** Track multiple shipment batches when source ships less than approved quantity.

---

### AuditAction Enum Updates (Phase 4)

**New Actions:**
- `TRANSFER_PRIORITY_CHANGE` - Transfer priority updated
- `TRANSFER_SHIP_PARTIAL` - Partial shipment created

---

**Last Updated:** 2025-10-14
**Document Version:** 1.2 (Added Phase 4: Analytics tables, priority field, partial shipment tracking)
