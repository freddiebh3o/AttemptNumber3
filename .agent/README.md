# .agent Documentation Index

Welcome to the comprehensive documentation for the Multi-Tenant Inventory Management System. This documentation is organized into three main categories: **System**, **Tasks**, and **SOP** (Standard Operating Procedures).

---

## Quick Start

**New to the project?** Start here:
1. Read [Project Architecture](./System/project_architecture.md) - High-level overview
2. Read [Database Schema Reference](./System/database_schema.md) - Understand data models
3. Read [Adding a New Feature](./SOP/adding_new_feature.md) - Learn the development workflow

**Need to troubleshoot?** Check [Debugging Guide](./SOP/debugging_guide.md)

---

## 📁 Documentation Structure

```
.agent/
├── README.md                      # This file - documentation index
├── System/                        # System architecture & design docs
│   ├── project_architecture.md    # Tech stack, architecture patterns, API design
│   ├── database_schema.md         # Complete database schema & relationships
│   ├── rbac_system.md             # Role-based access control implementation
│   └── stock_management.md        # FIFO inventory management system
├── Tasks/                         # Feature PRDs & implementation plans
│   └── (feature-specific docs)
└── SOP/                           # Standard operating procedures
    ├── adding_new_feature.md      # Step-by-step guide for new features
    └── debugging_guide.md         # Troubleshooting common issues
```

---

## 📚 System Documentation

### [Project Architecture](./System/project_architecture.md)
**What it covers:**
- Technology stack (backend, frontend, infrastructure)
- Architecture patterns (monorepo, layered architecture, multi-tenancy)
- Authentication & authorization (JWT cookies, RBAC)
- API design patterns (standard envelope, correlation IDs, idempotency, rate limiting)
- OpenAPI type generation workflow
- Database architecture (multi-tenant, optimistic locking, FIFO stock)
- Integration points (Supabase storage, PostgreSQL pooling)
- Testing strategy (Jest, Playwright)
- Security considerations
- Environment configuration
- Performance optimization
- Deployment architecture

**When to use:**
- Understanding the overall system design
- Onboarding new engineers
- Making architectural decisions
- Planning new features

---

### [Database Schema Reference](./System/database_schema.md)
**What it covers:**
- Complete entity relationship diagram (ERD)
- All 16 database tables with detailed field descriptions
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
- **Stock Management:** ProductStock, StockLot, StockLedger
- **Infrastructure:** IdempotencyRecord, ApiRequestLog, AuditEvent

**When to use:**
- Adding new database tables or fields
- Understanding data relationships
- Optimizing database queries
- Writing migrations
- Troubleshooting data integrity issues

---

### [RBAC System Design](./System/rbac_system.md)
**What it covers:**
- Complete RBAC architecture (global catalog, tenant-scoped roles)
- Permission catalog (11 permissions: products, users, roles, theme, branches, stock)
- System roles (OWNER, ADMIN, EDITOR, VIEWER) with permission breakdowns
- Backend enforcement (middleware: `requirePermission()`, `requireAnyPermission()`)
- Frontend enforcement (component: `<RequirePermission>`, hook: `usePermissions()`)
- Permission resolution flow (backend & frontend)
- Database schema (Permission, Role, RolePermission tables)
- Permission seeding workflow
- Custom roles (creating, updating, deleting)
- Assigning roles to users
- Security considerations
- Common workflows (adding new permission, checking permissions in service layer)
- Testing RBAC
- Troubleshooting (403 errors, stale permissions, system role protection)

**When to use:**
- Adding new permissions
- Creating custom roles
- Implementing permission checks
- Troubleshooting authorization issues
- Understanding access control logic

---

### [Stock Management System](./System/stock_management.md)
**What it covers:**
- FIFO (First-In, First-Out) inventory architecture
- Core concepts (Stock Lot, Product Stock aggregate, Stock Ledger)
- FIFO algorithm (receipt flow, consumption flow, adjustment flow)
- Branch membership & access control
- API endpoints (receive, consume, adjust, get levels, list movements)
- Transaction isolation (Serializable transactions, concurrency handling)
- Audit trail integration
- Cost accounting (COGS calculation)
- Edge cases & error handling (insufficient stock, negative prevention, lot depletion, concurrent conflicts)
- Reporting & analytics (stock movement, valuation, slow-moving inventory)
- Performance considerations (FIFO query optimization, denormalization, pagination)

