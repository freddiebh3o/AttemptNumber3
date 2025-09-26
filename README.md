# Multi-Tenant Admin POC

A proof-of-concept multi-tenant admin system built with:

* **API server**: Node.js + Express + PostgreSQL (Prisma ORM)
* **Auth**: Cookie-based sessions with role-based access control (RBAC)
* **Frontend**: React + Mantine + TailwindCSS
* **API Docs**: OpenAPI 3.0, served with Swagger UI
* **Logging**: Pino with request/response correlation IDs

---

## Features

* Multi-tenant architecture with per-tenant RBAC
* Authentication via signed session cookies
* Product CRUD APIs with idempotency support
* Auto-generated OpenAPI spec (`/openapi.json`) and Swagger UI docs (`/docs`)
* Type-safe frontend API clients generated from OpenAPI
* Hardened security middleware (Helmet, CORS, cookie flags)
* Structured logging with correlation IDs

---

## Quickstart (Dev)

### 1. API Server

```bash
cd api-server
cp .env.example .env # edit SERVER_PORT and FRONTEND_DEV_ORIGIN
npm install
npm run dev
```

* Runs on [http://localhost:4000](http://localhost:4000)
* OpenAPI JSON: [http://localhost:4000/openapi.json](http://localhost:4000/openapi.json)
* Swagger UI: [http://localhost:4000/docs](http://localhost:4000/docs)

### 2. Admin Web UI

```bash
cd admin-web
npm install
npm run dev -- --port 5174
```

* Runs on [http://localhost:5174](http://localhost:5174)

---

## Environment Variables

### API Server

* `SERVER_PORT` — default `4000`
* `FRONTEND_DEV_ORIGIN` — frontend origin for CORS (e.g. `http://localhost:5174`)
* `LOG_LEVEL` — Pino log level (`info` by default)
* `PRETTY_LOGS` — set to `false` in prod

### Admin Web

* `VITE_API_BASE_URL` — API base URL (defaults to `http://localhost:4000`)

---

## Scripts

### API Server

* `npm run dev` — run with hot-reload via tsx
* `npm run build` — compile TypeScript

### Admin Web

* `npm run dev` — start Vite dev server
* `npm run build` — build static assets

---

## API Documentation

* OpenAPI JSON: `GET /openapi.json`
* Swagger UI: `GET /docs`
* Postman/Insomnia collections can be generated from the spec.

---

## Logging

* Structured logs via Pino
* Includes correlation ID, user/tenant IDs, request/response summary
* Example:

```
[2025-09-25 23:01:14.289 +0100] INFO: GET /api/products?limit=50 304
    correlationId: "528a3e07-cab9-4ace-b2e6-8187b0c626e4"
    currentUserId: "cmfzrh0ol0002u2u07k55ousu"
    currentTenantId: "cmfzrgzlr0000u2u0k36bfal1"
    responseTime: 863
```

---

## Current Phases Completed

1. API project setup (Express, Prisma, Postgres)
2. Authentication (sessions, cookies, RBAC)
3. Product CRUD API + validation
4. Security hardening (helmet, CORS, body size limits, etc.)
5. Minimal admin web UI (login + product list)
   5.5. Structured logging
6. OpenAPI spec + typed frontend API clients

---

## Next Steps (Planned)

* Phase 7: Dev vs Prod configs + deployment setup
* Phase 8: Tenant/user management UI
* Phase 9: Billing & subscriptions (Stripe)
* Phase 10: Monitoring & metrics

---

## Database (Prisma + PostgreSQL)

### Schema overview (high-level)

* **Tenant**↔**User** via **UserTenantMembership** (with `roleName`: OWNER/ADMIN/EDITOR/VIEWER)
* **Product** belongs to a **Tenant**; has `entityVersion` for optimistic concurrency
* **IdempotencyRecord** stores responses for POST/PUT/DELETE replays

### Required env vars

Create `api-server/.env` with (example Supabase/Local):

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME
SERVER_PORT=4000
FRONTEND_DEV_ORIGIN=http://localhost:5174
SESSION_SECRET=dev-secret-change-me
```

### Common Prisma commands

From `api-server/`:

* **Generate client** (after schema change):

  ```bash
  npm run prisma:generate
  ```
* **Create & apply a migration in dev** (writes SQL under `prisma/migrations/` and updates DB):

  ```bash
  npm run db:migrate -- --name your_migration_name
  ```
* **Apply pending migrations in non-dev** (no prompts; good for CI/Prod):

  ```bash
  npm run db:deploy
  ```
* **Open Prisma Studio** (visual data browser):

  ```bash
  npm run db:studio
  ```
* **Seed demo data** (tenants, user, products):

  ```bash
  npm run db:seed
  ```

### Typical dev workflow

1. Edit `prisma/schema.prisma` → 2) `npm run prisma:generate` → 3) `npm run db:migrate -- --name add_products_table` → 4) (optional) `npm run db:seed` → 5) Restart API if needed.

> Resetting locally (⚠ destructive): drop the DB (via provider), re-create, then run `npm run db:deploy` and `npm run db:seed`.

---

## API Documentation (OpenAPI)

* View **Swagger UI** at **`http://localhost:4000/docs`**
* Raw JSON spec at **`http://localhost:4000/openapi.json`** (importable to Postman/Insomnia)

### Re-generate frontend types from the spec

From `admin-web/` (uses your configured generator):

```bash
npm run openapi:gen
```

This updates `admin-web/src/types/openapi.d.ts` (or your configured output). Rebuild the app after generation.

### How we keep spec in sync

1. Define/adjust Zod schemas in `api-server/src/openapi/openapi.ts`
2. Register/modify paths in `registerAllPathsInOpenApiRegistry()`
3. Restart API → `/openapi.json` updates
4. Run `npm run openapi:gen` in `admin-web/`

---

## Using OpenAPI types in the frontend

We reference the generated `paths` type to make API calls type-safe.

**Example: typed Product create/update/list**

```ts
import { httpRequestJson } from '@/api/http'
import type { paths } from '@/types/openapi'

// Body and responses (narrowed to JSON content)
type CreateBody = NonNullable<paths['/api/products']['post']['requestBody']>['content']['application/json']
type Create201  = paths['/api/products']['post']['responses']['201']['content']['application/json']

type UpdateBody = NonNullable<paths['/api/products/{productId}']['put']['requestBody']>['content']['application/json']
type Update200  = paths['/api/products/{productId}']['put']['responses']['200']['content']['application/json']

type List200    = paths['/api/products']['get']['responses']['200']['content']['application/json']

export function createProduct(body: CreateBody) {
  return httpRequestJson<Create201>('/api/products', { method: 'POST', body: JSON.stringify(body) })
}
export function updateProduct(productId: string, body: UpdateBody) {
  return httpRequestJson<Update200>(`/api/products/${productId}`, { method: 'PUT', body: JSON.stringify(body) })
}
export function listProducts() {
  return httpRequestJson<List200>('/api/products')
}
```

Benefits:

* Autocomplete for payload fields (e.g., `productName`, `currentEntityVersion`)
* Compile-time errors if server schema changes
* Zero manual DTO duplication

---

## Correlation IDs (what/why/how)

**What is it?**
A unique request identifier attached to every incoming HTTP request and propagated through logs and error envelopes.

**Why?**

* Quickly trace a single request across logs (ingress → service → DB ops)
* Include in error responses so users/devs can report an exact failing request

**How it works here**

* `requestIdMiddleware` assigns a UUIDv4 to `req.correlationId` (or reuses an inbound id if present)
* `pino-http` is configured to log this id; the field shows up as `correlationId` in each line
* Error responses (our standard error envelope) include the same `correlationId`:

```json
{
  "success": false,
  "data": null,
  "error": {
    "errorCode": "VALIDATION_ERROR",
    "httpStatusCode": 400,
    "userFacingMessage": "Invalid request body",
    "developerMessage": "…",
    "correlationId": "af8da79c-bc7b-…"
  }
}
```

Use this id to filter logs and pinpoint the exact failing path.

---

## Routes covered in the spec

* **Auth**: `POST /api/auth/sign-in`, `POST /api/auth/sign-out`, `GET /api/auth/me`, `POST /api/auth/switch-tenant`
* **Products**: `GET /api/products`, `POST /api/products`, `PUT /api/products/{productId}`, `DELETE /api/products/{productId}`
* **System**: `GET /api/health`, `GET /api/version`

Adding a new route:

1. Implement Express route + Zod validation
2. Add Zod schemas + `registerPath` entry in `openapi.ts`
3. Regenerate frontend types (`admin-web`: `npm run openapi:gen`)

---

## CORS & ports (dev)

* API: `http://localhost:4000`
* Frontend: `http://localhost:5174`
* CORS allowlist is configured in `api-server/src/app.ts` (`FRONTEND_DEV_ORIGIN`)

---

## Troubleshooting quick refs

* **JSON body parsing issues**: ensure `Content-Type: application/json` and `express.json()` is registered before routes
* **CORS 401/blocked**: confirm `FRONTEND_DEV_ORIGIN` matches the Vite port
* **Type drift**: rerun `npm run openapi:gen` after server spec changes
* **DB mismatch**: run `npm run db:deploy` or `npm run db:migrate -- --name …`


## Current Phases Completed

1. API project setup (Express, Prisma, Postgres)
2. Authentication (sessions, cookies, RBAC)
3. Product CRUD API + validation
4. Security hardening (helmet, CORS, body size limits, etc.)
5. Minimal admin web UI (login + product list)
   5.5. Structured logging
6. OpenAPI spec + typed frontend API clients

---

## Future fetures
* Global loading/loading bus
* Admin branding
* Image uploading
* Plan out feature roadmap

## Next Steps (Planned)

* Phase 7: Dev vs Prod configs + deployment setup
* Phase 8: Tenant/user management UI
* Phase 9: Monitoring & metrics
* Phase 10: Billing & subscriptions (Stripe)
