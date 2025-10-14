# Agent Registry & Index

This directory contains work logs and portfolios for specialized sub-agents. Each agent focuses on a specific domain of expertise and maintains a portfolio of completed work.

---

## Quick Navigation

| Agent | Specialty | When to Use |
|-------|-----------|-------------|
| [database-expert](#database-expert) | Database schema, migrations | Adding tables, columns, indexes |
| [backend-api-expert](#backend-api-expert) | API routes, business logic | Creating endpoints, services |
| [frontend-expert](#frontend-expert) | React UI, components | Building pages, forms, UI |
| [rbac-security-expert](#rbac-security-expert) | Permissions, security | Adding permissions, auth logic |
| [test-engineer](#test-engineer) | Testing, quality assurance | Writing tests, fixing flakiness |
| [stock-inventory-expert](#stock-inventory-expert) | Inventory, FIFO logic | Stock features, transfers |
| [integration-orchestrator](#integration-orchestrator) | Build, deployment, sync | Type gen, builds, checklists |
| [debugging-detective](#debugging-detective) | Bug investigation | Troubleshooting issues |

---

## Agent Capabilities Matrix

| Capability | Database | Backend | Frontend | RBAC | Test | Stock | Integration | Debug |
|------------|----------|---------|----------|------|------|-------|-------------|-------|
| **Schema Design** | ✅ Primary | ⚠️ Reviews | - | - | ✅ Tests | ⚠️ Consults | - | - |
| **Migrations** | ✅ Primary | - | - | - | ✅ Tests | - | ⚠️ Coordinates | ⚠️ Fixes |
| **API Routes** | - | ✅ Primary | ⚠️ Consumes | ⚠️ Enforces | ✅ Tests | ⚠️ Implements | - | ⚠️ Debugs |
| **Service Layer** | - | ✅ Primary | - | ⚠️ Enforces | ✅ Tests | ✅ Implements | - | ⚠️ Debugs |
| **OpenAPI Schemas** | - | ✅ Primary | ⚠️ Uses | - | - | - | ✅ Syncs | - |
| **React Components** | - | - | ✅ Primary | ⚠️ Guards | ✅ Tests | - | - | ⚠️ Debugs |
| **Permission Checks** | - | ⚠️ Implements | ⚠️ Implements | ✅ Primary | ✅ Tests | - | - | ⚠️ Debugs |
| **Role Management** | ⚠️ Schema | ⚠️ API | ⚠️ UI | ✅ Primary | ✅ Tests | - | - | - |
| **Backend Tests** | ⚠️ Assists | ⚠️ Assists | - | ⚠️ Assists | ✅ Primary | ⚠️ Assists | ⚠️ Runs | ⚠️ Fixes |
| **E2E Tests** | - | - | ⚠️ Assists | ⚠️ Assists | ✅ Primary | ⚠️ Assists | ⚠️ Runs | ⚠️ Fixes |
| **FIFO Logic** | ⚠️ Schema | ⚠️ API | ⚠️ UI | - | ✅ Tests | ✅ Primary | - | ⚠️ Debugs |
| **Stock Transfers** | ⚠️ Schema | ⚠️ API | ⚠️ UI | - | ✅ Tests | ✅ Primary | - | ⚠️ Debugs |
| **Type Generation** | - | ⚠️ Schemas | ✅ Uses | - | - | - | ✅ Primary | ⚠️ Fixes |
| **Build/Deploy** | ⚠️ Migrations | ⚠️ Build | ⚠️ Build | - | ⚠️ CI | - | ✅ Primary | ⚠️ Fixes |
| **Bug Investigation** | ⚠️ Data issues | ⚠️ API issues | ⚠️ UI issues | ⚠️ Auth issues | ⚠️ Test issues | ⚠️ FIFO issues | ⚠️ Deploy issues | ✅ Primary |

**Legend:** ✅ Primary responsibility | ⚠️ Supporting role | - Not applicable

---

## Agent Definitions

### database-expert

**Agent Definition:** `.claude/agents/database-expert.md`
**Portfolio:** `database-expert/README.md`
**Recent Work:** `database-expert/work/` (chronological logs)

**Specialty:**
Database schema design, Prisma migrations, multi-tenant data modeling, seeding, and query optimization.

**Core Responsibilities:**
- Designing new database tables with multi-tenant patterns
- Creating and applying Prisma migrations
- Adding indexes for performance
- Writing seed scripts for test data
- Enforcing `tenantId` on tenant-scoped tables
- Implementing optimistic locking with `entityVersion`
- Designing foreign keys and relationships

**Typical Tasks:**
- "Add a Supplier table with multi-tenant pattern"
- "Create migration to add `description` field to Product"
- "Add index on `Product.sku` for faster lookups"
- "Design schema for purchase order feature"
- "Write seed data for 100 test products"

**Outputs:**
- Prisma schema changes (`prisma/schema.prisma`)
- Migration files (`prisma/migrations/`)
- Seed script updates (`prisma/seed.ts`)
- Documentation: `.agent/System/database-schema.md` updates

**Handoff To:**
- backend-api-expert (uses the models)
- test-engineer (tests schema and migrations)
- rbac-security-expert (may add permissions for new resources)

**Documentation References:**
- `.agent/System/database-schema.md` - Current schema
- `.agent/System/architecture.md` - Multi-tenant patterns
- `api-server/prisma/schema.prisma` - Prisma schema file

---

### backend-api-expert

**Agent Definition:** `.claude/agents/backend-api-expert.md`
**Portfolio:** `backend-api-expert/README.md`
**Recent Work:** `backend-api-expert/work/`

**Specialty:**
Express API routes, service layer business logic, OpenAPI schemas, request validation, and error handling.

**Core Responsibilities:**
- Creating RESTful API endpoints (CRUD operations)
- Implementing service layer with business rules
- Defining Zod schemas for OpenAPI documentation
- Applying middleware (auth, permissions, validation)
- Implementing error handling with AppError
- Enforcing multi-tenant filtering (`req.currentTenantId`)

**Typical Tasks:**
- "Create CRUD endpoints for Supplier resource"
- "Add OpenAPI schemas for supplier endpoints"
- "Implement business logic for purchase order creation"
- "Add validation for stock transfer requests"
- "Enforce RBAC on new endpoints"

**Outputs:**
- Service files (`src/services/{resource}Service.ts`)
- Router files (`src/routes/{resource}Router.ts`)
- OpenAPI schemas (`src/openapi/paths/{resource}.ts`)
- Route registration (`src/routes/index.ts`)

**Handoff To:**
- frontend-expert (consumes the API)
- test-engineer (tests endpoints)
- integration-orchestrator (regenerates OpenAPI types)

**Receives From:**
- database-expert (database models to use)
- rbac-security-expert (permissions to enforce)

**Documentation References:**
- `.agent/System/architecture.md` - API design patterns
- `.agent/System/rbac-system.md` - Permission enforcement
- `.agent/System/database-schema.md` - Available models

---

### frontend-expert

**Agent Definition:** `.claude/agents/frontend-expert.md`
**Portfolio:** `frontend-expert/README.md`
**Recent Work:** `frontend-expert/work/`

**Specialty:**
React components, Mantine UI, TypeScript, routing, state management (Zustand), and responsive design.

**Core Responsibilities:**
- Creating page components with Mantine UI
- Building forms with validation (react-hook-form)
- Implementing CRUD interfaces
- Adding routing and navigation
- Implementing permission-based UI rendering
- Creating reusable component libraries
- Type-safe API integration

**Typical Tasks:**
- "Create Supplier list page with table"
- "Build supplier form with validation"
- "Add routing for supplier pages with permission guards"
- "Implement stock transfer UI with barcode scanning"
- "Create responsive dashboard layout"

**Outputs:**
- Page components (`src/pages/{Resource}Page.tsx`)
- Form components (`src/components/{Resource}Form.tsx`)
- API clients (`src/api/{resource}.ts`)
- Route definitions (`src/main.tsx`)

**Handoff To:**
- test-engineer (tests UI with Playwright E2E)

**Receives From:**
- backend-api-expert (API contracts)
- integration-orchestrator (runs openapi:gen for type sync)

**Documentation References:**
- `.agent/System/architecture.md` - Frontend patterns
- `admin-web/src/types/openapi.d.ts` - Generated types

---

### rbac-security-expert

**Agent Definition:** `.claude/agents/rbac-security-expert.md`
**Portfolio:** `rbac-security-expert/README.md`
**Recent Work:** `rbac-security-expert/work/`

**Specialty:**
Role-based access control, permission design, security patterns, authentication, and authorization.

**Core Responsibilities:**
- Designing permission structures for features
- Updating permission catalog
- Assigning permissions to system roles
- Implementing backend permission middleware
- Implementing frontend permission guards
- Security review of authentication flows
- Auditing access control logic

**Typical Tasks:**
- "Add permissions for Supplier resource (read, write, delete)"
- "Update role definitions to include supplier permissions"
- "Review security of stock transfer API"
- "Implement permission checks in supplier service layer"
- "Add permission-based UI rendering for suppliers page"

**Outputs:**
- Permission catalog updates (`src/rbac/catalog.ts`)
- Middleware usage in routes
- Frontend permission guards (`<RequirePermission>`)
- RBAC seed script updates (`scripts/seed-rbac.ts`)

**Handoff To:**
- backend-api-expert (implements permission checks)
- frontend-expert (implements permission-based UI)
- test-engineer (tests different roles)

**Documentation References:**
- `.agent/System/rbac-system.md` - RBAC design
- `.agent/System/architecture.md` - Auth patterns

---

### test-engineer

**Agent Definition:** `.claude/agents/test-engineer.md`
**Portfolio:** `test-engineer/README.md`
**Recent Work:** `test-engineer/work/`

**Specialty:**
Jest backend tests, Playwright E2E tests, test helpers/factories, RBAC testing, flakiness resolution, and test coverage.

**Core Responsibilities:**
- Writing Jest integration tests for API endpoints
- Creating Playwright E2E tests for user flows
- Building test helpers and factories
- Testing permission enforcement (different roles)
- Fixing flaky tests
- Testing multi-tenant isolation
- Testing FIFO stock operations
- Achieving comprehensive test coverage

**Typical Tasks:**
- "Write Jest tests for Supplier CRUD endpoints"
- "Create E2E test for supplier creation flow"
- "Test all RBAC roles on supplier endpoints"
- "Fix flaky stock transfer test"
- "Add test helpers for creating test suppliers"

**Outputs:**
- Backend tests (`api-server/__tests__/{resource}.test.ts`)
- Frontend E2E tests (`admin-web/e2e/{resource}.spec.ts`)
- Test helpers (`__tests__/helpers/`)
- Test factories (`__tests__/helpers/factories.ts`)

**Handoff To:**
- integration-orchestrator (verifies everything works together)

**Receives From:**
- All other agents (tests their work)

**Documentation References:**
- `.agent/SOP/testing-overview.md` - Testing strategy
- `.agent/SOP/backend-testing.md` - Backend patterns
- `.agent/SOP/frontend-testing.md` - Frontend patterns
- `.agent/SOP/test-flakiness.md` - Flakiness debugging
- `.agent/SOP/troubleshooting-tests.md` - Test fixes

---

### stock-inventory-expert

**Agent Definition:** `.claude/agents/stock-inventory-expert.md`
**Portfolio:** `stock-inventory-expert/README.md`
**Recent Work:** `stock-inventory-expert/work/`

**Specialty:**
FIFO inventory management, stock operations, stock transfers, lot tracking, cost accounting, and inventory domain logic.

**Core Responsibilities:**
- Implementing FIFO stock consumption logic
- Designing stock transfer workflows
- Implementing stock receipt/adjustment operations
- Cost of goods sold (COGS) calculations
- Stock ledger management
- Branch-to-branch transfer coordination
- Inventory reporting and analytics

**Typical Tasks:**
- "Implement FIFO consumption for stock transfers"
- "Add support for transfer templates"
- "Implement stock reversal logic"
- "Create inventory valuation report"
- "Optimize FIFO query performance"

**Outputs:**
- Stock service logic (`src/services/stockService.ts`)
- Transfer service logic (`src/services/transferService.ts`)
- FIFO algorithms
- Stock-related API endpoints

**Handoff To:**
- backend-api-expert (exposes stock operations via API)
- frontend-expert (builds stock UI)
- test-engineer (tests FIFO logic)

**Receives From:**
- database-expert (stock schema design)

**Documentation References:**
- `.agent/System/stock-management.md` - FIFO architecture
- `.agent/System/database-schema.md` - Stock tables

---

### integration-orchestrator

**Agent Definition:** `.claude/agents/integration-orchestrator.md`
**Portfolio:** `integration-orchestrator/README.md`
**Recent Work:** `integration-orchestrator/work/`

**Specialty:**
OpenAPI type synchronization, deployment checklists, environment validation, build verification, and cross-cutting integration coordination.

**Core Responsibilities:**
- Regenerating frontend types from OpenAPI spec
- Creating deployment checklists
- Verifying environment configuration
- Running build and typecheck commands
- Updating system documentation after features
- Coordinating database migrations
- Testing end-to-end workflows
- Ensuring frontend/backend contract compatibility

**Typical Tasks:**
- "Regenerate frontend types after API changes"
- "Create deployment checklist for Supplier feature"
- "Verify all environment variables are set"
- "Run full build and typecheck"
- "Update system docs after feature completion"

**Outputs:**
- OpenAPI type regeneration (`npm run openapi:gen`)
- Deployment checklists
- Build verification reports
- System documentation updates
- Environment validation

**Handoff To:**
- Feature is complete and ready for deployment

**Receives From:**
- All other agents (coordinates their outputs)

**Documentation References:**
- `.agent/Features/{feature}/*.md` - All agent outputs
- `.agent/System/architecture.md` - Integration patterns
- `.agent/RESTRUCTURE_PLAN.md` - Documentation standards

---

### debugging-detective

**Agent Definition:** `.claude/agents/debugging-detective.md`
**Portfolio:** `debugging-detective/README.md`
**Recent Work:** `debugging-detective/work/`

**Specialty:**
Bug investigation, root cause analysis, correlation ID tracing, performance profiling, and systematic debugging.

**Core Responsibilities:**
- Investigating reported bugs and errors
- Tracing requests through correlation IDs
- Analyzing logs for error patterns
- Performance profiling and optimization
- Database query debugging
- CORS and authentication issues
- Stock calculation discrepancies
- Test failure investigation

**Typical Tasks:**
- "Investigate why stock levels are incorrect"
- "Debug 403 error on supplier endpoint"
- "Find root cause of flaky test"
- "Trace slow API request using correlation ID"
- "Debug CORS issue in production"

**Outputs:**
- Root cause analysis documents
- Bug fix implementations
- Performance optimization recommendations
- Debug logs and traces
- Issue resolutions

**Handoff To:**
- Appropriate specialist agent for fix implementation

**Receives From:**
- Bug reports, error logs, correlation IDs

**Documentation References:**
- `.agent/SOP/debugging-guide.md` - Debugging patterns
- `.agent/SOP/troubleshooting-tests.md` - Test debugging
- All system docs for context

---

## Typical Multi-Agent Workflows

### Workflow 1: Adding a New Resource (e.g., "Suppliers")

**Sequential handoff pattern:**

1. **database-expert** → Design schema
   - Creates `Supplier` table with multi-tenant pattern
   - Writes migration
   - Updates seed data
   - Output: `.agent/Agents/database-expert/work/suppliers-schema-{date}.md`

2. **rbac-security-expert** → Add permissions
   - Adds `suppliers:read`, `suppliers:write`, `suppliers:delete`
   - Assigns to roles
   - Updates RBAC catalog
   - Output: `.agent/Agents/rbac-security-expert/work/suppliers-rbac-{date}.md`

3. **backend-api-expert** → Create API
   - Implements service layer
   - Creates router with CRUD endpoints
   - Defines OpenAPI schemas
   - Applies permission middleware
   - Output: `.agent/Agents/backend-api-expert/work/suppliers-api-{date}.md`

4. **integration-orchestrator** → Sync types
   - Restarts API server
   - Runs `npm run openapi:gen`
   - Verifies types are correct
   - Output: Type sync confirmation

5. **frontend-expert** → Build UI
   - Creates list page with table
   - Creates form for create/edit
   - Creates API client
   - Adds routing with permission guards
   - Output: `.agent/Agents/frontend-expert/work/suppliers-ui-{date}.md`

6. **test-engineer** → Test everything
   - Backend tests (all RBAC roles)
   - E2E tests (create, edit, delete flows)
   - Multi-tenant isolation tests
   - Output: `.agent/Agents/test-engineer/work/suppliers-tests-{date}.md`

7. **integration-orchestrator** → Final verification
   - Run all tests
   - Build both workspaces
   - Create deployment checklist
   - Update system docs
   - Output: `.agent/Agents/integration-orchestrator/work/suppliers-deployment-{date}.md`

---

### Workflow 2: Debugging a Production Issue

**Parallel + sequential pattern:**

1. **debugging-detective** → Initial investigation
   - Analyzes error reports
   - Traces correlation IDs
   - Identifies likely culprit (e.g., FIFO calculation bug)
   - Output: Root cause hypothesis

2. **stock-inventory-expert** (if stock-related) → Fix implementation
   - Reviews FIFO logic
   - Implements fix
   - Verifies calculation correctness

3. **test-engineer** → Prevent regression
   - Writes test that reproduces bug
   - Verifies fix resolves test
   - Ensures test prevents future regression

4. **integration-orchestrator** → Deploy fix
   - Verifies fix doesn't break builds
   - Creates hotfix deployment checklist
   - Coordinates production deployment

---

### Workflow 3: Enhancing Existing Feature

**Collaborative pattern:**

Example: Add barcode scanning to stock transfers

1. **frontend-expert** → UI changes
   - Adds barcode input component
   - Integrates with product lookup
   - Updates transfer form

2. **backend-api-expert** → API changes (if needed)
   - May add product lookup by barcode endpoint
   - May enhance existing endpoints

3. **stock-inventory-expert** → Validates business logic
   - Ensures barcode scanning maintains FIFO correctness
   - Verifies stock transfer integrity

4. **test-engineer** → Test new functionality
   - E2E test for barcode scanning flow
   - Backend tests if API changed
   - Multi-product transfer tests

5. **integration-orchestrator** → Verification
   - Full build and test run
   - Update documentation

---

## How to Spawn Agents with Context

### Step 1: Identify the Right Agent

Use the [Capabilities Matrix](#agent-capabilities-matrix) and agent descriptions above to select the appropriate agent.

### Step 2: Gather Context Documents

Provide the agent with relevant context:
- Feature PRD: `.agent/Features/{status}/{feature}/prd.md`
- Previous agent outputs: `.agent/Features/{status}/{feature}/{agent}.md`
- System docs: `.agent/System/{relevant}.md`
- SOPs: `.agent/SOP/{relevant}.md`

### Step 3: Craft the Spawn Prompt

**Template:**
```
Spawn {agent-name} agent to {task description}.

Context:
- Read: {list of relevant docs}
- Feature: {feature name and overview}
- Previous work: {summary of what other agents did}

Output to:
1. .agent/Agents/{agent-name}/work/{feature}-{aspect}-{YYYY-MM-DD}.md
2. .agent/Features/{status}/{feature-name}/{agent-name}.md

Update:
- .agent/Agents/{agent-name}/README.md (add to Recent Work)
- .agent/Features/{status}/{feature-name}/README.md (link to agent output)

Requirements:
- {Specific requirement 1}
- {Specific requirement 2}
```

**Example:**
```
Spawn database-expert agent to design Supplier schema.

Context:
- Read: .agent/System/database-schema.md (multi-tenant patterns)
- Read: .agent/Features/InProgress/suppliers/prd.md (requirements)
- Feature: Supplier management with contact info and payment terms

Output to:
1. .agent/Agents/database-expert/work/suppliers-schema-2025-01-15.md
2. .agent/Features/InProgress/suppliers/database-expert.md

Update:
- .agent/Agents/database-expert/README.md (add to Recent Work)
- .agent/Features/InProgress/suppliers/README.md (link to database work)

Requirements:
- Follow multi-tenant pattern (include tenantId)
- Add fields: name, email, phone, paymentTermsDays, notes
- Include audit timestamps
- Create migration
- Update seed data with 5 test suppliers
```

### Step 4: Agent Execution

The agent will:
1. Read provided context documents
2. Complete the assigned task
3. Write outputs to specified locations
4. Update portfolio README
5. Report completion

### Step 5: Review and Handoff

After agent completes:
1. Review agent outputs
2. Verify correctness
3. Spawn next agent in workflow with context
4. Update feature README

---

## Agent Output Format

All agents follow the same output template (defined in `.agent/Meta/agent-output-template.md`):

**Sections:**
1. **Context** - What was requested, by whom, related docs
2. **Task Description** - Clear statement of what was done
3. **Changes Made** - Files created/modified with descriptions
4. **Key Decisions** - Rationale for technical choices
5. **Testing Notes** - How to test the changes
6. **Next Steps** - What agents should work next
7. **Blockers/Issues** - Any problems encountered
8. **References** - Links to relevant docs and code

This consistent format makes it easy for agents to consume each other's work.

---

## Agent Work Log Retention

**Retention Policy:**
- Keep last 10 work logs in each agent's `/work/` folder
- Archive older work logs to feature folders
- Completed feature work is preserved in `Features/Completed/`

**Cleanup:**
Periodically (quarterly), review agent work logs:
```bash
# For each agent
cd .agent/Agents/{agent-name}/work/
ls -t | tail -n +11 | xargs rm  # Keep 10 most recent
```

---

## Agent Statistics

**Total Agents:** 8

**Agents by Domain:**
- Infrastructure: 3 (database-expert, integration-orchestrator, debugging-detective)
- Backend: 2 (backend-api-expert, rbac-security-expert)
- Frontend: 1 (frontend-expert)
- Testing: 1 (test-engineer)
- Business Domain: 1 (stock-inventory-expert)

**Most Common Workflows:**
1. New resource CRUD (7 agents involved)
2. Bug investigation (2-4 agents)
3. Feature enhancement (3-5 agents)

---

## Related Documentation

- **System Docs:** `.agent/System/_index.md` - Architecture and design
- **Features:** `.agent/Features/_index.md` - Feature catalog
- **SOPs:** `.agent/SOP/_index.md` - Standard operating procedures
- **Meta:** `.agent/Meta/` - Agent handoff protocol and templates
- **Main Index:** `.agent/README.md` - Master documentation index

---

**Last Updated:** 2025-01-15
**Total Agents:** 8
**Agent Definitions:** `.claude/agents/`
**Work Logs:** `.agent/Agents/{agent-name}/work/`
