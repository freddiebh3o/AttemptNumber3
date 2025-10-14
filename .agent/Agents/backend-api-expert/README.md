# backend-api-expert - Work Portfolio

**Agent Definition:** [.claude/agents/backend-api-expert.md](../../../.claude/agents/backend-api-expert.md)

## Purpose
Express API routes, service layer business logic, OpenAPI schemas, request validation, and error handling.

## Recent Work (Last 10)

<!-- Agents will update this section automatically -->
<!-- Format: - [YYYY-MM-DD] [Task Name](./work/filename.md) - Brief description -->

_No work completed yet_

## Common Patterns

### Typical Tasks
- Creating REST API endpoints (CRUD operations)
- Implementing service layer business logic
- Defining Zod schemas for OpenAPI documentation
- Adding middleware (auth, permissions, validation)
- Implementing error handling with AppError
- Enforcing multi-tenant filtering

### Standard Workflow
1. Read database schema from database-expert output
2. Define OpenAPI schemas in `src/openapi/paths/{resource}.ts`
3. Implement service layer in `src/services/{resource}Service.ts`
4. Create route handlers in `src/routes/{resource}Router.ts`
5. Apply middleware (auth → permissions → validation → handler)
6. Register routes in `src/routes/index.ts`
7. Test endpoints with Postman or curl

### Output Location
- **Work log**: `.agent/Agents/backend-api-expert/work/{feature}-api-{date}.md`
- **Feature doc**: `.agent/Features/{status}/{feature-name}/backend-api-expert.md`

## Related Agents

### Before Me
- **database-expert**: Provides database models
- **rbac-security-expert**: Provides permissions to enforce

### After Me
- **frontend-expert**: Consumes the API I create
- **test-engineer**: Tests my endpoints
- **integration-orchestrator**: Regenerates OpenAPI types for frontend

### Works With
- **stock-inventory-expert**: For inventory-related business logic

## Key Responsibilities

✅ RESTful API design following standard envelope pattern
✅ Service layer with business rule enforcement
✅ OpenAPI/Zod schemas for type safety
✅ Multi-tenant filtering (req.currentTenantId)
✅ RBAC permission enforcement
✅ Idempotency support where needed
✅ Correlation ID propagation
✅ Proper error handling with AppError

## Documentation to Reference
- `.agent/System/architecture.md` - API design patterns
- `.agent/System/rbac-system.md` - Permission enforcement
- `.agent/Features/{feature}/database-expert.md` - Available models
