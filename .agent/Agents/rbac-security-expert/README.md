# rbac-security-expert - Work Portfolio

**Agent Definition:** [.claude/agents/rbac-security-expert.md](../../../.claude/agents/rbac-security-expert.md)

## Purpose
Permission design, RBAC catalog management, authorization middleware, frontend permission checks, and multi-tenant security.

## Recent Work (Last 10)

<!-- Agents will update this section automatically -->
<!-- Format: - [YYYY-MM-DD] [Task Name](./work/filename.md) - Brief description -->

- [2025-10-14] [Phase 4: Reports Permission](./work/phase4-reports-permission-2025-10-14.md) - Added `reports:view` permission for Transfer Analytics Dashboard (OWNER/ADMIN only)

## Common Patterns

### Typical Tasks
- Adding new permissions to RBAC catalog
- Assigning permissions to system roles
- Implementing backend authorization middleware
- Adding frontend permission checks
- Creating custom tenant-specific roles
- Auditing permission enforcement

### Standard Workflow
1. Design permission keys: `{resource}:{action}` (e.g., `suppliers:read`)
2. Add to `src/rbac/catalog.ts` with descriptions
3. Assign to appropriate roles (OWNER, ADMIN, EDITOR, VIEWER)
4. Run `npm run seed:rbac` to sync to database
5. Add backend middleware: `requirePermission('key')`
6. Add frontend checks: `<RequirePermission perm="key">`
7. Test with different user roles

### Output Location
- **Work log**: `.agent/Agents/rbac-security-expert/work/{feature}-rbac-{date}.md`
- **Feature doc**: `.agent/Features/{status}/{feature-name}/rbac-security-expert.md`

## Related Agents

### Before Me
- **database-expert**: If new tables need permissions

### After Me
- **backend-api-expert**: Implements permission checks
- **frontend-expert**: Implements UI permission checks
- **test-engineer**: Tests different roles

### Works With
- All agents (security is cross-cutting concern)

## Key Responsibilities

✅ Permission catalog design and maintenance
✅ Role-permission mapping
✅ Backend authorization enforcement
✅ Frontend permission-based UI
✅ Multi-tenant security (tenant isolation)
✅ Custom role support
✅ Security auditing
✅ Principle of least privilege

## Documentation to Reference
- `.agent/System/rbac-system.md` - RBAC architecture
- `.agent/System/architecture.md` - Authorization patterns
- `api-server/src/rbac/catalog.ts` - Permission catalog
