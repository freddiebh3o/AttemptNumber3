# Project Architecture

## Project Overview

**Multi-Tenant Inventory Management System** - A comprehensive SaaS platform for managing products, stock, branches, and users across multiple tenant organizations with fine-grained role-based access control (RBAC).

### Core Features
- Multi-tenant architecture with complete data isolation
- Role-based access control (RBAC) with custom roles per tenant
- Product catalog management with optimistic locking
- Multi-branch inventory tracking with FIFO stock consumption
- Audit logging for compliance and traceability
- Tenant-specific theming and branding
- Session-based authentication with JWT tokens
- Idempotent API operations
- Rate limiting and request logging

---

## Technology Stack

### Backend (API Server)
**Location:** `api-server/`

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Runtime** | Node.js | Latest LTS | JavaScript runtime |
| **Language** | TypeScript | ^5.5.4 | Type-safe development |
| **Framework** | Express.js | ^4.19.2 | HTTP server framework |
| **Database** | PostgreSQL | 14+ | Primary data store |
| **ORM** | Prisma | ^6.16.2 | Database modeling and migrations |
| **Validation** | Zod | ^4.1.11 | Schema validation |
| **Authentication** | JWT + Cookies | jsonwebtoken ^9.0.2 | Session management |
| **Logging** | Pino | ^9.11.0 | Structured logging |
| **API Docs** | OpenAPI 3.1 | @asteasolutions/zod-to-openapi ^8.1.0 | Auto-generated API documentation |
| **Security** | Helmet | ^8.1.0 | Security headers |
| **CORS** | cors | ^2.8.5 | Cross-origin resource sharing |
| **File Upload** | Multer | ^2.0.2 | Multipart/form-data handling |
| **Testing** | Jest + Supertest | ^29.7.0 | Acceptance testing |

**Key Dependencies:**
- `@prisma/client` - Generated Prisma client for type-safe database access
- `@supabase/supabase-js` - Supabase storage integration for file uploads
- `cookie-parser` - Parse HTTP cookies
- `dotenv` - Environment variable management
- `uuid` - Generate unique identifiers
- `bcryptjs` - Password hashing

### Frontend (Admin Web)
**Location:** `admin-web/`

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Runtime** | Browser | - | Client-side execution |
| **Language** | TypeScript | ^5.9.2 | Type-safe development |
| **Framework** | React | ^19.1.1 | UI library |
| **Routing** | React Router | ^7.9.2 | Client-side routing |
| **Build Tool** | Vite | ^7.1.7 | Fast development and bundling |
| **UI Library** | Mantine | ^8.3.2 | Component library |
| **Styling** | Tailwind CSS | ^4.1.13 | Utility-first CSS |
| **State** | Zustand | ^5.0.8 | Lightweight state management |
| **Icons** | Tabler Icons | ^3.35.0 | Icon set |
| **Date Handling** | Day.js | ^1.11.18 | Date/time utilities |
| **E2E Testing** | Playwright | ^1.49.1 | End-to-end testing |
| **Type Generation** | openapi-typescript | ^7.9.1 | Generate types from OpenAPI spec |

**Key Dependencies:**
- `@mantine/core` - Core UI components
- `@mantine/hooks` - Utility hooks
- `@mantine/notifications` - Toast notifications
- `@mantine/dates` - Date picker components
- `@emotion/react` - CSS-in-JS for Mantine styling
- `react-dom` - React DOM rendering

### Infrastructure & Deployment

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Database Hosting** | Supabase / Render | Managed PostgreSQL |
| **Object Storage** | Supabase Storage | File uploads (logos, images) |
| **API Hosting** | Render / Railway | Backend deployment |
| **Frontend Hosting** | Vercel | Frontend deployment |
| **CI/CD** | GitHub Actions (planned) | Automated testing and deployment |

---

## Architecture Patterns

### 1. Monorepo Structure

