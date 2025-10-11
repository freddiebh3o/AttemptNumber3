# SOP: Debugging Common Issues

## Overview

This guide provides troubleshooting steps for common issues encountered during development.

---

## Database Issues

### Issue: Migration Failed

**Symptoms:**
```
Error: Migration failed to apply cleanly to a temporary database.
```

**Causes:**
- Schema syntax error
- Constraint violation
- Database connection issue

**Solutions:**

1. **Check Prisma schema syntax:**
```bash
npx prisma format  # Auto-format and check syntax
```

2. **Reset database (destructive):**
```bash
npm run db:reset:dev
```

3. **Manual migration fix:**
```bash
# Delete problematic migration
rm -rf prisma/migrations/20250101_migration_name

# Recreate migration
npm run db:migrate -- --name fix_migration
```

4. **Check database connection:**
```bash
# Test connection
npx prisma db push --skip-generate
```

### Issue: Prisma Client Out of Sync

**Symptoms:**
```
Property 'supplier' does not exist on type 'PrismaClient'
```

**Solution:**
```bash
npm run prisma:generate
```

**Auto-fix:** Add to `package.json` scripts:
```json
{
  "postinstall": "prisma generate"
}
```

### Issue: Negative Stock / Data Integrity

**Symptoms:**
- `ProductStock.qtyOnHand` is negative
- Sum of lot `qtyRemaining` doesn't match aggregate

**Debugging:**
```sql
-- Check aggregate vs sum of lots
SELECT
  ps.productId,
  ps.qtyOnHand AS aggregate,
  COALESCE(SUM(lot.qtyRemaining), 0) AS lotSum,
  ps.qtyOnHand - COALESCE(SUM(lot.qtyRemaining), 0) AS diff
FROM ProductStock ps
LEFT JOIN StockLot lot ON ps.productId = lot.productId AND ps.branchId = lot.branchId
WHERE ps.tenantId = 'tenant_xyz'
GROUP BY ps.productId, ps.qtyOnHand
HAVING diff <> 0
```

**Solutions:**

1. **Recalculate aggregates (script):**
```typescript
// scripts/recalculateStock.ts
for (const productStock of allProductStocks) {
  const lotSum = await prisma.stockLot.aggregate({
    where: {
      tenantId: productStock.tenantId,
      branchId: productStock.branchId,
      productId: productStock.productId,
    },
    _sum: { qtyRemaining: true },
  })

  await prisma.productStock.update({
    where: { id: productStock.id },
    data: { qtyOnHand: lotSum._sum.qtyRemaining ?? 0 },
  })
}
```

2. **Check for missing transaction isolation:**
- Ensure all stock operations use `{ isolationLevel: 'Serializable' }`

---

## Authentication Issues

### Issue: Session Cookie Not Set

**Symptoms:**
- User signs in but still shows as logged out
- `req.currentUserId` is null

**Debugging:**

1. **Check browser dev tools (Application → Cookies):**
- Cookie name: `mt_session` (or `SESSION_COOKIE_NAME`)
- Domain: `localhost` (dev) or your domain (prod)
- SameSite: `lax` (dev) or `none` (prod)
- Secure: `false` (dev) or `true` (prod)

2. **Check CORS configuration:**
```typescript
// api-server/src/app.ts
const allowedOrigins = [
  process.env.FRONTEND_DEV_ORIGIN,  // http://localhost:5174
  process.env.FRONTEND_ORIGIN,      // https://yourapp.vercel.app
]
```

**Common mistakes:**
- Trailing slash in origin (`http://localhost:5174/` ❌)
- Wrong port number
- Missing `credentials: true` in CORS config

3. **Check cookie mode:**
```bash
# .env (dev)
COOKIE_SAMESITE_MODE=lax

# .env (prod cross-site)
COOKIE_SAMESITE_MODE=none  # Requires HTTPS
```

**Solutions:**

1. **Fix CORS origin:**
```typescript
// Remove trailing slash
const FRONTEND_DEV_ORIGIN = 'http://localhost:5174'  // ✓
const FRONTEND_DEV_ORIGIN = 'http://localhost:5174/' // ✗
```

2. **Fix cookie mode for environment:**
```bash
# Local dev (http)
COOKIE_SAMESITE_MODE=lax

# Prod cross-site (https)
COOKIE_SAMESITE_MODE=none
```

3. **Check frontend credentials:**
```typescript
// admin-web/src/api/http.ts
const response = await fetch(url, {
  credentials: 'include',  // ← REQUIRED
  ...options,
})
```

### Issue: Permission Denied (403)

**Symptoms:**
- User gets 403 error on API call
- Frontend shows permission-protected UI

**Debugging:**

1. **Check user's current permissions:**
```typescript
// Backend (add to route handler temporarily)
console.log('User permissions:', req.currentPermissionKeys)

// Frontend (check console)
console.log('User permissions:', useAuthStore.getState().permissionsCurrentTenant)
```

