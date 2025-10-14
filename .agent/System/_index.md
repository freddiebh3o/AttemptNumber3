# System Documentation Index

Welcome to the system documentation for the Multi-Tenant Inventory Management System. This directory contains living documentation that reflects the **current state** of the system architecture, design patterns, and domain models.

---

## Quick Navigation

| Document | Purpose | When to Use |
|----------|---------|-------------|
| [architecture.md](#architecturemd) | High-level system design | Understanding overall architecture, onboarding |
| [database-schema.md](#database-schemamd) | Complete database reference | Adding tables, writing queries, migrations |
| [rbac-system.md](#rbac-systemmd) | Permission system | Adding permissions, checking authorization |
| [stock-management.md](#stock-managementmd) | FIFO inventory system | Stock operations, inventory features |
| [Domain/](#domain-documentation) | Domain-specific models | Deep dive into specific business areas |

---

## Core System Documentation

### architecture.md

**Full Path:** `.agent/System/architecture.md`

**What it covers:**
- Technology stack (Node.js, Express, React, Vite, Prisma, PostgreSQL)
- Architecture patterns (monorepo, layered architecture, multi-tenancy)
- Authentication & authorization (JWT cookies, session management, RBAC)
- API design patterns (standard envelope, correlation IDs, idempotency, rate limiting)
- OpenAPI type generation workflow
- Database architecture (multi-tenant isolation, optimistic locking, FIFO stock)
- Integration points (Supabase, PostgreSQL connection pooling)
- Testing strategy (Jest, Playwright, 299 tests)
- Security considerations
- Environment configuration
- Performance optimization
- Deployment architecture

**When to use:**
- ✅ Onboarding new engineers to the project
- ✅ Understanding the overall system design
- ✅ Making architectural decisions
- ✅ Planning new features that span multiple layers
- ✅ Reviewing API design patterns
- ✅ Understanding authentication and session management

**Key sections:**
- Multi-Tenancy Architecture → How tenant isolation works
- API Design Patterns → Standard envelope, error handling
- OpenAPI & Type Generation → Frontend/backend contract
- Authentication & Authorization → Cookie-based sessions + RBAC

---

### database-schema.md

**Full Path:** `.agent/System/database-schema.md`

**What it covers:**
- Complete entity relationship diagram (ERD)
- All 16+ database tables with detailed field descriptions
- Table relationships and foreign keys
- Indexes and performance optimization
- Migration workflow (creating, applying, rolling back)
- Seed data structure
- Common query patterns (multi-tenant filtering, optimistic locking, FIFO)
- Performance considerations (indexed queries, denormalization, pagination)

**Tables documented:**
- **Global:** User, Permission
- **Tenant-Scoped:** Tenant, Role, Product, Branch, TenantBranding
- **Join Tables:** UserTenantMembership, RolePermission, UserBranchMembership
- **Stock Management:** ProductStock, StockLot, StockLedger, StockTransfer, TransferTemplate
- **Infrastructure:** IdempotencyRecord, ApiRequestLog, AuditEvent

**When to use:**
- ✅ Adding new database tables or columns
- ✅ Understanding data relationships
- ✅ Optimizing database queries
- ✅ Writing Prisma migrations
- ✅ Troubleshooting data integrity issues
- ✅ Understanding multi-tenant data isolation
- ✅ Designing new features that need persistence

**Key sections:**
- Core Tables → All models with field descriptions
- Relationships → Foreign keys and associations
- Migration Workflow → How to safely change the schema
- Common Query Patterns → Multi-tenant filtering, FIFO queries

---

### rbac-system.md

**Full Path:** `.agent/System/rbac-system.md`

**What it covers:**
- Complete RBAC architecture (global catalog, tenant-scoped roles)
- Permission catalog (11 permissions: products, users, roles, theme, branches, stock)
- System roles (OWNER, ADMIN, EDITOR, VIEWER) with permission breakdowns
- Backend enforcement (middleware: `requirePermission()`, `requireAnyPermission()`)
- Frontend enforcement (component: `<RequirePermission>`, hook: `usePermissions()`)
- Permission resolution flow (backend & frontend)
- Database schema (Permission, Role, RolePermission tables)
- Permission seeding workflow (`npm run seed:rbac`)
- Custom roles (creating, updating, deleting)
- Assigning roles to users
- Security considerations
- Common workflows (adding new permission, checking permissions in service layer)
- Testing RBAC
- Troubleshooting (403 errors, stale permissions, system role protection)

**When to use:**
- ✅ Adding new permissions for a feature
- ✅ Creating or modifying custom roles
- ✅ Implementing permission checks in backend routes
- ✅ Implementing permission-based UI in frontend
- ✅ Troubleshooting 403 Forbidden errors
- ✅ Understanding access control logic
- ✅ Testing different user roles

**Key sections:**
- Permission Catalog → All 11 permissions defined
- System Roles → OWNER, ADMIN, EDITOR, VIEWER breakdowns
- Backend Enforcement → Middleware usage
- Frontend Enforcement → Component and hook patterns

---

### stock-management.md

**Full Path:** `.agent/System/stock-management.md`

**What it covers:**
- FIFO (First-In, First-Out) inventory architecture
- Core concepts (Stock Lot, Product Stock aggregate, Stock Ledger)
- FIFO algorithm (receipt flow, consumption flow, adjustment flow)
- Branch membership & access control
- Stock transfer flows (between branches)
- API endpoints (receive, consume, adjust, transfer, get levels, list movements)
- Transaction isolation (Serializable transactions, concurrency handling)
- Audit trail integration
- Cost accounting (COGS calculation)
- Edge cases & error handling (insufficient stock, negative prevention, lot depletion, concurrent conflicts)
- Reporting & analytics (stock movement, valuation, slow-moving inventory)
- Performance considerations (FIFO query optimization, denormalization, pagination)

**When to use:**
- ✅ Understanding inventory logic and FIFO algorithm
- ✅ Implementing stock-related features
- ✅ Troubleshooting stock discrepancies
- ✅ Optimizing stock queries
- ✅ Generating inventory reports
- ✅ Understanding stock transfers between branches
- ✅ Implementing stock adjustments or movements

**Key sections:**
- FIFO Algorithm → How stock lots are consumed
- Stock Transfer Flow → Multi-branch inventory movement
- Transaction Isolation → Preventing race conditions
- Cost Accounting → COGS and valuation

---

## Domain Documentation

**Directory:** `.agent/System/Domain/`

Domain-specific documentation provides focused deep-dives into specific business areas. These are extracted and focused views of the broader system docs.

### Currently Empty

The Domain folder structure exists but doesn't contain documentation yet. Future domain docs could include:

**Planned domain docs:**
- **products.md** - Product model structure, SKU uniqueness, entity versioning, CRUD patterns
- **stock.md** - FIFO algorithm, stock lots/ledger/aggregates, branch membership, operations
- **transfers.md** - Stock transfer flow, transfer templates, reversal logic, multi-branch coordination
- **users.md** - User-Tenant-Branch relationships, user management, session handling, authentication

**When domain docs are added:**
- They will provide focused, practical guides for each business domain
- Cross-reference with main system docs for complete picture
- Use when working deeply in a specific domain area

---

## Common Tasks → Documentation Reference

| Task | Primary Doc | Supporting Docs |
|------|-------------|-----------------|
| **Add new database table** | database-schema.md | architecture.md (multi-tenant patterns) |
| **Add new API endpoint** | architecture.md (API patterns) | database-schema.md (models) |
| **Add new permission** | rbac-system.md | - |
| **Implement stock feature** | stock-management.md | database-schema.md (stock tables) |
| **Fix 403 error** | rbac-system.md | `.agent/SOP/debugging-guide.md` |
| **Understand multi-tenancy** | architecture.md | database-schema.md (tenantId patterns) |
| **Create migration** | database-schema.md | `.agent/SOP/adding-new-feature.md` |
| **Optimize query** | database-schema.md (indexes) | stock-management.md (FIFO queries) |
| **Add custom role** | rbac-system.md | - |
| **Understand FIFO** | stock-management.md | database-schema.md (StockLot, StockLedger) |

---

## Documentation Maintenance

### When to Update System Docs

**Update after:**
- ✅ Adding new database tables or major schema changes → **database-schema.md**
- ✅ Adding new permissions or changing role definitions → **rbac-system.md**
- ✅ Changing API design patterns or adding middleware → **architecture.md**
- ✅ Modifying stock/inventory logic or FIFO algorithm → **stock-management.md**
- ✅ Major architectural changes (new integrations, auth changes) → **architecture.md**

**How to update:**
1. Locate the relevant section in the doc
2. Update inline (preserve existing structure)
3. Add new sections if introducing entirely new concepts
4. Update "Last Updated" date at bottom of file
5. Cross-reference with related docs if needed

### Documentation Principles

- **Accuracy:** Outdated docs are worse than no docs. Keep them current.
- **Clarity:** Use examples, code snippets, and diagrams where helpful.
- **Completeness:** Cover the "what", "why", and "how" for each system.
- **Cross-referencing:** Link to related docs and SOPs.
- **Practical:** Focus on how developers will actually use the system.

---

## Related Documentation

### Standard Operating Procedures (SOPs)

For step-by-step guides on common tasks:
- `.agent/SOP/adding-new-feature.md` - Complete workflow for adding features
- `.agent/SOP/debugging-guide.md` - Troubleshooting common issues
- `.agent/SOP/testing-overview.md` - Testing strategy and practices

**See:** `.agent/SOP/_index.md` for complete SOP listing

### Features

For historical context on implemented features:
- `.agent/Features/Completed/` - Completed feature PRDs and implementation notes

**See:** `.agent/Features/_index.md` for feature catalog

### Agents

For agent-specific work and portfolios:
- `.agent/Agents/{agent-name}/` - Agent work logs and common patterns

**See:** `.agent/Agents/_index.md` for agent registry

---

## Quick Reference: System Overview

**Backend:**
- **Framework:** Node.js + Express + TypeScript
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** JWT cookies (signed tokens)
- **Authorization:** RBAC (role-based access control)
- **API:** RESTful with OpenAPI/Zod schemas

**Frontend:**
- **Framework:** React + Vite + TypeScript
- **UI Library:** Mantine UI + Tailwind CSS
- **State:** Zustand stores
- **Routing:** React Router v7
- **API Types:** Auto-generated from OpenAPI

**Testing:**
- **Backend:** Jest (227 tests)
- **Frontend:** Playwright E2E (72 tests)
- **Total:** 299 passing tests

**Multi-Tenancy:**
- Tenant-scoped data isolation via `tenantId`
- User can belong to multiple tenants
- Branch-level access control via `UserBranchMembership`

**Inventory:**
- FIFO (First-In, First-Out) stock management
- Stock lots with unit cost tracking
- Append-only stock ledger
- Denormalized product stock aggregates
- Stock transfers between branches

---

**Last Updated:** 2025-01-15
**Total System Docs:** 4 core + 0 domain (4 planned)
**Related:** [.agent/README.md](../README.md) | [.agent/SOP/_index.md](../SOP/_index.md) | [.agent/Features/_index.md](../Features/_index.md)
