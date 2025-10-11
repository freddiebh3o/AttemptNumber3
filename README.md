# Multi-Tenant Admin & Inventory Management System

A production-ready multi-tenant admin platform with **role-based access control (RBAC)**, **branch-level inventory management**, **FIFO stock costing**, **comprehensive audit logging**, and **type-safe OpenAPI contract** generation.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [API Surface](#api-surface)
- [RBAC Model](#rbac-model)
- [Local Setup](#local-setup)
- [Development Workflow](#development-workflow)
- [Testing & QA](#testing--qa)
- [CI/CD](#cicd)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Glossary](#glossary)
- [Appendix](#appendix)

---

## Overview

### What It Does

This system provides a complete **multi-tenant administration platform** for businesses managing inventory across multiple physical locations (branches). Key capabilities:

- **Multi-tenant isolation** - Each tenant (company) has separate data, users, roles, and branding
- **Branch-based inventory** - Track stock across warehouses, stores, or distribution centers
- **FIFO stock costing** - Automatic first-in-first-out lot tracking with unit cost valuation
- **Granular RBAC** - 12 permissions across 4 system roles (OWNER, ADMIN, EDITOR, VIEWER)
- **Full audit trail** - Append-only event log for all entities and stock movements
- **Type-safe API contract** - OpenAPI 3.0 spec auto-generated from Zod schemas

### Tech Stack

**Backend** (`api-server/`)
- Node.js 20+ with Express
- PostgreSQL (via Prisma ORM)
- Cookie-based JWT sessions
- OpenAPI 3.0 + Swagger UI
- Pino structured logging

**Frontend** (`admin-web/`)
- React 19 + Vite
- Mantine UI v8 + TailwindCSS
- Zustand state management
- React Router v7
- TypeScript types auto-generated from OpenAPI

**Infrastructure**
- GitHub Actions (BMAD workflow)
- Supabase (PostgreSQL)
- Render (API hosting)
- Vercel (frontend hosting)

### High-Level Architecture

```mermaid
graph LR
    U[User Browser] -->|HTTPS + Cookies| FE[Admin Web<br/>React + Vite]
    FE -->|REST API<br/>JSON + JWT Cookie| API[API Server<br/>Express + Prisma]
    API -->|SQL| DB[(PostgreSQL<br/>Supabase)]

    API -->|Generate| OAS[OpenAPI Spec<br/>/openapi.json]
    OAS -->|openapi-typescript| FE

    API -->|Log Events| LOG[Pino Logger<br/>Correlation IDs]
    API -->|Audit Trail| DB

    style FE fill:#e3f2fd
    style API fill:#fff3e0
    style DB fill:#f3e5f5
    style OAS fill:#e8f5e9
```

**Request Flow:**
1. User authenticates → API sets signed JWT cookie
2. Subsequent requests include cookie → middleware decodes `currentUserId` + `currentTenantId`
3. RBAC middleware checks permissions via `Role` → `Permission` join
4. Business logic executes (transactions for stock operations)
5. Audit events logged to `AuditEvent` table
6. Correlation ID tracks request across logs and error responses

---

## Features

### Authentication & Sessions
- **Cookie-based JWT** with configurable `SameSite` mode (`lax` for local, `none` for prod)
- Session contains `{ currentUserId, currentTenantId }`
- Middleware: `sessionMiddleware` decodes cookie → sets `req.currentUserId` / `req.currentTenantId`
- Auto-logout on invalid/expired tokens

### Multi-Tenancy & RBAC
- **Tenant** = top-level organization (company, client)
- **User** can belong to multiple tenants via `UserTenantMembership`
- **Roles** per tenant with many-to-many `Permission` mapping
- **12 Permissions**: `products:{read,write}`, `users:manage`, `roles:manage`, `tenant:manage`, `theme:manage`, `uploads:write`, `branches:manage`, `stock:{read,write,allocate}`
- **4 System Roles**: OWNER (all perms), ADMIN (no `roles:manage`/`tenant:manage`), EDITOR (read/write products+stock), VIEWER (read-only)
- **Enforcement**:
  - Backend: `requirePermission(key)` middleware in routes
  - Frontend: `<RequirePermission perm="...">` wrapper + `useAuthStore().hasPerm(key)`

### Branch Management
- Physical locations within a tenant (warehouses, stores, etc.)
- Unique `branchSlug` per tenant
- User-branch assignments via `UserBranchMembership` (many-to-many)
- Active/inactive status toggle
- UI: Branch list/detail pages with permission guards

### Products & Inventory
- **Product** scoped to tenant with unique SKU
- **Optimistic locking** via `entityVersion` field (prevents concurrent update conflicts)
- Prices stored in **pence** (GBP minor units)
- Full CRUD with idempotency support (`Idempotency-Key` header)

### FIFO Stock Management

**Data Model:**
- **`ProductStock`** - Aggregated qty on hand per branch+product (denormalized for speed)
- **`StockLot`** - Individual receipts with `unitCostPence`, `qtyReceived`, `qtyRemaining`, `receivedAt`
- **`StockLedger`** - Append-only log of movements (`RECEIPT`, `ADJUSTMENT`, `CONSUMPTION`, `REVERSAL`)

**Operations:**
- **Receipt** (`POST /api/stock/receive`) - Creates new lot, increments `ProductStock.qtyOnHand`
- **Adjustment** (`POST /api/stock/adjust`) - Positive/negative qty change with reason (audit trail)
- **Consumption** (`POST /api/stock/consume`) - Drains oldest lots first (FIFO), logs ledger entries

**Service Layer:**
- `stockService.ts` handles FIFO logic, transactions, and ledger writes
- All operations atomic (Prisma transactions)
- Actor tracking: `actorUserId` captured in `StockLedger`

### Audit Logging
- **`AuditEvent`** model tracks all entity changes
- Fields: `entityType`, `entityId`, `action`, `actorUserId`, `beforeJson`, `afterJson`, `diffJson`
- Indexed by tenant, entity, actor, action, correlationId
- UI: Audit log page (`/audit`) for admins

### API Contract & Type Safety
- **OpenAPI 3.0 spec** auto-generated from Zod schemas (`@asteasolutions/zod-to-openapi`)
- Served at `GET /openapi.json` + Swagger UI at `/docs`
- **Frontend type generation**: `npm run openapi:gen` → `admin-web/src/types/openapi.d.ts`
- Zero manual DTO duplication, compile-time type safety

### Error Handling & Observability
- **Standard envelope**: All responses use `{ success, data, error }` structure
- **Correlation IDs**: UUIDv4 per request, propagated through logs/errors
- **Rate limiting**: Fixed-window limiter (120 req/min for auth, 600 req/min general)
- **Request logging**: `ApiRequestLog` table captures method, path, status, duration, bodies (truncated)

### Tenant Branding
- **`TenantBranding`** model stores theme presets, color overrides, logo URL
- Frontend applies theme via Mantine `MantineProvider`
- Admin UI for theme customization (`/settings/theme`)

---

## Architecture

### Backend Structure

**Entry Point:** `api-server/src/server.ts` → `app.ts`

**Middleware Stack** (in order):
1. `requestIdMiddleware` - Assigns correlation ID
2. `sessionMiddleware` - Decodes JWT cookie
3. `httpLoggingMiddleware` - Pino HTTP logger
4. `requestLoggingMiddleware` - Logs to `ApiRequestLog` table
5. `rateLimiterMiddleware` - Fixed-window rate limiting
6. Route handlers
7. `standardErrorHandler` - Catches errors, returns envelope

**Routes** (`api-server/src/routes/`):
- `authRouter.ts` - Sign-in, sign-out, session management
- `productRouter.ts` - Product CRUD
- `branchRouter.ts` - Branch CRUD + user assignments
- `stockRouter.ts` - Stock receive/adjust/consume
- `tenantUserRouter.ts` - User-tenant membership CRUD
- `roleRouter.ts` - Role CRUD (custom roles)
- `tenantThemeRouter.ts` - Theme branding
- `uploadRouter.ts` - File uploads (images)
- `auditLoggerRouter.ts` - Audit event queries
- `healthRouter.ts` - Health check (`/api/health`)

**Services** (`api-server/src/services/`):
- `authService.ts` - Session creation, validation
- `products/productService.ts` + `productActivityService.ts`
- `branches/branchService.ts` + `branchActivityService.ts`
- `stockService.ts` - FIFO lot management
- `tenantUsers/tenantUserService.ts` + `tenantUserActivityService.ts`
- `role/roleService.ts` + `roleActivityService.ts` + `roleProvisioningService.ts`
- `theme/tenantThemeService.ts` + `tenantThemeActivityService.ts`
- `permissionService.ts` - RBAC checks
- `auditLoggerService.ts` - Audit event writes
- `uploadService.ts` - File upload handling

**RBAC Catalog** (`api-server/src/rbac/catalog.ts`):
- `PERMISSIONS` array (12 permissions)
- `ROLE_DEFS` object (4 system roles with permission assignments)
- Seeding script: `scripts/seedPermissionsAndRoles.ts`

### Frontend Structure

**Entry Point:** `admin-web/src/main.tsx` → Router setup

**Routing** (React Router v7):
- Public: `/`, `/sign-in`
- Protected: `/:tenantSlug/*` (wrapped in `<AdminLayout>` shell)
  - `/products`, `/products/:productId`, `/products/new`
  - `/branches`, `/branches/:branchId`, `/branches/new`
  - `/users`, `/users/:userId`, `/users/new`
  - `/roles`, `/roles/:roleId`
  - `/settings/theme`
  - `/audit`

**Pages** (`admin-web/src/pages/`):
11 pages total - ProductsPage, ProductPage, BranchesPage, BranchPage, TenantUsersPage, TenantUserPage, RolesPage, RolePage, ThemePage, AuditLogPage, SignInPage

**State Management** (Zustand stores):
- `auth.ts` - Current user, tenant memberships, permissions, sign-in/out
- `theme.ts` - Tenant branding, Mantine theme overrides
- `dirty.ts` - Unsaved changes tracking (form dirty state)

**API Clients** (`admin-web/src/api/`):
- `http.ts` - Base fetch wrapper (handles cookies, errors, correlation IDs)
- Feature modules: `auth.ts`, `products.ts`, `branches.ts`, `stock.ts`, `tenantUsers.ts`, `roles.ts`, `tenantTheme.ts`, `uploads.ts`, `auditLogger.ts`
- All use generated OpenAPI types from `types/openapi.d.ts`

**Permission Guards:**
- Component: `<RequirePermission perm="...">` (hides children if no permission)
- Hook: `usePermissions()` → `{ hasPerm, hasAnyPerm }`
- Store method: `useAuthStore().hasPerm(key)`

### Database Schema (Key Models)

**ERD (Simplified):**

```mermaid
erDiagram
    User ||--o{ UserTenantMembership : belongs
    Tenant ||--o{ UserTenantMembership : has
    Tenant ||--o{ Branch : owns
    Tenant ||--o{ Product : owns
    Tenant ||--o{ Role : defines
    Role ||--o{ RolePermission : has
    Permission ||--o{ RolePermission : granted
    UserTenantMembership }o--|| Role : assigned

    Branch ||--o{ ProductStock : aggregates
    Branch ||--o{ StockLot : stores
    Branch ||--o{ StockLedger : logs
    Product ||--o{ ProductStock : tracked
    Product ||--o{ StockLot : received
    Product ||--o{ StockLedger : moved

    User ||--o{ AuditEvent : performs
    Tenant ||--o{ AuditEvent : scoped

    Tenant ||--|| TenantBranding : customizes
```

**Core Models** (Prisma schema):
- `User` - Global user (can belong to multiple tenants)
- `Tenant` - Top-level org
- `UserTenantMembership` - User ↔ Tenant with `roleId`
- `Role` - Per-tenant role (or global template if `tenantId` null)
- `Permission` - Global permission catalog
- `RolePermission` - Many-to-many join
- `Branch` - Physical location within tenant
- `UserBranchMembership` - User ↔ Branch assignment
- `Product` - Tenant-scoped with `entityVersion` for optimistic locking
- `ProductStock` - Aggregated stock per branch+product
- `StockLot` - FIFO lot with `unitCostPence`, `receivedAt`
- `StockLedger` - Append-only movement log
- `AuditEvent` - Audit trail
- `ApiRequestLog` - HTTP request/response logging
- `TenantBranding` - Theme presets + overrides
- `IdempotencyRecord` - Idempotency key replay storage

### Request Lifecycle Example

**User creates a product:**

1. **Frontend** → `POST /api/products` with JSON body + cookie
2. **requestIdMiddleware** → Assigns `correlationId` = UUID
3. **sessionMiddleware** → Decodes cookie → sets `req.currentUserId`, `req.currentTenantId`
4. **rateLimiterMiddleware** → Checks IP+session quota
5. **Route handler** → `requirePermission('products:write')` middleware
6. **permissionService** → Queries `Role` → `RolePermission` → `Permission` for current user+tenant
7. **productService.create()** → Validates body, checks SKU uniqueness, creates `Product` record
8. **productActivityService.logCreate()** → Writes `AuditEvent` with `beforeJson` (null), `afterJson` (new product)
9. **Response** → `{ success: true, data: { product } }`
10. **httpLoggingMiddleware** → Logs to Pino with `correlationId`
11. **requestLoggingMiddleware** → Writes `ApiRequestLog` row

If error occurs:
- `standardErrorHandler` catches → returns `{ success: false, error: { errorCode, correlationId, ... } }`

---

## API Surface

### Endpoint Table

| Method | Path | Purpose | Permissions |
|--------|------|---------|-------------|
| **Auth** ||||
| POST | `/api/auth/sign-in` | Create session | Public |
| POST | `/api/auth/sign-out` | Destroy session | Authenticated |
| GET | `/api/auth/me` | Get current user + memberships | Authenticated |
| POST | `/api/auth/switch-tenant` | Change active tenant | Authenticated |
| **Products** ||||
| GET | `/api/products` | List products | `products:read` |
| GET | `/api/products/:productId` | Get product detail | `products:read` |
| POST | `/api/products` | Create product | `products:write` |
| PUT | `/api/products/:productId` | Update product | `products:write` |
| DELETE | `/api/products/:productId` | Delete product | `products:write` |
| **Branches** ||||
| GET | `/api/branches` | List branches | `branches:manage` |
| GET | `/api/branches/:branchId` | Get branch detail | `branches:manage` |
| POST | `/api/branches` | Create branch | `branches:manage` |
| PUT | `/api/branches/:branchId` | Update branch | `branches:manage` |
| DELETE | `/api/branches/:branchId` | Delete branch | `branches:manage` |
| **Stock** ||||
| POST | `/api/stock/receive` | Record stock receipt | `stock:write` |
| POST | `/api/stock/adjust` | Adjust stock qty | `stock:write` |
| POST | `/api/stock/consume` | Consume stock (FIFO) | `stock:allocate` |
| **Users** ||||
| GET | `/api/tenant-users` | List tenant users | `users:manage` |
| POST | `/api/tenant-users` | Invite/create user | `users:manage` |
| PUT | `/api/tenant-users/:userId` | Update user/role | `users:manage` |
| DELETE | `/api/tenant-users/:userId` | Remove from tenant | `users:manage` |
| **Roles** ||||
| GET | `/api/roles` | List tenant roles | `roles:manage` |
| POST | `/api/roles` | Create custom role | `roles:manage` |
| PUT | `/api/roles/:roleId` | Update role permissions | `roles:manage` |
| DELETE | `/api/roles/:roleId` | Delete role | `roles:manage` |
| **Theme** ||||
| GET | `/api/tenant/theme` | Get tenant branding | `theme:manage` |
| PUT | `/api/tenant/theme` | Update theme | `theme:manage` |
| POST | `/api/tenant/theme/logo` | Upload logo | `theme:manage` |
| **Audit** ||||
| GET | `/api/audit-events` | Query audit log | `users:manage` |
| **System** ||||
| GET | `/api/health` | Health check | Public |
| GET | `/openapi.json` | OpenAPI spec | Public |
| GET | `/docs` | Swagger UI | Public |

### OpenAPI Spec

**Location:** `GET /openapi.json` (auto-generated from Zod schemas)

**Generation Flow:**
1. Define Zod schemas in `api-server/src/openapi/paths/*.ts`
2. Register in `openapi/index.ts` via `registry.registerPath()`
3. Server builds spec on startup → `buildOpenApiDocument()`
4. Served at `/openapi.json` + Swagger UI at `/docs`

**Frontend Type Generation:**
```bash
cd admin-web
npm run openapi:gen  # Fetches http://localhost:4000/openapi.json
# Outputs to src/types/openapi.d.ts
```

### Standard Envelope Examples

**Success Response:**
```json
{
  "success": true,
  "data": {
    "product": {
      "id": "cm...",
      "productName": "Widget",
      "productSku": "WDG-001",
      "productPricePence": 1999,
      "entityVersion": 1
    }
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "data": null,
  "error": {
    "errorCode": "VALIDATION_ERROR",
    "httpStatusCode": 400,
    "userFacingMessage": "Invalid request body",
    "developerMessage": "productSku must be unique within tenant",
    "correlationId": "af8da79c-bc7b-4e1a-9f3c-1234567890ab"
  }
}
```

**Rate Limit Headers:**
```
X-RateLimit-Limit: 600
X-RateLimit-Remaining: 599
X-RateLimit-Reset: 1640995200
Retry-After: 60  (only when exhausted)
```

---

## RBAC Model

### Permission Catalog

Defined in `api-server/src/rbac/catalog.ts`:

```typescript
export const PERMISSIONS = [
  { key: 'products:read',  description: 'View products' },
  { key: 'products:write', description: 'Create/update/delete products' },
  { key: 'users:manage',   description: 'Invite or manage tenant users' },
  { key: 'roles:manage',   description: 'Create/edit roles and permissions' },
  { key: 'tenant:manage',  description: 'Manage tenant settings' },
  { key: 'theme:manage',   description: 'Manage tenant theme/branding' },
  { key: 'uploads:write',  description: 'Upload images/files' },
  { key: 'branches:manage', description: 'Manage branches and memberships' },
  { key: 'stock:read',      description: 'View branch stock, lots, and movements' },
  { key: 'stock:write',     description: 'Receive and adjust stock' },
  { key: 'stock:allocate',  description: 'Allocate/consume stock for orders' },
]
```

### System Roles

| Role | Permissions | Typical Use Case |
|------|-------------|------------------|
| **OWNER** | All 12 permissions | Tenant owner, full control |
| **ADMIN** | All except `roles:manage`, `tenant:manage` | Manager, can't change roles/settings |
| **EDITOR** | `products:{read,write}`, `uploads:write`, `stock:{read,allocate}` | Warehouse staff, sales team |
| **VIEWER** | `products:read`, `stock:read` | Read-only access |

**Custom Roles:**
- Admins with `roles:manage` permission can create per-tenant custom roles
- Example: "Warehouse Manager" with `branches:manage` + `stock:{read,write,allocate}`

### Enforcement Points

**Backend:**
```typescript
// api-server/src/routes/productRouter.ts
router.post(
  '/products',
  requireAuthenticatedUserMiddleware,
  requirePermission('products:write'),  // ← Check here
  async (req, res) => { /* handler */ }
)
```

**Frontend:**
```tsx
// admin-web/src/pages/ProductsPage.tsx
<RequirePermission perm="products:write">
  <Button onClick={handleCreate}>Create Product</Button>
</RequirePermission>

// Or programmatic:
const { hasPerm } = usePermissions()
if (hasPerm('products:write')) {
  // Show edit UI
}
```

---

## Local Setup

### Prerequisites

- **Node.js** 20+ (LTS)
- **PostgreSQL** 14+ (or Supabase account)
- **npm** 10+

### Environment Variables

**API Server** (`api-server/.env`):

```bash
# Database (use Session Pooler URL for Supabase/Render)
DATABASE_URL=postgresql://user:password@localhost:5432/dbname?sslmode=require

# Server
SERVER_PORT=4000
NODE_ENV=development

# Auth
SESSION_JWT_SECRET=your-secret-key-min-32-chars
SESSION_COOKIE_NAME=mt_session
COOKIE_SAMESITE_MODE=lax  # Use 'none' for prod cross-site

# CORS
FRONTEND_ORIGIN=http://localhost:5174
FRONTEND_DEV_ORIGIN=http://localhost:5174

# Logging
LOG_LEVEL=debug
PRETTY_LOGS=true

# Supabase (optional, for admin client)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Admin Web** (`admin-web/.env`):

```bash
VITE_API_BASE_URL=http://localhost:4000
```

**Important:**
- `FRONTEND_ORIGIN` must match Vite port exactly (no trailing slash)
- For local dev, use `COOKIE_SAMESITE_MODE=lax` with `http://localhost`
- For prod cross-site, use `COOKIE_SAMESITE_MODE=none` (requires HTTPS)
- `DATABASE_URL` for Render/Supabase should use **Session Pooler (IPv4)** endpoint

### Install & Run

**Using Makefile (recommended):**

```bash
# Install all dependencies
make install

# Run API dev server (watch mode)
make dev-api

# Run admin web dev server (separate terminal)
make dev-web
```

**Manual (per workspace):**

```bash
# API Server
cd api-server
npm install
npm run prisma:generate          # Generate Prisma client
npm run db:migrate -- --name init  # Create initial migration
npm run db:seed                  # Seed demo data
npm run dev                      # Start server (http://localhost:4000)

# Admin Web (separate terminal)
cd admin-web
npm install
npm run dev                      # Start Vite (http://localhost:5174)
```

### Database Setup

**Initial Schema:**

```bash
cd api-server
npm run prisma:generate          # Regenerate client after schema changes
npm run db:migrate -- --name init  # Create and apply migration in dev
npm run db:seed                  # Seed tenants, users, products
```

**Seed Data Includes:**
- 2 demo tenants (Acme Corp, Test Co)
- Test users (owner@acme.com / admin@acme.com / editor@acme.com / viewer@acme.com)
- Default password: `password123`
- Sample products
- RBAC permissions and roles

**RBAC Seeding (after schema changes):**

```bash
cd api-server
npm run seed:rbac        # Sync permissions and roles to DB
npm run seed:test-users  # Create test users for all tenants
```

**Reset Database (destructive!):**

```bash
cd api-server
npm run db:reset:dev  # Drop DB, reapply migrations, re-seed
```

### OpenAPI → Frontend Type Generation

**Workflow:**
1. Make changes to Zod schemas in `api-server/src/openapi/paths/*.ts`
2. Restart API server (spec regenerates on startup)
3. Run type generation in admin-web:

```bash
cd admin-web
npm run openapi:gen  # Fetches /openapi.json, generates types
```

This updates `admin-web/src/types/openapi.d.ts` with TypeScript types for all endpoints.

---

## Development Workflow

### Common Scripts

**API Server** (`api-server/`):

```bash
npm run dev                      # Hot-reload dev server (tsx watch)
npm run build                    # Compile TypeScript → dist/
npm run start                    # Production (migrate + start)
npm run typecheck                # Type check without emitting
npm run test:accept              # Run Jest acceptance tests
npm run test:accept:watch        # Watch mode
npm run test:accept:coverage     # Coverage report

# Prisma
npm run prisma:generate          # Regenerate client
npm run db:migrate -- --name foo # Create migration (dev)
npm run db:deploy                # Apply migrations (CI/prod)
npm run db:studio                # Visual DB browser
npm run db:seed                  # Seed demo data
npm run db:reset:dev             # Reset DB (destructive)

# RBAC
npm run seed:rbac                # Sync permissions/roles
npm run seed:test-users          # Seed test users
```

**Admin Web** (`admin-web/`):

```bash
npm run dev                      # Vite dev server (port 5174)
npm run build                    # Build for production
npm run preview                  # Preview prod build
npm run typecheck                # Type check
npm run lint                     # ESLint
npm run test:accept              # Playwright E2E tests
npm run test:accept:ui           # Playwright UI mode
npm run test:accept:debug        # Debug mode
npm run openapi:gen              # Generate types from OpenAPI
```

### Makefile Targets

```bash
# BMAD Workflow (CI tasks)
make bmad-plan                   # Validate BMAD docs exist
make bmad-test-api               # Typecheck + build API
make bmad-test-web               # Typecheck + lint + build web
make bmad-accept-api             # Run API acceptance tests (Jest)
make bmad-accept-web             # Run web E2E tests (Playwright)
make bmad-accept-all             # All acceptance tests

# Development
make dev-api                     # Start API watch mode
make dev-web                     # Start Vite dev server
make db-migrate                  # Create Prisma migration
make db-seed                     # Seed database
make install                     # Install all workspace deps
```

### Typical Workflows

**Add a New Permission:**

1. Add to `PERMISSIONS` array in `api-server/src/rbac/catalog.ts`:
   ```typescript
   { key: 'reports:view', description: 'View reports' }
   ```
2. Assign to roles in `ROLE_DEFS` (same file):
   ```typescript
   OWNER: [..., 'reports:view'],
   ADMIN: [..., 'reports:view'],
   ```
3. Sync to database:
   ```bash
   cd api-server
   npm run seed:rbac
   ```
4. Use in backend:
   ```typescript
   router.get('/reports', requirePermission('reports:view'), ...)
   ```
5. Use in frontend:
   ```tsx
   <RequirePermission perm="reports:view">...</RequirePermission>
   ```

**Add a New Endpoint:**

1. **Backend:**
   - Create service: `api-server/src/services/reports/reportService.ts`
   - Create router: `api-server/src/routes/reportsRouter.ts`
   - Mount in `api-server/src/routes/index.ts`:
     ```typescript
     import { reportsRouter } from './reportsRouter.js'
     apiRouter.use('/reports', reportsRouter)
     ```

2. **OpenAPI:**
   - Add schemas: `api-server/src/openapi/paths/reports.ts`
   - Register in `api-server/src/openapi/index.ts`:
     ```typescript
     registry.registerPath({ ... })
     ```

3. **Frontend:**
   - Restart API server (regenerates spec)
   - Generate types:
     ```bash
     cd admin-web
     npm run openapi:gen
     ```
   - Create API client: `admin-web/src/api/reports.ts`
   - Create page: `admin-web/src/pages/ReportsPage.tsx`
   - Add route in `admin-web/src/main.tsx`

**Database Migration:**

1. Edit `api-server/prisma/schema.prisma`
2. Regenerate client:
   ```bash
   npm run prisma:generate
   ```
3. Create migration:
   ```bash
   npm run db:migrate -- --name add_reports_table
   ```
4. (Optional) Update seed script and re-seed:
   ```bash
   npm run db:seed
   ```
5. Restart API server if running

---

## Testing & QA

### Test Structure

**API Acceptance Tests** (Jest + Supertest):
- Location: `api-server/__tests__/**/*.test.ts`
- Config: `api-server/jest.config.js`
- Mapped to stories/ACs (e.g., `[ST-001][AC-001-1]`)

**Web E2E Tests** (Playwright):
- Location: `admin-web/e2e/**/*.spec.ts`
- Config: `admin-web/playwright.config.ts`
- Mapped to acceptance criteria (e.g., `[ST-001] Sign-in Page`, `[AC-001-1]`)

### Running Tests

**API Tests:**

```bash
cd api-server
npm run test:accept              # Run all Jest tests
npm run test:accept:watch        # Watch mode
npm run test:accept:coverage     # With coverage report
```

**Web E2E Tests:**

```bash
cd admin-web
npm run test:accept              # Headless mode
npm run test:accept:ui           # Interactive UI mode
npm run test:accept:debug        # Debug mode with breakpoints
npm run test:accept:report       # View last HTML report
```

### Mapping to Stories/ACs

Tests follow BMAD (Build-Measure-Analyze-Deploy) convention:

- **ST-###** - Story ID (from `docs/bmad/PRD.md`)
- **AC-###-#** - Acceptance Criteria ID (from `docs/bmad/QA.md`)

Example:
```typescript
// admin-web/e2e/signin.spec.ts
test.describe('[ST-001] Sign-in Page', () => {
  test('[AC-001-1] should display email input field', async ({ page }) => {
    // ...
  })
})
```

**Current Test Coverage:**
- Sign-in page E2E (7 acceptance criteria)
- Health check API (basic smoke test)
- _(Additional tests to be added per sprint stories)_

### QA Stage Gates

From `docs/bmad/QA.md`:

**Plan (Exit):**
- [ ] All acceptance criteria defined
- [ ] API contracts documented
- [ ] Test data requirements identified

**Build (Exit):**
- [ ] All AC-### items have passing tests
- [ ] OpenAPI types regenerated
- [ ] No TypeScript errors

**QA (Entry):**
- [ ] PR submitted with test evidence
- [ ] All CI checks passing

**QA (Exit):**
- [ ] Manual testing completed for each AC
- [ ] Audit logs verified
- [ ] Permission checks validated

---

## CI/CD

### GitHub Actions Workflow

**File:** `.github/workflows/bmad.yml`

**Trigger:** Pull requests to `main` branch

**Jobs:**

1. **test-api**
   - Runs on: `ubuntu-latest`, Node 20
   - Steps:
     - Checkout code
     - Install deps (`npm ci`)
     - Install test deps (jest, ts-jest, supertest)
     - Run `make bmad-test-api` (typecheck + build)
   - Env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (from secrets)

2. **test-web**
   - Runs on: `ubuntu-latest`, Node 20
   - Steps:
     - Checkout code
     - Install deps (`npm ci`)
     - Install Playwright browsers
     - Run `npm run test:accept` (E2E tests)

**Required Checks:**
- `BMAD / test-api` - Must pass
- `BMAD / test-web` - Must pass

**Branch Protection:**
- Require status checks before merging
- Require PR approval (recommended)

### Local CI Simulation

Run the same checks locally before pushing:

```bash
# Full BMAD workflow
make bmad-plan           # Validate docs
make bmad-test-api       # API typecheck + build
make bmad-test-web       # Web typecheck + lint + build
make bmad-accept-all     # All acceptance tests
```

---

## Deployment

### Current Stack

- **Database:** Supabase (PostgreSQL with Session Pooler)
- **API:** Render (Node.js web service)
- **Frontend:** Vercel (static React app)

### Deployment Flow

**API (Render):**

1. **Build Command:** `npm ci && npm run build && npx prisma generate`
2. **Start Command:** `npm run start` (runs `prisma migrate deploy && node dist/server.js`)
3. **Environment Variables:**
   ```
   NODE_ENV=production
   SERVER_PORT=4000
   DATABASE_URL=<Supabase Session Pooler URL>
   SESSION_JWT_SECRET=<strong random value>
   SESSION_COOKIE_NAME=mt_session
   COOKIE_SAMESITE_MODE=none
   FRONTEND_ORIGIN=https://yourapp.vercel.app
   LOG_LEVEL=info
   PRETTY_LOGS=false
   ```

**Frontend (Vercel):**

1. **Framework Preset:** Vite
2. **Build Command:** `npm run build`
3. **Output Directory:** `dist`
4. **Environment Variables:**
   ```
   VITE_API_BASE_URL=https://your-api.onrender.com
   ```

### CORS & Cookie Constraints

**Critical for Production:**

1. **CORS:**
   - `FRONTEND_ORIGIN` must match Vercel domain exactly (no trailing slash)
   - Add to `app.ts` allowlist: `allowedOrigins` array

2. **Cookies:**
   - Cross-site (Vercel → Render): Set `COOKIE_SAMESITE_MODE=none`
   - Requires HTTPS (Secure flag set automatically)
   - Browser must allow 3rd-party cookies

3. **Common Pitfalls:**
   - ✅ `https://myapp.vercel.app` → Works
   - ❌ `https://myapp.vercel.app/` → CORS blocked (trailing slash)
   - ✅ `COOKIE_SAMESITE_MODE=none` + HTTPS → Works
   - ❌ `COOKIE_SAMESITE_MODE=lax` + HTTPS → Cookie not sent cross-site

### Observability & Logging

**Structured Logs (Pino):**
- JSON format in production (`PRETTY_LOGS=false`)
- Fields: `correlationId`, `currentUserId`, `currentTenantId`, `statusCode`, `responseTime`
- Ship to log aggregator (e.g., Datadog, LogDNA, CloudWatch)

**Correlation IDs:**
- Every request gets UUID
- Propagated through logs and error responses
- Use to trace failures: grep logs by `correlationId`

**Database Logging:**
- `ApiRequestLog` table captures HTTP requests (useful for debugging)
- `AuditEvent` table tracks all entity changes
- `StockLedger` table is append-only log of stock movements

**Health Checks:**
- `GET /api/health` - Simple liveness probe
- Add DB ping check for readiness probe

### Monitoring (Planned)

From existing README "Future features":
- [ ] Sentry for error tracking
- [ ] Uptime monitor (e.g., Pingdom, UptimeRobot)
- [ ] Prometheus metrics (optional)

---

## Roadmap

### Near-Term (Sprint 2)

**From existing README:**

- [x] Branch management ✅
- [x] FIFO stock operations (receipt, adjustment) ✅
- [ ] **Stock transfers between branches** (in progress)
  - Transfer request workflow: `REQUESTED` → `ORDERED` → `PARTIALLY_RECEIVED` / `COMPLETE` / `REJECTED`
  - Two-step ledger: source branch consumption + dest branch receipt
- [ ] **Session expiry handling**
  - Auto-redirect to sign-in page on 401
  - Show clear expiry reason on login page
  - Frontend session refresh mechanism
- [ ] **UI/UX improvements**
  - Stay on edit page after save (don't redirect to index)
  - Fix table pagination (lock to bottom, scroll body only)

### Mid-Term

**From "Future features" section:**

- [ ] **Purchasing module**
  - Purchase orders to suppliers (`DRAFT` → `ORDERED` → `PARTIALLY_RECEIVED` → `COMPLETE`)
  - Auto-update stock ledger on receipt completion
- [ ] **Sales module**
  - Quotes, sales orders, picking notes, invoicing
  - Ledger account integration (credit customers)
  - Stock allocation/reservation on order creation
- [ ] **Dashboard**
  - KPI tiles (stock value, low stock alerts, recent orders)
  - Charts (sales trends, stock movements)
- [ ] **Reporting**
  - Stock valuation report (FIFO cost per branch)
  - Aged stock report (identify slow-moving items)
  - Product transaction log (all movements for a product)
  - Nominal transactions (financial reconciliation)

### Long-Term

- [ ] **Multi-costing methods** (feature flag)
  - FIFO (current) / LIFO / Weighted Average / Specific ID / FEFO
- [ ] **CMS integration**
  - Product catalog for e-commerce
  - Public-facing inventory API
- [ ] **Global search**
  - Search products, customers, suppliers, orders from navbar
- [ ] **AI support** (experimental)
  - Chatbot for inventory queries
  - Predictive stock suggestions

### Known Gaps & Risks

**From PRD/ARCH:**
- **Branch-level permissions** - Currently only tenant-level RBAC; future: restrict users to specific branches
- **Concurrent stock operations** - Mitigated by DB transactions + optimistic locking; add integration tests
- **FIFO performance** - Lot scanning may slow down with thousands of lots; consider archiving consumed lots
- **Idempotency TTL** - `IdempotencyRecord` cleanup job not implemented; may grow unbounded

---

## Glossary

### Domain Terms

- **Tenant** - Top-level organization (company, client) with isolated data
- **Branch** - Physical location within a tenant (warehouse, store, distribution center)
- **User** - Global user account that can belong to multiple tenants
- **UserTenantMembership** - Join table linking user to tenant with a role
- **UserBranchMembership** - Join table assigning user to specific branches
- **Product** - Tenant-scoped item with SKU, price, and stock tracking
- **ProductStock** - Aggregated quantity on hand per branch+product (denormalized)
- **StockLot** - Individual receipt batch with FIFO tracking (qty received, qty remaining, unit cost, received date)
- **StockLedger** - Append-only log of all stock movements (RECEIPT, ADJUSTMENT, CONSUMPTION, REVERSAL)
- **FIFO** - First-In-First-Out costing method (oldest lots consumed first)
- **Optimistic Locking** - Concurrency control using version field (prevents lost updates)
- **Idempotency** - Ability to safely retry requests (same `Idempotency-Key` returns cached response)
- **Correlation ID** - UUID tracking a single request through logs and errors
- **Envelope** - Standard API response wrapper: `{ success, data, error }`

### Testing Conventions

- **ST-###** - Story ID from `docs/bmad/PRD.md` (e.g., `ST-001: Branch Management`)
- **AC-###-#** - Acceptance Criteria ID from `docs/bmad/QA.md` (e.g., `AC-001-1: Admin can create branch`)
- **BMAD** - Build-Measure-Analyze-Deploy workflow (stage gates for PRD → ARCH → QA → Release)

### Technical Terms

- **Zod** - TypeScript-first schema validation library (used for API contracts)
- **Prisma** - Next-gen ORM for Node.js (type-safe database client)
- **Pino** - High-performance JSON logger for Node.js
- **Mantine** - React component library (UI framework)
- **Zustand** - Lightweight state management for React
- **OpenAPI** - API specification standard (formerly Swagger)
- **Session Pooler** - Supabase connection pooling mode (required for serverless/Render)
- **Minor Units** - Smallest currency denomination (pence for GBP, cents for USD)

---

## Appendix

### Documentation Links

**BMAD Artifacts** (in `docs/bmad/`):
- [PRD.md](docs/bmad/PRD.md) - Product Requirements (Sprint 1: Stock Management & Branch Operations)
- [ARCH.md](docs/bmad/ARCH.md) - Architecture decisions and API contracts
- [QA.md](docs/bmad/QA.md) - Acceptance criteria and stage gates

**Codebase Guide:**
- [CLAUDE.md](CLAUDE.md) - Developer instructions for Claude Code (AI assistant)

### Key Files Reference

**Backend:**
- `api-server/src/app.ts` - Express app setup, middleware order
- `api-server/src/rbac/catalog.ts` - RBAC permissions and roles
- `api-server/prisma/schema.prisma` - Database schema
- `api-server/src/openapi/index.ts` - OpenAPI spec builder
- `api-server/src/services/stockService.ts` - FIFO lot management

**Frontend:**
- `admin-web/src/main.tsx` - React Router setup
- `admin-web/src/stores/auth.ts` - Auth state and permissions
- `admin-web/src/api/http.ts` - HTTP client base
- `admin-web/src/types/openapi.d.ts` - Generated API types

### Contact & Support

- **Issues:** [GitHub Issues](https://github.com/your-org/your-repo/issues)
- **Discussions:** [GitHub Discussions](https://github.com/your-org/your-repo/discussions)
- **Docs:** This README + `docs/bmad/` + `CLAUDE.md`

---

**Generated:** 2025-10-11 | **Version:** Sprint 1 (Stock Management & Branches)
