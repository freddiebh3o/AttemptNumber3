## Summary
<!-- Brief description of changes -->

## Story & Acceptance Criteria
**Story:** <!-- Link to GitHub Issue, e.g., Closes #123 (ST-001) -->

**Acceptance Criteria Addressed:**
- [ ] AC-###-# - <!-- Description -->
- [ ] AC-###-# - <!-- Description -->

## Changes
<!-- List key files/modules modified -->

## Test Evidence
- [ ] Unit tests added/updated (specify coverage %)
- [ ] API tests pass (show output or CI link)
- [ ] Manual testing completed (attach screenshots/logs if applicable)
- [ ] OpenAPI types regenerated (if backend schemas changed)
- [ ] Database migration tested locally

## RBAC / Security
- [ ] Permission checks enforced (specify which: `permission:key`)
- [ ] Tenant isolation validated (queries filter by `tenantId`)
- [ ] Input validation complete (Zod schemas)

## Deployment Notes
<!-- Any migration steps, env var changes, or rollback considerations -->

## Checklist
- [ ] Code follows project conventions (see CLAUDE.md)
- [ ] No TypeScript errors (`npm run typecheck` in both workspaces)
- [ ] Linting passes (`npm run lint`)
- [ ] Correlation IDs present in logs
- [ ] Updated BMAD docs if scope/AC changed
