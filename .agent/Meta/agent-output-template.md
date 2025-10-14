# Agent Output Template

**Purpose:** This template provides a standardized format for all agent work outputs. Use this template when documenting completed tasks to ensure consistency and completeness.

---

## How to Use This Template

1. Copy this template when starting a new task
2. Fill in all sections with relevant information
3. Save output to TWO locations:
   - **Agent work log**: `.agent/Agents/{agent-name}/work/{feature}-{topic}-{YYYY-MM-DD}.md`
   - **Feature doc**: `.agent/Features/{status}/{feature-name}/{agent-name}.md`
4. Update agent portfolio README: `.agent/Agents/{agent-name}/README.md`

---

## Template

```markdown
# {Task Name} - {Agent Name}

**Date:** YYYY-MM-DD
**Agent:** {agent-name}
**Feature:** {feature-name or "standalone"}
**Status:** {Completed | In Progress | Blocked}

---

## Context

### Request
{What was I asked to do? Include who requested it (main thread, another agent, user issue)}

### Related Documentation
{Links to docs I referenced}
- `.agent/System/{doc}.md` - {why I read this}
- `.agent/Features/{feature}/{agent}.md` - {what context this provided}
- Other relevant docs...

### Dependencies
{What work was completed before me that I built upon?}
- {agent-name} completed: {summary}
- {agent-name} provided: {models/APIs/permissions/etc.}

---

## Changes Made

### Files Created
{List all new files with brief descriptions}

- `path/to/file.ts` - {What this file does}
- `path/to/test.spec.ts` - {What this tests}

### Files Modified
{List modified files with specific changes}

- `path/to/file.ts`
  - Added: {what was added and why}
  - Modified: {what changed and why}
  - Removed: {what was removed and why}

### Database Changes
{If applicable - migrations, schema updates, seed changes}

- **Migration**: `YYYYMMDDHHMMSS_description.sql`
  - Tables affected: {list}
  - Breaking changes: {yes/no, explain if yes}

- **Schema Updates**:
  - Added tables: {list}
  - Added columns: {list}
  - Added indexes: {list with rationale}

- **Seed Updates**:
  - Added: {what test data}
  - Modified: {what changed}

### API Changes
{If applicable - new endpoints, modified contracts}

- **New Endpoints**:
  - `POST /api/{resource}` - {description}
  - `GET /api/{resource}/:id` - {description}

- **Modified Endpoints**:
  - `PUT /api/{resource}/:id` - {what changed}

- **OpenAPI Schemas**:
  - Request schemas: {list}
  - Response schemas: {list}

### Permission Changes
{If applicable - new permissions, role assignments}

- **Permissions Added**:
  - `resource:action` - {description, which roles have it}

- **Roles Modified**:
  - {role}: Added {permissions}

### UI Changes
{If applicable - new pages, components, routes}

- **New Pages**: {list}
- **New Components**: {list}
- **Modified Components**: {list with changes}
- **New Routes**: {list with permission guards}

---

## Key Decisions

### Decision 1: {Decision Title}
- **What**: {What did I decide to do?}
- **Why**: {Rationale for this approach}
- **Alternatives Considered**:
  - Option A: {pros/cons}
  - Option B: {pros/cons}
- **Chosen Approach**: {Option X because...}

### Decision 2: {Decision Title}
{Repeat for each significant decision}

---

## Implementation Details

### Technical Approach
{High-level explanation of how I implemented this}

### Algorithms & Logic
{Explain any complex logic, algorithms, or business rules}

### Edge Cases Handled
{List edge cases and how they're handled}
- {Edge case 1}: {How it's handled}
- {Edge case 2}: {How it's handled}

### Performance Considerations
{Any optimizations, indexes, caching, pagination}

### Security Considerations
{Permission checks, tenant isolation, input validation}

---

## Testing

### How to Test
{Step-by-step instructions to test this work}

1. {Step 1}
2. {Step 2}
3. {Expected result}

### Test Files Created/Modified
- `path/to/test.spec.ts` - {What scenarios are tested}

### Test Coverage
{What scenarios are covered by tests}
- ✅ Happy path: {description}
- ✅ Error cases: {list}
- ✅ Permission checks: {which roles}
- ✅ Edge cases: {list}
- ❌ Not yet covered: {what's missing}

### Manual Testing Notes
{If manual testing was done, describe results}

---

## Next Steps

### Immediate Next Steps
{What needs to happen next for this feature to progress}
- [ ] {Task 1} - Assigned to: {agent-name or "pending"}
- [ ] {Task 2} - Assigned to: {agent-name or "pending"}

### What Other Agents Need to Know
{Critical information for downstream agents}

**For {agent-name}:**
- {Key information they need}
- {Files to reference}

**For {agent-name}:**
- {Key information they need}

### Integration Requirements
{What needs to happen before this can be deployed}
- [ ] Database migration applied
- [ ] RBAC permissions seeded
- [ ] OpenAPI types regenerated
- [ ] Environment variables set
- [ ] Tests passing

---

## Blockers & Issues

### Current Blockers
{Anything preventing progress}
- {Blocker 1}: {Description, what's needed to unblock}
- {Blocker 2}: {Description}

### Known Issues
{Issues discovered but not yet fixed}
- {Issue 1}: {Description, severity, workaround}
- {Issue 2}: {Description}

### Questions/Uncertainties
{Anything unclear or needing clarification}
- {Question 1}
- {Question 2}

---

## References

### Documentation
{Links to relevant system docs}
- `.agent/System/{doc}.md` - {what I learned from this}

### Related Agent Outputs
{Links to other agent outputs I built upon}
- `.agent/Agents/{agent}/work/{file}.md` - {what this provided}
- `.agent/Features/{feature}/{agent}.md` - {context from this}

### External Resources
{Links to external docs, Stack Overflow, articles, etc.}
- {URL} - {what this helped with}

### Code Examples
{Links to similar code in the codebase}
- `path/to/file.ts:{line}` - {similar pattern used here}

---

## Metadata

**Agent Definition:** [.claude/agents/{agent-name}.md](../../.claude/agents/{agent-name}.md)
**Feature Folder:** `.agent/Features/{status}/{feature-name}/`
**Completion Time:** {X hours/days}
**Complexity:** {Low | Medium | High}
**Lines of Code Changed:** {approximate count}

---

_End of Output_
```