2. **Check user's role:**
```sql
SELECT
  u.userEmailAddress,
  t.tenantSlug,
  r.name AS roleName,
  r.isSystem
FROM UserTenantMembership utm
JOIN User u ON utm.userId = u.id
JOIN Tenant t ON utm.tenantId = t.id
JOIN Role r ON utm.roleId = r.id
WHERE u.userEmailAddress = 'user@example.com'
  AND t.tenantSlug = 'acme'
```

3. **Check role's permissions:**
```sql
SELECT
  r.name AS roleName,
  p.key AS permissionKey
FROM Role r
JOIN RolePermission rp ON r.id = rp.roleId
JOIN Permission p ON rp.permissionId = p.id
WHERE r.tenantId = 'tenant_xyz'
  AND r.name = 'EDITOR'
ORDER BY p.key
```

**Solutions:**

1. **Seed permissions:**
```bash
npm run seed:rbac
```

2. **Assign missing permission to role:**
```typescript
// Update ROLE_DEFS in catalog.ts
export const ROLE_DEFS = {
  EDITOR: [
    'products:read',
    'products:write',  // ← Add missing permission
    'suppliers:read',
  ],
}

// Re-seed
npm run seed:rbac
```

3. **Change user's role:**
```sql
UPDATE UserTenantMembership
SET roleId = (SELECT id FROM Role WHERE tenantId = 'tenant_xyz' AND name = 'ADMIN')
WHERE userId = 'user_123' AND tenantId = 'tenant_xyz'
```

---

## API Issues

### Issue: OpenAPI Types Out of Sync

**Symptoms:**
```typescript
// Type error in frontend
Type 'supplierName' does not exist on paths['/api/suppliers']['post']['requestBody']
```

**Solutions:**

1. **Restart API server:**
```bash
# api-server/
npm run dev
```

2. **Regenerate frontend types:**
```bash
# admin-web/
npm run openapi:gen
```

3. **Check OpenAPI spec directly:**
```bash
curl http://localhost:4000/openapi.json | jq .
```

### Issue: Request Validation Failed

**Symptoms:**
```json
{
  "errorCode": "VALIDATION_ERROR",
  "userFacingMessage": "Validation failed",
  "developerMessage": "Expected string, received number at \"productName\""
}
```

**Debugging:**

1. **Check Zod schema in router:**
```typescript
const CreateProductSchema = z.object({
  productName: z.string().min(1),  // ← Must be string
  productPricePence: z.number().int().min(0),
})
```

2. **Check request payload:**
```bash
# Browser dev tools → Network → Request payload
{
  "productName": "Coffee",
  "productPricePence": "1200"  // ← Should be number, not string
}
```

**Solutions:**

1. **Fix frontend type coercion:**
```typescript
const data = {
  productName: formData.productName,
  productPricePence: parseInt(formData.productPricePence),  // ← Convert to number
}
```

2. **Use Zod coercion (backend):**
```typescript
const CreateProductSchema = z.object({
  productName: z.string().min(1),
  productPricePence: z.coerce.number().int().min(0),  // ← Auto-convert
})
```

### Issue: CORS Error

**Symptoms:**
```
Access to fetch at 'http://localhost:4000/api/products' from origin 'http://localhost:5174'
has been blocked by CORS policy
```

**Debugging:**

1. **Check allowed origins:**
```typescript
// api-server/src/app.ts
console.log('Allowed origins:', allowedOrigins)
```

2. **Check request origin:**
```bash
# Browser dev tools → Network → Request headers
Origin: http://localhost:5174
```

**Solutions:**

1. **Add origin to .env:**
```bash
FRONTEND_DEV_ORIGIN=http://localhost:5174
```

2. **Restart API server** (CORS config read at startup)

3. **Check for trailing slashes:**
```bash
# BAD
FRONTEND_ORIGIN=https://yourapp.vercel.app/

# GOOD
FRONTEND_ORIGIN=https://yourapp.vercel.app
```

---

## Frontend Issues

### Issue: Component Not Rendering

**Symptoms:**
- Blank page
- Console error: `Cannot read property 'map' of undefined`

**Debugging:**

1. **Check component state:**
```typescript
console.log('suppliers:', suppliers)
```

2. **Check API response:**
```typescript
const res = await listSuppliersApiRequest()
console.log('API response:', res)
```

3. **Check loading state:**
```typescript
if (loading) return <Loader />
if (!suppliers) return <div>No data</div>
```

**Solutions:**

1. **Initialize state properly:**
```typescript
// BAD
const [suppliers, setSuppliers] = useState()

// GOOD
const [suppliers, setSuppliers] = useState([])
```

2. **Add error boundary:**
```tsx
<RouteErrorBoundary>
  <SuppliersPage />
</RouteErrorBoundary>
```

3. **Add loading state:**
```tsx
if (loading) return <Loader />
if (error) return <Alert color="red">{error.message}</Alert>
```

### Issue: Permission Check Not Working

**Symptoms:**
- UI shows unauthorized content
- `hasPerm()` returns wrong value

**Debugging:**