```
AttemptNumber3/
├── api-server/          # Backend service
│   ├── prisma/          # Database schema & migrations
│   ├── scripts/         # Utility scripts (seeding, etc.)
│   └── src/
│       ├── app.ts       # Express app configuration
│       ├── server.ts    # HTTP server entry point
│       ├── db/          # Database client singleton
│       ├── middleware/  # Express middleware
│       ├── routes/      # API route handlers
│       ├── services/    # Business logic layer
│       ├── openapi/     # OpenAPI schema definitions
│       ├── rbac/        # RBAC permission catalog
│       ├── utils/       # Helper functions
│       ├── types/       # TypeScript type definitions
│       ├── logger/      # Pino logger configuration
│       └── integrations/ # External service integrations (Supabase)
│
├── admin-web/           # Frontend application
│   ├── public/          # Static assets
│   ├── e2e/             # Playwright E2E tests
│   └── src/
│       ├── App.tsx      # Root component
│       ├── main.tsx     # Application entry point
│       ├── api/         # API client modules
│       ├── components/  # Reusable React components
│       ├── pages/       # Route page components
│       ├── stores/      # Zustand state stores
│       ├── hooks/       # Custom React hooks
│       ├── theme/       # Mantine theme configuration
│       ├── types/       # TypeScript type definitions
│       └── utils/       # Helper functions
│
├── .agent/              # Documentation & context
│   ├── README.md        # Documentation index
│   ├── System/          # System architecture docs
│   ├── Tasks/           # Feature PRDs & implementation plans
│   └── SOP/             # Standard operating procedures
│
├── CLAUDE.md            # Claude Code instructions
├── README.md            # Project overview and setup guide
└── Makefile             # Common development commands
```

### 2. Layered Backend Architecture

```
┌─────────────────────────────────────────┐
│         HTTP Layer (Express)            │
│  - CORS, Security Headers (Helmet)      │
│  - Cookie Parser, JSON Body Parser      │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         Middleware Pipeline             │
│  1. Request ID (correlationId)          │
│  2. Session (JWT decode)                │
│  3. HTTP Logging (Pino)                 │
│  4. Request Logging (DB)                │
│  5. Rate Limiting (fixed window)        │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         Route Layer (Routers)           │
│  - Zod validation middleware            │
│  - Permission checks                    │
│  - Idempotency middleware (POST/PUT)    │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         Service Layer                   │
│  - Business logic                       │
│  - Transaction management               │
│  - Activity logging (audit events)      │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         Data Layer (Prisma)             │
│  - Type-safe queries                    │
│  - Database connection pooling          │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         PostgreSQL Database             │
└─────────────────────────────────────────┘
```

### 3. Frontend Architecture

```
┌─────────────────────────────────────────┐
│         React Router (v7)               │
│  - Route definitions                    │
│  - Permission guards                    │
│  - Error boundaries                     │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         Layout Components               │
│  - AdminLayout (shell with nav)         │
│  - RequirePermission wrapper            │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         Page Components                 │
│  - Feature-specific pages               │
│  - Forms, tables, modals                │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         State Management (Zustand)      │
│  - Auth store (user, tenant, perms)     │
│  - Theme store (branding)               │
│  - Dirty state tracker                  │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         API Client Layer                │
│  - HTTP client (fetch wrapper)          │
│  - Feature-specific API modules         │
│  - Type-safe requests (OpenAPI types)   │
└─────────────────────────────────────────┘
```

---

## Multi-Tenancy Architecture

### Tenant Isolation Model

**Hard Tenancy** - Complete data isolation at the database row level using `tenantId` foreign keys. Every tenant-scoped query MUST include a `WHERE tenantId = ?` clause.

```
User (Global) ──┬──> UserTenantMembership ──> Tenant A
                │                               ├─> Products (Tenant A)
                │                               ├─> Branches (Tenant A)
                │                               ├─> Roles (Tenant A)
                │                               └─> Stock Ledgers (Tenant A)
                │
                └──> UserTenantMembership ──> Tenant B
                                                ├─> Products (Tenant B)
                                                ├─> Branches (Tenant B)
                                                ├─> Roles (Tenant B)
                                                └─> Stock Ledgers (Tenant B)
```

### Key Models

#### 1. Global Models
- **User** - Can belong to multiple tenants
- **Permission** - Global catalog of permission keys

#### 2. Tenant-Scoped Models
- **Tenant** - Organization/company
- **Role** - Custom roles per tenant
- **Product** - Tenant-specific products
- **Branch** - Physical locations (warehouses, stores)
- **StockLot** - FIFO inventory lots
- **StockLedger** - Append-only stock movement log
- **AuditEvent** - Compliance audit trail
- **TenantBranding** - Theme and logo customization

