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
cp .env.example .env # edit SERVER_PORT and FRONTEND_ORIGIN
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
* `FRONTEND_ORIGIN` — frontend origin for CORS (e.g. `http://localhost:5174`)
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
FRONTEND_ORIGIN=http://localhost:5174
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

1. Edit `prisma/schema.prisma`
2. `npm run prisma:generate`
3. `npm run db:migrate -- --name add_products_table`
4. (optional) `npm run db:seed`
5. Restart API if needed.

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
* **TenantUsers**: `GET /api/tenant-users`, `POST /api/tenant-users`, `PUT /api/tenant-users/{user-id}`, `DELETE /api/tenant-users/{user-id}`

Adding a new route:

1. Implement Express route + Zod validation
2. Add Zod schemas + `registerPath` entry in `openapi.ts`
3. Regenerate frontend types (`admin-web`: `npm run openapi:gen`)

---

## CORS & ports (dev)

* API: `http://localhost:4000`
* Frontend: `http://localhost:5174`
* CORS allowlist is configured in `api-server/src/app.ts` (`FRONTEND_ORIGIN`)

---

## Tenant/User Management

**Who can use it?**

* Only `OWNER` and `ADMIN` roles can create, update, or delete tenant users.
* `EDITOR` and `VIEWER` can only view.

**Rules enforced by API:**

* Cannot demote or delete the **last OWNER** of a tenant.
* All user actions (create/update/delete) support **idempotency keys**.

**UI features:**

* `/[tenantSlug]/users` shows all tenant members with role, email, timestamps.
* Owners/Admins can:

  * Invite (create or attach) a user with email/password/role
  * Update email, password, or role of existing members
  * Remove members from the tenant
* Friendly notifications and loading states
* Role-gated controls (non-ADMIN/OWNER see disabled buttons)

---

## Rate Limiting

* Middleware: fixed-window limiter with configurable scope (`ip`, `session`, or `ip+session`).
* Defaults in this POC: `300 requests per minute` per IP+session.
* Headers returned on each response:

  * `X-RateLimit-Limit`
  * `X-RateLimit-Remaining`
  * `X-RateLimit-Reset`
  * `Retry-After` (when exhausted)
* Exemptions: `OPTIONS`, `/api/health`, `/docs`.

---

## Troubleshooting quick refs

* **JSON body parsing issues**: ensure `Content-Type: application/json` and `express.json()` is registered before routes
* **CORS 401/blocked**: confirm `FRONTEND_ORIGIN` matches the Vite port
* **Type drift**: rerun `npm run openapi:gen` after server spec changes
* **DB mismatch**: run `npm run db:deploy` or `npm run db:migrate -- --name …`

---

## How to Add a New Environment (Prod or Another Staging)

This checklist walks you through creating a **new isolated environment** (e.g., production) alongside your current dev/staging setup. It covers Supabase (DB), Render (API), and Vercel (Web UI), plus required env vars and cookie/CORS gotchas.

---

### 1 Create a new database (Supabase)

1. **Create project** in the target region (ideally near your users).
2. Copy the **connection strings** from **Project Settings → Database → Connection strings**:

   * **Direct connection (IPv6)** → usually for local/dev
   * **Session pooler (IPv4)** → required by Render
3. In **SQL Editor** (optional if migrations already exist), ensure no manual schema; we’ll use Prisma migrations.

**Save these secrets** (you’ll paste them into Render later):

* `DATABASE_URL` → Use the **Session Pooler** IPv4 URL for Render (often like `aws-1-<region>.pooler.supabase.com`). Append `?sslmode=require` if not present.

---

### 2 Deploy a new API service (Render)

1. **Create New → Web Service** and point to this repo.

2. **Environment**: Node

3. **Build Command**: `npm ci && npm run build && npx prisma generate`

4. **Start Command**: `npm run start`

