# Project Architecture

## Project Overview

**Multi-Tenant Inventory Management System** - A comprehensive SaaS platform for managing products, stock, branches, and users across multiple tenant organizations with fine-grained role-based access control (RBAC).

### Core Features
- Multi-tenant architecture with complete data isolation
- Role-based access control (RBAC) with custom roles per tenant
- Product catalog management with optimistic locking
- Multi-branch inventory tracking with FIFO stock consumption
- Stock transfer system with multi-level approval workflows
- AI chatbot assistant with RAG (Retrieval-Augmented Generation)
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
| **AI/LLM** | Vercel AI SDK | ^5.0.72 | AI integration and streaming |
| **AI/LLM** | OpenAI SDK | ^2.0.52 | OpenAI API client |
| **Vector DB** | pgvector | ^0.2.1 | PostgreSQL vector extension |

**Key Dependencies:**
- `@prisma/client` - Generated Prisma client for type-safe database access
- `@supabase/supabase-js` - Supabase storage integration for file uploads
- `cookie-parser` - Parse HTTP cookies
- `dotenv` - Environment variable management
- `uuid` - Generate unique identifiers
- `bcryptjs` - Password hashing
- `ai` - Vercel AI SDK for LLM integration
- `@ai-sdk/openai` - OpenAI provider for AI SDK
- `pgvector` - PostgreSQL vector similarity search

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

#### 2. Archival Pattern (Soft Delete)

**Strategy:** Critical entities use soft delete (archival) rather than hard delete to preserve audit trails and allow restoration.

**Implementation:**
- `isArchived` - Boolean flag (default: false)
- `archivedAt` - Timestamp when archived (nullable)
- `archivedByUserId` - User who performed archival (nullable)

**Entities Using Archival:**
```prisma
model Product {
  isArchived       Boolean   @default(false)
  archivedAt       DateTime?
  archivedByUserId String?
  archivedBy       User?     @relation("ProductArchivedBy", fields: [archivedByUserId], ...)
  @@index([tenantId, isArchived])
}

model Branch {
  isArchived       Boolean   @default(false)
  archivedAt       DateTime?
  archivedByUserId String?
  // Similar pattern
}

model StockTransferTemplate {
  isArchived       Boolean   @default(false)
  archivedAt       DateTime?
  archivedByUserId String?
  // Similar pattern
}

model TransferApprovalRule {
  isArchived Boolean @default(false)
  // No archivedAt/archivedBy for rules (simpler pattern)
}

model Role {
  isArchived       Boolean   @default(false)
  archivedAt       DateTime?
  archivedByUserId String?
  // Custom roles only (system roles cannot be archived)
}

model UserTenantMembership {
  isArchived Boolean @default(false)
  // User removal from tenant
}
```

**UI Patterns:**
- **Active-only filter** (default): `WHERE isArchived = false`
- **Archived-only view**: `WHERE isArchived = true`
- **Show all**: No filter on isArchived

**Restore Workflow:**
```typescript
// Archive entity
await prisma.product.update({
  where: { id: productId },
  data: {
    isArchived: true,
    archivedAt: new Date(),
    archivedByUserId: currentUserId,
  },
});

// Restore entity
await prisma.product.update({
  where: { id: productId },
  data: {
    isArchived: false,
    archivedAt: null,
    archivedByUserId: null,
  },
});
```

**Benefits:**
- Preserves audit trails
- Allows restoration of accidentally deleted data
- Maintains referential integrity
- Historical reporting remains intact

**Other Entities:**
- **Hard deletes** - Most entities use `onDelete: Cascade` (e.g., StockLedger, AuditEvent)
- Append-only tables never delete (e.g., StockLedger, AuditEvent)

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

## Feature Flags System

### Overview

The system implements per-tenant feature flags using a JSON column in the `Tenant` table. This allows features to be enabled/disabled on a tenant-by-tenant basis without code changes.

**Technology:**
- Storage: JSON column in PostgreSQL (`Tenant.featureFlags`)
- Backend: Propagated in auth response
- Frontend: React hooks (`useFeatureFlag`)

### Implementation

**Database Schema:**
```prisma
model Tenant {
  id           String  @id @default(cuid())
  tenantSlug   String  @unique
  tenantName   String
  featureFlags Json?   // {"barcodeScanningEnabled": false, ...}
  ...
}
```

**Example Feature Flags:**
```json
{
  "barcodeScanningEnabled": false,
  "barcodeScanningMode": null
}
```

**Current Flags:**
- `barcodeScanningEnabled` - Enable/disable barcode scanning UI
- `barcodeScanningMode` - Scanning mode: `null`, `"camera"`, `"manual"`

### Flag Propagation Flow

