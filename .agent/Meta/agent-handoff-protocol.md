# Agent Handoff Protocol

**Purpose:** This document establishes the standard procedures for spawning agents, managing agent outputs, and coordinating multi-agent workflows.

**Last Updated:** 2025-01-15

---

## Table of Contents

1. [Overview](#overview)
2. [Agent Registry](#agent-registry)
3. [Spawning Agents](#spawning-agents)
4. [Output Strategy](#output-strategy)
5. [Referencing Previous Work](#referencing-previous-work)
6. [Updating Portfolios](#updating-portfolios)
7. [Multi-Agent Workflows](#multi-agent-workflows)
8. [Output Format Requirements](#output-format-requirements)
9. [Best Practices](#best-practices)
10. [Common Patterns](#common-patterns)

---

## Overview

### What is an Agent?

An **agent** is a specialized sub-thread spawned by the main thread to handle domain-specific tasks. Each agent has:
- A **definition file** in `.claude/agents/{agent-name}.md` (system prompt)
- A **portfolio README** in `.agent/Agents/{agent-name}/README.md` (work history)
- A **work folder** in `.agent/Agents/{agent-name}/work/` (recent outputs)

### Why Use Agents?

- **Specialization**: Each agent is an expert in a specific domain
- **Context Isolation**: Agents work independently without polluting main thread context
- **Parallel Execution**: Multiple agents can work simultaneously
- **Persistent Documentation**: Agent outputs become reusable knowledge
- **Clear Handoffs**: Structured workflow ensures nothing is lost

---

## Agent Registry

### Available Agents

| Agent Name | Domain | Definition File | When to Use |
|------------|--------|----------------|-------------|
| **database-expert** | Prisma, PostgreSQL, migrations | `.claude/agents/database-expert.md` | Database schema changes, migrations, multi-tenant patterns, indexes |
| **backend-api-expert** | Express, OpenAPI, services | `.claude/agents/backend-api-expert.md` | API routes, service layer, business logic, validation |
| **frontend-expert** | React, Mantine, routing | `.claude/agents/frontend-expert.md` | UI components, pages, routing, state management |
| **rbac-security-expert** | Permissions, roles, auth | `.claude/agents/rbac-security-expert.md` | Permissions, role assignments, authorization logic |
| **test-engineer** | Jest, Playwright, testing | `.claude/agents/test-engineer.md` | Test coverage, test fixes, test patterns, CI/CD |
| **stock-inventory-expert** | FIFO, stock ledger | `.claude/agents/stock-inventory-expert.md` | Inventory logic, FIFO algorithms, stock operations |
| **integration-orchestrator** | Type sync, deployment | `.claude/agents/integration-orchestrator.md` | Cross-cutting concerns, type generation, deployment checklists |
| **debugging-detective** | Bug analysis, root cause | `.claude/agents/debugging-detective.md` | Bug investigation, correlation ID tracing, error analysis |

### Agent Capabilities Matrix

| Task | Primary Agent | Supporting Agents |
|------|---------------|-------------------|
| Add new database table | database-expert | - |
| Create API endpoint | backend-api-expert | database-expert (if schema needed) |
| Build UI component | frontend-expert | backend-api-expert (for API client) |
| Add permission | rbac-security-expert | backend-api-expert, frontend-expert |
| Write tests | test-engineer | - |
| Fix stock discrepancy | stock-inventory-expert | database-expert (for queries) |
| Deploy feature | integration-orchestrator | All agents (collects outputs) |
| Debug production error | debugging-detective | Varies (depends on error) |

---

## Spawning Agents

### Basic Spawn Pattern

```
Main Thread → Spawn Agent → Agent Completes → Main Thread Reviews
```

### Spawn Command Template

When spawning an agent, provide:

1. **Clear Task Description**: What needs to be done
2. **Context Documents**: What to read before starting
3. **Output Locations**: Where to save results (DUAL STRATEGY)
4. **Update Instructions**: Which portfolio to update

**Example spawn prompt:**

```markdown
I need you to create a Supplier database model with multi-tenant pattern.

**Context to Read:**
- .agent/System/database-schema.md (understand multi-tenant patterns)
- .agent/System/architecture.md (database conventions)

**Task:**
1. Add Supplier model to schema.prisma
2. Create migration
3. Update seed data if needed
4. Document the model

**Output to:**
- .agent/Agents/database-expert/work/suppliers-schema-2025-01-15.md
- .agent/Features/InProgress/suppliers-feature/database-expert.md

**Update:**
- .agent/Agents/database-expert/README.md (add to "Recent Work")

**Format:**
Use the template from .agent/Meta/agent-output-template.md
```

### Mandatory Spawn Elements

✅ **Must include:**
- Task description (what to do)
- Context documents (what to read)
- Output locations (BOTH agent work log AND feature folder)
- Portfolio update instruction

❌ **Do NOT:**
- Spawn without context documents
- Skip output location specifications
- Forget to mention portfolio updates
- Use vague task descriptions

---

## Output Strategy

### Dual Output Locations

Every agent MUST write to TWO locations:

#### 1. Agent Work Log (Chronological)

**Location:** `.agent/Agents/{agent-name}/work/{feature}-{topic}-{YYYY-MM-DD}.md`

**Purpose:** Chronological history of all work by this agent

**Naming Convention:**
- Format: `{feature}-{topic}-{date}.md`
- Feature: Feature name or "standalone"
- Topic: Brief descriptor (e.g., "schema", "api", "ui", "tests")
- Date: `YYYY-MM-DD`

**Examples:**
- `suppliers-schema-2025-01-15.md`
- `transfers-fifo-logic-2025-01-16.md`
- `permissions-rbac-updates-2025-01-17.md`
- `bugfix-session-leak-2025-01-18.md`

**Retention Policy:**
- Keep last 10 work logs in `/work/` folder
- Move older logs to feature folders or archive
- See [Archival Policy](./archival-policy.md) for details

#### 2. Feature Folder (Contextual)

**Location:** `.agent/Features/{status}/{feature-name}/{agent-name}.md`

**Purpose:** Collect all agent outputs for a specific feature

**Status Folders:**
- `InProgress/` - Currently being developed
- `Completed/` - Finished features (flat, organized by feature name)
- `Planned/` - Backlog items

**Examples:**
- `.agent/Features/InProgress/suppliers-feature/database-expert.md`
- `.agent/Features/InProgress/suppliers-feature/backend-api-expert.md`
- `.agent/Features/InProgress/suppliers-feature/frontend-expert.md`
- `.agent/Features/Completed/stock-transfers-v1/database-expert.md`

**Why Flat Structure for Completed:**
- Features organized alphabetically by name (easier to find "Did we do Suppliers?")
- Completion dates tracked in each feature's README.md metadata
- Simpler navigation (no nested date folders)
- Human-friendly: developers think in features, not completion dates

**When Feature Completes:**
- Ensure README.md contains completion date
- Move entire feature folder from `InProgress/` to `Completed/{feature-name}/`
- Create or update feature README summarizing all agent contributions
- Update `.agent/Features/_index.md`

### Why Dual Strategy?

**Agent Work Log Benefits:**
- See "what has this agent done recently?"
- Understand agent's specialization and patterns
- Quick reference for similar tasks
- Portfolio building for agent improvements

**Feature Folder Benefits:**
- See "who worked on this feature?"
- Gather all context in one place for future agents
- Historical reference when maintaining/extending feature
- Easier archival (move entire feature at once)

### Output File Naming

**Agent Work Logs:**
- Use kebab-case: `feature-name-topic-date.md`
- Include date: `YYYY-MM-DD`
- Be specific: `suppliers-api-endpoints-2025-01-15.md` (good)
- Avoid vague: `work-2025-01-15.md` (bad)

**Feature Folder Outputs:**
- Use agent name: `{agent-name}.md`
- Examples: `database-expert.md`, `frontend-expert.md`
- If agent works multiple times on same feature, append output to existing file (use headers/sections)

---

## Referencing Previous Work

### How to Reference Agent Outputs

When spawning an agent that depends on previous work, explicitly tell them what to read:

**Good Example:**
```markdown
**Context to Read:**
- .agent/Features/InProgress/suppliers-feature/database-expert.md
  (Understand Supplier model schema and relationships)
- .agent/Features/InProgress/suppliers-feature/rbac-security-expert.md
  (Know which permissions were added: suppliers:read, suppliers:write)
```

**Bad Example:**
```markdown
Read the previous agent's work on suppliers.
```

### Cross-Agent Dependencies

Common dependency flows:

1. **database-expert → backend-api-expert**
   - Backend needs to know: Models, fields, relationships
   - Reference: `.agent/Features/{feature}/database-expert.md`

2. **backend-api-expert → frontend-expert**
   - Frontend needs to know: API endpoints, request/response schemas
   - Reference: `.agent/Features/{feature}/backend-api-expert.md`

3. **rbac-security-expert → backend-api-expert + frontend-expert**
   - Both need to know: Permission keys, role assignments
   - Reference: `.agent/Features/{feature}/rbac-security-expert.md`

4. **All agents → test-engineer**
   - Tests need to know: All changes made
   - Reference: All files in `.agent/Features/{feature}/`

5. **All agents → integration-orchestrator**
   - Integration needs to know: All changes, deployment requirements
   - Reference: All files in `.agent/Features/{feature}/`

### Finding Previous Work

**By Agent:**
```
Check: .agent/Agents/{agent-name}/README.md
Look for: "Recent Work" section
Purpose: See what this agent did recently
```

**By Feature:**
```
Check: .agent/Features/{status}/{feature-name}/
Look for: {agent-name}.md files
Purpose: See all agent contributions to this feature
```

**By Date:**
```
Check: .agent/Agents/{agent-name}/work/
Look for: Files with YYYY-MM-DD in name
Purpose: Find work from specific time period
```

---

## Updating Portfolios

### Agent Portfolio README

Each agent has a portfolio README: `.agent/Agents/{agent-name}/README.md`

**Structure:**
```markdown
# {Agent Name} - Work Portfolio

**Agent Definition:** [.claude/agents/{agent-name}.md](../../.claude/agents/{agent-name}.md)

## Purpose
{Brief description of what this agent does}

## Recent Work (Last 10)

- [2025-01-15] [Suppliers Schema](./work/suppliers-schema-2025-01-15.md) - Created Supplier model with multi-tenant pattern
- [2025-01-14] [Transfers Migration](./work/transfers-migration-2025-01-14.md) - Added StockTransfer tables
- ...

## Common Patterns
{Typical tasks this agent handles}

## Related Agents
{Which agents typically work before/after this one}
```

### When to Update Portfolio

✅ **Update portfolio when:**
- Agent completes a task
- Output is saved to `/work/` folder
- Add to "Recent Work" section

✅ **Format:**
```markdown
- [YYYY-MM-DD] [Task Name](./work/filename.md) - Brief description (5-10 words)
```

✅ **Keep last 10 entries:**
- When adding 11th entry, remove oldest
- Oldest entry's file should be moved to feature folder or archived

### Feature README

When a feature completes, create: `.agent/Features/Completed/{feature-name}/README.md`

**Structure:**
```markdown
# {Feature Name}

**Status:** ✅ Completed
**Completion Date:** YYYY-MM-DD
**Implementation Period:** YYYY-MM-DD to YYYY-MM-DD

## Overview
{Brief description of what this feature does}

## Agent Contributions

### database-expert
- Created models: {list}
- Migrations: {list}
- [Full Output](./database-expert.md)

### backend-api-expert
- API endpoints: {list}
- Service methods: {list}
- [Full Output](./backend-api-expert.md)

### frontend-expert
- Pages: {list}
- Components: {list}
- [Full Output](./frontend-expert.md)

{... other agents ...}

## Key Decisions
{Important technical decisions made during implementation}

## Testing
- Backend tests: {location, coverage}
- Frontend tests: {location, coverage}

## Related Work
- Commits: {git commit hashes}
- Pull Requests: {PR links if applicable}

## Notes
{Any important context, gotchas, or lessons learned}
```

---

## Multi-Agent Workflows

### Sequential Workflow (Most Common)

**Pattern:** Agent A → Agent B → Agent C

**Example: Adding "Suppliers" Feature**

```
1. Main Thread creates feature folder:
   - .agent/Features/InProgress/suppliers-feature/
   - .agent/Features/InProgress/suppliers-feature/README.md (status: In Progress)
   - .agent/Features/InProgress/suppliers-feature/prd.md (requirements)

2. Main Thread spawns database-expert:
   Prompt: "Create Supplier model with multi-tenant pattern.
            Read: .agent/System/database-schema.md
            Output to:
              - .agent/Agents/database-expert/work/suppliers-schema-2025-01-15.md
              - .agent/Features/InProgress/suppliers-feature/database-expert.md
            Update: .agent/Agents/database-expert/README.md"

   database-expert completes:
   - schema.prisma updated
   - Migration created
   - Seed data added
   - Output saved to both locations
   - Portfolio updated

3. Main Thread spawns rbac-security-expert:
   Prompt: "Add permissions for suppliers feature.
            Read: .agent/System/rbac-system.md
            Output to:
              - .agent/Agents/rbac-security-expert/work/suppliers-permissions-2025-01-15.md
              - .agent/Features/InProgress/suppliers-feature/rbac-security-expert.md
            Update: .agent/Agents/rbac-security-expert/README.md"

   rbac-security-expert completes:
   - Added: suppliers:read, suppliers:write
   - Updated role assignments
   - Output saved

4. Main Thread spawns backend-api-expert:
   Prompt: "Create suppliers API with CRUD operations.
            Read:
              - .agent/Features/InProgress/suppliers-feature/database-expert.md
              - .agent/Features/InProgress/suppliers-feature/rbac-security-expert.md
            Output to:
              - .agent/Agents/backend-api-expert/work/suppliers-api-2025-01-15.md
              - .agent/Features/InProgress/suppliers-feature/backend-api-expert.md
            Update: .agent/Agents/backend-api-expert/README.md"

   backend-api-expert completes:
   - Service layer created
   - OpenAPI schemas defined
   - Router registered
   - Output saved

5. Main Thread spawns frontend-expert:
   Prompt: "Create suppliers management UI.
            Read:
              - .agent/Features/InProgress/suppliers-feature/backend-api-expert.md
              - .agent/Features/InProgress/suppliers-feature/rbac-security-expert.md
            Output to:
              - .agent/Agents/frontend-expert/work/suppliers-ui-2025-01-15.md
              - .agent/Features/InProgress/suppliers-feature/frontend-expert.md
            Update: .agent/Agents/frontend-expert/README.md"

   frontend-expert completes:
   - Page component created
   - API client added
   - Routing configured
   - Output saved

6. Main Thread spawns test-engineer:
   Prompt: "Write comprehensive tests for suppliers feature.
            Read: All files in .agent/Features/InProgress/suppliers-feature/
            Output to:
              - .agent/Agents/test-engineer/work/suppliers-tests-2025-01-15.md
              - .agent/Features/InProgress/suppliers-feature/test-engineer.md
            Update: .agent/Agents/test-engineer/README.md"

   test-engineer completes:
   - Backend tests (Jest)
   - Frontend tests (Playwright)
   - Coverage report
   - Output saved

7. Main Thread spawns integration-orchestrator:
   Prompt: "Create deployment checklist and verify integration.
            Read: All files in .agent/Features/InProgress/suppliers-feature/
            Output to:
              - .agent/Agents/integration-orchestrator/work/suppliers-integration-2025-01-15.md
              - .agent/Features/InProgress/suppliers-feature/integration-orchestrator.md
            Update: .agent/Agents/integration-orchestrator/README.md"

   integration-orchestrator completes:
   - Type generation verified
   - Deployment checklist created
   - System docs updated
   - Output saved

8. Main Thread completes feature:
   - Update README with completion date: .agent/Features/InProgress/suppliers-feature/README.md
   - Move folder: InProgress/suppliers-feature → Completed/suppliers-feature
   - Update: .agent/Features/_index.md (add to chronological list by completion date)
   - Celebrate!
```

### Parallel Workflow (Advanced)

**Pattern:** Agent A + Agent B (concurrent) → Agent C (merge)

**When to Use:**
- Independent tasks that can run simultaneously
- Need to speed up development
- No dependencies between tasks

**Example: Separate Backend + Frontend Work**

```
1. Main Thread spawns BOTH agents simultaneously:

   Spawn backend-api-expert:
   "Create suppliers API..."

   Spawn frontend-expert:
   "Create suppliers UI (mock API for now)..."

2. Both agents work in parallel:
   - backend-api-expert: Creates API
   - frontend-expert: Creates UI with mock data

3. Main Thread integrates:
   - Frontend connects to real API
   - Run integration tests
   - Fix any mismatches
```

**Caution:** Parallel workflows risk integration issues. Use sequential for complex features.

### Iterative Workflow (Bug Fixes, Refinements)

**Pattern:** Agent A → Review → Agent A (again)

**Example: Fixing a Flaky Test**

```
1. Main Thread spawns debugging-detective:
   "Investigate why product creation test is flaky.
    Read: .agent/SOP/test-flakiness.md"

   debugging-detective identifies:
   - Root cause: Race condition in stock initialization
   - Recommendation: Add waitFor pattern

2. Main Thread spawns test-engineer:
   "Fix flaky test based on debugging-detective findings.
    Read: .agent/Agents/debugging-detective/work/product-test-flakiness-2025-01-15.md"

   test-engineer fixes test and verifies stability

3. Main Thread verifies:
   - Run test 100 times
   - Confirm no failures
   - Close issue
```

---

## Output Format Requirements

All agent outputs MUST follow the template at `.agent/Meta/agent-output-template.md`.

### Required Sections

✅ **Every output must include:**

1. **Header**
   - Task Name
   - Date (YYYY-MM-DD)
   - Agent Name
   - Feature Name (or "standalone")
   - Status

2. **Context**
   - What was requested
   - Related documentation read
   - Dependencies on other agents

3. **Changes Made**
   - Files created/modified
   - Database changes (if applicable)
   - API changes (if applicable)
   - Permission changes (if applicable)
   - UI changes (if applicable)

4. **Key Decisions**
   - What was decided
   - Why (rationale)
   - Alternatives considered

5. **Testing**
   - How to test
   - Test files created/modified
   - Coverage notes

6. **Next Steps**
   - What happens next
   - What other agents need to know
   - Blockers (if any)

7. **References**
   - Documentation read
   - Related agent outputs
   - Code examples

### Optional Sections

Use when applicable:
- Implementation Details (for complex logic)
- Performance Considerations
- Security Considerations
- Blockers & Issues
- Questions/Uncertainties

### Agent-Specific Focus

Different agents emphasize different sections:

**database-expert:**
- Focus: Database Changes, Migration commands, Indexes
- Light on: UI Changes (N/A)

**frontend-expert:**
- Focus: UI Changes, Components, Routing
- Light on: Database Changes (N/A)

**test-engineer:**
- Focus: Testing section, Coverage breakdown
- Light on: Key Decisions (tests follow implementation)

**integration-orchestrator:**
- Focus: Next Steps, Integration Requirements, Checklist
- Light on: Implementation Details (doesn't write code)

See template for detailed agent-specific guidelines.

---

## Best Practices

### Do's ✅

1. **Always provide context documents**
   - Tell agent what to read before starting
   - Link specific sections when possible
   - Include previous agent outputs for dependencies

2. **Be specific about outputs**
   - Specify BOTH output locations explicitly
   - Use exact file paths
   - Mention portfolio update requirement

3. **Break down large tasks**
   - Spawn multiple agents for different aspects
   - Sequential workflow for dependencies
   - Keep each agent's task focused

4. **Review agent outputs before proceeding**
   - Verify agent understood task
   - Check for blockers or issues
   - Confirm outputs saved correctly

5. **Update documentation**
   - Agents update their portfolios
   - Main thread updates feature READMEs
   - Keep .agent/Features/_index.md current

6. **Follow naming conventions**
   - kebab-case for filenames
   - Include date in agent work logs
   - Use descriptive feature folder names

### Don'ts ❌

1. **Don't spawn without context**
   - Never say "just do it" without links
   - Don't assume agent knows project history
   - Don't skip reading requirements

2. **Don't forget dual output strategy**
   - Never save to only one location
   - Don't skip portfolio updates
   - Don't use vague filenames

3. **Don't skip feature folders**
   - Even "small" changes should have feature folders
   - Don't put agent outputs only in /work/
   - Don't lose context by skipping feature organization

4. **Don't spawn agents for trivial tasks**
   - Main thread can handle simple changes
   - Don't over-engineer simple fixes
   - Reserve agents for domain expertise

5. **Don't ignore blockers**
   - If agent reports blocker, address it
   - Don't proceed with incomplete work
   - Don't spawn next agent if dependency blocked

6. **Don't let work logs accumulate**
   - Archive old work logs (keep last 10)
   - Move completed features to /Completed/
   - Follow archival policy regularly

---

## Common Patterns

### Pattern 1: Full Stack Feature

```
database-expert → rbac-security-expert → backend-api-expert → frontend-expert → test-engineer → integration-orchestrator
```

**Use for:** Complete CRUD features (Suppliers, Purchase Orders, etc.)

### Pattern 2: Database Migration Only

```
database-expert → test-engineer
```

**Use for:** Schema changes, adding indexes, data migrations

### Pattern 3: Permission Addition

```
rbac-security-expert → backend-api-expert → frontend-expert
```

**Use for:** Adding permissions to existing features

### Pattern 4: Bug Fix

```
debugging-detective → {appropriate agent} → test-engineer
```

**Use for:** Investigating and fixing bugs

### Pattern 5: Test Coverage Improvement

```
test-engineer
```

**Use for:** Adding missing tests, fixing flaky tests

### Pattern 6: UI Refinement

```
frontend-expert → test-engineer
```

**Use for:** UI improvements, styling changes, UX enhancements

### Pattern 7: Performance Optimization

```
{database-expert OR backend-api-expert} → test-engineer
```

**Use for:** Query optimization, API performance improvements

### Pattern 8: Deployment Preparation

```
integration-orchestrator
```

**Use for:** Pre-deployment checks, system doc updates, type generation

---

## Troubleshooting Agent Handoffs

### Issue: Agent didn't save to both locations

**Solution:**
- Remind agent of dual output strategy
- Check file paths are absolute, not relative
- Verify folders exist before spawning agent

### Issue: Agent output missing required sections

**Solution:**
- Reference `.agent/Meta/agent-output-template.md` explicitly in spawn prompt
- Ask agent to revise output to include missing sections
- Update template if new section needed

### Issue: Agent didn't update portfolio

**Solution:**
- Explicitly mention portfolio update in spawn prompt
- Show example of Recent Work format
- Verify agent has write access to README

### Issue: Agent couldn't find context documents

**Solution:**
- Use absolute paths: `.agent/System/...` not `System/...`
- Verify document exists before referencing
- Provide multiple context sources if needed

### Issue: Sequential agents lack context

**Solution:**
- Always reference previous agent outputs
- Provide specific file paths to read
- Summarize key dependencies in spawn prompt

### Issue: Feature folder disorganized

**Solution:**
- Create feature folder BEFORE spawning first agent
- Use consistent naming: kebab-case
- Include README and PRD in feature folder

---

## Examples

### Example 1: Simple Task (Standalone)

```markdown
**Spawn debugging-detective:**

Task: Investigate why session cookies aren't persisting in production.

Context to Read:
- .agent/System/architecture.md (authentication section)
- .agent/SOP/debugging-guide.md (session cookie issues)

Output to:
- .agent/Agents/debugging-detective/work/session-cookie-debug-2025-01-15.md
- .agent/Features/InProgress/session-fixes/debugging-detective.md

Update:
- .agent/Agents/debugging-detective/README.md

Format:
Use template from .agent/Meta/agent-output-template.md
Focus on: Root cause analysis, environment differences, fix recommendation
```

### Example 2: Multi-Agent Feature

```markdown
**Feature:** Purchase Orders

**Step 1: Spawn database-expert**

Task: Create PurchaseOrder and PurchaseOrderItem models with multi-tenant pattern.

Context to Read:
- .agent/System/database-schema.md
- .agent/Features/Completed/stock-transfers-v1/database-expert.md (similar pattern)

Output to:
- .agent/Agents/database-expert/work/purchase-orders-schema-2025-01-15.md
- .agent/Features/InProgress/purchase-orders/database-expert.md

Update:
- .agent/Agents/database-expert/README.md

---

**Step 2: Spawn rbac-security-expert**

Task: Add permissions for purchase orders (read, write, approve).

Context to Read:
- .agent/System/rbac-system.md
- .agent/Features/InProgress/purchase-orders/database-expert.md

Output to:
- .agent/Agents/rbac-security-expert/work/purchase-orders-permissions-2025-01-15.md
- .agent/Features/InProgress/purchase-orders/rbac-security-expert.md

Update:
- .agent/Agents/rbac-security-expert/README.md

---

**Step 3: Spawn backend-api-expert**

Task: Create purchase orders API with CRUD and approval workflow.

Context to Read:
- .agent/Features/InProgress/purchase-orders/database-expert.md (models)
- .agent/Features/InProgress/purchase-orders/rbac-security-expert.md (permissions)
- .agent/SOP/adding-new-feature.md (backend implementation)

Output to:
- .agent/Agents/backend-api-expert/work/purchase-orders-api-2025-01-15.md
- .agent/Features/InProgress/purchase-orders/backend-api-expert.md

Update:
- .agent/Agents/backend-api-expert/README.md

{... continue for frontend-expert, test-engineer, integration-orchestrator ...}
```

### Example 3: Bug Fix with Investigation

```markdown
**Issue:** Stock levels incorrect after transfer reversal

**Step 1: Spawn debugging-detective**

Task: Investigate why stock levels don't match after reversing a transfer.

Context to Read:
- .agent/System/stock-management.md (FIFO logic, reversal flow)
- api-server/src/services/stockTransferService.ts (reversal implementation)

Output to:
- .agent/Agents/debugging-detective/work/transfer-reversal-bug-2025-01-15.md
- .agent/Features/InProgress/stock-fixes/debugging-detective.md

Update:
- .agent/Agents/debugging-detective/README.md

---

**Step 2: Spawn stock-inventory-expert** (based on debugging-detective findings)

Task: Fix transfer reversal logic to correctly handle FIFO lot restoration.

Context to Read:
- .agent/Features/InProgress/stock-fixes/debugging-detective.md (root cause)
- .agent/System/stock-management.md (correct FIFO algorithm)

Output to:
- .agent/Agents/stock-inventory-expert/work/transfer-reversal-fix-2025-01-15.md
- .agent/Features/InProgress/stock-fixes/stock-inventory-expert.md

Update:
- .agent/Agents/stock-inventory-expert/README.md

---

**Step 3: Spawn test-engineer**

Task: Add tests for transfer reversal edge cases.

Context to Read:
- .agent/Features/InProgress/stock-fixes/stock-inventory-expert.md (fix details)
- .agent/SOP/backend-testing.md (stock testing patterns)

Output to:
- .agent/Agents/test-engineer/work/transfer-reversal-tests-2025-01-15.md
- .agent/Features/InProgress/stock-fixes/test-engineer.md

Update:
- .agent/Agents/test-engineer/README.md
```

---

## Summary Checklist

When spawning an agent, verify:

- [ ] Clear task description provided
- [ ] Context documents specified with reasons
- [ ] BOTH output locations specified
  - [ ] Agent work log path: `.agent/Agents/{agent}/work/{filename}.md`
  - [ ] Feature folder path: `.agent/Features/{status}/{feature}/{agent}.md`
- [ ] Portfolio update instruction included
- [ ] Output format reference to template
- [ ] Previous agent outputs referenced (if dependencies exist)
- [ ] Feature folder exists (if new feature)
- [ ] Agent definition exists in `.claude/agents/`

When agent completes, verify:

- [ ] Output saved to both locations
- [ ] Template followed (all required sections)
- [ ] Portfolio README updated (Recent Work)
- [ ] Feature README updated (if applicable)
- [ ] Next steps clearly stated
- [ ] Blockers documented (if any)
- [ ] Files archived if work log > 10 entries

---

**Last Updated:** 2025-01-15
**Related Documents:**
- [Agent Output Template](./agent-output-template.md)
- [Documentation Guidelines](./documentation-guidelines.md)
- [Archival Policy](./archival-policy.md)
