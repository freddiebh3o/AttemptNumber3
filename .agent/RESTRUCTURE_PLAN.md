# .agent Directory Restructure Plan

**Date:** 2025-01-15
**Purpose:** Transform `.agent/` into a scalable, agent-friendly documentation system
**Goal:** Support multi-agent workflows with clear handoffs and persistent context

---

## Overview

This restructure addresses three key problems:
1. **Scalability**: Current flat structure won't scale with agent workflows
2. **Context Management**: Sub-agents need persistent documentation to reference
3. **Organization**: Features, system docs, and agent work need separate concerns

---

## New Directory Structure

```
.agent/
├── README.md                              # Updated master index
├── RESTRUCTURE_PLAN.md                    # This file
│
├── /System/                               # Living system documentation (CURRENT STATE)
│   ├── _index.md                         # System docs index
│   ├── architecture.md                   # Renamed from project_architecture.md
│   ├── database-schema.md                # Renamed from database_schema.md
│   ├── rbac-system.md                    # Renamed from rbac_system.md
│   ├── stock-management.md               # Renamed from stock_management.md
│   └── /Domain/                          # Domain-specific docs
│       ├── products.md                   # Product domain knowledge
│       ├── stock.md                      # Stock/inventory domain
│       ├── transfers.md                  # Transfer domain
│       └── users.md                      # User management domain
│
├── /Features/                             # Feature work logs (HISTORICAL)
│   ├── _index.md                         # Feature index by status
│   ├── /Completed/                       # Archived completed features (flat structure)
│   │   ├── /stock-transfers-v1/
│   │   │   ├── README.md                 # Feature overview
│   │   │   └── prd.md                    # Migrated from Tasks/
│   │   ├── /stock-transfers-v2/
│   │   │   ├── README.md
│   │   │   └── prd.md
│   │   ├── /session-expiration/
│   │   │   ├── README.md
│   │   │   └── prd.md
│   │   └── /testing-implementation/
│   │       ├── README.md
│   │       ├── prd.md
│   │       └── issues.md
│   ├── /InProgress/                      # Currently being worked on
│   └── /Planned/                         # Roadmap / backlog

**Note:** Features are organized alphabetically by feature name (not by date) for easier human discovery. Completion dates are tracked in each feature's README.md metadata.
│
├── /Agents/                               # Agent work logs & portfolios
│   ├── _index.md                         # Agent registry & recent work
│   ├── /database-expert/
│   │   ├── README.md                     # Agent portfolio & work index
│   │   └── /work/                        # Recent outputs (last 10)
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
├── /SOP/                                  # Standard Operating Procedures (mostly unchanged)
│   ├── _index.md                         # NEW: SOP index
│   ├── adding-new-feature.md             # Renamed from adding_new_feature.md
│   ├── backend-testing.md                # Renamed from backend_testing.md
│   ├── debugging-guide.md                # Renamed from debugging_guide.md
│   ├── frontend-testing.md               # Renamed from frontend_testing.md
│   ├── frontend-test-isolation.md        # Renamed from frontend_test_isolation.md
│   ├── stock-transfers-feature-guide.md  # Renamed from stock_transfers_feature_guide.md
│   ├── testing-guide.md                  # Renamed from testing_guide.md
│   ├── testing-overview.md               # Renamed from testing_overview.md
│   ├── test-flakiness.md                 # Renamed from test_flakiness.md
│   ├── test-isolation-pattern.md         # Renamed from test_isolation_pattern.md
│   └── troubleshooting-tests.md          # Renamed from troubleshooting_tests.md
│
└── /Meta/                                 # Documentation about documentation
    ├── agent-handoff-protocol.md         # How agents should document work
    ├── agent-output-template.md          # Universal template for agent outputs
    ├── documentation-guidelines.md       # Doc writing standards
    └── archival-policy.md                # When/how to archive
```

---

## Agent Infrastructure