5. **Environment Variables** (Render → Settings → Environment):

   * `NODE_ENV=production`
   * `SERVER_PORT=4000` (Render sets `PORT`, but your server reads `SERVER_PORT`—keep 4000 consistent internally)
   * `FRONTEND_ORIGIN=https://<your-vercel-domain>` (no trailing slash)
   * `DATABASE_URL=` (Supabase **Session Pooler** connection string)
   * `SESSION_JWT_SECRET=` (strong random value)
   * `SESSION_COOKIE_NAME=mt_session`
   * `COOKIE_SAMESITE_MODE=none` (required for cross-site cookies in prod)
   * `LOG_LEVEL=info`
   * `PRETTY_LOGS=false`

6. **First deploy**. On start, the service runs `npm run start` which executes:

   * `prisma migrate deploy` → applies migrations
   * `node dist/server.js` → starts the API

7. **Health checks**: Visit `https://<render-app>.onrender.com/api/health`.

---

### 3 Deploy a new Web UI (Vercel)

1. **Import Project** from Git (same repo).
2. **Environment Variables** (Vercel → Settings → Environment Variables):

   * `VITE_API_BASE_URL=https://<your-render-api-domain>` (no trailing slash)
3. **Domains**: add your custom domain later if needed.
4. **Redeploy**.

---

### 4 Cookie & CORS sanity

* **Server CORS allow-list** (`FRONTEND_ORIGIN`) must match your Vercel domain **exactly** (no trailing slash).
* **Cookies**:

  * In **prod/staging cross-site**, set `COOKIE_SAMESITE_MODE=none` → the server sets `SameSite=None; Secure`.
  * Locally, set `COOKIE_SAMESITE_MODE=lax` for `http://localhost`.

**Quick test order**:

1. Hit `POST /api/auth/sign-in` from the web app → expect `Set-Cookie` with `SameSite=None; Secure`.
2. Then `GET /api/auth/me` should succeed (cookie sent back).
3. CRUD on `/api/products` behaves as expected.

---

### 5 Prisma data setup (optional)

If you need initial data in the new environment:

* **Option A: run seed locally against the new DB**

  ```bash
  # In api-server/
  # Temporarily point your local .env DATABASE_URL to the NEW environment (Session Pooler URL)
  npx prisma migrate deploy
  npm run db:seed
  ```

* **Option B: admin UI**

  * Sign in to the new environment and create data via the UI.

---

### 6 OpenAPI docs per environment

* API serves the spec at `GET /openapi.json` and UI at `/docs`.
* If you want the frontend to **download types** per environment (optional): point your OpenAPI generation script to the new `/openapi.json`.

---

### 7 Common pitfalls

* **Trailing slash** on `FRONTEND_ORIGIN` or `VITE_API_BASE_URL` → CORS/Cookie issues.
* **Wrong Supabase endpoint**: Render requires **Session Pooler (IPv4)**.
* **Cookie mode** not set to `none` in prod → cookie blocked by browser.
* **Migrations not applied** → `P1001/Pxxxx` errors; ensure `prisma migrate deploy` runs at start.

---

### 8 Minimal rollback plan

* Keep your **previous environment** running.
* If the new environment misbehaves, just switch the domain you share with users back to the previous one.

---

### 9 Tear-down (if needed)

* Remove Vercel project (UI), Render service (API), and Supabase project (DB). Double-check backups before deletion.

---

### One-page checklist

* [ ] Create Supabase project (copy **Session Pooler** `DATABASE_URL`).
* [ ] New Render service: set env vars (see list), deploy, confirm `/api/health`.
* [ ] New Vercel project: set `VITE_API_BASE_URL`, deploy, test sign-in.
* [ ] Verify cookies/CORS; confirm `/api/auth/me` returns user.
* [ ] (Optional) Seed data.
* [ ] (Optional) Generate OpenAPI types against `/openapi.json`.
* [ ] Document URLs and secrets.

## Future fetures
### Features to complete by Monday
* Admin logs - frontend
  * Tenant level audit log page
    * Table view + Timeline view
  * Add activity log tab for all entity scopes

