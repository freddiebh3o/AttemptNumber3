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

## Stock Transfer Tables

### 17. StockTransfer

**Purpose:** Inter-branch stock transfer workflow with multi-level approval support.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PK | Unique transfer identifier |
| `tenantId` | String | FK → Tenant, NOT NULL | Tenant ownership |
| `transferNumber` | String | NOT NULL | Auto-generated identifier (e.g., "TRF-2025-001") |
| `sourceBranchId` | String | FK → Branch, NOT NULL | Branch sending stock |
| `destinationBranchId` | String | FK → Branch, NOT NULL | Branch receiving stock |
| `status` | Enum | DEFAULT REQUESTED | Transfer workflow status (see below) |
| `priority` | Enum | DEFAULT NORMAL | Transfer priority level (see below) |
| `requestedByUserId` | String | FK → User, NOT NULL | User who initiated request |
| `reviewedByUserId` | String | FK → User, NULLABLE | User who approved/rejected |
| `shippedByUserId` | String | FK → User, NULLABLE | User who shipped items |
| `requestedAt` | DateTime | DEFAULT now() | Request creation timestamp |
| `reviewedAt` | DateTime | NULLABLE | Approval/rejection timestamp |
| `shippedAt` | DateTime | NULLABLE | Shipment timestamp |
| `completedAt` | DateTime | NULLABLE | Final completion timestamp |
| `requestNotes` | String (Text) | NULLABLE | Requester notes/reason |
| `reviewNotes` | String (Text) | NULLABLE | Reviewer notes (e.g., rejection reason) |
| `isReversal` | Boolean | DEFAULT false | True if this is a reversal transfer |
| `reversalOfId` | String | FK → StockTransfer, NULLABLE | Links to original transfer (if reversal) |
| `reversedById` | String | FK → StockTransfer, NULLABLE | Links to reversal transfer (if reversed) |
| `reversalReason` | String (Text) | NULLABLE | Reason for reversal |
| `requiresMultiLevelApproval` | Boolean | DEFAULT false | Multi-level approval required |
| `createdAt` | DateTime | DEFAULT now() | Record creation timestamp |
| `updatedAt` | DateTime | AUTO UPDATE | Last modification timestamp |

**Enum: StockTransferStatus**
- `REQUESTED` - Initial state, awaiting approval
- `APPROVED` - Approved, ready to ship
- `REJECTED` - Rejected by reviewer
- `IN_TRANSIT` - Shipped from source, in transit
- `PARTIALLY_RECEIVED` - Some items received at destination
- `COMPLETED` - All items received, transfer complete
- `CANCELLED` - Cancelled before completion

**Enum: TransferPriority**
- `LOW` - Seasonal overstock, can wait
- `NORMAL` - Standard priority (default)
- `HIGH` - Promotional event, expedited
- `URGENT` - Stock-out situation, immediate

**Unique Constraints:**
- `@@unique([tenantId, transferNumber])` - Transfer number unique per tenant
- `@@unique([reversalOfId])` - One reversal per transfer

**Indexes:**
- `@@index([tenantId, status, priority, requestedAt])` - List transfers with priority sort
- `@@index([sourceBranchId, status])` - Outbound transfers per branch
- `@@index([destinationBranchId, status])` - Inbound transfers per branch
- `@@index([requestedByUserId])` - User activity
- `@@index([reversedById])` - Find reversed transfers

**Relations:**
- `tenant` → Tenant (onDelete: Cascade)
- `sourceBranch` → Branch (onDelete: Restrict)
- `destinationBranch` → Branch (onDelete: Restrict)
- `requestedByUser` → User (onDelete: Restrict)
- `reviewedByUser` → User? (onDelete: SetNull)
- `shippedByUser` → User? (onDelete: SetNull)
- `items` → StockTransferItem[] (line items)
- `reversalOf` → StockTransfer? (original transfer)
- `reversedBy` → StockTransfer? (reversal transfer)
- `approvalRecords` → TransferApprovalRecord[] (multi-level approvals)

**Notes:**
- Transfer number auto-generated on creation
- Multi-level approval triggered by TransferApprovalRule evaluation
- Reversal creates new transfer with opposite direction and restores FIFO lots
- Partial shipments tracked via `shipmentBatches` in StockTransferItem

---

### 18. StockTransferItem