### Agent Definitions (`.claude/agents/`)
These are the **system prompts** that define agent behavior. Claude Code reads these when spawning sub-agents.

**Existing:**
- `frontend-expert.md`

**New (to be created):**
- `database-expert.md`
- `backend-api-expert.md`
- `rbac-security-expert.md`
- `test-engineer.md`
- `stock-inventory-expert.md`
- `integration-orchestrator.md`
- `debugging-detective.md`

### Agent Work Logs (`.agent/Agents/`)
This is where agents **write outputs** after completing tasks. Organized by agent type.

**Dual Output Strategy:**
Each agent writes to TWO locations:
1. **`/Agents/{agent-name}/work/{task}-{date}.md`** - Chronological log of all work by this agent
2. **`/Features/{feature-name}/{agent-name}.md`** - Feature-specific collection for context

**Benefits:**
- See "what has this agent done lately?" → Check `/Agents/{agent-name}/`
- See "what work was done for this feature?" → Check `/Features/{feature-name}/`

---

## Implementation Steps

### **Step 1: Create New Folder Structure**

**1.1 Create System folders:**
```bash
mkdir -p .agent/System/Domain
```

**1.2 Create Features folders:**
```bash
mkdir -p .agent/Features/Completed
mkdir -p .agent/Features/InProgress
mkdir -p .agent/Features/Planned
```

**1.3 Create Agents folders:**
```bash
mkdir -p .agent/Agents/database-expert/work
mkdir -p .agent/Agents/backend-api-expert/work
mkdir -p .agent/Agents/frontend-expert/work
mkdir -p .agent/Agents/rbac-security-expert/work
mkdir -p .agent/Agents/test-engineer/work
mkdir -p .agent/Agents/stock-inventory-expert/work
mkdir -p .agent/Agents/integration-orchestrator/work
mkdir -p .agent/Agents/debugging-detective/work
```

**1.4 Create Meta folder:**
```bash
mkdir -p .agent/Meta
```

---

### **Step 2: Migrate Existing Files**

**2.1 Rename System docs (kebab-case for consistency):**
- `System/project_architecture.md` → `System/architecture.md`
- `System/database_schema.md` → `System/database-schema.md`
- `System/rbac_system.md` → `System/rbac-system.md`
- `System/stock_management.md` → `System/stock-management.md`

**2.2 Rename SOP docs (kebab-case for consistency):**
- `SOP/adding_new_feature.md` → `SOP/adding-new-feature.md`
- `SOP/backend_testing.md` → `SOP/backend-testing.md`
- `SOP/debugging_guide.md` → `SOP/debugging-guide.md`
- `SOP/frontend_testing.md` → `SOP/frontend-testing.md`
- `SOP/frontend_test_isolation.md` → `SOP/frontend-test-isolation.md`
- `SOP/stock_transfers_feature_guide.md` → `SOP/stock-transfers-feature-guide.md`
- `SOP/testing_guide.md` → `SOP/testing-guide.md`
- `SOP/testing_overview.md` → `SOP/testing-overview.md`
- `SOP/test_flakiness.md` → `SOP/test-flakiness.md`
- `SOP/test_isolation_pattern.md` → `SOP/test-isolation-pattern.md`
- `SOP/troubleshooting_tests.md` → `SOP/troubleshooting-tests.md`

**2.3 Migrate Tasks to Features/Completed/:**

**stock-transfers-v1:**
```bash
mkdir -p .agent/Features/Completed/stock-transfers-v1
# Move Tasks/stock_transfers_feature.md → stock-transfers-v1/prd.md
# Create stock-transfers-v1/README.md (include Completion Date: 2025-01-XX)
```

**stock-transfers-v2:**
```bash
mkdir -p .agent/Features/Completed/stock-transfers-v2
# Move Tasks/stock_transfers_v2_enhancements.md → stock-transfers-v2/prd.md
# Create stock-transfers-v2/README.md (include Completion Date: 2025-01-XX)
```