---

## Field Descriptions

### Required Fields
These fields **must** be filled in for every output:

- **Task Name**: Clear, descriptive name
- **Date**: YYYY-MM-DD format
- **Agent**: Which agent completed this
- **Feature**: Feature name or "standalone"
- **Context → Request**: What was asked
- **Changes Made**: At least one of (Files Created/Modified/Database/API/Permissions/UI)
- **Key Decisions**: At least one significant decision explained
- **Testing**: How to test the work
- **Next Steps**: What happens next

### Optional Fields
These fields are optional but should be used when applicable:

- **Blockers & Issues**: Only if blockers exist
- **Implementation Details**: For complex logic
- **Performance Considerations**: If relevant
- **Security Considerations**: For security-sensitive changes

---

## Examples by Agent Type

### database-expert Output
Focus on:
- Database Changes section (detailed)
- Migration commands and rollback strategy
- Indexes and performance impact
- Multi-tenant pattern enforcement

### backend-api-expert Output
Focus on:
- API Changes section (detailed)
- OpenAPI schemas created
- Service layer implementation
- Error handling and validation

### frontend-expert Output
Focus on:
- UI Changes section (detailed)
- Components created/modified
- Routing and permission guards
- User experience notes

### rbac-security-expert Output
Focus on:
- Permission Changes section (detailed)
- Role-permission matrix
- Backend and frontend enforcement
- Security considerations

### test-engineer Output
Focus on:
- Testing section (very detailed)
- Test coverage breakdown
- Role-based testing
- Flakiness prevention strategies

### stock-inventory-expert Output
Focus on:
- Implementation Details (FIFO logic)
- Algorithms & Logic (detailed)
- Edge Cases Handled (comprehensive)
- Transaction safety

### integration-orchestrator Output
Focus on:
- Integration Requirements (checklist)
- Next Steps (deployment plan)
- What Other Agents Need to Know
- System documentation updates

### debugging-detective Output
Focus on:
- Context (bug reproduction)
- Implementation Details (root cause analysis)
- Key Decisions (why this fixes it)
- Prevention strategies

---

## Best Practices

### Writing Style
- ✅ Be specific and concrete
- ✅ Use code examples where helpful
- ✅ Link to relevant files and docs
- ✅ Explain *why*, not just *what*
- ❌ Don't assume context
- ❌ Don't use vague language

### Organization
- ✅ Use headers and bullets for scanability
- ✅ Group related information together
- ✅ Put most important info first
- ✅ Use checklists for actionable items

### Completeness
- ✅ Include all files changed
- ✅ Document all decisions made
- ✅ Explain trade-offs considered
- ✅ Provide testing instructions
- ✅ List next steps clearly

---

**Last Updated:** 2025-01-15