**Purpose:** Line items for stock transfers with partial shipment and FIFO lot tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PK | Unique item identifier |
| `transferId` | String | FK → StockTransfer, NOT NULL | Parent transfer reference |
| `productId` | String | FK → Product, NOT NULL | Product being transferred |
| `qtyRequested` | Int | NOT NULL | Initial quantity requested |
| `qtyApproved` | Int | NULLABLE | Approved quantity (may differ from requested) |
| `qtyShipped` | Int | DEFAULT 0 | Total quantity shipped (sum of batches) |
| `qtyReceived` | Int | DEFAULT 0 | Total quantity received (incremental) |
| `lotsConsumed` | JSON | NULLABLE | Array of `{lotId, qty, unitCostPence}` |
| `avgUnitCostPence` | Int | NULLABLE | Weighted average cost of shipped items |
| `shipmentBatches` | JSON | NULLABLE | Partial shipment tracking (see below) |
| `createdAt` | DateTime | DEFAULT now() | Record creation timestamp |
| `updatedAt` | DateTime | AUTO UPDATE | Last modification timestamp |

**Unique Constraints:**
- `@@unique([transferId, productId])` - One entry per product per transfer

**Indexes:**
- `@@index([productId])` - Product transfer history

**Relations:**
- `transfer` → StockTransfer (onDelete: Cascade)
- `product` → Product (onDelete: Restrict)

**shipmentBatches JSON Structure:**
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

**Notes:**
- `qtyApproved` may be less than `qtyRequested` (partial approval)
- `qtyShipped` may be less than `qtyApproved` (partial shipment)
- `lotsConsumed` populated on ship (FIFO consumption from source branch)
- `avgUnitCostPence` calculated as weighted average of consumed lots
- Partial shipments tracked via `shipmentBatches` array

---

### 19. StockTransferTemplate

**Purpose:** Reusable transfer configurations for common branch-to-branch transfers.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PK | Unique template identifier |
| `tenantId` | String | FK → Tenant, NOT NULL | Tenant ownership |
| `name` | String | NOT NULL | Template name (e.g., "Weekly Retail Restock") |
| `description` | String (Text) | NULLABLE | Template purpose description |
| `sourceBranchId` | String | FK → Branch, NOT NULL | Default source branch |
| `destinationBranchId` | String | FK → Branch, NOT NULL | Default destination branch |
| `createdByUserId` | String | FK → User, NOT NULL | User who created template |
| `isArchived` | Boolean | DEFAULT false | Archival (soft delete) flag |
| `archivedAt` | DateTime | NULLABLE | Archival timestamp |
| `archivedByUserId` | String | FK → User, NULLABLE | User who archived template |
| `createdAt` | DateTime | DEFAULT now() | Record creation timestamp |
| `updatedAt` | DateTime | AUTO UPDATE | Last modification timestamp |

**Indexes:**
- `@@index([tenantId])` - Tenant templates
- `@@index([sourceBranchId])` - Templates by source
- `@@index([destinationBranchId])` - Templates by destination
- `@@index([createdByUserId])` - User activity
- `@@index([tenantId, isArchived])` - Filter active/archived templates

**Relations:**
- `tenant` → Tenant (onDelete: Cascade)
- `sourceBranch` → Branch (onDelete: Cascade)
- `destinationBranch` → Branch (onDelete: Cascade)
- `createdByUser` → User (onDelete: Restrict)
- `archivedByUser` → User? (onDelete: Restrict)
- `items` → StockTransferTemplateItem[] (default products and quantities)

**Notes:**
- Archived templates hidden from active template list by default
- Cannot be used to create new transfers when archived
- Preserves historical data and references
- Can be restored by setting `isArchived = false`

---

### 20. StockTransferTemplateItem

**Purpose:** Default product quantities for transfer templates.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PK | Unique item identifier |
| `templateId` | String | FK → StockTransferTemplate, NOT NULL | Parent template reference |
| `productId` | String | FK → Product, NOT NULL | Product reference |
| `defaultQty` | Int | NOT NULL | Default quantity for this product |
| `createdAt` | DateTime | DEFAULT now() | Record creation timestamp |
| `updatedAt` | DateTime | AUTO UPDATE | Last modification timestamp |

**Unique Constraints:**
- `@@unique([templateId, productId])` - One entry per product per template

**Indexes:**
- `@@index([productId])` - Product template usage

**Relations:**
- `template` → StockTransferTemplate (onDelete: Cascade)
- `product` → Product (onDelete: Cascade)

**Notes:**
- Default quantities can be edited when creating transfer from template
- Useful for recurring transfer patterns (e.g., weekly restocking)

---

### 21. TransferApprovalRule

