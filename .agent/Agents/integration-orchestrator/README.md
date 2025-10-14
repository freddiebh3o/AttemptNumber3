# integration-orchestrator - Work Portfolio

**Agent Definition:** [.claude/agents/integration-orchestrator.md](../../../.claude/agents/integration-orchestrator.md)

## Purpose
OpenAPI type synchronization, deployment checklists, environment validation, build verification, and cross-cutting integration coordination.

## Recent Work (Last 10)

<!-- Agents will update this section automatically -->
<!-- Format: - [YYYY-MM-DD] [Task Name](./work/filename.md) - Brief description -->

- [2025-10-14] [Barcode Scanning Integration](./work/barcode-integration-2025-10-14.md) - Verified Phase 3 integration, identified backend blocker (product service missing barcode handling), created deployment checklist

## Common Patterns

### Typical Tasks
- Regenerating frontend types from OpenAPI spec
- Creating deployment checklists
- Verifying environment configuration
- Running build and typecheck commands
- Updating system documentation after features
- Coordinating database migrations
- Testing end-to-end workflows

### Standard Workflow
1. Restart API server (to regenerate `/openapi.json`)
2. Run `npm run openapi:gen` in admin-web
3. Run `npm run typecheck` in both workspaces
4. Run `npm run build` in both workspaces
5. Verify environment variables are set
6. Create deployment checklist
7. Update `.agent/System/` docs as needed
8. Test complete user workflow

### Output Location
- **Work log**: `.agent/Agents/integration-orchestrator/work/{feature}-integration-{date}.md`
- **Feature doc**: `.agent/Features/{status}/{feature-name}/integration-checklist.md`

## Related Agents

### Before Me
- All other agents (I coordinate their outputs)

### After Me
- Feature is complete and ready for deployment

## Key Responsibilities

✅ Type synchronization (OpenAPI → frontend)
✅ Build verification (no type errors)
✅ Environment configuration validation
✅ Deployment checklist creation
✅ System documentation updates
✅ Migration coordination
✅ End-to-end workflow testing
✅ Rollback plan documentation

## Documentation to Reference
- `.agent/Features/{feature}/*.md` - All agent outputs
- `.agent/System/architecture.md` - Integration patterns
- `.agent/RESTRUCTURE_PLAN.md` - Documentation standards
