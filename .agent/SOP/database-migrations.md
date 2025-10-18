# Database Migrations Guide

**Category:** Development
**Last Updated:** 2025-10-18
**Complexity:** Intermediate

---

## Overview

This guide covers how to work with Prisma migrations, including creating, applying, and troubleshooting migrations. It also documents the shadow database setup required for PostgreSQL extensions like pgvector.

---

## Table of Contents

1. [Migration Basics](#migration-basics)
2. [Shadow Database Setup](#shadow-database-setup)
3. [Common Migration Commands](#common-migration-commands)
4. [Creating Migrations](#creating-migrations)
5. [Troubleshooting](#troubleshooting)
6. [Best Practices](#best-practices)

---

## Migration Basics

### What Are Migrations?

Migrations are version-controlled changes to your database schema. They allow you to:
- Track schema changes over time
- Apply changes consistently across environments
- Rollback changes if needed
- Collaborate with other developers

### Migration Files

Migrations are stored in `api-server/prisma/migrations/`:

```
prisma/migrations/
├── 20250925184308_init_schema/
│   └── migration.sql
├── 20251016212455_add_document_chunks/
│   └── migration.sql
└── migration_lock.toml
```

Each migration folder contains:
- **Timestamp prefix** (e.g., `20250925184308`) - When migration was created
- **Migration name** (e.g., `init_schema`) - Descriptive name
- **migration.sql** - The actual SQL commands

---

## Shadow Database Setup

### What Is a Shadow Database?

The shadow database is a temporary database that Prisma uses during development to:
- Validate migrations before applying them
- Detect schema drift (differences between migrations and actual database)
- Ensure migrations are safe to apply

**Important:** The shadow database is only used during `prisma migrate dev` in development. Production uses `prisma migrate deploy` which doesn't require a shadow database.

### Why Shadow Database Is Required for pgvector

Our project uses the **pgvector extension** for vector embeddings (AI chat feature). When Prisma creates a temporary shadow database, it doesn't automatically install PostgreSQL extensions. This causes migrations that depend on `vector` types to fail.

**Solution:** Configure a dedicated shadow database with pgvector pre-installed.

### Setting Up Shadow Database (Supabase)

#### Step 1: Create Shadow Database

1. Log into your Supabase dashboard
2. Create a new project (e.g., `my-project-shadow`)
3. Wait for database provisioning to complete

#### Step 2: Enable pgvector Extension

**Option A: Via Dashboard**
1. Select your shadow database project
2. Go to **Database** → **Extensions**
3. Search for "vector"
4. Toggle **ON** to enable

**Option B: Via SQL Editor**
1. Select your shadow database project
2. Go to **SQL Editor**
3. Run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

#### Step 3: Update Environment Variables

Add the shadow database URL to your `.env` file:

```env
# Main database
DATABASE_URL="postgresql://postgres:password@host:5432/postgres"

# Shadow database (required for migrations with pgvector)
SHADOW_DATABASE_URL="postgresql://postgres:password@shadow-host:5432/postgres"
```

#### Step 4: Update Prisma Schema

Add `shadowDatabaseUrl` to your `schema.prisma`:

```prisma
datasource db {
  provider          = "postgresql"
  url               = env("DATABASE_URL")
  shadowDatabaseUrl = env("SHADOW_DATABASE_URL")  // Add this line
  extensions        = [vector]
}
```

#### Step 5: Verify Setup

Test that migrations work with the shadow database:

```bash
cd api-server
npm run db:migrate -- --name test_migration
```

You should see:
```
✅ Applying migration `20251018123456_test_migration`
✅ Your database is now in sync with your schema.
```

**No shadow database errors!** ✅

---

## Common Migration Commands

### Development Commands

```bash
# Create and apply migration
npm run db:migrate -- --name add_new_feature

# Create migration without applying (for manual SQL editing)
npm run db:migrate -- --create-only --name add_new_feature

# View migration status
npx prisma migrate status

# Reset database (destructive - loses all data!)
npm run db:reset:dev

# Generate Prisma client after schema changes
npm run prisma:generate
```

### Production Commands

```bash
# Apply pending migrations (no shadow database required)
npm run db:deploy

# This runs on startup in production
npm run start  # Equivalent to: prisma migrate deploy && node dist/server.js
```

### Database Inspection

```bash
# Open Prisma Studio (visual database browser)
npm run db:studio

# Pull current database schema into Prisma schema
npx prisma db pull
```

---

## Creating Migrations

### Standard Workflow

1. **Update Prisma schema** (`prisma/schema.prisma`):
   ```prisma
   model NewFeature {
     id        String   @id @default(cuid())
     name      String
     createdAt DateTime @default(now())
   }
   ```

2. **Create and apply migration**:
   ```bash
   npm run db:migrate -- --name add_new_feature
   ```

3. **Verify migration applied**:
   - Check console output for success message
   - Inspect migration file in `prisma/migrations/`
   - Verify in Prisma Studio (`npm run db:studio`)

4. **Regenerate Prisma client** (usually automatic):
   ```bash
   npm run prisma:generate
   ```

### Creating Migrations with Custom SQL

For complex migrations that can't be expressed in Prisma schema:

1. **Create empty migration**:
   ```bash
   npm run db:migrate -- --create-only --name add_custom_index
   ```

2. **Edit the migration file** (`prisma/migrations/[timestamp]_add_custom_index/migration.sql`):
   ```sql
   -- Create custom index
   CREATE INDEX CONCURRENTLY idx_products_name_search
   ON "Product" USING gin(to_tsvector('english', "productName"));
   ```

3. **Apply the migration**:
   ```bash
   npm run db:migrate
   ```

### Adding PostgreSQL Extensions

When adding a new extension to `schema.prisma`:

1. **Update schema**:
   ```prisma
   datasource db {
     provider          = "postgresql"
     url               = env("DATABASE_URL")
     shadowDatabaseUrl = env("SHADOW_DATABASE_URL")
     extensions        = [vector, pgcrypto]  // Add new extension
   }
   ```

2. **Enable in shadow database**:
   ```sql
   -- Run in shadow database SQL editor
   CREATE EXTENSION IF NOT EXISTS pgcrypto;
   ```

3. **Create migration**:
   ```bash
   npm run db:migrate -- --name add_pgcrypto_extension
   ```

---

## Troubleshooting

### Issue: "Migration failed to apply cleanly to the shadow database"

**Cause:** Shadow database is missing required PostgreSQL extensions (e.g., pgvector).

**Solution:** Follow [Shadow Database Setup](#shadow-database-setup) instructions above.

**Quick verification:**
```bash
# Check if SHADOW_DATABASE_URL is configured
cd api-server
cat .env | grep SHADOW_DATABASE_URL
```

---

### Issue: "Drift detected: Your database schema is not in sync"

**Cause:** Database has changes that aren't reflected in migration files (e.g., tables created with `prisma db push` or manual SQL).

**Symptoms:**
```
Drift detected: Your database schema is not in sync with your migration history.

[+] Added tables
  - MyNewTable
```

**Solution 1: Create Baseline Migration (Recommended)**

If database has important data:

1. Create a migration representing current state:
   ```bash
   npx prisma migrate dev --create-only --name baseline_current_state
   ```

2. Leave the migration file empty or add comment:
   ```sql
   -- Baseline migration
   -- Database already contains these tables
   ```

3. Mark as applied:
   ```bash
   npx prisma migrate resolve --applied [timestamp]_baseline_current_state
   ```

**Solution 2: Reset Database (Destructive)**

If you can lose all data:

```bash
npm run db:reset:dev  # Drops DB, re-applies all migrations, runs seed
```

---

### Issue: "P3006: Migration failed to apply cleanly"

**Cause:** SQL error in migration file (syntax error, constraint violation, etc.).

**Solution:**

1. Check the migration SQL file for errors
2. Test SQL manually in Prisma Studio or database client
3. Fix the SQL
4. Re-run migration:
   ```bash
   npm run db:migrate
   ```

If migration is partially applied:
```bash
# Mark as rolled back
npx prisma migrate resolve --rolled-back [migration_name]

# Fix the SQL
# Re-run migration
npm run db:migrate
```

---

### Issue: "The relation already exists"

**Cause:** Attempting to create a table/index that already exists.

**Solution:**

Check if migration was partially applied:
```bash
npx prisma migrate status
```

If applied, mark as resolved:
```bash
npx prisma migrate resolve --applied [migration_name]
```

---

### Issue: Shadow database error with pgvector even after setup

**Debugging steps:**

1. **Verify shadow database URL is correct**:
   ```bash
   cd api-server
   cat .env | grep SHADOW_DATABASE_URL
   ```

2. **Test shadow database connection**:
   ```bash
   # Try connecting with psql (if installed)
   psql $SHADOW_DATABASE_URL -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"
   ```

3. **Verify extension is enabled**:
   - Should return `vector` if extension is installed
   - If not, enable it via Supabase dashboard or SQL

4. **Check schema.prisma has shadowDatabaseUrl**:
   ```prisma
   datasource db {
     provider          = "postgresql"
     url               = env("DATABASE_URL")
     shadowDatabaseUrl = env("SHADOW_DATABASE_URL")  // Must be present
     extensions        = [vector]
   }
   ```

---

## Best Practices

### ✅ DO

- **Create descriptive migration names**: `add_user_archival` not `update_users`
- **Review migration SQL**: Always check generated SQL before applying
- **Test migrations locally**: Run `npm run db:migrate` before committing
- **Commit migrations to Git**: Migration files should be version controlled
- **Use semantic migration names**: `add_`, `remove_`, `rename_`, `update_`
- **Keep migrations small**: One logical change per migration
- **Add comments to complex migrations**: Explain why, not just what

### ❌ DON'T

- **Don't edit applied migrations**: Once pushed, migrations are immutable
- **Don't use `prisma db push` in production**: Use migrations for tracked changes
- **Don't delete migration files**: Breaks migration history
- **Don't skip migration testing**: Always test locally before deploying
- **Don't commit `.env` files**: Keep database credentials secure

### Migration Naming Conventions

```bash
# Good examples
add_user_archival           # Adding new feature
remove_deprecated_fields    # Removing old fields
rename_price_to_pence       # Renaming fields
update_product_indexes      # Updating indexes
fix_stock_lot_constraint    # Bug fixes

# Bad examples
update                      # Too vague
migration_1                 # Not descriptive
test                        # Not meaningful
temp_changes                # Unclear intent
```

### When to Reset Database

**Safe to reset (development):**
- ✅ Local development environment
- ✅ No important data to preserve
- ✅ Can re-seed test data easily
- ✅ Fixing complex migration drift

**Never reset (production):**
- ❌ Production database
- ❌ Staging with customer data
- ❌ Any database with data you can't recreate

---

## Production Deployment Checklist

Before deploying migrations to production:

- [ ] Test migration locally with `npm run db:migrate`
- [ ] Verify migration SQL is correct
- [ ] Check for data loss (e.g., dropping columns)
- [ ] Test rollback strategy if needed
- [ ] Backup production database
- [ ] Run migration during low-traffic window
- [ ] Monitor application logs after deployment
- [ ] Verify application works with new schema

**Production migration command:**
```bash
npm run db:deploy  # Uses prisma migrate deploy (no shadow DB)
```

---

## Related Documentation

- **Architecture:** `.agent/System/architecture.md` - Database architecture
- **Adding Features:** `.agent/SOP/adding-new-feature.md` - Full feature workflow
- **Debugging:** `.agent/SOP/debugging-guide.md` - Database troubleshooting

---

## Quick Reference

### Most Common Commands

```bash
# Create and apply migration
npm run db:migrate -- --name feature_name

# Reset database (dev only)
npm run db:reset:dev

# View migration status
npx prisma migrate status

# Open database browser
npm run db:studio

# Deploy migrations (production)
npm run db:deploy
```

### Shadow Database Quick Setup

```bash
# 1. Create shadow database on Supabase
# 2. Enable vector extension via dashboard or SQL:
CREATE EXTENSION IF NOT EXISTS vector;

# 3. Add to .env:
SHADOW_DATABASE_URL="postgresql://..."

# 4. Update schema.prisma:
shadowDatabaseUrl = env("SHADOW_DATABASE_URL")

# 5. Test:
npm run db:migrate -- --name test
```

---

## Summary

**Key Takeaways:**

1. **Migrations track schema changes** - Version-controlled, repeatable database updates
2. **Shadow database required for pgvector** - Configure once, works forever
3. **Use migrations in development** - `npm run db:migrate`, not `db push`
4. **Use deploy in production** - `npm run db:deploy`, no shadow DB needed
5. **Always test locally first** - Never deploy untested migrations
6. **Keep migrations small** - One logical change per migration

**Setup Time:** ~5 minutes (one-time shadow database setup)
**Payoff:** Smooth migrations forever, no more pgvector errors ✅

---

**Questions or Issues?**
- Check `.agent/SOP/debugging-guide.md` for database troubleshooting
- Review `.agent/System/architecture.md` for database architecture
- Consult Prisma docs: https://www.prisma.io/docs/orm/prisma-migrate
