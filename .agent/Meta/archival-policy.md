# Archival Policy

**Purpose:** Establish when and how to archive completed features, clean up agent work logs, and maintain a healthy documentation system.

**Last Updated:** 2025-01-15

---

## Table of Contents

1. [Overview](#overview)
2. [Feature Archival](#feature-archival)
3. [Agent Work Log Retention](#agent-work-log-retention)
4. [Month-Year Organization](#month-year-organization)
5. [Cleanup Procedures](#cleanup-procedures)
6. [Feature README Requirements](#feature-readme-requirements)
7. [Referencing Archived Features](#referencing-archived-features)
8. [Annual Consolidation](#annual-consolidation)
9. [What to Keep vs. Delete](#what-to-keep-vs-delete)
10. [Maintenance Schedule](#maintenance-schedule)

---

## Overview

### Why Archive?

**Benefits:**
- **Clarity**: Distinguish active work from completed features
- **Performance**: Keep working directories clean and fast
- **Organization**: Historical record organized chronologically
- **Searchability**: Find completed features by date
- **Focus**: Reduce noise for active development

**Without Archival:**
- InProgress folder grows indefinitely
- Agent work logs accumulate (100+ files)
- Hard to find relevant information
- Performance degrades
- Documentation becomes overwhelming

### Archival Principles

1. **Archive by Completion**: Move features when truly done
2. **Keep Context**: Preserve all agent outputs and decisions
3. **Organize by Date**: Month-based folders for easy navigation
4. **Clean Agent Logs**: Keep only recent work (last 10)
5. **Never Delete**: Archive, don't delete (unless truly obsolete)

---

## Feature Archival

### When to Archive a Feature

Move feature from `InProgress/` to `Completed/` when:

✅ **Feature is complete:**
- All code merged to main branch
- Tests passing (backend + frontend)
- Documentation updated
- No open blockers
- Stakeholder approval (if applicable)

✅ **Feature is deployed:**
- Deployed to production (or staging if waiting)
- Verified working in target environment
- Monitoring shows no issues

✅ **Follow-up work planned separately:**
- Core feature complete
- Future enhancements tracked as separate features
- Current work fully functional

### When NOT to Archive

❌ **Don't archive if:**
- Feature partially implemented
- Tests failing or incomplete
- Major bugs discovered
- Waiting on dependencies
- Documentation incomplete

❌ **Keep in InProgress if:**
- Actively being worked on
- Blocked but resuming soon
- Multi-phase feature (only one phase done)

### Archival Process

**Step 1: Verify Completion**

```bash
# Check all agent outputs exist
ls .agent/Features/InProgress/{feature-name}/

# Expected files:
# - README.md (with status, completion date, and summary)
# - prd.md (if applicable)
# - database-expert.md (if database changes)
# - backend-api-expert.md (if API changes)
# - frontend-expert.md (if UI changes)
# - rbac-security-expert.md (if permission changes)
# - test-engineer.md (if tests added)
# - integration-orchestrator.md (if integration work)
# - {other agents as needed}
```

**Step 2: Create Feature README**

Create comprehensive README if not exists:

```markdown
# {Feature Name}

**Status:** ✅ Completed
**Completion Date:** 2025-01-15
**Implementation Period:** 2025-01-10 to 2025-01-15

## Overview
{Brief description of what this feature does}

## Agent Contributions

### database-expert
- Created Supplier model with multi-tenant pattern
- Added migration: `20250110_add_suppliers`
- Updated seed data
- [Full Output](./database-expert.md)

### rbac-security-expert
- Added permissions: `suppliers:read`, `suppliers:write`
- Updated OWNER, ADMIN, EDITOR roles
- [Full Output](./rbac-security-expert.md)

### backend-api-expert
- Created SupplierService with CRUD operations
- Added 5 API endpoints
- Defined OpenAPI schemas
- [Full Output](./backend-api-expert.md)

### frontend-expert
- Created SuppliersPage with data table
- Built SupplierForm component
- Added routing with permission guards
- [Full Output](./frontend-expert.md)

### test-engineer
- Added 15 backend tests (Jest)
- Added 12 E2E tests (Playwright)
- Verified all roles
- [Full Output](./test-engineer.md)

### integration-orchestrator
- Verified type generation
- Updated system docs
- Created deployment checklist
- [Full Output](./integration-orchestrator.md)

## Key Decisions

### Decision 1: Multi-Tenant Supplier Scope
- **What**: Suppliers are tenant-scoped (not shared across tenants)
- **Why**: Each tenant may have different supplier relationships and terms
- **Alternative**: Global suppliers with tenant-specific associations (rejected for complexity)

### Decision 2: Soft Delete Pattern
- **What**: Suppliers use `deletedAt` timestamp instead of hard delete
- **Why**: Preserve historical purchase order references
- **Alternative**: Hard delete with CASCADE (rejected for data loss risk)

## Implementation Details

**Database:**
- Tables: `Supplier`
- Indexes: `tenantId`, `deletedAt`, compound `(tenantId, name)`
- Migration: `20250110_add_suppliers.sql`

**API:**
- `GET /api/suppliers` - List suppliers
- `GET /api/suppliers/:id` - Get supplier
- `POST /api/suppliers` - Create supplier
- `PUT /api/suppliers/:id` - Update supplier
- `DELETE /api/suppliers/:id` - Soft delete supplier

**Frontend:**
- Route: `/:tenantSlug/suppliers`
- Components: `SuppliersPage`, `SupplierForm`, `SupplierTable`
- Permission guards: `suppliers:read`, `suppliers:write`

## Testing

**Backend (15 tests):**
- Location: `api-server/src/__tests__/acceptance/suppliers.test.ts`
- Coverage: CRUD operations, permissions, multi-tenant isolation, soft delete

**Frontend (12 tests):**
- Location: `admin-web/src/__tests__/acceptance/suppliers.spec.ts`
- Coverage: Page rendering, form validation, permission-based UI, role checks

**Test Results:** ✅ All passing (227 backend + 84 frontend total)

## Related Work

**Commits:**
- `a1b2c3d` - Add Supplier database model
- `e4f5g6h` - Create suppliers API
- `i7j8k9l` - Build suppliers UI
- `m0n1o2p` - Add suppliers tests

**Pull Requests:**
- #123 - Suppliers Feature Implementation

## Deployment Notes

**Environment Variables:** None required

**Database Migrations:**
```bash
npm run db:deploy  # Apply 20250110_add_suppliers
```

**RBAC Seeding:**
```bash
npm run seed:rbac  # Add suppliers permissions
```

**Type Generation:**
```bash
cd admin-web
npm run openapi:gen  # Regenerate after API restart
```

## Notes

**Lessons Learned:**
- Soft delete pattern works well for entities referenced by other tables
- Permission naming convention: `{resource}:{action}` keeps things consistent
- E2E tests for all roles (OWNER, ADMIN, EDITOR, VIEWER) catches permission bugs early

**Future Enhancements:**
- Supplier contact management (phone, email)
- Supplier performance metrics
- Integration with purchase orders (planned separately)

**Known Limitations:**
- No supplier search (list only)
- No supplier import/export
- No supplier categories

---

**Last Updated:** 2025-01-15
```

**Step 3: Move Feature Folder**

```bash
# Move entire feature folder (flat structure by feature name)
mv .agent/Features/InProgress/{feature-name} \
   .agent/Features/Completed/{feature-name}

# Verify move
ls .agent/Features/Completed/{feature-name}/

# Note: Completion date is stored in README.md, not in folder structure
# This makes it easier to find features by name: "Did we do Suppliers?" → look for "suppliers" folder
```

**Step 4: Update Feature Index**

Edit `.agent/Features/_index.md`:

```markdown
## Completed Features

Organized alphabetically by feature name. Completion dates are tracked in each feature's README.md.

- **[Suppliers Feature](./Completed/suppliers-feature/README.md)** - Supplier management with CRUD operations
  - Completion Date: 2025-01-15
  - Agents: database-expert, rbac-security-expert, backend-api-expert, frontend-expert, test-engineer, integration-orchestrator

- **[Session Expiration](./Completed/session-expiration/README.md)** - Session expiration handler
  - Completion Date: 2025-01-12
  - Agents: frontend-expert, test-engineer

- **[Stock Transfers v1](./Completed/stock-transfers-v1/README.md)** - Base stock transfer functionality
  - Completion Date: 2025-01-10
  - Agents: database-expert, backend-api-expert, test-engineer

...

## In Progress

{Remove archived feature from this section}
```

**Why feature-name organization?**
- Easier to find: "Did we do Suppliers?" → look for "suppliers-feature" folder alphabetically
- More intuitive for human navigation than date-based folders
- Completion dates still preserved in README.md metadata
- Simpler folder structure (no nested date folders)

**Step 5: Clean Up Agent Work Logs** (See next section)

---

## Agent Work Log Retention

### Retention Policy

**Keep Last 10 Work Logs** in each agent's `/work/` folder.

**Why 10?**
- Enough history for recent context
- Not too many to overwhelm
- Balances performance and utility

### When to Clean Agent Logs

✅ **Clean agent logs when:**
- Feature archived to Completed/
- Agent has > 10 work logs
- Monthly cleanup (see schedule)

### Cleanup Process

**Step 1: Count Work Logs**

```bash
# Count files in agent's work folder
ls -1 .agent/Agents/{agent-name}/work/ | wc -l

# Example:
ls -1 .agent/Agents/database-expert/work/ | wc -l
# Output: 14
```

**Step 2: Identify Oldest Files**

```bash
# List files by date (oldest first)
ls -lt .agent/Agents/{agent-name}/work/ | tail -n 5

# Example (oldest 5):
# suppliers-schema-2024-12-15.md
# transfers-migration-2024-12-18.md
# products-index-2024-12-20.md
# branches-schema-2024-12-22.md
# users-migration-2024-12-28.md
```

**Step 3: Archive Old Work Logs**

Two strategies: **Move to Feature** or **Delete**

**Strategy A: Move to Feature Folder (Recommended)**

If work log belongs to a completed feature:

```bash
# Move to feature folder
mv .agent/Agents/database-expert/work/suppliers-schema-2024-12-15.md \
   .agent/Features/Completed/2024-12/suppliers-feature/database-expert-extra.md

# Or append to existing agent output in feature folder
cat .agent/Agents/database-expert/work/suppliers-schema-2024-12-15.md \
    >> .agent/Features/Completed/2024-12/suppliers-feature/database-expert.md
```

**Strategy B: Delete (If Truly Redundant)**

If work log is redundant (already captured in feature folder):

```bash
# Delete old work log
rm .agent/Agents/database-expert/work/suppliers-schema-2024-12-15.md
```

**Step 4: Update Agent Portfolio README**

Edit `.agent/Agents/{agent-name}/README.md`:

```markdown
## Recent Work (Last 10)

- [2025-01-15] [Suppliers Schema](./work/suppliers-schema-2025-01-15.md) - Created Supplier model
- [2025-01-14] [Transfers Migration](./work/transfers-migration-2025-01-14.md) - Added StockTransfer tables
- [2025-01-12] [Products Index](./work/products-index-2025-01-12.md) - Added compound index
...
{Keep only 10 most recent}

## Archived Work

See completed features in `.agent/Features/Completed/` for older work logs.
```

### Automated Cleanup Script

**Create:** `.agent/scripts/cleanup-agent-logs.sh`

```bash
#!/bin/bash

# Cleanup old agent work logs (keep last 10 per agent)

AGENT_DIR=".agent/Agents"
KEEP_COUNT=10

for agent in database-expert backend-api-expert frontend-expert rbac-security-expert test-engineer stock-inventory-expert integration-orchestrator debugging-detective; do
  WORK_DIR="${AGENT_DIR}/${agent}/work"

  if [ -d "$WORK_DIR" ]; then
    FILE_COUNT=$(ls -1 "$WORK_DIR" | wc -l)

    if [ "$FILE_COUNT" -gt "$KEEP_COUNT" ]; then
      echo "Agent: $agent has $FILE_COUNT files (cleaning up...)"

      # Get oldest files (beyond KEEP_COUNT)
      REMOVE_COUNT=$((FILE_COUNT - KEEP_COUNT))
      ls -t "$WORK_DIR" | tail -n "$REMOVE_COUNT" | while read file; do
        echo "  Archiving: $file"
        # Move to archive or delete
        # rm "$WORK_DIR/$file"  # Uncomment to delete
      done
    else
      echo "Agent: $agent has $FILE_COUNT files (OK)"
    fi
  fi
done
```

**Usage:**

```bash
cd .agent
chmod +x scripts/cleanup-agent-logs.sh
./scripts/cleanup-agent-logs.sh
```

---

## Feature Organization Strategy

### Flat Feature-Name Structure

**Current Approach:** Features organized alphabetically by feature name (not by date)

```
.agent/Features/Completed/
├── purchase-orders/
│   ├── README.md (contains: Completion Date: 2025-02-05)
│   └── prd.md
├── session-expiration/
│   ├── README.md (contains: Completion Date: 2025-01-12)
│   └── prd.md
├── stock-transfers-v1/
│   ├── README.md (contains: Completion Date: 2025-01-10)
│   └── prd.md
├── stock-transfers-v2/
│   ├── README.md (contains: Completion Date: 2025-01-14)
│   └── prd.md
├── suppliers-feature/
│   ├── README.md (contains: Completion Date: 2025-01-15)
│   └── prd.md
└── testing-implementation/
    ├── README.md (contains: Completion Date: 2025-01-13)
    └── prd.md
```

### Why Feature-Name Organization?

**Rationale:**
1. **Easier Discovery:** "Did we do Suppliers?" → look for "suppliers" folder alphabetically
2. **Human-Friendly:** Developers think in features, not dates
3. **Simpler Navigation:** No nested date folders to navigate through
4. **Preserved Metadata:** Completion dates tracked in each README.md
5. **Better Searchability:** Find features by name using standard file search tools

**Date Information Still Available:**
- Every feature README.md contains "Completion Date" field
- Can filter/sort by date in index file
- Git history provides precise timeline
- No loss of temporal information

**Alternative Considered (Date-Based):**
- Old approach: `Completed/2025-01/suppliers-feature/`
- Problem: Harder to find specific features without knowing completion date
- Problem: More nesting = more navigation complexity
- Problem: Human mental model is "what features exist?" not "what shipped in January?"

### Archival Procedure

**When archiving:**

```bash
# Simply move from InProgress to Completed (no date folders)
mv .agent/Features/InProgress/{feature-name} \
   .agent/Features/Completed/{feature-name}

# Ensure README.md contains completion date
# Example:
# **Completion Date:** 2025-01-15
```

**No month folders needed:**
- Features sort alphabetically by name
- Dates tracked in README.md metadata
- Index file can organize by date if needed

---

## Cleanup Procedures

### Weekly Cleanup

**Tasks:**
- Review InProgress features (any ready to archive?)
- Check agent work log counts (any > 10?)
- Update feature READMEs (status, completion date)

**Checklist:**

```markdown
- [ ] Review `.agent/Features/InProgress/` for completed features
- [ ] Count work logs: `ls -1 .agent/Agents/*/work/ | wc -l`
- [ ] Update feature statuses in README files
- [ ] Verify all agent outputs exist for in-progress features
```

### Monthly Cleanup

**Tasks:**
- Archive all completed features from InProgress/
- Clean up agent work logs (keep last 10)
- Update `.agent/Features/_index.md`
- Verify folder structure

**Checklist:**

```markdown
- [ ] Archive completed features to `Completed/YYYY-MM/`
- [ ] Create feature READMEs for archived features
- [ ] Clean agent work logs (run cleanup script)
- [ ] Update `.agent/Features/_index.md` with new completed features
- [ ] Verify month folders organized correctly
- [ ] Check for orphaned files
- [ ] Update agent portfolio READMEs
```

### Quarterly Cleanup

**Tasks:**
- Review archived features (any to consolidate?)
- Check documentation accuracy
- Update system docs based on completed features
- Clean up obsolete docs

**Checklist:**

```markdown
- [ ] Review last 3 months of completed features
- [ ] Update system docs based on architectural changes
- [ ] Consolidate similar features if applicable
- [ ] Remove truly obsolete documentation
- [ ] Verify cross-references still valid
- [ ] Update README statistics (file counts, feature counts)
```

### Annual Cleanup

**Tasks:**
- Consolidate old months into year folder
- Archive very old features
- Major documentation review
- Prune unnecessary files

**Checklist:**

```markdown
- [ ] Consolidate old months (see Annual Consolidation section)
- [ ] Archive features older than 1 year
- [ ] Review and update all system docs
- [ ] Remove obsolete SOPs
- [ ] Update architecture docs for major changes
- [ ] Verify all links and references
- [ ] Update master README
```

---

## Feature README Requirements

### Mandatory Sections

Before archiving, feature README **MUST** include:

✅ **Header:**
- Feature name
- Status (✅ Completed)
- Completion date
- Implementation period

✅ **Overview:**
- Brief description (1-2 paragraphs)
- What problem it solves

✅ **Agent Contributions:**
- List all agents who worked on feature
- Key contributions from each
- Links to agent outputs

✅ **Key Decisions:**
- Important technical decisions
- Rationale and alternatives

✅ **Testing:**
- Test coverage
- Test locations

✅ **Related Work:**
- Commit hashes
- PR links (if applicable)

### Optional Sections

Include if applicable:

- **Implementation Details**: Technical deep-dive
- **Deployment Notes**: Environment vars, migrations
- **Lessons Learned**: What went well, what didn't
- **Known Limitations**: What's not included
- **Future Enhancements**: What's planned next

### README Template

See [Feature README Requirements](#feature-readme-requirements) in Feature Archival section for full template.

### Quality Check

Before archiving, verify:

```markdown
- [ ] README exists
- [ ] All mandatory sections present
- [ ] Agent outputs linked
- [ ] Completion date accurate
- [ ] Testing info included
- [ ] Commits/PRs referenced
- [ ] "Last Updated" date present
```

---

## Referencing Archived Features

### How to Reference

**Internal References (from other docs):**

```markdown
For supplier management implementation, see [Suppliers Feature](../Features/Completed/2025-01/suppliers-feature/README.md).

The stock transfer pattern is documented in [Stock Transfers V1](../Features/Completed/2025-01/stock-transfers-v1/README.md).
```

**From Code Comments:**

```typescript
/**
 * Soft delete pattern for Suppliers.
 * See: .agent/Features/Completed/2025-01/suppliers-feature/README.md
 * Decision: Use deletedAt timestamp to preserve historical references.
 */
```

**From Agent Outputs:**

```markdown
## Context

### Related Documentation
- `.agent/Features/Completed/2025-01/suppliers-feature/database-expert.md` - Similar multi-tenant pattern
- `.agent/System/database-schema.md` - Schema conventions
```

### Finding Archived Features

**By Name (Primary Method):**

```bash
# List all completed features alphabetically
ls .agent/Features/Completed/

# Output (sorted alphabetically):
# purchase-orders/
# session-expiration/
# stock-transfers-v1/
# stock-transfers-v2/
# suppliers-feature/
# testing-implementation/

# Find feature by name (fuzzy search)
find .agent/Features/Completed -name "*suppliers*" -type d

# Output: .agent/Features/Completed/suppliers-feature
```

**By Date (via README or Index):**

```bash
# Search for features completed in January 2025
grep -r "Completion Date: 2025-01" .agent/Features/Completed/*/README.md

# Or check the index file which organizes by date
cat .agent/Features/_index.md
```

**By Agent:**

```bash
# Find all features where database-expert worked
find .agent/Features/Completed -name "database-expert.md"

# Or search for specific agent contributions
grep -r "database-expert" .agent/Features/Completed/*/README.md
```

**By Content:**

```bash
# Search for keyword in completed features
grep -r "FIFO" .agent/Features/Completed/

# Or use ripgrep
rg "FIFO" .agent/Features/Completed/
```

### Feature Index

Use `.agent/Features/_index.md` as primary navigation (organized by date for temporal context):

```markdown
## Completed Features

Organized alphabetically by feature name in Completed/ folder. Listed here by completion date:

### January 2025

- **[Stock Transfers v1](./Completed/stock-transfers-v1/README.md)** - 2025-01-10
  - Description: Base stock transfer functionality
  - Agents: 3 (database, backend, test)

- **[Session Expiration](./Completed/session-expiration/README.md)** - 2025-01-12
  - Description: Graceful session expiration handling
  - Agents: 2 (frontend, test)

- **[Testing Implementation](./Completed/testing-implementation/README.md)** - 2025-01-13
  - Description: Comprehensive testing infrastructure (299 tests)
  - Agents: 1 (test-engineer)

- **[Stock Transfers v2](./Completed/stock-transfers-v2/README.md)** - 2025-01-14
  - Description: Templates, barcode scanning, reversals
  - Agents: 7 (all agents)

- **[Suppliers Feature](./Completed/suppliers-feature/README.md)** - 2025-01-15
  - Description: Supplier management with CRUD operations
  - Agents: 6 (database, rbac, backend, frontend, test, integration)

### February 2025

- **[Purchase Orders](./Completed/purchase-orders/README.md)** - 2025-02-05
  - Description: Purchase order management
  - Agents: 6 (database, rbac, backend, frontend, test, integration)

...
```

---

## Long-Term Archival Strategy

### When to Consider Archival

**Note:** With flat feature-name organization, long-term archival is less critical since:
- All features already in one flat directory
- Easy to search and navigate
- No performance degradation from flat structure (even with 100+ features)

**Optional archival triggers:**
- More than 100 completed features (unlikely for most projects)
- Need to separate "historical" from "recent" features
- Compliance/audit requirements for old features

### Optional Consolidation (if needed)

**Only if Completed/ folder becomes very large (100+ features), consider:**

**Option: Year-Based Subfolders**

```
Before:
Completed/
├── feature-a/ (2024-03-15)
├── feature-b/ (2024-05-20)
├── feature-c/ (2024-11-10)
├── feature-d/ (2025-01-05)
├── feature-e/ (2025-02-12)
└── ... (50+ more features)

After:
Completed/
├── 2024/
│   ├── feature-a/
│   ├── feature-b/
│   └── feature-c/
└── 2025/
    ├── feature-d/
    └── feature-e/
```

**Commands (if choosing to consolidate by year):**

```bash
# Extract completion year from each feature's README.md
# Move features to year-based subfolders
# This is optional and only recommended for very large projects

# Example:
mkdir -p .agent/Features/Completed/2024
mv .agent/Features/Completed/feature-from-2024/ \
   .agent/Features/Completed/2024/
```

**Recommendation:** Keep flat structure unless project has 100+ features. Flat is simpler.

### Update References (if consolidated)

If you choose year-based consolidation:

**Before:**
```markdown
[Feature](./Completed/feature-name/README.md)
```

**After:**
```markdown
[Feature](./Completed/2024/feature-name/README.md)
```

### Archive Index

`.agent/Features/_index.md` always shows features by completion date regardless of folder structure:

```markdown
## Completed Features (Alphabetical in Folder, Chronological in Index)

### 2025

- **[Feature E](./Completed/feature-e/README.md)** - 2025-02-12
- **[Feature D](./Completed/feature-d/README.md)** - 2025-01-05

### 2024

- **[Feature C](./Completed/feature-c/README.md)** - 2024-11-10
- **[Feature B](./Completed/feature-b/README.md)** - 2024-05-20
- **[Feature A](./Completed/feature-a/README.md)** - 2024-03-15

**Total:** 5 completed features
```

---

## What to Keep vs. Delete

### Always Keep

✅ **Never delete:**
- Completed feature folders (entire directory)
- Agent outputs for completed features
- Feature READMEs
- PRDs and implementation plans
- System documentation
- SOP documentation
- Agent definition files
- Agent portfolio READMEs

### Safe to Delete

✅ **Can delete:**
- Agent work logs beyond last 10 (after archiving to feature)
- Obsolete documentation (if truly obsolete)
- Redundant files (exact duplicates)
- Temporary files (.tmp, .bak)
- Empty folders

### Archive Instead of Delete

✅ **Archive rather than delete:**
- Old feature docs (even if superseded)
- Outdated SOPs (mark as ARCHIVED)
- Previous versions of system docs
- Historical agent outputs

### Obsolete Documentation

**How to handle:**

1. **Mark as Archived:**

```markdown
# [ARCHIVED] Old Authentication Flow

> **This document is archived as of 2025-01-15.**
>
> Superseded by: [Current Authentication](./authentication.md)
>
> Kept for historical reference only.

---

{... old content ...}
```

2. **Move to Archive Folder:**

```bash
mkdir -p .agent/Archive/2025-01
mv .agent/System/old-auth.md .agent/Archive/2025-01/
```

3. **Update References:**

Remove links from active docs, add to archive index.

---

## Maintenance Schedule

### Daily (As You Work)

```markdown
- [ ] Save agent outputs to both locations
- [ ] Update agent portfolio READMEs (recent work)
- [ ] Update feature READMEs (in progress)
```

### Weekly

```markdown
- [ ] Review InProgress features (ready to archive?)
- [ ] Count agent work logs (any > 10?)
- [ ] Update feature statuses
- [ ] Quick link check
```

**Time:** ~15 minutes

### Monthly

```markdown
- [ ] Archive completed features
- [ ] Clean agent work logs (keep last 10)
- [ ] Update `.agent/Features/_index.md`
- [ ] Verify folder structure
- [ ] Update system docs based on completed work
```

**Time:** ~1 hour

### Quarterly

```markdown
- [ ] Review last 3 months of features
- [ ] Update system documentation
- [ ] Consolidate similar features
- [ ] Remove obsolete docs
- [ ] Verify all cross-references
- [ ] Update statistics in master README
```

**Time:** ~2-3 hours

### Annually

```markdown
- [ ] Consolidate old year into year folder
- [ ] Archive features > 1 year old
- [ ] Major documentation review
- [ ] Update architecture docs
- [ ] Clean up obsolete files
- [ ] Verify link integrity across all docs
- [ ] Update master README with yearly stats
```

**Time:** ~4-6 hours

---

## Automation Scripts

### Script 1: Archive Feature

**File:** `.agent/scripts/archive-feature.sh`

```bash
#!/bin/bash

# Usage: ./archive-feature.sh feature-name

FEATURE_NAME=$1

if [ -z "$FEATURE_NAME" ]; then
  echo "Usage: ./archive-feature.sh feature-name"
  exit 1
fi

SOURCE_DIR=".agent/Features/InProgress/${FEATURE_NAME}"

if [ ! -d "$SOURCE_DIR" ]; then
  echo "Error: Feature not found in InProgress: $FEATURE_NAME"
  exit 1
fi

# Get current year-month
YEAR_MONTH=$(date +%Y-%m)
TARGET_DIR=".agent/Features/Completed/${YEAR_MONTH}"

# Create target directory
mkdir -p "$TARGET_DIR"

# Move feature
mv "$SOURCE_DIR" "$TARGET_DIR/"

echo "✅ Archived: $FEATURE_NAME → $TARGET_DIR/$FEATURE_NAME"
echo ""
echo "Next steps:"
echo "1. Verify README.md exists and is complete"
echo "2. Update .agent/Features/_index.md"
echo "3. Clean up agent work logs (./cleanup-agent-logs.sh)"
```

### Script 2: Clean Agent Logs

**File:** `.agent/scripts/cleanup-agent-logs.sh`

```bash
#!/bin/bash

# Keep last 10 work logs per agent

AGENT_DIR=".agent/Agents"
KEEP_COUNT=10

for agent in database-expert backend-api-expert frontend-expert rbac-security-expert test-engineer stock-inventory-expert integration-orchestrator debugging-detective; do
  WORK_DIR="${AGENT_DIR}/${agent}/work"

  if [ ! -d "$WORK_DIR" ]; then
    echo "⚠️  Agent work dir not found: $agent"
    continue
  fi

  FILE_COUNT=$(ls -1 "$WORK_DIR" 2>/dev/null | wc -l)

  if [ "$FILE_COUNT" -le "$KEEP_COUNT" ]; then
    echo "✅ $agent: $FILE_COUNT files (OK)"
    continue
  fi

  echo "🗑️  $agent: $FILE_COUNT files → cleaning up..."

  # Get oldest files
  REMOVE_COUNT=$((FILE_COUNT - KEEP_COUNT))
  ls -t "$WORK_DIR" | tail -n "$REMOVE_COUNT" | while read file; do
    echo "   Removing: $file"
    rm "$WORK_DIR/$file"
  done

  NEW_COUNT=$(ls -1 "$WORK_DIR" 2>/dev/null | wc -l)
  echo "   ✅ Now: $NEW_COUNT files"
done

echo ""
echo "✅ Cleanup complete!"
```

### Script 3: Feature Completion Checklist

**File:** `.agent/scripts/check-feature-ready.sh`

```bash
#!/bin/bash

# Check if feature is ready to archive

FEATURE_NAME=$1

if [ -z "$FEATURE_NAME" ]; then
  echo "Usage: ./check-feature-ready.sh feature-name"
  exit 1
fi

FEATURE_DIR=".agent/Features/InProgress/${FEATURE_NAME}"

if [ ! -d "$FEATURE_DIR" ]; then
  echo "❌ Feature not found: $FEATURE_NAME"
  exit 1
fi

echo "Checking feature: $FEATURE_NAME"
echo ""

# Check README
if [ -f "$FEATURE_DIR/README.md" ]; then
  echo "✅ README.md exists"

  # Check for completion date
  if grep -q "Completion Date:" "$FEATURE_DIR/README.md"; then
    echo "✅ Completion date present"
  else
    echo "❌ Missing completion date in README"
  fi
else
  echo "❌ README.md missing"
fi

# Check for agent outputs
for agent in database-expert backend-api-expert frontend-expert rbac-security-expert test-engineer; do
  if [ -f "$FEATURE_DIR/${agent}.md" ]; then
    echo "✅ $agent.md exists"
  fi
done

echo ""
echo "Manual checks:"
echo "- [ ] All tests passing?"
echo "- [ ] Code merged to main?"
echo "- [ ] Feature deployed?"
echo "- [ ] Documentation updated?"
echo ""
echo "If all checks pass, run: ./archive-feature.sh $FEATURE_NAME"
```

### Making Scripts Executable

```bash
cd .agent/scripts
chmod +x archive-feature.sh
chmod +x cleanup-agent-logs.sh
chmod +x check-feature-ready.sh
```

---

## Troubleshooting

### Issue: Can't find archived feature

**Solution:**

```bash
# Search by name
find .agent/Features/Completed -name "*{keyword}*" -type d

# Search by content
rg "{keyword}" .agent/Features/Completed/

# Check feature index
cat .agent/Features/_index.md
```

### Issue: Agent work logs growing too large

**Solution:**

```bash
# Run cleanup script
.agent/scripts/cleanup-agent-logs.sh

# Or manually:
cd .agent/Agents/{agent-name}/work
ls -lt | tail -n +11 | awk '{print $9}' | xargs rm
```

### Issue: Feature in wrong month folder

**Solution:**

```bash
# Move to correct month
mv .agent/Features/Completed/2025-01/feature-name \
   .agent/Features/Completed/2025-02/feature-name

# Update feature index
```

### Issue: Broken links after archival

**Solution:**

```bash
# Find broken links
find .agent -name "*.md" -exec grep -l "Features/InProgress/{feature}" {} +

# Update references to Completed/YYYY-MM/{feature}
```

### Issue: Feature README incomplete

**Solution:**

1. Review agent outputs in feature folder
2. Summarize key contributions
3. Use template from this doc
4. Commit complete README before archiving

---

## Summary

**Quick Reference:**

**Archive Feature:**
1. Verify completion (tests pass, code merged)
2. Create/verify feature README (all sections present)
3. Move to `Completed/YYYY-MM/`
4. Update `.agent/Features/_index.md`
5. Clean agent work logs

**Clean Agent Logs:**
1. Count files in `/work/` folder
2. Keep last 10 (most recent)
3. Archive or delete older files
4. Update agent portfolio README

**Monthly Tasks:**
- Archive completed features
- Clean agent work logs
- Update feature index

**Annual Tasks:**
- Consolidate year into folder
- Major documentation review

**Never Delete:**
- Completed feature folders
- Agent outputs for features
- System documentation
- Agent definitions

---

**Last Updated:** 2025-01-15
**Related Documents:**
- [Agent Handoff Protocol](./agent-handoff-protocol.md)
- [Documentation Guidelines](./documentation-guidelines.md)
- [Agent Output Template](./agent-output-template.md)