```
1. User authenticates → GET /api/auth/me
2. Backend loads tenant with featureFlags
3. Auth response includes featureFlags:
   {
     user: {...},
     tenant: {...},
     featureFlags: {
       barcodeScanningEnabled: false,
       barcodeScanningMode: null
     }
   }
4. Frontend stores in auth store (Zustand)
5. Components check flags via useFeatureFlag hook
```

### Frontend Usage

**Hook:**
```typescript
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

function ProductPage() {
  const barcodeScanningEnabled = useFeatureFlag('barcodeScanningEnabled');

  return (
    <div>
      {barcodeScanningEnabled && (
        <Button onClick={openScanner}>Scan Barcode</Button>
      )}
    </div>
  );
}
```

**Store:**
```typescript
// stores/auth.ts
interface AuthStore {
  featureFlags: Record<string, any>;
  // ...
}

const useAuthStore = create<AuthStore>((set) => ({
  featureFlags: {},
  // ...
}));
```

### Benefits

- **No code deployment** - Toggle features without deploying
- **Gradual rollout** - Enable for specific tenants first
- **A/B testing** - Test features with subset of users
- **Emergency disable** - Quickly disable problematic features
- **Tenant-specific** - Different tenants can have different features

### Adding New Flags

1. **Add to Tenant.featureFlags** - No schema change needed (JSON)
2. **Update auth response** - Include in GET /api/auth/me
3. **Use in frontend** - `useFeatureFlag('newFeature')`
4. **Set via admin** - Update tenant's featureFlags JSON

---

## Barcode Scanning

### Overview

The system supports barcode scanning for products to streamline stock receiving and product lookup. Scanning is controlled per-tenant via feature flags.

**Supported Barcode Formats:**
- **EAN-13** - 13-digit European Article Number (most common)
- **UPC-A** - 12-digit Universal Product Code
- **CODE-128** - Variable-length alphanumeric
- **QR Code** - 2D matrix barcode

**Use Cases:**
- Product lookup during stock receiving
- Quick product search in stock transfers
- Bulk receiving workflow (scan to receive)
- Product verification

### Database Schema

```prisma
model Product {
  id          String  @id @default(cuid())
  tenantId    String
  productName String
  productSku  String
  barcode     String?  // Barcode value
  barcodeType String?  // "EAN13", "UPCA", "CODE128", "QR"
  ...
  @@unique([tenantId, barcode])  // Barcode unique per tenant
  @@index([barcode])             // Fast barcode lookup
}
```

**Uniqueness:**
- Barcodes are unique per tenant (not globally)
- Same barcode can exist in different tenants
- Prevents duplicate barcodes within one organization

### API Endpoint

**GET /api/products/by-barcode/:barcode**

```typescript
// Request
GET /api/products/by-barcode/5012345678901?branchId=branch_123

// Response
{
  "success": true,
  "data": {
    "id": "product_abc",
    "productName": "Coffee Beans 1kg",
    "productSku": "COFFEE-001",
    "barcode": "5012345678901",
    "barcodeType": "EAN13",
    "productPricePence": 1500,
    "stock": {
      "branchId": "branch_123",
      "qtyOnHand": 45,
      "qtyAvailable": 40
    }
  }
}
```

**Features:**
- Tenant-scoped lookup (automatic via auth)
- Optional branch stock level
- Returns full product details
- 404 if barcode not found

### Frontend Implementation

**Scanner Modal UI:**
```
┌──────────────────────────────────┐
│  Scan Product Barcode            │
├──────────────────────────────────┤
│  [Camera View]                   │
│  ┌────────────────────────────┐  │
│  │                            │  │
│  │   [Scanning frame]         │  │
│  │                            │  │
│  └────────────────────────────┘  │
│                                  │
│  Or enter manually:              │
│  [____________] [Lookup]         │
│                                  │
│  [Cancel] [Switch to Manual]    │
└──────────────────────────────────┘
```

**Modes:**
- **Camera mode** - Uses device camera to scan barcode
- **Manual mode** - Type barcode manually (fallback)
- **Toggle** - Switch between modes

**Workflow:**
```typescript
1. User clicks "Scan Barcode" button
2. Check feature flag (barcodeScanningEnabled)
3. Open scanner modal
4. User scans barcode OR enters manually
5. Call GET /api/products/by-barcode/{barcode}
6. Display product info
7. User confirms → add to transfer/receipt
```

### Bulk Receive Workflow

**Use Case:** Receive multiple products quickly by scanning

```
1. Navigate to Receive Stock page
2. Select branch
3. Click "Scan to Receive"
4. Scan product barcode → Product added
5. Enter quantity → Item saved
6. Scan next product → Repeat
7. Submit all items → Create stock receipt
```

