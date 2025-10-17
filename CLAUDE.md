# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Docs

We keep all important docs in .agent folder and keep updating them, structure like below

.agent
- /Features: PRD & implementation plan for each feature (use [PRD Template](.agent/Meta/prd-template.md))
- /System: Document the current state of the system (project structure/architecture, tech stack, integration points,
  database schema, and core functionalities such as agent architecture, LLM layer, etc.)
- /SOP: Best practices of execute certain tasks (e.g. how to add a schema migration, how to add a new
  page route, etc.)
- /Meta: Templates and guidelines (PRD template, documentation standards, agent protocols)
- README.md: an index of all the documentations we have so people know what & where to look for things

We should always update .agent docs after we implement a certain feature, to make sure it fully reflects the up to date information

Before you plan any implementation, always read the .agent/README first to get context

### Planning New Features (IMPORTANT: Always Use PRD Template)

**CRITICAL: When asked to create a PRD for a new feature, ALWAYS use the standardized template at [.agent/Meta/prd-template.md](.agent/Meta/prd-template.md)**

**PRD Creation Workflow:**
1. Read [.agent/README.md](.agent/README.md) for system context
2. **Read the [PRD Template](.agent/Meta/prd-template.md) to understand the required structure**
3. Create the PRD file at `.agent/Features/InProgress/{feature-name}/prd.md`
4. **Use the EXACT template structure** with:
   - Feature overview (2-3 sentences)
   - Phase-based breakdown with clear goals
   - Checklists using `- [ ]` format (NOT narrative text)
   - File references (links, NOT code snippets)
   - Backend implementation section (always first)
   - Frontend implementation section (always after backend tests pass)
   - Documentation update checkboxes
   - Testing strategy section
5. **What NOT to include in PRDs:**
   - ❌ Code snippets (reference files instead)
   - ❌ Full database schemas (link to System docs)
   - ❌ API request/response formats (use OpenAPI)
   - ❌ Implementation details (those belong in code)

**PRD Principles:**
- **Backend-First Workflow:** Backend → Tests Pass → Frontend → Tests Pass
- **Simple Checklists:** Track progress with `- [ ]` → `- [x]`, NOT detailed narratives
- **data-testid Attributes:** Always remind to add these in frontend implementation
- **Documentation Updates:** Include checkbox for updating /docs when new concepts are introduced
- **File References:** Link to files that will be modified, don't include their code
- **Phase-Based:** Break work into 1-3 day phases with clear goals

