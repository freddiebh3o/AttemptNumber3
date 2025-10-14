# database-expert - Work Portfolio

**Agent Definition:** [.claude/agents/database-expert.md](../../../.claude/agents/database-expert.md)

## Purpose
Database schema design, Prisma migrations, multi-tenant data modeling, seeding, and query optimization.

## Recent Work (Last 10)

<!-- Agents will update this section automatically -->
<!-- Format: - [YYYY-MM-DD] [Task Name](./work/filename.md) - Brief description -->

- [2025-10-14] [Barcode Support for Products](./work/stock-transfers-barcode-schema-2025-10-14.md) - Added barcode fields to Product model for barcode-based bulk receiving in stock transfers (Phase 3)

## Common Patterns

### Typical Tasks
- Creating new database tables with multi-tenant patterns
- Adding columns to existing tables (with migrations)
- Designing table relationships and foreign keys
- Creating indexes for performance optimization
- Writing seed scripts for test data
- Implementing optimistic locking with `entityVersion`

### Standard Workflow
1. Review existing schema in `prisma/schema.prisma`
2. Design new models following multi-tenant patterns
3. Add `tenantId` to tenant-scoped tables with index
4. Include audit timestamps (`createdAt`, `updatedAt`)
5. Create migration: `npm run db:migrate -- --name {description}`
6. Update seed.ts if needed
7. Document changes in `.agent/System/database-schema.md`

### Output Location
- **Work log**: `.agent/Agents/database-expert/work/{feature}-schema-{date}.md`
- **Feature doc**: `.agent/Features/{status}/{feature-name}/database-expert.md`

## Related Agents

### Before Me
- Planning phase (feature PRD created)

### After Me
- **backend-api-expert**: Uses the models I create
- **test-engineer**: Tests the schema and migrations
- **rbac-security-expert**: May add permissions for new resources

### Works With
- **stock-inventory-expert**: For inventory-related schema changes
- **integration-orchestrator**: For migration coordination

## Key Responsibilities

✅ Multi-tenant pattern enforcement (tenantId on all tenant-scoped tables)
✅ Safe, reversible migrations
✅ Proper indexes for query performance
✅ Foreign key constraints and cascade rules
✅ Audit timestamp fields
✅ Seed data for realistic testing
✅ Optimistic locking implementation

## Documentation to Reference
- `.agent/System/database-schema.md` - Current schema
- `.agent/System/architecture.md` - Multi-tenant patterns
- `api-server/prisma/schema.prisma` - Prisma schema file