**Benefits:**
- 10x faster than manual entry
- Reduces SKU lookup errors
- Improves warehouse efficiency
- Real-time stock level feedback

### Feature Flag Control

```json
{
  "barcodeScanningEnabled": true,
  "barcodeScanningMode": "camera"
}
```

**Modes:**
- `null` - Disabled
- `"camera"` - Enable camera scanning
- `"manual"` - Manual entry only (no camera)

### Technical Details

**Frontend Library:** (To be determined based on implementation)
- Options: `react-zxing`, `quagga2`, `zxing-js`
- Requirements: Camera access, barcode detection

**Browser Support:**
- Camera API requires HTTPS (except localhost)
- Fallback to manual entry if camera unavailable
- Progressive enhancement

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

## AI Integration

### Overview

The system includes an AI chatbot assistant powered by OpenAI GPT-4o that helps users query and interact with the inventory management system through natural language. The AI integration uses the Vercel AI SDK v5 for streaming responses and tool calling.

**Key Features:**
- Natural language queries for stock transfers, products, inventory, and analytics
- RAG (Retrieval-Augmented Generation) for documentation search
- Multi-turn conversation persistence
- 23 specialized tools across 8 categories
- Branch membership-based security filtering
- Real-time data access
- Usage analytics tracking

### Architecture

```
┌─────────────────────────────────────────┐
│         Frontend (useChat hook)         │
│  - React component with chat UI         │
│  - Streaming message display            │
└─────────────────────────────────────────┘
                  ↓ POST /api/chat
┌─────────────────────────────────────────┐
│         Chat Router (Express)           │
│  - Authentication middleware            │
│  - Request validation                   │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         Chat Service                    │
│  - Build system message (context)       │
│  - RAG: Search documentation            │
│  - Stream response from OpenAI          │
│  - Save conversation history            │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         OpenAI GPT-4o                   │
│  - 23 tools (8 categories)              │
│  - Tool calling (function calling)      │
│  - Streaming text generation            │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         AI Tools                        │
│  - Transfer, Product, Stock Tools       │
│  - Branch, User, Template Tools         │
│  - Approval, Analytics Tools            │
│  - All call existing service functions  │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         Service Layer                   │
│  - Business logic                       │
│  - Security enforcement                 │
│  - Branch membership filtering          │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         PostgreSQL Database             │
│  - ChatConversation (threading)         │
│  - ChatMessage (history)                │
│  - DocumentChunk (RAG vectors)          │
│  - ChatAnalytics (usage tracking)       │
└─────────────────────────────────────────┘
```

### RAG (Retrieval-Augmented Generation)

**Purpose:** Enable the AI to answer "how-to" questions using actual project documentation

**Components:**
1. **Document Ingestion** - Parse markdown docs into sections, generate embeddings
2. **Vector Storage** - Store embeddings in PostgreSQL with pgvector extension
3. **Semantic Search** - Find relevant docs using cosine similarity
4. **Context Injection** - Include relevant docs in system message

**Technology:**
- Embedding model: `text-embedding-3-small` (OpenAI)
- Vector dimensions: 1536
- Database: PostgreSQL with pgvector extension
- Similarity metric: Cosine similarity (1 - cosine distance)

**Workflow:**
```typescript
// 1. Ingest documentation (one-time or when docs change)
await ingestDocument('docs/stock-transfers/overview.md');
// - Parses markdown by headings (## and ###)
// - Generates embeddings for each section
// - Stores in DocumentChunk table with vector column

// 2. Search at query time
const relevantDocs = await searchDocumentation(userQuery, limit=3, threshold=0.7);
// - Generates embedding for user query
// - Finds top K chunks with similarity > 0.7
// - Returns documentation sections

// 3. Inject into system message
const systemMessage = buildSystemMessage({
  ...,
  relevantDocs, // Included in AI's context
});
```

**Ingestion Script:**
```bash
cd api-server
npm run ingest-docs  # Runs scripts/ingestDocs.ts
```

### AI Tools

The chatbot has 23 specialized tools across 8 categories:

| Category | Tools | Purpose |
|----------|-------|---------|
| **Stock Transfers** | searchTransfers, getTransferDetails, getApprovalStatus | Query and monitor transfer requests |
| **Products** | searchProducts, getProductDetails, checkStockLevels | Product catalog and inventory queries |
| **Stock Management** | receiveStock, adjustStock, getStockMovements, getLotDetails | Inventory operations and FIFO tracking |
| **Branches** | listBranches, getBranchStats | Branch information and performance |
| **Users** | searchUsers, getUserDetails, listRoles, getRolePermissions | User management and permissions |
| **Templates** | listTemplates, getTemplateDetails | Transfer template management |
| **Approvals** | getApprovalRules, explainApprovalRequirements | Approval workflow queries |
| **Analytics** | getTransferMetrics, getPerformanceMetrics, getValueReports | Business intelligence and reporting |