**When to use:**
- Understanding inventory logic
- Implementing stock-related features
- Troubleshooting stock discrepancies
- Optimizing stock queries
- Generating inventory reports

---

## 🛠️ Standard Operating Procedures (SOP)

### [Adding a New Feature](./SOP/adding_new_feature.md)
**What it covers:**
- Complete step-by-step workflow for adding a new feature (using "Suppliers" as example)
- **Step 1:** Database changes (Prisma schema, migrations, seed data)
- **Step 2:** Add permissions (RBAC catalog, role assignments, seeding)
- **Step 3:** Backend implementation (service layer, OpenAPI schemas, router, registration)
- **Step 4:** Frontend implementation (type generation, API client, page component, routing)
- **Step 5:** Testing (backend Jest tests, frontend Playwright tests)
- Checklist for ensuring nothing is missed
- Common issues and solutions

**When to use:**
- Starting a new feature from scratch
- Ensuring you follow the correct workflow
- Onboarding new developers
- As a reference during implementation

**Example workflow:**
```
1. Update schema.prisma → migrate → seed
2. Add permissions → assign to roles → seed RBAC
3. Create service → OpenAPI schemas → router → register
4. Regenerate types → API client → page component → routing
5. Write tests → verify functionality
```

---

### [Debugging Guide](./SOP/debugging_guide.md)
**What it covers:**
- **Database Issues:** Migration failures, Prisma client sync, negative stock, data integrity
- **Authentication Issues:** Session cookies not set, CORS errors, permission denied (403)
- **API Issues:** OpenAPI types out of sync, request validation failures, CORS errors
- **Frontend Issues:** Component not rendering, permission checks not working
- **Performance Issues:** Slow API requests, slow frontend rendering
- **Deployment Issues:** Production build failures, database connection timeouts
- **Logging & Monitoring:** Enable debug logs, check correlation IDs

**When to use:**
- Encountering errors or unexpected behavior
- API calls failing
- Permission checks not working
- Performance problems
- Deployment issues

**Common scenarios:**
- "My session cookie isn't being set" → Check CORS origins and cookie mode
- "I'm getting 403 errors" → Check user's role and permissions
- "OpenAPI types are wrong" → Restart API server and regenerate types
- "Stock levels are incorrect" → Check aggregate vs lot sum, recalculate
- "Database migration failed" → Check syntax, reset database, manual fix

---

## 📋 Tasks Documentation

**Purpose:** Feature-specific PRDs (Product Requirements Documents) and implementation plans.

**Structure:** Each feature should have its own document with:
- **PRD:** Goals, requirements, user stories, acceptance criteria
- **Implementation Plan:** Technical approach, database changes, API design, frontend design
- **Status:** Planned, In Progress, Completed

**Example:**
```
Tasks/
├── feature_suppliers.md
├── feature_purchase_orders.md
└── feature_reporting_dashboard.md
```

**When to create:**
- Planning a new major feature
- Documenting complex changes
- Coordinating multi-person work

**Template:**
```markdown
# Feature: [Name]

## PRD (Product Requirements Document)

### Goals
- Primary goal
- Secondary goals

### User Stories
- As a [role], I want to [action], so that [benefit]

### Requirements
- Functional requirements
- Non-functional requirements

### Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Implementation Plan

### Database Changes
- Tables to add/modify
- Migrations needed

### API Design
- Endpoints to create
- Request/response schemas

### Frontend Design
- Pages to create
- Components to build

### Testing Plan
- Unit tests
- Integration tests
- E2E tests

## Status
- [ ] Planned
- [ ] In Progress
- [ ] Completed

## Notes
- Technical decisions
- Open questions
```

---

## 🔍 Finding Information

### By Topic