**session-expiration:**
```bash
mkdir -p .agent/Features/Completed/session-expiration
# Move Tasks/session_expiration_handler.md → session-expiration/prd.md
# Create session-expiration/README.md (include Completion Date: 2025-01-XX)
```

**testing-implementation:**
```bash
mkdir -p .agent/Features/Completed/testing-implementation
# Move Tasks/testing_implementation.md → testing-implementation/prd.md
# Move Tasks/e2e-test-fixes-needed.md → testing-implementation/issues.md
# Create testing-implementation/README.md (include Completion Date: 2025-01-XX)
```

**2.4 Delete old Tasks directory:**
```bash
# After confirming all files migrated
rm -rf .agent/Tasks
```

---

### **Step 3A: Create Agent Definitions in `.claude/agents/`**

Create 7 new agent definition files (frontend-expert already exists):

**Format (following your existing frontend-expert.md):**
```markdown
---
name: {agent-name}
description: Use this agent when you need to...
color: {color}
-------------

You are an expert {role} specializing in...

Your core responsibilities:
1. {Responsibility 1}
2. {Responsibility 2}
...

When working on tasks:
- {Best practice 1}
- {Best practice 2}
...
```

**Agents to create:**
1. `database-expert.md` - Prisma, PostgreSQL, migrations, multi-tenant patterns
2. `backend-api-expert.md` - Express, OpenAPI, service layer, business logic
3. `rbac-security-expert.md` - Permissions, roles, authorization, security
4. `test-engineer.md` - Jest, Playwright, test helpers, coverage
5. `stock-inventory-expert.md` - FIFO, stock ledger, inventory domain logic
6. `integration-orchestrator.md` - Type sync, deployment checks, cross-cutting
7. `debugging-detective.md` - Bug analysis, correlation IDs, root cause

---

### **Step 3B: Create Agent Work Log Structure in `.agent/Agents/`**

For each of the 8 agents, create:

**`README.md` format:**
```markdown
# {Agent Name} - Work Portfolio

**Agent Definition:** [.claude/agents/{agent-name}.md](../../.claude/agents/{agent-name}.md)

## Purpose
{What this agent does}

## Recent Work (Last 10)

<!-- Agents will update this automatically -->
<!-- Format: - [YYYY-MM-DD] [Task Name](./work/filename.md) - Brief description -->

_No work completed yet_

## Common Patterns
{Typical tasks this agent handles}

## Related Agents
{Which agents typically work before/after this one}
```

**Create for:**
- `/Agents/database-expert/README.md`
- `/Agents/backend-api-expert/README.md`
- `/Agents/frontend-expert/README.md`
- `/Agents/rbac-security-expert/README.md`
- `/Agents/test-engineer/README.md`
- `/Agents/stock-inventory-expert/README.md`
- `/Agents/integration-orchestrator/README.md`
- `/Agents/debugging-detective/README.md`

---

### **Step 3C: Create Universal Output Template**

**File:** `.agent/Meta/agent-output-template.md`

**Purpose:** Standard format for all agent outputs

**Sections:**
1. Context (what was requested, by whom, related docs)
2. Task Description
3. Changes Made (files created/modified)
4. Key Decisions (rationale, alternatives)
5. Testing Notes
6. Next Steps
7. Blockers/Issues
8. References

---

### **Step 4: Create Index Files**

**4.1 System Index:** `.agent/System/_index.md`
- List all system docs with descriptions
- When to use each doc
- Quick reference table

**4.2 Features Index:** `.agent/Features/_index.md`
- Features by status (In Progress, Completed, Planned)
- Month-based navigation for completed features
- Template for feature folders

**4.3 Agents Index:** `.agent/Agents/_index.md`
- Agent registry (all 8 agents)
- Capabilities matrix
- When to use each agent
- Typical multi-agent workflows
- How to spawn agents with context

**4.4 SOP Index:** `.agent/SOP/_index.md`
- List all SOPs with use cases
- Quick reference for common tasks

---

### **Step 5: Write Meta Documentation**

