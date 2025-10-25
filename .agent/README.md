# .agent Documentation Index

**Master entry point for all project documentation**

Welcome to the comprehensive documentation system for the Multi-Tenant Inventory Management System. This directory uses an agent-based workflow with structured documentation organized by purpose: system architecture, feature history, agent work logs, standard procedures, and meta-documentation.

---

## Table of Contents

1. [Introduction](#introduction)
2. [Quick Start](#quick-start)
3. [Directory Structure](#directory-structure)
4. [Working with Sub-Agents](#working-with-sub-agents)
5. [System Documentation](#system-documentation)
6. [Feature Documentation](#feature-documentation)
7. [Agent Work Logs](#agent-work-logs)
8. [Standard Operating Procedures](#standard-operating-procedures)
9. [Meta Documentation](#meta-documentation)
10. [Finding Information](#finding-information)
11. [Common Workflows](#common-workflows)
12. [Migration Notes](#migration-notes)
13. [Keeping Documentation Updated](#keeping-documentation-updated)
14. [Statistics](#statistics)

---

## Introduction

### What is the .agent/ Directory?

The `.agent/` directory is the **central knowledge base** for this project. It serves three key purposes:

1. **System Documentation** - Living documentation of current architecture, database schema, RBAC, and domain logic
2. **Feature History** - Complete record of what features were built, by whom (which agents), and why
3. **Agent Coordination** - Work logs and portfolios for specialized sub-agents working on the system

### Why This Structure?

**Traditional Problem:**
- Flat documentation structures don't scale with agent-based workflows
- Hard to find "what did database-expert do on suppliers feature?"
- No persistent context for sub-agents to reference previous work
- Features scattered across various docs

**Agent-Based Solution:**
- **Clear separation of concerns** - System state vs. feature history vs. procedures
- **Agent portfolios** - Each agent maintains a work history
- **Feature folders** - All work for a feature collected in one place
- **Dual output strategy** - Work logged both chronologically (by agent) and contextually (by feature)
- **Persistent context** - Sub-agents can read previous agent outputs

### Key Principles

1. **System docs reflect CURRENT state** - Always up-to-date with the codebase
2. **Features are HISTORICAL** - Completed work organized by completion date
3. **SOPs are PRESCRIPTIVE** - Step-by-step guides for common tasks
4. **Agents are SPECIALIZED** - Domain experts with focused responsibilities
5. **Documentation is CODE** - Treat docs with same care as source code

---

## Quick Start

### I'm New to the Project

**Day 1 orientation:**
1. Read [System/architecture.md](./System/architecture.md) - Understand the tech stack and patterns
2. Read [System/database-schema.md](./System/database-schema.md) - Learn the data model
3. Read [SOP/adding-new-feature.md](./SOP/adding-new-feature.md) - Understand the workflow
4. Skim [System/_index.md](./System/_index.md) - Know what system docs exist

**Day 2 deep dive:**
1. Read [System/rbac-system.md](./System/rbac-system.md) - Understand permissions
2. Read [System/stock-management.md](./System/stock-management.md) - Understand FIFO inventory
3. Review [Features/_index.md](./Features/_index.md) - See what's been built
4. Bookmark [SOP/debugging-guide.md](./SOP/debugging-guide.md) - For troubleshooting

### I'm Implementing a Feature

**Start here:**
1. Create feature folder: `.agent/Features/InProgress/{feature-name}/`
2. **Write PRD using the [PRD Template](./Meta/prd-template.md)** → `.agent/Features/InProgress/{feature-name}/prd.md`
   - Use simple checklist format (`- [ ]`)
   - Break into phases with clear goals
   - Include file references, NOT code snippets
   - Follow backend-first workflow
   - See [PRD Guidelines](./Meta/documentation-guidelines.md#prd-product-requirements-document-guidelines) for details
3. Follow [SOP/adding-new-feature.md](./SOP/adding-new-feature.md) step-by-step
4. Spawn agents using [Agents/_index.md](./Agents/_index.md) as guide
5. Reference [Meta/agent-handoff-protocol.md](./Meta/agent-handoff-protocol.md) for agent coordination

**Typical workflow:**
```
database-expert → rbac-security-expert → backend-api-expert →
frontend-expert → test-engineer → integration-orchestrator
```

**PRD Template Quick Reference:**
- **Template Location:** [Meta/prd-template.md](./Meta/prd-template.md)
- **Guidelines:** [PRD section in documentation-guidelines.md](./Meta/documentation-guidelines.md#prd-product-requirements-document-guidelines)
- **Key Principle:** Simple checklists, file references, backend-first, no code snippets

### I'm Debugging an Issue

**Start here:**
1. Check [SOP/debugging-guide.md](./SOP/debugging-guide.md) for common issues
2. If test failure: [SOP/troubleshooting-tests.md](./SOP/troubleshooting-tests.md)
3. If stock issue: [System/stock-management.md](./System/stock-management.md)
4. If permission issue: [System/rbac-system.md](./System/rbac-system.md)
5. Spawn debugging-detective agent if investigation needed

### I'm Writing Tests

**Start here:**
1. Read [SOP/testing-overview.md](./SOP/testing-overview.md) for orientation
2. Backend tests: [SOP/backend-testing.md](./SOP/backend-testing.md)
3. Frontend tests: [SOP/frontend-testing.md](./SOP/frontend-testing.md)
4. Flaky tests: [SOP/test-flakiness.md](./SOP/test-flakiness.md)
5. Issues: [SOP/troubleshooting-tests.md](./SOP/troubleshooting-tests.md)

### I'm Using the Agent System

**Start here:**
1. Read [Agents/_index.md](./Agents/_index.md) - Agent registry and capabilities
2. Read [Meta/agent-handoff-protocol.md](./Meta/agent-handoff-protocol.md) - How to spawn agents
3. Use [Meta/agent-output-template.md](./Meta/agent-output-template.md) - Standard output format
4. Review agent portfolios in [Agents/{agent-name}/README.md](./Agents/) - See examples

---

## Directory Structure

```
.agent/
├── README.md                              # This file - master index
├── RESTRUCTURE_PLAN.md                    # Restructure documentation
│
├── /System/                               # CURRENT STATE documentation
│   ├── _index.md                          # System docs index
│   ├── architecture.md                    # Tech stack, architecture patterns, API design
│   ├── database-schema.md                 # Complete database schema & relationships
│   ├── rbac-system.md                     # Role-based access control implementation
│   ├── stock-management.md                # FIFO inventory management system
│   └── /Domain/                           # Domain-specific docs (planned)
│       ├── products.md                    # Product domain knowledge (planned)
│       ├── stock.md                       # Stock/inventory domain (planned)
│       ├── transfers.md                   # Transfer domain (planned)
│       └── users.md                       # User management domain (planned)
│
├── /Features/                             # HISTORICAL feature work logs
│   ├── _index.md                          # Feature catalog by status
│   ├── /Completed/                        # Shipped features (flat, alphabetical)
│   │   ├── /session-expiration/
│   │   │   ├── README.md                  # Feature overview
│   │   │   └── prd.md                     # Requirements & implementation plan
│   │   ├── /stock-transfers-v1/
│   │   │   ├── README.md
│   │   │   └── prd.md
│   │   ├── /stock-transfers-v2/
│   │   │   ├── README.md
│   │   │   └── prd.md
│   │   └── /testing-implementation/
│   │       ├── README.md
│   │       ├── prd.md
│   │       └── issues.md
│   ├── /InProgress/                       # Currently being developed
│   │   └── (feature folders as they are created)
│   └── /Planned/                          # Roadmap / backlog
│       └── (planned feature folders)
│
│   **Note:** Features organized alphabetically by name (not by date) for easier discovery.
│   Completion dates tracked in each feature's README.md metadata.
│
├── /Agents/                               # Agent work logs & portfolios
│   ├── _index.md                          # Agent registry & capabilities matrix
│   ├── /database-expert/
│   │   ├── README.md                      # Agent portfolio & recent work
│   │   └── /work/                         # Recent outputs (last 10)
│   │       └── (agent work logs)
│   ├── /backend-api-expert/
│   │   ├── README.md
│   │   └── /work/
│   ├── /frontend-expert/
│   │   ├── README.md
│   │   └── /work/
│   ├── /rbac-security-expert/
│   │   ├── README.md
│   │   └── /work/
│   ├── /test-engineer/
│   │   ├── README.md
│   │   └── /work/
│   ├── /stock-inventory-expert/
│   │   ├── README.md
│   │   └── /work/
│   ├── /integration-orchestrator/
│   │   ├── README.md
│   │   └── /work/
│   └── /debugging-detective/
│       ├── README.md
│       └── /work/
│
├── /SOP/                                  # Standard Operating Procedures
│   ├── _index.md                          # SOP catalog & quick reference
│   ├── adding-new-feature.md              # Complete feature development workflow
│   ├── backend-testing.md                 # Jest testing patterns & helpers
│   ├── debugging-guide.md                 # Troubleshooting common issues
│   ├── frontend-testing.md                # Playwright E2E testing patterns
│   ├── frontend-test-isolation.md         # Frontend test isolation patterns
│   ├── stock-transfers-feature-guide.md   # Stock transfer feature guide
│   ├── testing-guide.md                   # Comprehensive testing reference (2294 lines)
│   ├── testing-overview.md                # Testing strategy quick start
│   ├── test-flakiness.md                  # Understanding and fixing flaky tests
│   ├── test-isolation-pattern.md          # Test isolation best practices
│   └── troubleshooting-tests.md           # 30+ common test issues & solutions
│
└── /Meta/                                 # Documentation about documentation
    ├── agent-handoff-protocol.md          # How to spawn agents & coordinate work
    ├── agent-output-template.md           # Universal template for agent outputs
    ├── documentation-guidelines.md        # Doc writing standards & conventions
    └── archival-policy.md                 # When/how to archive old work
```

---

## Working with Sub-Agents

### What are Sub-Agents?

**Sub-agents** are specialized AI assistants spawned by the main thread to handle domain-specific tasks. Each agent is an expert in their field with focused responsibilities.

### The 8 Specialized Agents

| Agent | Specialty | Definition |
|-------|-----------|------------|
| **database-expert** | Prisma schema, migrations, multi-tenant patterns | `.claude/agents/database-expert.md` |
| **backend-api-expert** | Express routes, service layer, OpenAPI | `.claude/agents/backend-api-expert.md` |
| **frontend-expert** | React UI, Mantine components, routing | `.claude/agents/frontend-expert.md` |
| **rbac-security-expert** | Permissions, roles, authorization | `.claude/agents/rbac-security-expert.md` |
| **test-engineer** | Jest, Playwright, test coverage | `.claude/agents/test-engineer.md` |
| **stock-inventory-expert** | FIFO logic, inventory operations | `.claude/agents/stock-inventory-expert.md` |
| **integration-orchestrator** | Type sync, deployment, coordination | `.claude/agents/integration-orchestrator.md` |
| **debugging-detective** | Bug investigation, root cause analysis | `.claude/agents/debugging-detective.md` |

### How to Use Agents

**Complete Guide:** [Agents/_index.md](./Agents/_index.md)

**Handoff Protocol:** [Meta/agent-handoff-protocol.md](./Meta/agent-handoff-protocol.md)

**Quick Pattern:**
1. Identify which agent(s) needed (see capabilities matrix in Agents/_index.md)
2. Gather context documents for agent to read
3. Spawn agent with clear task, context, and output locations
4. Agent writes to BOTH locations:
   - Chronological: `.agent/Agents/{agent-name}/work/{task}-{date}.md`
   - Contextual: `.agent/Features/{status}/{feature-name}/{agent-name}.md`
5. Agent updates their portfolio README
6. Review agent output before spawning next agent

**Example Spawn Prompt:**
```markdown
Spawn database-expert to create Supplier model.

Context to Read:
- .agent/System/database-schema.md (multi-tenant patterns)
- .agent/Features/InProgress/suppliers/prd.md (requirements)

Task:
1. Add Supplier model to schema.prisma
2. Create migration
3. Update seed data
4. Document the model

Output to:
- .agent/Agents/database-expert/work/suppliers-schema-2025-01-15.md
- .agent/Features/InProgress/suppliers/database-expert.md

Update:
- .agent/Agents/database-expert/README.md (add to Recent Work)

Format:
Use template from .agent/Meta/agent-output-template.md
```

### Typical Multi-Agent Workflows

**Full Stack Feature:**
```
database-expert → rbac-security-expert → backend-api-expert →
frontend-expert → test-engineer → integration-orchestrator
```

**Bug Fix:**
```
debugging-detective → {appropriate agent} → test-engineer
```

**Database Migration:**
```
database-expert → test-engineer
```

**UI Enhancement:**
```
frontend-expert → test-engineer
```

See [Meta/agent-handoff-protocol.md](./Meta/agent-handoff-protocol.md) for detailed workflows.

---

## System Documentation

**Purpose:** Living documentation of the **CURRENT STATE** of the system architecture, database schema, and domain logic.

**Index:** [System/_index.md](./System/_index.md)

### Core System Docs

#### [architecture.md](./System/architecture.md)
**What:** High-level system design, tech stack, API patterns, authentication, multi-tenancy architecture

**When to use:**
- Understanding overall system design
- Onboarding new engineers
- Making architectural decisions
- Planning new features
- Understanding authentication & RBAC flow

**Key sections:**
- Technology Stack (Node.js, Express, React, Vite, Prisma, PostgreSQL)
- Architecture Patterns (monorepo, layered architecture, multi-tenancy)
- Authentication & Authorization (JWT cookies, RBAC)
- API Design Patterns (envelope, correlation IDs, idempotency, rate limiting)
- OpenAPI & Type Generation workflow
- Testing Strategy (299 tests)

#### [database-schema.md](./System/database-schema.md)
**What:** Complete database reference with all 16+ tables, relationships, indexes, and query patterns

**When to use:**
- Adding new database tables or columns
- Understanding data relationships
- Optimizing database queries
- Writing Prisma migrations
- Troubleshooting data integrity issues

**Tables documented:**
- Global: User, Permission
- Tenant-Scoped: Tenant, Role, Product, Branch, TenantBranding
- Join Tables: UserTenantMembership, RolePermission, UserBranchMembership
- Stock: ProductStock, StockLot, StockLedger, StockTransfer, TransferTemplate
- Infrastructure: IdempotencyRecord, ApiRequestLog, AuditEvent

#### [rbac-system.md](./System/rbac-system.md)
**What:** Role-based access control architecture with 11 permissions and 4 system roles

**When to use:**
- Adding new permissions for a feature
- Creating or modifying custom roles
- Implementing permission checks (backend & frontend)
- Troubleshooting 403 Forbidden errors
- Understanding access control logic

**Key sections:**
- Permission Catalog (products, users, roles, theme, branches, stock)
- System Roles (OWNER, ADMIN, EDITOR, VIEWER)
- Backend Enforcement (`requirePermission()` middleware)
- Frontend Enforcement (`<RequirePermission>` component)
- Testing RBAC

#### [stock-management.md](./System/stock-management.md)
**What:** FIFO (First-In, First-Out) inventory management system with lot tracking and stock transfers

**When to use:**
- Understanding inventory logic and FIFO algorithm
- Implementing stock-related features
- Troubleshooting stock discrepancies
- Optimizing stock queries
- Generating inventory reports

**Key sections:**
- FIFO Algorithm (receipt, consumption, adjustment)
- Stock Transfer Flow (multi-branch coordination)
- Transaction Isolation (preventing race conditions)
- Cost Accounting (COGS calculation)
- Edge Cases & Error Handling

### Domain Docs (Planned)

**Location:** [System/Domain/](./System/Domain/)

**Status:** Folder structure exists, docs to be created as needed

**Future docs:**
- `products.md` - Product model, SKU uniqueness, entity versioning
- `stock.md` - FIFO details, stock operations, branch membership
- `transfers.md` - Transfer flow, templates, reversal logic
- `users.md` - User-Tenant-Branch relationships, session handling

---

## Feature Documentation

**Purpose:** Historical record of features built, organized by completion status and date.

**Index:** [Features/_index.md](./Features/_index.md)

### Feature Lifecycle

```
Planned/ → InProgress/ → Completed/YYYY-MM/
```

### Completed Features

**Location:** [Features/Completed/](./Features/Completed/) (organized alphabetically by feature name)

**Why flat structure?** Easier to find features by name ("Did we do Suppliers?" → look for "suppliers" folder). Completion dates tracked in each README.md.

#### 1. Stock Transfers v1
- **Status:** ✅ Completed January 2025
- **What:** Base stock transfer functionality between branches
- **Docs:** [README](./Features/Completed/stock-transfers-v1/README.md) | [PRD](./Features/Completed/stock-transfers-v1/prd.md)
- **Key Features:** FIFO consumption, automatic receipts, audit trail

#### 2. Stock Transfers v2
- **Status:** ✅ Completed January 2025
- **What:** Enhanced transfers with templates, reversal, barcode scanning
- **Docs:** [README](./Features/Completed/stock-transfers-v2/README.md) | [PRD](./Features/Completed/stock-transfers-v2/prd.md)
- **Key Features:** Transfer templates, reversal logic, barcode integration

#### 3. Session Expiration Handler
- **Status:** ✅ Completed January 2025
- **What:** Graceful session expiration with auto-redirect
- **Docs:** [README](./Features/Completed/session-expiration/README.md) | [PRD](./Features/Completed/session-expiration/prd.md)
- **Key Features:** 401 detection, return URL preservation, UX improvements

#### 4. Testing Implementation
- **Status:** ✅ Completed January 2025
- **What:** Comprehensive testing infrastructure (299 tests)
- **Docs:** [README](./Features/Completed/testing-implementation/README.md) | [PRD](./Features/Completed/testing-implementation/prd.md) | [Issues](./Features/Completed/testing-implementation/issues.md)
- **Key Features:** 227 backend tests (Jest), 72 frontend tests (Playwright), test helpers

#### 5. E2E Test Refactoring & Organization
- **Status:** ✅ Completed 2025-10-18
- **What:** Refactored 18 E2E test files (8,299 lines) into domain-based structure with shared utilities
- **Docs:** [README](./Features/Completed/e2e-test-refactoring/README.md) | [PRD](./Features/Completed/e2e-test-refactoring/prd.md)
- **Key Features:** Domain folders (auth, products, stock, transfers, chat, features), 7 reusable factories, ~600+ lines removed, comprehensive documentation (README.md, GUIDELINES.md)

#### 6. Approval Rule Archival
- **Status:** ✅ Completed 2025-10-18
- **What:** Soft delete enhancement for transfer approval rules with archive/restore functionality
- **Docs:** [PRD](./Features/Completed/approval-rule-archival/prd.md)
- **Key Features:** Archive filter dropdown (active-only, archived-only, all), archived/inactive badges, isActive state preservation on restore, confirmation modals, 19 E2E tests

#### 7. Stock Transfer Reversal Linking
- **Status:** ✅ Completed 2025-10-25
- **What:** Bidirectional relationship tracking between original and reversal transfers with automatic reason propagation
- **Docs:** [README](./Features/Completed/stock-transfer-reversal-linking/README.md) | [PRD](./Features/Completed/stock-transfer-reversal-linking/prd.md)
- **Key Features:** Bidirectional navigation, reversal reason propagation to orderNotes, theme-aware UI, reversal-of-reversal support, 8 backend tests + enhanced E2E tests

### In Progress Features (0)

**Location:** [Features/InProgress/](./Features/InProgress/)

**Status:** No features currently in progress

### Planned Features (0)

**Location:** [Features/Planned/](./Features/Planned/)

**Status:** No features currently planned

**Potential future features:**
- Suppliers management
- Purchase orders
- Sales orders
- Inventory reporting dashboard
- Product categories/tags
- Low stock alerts
- Expiry date tracking
- Serial number tracking

### Feature Folder Structure

```
{feature-name}/
├── README.md              # Feature overview, status, key changes
├── prd.md                 # Product requirements document
└── {agent-name}.md        # Agent-specific outputs (database-expert.md, etc.)
```

---

## Agent Work Logs

**Purpose:** Track work completed by each specialized agent, organized by agent with chronological logs.

**Index:** [Agents/_index.md](./Agents/_index.md)

### Agent Portfolios

Each agent maintains a portfolio at `.agent/Agents/{agent-name}/README.md` containing:
- Agent purpose and capabilities
- Recent Work (last 10 outputs)
- Common patterns
- Related agents

### Agent Capabilities Matrix

See [Agents/_index.md](./Agents/_index.md) for complete matrix showing:
- Primary responsibilities for each agent
- Supporting roles across different tasks
- When to use each agent
- Multi-agent workflow patterns

### Dual Output Strategy

Every agent writes to TWO locations:

1. **Agent Work Log (Chronological)**
   - Location: `.agent/Agents/{agent-name}/work/{feature}-{topic}-{date}.md`
   - Purpose: "What has this agent done recently?"
   - Retention: Keep last 10 outputs

2. **Feature Folder (Contextual)**
   - Location: `.agent/Features/{status}/{feature-name}/{agent-name}.md`
   - Purpose: "What work was done for this feature?"
   - Retention: Permanent (moves with feature to Completed/)

**Why dual strategy?**
- See agent's recent work for similar tasks
- Gather all context for a feature in one place
- Easy archival (move entire feature folder)
- Portfolio building for agent improvements

---

## Standard Operating Procedures

**Purpose:** Step-by-step guides for common tasks, testing procedures, and troubleshooting workflows.

**Index:** [SOP/_index.md](./SOP/_index.md)

### Development SOPs

#### [adding-new-feature.md](./SOP/adding-new-feature.md)
**Complete workflow for adding a new feature (e.g., "Suppliers")**

Steps covered:
1. Database changes (schema, migrations, seed)
2. Add permissions (RBAC catalog, roles)
3. Backend implementation (service, OpenAPI, router)
4. Frontend implementation (types, API client, UI, routing)
5. Testing (Jest backend, Playwright E2E)

### Testing SOPs

#### [testing-overview.md](./SOP/testing-overview.md)
**Start here for testing introduction** - Philosophy, structure, quick start, navigation to other testing docs

#### [backend-testing.md](./SOP/backend-testing.md)
**Jest backend testing patterns** - Test helpers, real database, multi-tenant isolation, RBAC testing, service tests

#### [frontend-testing.md](./SOP/frontend-testing.md)
**Playwright E2E testing patterns** - Selectors, authentication helpers, form interactions, permission-based UI testing

#### [testing-guide.md](./SOP/testing-guide.md)
**Comprehensive testing reference (2294 lines)** - Everything from overview, backend, and frontend guides plus advanced patterns

### Test Quality SOPs

#### [test-flakiness.md](./SOP/test-flakiness.md)
**Understanding and fixing flaky tests** - Race conditions, timing issues, state leakage, prevention strategies

#### [test-isolation-pattern.md](./SOP/test-isolation-pattern.md)
**Ensuring tests don't interfere** - Database cleanup, cookie clearing, setup/teardown patterns

#### [frontend-test-isolation.md](./SOP/frontend-test-isolation.md)
**Frontend-specific isolation** - Cookie clearing, localStorage cleanup, authentication isolation, UI state management

#### [troubleshooting-tests.md](./SOP/troubleshooting-tests.md)
**30+ common test issues with solutions** - Check here first when tests fail! Organized by category with error messages and fixes

### Debugging SOPs

#### [debugging-guide.md](./SOP/debugging-guide.md)
**Troubleshooting common issues** - Database, authentication, API, frontend, performance, deployment issues with solutions

### Feature-Specific Guides

#### [stock-transfers-feature-guide.md](./SOP/stock-transfers-feature-guide.md)
**Complete guide to stock transfers** - Transfer flow, FIFO consumption, templates, reversal logic, API endpoints, testing

---

## Meta Documentation

**Purpose:** Documentation about documentation - standards, protocols, templates, and archival policies.

**Location:** [Meta/](./Meta/)

### Core Meta Docs

#### [agent-handoff-protocol.md](./Meta/agent-handoff-protocol.md)
**How to spawn agents and coordinate multi-agent workflows**

Topics:
- Agent registry and capabilities
- Spawning agents with proper context
- Dual output strategy
- Referencing previous work
- Updating portfolios
- Multi-agent workflow patterns
- Output format requirements
- Best practices and common patterns

**Essential reading for using the agent system.**

#### [agent-output-template.md](./Meta/agent-output-template.md)
**Universal template for all agent outputs**

Required sections:
1. Context (what was requested, related docs)
2. Task Description
3. Changes Made (files created/modified)
4. Key Decisions (rationale, alternatives)
5. Testing Notes
6. Next Steps
7. Blockers/Issues
8. References

**All agents must follow this template.**

#### [documentation-guidelines.md](./Meta/documentation-guidelines.md)
**Writing standards for .agent/ documentation**

Topics:
- Markdown formatting conventions
- When to update vs. create new docs
- How to keep docs current
- File naming conventions (kebab-case)
- Cross-referencing standards
- Examples and code snippets

#### [archival-policy.md](./Meta/archival-policy.md)
**When and how to archive old work**

Topics:
- When to move features to Completed/
- Month/year organization strategy (YYYY-MM)
- Agent work log retention (keep last 10)
- Cleanup procedures
- What to preserve vs. archive

---

## Finding Information

### By Topic

| Topic | Primary Document | Supporting Docs |
|-------|------------------|-----------------|
| **Tech Stack** | [System/architecture.md](./System/architecture.md) | - |
| **Multi-Tenancy** | [System/architecture.md](./System/architecture.md) | [System/database-schema.md](./System/database-schema.md) |
| **Authentication** | [System/architecture.md](./System/architecture.md) | [System/rbac-system.md](./System/rbac-system.md) |
| **RBAC / Permissions** | [System/rbac-system.md](./System/rbac-system.md) | [SOP/adding-new-feature.md](./SOP/adding-new-feature.md) |
| **Database Tables** | [System/database-schema.md](./System/database-schema.md) | [SOP/adding-new-feature.md](./SOP/adding-new-feature.md) |
| **Migrations** | [System/database-schema.md](./System/database-schema.md) | [SOP/adding-new-feature.md](./SOP/adding-new-feature.md) |
| **Stock / Inventory** | [System/stock-management.md](./System/stock-management.md) | [SOP/stock-transfers-feature-guide.md](./SOP/stock-transfers-feature-guide.md) |
| **FIFO Logic** | [System/stock-management.md](./System/stock-management.md) | [System/database-schema.md](./System/database-schema.md) |
| **API Design** | [System/architecture.md](./System/architecture.md) | [SOP/adding-new-feature.md](./SOP/adding-new-feature.md) |
| **OpenAPI / Types** | [System/architecture.md](./System/architecture.md) | [SOP/adding-new-feature.md](./SOP/adding-new-feature.md) |
| **Testing Strategy** | [SOP/testing-overview.md](./SOP/testing-overview.md) | [SOP/backend-testing.md](./SOP/backend-testing.md), [SOP/frontend-testing.md](./SOP/frontend-testing.md) |
| **Test Flakiness** | [SOP/test-flakiness.md](./SOP/test-flakiness.md) | [SOP/troubleshooting-tests.md](./SOP/troubleshooting-tests.md) |
| **Agent Workflows** | [Agents/_index.md](./Agents/_index.md) | [Meta/agent-handoff-protocol.md](./Meta/agent-handoff-protocol.md) |
| **Feature History** | [Features/_index.md](./Features/_index.md) | Individual feature READMEs |

### By Task

| Task | Primary Guide | Supporting Docs |
|------|---------------|-----------------|
| **Add new database table** | [SOP/adding-new-feature.md](./SOP/adding-new-feature.md) Step 1 | [System/database-schema.md](./System/database-schema.md) |
| **Add new permission** | [SOP/adding-new-feature.md](./SOP/adding-new-feature.md) Step 2 | [System/rbac-system.md](./System/rbac-system.md) |
| **Create API endpoint** | [SOP/adding-new-feature.md](./SOP/adding-new-feature.md) Step 3 | [System/architecture.md](./System/architecture.md) |
| **Create frontend page** | [SOP/adding-new-feature.md](./SOP/adding-new-feature.md) Step 4 | [System/architecture.md](./System/architecture.md) |
| **Write backend tests** | [SOP/backend-testing.md](./SOP/backend-testing.md) | [SOP/testing-overview.md](./SOP/testing-overview.md) |
| **Write E2E tests** | [SOP/frontend-testing.md](./SOP/frontend-testing.md) | [SOP/testing-overview.md](./SOP/testing-overview.md) |
| **Fix 403 error** | [SOP/debugging-guide.md](./SOP/debugging-guide.md) | [System/rbac-system.md](./System/rbac-system.md) |
| **Fix CORS error** | [SOP/debugging-guide.md](./SOP/debugging-guide.md) | [System/architecture.md](./System/architecture.md) |
| **Fix flaky test** | [SOP/test-flakiness.md](./SOP/test-flakiness.md) | [SOP/troubleshooting-tests.md](./SOP/troubleshooting-tests.md) |
| **Spawn an agent** | [Meta/agent-handoff-protocol.md](./Meta/agent-handoff-protocol.md) | [Agents/_index.md](./Agents/_index.md) |
| **Understand FIFO** | [System/stock-management.md](./System/stock-management.md) | [SOP/stock-transfers-feature-guide.md](./SOP/stock-transfers-feature-guide.md) |
| **Debug production issue** | [SOP/debugging-guide.md](./SOP/debugging-guide.md) | Use debugging-detective agent |

### By Role

#### As a New Developer
1. [System/architecture.md](./System/architecture.md) - System overview
2. [System/database-schema.md](./System/database-schema.md) - Data model
3. [SOP/adding-new-feature.md](./SOP/adding-new-feature.md) - Development workflow
4. [SOP/testing-overview.md](./SOP/testing-overview.md) - Testing approach

#### As a Backend Developer
1. [System/architecture.md](./System/architecture.md) - API patterns
2. [System/database-schema.md](./System/database-schema.md) - Models and relationships
3. [System/rbac-system.md](./System/rbac-system.md) - Permission enforcement
4. [SOP/backend-testing.md](./SOP/backend-testing.md) - Test patterns

#### As a Frontend Developer
1. [System/architecture.md](./System/architecture.md) - Frontend patterns
2. [System/rbac-system.md](./System/rbac-system.md) - Permission-based UI
3. [SOP/adding-new-feature.md](./SOP/adding-new-feature.md) Step 4 - Frontend implementation
4. [SOP/frontend-testing.md](./SOP/frontend-testing.md) - E2E testing

#### As a QA Engineer
1. [SOP/testing-overview.md](./SOP/testing-overview.md) - Testing strategy
2. [SOP/backend-testing.md](./SOP/backend-testing.md) - Backend test patterns
3. [SOP/frontend-testing.md](./SOP/frontend-testing.md) - E2E test patterns
4. [SOP/troubleshooting-tests.md](./SOP/troubleshooting-tests.md) - Fix test issues

#### Using the Agent System
1. [Agents/_index.md](./Agents/_index.md) - Agent capabilities
2. [Meta/agent-handoff-protocol.md](./Meta/agent-handoff-protocol.md) - Spawning workflow
3. Agent portfolios in [Agents/{agent-name}/README.md](./Agents/) - Examples

---

## Common Workflows

### Workflow 1: Adding a New Feature

**Goal:** Implement a complete CRUD feature (e.g., "Suppliers")

**Steps:**
1. **Plan:**
   - Create feature folder: `.agent/Features/InProgress/suppliers/`
   - Write PRD: `.agent/Features/InProgress/suppliers/prd.md`
   - Create README: `.agent/Features/InProgress/suppliers/README.md`

2. **Database (spawn database-expert):**
   - Read: [System/database-schema.md](./System/database-schema.md)
   - Task: Create Supplier model with multi-tenant pattern
   - Output: Prisma schema changes, migration, seed data

3. **Permissions (spawn rbac-security-expert):**
   - Read: [System/rbac-system.md](./System/rbac-system.md)
   - Task: Add suppliers:read, suppliers:write, suppliers:delete
   - Output: RBAC catalog updates, role assignments

4. **Backend (spawn backend-api-expert):**
   - Read: Previous agent outputs (database-expert, rbac-security-expert)
   - Task: Create CRUD API with service layer and OpenAPI schemas
   - Output: Service, router, OpenAPI definitions

5. **Frontend (spawn frontend-expert):**
   - Read: Backend-api-expert output
   - Task: Create UI with list page, form, routing
   - Output: React components, API client, routes

6. **Testing (spawn test-engineer):**
   - Read: All previous agent outputs
   - Task: Write comprehensive tests (backend + frontend)
   - Output: Jest tests, Playwright tests, coverage report

7. **Integration (spawn integration-orchestrator):**
   - Read: All agent outputs
   - Task: Verify types, create deployment checklist, update docs
   - Output: Integration verification, checklist

8. **Complete:**
   - Update README.md with completion date
   - Move to: `.agent/Features/Completed/suppliers/` (flat structure by feature name)
   - Update: `.agent/Features/_index.md`

**Reference:** [SOP/adding-new-feature.md](./SOP/adding-new-feature.md)

### Workflow 2: Debugging an Issue

**Goal:** Investigate and fix a production bug

**Steps:**
1. **Investigate (spawn debugging-detective):**
   - Read: Relevant system docs, error logs, correlation IDs
   - Task: Identify root cause
   - Output: Root cause analysis, fix recommendation

2. **Fix (spawn appropriate agent):**
   - Read: debugging-detective output
   - Task: Implement fix based on findings
   - Output: Code changes, explanation

3. **Test (spawn test-engineer):**
   - Read: Fix implementation
   - Task: Write test that reproduces bug, verify fix
   - Output: Regression test

4. **Deploy (spawn integration-orchestrator if needed):**
   - Task: Create hotfix deployment checklist
   - Output: Deployment verification

**Reference:** [SOP/debugging-guide.md](./SOP/debugging-guide.md)

### Workflow 3: Understanding the System

**Goal:** Learn how the system works

**Steps:**
1. **High-level:** Read [System/architecture.md](./System/architecture.md)
   - Tech stack, patterns, authentication, API design

2. **Data layer:** Read [System/database-schema.md](./System/database-schema.md)
   - All tables, relationships, multi-tenant patterns

3. **Domain-specific:** Read relevant system doc
   - [System/rbac-system.md](./System/rbac-system.md) for permissions
   - [System/stock-management.md](./System/stock-management.md) for inventory
   - [SOP/stock-transfers-feature-guide.md](./SOP/stock-transfers-feature-guide.md) for transfers

4. **Historical context:** Review [Features/Completed/](./Features/Completed/)
   - See what features were built and how

5. **Explore code:** With docs as context, read actual implementation

### Workflow 4: Writing Tests

**Goal:** Add test coverage for a feature

**Steps:**
1. **Orientation:** Read [SOP/testing-overview.md](./SOP/testing-overview.md)
   - Understand testing philosophy and structure

2. **Backend tests:** Read [SOP/backend-testing.md](./SOP/backend-testing.md)
   - Test helpers, patterns, RBAC testing, multi-tenant isolation

3. **Frontend tests:** Read [SOP/frontend-testing.md](./SOP/frontend-testing.md)
   - Playwright patterns, selectors, authentication helpers

4. **Write tests:** Follow patterns from guides
   - Use test helpers and factories
   - Test all RBAC roles
   - Test multi-tenant isolation
   - Test edge cases

5. **Fix issues:** Use [SOP/troubleshooting-tests.md](./SOP/troubleshooting-tests.md)
   - 30+ common issues with solutions

6. **Fix flakiness:** Use [SOP/test-flakiness.md](./SOP/test-flakiness.md)
   - Understand and prevent race conditions

### Workflow 5: Using Agents for a Feature

**Goal:** Coordinate multiple agents for feature implementation

**Steps:**
1. **Read agent registry:** [Agents/_index.md](./Agents/_index.md)
   - Understand each agent's capabilities
   - See capabilities matrix
   - Choose agents needed

2. **Read handoff protocol:** [Meta/agent-handoff-protocol.md](./Meta/agent-handoff-protocol.md)
   - Learn spawning patterns
   - Understand dual output strategy
   - See example workflows

3. **Spawn agents sequentially:**
   - Provide clear context documents
   - Specify BOTH output locations
   - Reference previous agent outputs
   - Follow template from [Meta/agent-output-template.md](./Meta/agent-output-template.md)

4. **Review outputs:**
   - Check both output locations populated
   - Verify portfolio updated
   - Confirm next steps clear

5. **Archive when complete:**
   - Follow [Meta/archival-policy.md](./Meta/archival-policy.md)
   - Move feature to Completed/
   - Update indices

---

## Migration Notes

### Where Did Old Files Go?

If you're familiar with the old `.agent/` structure, here's what changed:

#### System Files (Renamed)
- `System/project_architecture.md` → **[System/architecture.md](./System/architecture.md)**
- `System/database_schema.md` → **[System/database-schema.md](./System/database-schema.md)**
- `System/rbac_system.md` → **[System/rbac-system.md](./System/rbac-system.md)**
- `System/stock_management.md` → **[System/stock-management.md](./System/stock-management.md)**

#### SOP Files (Renamed)
All SOPs renamed from `snake_case` to `kebab-case`:
- `SOP/adding_new_feature.md` → **[SOP/adding-new-feature.md](./SOP/adding-new-feature.md)**
- `SOP/backend_testing.md` → **[SOP/backend-testing.md](./SOP/backend-testing.md)**
- `SOP/debugging_guide.md` → **[SOP/debugging-guide.md](./SOP/debugging-guide.md)**
- `SOP/frontend_testing.md` → **[SOP/frontend-testing.md](./SOP/frontend-testing.md)**
- `SOP/frontend_test_isolation.md` → **[SOP/frontend-test-isolation.md](./SOP/frontend-test-isolation.md)**
- `SOP/stock_transfers_feature_guide.md` → **[SOP/stock-transfers-feature-guide.md](./SOP/stock-transfers-feature-guide.md)**
- `SOP/testing_guide.md` → **[SOP/testing-guide.md](./SOP/testing-guide.md)**
- `SOP/testing_overview.md` → **[SOP/testing-overview.md](./SOP/testing-overview.md)**
- `SOP/test_flakiness.md` → **[SOP/test-flakiness.md](./SOP/test-flakiness.md)**
- `SOP/test_isolation_pattern.md` → **[SOP/test-isolation-pattern.md](./SOP/test-isolation-pattern.md)**
- `SOP/troubleshooting_tests.md` → **[SOP/troubleshooting-tests.md](./SOP/troubleshooting-tests.md)**

#### Tasks Directory → Features
The old `Tasks/` directory has been restructured into `Features/` with status-based organization:

**Old Location → New Location:**
- `Tasks/stock_transfers_feature.md` → **[Features/Completed/stock-transfers-v1/prd.md](./Features/Completed/stock-transfers-v1/prd.md)**
- `Tasks/stock_transfers_v2_enhancements.md` → **[Features/Completed/stock-transfers-v2/prd.md](./Features/Completed/stock-transfers-v2/prd.md)**
- `Tasks/session_expiration_handler.md` → **[Features/Completed/session-expiration/prd.md](./Features/Completed/session-expiration/prd.md)**
- `Tasks/testing_implementation.md` → **[Features/Completed/testing-implementation/prd.md](./Features/Completed/testing-implementation/prd.md)**
- `Tasks/e2e-test-fixes-needed.md` → **[Features/Completed/testing-implementation/issues.md](./Features/Completed/testing-implementation/issues.md)**

Each feature now has a README.md summarizing the work with completion date metadata.

#### New Additions
- **[Agents/](./Agents/)** - NEW: Agent portfolios and work logs
- **[Meta/](./Meta/)** - NEW: Documentation standards and protocols
- **[Features/InProgress/](./Features/InProgress/)** - NEW: Active development
- **[Features/Planned/](./Features/Planned/)** - NEW: Backlog
- **[RESTRUCTURE_PLAN.md](./RESTRUCTURE_PLAN.md)** - Details on restructure

### Key Changes

1. **File naming:** `snake_case` → `kebab-case` for consistency
2. **Organization:** Flat → hierarchical (System, Features, Agents, SOP, Meta)
3. **Status tracking:** Tasks → Features with status folders (InProgress, Completed, Planned)
4. **Agent system:** New infrastructure for multi-agent workflows
5. **Dual outputs:** Agents write to both work logs and feature folders
6. **Feature organization:** Completed features organized alphabetically by name (dates in README.md)

---

## Keeping Documentation Updated

### When to Update Documentation

✅ **Update after:**
- **Database changes** → Update [System/database-schema.md](./System/database-schema.md)
- **Permission changes** → Update [System/rbac-system.md](./System/rbac-system.md)
- **API pattern changes** → Update [System/architecture.md](./System/architecture.md)
- **Stock logic changes** → Update [System/stock-management.md](./System/stock-management.md)
- **Major architectural changes** → Update [System/architecture.md](./System/architecture.md)
- **New common issue discovered** → Add to [SOP/troubleshooting-tests.md](./SOP/troubleshooting-tests.md) or [SOP/debugging-guide.md](./SOP/debugging-guide.md)
- **New feature completed** → Move to [Features/Completed/](./Features/Completed/), create README
- **Agent completes work** → Update agent portfolio, save to both locations
- **Test patterns change** → Update relevant testing SOPs

### How to Update

**System Docs (architecture, database, RBAC, stock):**
1. Locate relevant section
2. Update inline (preserve structure)
3. Add new sections if introducing new concepts
4. Update "Last Updated" date at bottom
5. Cross-reference related docs if needed

**Feature Docs:**
1. When feature starts: Create folder in InProgress/
2. During development: Agents add their outputs
3. When complete: Move to Completed/YYYY-MM/
4. Create feature README summarizing work
5. Update [Features/_index.md](./Features/_index.md)

**Agent Portfolios:**
1. After agent completes task: Add to "Recent Work" (last 10)
2. Keep chronological order (newest first)
3. Archive oldest when adding 11th entry

**SOPs:**
1. Add new sections for new patterns
2. Update examples when code patterns change
3. Add issues to troubleshooting guides
4. Keep practical with code snippets

### Documentation Principles

- **Accuracy:** Outdated docs are worse than no docs. Keep current.
- **Clarity:** Use examples, code snippets, diagrams where helpful.
- **Completeness:** Cover the "what", "why", and "how".
- **Cross-referencing:** Link to related docs liberally.
- **Practical:** Focus on how developers will actually use the system.
- **Searchable:** Use clear headings, consistent terminology.
- **Maintained:** Treat docs with same care as code.

### Documentation as Code

- Documentation lives in version control
- Changes reviewed like code changes
- Documentation changes paired with code changes
- Keep docs in sync with implementation
- Update docs in same commit/PR as code change

---

## Statistics

### Documentation Metrics

**Total Files:** 42 markdown files
**Total Directories:** 31 folders

### By Category

**System Documentation:** 5 files (4 core + 1 index)
- architecture.md
- database-schema.md
- rbac-system.md
- stock-management.md
- Domain/ (0 docs currently, 4 planned)

**Features:** 13 files (4 completed features)
- 4 feature READMEs
- 4 PRDs
- 1 issues doc
- 1 index

**Agents:** 17 files (8 agents)
- 8 agent portfolios (README.md)
- 8 agent work folders (empty currently)
- 1 agent registry index

**SOPs:** 12 files (11 SOPs + 1 index)
- 1 development SOP
- 4 testing SOPs
- 4 test quality SOPs
- 1 debugging SOP
- 1 feature guide

**Meta:** 4 files
- agent-handoff-protocol.md
- agent-output-template.md
- documentation-guidelines.md
- archival-policy.md

**Other:** 2 files
- README.md (this file)
- RESTRUCTURE_PLAN.md

### Test Coverage (Documented)

**Total Tests:** 299 passing tests
- Backend (Jest): 227 tests
- Frontend (Playwright): 72 tests

**Test Documentation:**
- 5 testing SOPs
- 30+ troubleshooting solutions
- 100+ code examples across testing docs

### Agent Infrastructure

**Total Agents:** 8 specialized agents
- Infrastructure: 3 (database-expert, integration-orchestrator, debugging-detective)
- Backend: 2 (backend-api-expert, rbac-security-expert)
- Frontend: 1 (frontend-expert)
- Testing: 1 (test-engineer)
- Business Domain: 1 (stock-inventory-expert)

**Agent Definitions:** `.claude/agents/` (8 definition files)
**Work Logs:** `.agent/Agents/{agent-name}/work/` (8 folders)

### Feature Metrics

**Completed Features:** 7
- Approval Rule Archival
- E2E Test Refactoring & Organization
- Product Archival
- Stock Transfer Reversal Linking
- Stock Transfers v1
- Stock Transfers v2
- Session Expiration Handler

**In Progress:** 0

**Planned:** 0

**Database Tables Added:** 2 (StockTransfer, TransferTemplate)
**Database Enhancements:** Approval rule archival (3 new fields: isArchived, archivedAt, archivedByUserId), Transfer reversal bidirectional linking (removed redundant reversedById field, updated relations)
**New Permissions:** 1 (stock:transfer)
**Tests Added:** 326 (243 backend + 83 frontend) - includes 14 backend archival tests + 19 frontend archival E2E tests + 8 backend reversal linking tests

---

## Getting Help

### Where to Look

1. **This README** - Navigate to the right documentation
2. **System Docs** - Understand architecture and design
   - [System/_index.md](./System/_index.md)
3. **SOP Docs** - Follow step-by-step guides
   - [SOP/_index.md](./SOP/_index.md)
4. **Debugging Guide** - Troubleshoot issues
   - [SOP/debugging-guide.md](./SOP/debugging-guide.md)
5. **Code Comments** - Read inline documentation
6. **Git History** - See how features were implemented
7. **Feature Docs** - Historical context
   - [Features/_index.md](./Features/_index.md)

### Still Stuck?

- Check [CLAUDE.md](../CLAUDE.md) in project root for development commands
- Check [README.md](../README.md) in project root for setup instructions
- Review recent commits for similar changes
- Spawn debugging-detective agent to investigate
- Ask the team

---

## Related Documentation

**Project Root Documentation:**
- [../README.md](../README.md) - Project overview and setup
- [../CLAUDE.md](../CLAUDE.md) - Development commands and workflows
- [../.claude/agents/](../.claude/agents/) - Agent definition files

**External References:**
- API Documentation: `http://localhost:4000/docs` (Swagger UI)
- OpenAPI Spec: `http://localhost:4000/openapi.json`
- Prisma Studio: `npm run db:studio` (visual database browser)

---

## Contributing to Documentation

**Found an issue?** Fix it and update the "Last Updated" date.

**Have a question not covered?** Add it to the relevant doc or create a new one.

**Created a new feature?** Document it in Features/ and update system docs.

**Discovered a bug pattern?** Add to debugging-guide.md or troubleshooting-tests.md.

**Agent workflow improvement?** Update Meta/ documentation.

---

## Summary: How to Use This Documentation System

### For Reading

1. **Start with index files** - System/, Features/, Agents/, SOP/, Meta/ all have `_index.md`
2. **Use this README** - Navigate to specific docs
3. **Follow cross-references** - Docs link to related docs liberally
4. **Check multiple sources** - System docs + SOPs + feature history = complete picture

### For Writing

1. **System docs** - Update when code changes (keep current)
2. **Feature docs** - Create folder, write PRD, agents add outputs, create README when done
3. **Agent outputs** - Follow template, write to BOTH locations, update portfolio
4. **SOPs** - Add new patterns, update examples, document issues
5. **Keep synchronized** - Docs change with code, not after

### For Agent Workflows

1. **Read agent registry** - [Agents/_index.md](./Agents/_index.md)
2. **Read handoff protocol** - [Meta/agent-handoff-protocol.md](./Meta/agent-handoff-protocol.md)
3. **Spawn with context** - Provide docs to read, specify outputs
4. **Dual output strategy** - Agents write to work/ and Features/
5. **Update portfolios** - Keep Recent Work current

---

**Last Updated:** 2025-01-15
**Document Version:** 2.0 (Post-Restructure)
**Restructure Date:** 2025-01-15
**Total Documentation Files:** 42 files across 31 folders
**For Details:** See [RESTRUCTURE_PLAN.md](./RESTRUCTURE_PLAN.md)