**Purpose:** Multi-level approval workflow configuration with conditional triggers.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PK | Unique rule identifier |
| `tenantId` | String | FK → Tenant, NOT NULL | Tenant ownership |
| `name` | String | NOT NULL | Rule name (e.g., "High-Value Transfer Approval") |
| `description` | String (Text) | NULLABLE | Rule purpose description |
| `isActive` | Boolean | DEFAULT true | Rule enabled/disabled |
| `approvalMode` | Enum | DEFAULT SEQUENTIAL | Approval workflow mode (see below) |
| `priority` | Int | DEFAULT 0 | Rule evaluation priority (higher first) |
| `isArchived` | Boolean | DEFAULT false | Archival (soft delete) flag |
| `archivedAt` | DateTime | NULLABLE | Archival timestamp |
| `archivedByUserId` | String | NULLABLE | User who archived rule |
| `createdAt` | DateTime | DEFAULT now() | Record creation timestamp |
| `updatedAt` | DateTime | AUTO UPDATE | Last modification timestamp |

**Enum: ApprovalMode**
- `SEQUENTIAL` - Approvals must happen in order (Level 1 → 2 → 3)
- `PARALLEL` - All levels can approve simultaneously
- `HYBRID` - Level 1 must approve first, then 2+ parallel

**Indexes:**
- `@@index([tenantId, isActive])` - Active rules
- `@@index([tenantId, priority])` - Rule evaluation order
- `@@index([tenantId, isArchived])` - Filter active/archived rules

**Relations:**
- `tenant` → Tenant (onDelete: Cascade)
- `conditions` → TransferApprovalCondition[] (trigger conditions)
- `levels` → TransferApprovalLevel[] (approval hierarchy)

**Notes:**
- Rules evaluated in priority order (highest first)
- First matching rule determines approval workflow
- Conditions must all match (AND logic) for rule to apply
- Inactive rules skipped during evaluation

---

### 22. TransferApprovalCondition

**Purpose:** Conditions that trigger approval rules (e.g., value threshold, branch-specific).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PK | Unique condition identifier |
| `ruleId` | String | FK → TransferApprovalRule, NOT NULL | Parent rule reference |
| `conditionType` | Enum | NOT NULL | Condition type (see below) |
| `threshold` | Int | NULLABLE | Numeric threshold (for QTY/VALUE conditions) |
| `branchId` | String | FK → Branch, NULLABLE | Branch reference (for branch conditions) |
| `createdAt` | DateTime | DEFAULT now() | Record creation timestamp |
| `updatedAt` | DateTime | AUTO UPDATE | Last modification timestamp |

**Enum: ApprovalRuleConditionType**
- `TOTAL_QTY_THRESHOLD` - Total quantity > X
- `TOTAL_VALUE_THRESHOLD` - Total value (pence) > X
- `SOURCE_BRANCH` - Transfer from specific branch
- `DESTINATION_BRANCH` - Transfer to specific branch
- `PRODUCT_CATEGORY` - Product has category X (future)

**Indexes:**
- `@@index([ruleId])` - Conditions per rule
- `@@index([branchId])` - Branch-specific rules

**Relations:**
- `rule` → TransferApprovalRule (onDelete: Cascade)
- `branch` → Branch? (onDelete: Cascade)

**Notes:**
- All conditions in a rule must match (AND logic)
- Threshold-based conditions use `threshold` field
- Branch-based conditions use `branchId` field
- Future enhancement: product category conditions

---

### 23. TransferApprovalLevel

**Purpose:** Approval hierarchy levels required by a rule (e.g., Manager → Director).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PK | Unique level identifier |
| `ruleId` | String | FK → TransferApprovalRule, NOT NULL | Parent rule reference |
| `level` | Int | NOT NULL | Level number (1, 2, 3, etc.) |
| `name` | String | NOT NULL | Level display name (e.g., "Manager", "Director") |
| `requiredRoleId` | String | FK → Role, NULLABLE | Role required to approve (e.g., OWNER) |
| `requiredUserId` | String | FK → User, NULLABLE | Specific user required (e.g., Finance Director) |
| `createdAt` | DateTime | DEFAULT now() | Record creation timestamp |
| `updatedAt` | DateTime | AUTO UPDATE | Last modification timestamp |

**Unique Constraints:**
- `@@unique([ruleId, level])` - One level per number per rule

**Indexes:**
- `@@index([ruleId])` - Levels per rule
- `@@index([requiredRoleId])` - Role-based approval queries
- `@@index([requiredUserId])` - User-based approval queries

