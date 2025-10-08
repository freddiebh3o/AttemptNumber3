# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
```

**IMPORTANT:** After changing OpenAPI schemas in `api-server/src/openapi/`, restart the API server, then run `npm run openapi:gen` from `admin-web/` to update frontend types.

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

**Local testing:**
- Use Prisma Studio (`npm run db:studio`) to inspect/edit DB directly
- Check logs for `correlationId` to trace specific requests
- Swagger UI at `http://localhost:4000/docs` for API exploration

**Common issues:**
- **Type drift:** Regenerate OpenAPI types (`npm run openapi:gen`)
- **CORS errors:** Check `FRONTEND_ORIGIN` matches Vite port exactly
- **Cookie not sent:** Check `COOKIE_SAMESITE_MODE` and HTTPS requirements
- **DB out of sync:** Run `npm run db:deploy` or create new migration
- **Permission denied:** Check role has permission in RBAC catalog

## Key Files to Reference

- `api-server/src/app.ts` - Express app setup, middleware order
- `api-server/src/rbac/catalog.ts` - RBAC permissions and roles
- `api-server/prisma/schema.prisma` - Database schema
- `api-server/src/openapi/index.ts` - OpenAPI spec builder
- `admin-web/src/main.tsx` - React Router setup
- `admin-web/src/stores/auth.ts` - Auth state and permissions
- `admin-web/src/api/http.ts` - HTTP client base
