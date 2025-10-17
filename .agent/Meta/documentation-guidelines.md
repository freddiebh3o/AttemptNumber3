# Documentation Guidelines

**Purpose:** Establish writing standards, formatting conventions, and maintenance practices for all `.agent/` documentation.

**Last Updated:** 2025-01-15

---

## Table of Contents

1. [Overview](#overview)
2. [Documentation Principles](#documentation-principles)
3. [File Organization](#file-organization)
4. [Markdown Formatting Standards](#markdown-formatting-standards)
5. [Writing Style](#writing-style)
6. [File Naming Conventions](#file-naming-conventions)
7. [When to Update vs. Create](#when-to-update-vs-create)
8. [Keeping Documentation Current](#keeping-documentation-current)
9. [Cross-Referencing](#cross-referencing)
10. [Documentation Maintenance](#documentation-maintenance)
11. [Version Control](#version-control)
12. [Documentation Types](#documentation-types)
13. [Quality Standards](#quality-standards)

---

## Overview

### What is .agent Documentation?

The `.agent/` directory contains:
- **System Docs**: Current state of the system (architecture, database, RBAC, domains)
- **SOP Docs**: Standard operating procedures for common tasks
- **Feature Docs**: Historical record of feature development
- **Agent Docs**: Outputs from specialized sub-agents
- **Meta Docs**: Documentation about documentation (this file)

### Why Documentation Standards Matter

✅ **Good documentation:**
- Is easy to find and navigate
- Is accurate and up-to-date
- Is consistent in format and style
- Helps developers work faster
- Preserves institutional knowledge

❌ **Bad documentation:**
- Is hard to find or outdated
- Contradicts itself or the codebase
- Is inconsistent or poorly organized
- Wastes developers' time
- Creates confusion and errors

---

## Documentation Principles

### 1. Accuracy Over Volume

**Principle:** Outdated docs are worse than no docs.

✅ **Do:**
- Update docs when code changes
- Remove obsolete information
- Mark deprecated features clearly
- Test examples before documenting

❌ **Don't:**
- Leave outdated information
- Document features that don't exist
- Keep documentation "just in case"
- Skip verification of examples

**Example:**
```markdown
✅ Good:
## Current Authentication (as of 2025-01-15)
Uses JWT cookies with HttpOnly flag. Cookie name: `mt_session`.

❌ Bad:
## Authentication
We use JWT tokens (or maybe session cookies? Check the code).
```

### 2. Conciseness Over Completeness

**Principle:** Link to other docs instead of duplicating.

✅ **Do:**
- Write focused documents
- Link to related docs
- Summarize and reference
- Keep docs scannable

❌ **Don't:**
- Copy/paste between docs
- Write "everything about X" docs
- Repeat information
- Create circular references

**Example:**
```markdown
✅ Good:
For RBAC implementation details, see [RBAC System Design](../System/rbac-system.md).

❌ Bad:
[50 lines explaining RBAC that duplicates rbac-system.md]
```

### 3. Practicality Over Theory

**Principle:** Show how, not just what.

✅ **Do:**
- Include code examples
- Show command outputs
- Provide step-by-step guides
- Document gotchas and edge cases

❌ **Don't:**
- Write abstract descriptions
- Skip examples
- Ignore common pitfalls
- Use vague language

**Example:**
```markdown
✅ Good:
To create a migration:
```bash
cd api-server
npm run db:migrate -- --name add_suppliers
```

This creates a new file in `prisma/migrations/` with timestamp prefix.

❌ Bad:
Migrations can be created using Prisma CLI.
```

### 4. Organization Over Chronology

**Principle:** Organize by topic, not by when written.

✅ **Do:**
- Group related information
- Use clear hierarchies
- Create index files
- Use descriptive headers

❌ **Don't:**
- Dump information chronologically
- Mix unrelated topics
- Use deep nesting (max 3 levels)
- Write stream-of-consciousness

**Example:**
```markdown
✅ Good:
## Database Changes
### Schema Updates
### Migration Files
### Seed Data

❌ Bad:
## Changes Made
First I updated the schema, then I created a migration,
but before that I updated the seed file because...
```

### 5. Maintainability Over Perfection

**Principle:** Good enough today beats perfect never.

✅ **Do:**
- Write iteratively
- Update as you learn
- Mark TODOs for later
- Accept "good enough"

❌ **Don't:**
- Wait for "perfect" docs
- Let perfect be enemy of good
- Skip docs because "not ready"
- Over-engineer structure

---

## File Organization

### Directory Structure

```
.agent/
├── README.md                          # Master index (start here)
├── System/                            # Current state docs
│   ├── _index.md                     # System docs index
│   ├── architecture.md               # High-level architecture
│   ├── database-schema.md            # Database reference
│   ├── rbac-system.md                # RBAC implementation
│   ├── stock-management.md           # Inventory system
│   └── Domain/                       # Domain-specific knowledge
│       ├── products.md
│       ├── stock.md
│       ├── transfers.md
│       └── users.md
├── SOP/                              # Standard procedures
│   ├── _index.md                     # SOP index
│   ├── adding-new-feature.md
│   ├── debugging-guide.md
│   └── testing-*.md
├── Features/                         # Feature work history
│   ├── _index.md                     # Features index
│   ├── InProgress/                   # Active development
│   ├── Completed/YYYY-MM/            # Archived by month
│   └── Planned/                      # Backlog
├── Agents/                           # Agent work logs
│   ├── _index.md                     # Agent registry
│   └── {agent-name}/
│       ├── README.md                 # Agent portfolio
│       └── work/                     # Recent outputs (last 10)
└── Meta/                             # Documentation guides
    ├── agent-handoff-protocol.md
    ├── agent-output-template.md
    ├── documentation-guidelines.md   # This file
    └── archival-policy.md
```

### File Placement Rules

**System Docs (`/System/`):**
- Document CURRENT state only
- Update when system changes
- High-level architecture and design
- Domain-specific subdirectory for focused knowledge

**SOP Docs (`/SOP/`):**
- Step-by-step procedures
- "How to do X" guides
- Common troubleshooting
- Best practices

**Feature Docs (`/Features/`):**
- Historical record of features
- Organized by status and date
- Each feature has its own folder
- Move to `/Completed/` when done

**Agent Docs (`/Agents/`):**
- Outputs from specialized agents
- Organized by agent type
- Work logs in `/work/` subfolder
- Portfolio README for each agent

**Meta Docs (`/Meta/`):**
- Documentation about documentation
- Templates and standards
- Guidelines and policies
- Rarely change

### Index Files

Every major folder should have an `_index.md`:

**Purpose:**
- Quick overview of folder contents
- Navigation aid
- "Start here" guidance

**Naming:**
- Use `_index.md` (underscore prefix)
- Sorts to top in file listings

**Required Sections:**
```markdown
# {Folder Name} Index

## Overview
{What this folder contains}

## Contents
{List of files with descriptions}

## Quick Reference
{Common use cases and which file to read}

## Navigation
{Links to related folders}
```

---

## Markdown Formatting Standards

### Headers

**Use ATX-style headers (# prefix):**

```markdown
✅ Good:
# Level 1 Header
## Level 2 Header
### Level 3 Header

❌ Bad:
Level 1 Header
===============

Level 2 Header
---------------
```

**Header Hierarchy Rules:**
- H1 (`#`): Document title only (one per file)
- H2 (`##`): Major sections
- H3 (`###`): Subsections
- H4 (`####`): Rare, only if needed
- Never skip levels (H1 → H3 without H2)

**Header Content:**
- Use Title Case for H1
- Use Sentence case for H2-H4
- Be specific: "Adding Database Tables" not "Database"
- Keep concise: aim for < 8 words

### Code Blocks

**Always specify language:**

```markdown
✅ Good:
```typescript
interface User {
  id: string;
  email: string;
}
```

❌ Bad:
```
interface User {
  id: string;
  email: string;
}
```
```

**Common Languages:**
- `typescript` / `ts` - TypeScript code
- `javascript` / `js` - JavaScript code
- `bash` / `sh` - Shell commands
- `sql` - SQL queries
- `json` - JSON data
- `markdown` / `md` - Markdown examples
- `prisma` - Prisma schema

**Inline Code:**
- Use backticks for: `code`, `filenames`, `commands`, `variables`
- Example: The `USER_ID` constant is defined in `api-server/src/constants.ts`

### Lists

**Unordered Lists:**

```markdown
✅ Good:
- Item 1
- Item 2
  - Nested item 2.1
  - Nested item 2.2
- Item 3

❌ Bad:
* Item 1
+ Item 2
- Item 3
```

**Use `-` consistently, not `*` or `+`**

**Ordered Lists:**

```markdown
✅ Good:
1. First step
2. Second step
3. Third step

Also acceptable (auto-numbering):
1. First step
1. Second step
1. Third step
```

**Task Lists:**

```markdown
✅ Good:
- [ ] TODO item
- [x] Completed item
- [ ] Another TODO
```

**List Spacing:**
- No blank lines between simple items
- Blank lines between complex items (multi-line)

### Links

**Internal Links (within .agent/):**

```markdown
✅ Good:
See [Database Schema](../System/database-schema.md) for details.
See [RBAC System](../System/rbac-system.md#permission-catalog) for permissions.

❌ Bad:
See Database Schema (link missing)
See [here](../System/database-schema.md) (vague link text)
```

**External Links:**

```markdown
✅ Good:
See [Prisma Documentation](https://www.prisma.io/docs) for migration guide.

❌ Bad:
See https://www.prisma.io/docs (no link text)
```

**Link Text Rules:**
- Use descriptive text: "Database Schema" not "click here"
- Include document name for internal links
- Include section name with anchor (#) for specific sections

### Tables

**Use consistent formatting:**

```markdown
✅ Good:
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Value 1  | Value 2  | Value 3  |
| Value 4  | Value 5  | Value 6  |

❌ Bad:
|Column 1|Column 2|
|---|---|
|Value 1|Value 2|
```

**Table Guidelines:**
- Align columns with spaces for readability
- Use header row with separator row
- Keep tables simple (< 5 columns ideal)
- Use lists for complex data

### Emphasis

**Bold and Italic:**

```markdown
**Bold** for strong emphasis (important terms, warnings)
*Italic* for mild emphasis (technical terms, document titles)
***Bold Italic*** for critical emphasis (rare)
```

**Examples:**
- **IMPORTANT:** This is critical information
- The *User* model represents...
- ***WARNING:*** This is destructive!

### Blockquotes

**Use for important notes:**

```markdown
> **Note:** This is an important note that deserves attention.

> **Warning:** This action is destructive and cannot be undone.

> **Tip:** Use this pattern for better performance.
```

**Types:**
- **Note:** General important information
- **Warning:** Cautionary information
- **Tip:** Helpful suggestions
- **Example:** Code or workflow examples

### Horizontal Rules

**Use `---` for visual separation:**

```markdown
## Section 1

Content here.

---

## Section 2

Different topic here.
```

**When to use:**
- Between major sections
- Before/after metadata blocks
- To separate distinct topics

**Don't overuse:** Use headers for structure, not rules

---

## Writing Style

### Voice and Tone

**Active Voice:**

```markdown
✅ Good: "Create a migration using Prisma CLI."
❌ Bad: "A migration should be created using Prisma CLI."
```

**Direct Address:**

```markdown
✅ Good: "Run the following command:"
❌ Bad: "One should run the following command:"
```

**Present Tense:**

```markdown
✅ Good: "The service validates input and returns a response."
❌ Bad: "The service will validate input and return a response."
```

### Clarity and Precision

**Specific vs. Vague:**

```markdown
✅ Good: "Run `npm run db:migrate -- --name add_suppliers`"
❌ Bad: "Run the migration command"

✅ Good: "The `userId` field references the `User` table's `id` column."
❌ Bad: "The userId field references the User table."

✅ Good: "This endpoint requires the `products:write` permission."
❌ Bad: "This endpoint requires permission."
```

**Avoid Ambiguity:**

```markdown
✅ Good: "Update the `FRONTEND_ORIGIN` environment variable to match your Vite server URL (e.g., `http://localhost:5174`)."
❌ Bad: "Update the environment variable to match your server."
```

### Technical Terminology

**Be Consistent:**
- Use same term throughout docs (don't mix "migration" and "schema change")
- Use codebase terminology (`Tenant`, not "organization" or "company")
- Define acronyms on first use: "RBAC (Role-Based Access Control)"

**Common Terms:**
| Use This | Not This |
|----------|----------|
| Tenant | Organization, Company |
| Branch | Location, Site |
| Permission | Access Right |
| Role | User Type |
| Migration | Schema Change |
| Stock Lot | Inventory Batch |
| FIFO | First-In-First-Out (define once) |

### Examples and Code

**Always include examples:**

```markdown
## Adding a Permission

Add the permission to the catalog:

```typescript
// api-server/src/rbac/catalog.ts
export const PERMISSIONS = [
  // ... existing permissions
  {
    key: 'suppliers:read',
    name: 'View Suppliers',
    description: 'View supplier list and details',
  },
];
```

Then seed the database:

```bash
cd api-server
npm run seed:rbac
```
```

**Example Guidelines:**
- Use real code (copy/paste from working codebase)
- Include file paths in comments
- Show inputs AND outputs
- Explain what's happening

### Warnings and Gotchas

**Highlight important information:**

```markdown
> **Warning:** Running `npm run db:reset:dev` will delete ALL data in your database. This is irreversible.

> **Note:** After changing OpenAPI schemas, you must restart the API server before regenerating types.

> **Tip:** Use `npm run test:accept:ui` for interactive debugging of Playwright tests.
```

**Use symbols for scanning:**
- ✅ Do this (correct examples)
- ❌ Don't do this (incorrect examples)
- ⚠️ Warning (dangerous operations)
- 💡 Tip (helpful suggestions)
- 🔍 Note (important context)

---

## File Naming Conventions

### General Rules

**Use kebab-case for all filenames:**

```markdown
✅ Good:
- database-schema.md
- adding-new-feature.md
- test-flakiness.md

❌ Bad:
- database_schema.md (snake_case)
- DatabaseSchema.md (PascalCase)
- database schema.md (spaces)
```

**Why kebab-case?**
- URL-friendly (works in web browsers)
- Consistent with modern conventions
- Easy to read
- Git-friendly (no special characters)

### Specific Patterns

**System Docs:**
- Format: `{topic}.md`
- Examples: `architecture.md`, `database-schema.md`, `rbac-system.md`

**SOP Docs:**
- Format: `{action-description}.md`
- Examples: `adding-new-feature.md`, `debugging-guide.md`, `testing-overview.md`

**Feature Docs (folders):**
- Format: `{feature-name}`
- Examples: `suppliers-feature`, `stock-transfers-v2`, `session-expiration`

**Agent Work Logs:**
- Format: `{feature}-{topic}-{YYYY-MM-DD}.md`
- Examples: `suppliers-schema-2025-01-15.md`, `transfers-fifo-logic-2025-01-16.md`

**Agent Portfolio Outputs:**
- Format: `{agent-name}.md`
- Examples: `database-expert.md`, `frontend-expert.md`, `test-engineer.md`

**Index Files:**
- Always: `_index.md` (underscore prefix for sorting)

**README Files:**
- Always: `README.md` (uppercase, no prefix)

### Date Formats

**In Filenames:**
- Use: `YYYY-MM-DD` (ISO 8601)
- Example: `2025-01-15`

**In Content:**
- Use: `YYYY-MM-DD` (consistency)
- Example: "**Last Updated:** 2025-01-15"

**In Folders (for archival):**
- Use: `YYYY-MM` (year-month only)
- Example: `Completed/2025-01/`

---

## When to Update vs. Create

### Update Existing Docs When:

✅ **Information changes:**
- Code behavior changes
- New features added to existing system
- Best practices evolve
- Errors discovered in documentation

✅ **Adding to existing topic:**
- New section fits naturally into existing doc
- Related to existing content
- Complements current information

✅ **Improving clarity:**
- Better examples
- More detailed explanations
- Correcting ambiguities

**How to Update:**
1. Read entire document first (understand context)
2. Make changes inline (preserve structure)
3. Update "Last Updated" date at bottom
4. Add note if major changes (optional changelog section)
5. Verify all links still work

### Create New Docs When:

✅ **New major topic:**
- Different domain area
- Standalone procedure
- New system component

✅ **Existing doc too long:**
- Doc > 1000 lines (consider splitting)
- Multiple unrelated topics
- Loss of focus

✅ **New feature completed:**
- Feature-specific documentation
- Historical record needed

**How to Create:**
1. Choose appropriate folder (`/System/`, `/SOP/`, `/Features/`)
2. Use kebab-case filename
3. Include all standard sections (see templates)
4. Add to relevant index file
5. Link from related docs

### Don't Create When:

❌ **Information already exists:**
- Link to existing doc instead
- Update existing doc if outdated

❌ **Topic too narrow:**
- Add section to related doc
- Don't create one-paragraph files

❌ **Temporary information:**
- Use comments in code
- Create GitHub issue instead

---

## Keeping Documentation Current

### Update Triggers

Update docs when:

**Code Changes:**
- New features added → Update system docs, create feature docs
- Architecture changes → Update architecture.md
- Database changes → Update database-schema.md
- Permission changes → Update rbac-system.md
- Stock logic changes → Update stock-management.md

**Bugs Fixed:**
- Add to debugging-guide.md if notable
- Update troubleshooting section
- Document root cause and solution

**Tests Added:**
- Update test coverage counts
- Document new test patterns
- Add to testing guides

**SOPs Discovered:**
- New procedure learned → Create/update SOP
- Better workflow found → Update existing SOP
- Common pitfall avoided → Add to debugging guide

### Maintenance Schedule

**Daily (as you work):**
- Update docs for changes you make
- Fix errors you discover
- Add notes for future docs

**Weekly:**
- Review recent commits for missing doc updates
- Check for outdated information
- Update coverage statistics

**Monthly:**
- Archive completed features
- Clean up agent work logs (keep last 10)
- Review and consolidate similar docs

**Quarterly:**
- Major documentation review
- Reorganize if needed
- Update architecture docs for big changes

### "Last Updated" Dates

**Always include at bottom of doc:**

```markdown
---

**Last Updated:** 2025-01-15
**Document Version:** 2.1 (optional)
```

**Update the date when:**
- Content changes (even small fixes)
- Examples updated
- Links changed
- Structure reorganized

**Don't update for:**
- Typo fixes (unless significant)
- Formatting changes only
- Comment additions

---

## Cross-Referencing

### Internal References

**Link to Related Docs:**

```markdown
For database migration workflow, see [Database Schema Reference](../System/database-schema.md#migration-workflow).

For RBAC implementation, see [RBAC System Design](../System/rbac-system.md).
```

**Section Anchors:**

```markdown
See [Permission Catalog](../System/rbac-system.md#permission-catalog) for full list.
```

**How to create anchors:**
- GitHub auto-creates anchors from headers
- Format: lowercase, replace spaces with `-`, remove special chars
- Example: `## Permission Catalog` → `#permission-catalog`

### External References

**Link to Code:**

```markdown
See `api-server/src/services/stockService.ts` for FIFO implementation.

The middleware is defined in `api-server/src/middleware/sessionMiddleware.ts:15-42`.
```

**Link to External Docs:**

```markdown
See [Prisma Migration Guide](https://www.prisma.io/docs/concepts/components/prisma-migrate) for detailed migration documentation.
```

### Bi-Directional Links

**Create "See Also" sections:**

```markdown
## See Also

- [Project Architecture](./architecture.md) - High-level system design
- [Adding New Feature SOP](../SOP/adding-new-feature.md) - Step-by-step workflow
- [Stock Management System](./stock-management.md) - FIFO implementation
```

**Mention in related docs:**
- When creating new doc, link from related docs
- When updating doc, check for related docs to link
- Maintain web of cross-references

---

## Documentation Maintenance

### Identifying Stale Documentation

**Warning Signs:**
- Date > 6 months old
- Examples don't match current code
- References non-existent files
- Contradicts other docs
- No one references it

**How to Check:**
1. Read through document
2. Verify code examples still work
3. Check all links (internal and external)
4. Compare to current codebase
5. Test procedures (if applicable)

### Fixing Stale Documentation

**Process:**
1. Identify outdated sections
2. Research current implementation
3. Update content (or delete if obsolete)
4. Test examples
5. Update "Last Updated" date
6. Notify team if major changes

### Removing Obsolete Documentation

**When to Delete:**
- Feature removed from codebase
- Process no longer used
- Better doc covers topic
- Information now irrelevant

**How to Delete:**
1. Check for incoming links (search codebase)
2. Update/remove references
3. Move to archive if historical value
4. Delete file
5. Update index files

**Archive Pattern:**
```
.agent/Archive/YYYY-MM/
└── {obsolete-doc}.md  (with "ARCHIVED" header)
```

### Documentation Debt

**Track Documentation TODOs:**

```markdown
## Stock Reporting

> **TODO:** Document stock valuation report generation once implemented (Issue #123).

> **NOTE:** This section needs expansion with examples. See PR #456 for code reference.
```

**Create Issues:**
- Open GitHub issues for significant doc debt
- Tag with "documentation" label
- Link to relevant code or docs

---

## Version Control

### Git Practices

**Commit Messages for Doc Changes:**

```markdown
✅ Good:
docs: update RBAC system with new permissions

docs: add troubleshooting section to testing guide

docs: fix broken links in architecture.md

❌ Bad:
update docs

fixed stuff

wip
```

**When to Commit Docs:**
- With related code changes (same commit)
- Separately for doc-only updates
- Group related doc changes together

### Document Versions

**When to Version:**
- Major restructuring
- Breaking changes to procedures
- Significant additions

**Version Format:**

```markdown
**Document Version:** 2.1
**Last Updated:** 2025-01-15

**Version History:**
- v2.1 (2025-01-15): Added troubleshooting section
- v2.0 (2025-01-01): Complete rewrite for new architecture
- v1.0 (2024-12-15): Initial version
```

**When NOT to Version:**
- Minor updates (just use Last Updated date)
- Typo fixes
- Link updates

---

## PRD (Product Requirements Document) Guidelines

### Purpose of PRDs

PRDs are planning documents created **before** implementing a feature. They serve as a roadmap for development and track progress during implementation.

**Purpose:**
- Plan feature implementation in phases
- Track progress with checkboxes
- Reference relevant files without including code
- Ensure testing and documentation are not forgotten

**Location:** `.agent/Features/{status}/{feature-name}/prd.md`

**Template:** See [PRD Template](./prd-template.md) for standardized structure

### What to INCLUDE in PRDs

✅ **Include:**
- Feature overview (2-3 sentences)
- Phase-based breakdown with clear goals
- Checklist items for tracking progress (`- [ ]` format)
- File references (links to files that will be modified)
- Testing requirements per phase
- Documentation update reminders
- Backend-first workflow (backend → tests → frontend → tests)
- data-testid reminder for frontend components

**Example:**
```markdown
## Phase 1: Core CRUD Operations

**Goal:** Implement basic supplier management with full CRUD operations

**Relevant Files:**
- [api-server/src/services/supplierService.ts](../../api-server/src/services/supplierService.ts)
- [admin-web/src/pages/SuppliersPage.tsx](../../admin-web/src/pages/SuppliersPage.tsx)

### Backend Implementation
- [ ] Database schema changes (create migration: `add_suppliers`)
- [ ] Service layer functions created
- [ ] Backend tests passing

### Frontend Implementation
- [ ] UI components with data-testid attributes
- [ ] E2E tests passing

### Documentation
- [ ] Update /docs for AI assistant (if new workflows)
```

### What to EXCLUDE from PRDs

❌ **Exclude:**
- Code snippets (reference files instead)
- Full database schemas (link to System docs)
- Detailed API request/response formats (use OpenAPI)
- Implementation algorithms (belong in code comments)
- Step-by-step instructions (use SOPs instead)
- Excessive detail that slows down planning

**Why exclude these?**
- **Faster planning** - Focus on WHAT, not HOW
- **Less maintenance** - Code details belong in code, not docs
- **Better focus** - PRD tracks tasks, not implementation
- **Reduce duplication** - Don't repeat what's in other docs

### PRD Workflow

**1. Planning Phase:**
- Create feature folder: `.agent/Features/InProgress/{feature-name}/`
- Copy PRD template to folder
- Fill in overview and phases
- Break work into manageable phases (1-3 days each)
- Review and refine

**2. Implementation Phase:**
- Work through phases sequentially
- Check off items as you complete them: `- [x]`
- Update **Last Updated** date when making changes
- Follow backend-first principle (backend → tests → frontend → tests)

**3. Completion Phase:**
- Verify all checkboxes are complete
- Update status to "✅ Complete"
- Create feature README summarizing work
- Move to `.agent/Features/Completed/{feature-name}/`

### PRD Best Practices

**Keep it Simple:**
- Focus on task tracking, not detailed specifications
- Use checkboxes for progress tracking
- Reference files instead of including code
- Break large phases into sub-phases if needed

**Backend-First Workflow:**
- Always complete backend + tests before frontend
- Confirm all backend tests pass before moving to frontend
- This prevents rework and ensures API stability

**Testing Integration:**
- Include test checkboxes in each phase
- Don't forget data-testid attributes in frontend
- Test early, test often

**Documentation Updates:**
- Include checkbox for updating /docs (AI assistant documentation)
- Update when introducing new concepts or workflows
- Update system docs when architecture changes

**Progress Tracking:**
- Use `- [ ]` for pending tasks
- Use `- [x]` for completed tasks
- Update status field as you progress
- Update Last Updated date regularly

### Common PRD Mistakes

❌ **Mistake 1: Too Much Detail**
```markdown
Bad:
### Backend Implementation
- [ ] Create service with functions:
      - createSupplier(params) { ... 20 lines of code ... }
      - updateSupplier(params) { ... 15 lines of code ... }
```

✅ **Fix:**
```markdown
Good:
### Backend Implementation
- [ ] Service layer functions (see [supplierService.ts](../../path/to/file.ts))
- [ ] Backend tests passing
```

❌ **Mistake 2: No File References**
```markdown
Bad:
### Backend Implementation
- [ ] Create supplier service
- [ ] Add API routes
```

✅ **Fix:**
```markdown
Good:
**Relevant Files:**
- [api-server/src/services/supplierService.ts](../../api-server/src/services/supplierService.ts)
- [api-server/src/routes/suppliersRouter.ts](../../api-server/src/routes/suppliersRouter.ts)

### Backend Implementation
- [ ] Service layer functions created
- [ ] API routes with OpenAPI schemas
```

❌ **Mistake 3: Frontend Before Backend**
```markdown
Bad:
## Phase 1: Build UI
- [ ] Create forms
- [ ] Add page routes

## Phase 2: Backend API
- [ ] Create service
```

✅ **Fix:**
```markdown
Good:
## Phase 1: Core Functionality

### Backend Implementation
- [ ] Service layer and API
- [ ] Backend tests passing

### Frontend Implementation
- [ ] UI components with data-testid
- [ ] E2E tests passing
```

❌ **Mistake 4: Forgetting data-testid**
```markdown
Bad:
### Frontend Implementation
- [ ] Create supplier form component
```

✅ **Fix:**
```markdown
Good:
### Frontend Implementation
- [ ] Create supplier form with data-testid attributes
- [ ] E2E tests using data-testid selectors
```

---

## Documentation Types

### System Documentation (Current State)

**Purpose:** Describe how the system works RIGHT NOW

**Characteristics:**
- Living documents (update frequently)
- Focused on "what" and "why"
- Architecture, design, patterns
- High-level and detailed views

**Examples:**
- `architecture.md` - System design
- `database-schema.md` - Data model
- `rbac-system.md` - Access control

**Update When:**
- System architecture changes
- New patterns introduced
- Major refactoring completed

### SOP Documentation (How To)

**Purpose:** Step-by-step procedures for common tasks

**Characteristics:**
- Task-oriented ("How to do X")
- Detailed instructions
- Code examples and commands
- Troubleshooting sections

**Examples:**
- `adding-new-feature.md` - Feature development workflow
- `debugging-guide.md` - Troubleshooting procedures
- `testing-guide.md` - Testing practices

**Update When:**
- Workflow changes
- New best practices discovered
- Common issues identified

### Feature Documentation (Historical)

**Purpose:** Record of feature development and decisions

**Characteristics:**
- Historical record (snapshot in time)
- PRD + implementation notes
- Agent contributions
- Lessons learned

**Examples:**
- `Features/Completed/2025-01/stock-transfers-v1/README.md`
- Feature PRDs, agent outputs

**Update When:**
- Feature in progress (actively updated)
- Feature completes (final summary)
- Rarely after archival (mostly read-only)

### Agent Documentation (Work Logs)

**Purpose:** Outputs from specialized sub-agents

**Characteristics:**
- Standardized format (template)
- Task-focused
- Dual location strategy
- Portfolio building

**Examples:**
- `Agents/database-expert/work/suppliers-schema-2025-01-15.md`
- `Features/InProgress/suppliers-feature/database-expert.md`

**Update When:**
- Agent completes task (creates output)
- Portfolio README updated (recent work)
- Archival (move to feature folder)

### Meta Documentation (Guidelines)

**Purpose:** Documentation about documentation

**Characteristics:**
- Rarely change
- Establish standards
- Comprehensive
- Self-referential

**Examples:**
- `agent-handoff-protocol.md` - Agent workflow
- `documentation-guidelines.md` - This file
- `archival-policy.md` - Cleanup procedures

**Update When:**
- Standards evolve
- New patterns discovered
- Structure changes
- Feedback received

---

## Quality Standards

### Documentation Checklist

Before publishing documentation, verify:

**Content:**
- [ ] Information is accurate (verified against code)
- [ ] Examples work (tested)
- [ ] All claims are true
- [ ] No outdated information
- [ ] Covers necessary depth

**Structure:**
- [ ] Headers organized logically
- [ ] Sections flow naturally
- [ ] Table of contents (if > 500 lines)
- [ ] Appropriate length (not too short or long)

**Formatting:**
- [ ] Consistent Markdown formatting
- [ ] Code blocks have language specified
- [ ] Lists use `-` consistently
- [ ] Headers use proper hierarchy
- [ ] Links use descriptive text

**Style:**
- [ ] Active voice
- [ ] Present tense
- [ ] Clear and concise
- [ ] Examples included
- [ ] Technical terms defined

**Metadata:**
- [ ] "Last Updated" date present
- [ ] File name follows conventions (kebab-case)
- [ ] Cross-references to related docs
- [ ] Added to relevant index file

**Cross-References:**
- [ ] All internal links work
- [ ] External links valid
- [ ] Related docs linked
- [ ] Bi-directional references

**Maintenance:**
- [ ] Commit message descriptive
- [ ] Git history preserved
- [ ] TODOs tracked (if any)

### Review Process

**Self-Review:**
1. Read document start to finish
2. Click all links (verify they work)
3. Test all code examples
4. Check formatting consistency
5. Verify accuracy

**Peer Review (Optional):**
- For major docs or restructuring
- For new SOP documents
- For architecture changes

**Continuous Improvement:**
- Accept feedback graciously
- Update based on usage patterns
- Iterate and refine

---

## Common Mistakes to Avoid

### Mistake 1: Outdated Examples

❌ **Bad:**
```markdown
Run `npm install` to install dependencies.
```

Reality: Command changed to `npm ci` for CI/CD.

✅ **Good:**
```markdown
Run `npm ci` to install dependencies (uses exact versions from package-lock.json).

For local development, you can use `npm install` instead.
```

### Mistake 2: Broken Links

❌ **Bad:**
```markdown
See [Database Guide](database-guide.md) for details.
```

Reality: File was renamed to `database-schema.md`.

✅ **Good:**
```markdown
See [Database Schema Reference](../System/database-schema.md) for details.
```

### Mistake 3: Vague Instructions

❌ **Bad:**
```markdown
Update the environment variables and restart the server.
```

✅ **Good:**
```markdown
Update `FRONTEND_ORIGIN` in `.env` to match your Vite server URL:

```bash
FRONTEND_ORIGIN=http://localhost:5174
```

Then restart the API server:

```bash
cd api-server
npm run dev
```
```

### Mistake 4: Copy-Paste Duplication

❌ **Bad:**
Same 50-line RBAC explanation in multiple files.

✅ **Good:**
Brief summary + link to `rbac-system.md`.

### Mistake 5: No Examples

❌ **Bad:**
```markdown
## Adding Permissions

Add permissions to the RBAC catalog and seed the database.
```

✅ **Good:**
```markdown
## Adding Permissions

Add permissions to the catalog:

```typescript
// api-server/src/rbac/catalog.ts
export const PERMISSIONS = [
  {
    key: 'suppliers:read',
    name: 'View Suppliers',
    description: 'View supplier list and details',
  },
];
```

Seed the database:

```bash
cd api-server
npm run seed:rbac
```
```

### Mistake 6: Missing Context

❌ **Bad:**
```markdown
The session cookie uses `SameSite=None`.
```

✅ **Good:**
```markdown
The session cookie uses `SameSite=None` in production to support cross-site requests
(frontend on Vercel, backend on Render). For local development, use `SameSite=Lax`.

Set via `COOKIE_SAMESITE_MODE` environment variable.
```

### Mistake 7: Poor Organization

❌ **Bad:**
```markdown
## Changes

I updated the schema and then created a migration but before that
I added a seed file and also updated the service...
```

✅ **Good:**
```markdown
## Changes Made

### Database
- Updated schema.prisma with Supplier model
- Created migration: `20250115_add_suppliers`
- Updated seed data with test suppliers

### Backend
- Created SupplierService
- Added API routes
```

---

## Templates

### System Doc Template

```markdown
# {System Component Name}

**Last Updated:** YYYY-MM-DD

---

## Overview

{Brief description of component}

## Core Concepts

### Concept 1
{Explanation}

### Concept 2
{Explanation}

## Implementation Details

{How it's implemented}

## API / Interface

{Public API or interface}

## Examples

{Code examples}

## Common Patterns

{Usage patterns}

## Troubleshooting

{Common issues}

## See Also

- [Related Doc 1](./related.md)
- [Related Doc 2](./related2.md)
```

### SOP Doc Template

```markdown
# {Task Name}

**Last Updated:** YYYY-MM-DD

---

## Overview

{What this procedure accomplishes}

## Prerequisites

{What you need before starting}

## Step-by-Step Instructions

### Step 1: {Action}

{Detailed instructions}

```bash
{command examples}
```

### Step 2: {Action}

{More instructions}

### Step 3: {Action}

{Continue...}

## Verification

{How to verify it worked}

## Troubleshooting

### Issue: {Common Problem}

**Symptoms:** {What you see}

**Solution:** {How to fix}

## See Also

- [Related Doc](./related.md)
```

### Feature README Template

```markdown
# {Feature Name}

**Status:** ✅ Completed | 🚧 In Progress | 📋 Planned
**Completion Date:** YYYY-MM-DD (if completed)
**Implementation Period:** YYYY-MM-DD to YYYY-MM-DD

## Overview

{Brief description}

## Agent Contributions

### {agent-name}
- {Key contribution 1}
- {Key contribution 2}
- [Full Output](./{agent-name}.md)

## Key Decisions

{Important technical decisions}

## Testing

{Test coverage and locations}

## Related Work

- Commits: {hashes}
- Pull Requests: {links}

## Notes

{Lessons learned, gotchas, etc.}
```

---

## Summary

**Golden Rules:**
1. Accuracy over volume
2. Update when code changes
3. Link instead of duplicate
4. Show examples
5. Use kebab-case
6. Include "Last Updated"
7. Test your examples
8. Keep it organized

**Quick Reference:**
- Headers: ATX-style (`#`, `##`, `###`)
- Code blocks: Always specify language
- Lists: Use `-` consistently
- Files: Use kebab-case
- Links: Descriptive text
- Dates: `YYYY-MM-DD` format

**When in doubt:**
- Look at existing docs for patterns
- Ask yourself: "Will this help someone 6 months from now?"
- Prefer clear over clever
- Update rather than create
- Document the "why" not just the "what"

---

**Last Updated:** 2025-01-15
**Related Documents:**
- [Agent Handoff Protocol](./agent-handoff-protocol.md)
- [Agent Output Template](./agent-output-template.md)
- [Archival Policy](./archival-policy.md)