#### 3. Join/Bridge Models
- **UserTenantMembership** - Links users to tenants with roles
- **UserBranchMembership** - Assigns users to specific branches
- **RolePermission** - Many-to-many role-permission mapping
- **ProductStock** - Denormalized aggregate stock per branch

---

## Authentication & Authorization

### Authentication Flow

```
1. User submits credentials to POST /api/auth/sign-in
   ↓
2. Backend validates credentials (bcrypt password check)
   ↓
3. Backend generates JWT token:
   {
     currentUserId: "user_123",
     currentTenantId: "tenant_abc"  // Last active or first tenant
   }
   ↓
4. Backend sets HTTP-only cookie:
   - Name: mt_session (SESSION_COOKIE_NAME)
   - Signed: Yes (SESSION_JWT_SECRET)
   - SameSite: lax (dev) / none (prod cross-site)
   - Secure: true (prod only)
   - MaxAge: 7 days
   ↓
5. Frontend stores session state in Zustand (from GET /api/auth/me)
   ↓
6. Subsequent requests include cookie automatically
   ↓
7. sessionMiddleware decodes JWT → sets req.currentUserId & req.currentTenantId
```

### Authorization (RBAC)

**Permission Catalog** (`api-server/src/rbac/catalog.ts`):
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

**Default Roles:**
- **OWNER** - Full access to all features
- **ADMIN** - Manage users and operations (no role/tenant config)
- **EDITOR** - Edit products and allocate stock
- **VIEWER** - Read-only access

**Backend Enforcement:**
```typescript
router.post('/products',
  requireAuthenticatedUserMiddleware,
  requirePermission('products:write'),
  createProduct
)
```

**Frontend Enforcement:**
```tsx
<RequirePermission perm="products:write">
  <CreateProductButton />
</RequirePermission>
```

---

## API Design Patterns

### 1. Standard Envelope

All API responses use a consistent envelope for predictable error handling:

**Success Response:**
```json
{
  "success": true,
  "data": { ... }
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
    "userFacingMessage": "Product name is required.",
    "developerMessage": "Validation failed for field 'productName'.",
    "correlationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### 2. Correlation IDs

Every request receives a unique UUIDv4 `correlationId` for tracing:
- Set by `requestIdMiddleware` → `req.correlationId`
- Included in response headers: `X-Request-Id`, `X-Correlation-Id`
- Logged in `ApiRequestLog` table
- Included in error responses and audit events

### 3. Idempotency

POST/PUT/DELETE operations support idempotency via `Idempotency-Key` header:
- Client sends unique key (e.g., UUIDv4)
- Server stores response in `IdempotencyRecord` table (TTL: 24 hours)
- Duplicate requests replay the same response
- Prevents duplicate charges, double-posting, etc.

```typescript
// idempotencyMiddleware checks:
1. If key exists in IdempotencyRecord → return stored response
2. Otherwise → process request and store response
```

### 4. Rate Limiting

**Fixed Window Rate Limiting:**
- **Auth endpoints** (`/api/auth/*`): 120 req/min per IP+session
- **General API** (`/api/*`): 600 req/min per IP+session

Headers returned:
- `X-RateLimit-Limit` - Max requests per window
- `X-RateLimit-Remaining` - Requests remaining
- `X-RateLimit-Reset` - Unix timestamp when window resets

### 5. OpenAPI Type Generation

**Workflow:**
1. Define Zod schemas in `api-server/src/openapi/paths/*.ts`
2. Register paths in `openapi/index.ts` → `buildOpenApiDocument()`
3. API serves spec at `/openapi.json`
4. Frontend runs `npm run openapi:gen` → generates `admin-web/src/types/openapi.d.ts`
5. Frontend uses type-safe API calls:

```typescript
import type { paths } from '@/types/openapi'

type CreateProductBody = paths['/api/products']['post']['requestBody']['content']['application/json']
type ProductResponse = paths['/api/products']['post']['responses']['200']['content']['application/json']
```

### 6. Optimistic Locking

Products use `entityVersion` for conflict detection:
```typescript
// Client reads product with entityVersion: 5
// Client updates product, sends currentEntityVersion: 5
// Server checks: if entityVersion != 5 → reject with CONFLICT_ERROR
// Server updates product, increments entityVersion to 6
```

Prevents lost updates in concurrent editing scenarios.

---

## Database Architecture

### Key Design Patterns

#### 1. Multi-Tenant Foreign Keys
Every tenant-scoped table includes `tenantId`:
```prisma
model Product {
  id       String @id @default(cuid())
  tenantId String
  tenant   Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  ...
  @@index([tenantId])
}
```

#### 2. Soft vs Hard Deletes
- **Hard deletes** - Most entities use `onDelete: Cascade`
- **Soft deletes** - None currently (future consideration for audit trails)

#### 3. FIFO Stock Management

**Tables:**
- `ProductStock` - Denormalized aggregate (qtyOnHand per branch+product)
- `StockLot` - Individual receipts with unit cost and received date
- `StockLedger` - Append-only log of all movements

**FIFO Flow:**
```typescript
// Receipt
1. Create StockLot (qtyReceived, unitCostPence, receivedAt)
2. Create StockLedger (kind: RECEIPT, qtyDelta: +100)
3. Update ProductStock (qtyOnHand += 100)

// Consumption (FIFO)
1. Query StockLots ordered by receivedAt ASC (oldest first)
2. Drain lots until qty consumed
3. Create StockLedger (kind: CONSUMPTION, qtyDelta: -50, lotId)
4. Update ProductStock (qtyOnHand -= 50)
```

#### 4. Audit Trail (Append-Only)

**AuditEvent Table:**
- Every CUD operation logged
- Stores `beforeJson`, `afterJson`, `diffJson` snapshots
- Indexed by `tenantId`, `entityType`, `entityId`, `actorUserId`
- Used for compliance, troubleshooting, and activity feeds

**Example:**
```json
{
  "id": "audit_123",
  "tenantId": "tenant_abc",
  "actorUserId": "user_456",
  "entityType": "PRODUCT",
  "entityId": "product_789",
  "action": "UPDATE",
  "entityName": "Coffee Beans",
  "beforeJson": { "productPricePence": 1200 },
  "afterJson": { "productPricePence": 1500 },
  "correlationId": "550e8400-...",
  "createdAt": "2025-01-15T12:34:56Z"
}
```

### Database Indexes

**Critical indexes for performance:**
- `@@unique([tenantId, productSku])` - SKU uniqueness per tenant
- `@@unique([tenantId, branchSlug])` - Branch slug uniqueness per tenant
- `@@index([tenantId, branchId, productId, receivedAt])` - FIFO lot scanning
- `@@index([tenantId, createdAt])` - Audit log pagination
- `@@index([correlationId])` - Request tracing

---

## Integration Points

### 1. Supabase Storage (File Uploads)

**Purpose:** Store tenant logos and product images

**Integration:**
- Client: `@supabase/supabase-js`
- Configuration: `api-server/src/integrations/supabase.ts`
- Upload flow:
  1. Frontend uploads file to POST `/api/uploads`
  2. Backend validates file (size, type)
  3. Backend uploads to Supabase Storage bucket
  4. Backend returns public URL
  5. Frontend stores URL in `TenantBranding.logoUrl`

**Environment Variables:**
- `SUPABASE_URL` - Project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Admin API key

### 2. PostgreSQL Connection Pooling

**Development:**
- Direct connection to PostgreSQL

**Production (Render/Supabase):**
- Use **Session Pooler** (IPv4) connection string
- Prisma manages connection pool internally
- Configure pool size via `connection_limit` in `DATABASE_URL`

---

## Testing Strategy

### Backend Testing (Jest)

**Location:** `api-server/src/**/__tests__/`

**Approach:** Acceptance/integration tests
- Real PostgreSQL database (test instance)
- Supertest for HTTP requests
- Prisma transactions for test isolation
- Seed data setup in `beforeAll`

**Run:**
```bash
npm run test:accept              # Run all tests
npm run test:accept:watch        # Watch mode
npm run test:accept:coverage     # Coverage report
```

### Frontend Testing (Playwright)

**Location:** `admin-web/e2e/`

**Approach:** End-to-end browser tests
- Tests against real API server
- Test database seeded with known data
- Page object model pattern

**Run:**
```bash
npm run test:accept              # Headless mode
npm run test:accept:ui           # Interactive UI mode
npm run test:accept:debug        # Debug mode
npm run test:accept:report       # View HTML report
```

---

## Security Considerations

### 1. Authentication
- HTTP-only cookies (XSS protection)
- Signed JWT tokens (SESSION_JWT_SECRET)
- SameSite cookie policy (CSRF protection)
- Secure flag in production (HTTPS only)

### 2. Authorization
- Server-side permission checks (never trust client)
- Middleware enforcement (`requirePermission`)
- Tenant isolation enforced via `tenantId` filters

### 3. Input Validation
- Zod schemas for all request bodies
- SQL injection protection (Prisma parameterized queries)
- File upload validation (size, type, extension)

### 4. Security Headers (Helmet)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy` (default)
- `Strict-Transport-Security` (HTTPS only)