See [PRD Guidelines](.agent/Meta/documentation-guidelines.md#prd-product-requirements-document-guidelines) for detailed instructions and common mistakes to avoid.

## Repository Structure

Monorepo with two main workspaces:
- **`api-server/`** - Node.js + Express + Prisma + PostgreSQL backend
- **`admin-web/`** - React + Vite + Mantine UI frontend

Each workspace has its own `package.json` and must be managed independently.

## Common Development Commands

### API Server (`api-server/`)

```bash
# Development (hot-reload)
npm run dev

# Build TypeScript
npm run build

# Production start (runs migrations first)
npm run start

# Database operations
npm run prisma:generate          # Regenerate Prisma client after schema changes
npm run db:migrate -- --name foo # Create and apply migration in dev
npm run db:deploy                # Apply pending migrations (CI/prod)
npm run db:studio                # Open Prisma Studio visual browser
npm run db:seed                  # Seed demo data (tenants, users, products)
npm run db:reset:dev             # Reset DB and re-seed (destructive!)

# RBAC seeding
npm run seed:rbac                # Seed permissions and default roles
npm run seed:test-users          # Seed test users

# Type checking
npm run typecheck

# Testing
npm run test:accept              # Run Jest acceptance tests
npm run test:accept:watch        # Watch mode
npm run test:accept:coverage     # With coverage report
```

### Admin Web (`admin-web/`)

```bash
# Development server (runs on port 5174)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run typecheck

# Lint
npm run lint

# Regenerate TypeScript types from OpenAPI spec
npm run openapi:gen

# Testing (Playwright E2E)
npm run test:accept              # Run E2E tests (headless)
npm run test:accept:ui           # Interactive UI mode
npm run test:accept:debug        # Debug mode with breakpoints
npm run test:accept:report       # View last HTML report
```

**IMPORTANT:** After changing OpenAPI schemas in `api-server/src/openapi/`, restart the API server, then run `npm run openapi:gen` from `admin-web/` to update frontend types.

### Makefile (Root Level)

The repository includes a Makefile for common development tasks:

```bash
# CI/Testing
make bmad-test-api       # Typecheck + build API server
make bmad-test-web       # Typecheck + lint + build web
make bmad-accept-api     # Run API acceptance tests (Jest)
make bmad-accept-web     # Run web E2E tests (Playwright)
make bmad-accept-all     # Run all acceptance tests

# Development
make install             # Install all workspace dependencies
make dev-api             # Start API server in watch mode
make dev-web             # Start Vite dev server
make db-migrate          # Create Prisma migration
make db-seed             # Seed database with test data
```

## High-Level Architecture

### Multi-Tenancy Model

- **Tenant**: Top-level isolation (e.g., different companies)
- **User**: Can belong to multiple tenants via `UserTenantMembership`
- **Branch**: Physical locations within a tenant (e.g., warehouses, stores)
- Each tenant has its own:
  - Products (with SKU uniqueness per tenant)
  - Roles and permissions
  - Branches
  - Stock lots and ledgers
  - Theme/branding

### Authentication & Authorization

**Authentication:**
- Cookie-based sessions with signed JWT tokens
- Cookie name: `SESSION_COOKIE_NAME` (default: `mt_session`)
- Token contains: `{ currentUserId, currentTenantId }`
- Middleware: `sessionMiddleware` → decodes cookie → sets `req.currentUserId` and `req.currentTenantId`
- Cookie mode controlled by `COOKIE_SAMESITE_MODE` env var:
  - `lax` for local dev (`http://localhost`)
  - `none` for cross-site prod/staging (requires `Secure` flag)

**Authorization (RBAC):**
- Permissions defined in `api-server/src/rbac/catalog.ts` (e.g., `products:read`, `users:manage`)
- System roles: `OWNER`, `ADMIN`, `EDITOR`, `VIEWER`
- Custom roles can be created per tenant
- Backend enforcement: `requirePermission(key)` middleware
- Frontend enforcement: `<RequirePermission perm="...">` wrapper + `useAuthStore().hasPerm(key)`

### API Patterns

**Standard Envelope:**
All API responses use a consistent envelope:
```typescript
// Success
{ success: true, data: {...} }

// Error
{
  success: false,
  data: null,
  error: {
    errorCode: "VALIDATION_ERROR",
    httpStatusCode: 400,
    userFacingMessage: "...",
    developerMessage: "...",
    correlationId: "uuid"
  }
}
```

**Correlation IDs:**
- Every request gets a unique `correlationId` (UUIDv4)
- Propagated through logs and error responses
- Use for tracing requests across services
- Middleware: `requestIdMiddleware` → sets `req.correlationId`

**Idempotency:**
- POST/PUT/DELETE support idempotency keys via `Idempotency-Key` header
- Stored in `IdempotencyRecord` table
- Replays the same response for duplicate requests within TTL
- Middleware: `idempotencyMiddleware`

**Rate Limiting:**
- Scoped by `ip`, `session`, or `ip+session`
- Different limits for auth endpoints vs general API
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Middleware: `createFixedWindowRateLimiterMiddleware`

### Database Architecture

**Key Models:**
- `User` - Global user (can belong to multiple tenants)
- `Tenant` - Company/organization
- `UserTenantMembership` - User ↔ Tenant with `roleId`
- `Role` - Per-tenant roles with many-to-many `Permission` via `RolePermission`
- `Permission` - Global permission catalog (e.g., `products:read`)
- `Branch` - Physical location within a tenant
- `Product` - Tenant-scoped with `entityVersion` for optimistic locking
- `ProductStock` - Aggregated stock per branch+product (denormalized)
- `StockLot` - FIFO lots with unit cost and received date
- `StockLedger` - Append-only log of all stock movements
- `AuditEvent` - Append-only audit trail for all entities
- `ApiRequestLog` - HTTP request/response logging for debugging
- `TenantBranding` - Theme presets and overrides per tenant

**Multi-Tenant Patterns:**
- All tenant-scoped queries **MUST** filter by `tenantId` (enforced via middleware)
- `req.currentTenantId` is set by `sessionMiddleware`
- Most routes use `requireAuthenticatedUserMiddleware` to ensure `currentTenantId` exists

**Optimistic Locking:**
- Products use `entityVersion` field
- Incremented on every update
- Clients must send `currentEntityVersion` in update requests
- Prevents lost updates in concurrent scenarios

**Stock Management (FIFO):**
- `ProductStock`: Aggregated qty on hand per branch+product
- `StockLot`: Individual receipts with unit cost and received date
- `StockLedger`: Append-only log of movements (`RECEIPT`, `ADJUSTMENT`, `CONSUMPTION`, `REVERSAL`)
- FIFO consumption: `stockService.consumeStock()` drains oldest lots first
- Service layer: `api-server/src/services/stockService.ts`

### OpenAPI & Type Generation

**Flow:**
1. Define Zod schemas in `api-server/src/openapi/` (e.g., `paths/products.ts`)
2. Register paths in `registry.ts`
3. API serves spec at `/openapi.json` (built in `openapi/index.ts`)
4. Frontend runs `npm run openapi:gen` to generate TypeScript types (`src/types/openapi.d.ts`)
5. Frontend uses generated `paths` type for type-safe API calls

**Example frontend usage:**
```typescript
import type { paths } from '@/types/openapi'
type CreateBody = paths['/api/products']['post']['requestBody']['content']['application/json']
```

### Frontend Architecture

**State Management (Zustand):**
- `stores/auth.ts`: Current user, tenant memberships, permissions
- `stores/theme.ts`: Tenant branding and Mantine theme overrides
- `stores/dirty.ts`: Unsaved changes tracking

**Routing:**
- React Router v7 with nested routes
- Public: `/sign-in`
- Protected: `/:tenantSlug/*` (wrapped in `AdminLayout` shell)
- Route-level permission guards: `<RequirePermission perm="...">`

**API Client Pattern:**
- Base HTTP client: `api/http.ts` (handles cookies, errors, correlation IDs)
- Feature modules: `api/products.ts`, `api/tenantUsers.ts`, etc.
- All requests include credentials (cookies)
- Errors throw with structured format for global error handling

**Permission Checks:**
- Hook: `usePermissions()` → returns `{ hasPerm, hasAnyPerm }`
- Store: `useAuthStore().hasPerm(key)`
- Component: `<RequirePermission perm="...">...</RequirePermission>`

## Database Workflow

1. Edit `api-server/prisma/schema.prisma`
2. Run `npm run prisma:generate` (regenerate client)
3. Run `npm run db:migrate -- --name add_feature` (create migration)
4. (Optional) Update `prisma/seed.ts` and run `npm run db:seed`
5. Restart API server if running

**Migration notes:**
- Dev: `npm run db:migrate` (interactive, writes migration files)
- Prod/CI: `npm run db:deploy` (non-interactive, applies pending migrations)
- Reset (destructive): `npm run db:reset:dev` (drops DB, re-applies migrations, seeds)

## Important Configuration

### Environment Variables

**API Server:**
- `DATABASE_URL` - PostgreSQL connection string (use Session Pooler for Render/Supabase)
- `SESSION_JWT_SECRET` - Secret for signing session tokens
- `SESSION_COOKIE_NAME` - Cookie name (default: `mt_session`)
- `COOKIE_SAMESITE_MODE` - `lax` (local) or `none` (prod cross-site)
- `FRONTEND_ORIGIN` - Allowed CORS origin (e.g., `https://yourapp.vercel.app`)
- `FRONTEND_DEV_ORIGIN` - Dev CORS origin (default: `http://localhost:5174`)
- `SERVER_PORT` - API port (default: `4000`)
- `LOG_LEVEL` - Pino log level (`info`, `debug`, etc.)
- `PRETTY_LOGS` - `true` for local dev, `false` for prod JSON logs

**Admin Web:**
- `VITE_API_BASE_URL` - API base URL (default: `http://localhost:4000`)

### CORS & Cookies Gotchas

- `FRONTEND_ORIGIN` must match the Vite dev server origin **exactly** (no trailing slash)
- For cross-site cookies (prod), set `COOKIE_SAMESITE_MODE=none` and ensure HTTPS
- For local dev, use `COOKIE_SAMESITE_MODE=lax` with `http://localhost`
- Cookies include `credentials: true` in both CORS config (server) and fetch calls (client)

## Typical Development Workflow

**Adding a new feature (e.g., "Suppliers"):**

1. **Database:**
   - Add `Supplier` model to `prisma/schema.prisma`
   - Run `npm run prisma:generate && npm run db:migrate -- --name add_suppliers`

2. **Permissions (if needed):**
   - Add `suppliers:read`, `suppliers:write` to `api-server/src/rbac/catalog.ts`
   - Run `npm run seed:rbac` to sync permissions to DB

3. **API:**
   - Create service: `api-server/src/services/suppliers/`
   - Create router: `api-server/src/routes/suppliersRouter.ts`
   - Add OpenAPI schemas: `api-server/src/openapi/paths/suppliers.ts`
   - Register paths in `api-server/src/openapi/index.ts`
   - Mount router in `api-server/src/routes/index.ts`

4. **Frontend:**
   - Restart API (to regenerate OpenAPI spec)
   - Run `npm run openapi:gen` from `admin-web/`
   - Create API client: `admin-web/src/api/suppliers.ts`
   - Create page: `admin-web/src/pages/SuppliersPage.tsx`
   - Add route in `admin-web/src/main.tsx` with permission guard

**Adding a new permission:**
1. Add to `PERMISSIONS` array in `api-server/src/rbac/catalog.ts`
2. Assign to roles in `ROLE_DEFS` (same file)
3. Run `npm run seed:rbac` to sync to database
4. Use in backend: `requirePermission('new:permission')` middleware
5. Use in frontend: `<RequirePermission perm="new:permission">`

## Testing & Debugging

### Test Coverage Summary

**Total: 299 passing tests (227 backend + 72 frontend)**

**Backend (Jest):**
- Authentication & RBAC: 46 tests
- Stock Management FIFO: 23 tests
- Product Service: 27 tests
- API Routes: 70 tests (products, stock, tenant-users)
- Middleware: 58 tests (session, permissions, rate limiting, idempotency, error handling)
- Health checks: 4 tests

**Frontend (Playwright E2E):**
- Authentication Flow: 12 tests (sign-in page + full flow)
- Product Management: 23 tests (CRUD, permissions, validation)
- Stock Management: 20 tests (FIFO, adjust stock, ledger, branch selection)
- Permission-Based UI: 21 tests (all roles across all features)

### Running Tests

**API Server (Jest):**
```bash
cd api-server
npm run test:accept              # Run all tests (227 passing)
npm run test:accept:watch        # Watch mode for TDD
npm run test:accept:coverage     # Generate coverage report
```

**Admin Web (Playwright E2E):**
```bash
cd admin-web
npm run test:accept              # Headless mode (72 passing)
npm run test:accept:ui           # Interactive UI mode (recommended for debugging)
npm run test:accept:debug        # Debug with breakpoints
npm run test:accept:report       # View HTML report of last run

# Run specific test file
npm run test:accept -- auth-flow.spec.ts
npm run test:accept -- product-management.spec.ts
npm run test:accept -- stock-management.spec.ts
npm run test:accept -- permission-checks.spec.ts
```

**Prerequisites for E2E tests:**
- API server must be running: `cd api-server && npm run dev`
- Database must be seeded with test data: `npm run db:seed`

### Testing Documentation

We maintain comprehensive testing guides in `.agent/SOP/`:

- **[testing_overview.md](.agent/SOP/testing_overview.md)** - Start here! Quick start guide and navigation
- **[backend_testing.md](.agent/SOP/backend_testing.md)** - Jest patterns, helpers, service tests
- **[frontend_testing.md](.agent/SOP/frontend_testing.md)** - Playwright E2E patterns, selectors, debugging
- **[test_flakiness.md](.agent/SOP/test_flakiness.md)** - Understanding and fixing flaky tests
- **[troubleshooting_tests.md](.agent/SOP/troubleshooting_tests.md)** - 30+ common issues with solutions
- **[testing_guide.md](.agent/SOP/testing_guide.md)** - Comprehensive reference (2294 lines)

### Writing Tests

**Backend (Jest + Supertest):**
```typescript
// Use test helpers for common setup
import { setupTestDatabase, cleanupTestDatabase } from '@/__tests__/helpers/db';
import { createTestUser, createSessionCookie } from '@/__tests__/helpers/auth';
import { createTestTenant, createTestProduct } from '@/__tests__/helpers/factories';

describe('Product API', () => {
  beforeAll(setupTestDatabase);
  afterAll(cleanupTestDatabase);

  it('should create product with authentication', async () => {
    const tenant = await createTestTenant('ACME Corp');
    const user = await createTestUser(tenant.id, 'OWNER');
    const sessionCookie = createSessionCookie(user.id, tenant.id);

    const response = await request(app)
      .post('/api/products')
      .set('Cookie', sessionCookie)
      .send({ name: 'Widget', sku: 'WID-001', unitPricePence: 1000 });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe('Widget');
  });
});
```

**Frontend (Playwright E2E):**
```typescript
import { test, expect } from '@playwright/test';

// Test users from seed data
const TEST_USERS = {
  owner: { email: 'owner@acme.test', password: 'Password123!', tenant: 'acme' },
  viewer: { email: 'viewer@acme.test', password: 'Password123!', tenant: 'acme' },
};

async function signIn(page, user) {
  await page.goto('/');
  await page.getByLabel(/email address/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByLabel(/tenant/i).fill(user.tenant);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(`/${user.tenant}/products`);
}

test('should create product', async ({ page }) => {
  await signIn(page, TEST_USERS.owner);

  await page.getByRole('button', { name: /new product/i }).click();
  await page.getByLabel(/product name/i).fill('Test Widget');
  await page.getByLabel(/sku/i).fill('TST-001');
  await page.getByLabel(/price \(gbp\)/i).fill('10.00');
  await page.getByRole('button', { name: /save/i }).click();

  // Should redirect to product page with success notification
  await expect(page).toHaveURL(/\/products\/.+/);
  await expect(page.getByRole('alert')).toContainText('Product created');
});
```

### Test Patterns & Best Practices

**Backend:**
- Use test helpers for database setup (`db.ts`, `auth.ts`, `factories.ts`)
- Test against real database (no mocking Prisma)
- Always test multi-tenant isolation
- Test both success and error cases
- Use `createTestRoleWithPermissions(permissionKeys)` for RBAC tests
- Stock operations require UserBranchMembership

**Frontend:**
- Prefer role-based selectors: `getByRole('button', { name: /save/i })`
- Scope to dialogs to avoid conflicts: `page.getByRole('dialog').getByLabel()`
- Clear cookies between tests: `test.beforeEach(async ({ context }) => await context.clearCookies())`
- Use `.first()` when multiple tables exist on page
- Wait for specific elements, not fixed timeouts: `waitForSelector('table tbody tr')`
- Test different user roles (owner, admin, editor, viewer)

### Local Debugging Tools

- **Prisma Studio** (`npm run db:studio`) - Visual database browser for inspecting/editing data
- **Swagger UI** (`http://localhost:4000/docs`) - Interactive API documentation and testing
- **OpenAPI Spec** (`http://localhost:4000/openapi.json`) - Raw spec for import into Postman/Insomnia
- **Correlation IDs** - Every request gets a UUIDv4 for tracing through logs and error responses

### Common Issues

- **Type drift:** Regenerate OpenAPI types (`npm run openapi:gen`)
- **CORS errors:** Check `FRONTEND_ORIGIN` matches Vite port exactly (no trailing slash)
- **Cookie not sent:** Check `COOKIE_SAMESITE_MODE` and HTTPS requirements
- **DB out of sync:** Run `npm run db:deploy` or create new migration
- **Permission denied:** Check role has permission in RBAC catalog
- **Trailing slashes:** `FRONTEND_ORIGIN` or `VITE_API_BASE_URL` with trailing slash causes CORS/cookie issues
- **Wrong Supabase endpoint:** Render requires Session Pooler (IPv4) URL, not direct connection
- **Migrations not applied:** Check logs for Prisma errors; ensure `prisma migrate deploy` runs on startup

## Key Files to Reference

- `api-server/src/app.ts` - Express app setup, middleware order
- `api-server/src/rbac/catalog.ts` - RBAC permissions and roles
- `api-server/prisma/schema.prisma` - Database schema
- `api-server/src/openapi/index.ts` - OpenAPI spec builder
- `admin-web/src/main.tsx` - React Router setup
- `admin-web/src/stores/auth.ts` - Auth state and permissions
- `admin-web/src/api/http.ts` - HTTP client base