| Topic | Documentation |
|-------|---------------|
| **Tech Stack** | [Project Architecture](./System/project_architecture.md#technology-stack) |
| **Multi-Tenancy** | [Project Architecture](./System/project_architecture.md#multi-tenancy-architecture) |
| **Authentication** | [Project Architecture](./System/project_architecture.md#authentication--authorization) |
| **RBAC** | [RBAC System Design](./System/rbac_system.md) |
| **Permissions** | [RBAC System Design](./System/rbac_system.md#permission-catalog) |
| **Database Tables** | [Database Schema Reference](./System/database_schema.md#core-tables) |
| **Migrations** | [Database Schema Reference](./System/database_schema.md#migration-workflow) |
| **Stock/Inventory** | [Stock Management System](./System/stock_management.md) |
| **FIFO Logic** | [Stock Management System](./System/stock_management.md#fifo-algorithm) |
| **API Design** | [Project Architecture](./System/project_architecture.md#api-design-patterns) |
| **OpenAPI** | [Project Architecture](./System/project_architecture.md#openapi--type-generation) |
| **Adding Features** | [Adding a New Feature](./SOP/adding_new_feature.md) |
| **Debugging** | [Debugging Guide](./SOP/debugging_guide.md) |

### By Task

| Task | Documentation |
|------|---------------|
| **Add a new database table** | [Adding a New Feature](./SOP/adding_new_feature.md#step-1-database-changes) |
| **Add a new permission** | [Adding a New Feature](./SOP/adding_new_feature.md#step-2-add-permissions-if-needed) |
| **Create API endpoint** | [Adding a New Feature](./SOP/adding_new_feature.md#step-3-backend-implementation) |
| **Create frontend page** | [Adding a New Feature](./SOP/adding_new_feature.md#step-4-frontend-implementation) |
| **Fix 403 error** | [Debugging Guide](./SOP/debugging_guide.md#issue-permission-denied-403) |
| **Fix CORS error** | [Debugging Guide](./SOP/debugging_guide.md#issue-cors-error) |
| **Fix session cookie** | [Debugging Guide](./SOP/debugging_guide.md#issue-session-cookie-not-set) |
| **Optimize query** | [Debugging Guide](./SOP/debugging_guide.md#issue-slow-api-requests) |
| **Understand stock flow** | [Stock Management System](./System/stock_management.md#fifo-algorithm) |
| **Add custom role** | [RBAC System Design](./System/rbac_system.md#custom-roles-tenant-specific) |

---

## 🚀 Common Workflows

### Adding a New Feature
```
1. Read: Adding a New Feature SOP
2. Plan: Database schema, permissions, API, frontend
3. Implement: Follow step-by-step guide
4. Test: Backend + frontend tests
5. Document: Update .agent docs if needed
```

### Debugging an Issue
```
1. Identify: What's the error message?
2. Search: Debugging Guide for similar issue
3. Debug: Follow troubleshooting steps
4. Verify: Test the fix
5. Document: Add to debugging guide if new issue
```

### Understanding a System
```
1. Start: Project Architecture (high-level)
2. Deep Dive: Specific system docs (RBAC, Stock, etc.)
3. Reference: Database Schema for data model
4. Explore: Read actual code with context
```

---

## 📝 Keeping Documentation Updated

**When to update docs:**
- ✅ After adding a new feature → Update relevant system docs
- ✅ After fixing a tricky bug → Add to debugging guide
- ✅ After making architectural changes → Update project architecture
- ✅ After adding/modifying database tables → Update database schema
- ✅ After adding permissions → Update RBAC system docs

**How to update:**
1. Identify affected documentation files
2. Make changes inline (preserve structure)
3. Update "Last Updated" date at bottom
4. Update this README if adding new doc files

**Documentation principles:**
- Keep it accurate (outdated docs are worse than no docs)
- Keep it concise (link to other docs instead of duplicating)
- Keep it practical (include examples and code snippets)
- Keep it organized (follow the established structure)

---

## 🤝 Contributing

**Found an issue in the docs?** Fix it and update the "Last Updated" date.

**Have a question not covered?** Add it to the relevant doc or create a new one.

**Created a new feature?** Document it in the Tasks folder and update system docs.

---

## 📞 Getting Help

**Where to look:**
1. **This README** - Find the right documentation
2. **System Docs** - Understand architecture and design
3. **SOP Docs** - Follow step-by-step guides
4. **Debugging Guide** - Troubleshoot issues
5. **Code Comments** - Read inline documentation
6. **Git History** - See how features were implemented

**Still stuck?**
- Check the [main README](../README.md) for setup instructions
- Check [CLAUDE.md](../CLAUDE.md) for development commands
- Review recent commits for similar changes
- Ask the team

---

## 📊 Documentation Coverage

**System Architecture:** ✅ Complete
- Project Architecture
- Database Schema
- RBAC System
- Stock Management

**Standard Procedures:** ✅ Complete
- Adding New Features
- Debugging Common Issues

**Feature Tasks:** 🔄 As Needed
- Add feature-specific docs to Tasks/ folder as features are planned/implemented

---

**Last Updated:** 2025-10-11
**Document Version:** 1.0
**Total Documentation Files:** 6 (4 System, 0 Tasks, 2 SOP)
