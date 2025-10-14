# test-engineer - Work Portfolio

**Agent Definition:** [.claude/agents/test-engineer.md](../../../.claude/agents/test-engineer.md)

## Purpose
Jest backend tests, Playwright E2E tests, test helpers/factories, RBAC testing, flakiness resolution, and test coverage.

## Recent Work (Last 10)

<!-- Agents will update this section automatically -->
<!-- Format: - [YYYY-MM-DD] [Task Name](./work/filename.md) - Brief description -->

_No work completed yet_

## Common Patterns

### Typical Tasks
- Writing Jest integration tests for API endpoints
- Creating Playwright E2E tests for user flows
- Building test helpers and factories
- Testing permission enforcement (different roles)
- Fixing flaky tests
- Testing multi-tenant isolation
- Testing FIFO stock operations

### Standard Workflow
1. Read all feature agent outputs for context
2. Create backend tests in `api-server/__tests__/`
3. Create frontend E2E tests in `admin-web/e2e/`
4. Add test helpers if needed
5. Test different user roles (owner, viewer, etc.)
6. Test error cases and edge conditions
7. Ensure tests are isolated and not flaky
8. Run tests: `npm run test:accept` (backend), `npm run test:accept` (frontend)

### Output Location
- **Work log**: `.agent/Agents/test-engineer/work/{feature}-tests-{date}.md`
- **Feature doc**: `.agent/Features/{status}/{feature-name}/test-engineer.md`

## Related Agents

### Before Me
- All other agents (I test their work)

### After Me
- **integration-orchestrator**: Verifies everything works together

### Works With
- All agents (testing is cross-cutting)

## Key Responsibilities

✅ Comprehensive test coverage (happy path + edge cases)
✅ Permission-based testing (all roles)
✅ Multi-tenant isolation testing
✅ Backend integration tests (Jest + real DB)
✅ Frontend E2E tests (Playwright)
✅ Test isolation (independent, idempotent)
✅ Flakiness prevention and debugging
✅ Test helpers and factories

## Documentation to Reference
- `.agent/SOP/testing-overview.md` - Testing strategy
- `.agent/SOP/backend-testing.md` - Backend patterns
- `.agent/SOP/frontend-testing.md` - Frontend patterns
- `.agent/SOP/test-flakiness.md` - Flakiness debugging
- `.agent/Features/{feature}/*.md` - What to test