**5.1 Agent Handoff Protocol:** `.agent/Meta/agent-handoff-protocol.md`
- How to spawn agents with proper context
- Where agents should save outputs (dual strategy)
- How to reference previous agent work
- How to update feature READMEs
- Example workflows

**5.2 Documentation Guidelines:** `.agent/Meta/documentation-guidelines.md`
- Writing standards for .agent/ docs
- Markdown formatting conventions
- When to update vs. create new docs
- How to keep docs current
- File naming conventions (kebab-case)

**5.3 Archival Policy:** `.agent/Meta/archival-policy.md`
- When to move features to /Completed/
- Month/year organization strategy
- Agent work log retention (keep last 10)
- Cleanup procedures

---

### **Step 6: Update Root README**

**File:** `.agent/README.md`

**Updates needed:**
1. Document new directory structure
2. Add navigation to agent registry
3. Update "Finding Information" section
4. Add migration notes (where old files went)
5. Add "Working with Sub-Agents" section
6. Update file counts and structure diagram

---

## Domain-Specific System Docs

Create focused domain docs extracted from existing system docs:

**`.agent/System/Domain/products.md`**
- Product model structure
- SKU uniqueness per tenant
- Entity versioning (optimistic locking)
- Product CRUD patterns

**`.agent/System/Domain/stock.md`**
- FIFO algorithm
- Stock lots, ledger, aggregates
- Branch membership requirements
- Stock operations

**`.agent/System/Domain/transfers.md`**
- Stock transfer flow
- Transfer templates
- Reversal logic
- Multi-branch coordination

**`.agent/System/Domain/users.md`**
- User-Tenant-Branch relationships
- User management patterns
- Session handling
- Authentication flow

---

## Feature README Template

For each migrated feature, create a README.md:

```markdown
# {Feature Name}

**Status:** ✅ Completed
**Completion Date:** {date}
**Implementation Period:** {start} - {end}

## Overview
{Brief description of what this feature does}

## Key Changes
- {Major change 1}
- {Major change 2}

## Documentation
- [PRD](./prd.md) - Product requirements and implementation plan
- [Additional docs if any]

## Related Work
- Commits: {git commit hashes}
- Pull Requests: {PR links}

## Testing
- Backend tests: {location}
- Frontend tests: {location}

## Notes
{Any important context, decisions, or lessons learned}
```

---

## Success Criteria

After this restructure is complete:

✅ All existing docs are preserved (content unchanged, just relocated)
✅ 8 agent definitions exist in `.claude/agents/`
✅ 8 agent work log folders exist in `.agent/Agents/`
✅ All major folders have `_index.md` files
✅ Meta documentation provides clear guidelines
✅ Root README reflects new structure
✅ File naming is consistent (kebab-case)
✅ Features are organized by status and date
✅ Domain docs provide focused system knowledge

---

## File Manifest

### Files to Create (42 new files)

**Agent Definitions (7):**
- `.claude/agents/database-expert.md`
- `.claude/agents/backend-api-expert.md`
- `.claude/agents/rbac-security-expert.md`
- `.claude/agents/test-engineer.md`
- `.claude/agents/stock-inventory-expert.md`
- `.claude/agents/integration-orchestrator.md`
- `.claude/agents/debugging-detective.md`

**Agent Portfolios (8):**
- `.agent/Agents/{8 agents}/README.md`

**Index Files (5):**
- `.agent/System/_index.md`
- `.agent/Features/_index.md`
- `.agent/Agents/_index.md`
- `.agent/SOP/_index.md`
- `.agent/Meta/_index.md` (optional)

**Meta Docs (4):**
- `.agent/Meta/agent-handoff-protocol.md`
- `.agent/Meta/agent-output-template.md`
- `.agent/Meta/documentation-guidelines.md`
- `.agent/Meta/archival-policy.md`