**Tool Design Pattern:**
```typescript
// All tools follow the same pattern:
export function productTools({ userId, tenantId }: { userId: string; tenantId: string }) {
  return {
    searchProducts: tool({
      description: 'Search products by name or SKU',
      inputSchema: z.object({
        query: z.string().describe('Search query'),
        limit: z.number().optional().default(5),
      }),
      execute: async ({ query, limit }) => {
        // SECURITY: Call existing service function (no direct DB queries)
        const products = await productService.searchProducts({
          tenantId,
          userId,
          query,
          limit,
        });
        return products; // Service handles branch filtering and permissions
      },
    }),
  };
}
```

**Security Model:**
- Tools never query database directly
- All tools call existing service functions
- Service layer enforces tenant isolation and branch membership filtering
- Tools inherit security from service layer (single source of truth)

### Conversation Persistence

**Multi-Turn Conversations:**
- Each conversation has a unique ID
- Messages stored in chronological order
- Conversation title auto-generated from first message
- Users can only access their own conversations

**Models:**
- `ChatConversation` - Conversation metadata (id, tenantId, userId, title, createdAt, updatedAt)
- `ChatMessage` - Individual messages (id, conversationId, role, content, createdAt)

**Workflow:**
1. User starts conversation → Create `ChatConversation` + first `ChatMessage`
2. User sends message → Add `ChatMessage` with role='user'
3. AI responds → Add `ChatMessage` with role='assistant' (includes tool calls)
4. User continues → Resume conversation by ID

**Data Model:**
```typescript
interface ConversationWithMessages {
  id: string;
  tenantId: string;
  userId: string;
  title: string; // First 50 chars of first message
  createdAt: Date;
  updatedAt: Date;
  messages: ChatMessage[];
}

interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: any; // JSON (parts array from AI SDK v5)
  createdAt: Date;
}
```

### Analytics Tracking

**Metrics Collected:**
- Daily conversations started
- Daily messages sent (user + assistant)
- Unique users per day
- Tool usage counts (which tools used how often)
- Average messages per conversation

**Model:**
```typescript
interface ChatAnalytics {
  id: string;
  tenantId: string;
  date: Date; // Date only (no time)
  totalConversations: number;
  totalMessages: number;
  uniqueUsers: number;
  toolCalls: Record<string, number>; // JSON: { "searchTransfers": 42, ... }
  avgMessagesPerConversation: number | null;
  createdAt: Date;
  updatedAt: Date;
}
```

**Aggregation:**
- Daily metrics aggregated per tenant
- Tool calls tracked in JSON column
- Analytics updated in `onFinish` callback of streaming response

### OpenAI Integration

**Model:** `gpt-4o` (GPT-4 Omni)

**Configuration:**
- Temperature: 0.7 (balanced creativity vs consistency)
- Max steps: 10 (prevents infinite tool calling loops)
- Streaming: Yes (Server-Sent Events for real-time response)

**Environment Variables:**
```bash
OPENAI_API_KEY=sk-...  # Required
```

**Request Flow:**
1. Build system message with user context + RAG docs
2. Convert UI messages to model format (AI SDK v5)
3. Call `streamText()` with tools
4. AI decides which tools to call (function calling)
5. Tools execute and return results
6. AI synthesizes final response
7. Stream response to client via SSE
8. Save conversation + analytics in `onFinish` callback

### Streaming Pattern

**Technology:** Server-Sent Events (SSE) via Vercel AI SDK

**Backend:**
```typescript
const result = await streamText({
  model: openai('gpt-4o'),
  system: systemMessage,
  messages: modelMessages,
  tools: { ...transferTools, ...productTools, ... },
});

// Convert to UI stream format and pipe to response
const uiMessageStream = result.toUIMessageStream();
pipeUIMessageStreamToResponse({ response: res, stream: uiMessageStream });
```

**Frontend:**
```typescript
import { useChat } from 'ai/react';

const { messages, input, handleSubmit, isLoading } = useChat({
  api: '/api/chat',
  // Handles SSE stream automatically
});
```

**Benefits:**
- Real-time response (no waiting for full completion)
- Better UX for long responses
- Shows tool calling progress
- Lower perceived latency

---

## Related Documentation

- [Database Schema Reference](./database-schema.md)
- [RBAC System Design](./rbac-system.md)
- [Stock Management System](./stock-management.md)
- [AI Chatbot System](./Domain/ai-chatbot.md)
- [Stock Transfer System](./Domain/transfers.md)

---

**Last Updated:** 2025-10-19
**Document Version:** 1.0