**Relations:**
- `rule` → TransferApprovalRule (onDelete: Cascade)
- `role` → Role? (onDelete: SetNull)
- `user` → User? (onDelete: SetNull)

**Notes:**
- Either `requiredRoleId` OR `requiredUserId` specified (not both)
- Role-based: Any user with role can approve (e.g., any OWNER)
- User-based: Only specific user can approve (e.g., CFO)
- Levels evaluated in ascending order for SEQUENTIAL mode

---

### 24. TransferApprovalRecord

**Purpose:** Records approval status for each level of a transfer's approval workflow.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PK | Unique record identifier |
| `transferId` | String | FK → StockTransfer, NOT NULL | Parent transfer reference |
| `level` | Int | NOT NULL | Approval level number |
| `levelName` | String | NOT NULL | Level display name (e.g., "Manager") |
| `status` | Enum | DEFAULT PENDING | Approval status (see below) |
| `requiredRoleId` | String | FK → Role, NULLABLE | Role required for this level |
| `requiredUserId` | String | FK → User, NULLABLE | User required for this level |
| `approvedByUserId` | String | FK → User, NULLABLE | User who actually approved |
| `approvedAt` | DateTime | NULLABLE | Approval timestamp |
| `notes` | String (Text) | NULLABLE | Approver notes/comments |
| `createdAt` | DateTime | DEFAULT now() | Record creation timestamp |
| `updatedAt` | DateTime | AUTO UPDATE | Last modification timestamp |