**Feature READMEs (4):**
- `.agent/Features/Completed/stock-transfers-v1/README.md`
- `.agent/Features/Completed/stock-transfers-v2/README.md`
- `.agent/Features/Completed/session-expiration/README.md`
- `.agent/Features/Completed/testing-implementation/README.md`

**Domain Docs (4):**
- `.agent/System/Domain/products.md`
- `.agent/System/Domain/stock.md`
- `.agent/System/Domain/transfers.md`
- `.agent/System/Domain/users.md`

**Empty Directories (8):**
- `.agent/Agents/{8 agents}/work/` (with .gitkeep)

**This Plan:**
- `.agent/RESTRUCTURE_PLAN.md`

### Files to Move/Rename (25 files)

**System (4):**
- `System/project_architecture.md` → `System/architecture.md`
- `System/database_schema.md` → `System/database-schema.md`
- `System/rbac_system.md` → `System/rbac-system.md`
- `System/stock_management.md` → `System/stock-management.md`

**SOP (11):**
- All files renamed from snake_case to kebab-case

**Tasks → Features (5):**
- `Tasks/stock_transfers_feature.md` → `Features/Completed/stock-transfers-v1/prd.md`
- `Tasks/stock_transfers_v2_enhancements.md` → `Features/Completed/stock-transfers-v2/prd.md`
- `Tasks/session_expiration_handler.md` → `Features/Completed/session-expiration/prd.md`
- `Tasks/testing_implementation.md` → `Features/Completed/testing-implementation/prd.md`
- `Tasks/e2e-test-fixes-needed.md` → `Features/Completed/testing-implementation/issues.md`

### Files to Update (1)

- `.agent/README.md` (major update)

---

## Post-Restructure Workflow

### Example: Adding a "Suppliers" Feature

**1. Main thread creates feature:**
```bash
mkdir -p .agent/Features/InProgress/suppliers-feature
# Create README.md (status: In Progress)
# Create prd.md (requirements)
```

**2. Main thread spawns database-expert:**
```
Prompt: "Create Supplier model with multi-tenant pattern.
         Read: .agent/System/database-schema.md
         Output to:
           - .agent/Agents/database-expert/work/suppliers-schema-2025-01-15.md
           - .agent/Features/InProgress/suppliers-feature/database-expert.md
         Update: .agent/Agents/database-expert/README.md
         Update: .agent/Features/InProgress/suppliers-feature/README.md (track completion date)"
```

**3. Main thread spawns backend-api-expert:**
```
Prompt: "Create suppliers API routes and service.
         Read: .agent/Features/InProgress/suppliers-feature/database-expert.md
         Output to:
           - .agent/Agents/backend-api-expert/work/suppliers-api-2025-01-15.md
           - .agent/Features/InProgress/suppliers-feature/backend-api-expert.md"
```

**4. Continue with other agents...**

**5. When complete:**
```bash
# Update README.md with completion date
# Move to completed (flat structure by feature name)
mv .agent/Features/InProgress/suppliers-feature \
   .agent/Features/Completed/suppliers-feature

# Update .agent/Features/_index.md
# Completion date is tracked in README.md, not folder structure
```

---

## Timeline

**Estimated Time:** 2-3 hours

- **Step 1:** Create folders (5 min)
- **Step 2:** Migrate files (15 min)
- **Step 3A:** Create agent definitions (45 min)
- **Step 3B:** Create agent portfolios (30 min)
- **Step 3C:** Create output template (10 min)
- **Step 4:** Create index files (30 min)
- **Step 5:** Write meta docs (45 min)
- **Step 6:** Update root README (20 min)
- **Domain docs:** Create domain-specific docs (30 min)

---

## Next Steps After Restructure

1. **Test the workflow:** Try spawning an agent with the new structure
2. **Refine templates:** Adjust based on actual usage
3. **Train main thread:** Update instructions on how to spawn agents
4. **Monitor adoption:** See which agents get used most
5. **Iterate:** Improve based on what works/doesn't work

---

**Last Updated:** 2025-01-15
**Status:** Ready for implementation