1. **Check auth store hydration:**
```typescript
const hydrated = useAuthStore((s) => s.hydrated)
console.log('Auth hydrated:', hydrated)
```

2. **Check permissions array:**
```typescript
const perms = useAuthStore((s) => s.permissionsCurrentTenant)
console.log('Current permissions:', perms)
```

3. **Check permission key:**
```typescript
console.log('Checking permission:', 'products:write')
console.log('Has permission:', hasPerm('products:write'))
```

**Solutions:**

1. **Refresh auth state:**
```typescript
useEffect(() => {
  useAuthStore.getState().refreshFromServer()
}, [])
```

2. **Wait for hydration:**
```typescript
const hydrated = useAuthStore((s) => s.hydrated)
if (!hydrated) return <Loader />
```

3. **Check permission key typo:**
```typescript
// BAD
hasPerm('product:write')  // Missing 's'

// GOOD
hasPerm('products:write')
```

---

## Performance Issues

### Issue: Slow API Requests

**Symptoms:**
- API calls take > 1 second
- Database queries slow

**Debugging:**

1. **Check Prisma query logs:**
```bash
# .env
LOG_LEVEL=debug
```

2. **Check database indexes:**
```sql
-- PostgreSQL: Check missing indexes
SELECT
  schemaname,
  tablename,
  attname,
  null_frac,
  avg_width,
  n_distinct
FROM pg_stats
WHERE schemaname = 'public'
  AND tablename = 'Product'
ORDER BY null_frac DESC
```

3. **Profile query:**
```sql
EXPLAIN ANALYZE
SELECT * FROM Product
WHERE tenantId = 'tenant_xyz'
  AND productName LIKE '%coffee%'
```

**Solutions:**

1. **Add missing index:**
```prisma
model Product {
  // ...
  @@index([tenantId, productName])  // ← Add composite index
}
```

2. **Optimize query (select only needed fields):**
```typescript
// BAD
const products = await prisma.product.findMany({
  where: { tenantId },
})

// GOOD
const products = await prisma.product.findMany({
  where: { tenantId },
  select: { id: true, productName: true, productSku: true },  // ← Selective
})
```

3. **Add pagination:**
```typescript
const products = await prisma.product.findMany({
  where: { tenantId },
  take: 20,
  skip: (page - 1) * 20,
})
```

### Issue: Frontend Slow Rendering

**Symptoms:**
- Laggy UI
- Re-renders on every keystroke

**Debugging:**

1. **Check React DevTools → Profiler**
2. **Check for unnecessary re-renders:**
```typescript
useEffect(() => {
  console.log('Component re-rendered')
})
```

**Solutions:**

1. **Memoize expensive computations:**
```typescript
const filteredProducts = useMemo(() => {
  return products.filter(p => p.productName.includes(search))
}, [products, search])
```

2. **Debounce user input:**
```typescript
import { useDebouncedValue } from '@mantine/hooks'

const [search, setSearch] = useState('')
const [debouncedSearch] = useDebouncedValue(search, 300)

useEffect(() => {
  // Only search when user stops typing
  fetchProducts(debouncedSearch)
}, [debouncedSearch])
```

3. **Use virtualization for long lists:**
```bash
npm install @tanstack/react-virtual
```

---

## Deployment Issues

### Issue: Production Build Fails

**Symptoms:**
```
Error: Cannot find module '@/api/suppliers'
```

**Solutions:**

1. **Check tsconfig.json paths:**
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

2. **Check Vite config:**
```typescript
// vite.config.ts
export default {
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}
```

### Issue: Database Connection Timeout

**Symptoms:**
```
Error: P1001: Can't reach database server
```

**Solutions:**

1. **Check DATABASE_URL:**
```bash
# Render/Supabase: Use Session Pooler (IPv4)
DATABASE_URL=postgresql://user:pass@db.supabase.co:5432/postgres?pgbouncer=true
```

2. **Check connection limit:**
```bash
# Increase connection limit in URL
DATABASE_URL=...?connection_limit=10
```

3. **Check network/firewall:**
```bash
# Test connection
psql $DATABASE_URL
```

---

## Logging & Monitoring

### Enable Debug Logs

**Backend:**
```bash
# .env
LOG_LEVEL=debug
PRETTY_LOGS=true
```

**Frontend:**
```typescript
// Add to API client
console.log('[API]', method, url, options)
```

### Check Correlation IDs

Every request has a unique `correlationId` for tracing:

**Backend logs:**
```
[INFO] 550e8400-e29b-41d4-a716-446655440000 | POST /api/products | 200 | 45ms
```

**Error response:**
```json
{
  "error": {
    "correlationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Database logs:**
```sql
SELECT * FROM ApiRequestLog
WHERE correlationId = '550e8400-e29b-41d4-a716-446655440000'
```

---

## Related Documentation

- [Project Architecture](../System/project_architecture.md)
- [Database Schema Reference](../System/database_schema.md)
- [RBAC System Design](../System/rbac_system.md)

---

**Last Updated:** 2025-10-11
**Document Version:** 1.0