**Enum: ApprovalStatus**
- `PENDING` - Awaiting approval
- `APPROVED` - Approved
- `REJECTED` - Rejected
- `SKIPPED` - Not required (rule didn't match)

**Indexes:**
- `@@index([transferId, level])` - Approval records per transfer
- `@@index([status])` - Pending approvals
- `@@index([requiredRoleId])` - Role-based approval queries
- `@@index([requiredUserId])` - User-based approval queries
- `@@index([approvedByUserId])` - User activity

**Relations:**
- `transfer` → StockTransfer (onDelete: Cascade)
- `requiredRole` → Role? (onDelete: SetNull)
- `requiredUser` → User? (onDelete: SetNull)
- `approvedByUser` → User? (onDelete: SetNull)

**Notes:**
- Created when transfer triggers multi-level approval rule
- One record per level required by matched rule
- Status changes from PENDING → APPROVED/REJECTED
- Audit trail preserved even if rule/role/user deleted

---

### 25. TransferMetrics

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
- `@@index([tenantId, metricDate])` - Time-series queries

**Relations:**
- `tenant` → Tenant (onDelete: Cascade)

**Notes:**
- Populated by nightly aggregation job
- Enables fast dashboard queries without real-time aggregation
- Daily granularity balances detail vs. storage
- Timing metrics measured in seconds

---

### 26. TransferRouteMetrics

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
- `@@index([tenantId, metricDate])` - Time-series queries

**Relations:**
- `tenant` → Tenant (onDelete: Cascade)
- `sourceBranch` → Branch (onDelete: Cascade)
- `destinationBranch` → Branch (onDelete: Cascade)

**Notes:**
- Enables branch dependency visualization
- Shows high-volume routes and bottlenecks
- Supports network graph or Sankey diagram rendering
- Daily aggregation per unique route

---

## AI Chatbot Tables

### 27. ChatConversation

**Purpose:** Multi-turn chat conversations for AI chatbot assistant.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PK | Unique conversation identifier |
| `userId` | String | FK → User, NOT NULL | User who owns conversation |
| `tenantId` | String | FK → Tenant, NOT NULL | Tenant context |
| `title` | String | NULLABLE | Auto-generated from first message |
| `createdAt` | DateTime | DEFAULT now() | Conversation creation timestamp |
| `updatedAt` | DateTime | AUTO UPDATE | Last modification timestamp |

**Indexes:**
- `@@index([userId, tenantId])` - User conversations per tenant
- `@@index([userId, createdAt])` - Recent conversations

**Relations:**
- `user` → User (onDelete: Cascade)
- `tenant` → Tenant (onDelete: Cascade)
- `messages` → ChatMessage[] (conversation messages)

**Notes:**
- Stores conversation threading for multi-turn interactions
- Title auto-generated from first user message
- Conversation scoped to tenant for data isolation

---

### 28. ChatMessage

**Purpose:** Individual messages within a chat conversation (user and assistant).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PK | Unique message identifier |
| `conversationId` | String | FK → ChatConversation, NOT NULL | Parent conversation reference |
| `role` | String | NOT NULL | Message role: 'user', 'assistant', 'system' |
| `content` | JSON | NOT NULL | UIMessage parts array from Vercel AI SDK |
| `createdAt` | DateTime | DEFAULT now() | Message creation timestamp |

**Indexes:**
- `@@index([conversationId])` - Messages per conversation
- `@@index([conversationId, createdAt])` - Chronological message order

**Relations:**
- `conversation` → ChatConversation (onDelete: Cascade)

**content JSON Structure (Vercel AI SDK UIMessage):**
```json
{
  "parts": [
    { "type": "text", "text": "Show me recent transfers" },
    {
      "type": "tool-call",
      "toolCallId": "call_123",
      "toolName": "searchTransfers",
      "args": { "limit": 10 }
    },
    {
      "type": "tool-result",
      "toolCallId": "call_123",
      "toolName": "searchTransfers",
      "result": { "transfers": [...] }
    }
  ]
}
```

**Notes:**
- Role enum: `user` (user input), `assistant` (AI response), `system` (system prompts)
- Content stored as UIMessage parts array from Vercel AI SDK v5
- Tool calls and results tracked for debugging and analytics

---

### 29. DocumentChunk

**Purpose:** Embedded documentation sections for RAG (Retrieval-Augmented Generation).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PK | Unique chunk identifier |
| `documentId` | String | NOT NULL | File path (e.g., "docs/stock-transfers/overview.md") |
| `sectionId` | String | NOT NULL | Heading anchor (e.g., "## Step 1: Navigate to Transfers") |
| `title` | String | NOT NULL | Chunk title (e.g., "Creating Transfers - Step 1: Navigate") |
| `content` | String (Text) | NOT NULL | Actual markdown content chunk |
| `embedding` | vector(1536) | NOT NULL | Vector embedding for semantic search |
| `metadata` | JSON | NULLABLE | Metadata (category, tags, relatedDocs) |
| `createdAt` | DateTime | DEFAULT now() | Record creation timestamp |
| `updatedAt` | DateTime | AUTO UPDATE | Last modification timestamp |

**Indexes:**
- `@@index([documentId])` - Chunks per document

**Notes:**
- Vector embedding generated using OpenAI `text-embedding-3-small` (1536 dimensions)
- Enables semantic search for relevant documentation
- Chunks created during documentation ingestion pipeline
- Metadata example: `{"category": "stock-transfers", "tags": ["transfer", "create"], "relatedDocs": [...]}`
- PostgreSQL pgvector extension required

---

### 30. ChatAnalytics

**Purpose:** Aggregated daily metrics for AI chatbot usage tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PK | Unique metric record identifier |
| `tenantId` | String | FK → Tenant, NOT NULL | Tenant ownership |
| `date` | Date | NOT NULL | Date for this metric snapshot |
| `totalConversations` | Int | DEFAULT 0 | New conversations started on this date |
| `totalMessages` | Int | DEFAULT 0 | Total messages sent (user + assistant) |
| `uniqueUsers` | Int | DEFAULT 0 | Distinct users who chatted |
| `toolCalls` | JSON | NULLABLE | Tool usage counts (see below) |
| `avgMessagesPerConversation` | Float | NULLABLE | Average conversation length |
| `avgResponseTimeMs` | Int | NULLABLE | Average assistant response time (milliseconds) |
| `createdAt` | DateTime | DEFAULT now() | Record creation timestamp |
| `updatedAt` | DateTime | AUTO UPDATE | Last modification timestamp |

**Unique Constraints:**
- `@@unique([tenantId, date])` - One metric record per tenant per day

**Indexes:**
- `@@index([tenantId, date])` - Time-series queries

**Relations:**
- `tenant` → Tenant (onDelete: Cascade)

**toolCalls JSON Structure:**
```json
{
  "searchProducts": 45,
  "searchTransfers": 32,
  "createTransfer": 8,
  "approveTransfer": 5,
  "receiveStock": 12,
  "checkStockLevels": 28
}
```

**Notes:**
- Populated by nightly aggregation job
- Tracks chatbot adoption and usage patterns
- Tool usage helps identify most valuable AI features
- Response time monitoring for performance optimization

---

**Last Updated:** 2025-10-19
**Document Version:** 2.0
**Total Tables:** 41 (16 core + 10 stock transfer + 4 AI chatbot + 11 supporting)
