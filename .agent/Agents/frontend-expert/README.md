# frontend-expert - Work Portfolio

**Agent Definition:** [.claude/agents/frontend-expert.md](../../../.claude/agents/frontend-expert.md)

## Purpose
React components, Mantine UI, TypeScript, routing, state management (Zustand), and responsive design.

## Recent Work (Last 10)

<!-- Agents will update this section automatically -->
<!-- Format: - [YYYY-MM-DD] [Task Name](./work/filename.md) - Brief description -->

_No work completed yet_

## Common Patterns

### Typical Tasks
- Creating page components with Mantine UI
- Building forms with validation (react-hook-form)
- Implementing CRUD interfaces
- Adding routing and navigation
- Implementing permission-based UI rendering
- Creating reusable component libraries

### Standard Workflow
1. Read API contracts from backend-api-expert output
2. Run `npm run openapi:gen` to get latest types
3. Create API client module in `src/api/{resource}.ts`
4. Build page component in `src/pages/{Resource}Page.tsx`
5. Add route in `src/main.tsx` with permission guard
6. Style with Mantine components + Tailwind utilities
7. Test in browser and with Playwright E2E tests

### Output Location
- **Work log**: `.agent/Agents/frontend-expert/work/{feature}-ui-{date}.md`
- **Feature doc**: `.agent/Features/{status}/{feature-name}/frontend-expert.md`

## Related Agents

### Before Me
- **backend-api-expert**: Provides API contracts
- **integration-orchestrator**: Runs openapi:gen for type sync

### After Me
- **test-engineer**: Tests my UI with Playwright E2E tests

### Works With
- **rbac-security-expert**: For permission-based UI rendering

## Key Responsibilities

✅ Type-safe React components with TypeScript
✅ Mantine UI component usage and customization
✅ Responsive design (mobile-first)
✅ Permission-based UI rendering (`<RequirePermission>`)
✅ Form validation and error handling
✅ API client integration with proper error handling
✅ Routing with React Router
✅ Accessible UI (ARIA attributes, semantic HTML)

## Documentation to Reference
- `.agent/System/architecture.md` - Frontend patterns
- `.agent/Features/{feature}/backend-api-expert.md` - API contracts
- `admin-web/src/types/openapi.d.ts` - Generated types