* Look into theme update. Seems to be producing more logs than anticipated.

* Find a way to simulate what happens when a session expires 
  * Current suspicion is that you are not automatically logged out 
  * Instead, any request you make just fails with the notification 'Please sign in to continue'
  * Instead of this, any request that is made that requires the user to be logged in and they arent logged in, should be redirected to the login page automatically 
  * Whenever a user is logged out and redirected to the login page, it should show a clear reason on the login page as to why they were logged out

* Stock transfer between different branches/locations
  * Effectively an 'order' between two branches 
  * Will be able to exist in one of the following 'stages'
    * Requested -> The item/items has been requested by one branch to another 
    * Rejected -> The request has been rejected 
    * Ordered -> The request has been accepted 
    * Partially received -> The item/items that were ordered have only been partially received
    * Complete -> The item/items have been received

* Remake the Readme with latest feature updates

### The rest
* Feature flag to determine what type of stock management you want to use? 
  * FIFO -> First in first out 
  * LIFO -> Last in first out 
  * Weighted average cost -> Uses average price 
  * Specific identification -> Values each item separately 
  * FEFO -> First expired first out

* Current existing tabs that we don't currently have 
  * Dashboard -> Self explantory
  * Maintenance 
    * Where users manage different Customers or suppliers
  * Purchasing 
    * Where users order in products from suppliers and manage those orders
      * Draft -> A draft order, not confirmed yet
      * Ordered -> A confirmed order
      * Partially received -> Items in the order have partially been received 
      * Fully received -> All items in the order have been received
      * Complete/Cancelled -> Order has been marked as complete or cancelled.
    * Once an order has been completed, the stock ledger for that product is updated with the new stock
  * Sales 
    * Where users manage sales to customers
      * Quotes -> A quote has been generated and a pro forma can be sent to the customer
      * Sales order -> An order is created, and either paid for using cash/card, or using a ledger account where the user has credit on their account. 
      * Picking note -> Once the order has been confirmed as paid for, the user can print a picking note, that tells them exactly where to find the product in the warehouse for the order. (this bit is going to be tricky because i believe it will require intergrating the warehouse scanner technology)
      * Awaiting approval -> If the user is a ledger account (i.e. they havn't paid with cash/card) then the order requires approval
      * Invoiced -> once the order has been approved, an invoice is sent to the customer so they can pay for the order
      * Credit note -> If the user wants to refund the order, you can create a separate credit note to do so
  * Stock transfer -> already explained above 
  * Reporting -> various statistics
    * Yearly sales comparison -> compare sales data from previous years
    * External sales reps -> Compare the performace of your external sales representatives 
    * Stock valuation report
      * View the total FIFO valuation for each location 
      * Maybe also include the top products you have the most value sunk into
    * Inventory items -> Search feature to allow you to check the stock levels and FIFO costs of items in your inventory
    * Aged stock report -> Check the historical data for the products in your inventory
    * Nominal Transactions report -> View and compare nominal transactions -> not a clue what this is 
    * Product transactions report -> View and compare product transactions -> Basically just a log of every event that happens for any given product, will be supported by the api logs work we do
  * System Config
    * Broadcast message -> Allows an admin to broadcast a message on the dashboard screen to all the other users for a given period of time 
    * Managers' config -> Setting global settings like minimum and maximum gross profit 
    * System logs -> All api system logs for the given tenant
  * CMS -> you know what this is 
  * Ledger -> Not a clue what this is? Some form of VIM to the D3 machine?
  * Global search -> Ability to search for anything anywhere on the project and go straight there 
    * Products 
    * Customers 
    * Suppliers 
    * Sales orders 
    * Purchase orders 
  * AI Support -> Unlikely something i would do but could give it a good ole college try. 
  

* Monitoring & metrics
  * Sentry
  * Uptime monitor
  * Prometheus?

---