### 5. Rate Limiting
- Prevents brute-force attacks
- Per-IP and per-session buckets
- Configurable limits per route group

### 6. CORS
- Strict origin validation
- Credentials allowed only for trusted origins
- No wildcard origins

---

## Environment Configuration

### API Server Environment Variables

**Required:**
```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname
SESSION_JWT_SECRET=your_random_secret_here
```

**Optional:**
```bash
# Server
SERVER_PORT=4000
LOG_LEVEL=info
PRETTY_LOGS=true

# CORS
FRONTEND_ORIGIN=https://yourapp.vercel.app
FRONTEND_DEV_ORIGIN=http://localhost:5174

# Cookies
SESSION_COOKIE_NAME=mt_session
COOKIE_SAMESITE_MODE=lax  # or 'none' for cross-site prod

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_key_here
SUPABASE_STORAGE_BUCKET=uploads
```

### Frontend Environment Variables

**Required:**
```bash
VITE_API_BASE_URL=http://localhost:4000
```

**Notes:**
- No trailing slashes on URLs
- CORS origins must match exactly
- Session pooler URL for production PostgreSQL

---

## Performance Considerations

### 1. Database Query Optimization
- Selective field projection (reduce payload size)
- Proper indexing on foreign keys and filter columns
- Pagination for large result sets
- Aggregate queries denormalized (`ProductStock.qtyOnHand`)

### 2. Caching Strategy
- No caching currently implemented
- Future: Redis for session store, hot data

### 3. Frontend Bundle Size
- Vite code splitting (dynamic imports)
- Tree-shaking unused Mantine components
- Lazy loading route components

### 4. API Response Times
- Middleware overhead: ~5-10ms (logging, auth)
- Typical query time: 10-50ms
- File uploads: 100-500ms (depending on size)

---

## Deployment Architecture

### Production Setup

```
┌─────────────────┐
│   Vercel CDN    │  Frontend (admin-web)
│  Static Hosting │  - React SPA
└────────┬────────┘  - Vite production build
         │
         ↓ API Requests
┌─────────────────┐
│   Render.com    │  Backend (api-server)
│  Container      │  - Express server
│  Deploy         │  - Auto-deploy from GitHub
└────────┬────────┘
         │
         ↓ Database Queries
┌─────────────────┐
│   Supabase      │  PostgreSQL Database
│   PostgreSQL    │  - Session Pooler (IPv4)
└─────────────────┘
         │
         ↓ File Storage
┌─────────────────┐
│   Supabase      │  Object Storage
│   Storage       │  - Public bucket for logos
└─────────────────┘
```

### CI/CD Pipeline (Planned)

```yaml
# .github/workflows/ci.yml
on: [push, pull_request]

jobs:
  test-api:
    - npm run typecheck
    - npm run build
    - npm run test:accept

  test-web:
    - npm run typecheck
    - npm run lint
    - npm run build
    - npm run test:accept

  deploy-api:
    if: github.ref == 'refs/heads/main'
    - Deploy to Render (auto-deploy enabled)

  deploy-web:
    if: github.ref == 'refs/heads/main'
    - Deploy to Vercel (auto-deploy enabled)
```

---

## Related Documentation

- [Database Schema Reference](./database_schema.md)
- [RBAC System Design](./rbac_system.md)
- [Stock Management System](./stock_management.md)

---

**Last Updated:** 2025-10-11
**Document Version:** 1.0
