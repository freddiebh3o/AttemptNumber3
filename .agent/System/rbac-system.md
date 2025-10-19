# RBAC System Design

## Overview

The system implements a comprehensive Role-Based Access Control (RBAC) system with:
- **Global permission catalog** - Single source of truth for all permissions
- **Tenant-scoped roles** - Custom roles per tenant with flexible permission assignments
- **System roles** - Pre-defined roles (OWNER, ADMIN, EDITOR, VIEWER)
- **Backend enforcement** - Middleware-based permission checks
- **Frontend enforcement** - Component-level permission guards
- **Multi-tenant isolation** - Permissions scoped to current tenant context

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Permission Catalog (Global)                   │
│  products:read, products:write, users:manage, roles:manage...   │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ N:M (via RolePermission)
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Roles (Tenant-Scoped)                         │
│  OWNER, ADMIN, EDITOR, VIEWER, Custom Roles...                  │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ 1:N
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│              UserTenantMembership (Join Table)                   │
│  Links User + Tenant + Role                                      │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ Runtime Resolution
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│              Request Context (req.currentPermissionKeys)         │
│  Set<PermissionKey> cached per request                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Permission Catalog

**Location:** `api-server/src/rbac/catalog.ts`

### Available Permissions

| Permission Key | Description | Typical Roles |
|----------------|-------------|---------------|
| `products:read` | View products | ALL |
| `products:write` | Create/update/delete products | OWNER, ADMIN, EDITOR |
| `users:manage` | Invite or manage tenant users | OWNER, ADMIN |
| `roles:manage` | Create/edit roles and permissions | OWNER |
| `tenant:manage` | Manage tenant settings | OWNER |
| `theme:manage` | Manage tenant theme/branding | OWNER, ADMIN |
| `uploads:write` | Upload images/files | OWNER, ADMIN, EDITOR |
| `branches:manage` | Manage branches and memberships | OWNER, ADMIN |
| `stock:read` | View branch stock, lots, and movements | ALL |
| `stock:write` | Receive and adjust stock | OWNER, ADMIN |
| `stock:allocate` | Allocate/consume stock for orders | OWNER, ADMIN, EDITOR |
| `reports:view` | View analytics reports and dashboards | OWNER, ADMIN |

### Permission Naming Convention

**Format:** `<resource>:<action>`

**Examples:**
- `products:read` - Read access to products
- `products:write` - Write access (create/update/delete)
- `users:manage` - Full management capabilities
- `stock:allocate` - Specific action (allocate/consume)

**Guidelines:**
- Use plural nouns for resources (products, users, roles)
- Use verbs for actions (read, write, manage, allocate)
- `:read` for view-only access
- `:write` for create/update/delete
- `:manage` for full CRUD + configuration

---

## System Roles

**Location:** `api-server/src/rbac/catalog.ts` → `ROLE_DEFS`

### 1. OWNER (12 permissions)

**Full access to all features** - Intended for tenant owners/founders.

**Permissions:**
```typescript
[
  'products:read', 'products:write',
  'users:manage', 'roles:manage', 'tenant:manage',
  'theme:manage', 'uploads:write',
  'branches:manage', 'stock:read', 'stock:write', 'stock:allocate',
  'reports:view',
]
```

**Use Cases:**
- Configure tenant settings
- Create custom roles
- Manage billing (future)
- Full administrative access

### 2. ADMIN (10 permissions)

**Manage users and operations** - Day-to-day admin without role/tenant configuration.

**Permissions:**
```typescript
[
  'products:read', 'products:write',
  'users:manage',
  'theme:manage', 'uploads:write',
  'branches:manage', 'stock:read', 'stock:write', 'stock:allocate',
  'reports:view',
]
```

**Missing (vs OWNER):**
- `roles:manage` - Cannot create/edit roles
- `tenant:manage` - Cannot change tenant settings

**Use Cases:**
- Manage products and inventory
- Invite/remove users
- Customize branding
- Day-to-day operations

### 3. EDITOR (5 permissions)

**Edit products and allocate stock** - Operational role for catalog managers.

**Permissions:**
```typescript
[
  'products:read', 'products:write', 'uploads:write',
  'stock:read', 'stock:allocate',
]
```

**Missing (vs ADMIN):**
- `users:manage` - Cannot manage users
- `stock:write` - Cannot receive/adjust stock (only allocate/consume)
- `branches:manage` - Cannot manage branches

**Use Cases:**
- Update product information
- Upload product images
- Allocate stock for orders
- View inventory levels

### 4. VIEWER (2 permissions)

**Read-only access** - View products and inventory without modification.

**Permissions:**
```typescript
[
  'products:read',
  'stock:read',
]
```

**Use Cases:**
- View product catalog
- View inventory levels
- External stakeholders (e.g., accountants)

---

## Backend Enforcement

### Middleware: `requirePermission()`

**Location:** `api-server/src/middleware/permissionMiddleware.ts`

**Usage:**
```typescript
import { requirePermission } from '../middleware/permissionMiddleware.js';

router.post(
  '/products',
  requireAuthenticatedUserMiddleware,
  requirePermission('products:write'), // ← Permission check
  createProduct
);
```

**Flow:**
1. Check if `req.currentPermissionKeys` is cached
2. If not cached, fetch permissions from database via `permissionService`
3. Query: `UserTenantMembership` → `Role` → `RolePermission` → `Permission`
4. Cache permissions in `req.currentPermissionKeys` (Set<PermissionKey>)
5. Check if required permission exists in set
6. Throw `PERMISSION_DENIED` error if missing

**Error Response:**
```json
{
  "success": false,
  "data": null,
  "error": {
    "errorCode": "PERMISSION_DENIED",
    "httpStatusCode": 403,
    "userFacingMessage": "You do not have permission to perform this action.",
    "developerMessage": "Required permission: products:write",
    "correlationId": "550e8400-..."
  }
}
```

### Middleware: `requireAnyPermission()`

**Usage:** When multiple permissions are acceptable (OR condition).

```typescript
router.get(
  '/reports/sales',
  requireAuthenticatedUserMiddleware,
  requireAnyPermission(['reports:view', 'tenant:manage']), // ← Either permission works
  getSalesReport
);
```

**Flow:**
1. Same as `requirePermission()` but checks if ANY of the required permissions exist
2. Throws `PERMISSION_DENIED` if NONE of the permissions exist

---

## Frontend Enforcement

### Component: `<RequirePermission>`

**Location:** `admin-web/src/components/rbac/RequirePermission.tsx`

**Usage:**
```tsx
import RequirePermission from '@/components/rbac/RequirePermission'

function ProductsPage() {
  return (
    <div>
      <h1>Products</h1>

      <RequirePermission perm="products:write">
        <Button>Create Product</Button>
      </RequirePermission>

      <ProductList />
    </div>
  )
}
```

**Props:**
- `perm: string` - Required permission key
- `children: ReactNode` - Content to show if permission granted
- `fallback?: ReactNode` - Optional fallback UI (default: error alert)

**Behavior:**
- Shows loader while auth state hydrating
- Checks `useAuthStore().permissionsCurrentTenant` for permission
- Renders children if permission exists
- Renders fallback or default error message if permission missing

**Default Fallback:**
```tsx
<Alert color="red" variant="light" title="No access">
  You don't have permission to view this section.
</Alert>
```

### Hook: `usePermissions()`

**Location:** `admin-web/src/hooks/usePermissions.ts`

**Usage:**
```tsx
import { usePermissions } from '@/hooks/usePermissions'

function ProductActions() {
  const { hasPerm, hasAnyPerm } = usePermissions()

  return (
    <Menu>
      {hasPerm('products:write') && (
        <Menu.Item onClick={handleEdit}>Edit</Menu.Item>
      )}

      {hasAnyPerm(['products:write', 'tenant:manage']) && (
        <Menu.Item onClick={handleDelete}>Delete</Menu.Item>
      )}
    </Menu>
  )
}
```

**Returns:**
- `hasPerm(key: string): boolean` - Check single permission
- `hasAnyPerm(keys: string[]): boolean` - Check if ANY permission exists (OR)

**Implementation:**
```typescript
export function usePermissions() {
  const store = useAuthStore()

  return {
    hasPerm: (key: string) => store.hasPerm(key),
    hasAnyPerm: (keys: string[]) => store.hasAnyPerm(keys),
  }
}
```

### Route-Level Guards

**Location:** `admin-web/src/main.tsx`

**Usage:**
```tsx
{
  path: 'products',
  element: (
    <RequirePermission perm="products:read">
      <ProductsPage />
    </RequirePermission>
  ),
}
```

**Benefits:**
- Guards entire route with permission check
- Prevents unauthorized users from accessing route
- Shows error message if permission denied
- Cleaner than wrapping entire page component

---

## Permission Resolution

### Backend Flow

```
1. HTTP Request arrives
   ↓
2. sessionMiddleware decodes JWT → sets req.currentUserId, req.currentTenantId
   ↓
3. requirePermission() middleware checks req.currentPermissionKeys
   ↓
4. If not cached, query database:

   SELECT p.key
   FROM UserTenantMembership utm
   JOIN Role r ON utm.roleId = r.id
   JOIN RolePermission rp ON r.id = rp.roleId
   JOIN Permission p ON rp.permissionId = p.id
   WHERE utm.userId = ? AND utm.tenantId = ?

   ↓
5. Cache permissions in req.currentPermissionKeys (Set<PermissionKey>)
   ↓
6. Check if required permission in set
   ↓
7. Continue to route handler (if authorized) OR throw 403 (if denied)
```

**Performance Optimization:**
- Permissions cached per request in `req.currentPermissionKeys`
- Single database query per request (not per permission check)
- Set lookup is O(1)

### Frontend Flow

```
1. User signs in → POST /api/auth/sign-in
   ↓
2. Backend sets session cookie
   ↓
3. Frontend calls GET /api/auth/me
   ↓
4. Backend returns:
   {
     user: { id, email },
     currentTenant: { tenantId, tenantSlug, role },
     permissionsCurrentTenant: ['products:read', 'products:write', ...],
     ...
   }
   ↓
5. Frontend stores in Zustand auth store
   ↓
6. Components check store.hasPerm() or use <RequirePermission>
   ↓
7. Show/hide UI based on permissions
```

**Performance Optimization:**
- Permissions fetched once on app load (GET /api/auth/me)
- Stored in Zustand store (no prop drilling)
- No additional API calls for permission checks
- Instant UI updates (no loading states)

---

## Database Schema

### Permission Table

```prisma
model Permission {
  id          String @id @default(cuid())
  key         String @unique           // "products:read"
  description String                   // "View products"
  roles       RolePermission[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**Seeded via:** `api-server/scripts/seedPermissionsAndRoles.ts`

### Role Table

```prisma
model Role {
  id          String  @id @default(cuid())
  tenantId    String?                  // null = global template
  tenant      Tenant? @relation(...)
  name        String                   // "OWNER", "Custom Editor"
  description String?
  isSystem    Boolean @default(false)  // true for seeded roles
  permissions RolePermission[]
  memberships UserTenantMembership[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([tenantId, name])           // unique per tenant
  @@index([tenantId])
}
```

**System Roles:**
- `isSystem: true` - Cannot be deleted
- `tenantId: <tenant_id>` - Seeded for each tenant
- Names: `OWNER`, `ADMIN`, `EDITOR`, `VIEWER`

### RolePermission Table (Join)

```prisma
model RolePermission {
  roleId       String
  permissionId String
  role         Role       @relation(...)
  permission   Permission @relation(...)

  @@id([roleId, permissionId])
  @@index([permissionId])
}
```

**Delete Behavior:**
- Deleting role cascades to remove all permission mappings
- Deleting permission cascades to remove from all roles

---

## Permission Seeding

**Script:** `api-server/scripts/seedPermissionsAndRoles.ts`

**Run:**
```bash
npm run seed:rbac
```

**Flow:**
1. **Upsert global permissions** - Sync `PERMISSIONS` array to database
2. **For each tenant:**
   - Create/update system roles (OWNER, ADMIN, EDITOR, VIEWER)
   - Assign permissions based on `ROLE_DEFS` mapping
3. **Mark roles as system** - Set `isSystem: true` to prevent deletion

**Example:**
```typescript
// 1. Upsert permissions
for (const { key, description } of PERMISSIONS) {
  await prisma.permission.upsert({
    where: { key },
    update: { description },
    create: { key, description },
  })
}

// 2. Create roles for tenant
const tenant = await prisma.tenant.findUnique({ where: { tenantSlug: 'acme' } })

for (const [roleName, permKeys] of Object.entries(ROLE_DEFS)) {
  const role = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: roleName } },
    update: { isSystem: true },
    create: {
      tenantId: tenant.id,
      name: roleName,
      description: `System role: ${roleName}`,
      isSystem: true,
    },
  })

  // 3. Sync permissions
  const permissions = await prisma.permission.findMany({
    where: { key: { in: permKeys } },
  })

  for (const perm of permissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
      create: { roleId: role.id, permissionId: perm.id },
      update: {},
    })
  }
}
```

---

## Custom Roles (Tenant-Specific)

### Creating Custom Roles

**API Endpoint:** `POST /api/roles`

**Request Body:**
```json
{
  "name": "Warehouse Manager",
  "description": "Manages inventory at specific branches",
  "permissionKeys": [
    "products:read",
    "stock:read",
    "stock:write",
    "branches:manage"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "role_abc123",
    "tenantId": "tenant_xyz",
    "name": "Warehouse Manager",
    "description": "Manages inventory at specific branches",
    "isSystem": false,
    "permissions": [
      { "id": "perm_1", "key": "products:read", "description": "..." },
      { "id": "perm_2", "key": "stock:read", "description": "..." },
      ...
    ]
  }
}
```

**Validation Rules:**
- Role name must be unique per tenant
- Permission keys must exist in global catalog
- Cannot modify system roles (isSystem: true)
- Requires `roles:manage` permission

### Updating Custom Roles

**API Endpoint:** `PATCH /api/roles/:roleId`

**Request Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "permissionKeys": ["products:read", "stock:read"]
}
```

**Behavior:**
- Updates role metadata (name, description)
- Syncs permissions (adds missing, removes extra)
- Cannot update system roles
- Requires `roles:manage` permission

### Deleting Custom Roles

**API Endpoint:** `DELETE /api/roles/:roleId`

**Behavior:**
- Cannot delete system roles (isSystem: true)
- Cannot delete if users still assigned (throws error)
- Cascades to remove RolePermission mappings
- Requires `roles:manage` permission

---

## Assigning Roles to Users

### Inviting New Users

**API Endpoint:** `POST /api/tenant-users`

**Request Body:**
```json
{
  "userEmailAddress": "user@example.com",
  "roleId": "role_abc123"
}
```

**Flow:**
1. Check if user exists globally (by email)
2. If not, create new User with temporary password
3. Create UserTenantMembership with roleId
4. Send invitation email (future)

**Permissions Required:**
- `users:manage`

### Updating User Role

**API Endpoint:** `PATCH /api/tenant-users/:userId`

**Request Body:**
```json
{
  "roleId": "role_xyz789"
}
```

**Flow:**
1. Find UserTenantMembership for user in current tenant
2. Update roleId
3. User's permissions updated on next request

**Permissions Required:**
- `users:manage`

### Removing User from Tenant

**API Endpoint:** `DELETE /api/tenant-users/:userId`

**Flow:**
1. Delete UserTenantMembership
2. User can no longer access tenant
3. User still exists globally (can belong to other tenants)

**Permissions Required:**
- `users:manage`

---

## Security Considerations

### 1. Server-Side Enforcement

**NEVER trust client-side permission checks** - Always enforce on backend.

```typescript
// ❌ BAD - Client can bypass UI check
function deleteProduct() {
  if (!hasPerm('products:write')) return  // ← Bypassable
  await api.deleteProduct(productId)
}

// ✅ GOOD - Server enforces
router.delete('/products/:id',
  requirePermission('products:write'),  // ← Enforced
  deleteProduct
)
```

### 2. Tenant Isolation

**Always filter by tenantId** - Prevent cross-tenant access.

```typescript
// ❌ BAD - Exposes all tenants
const roles = await prisma.role.findMany()

// ✅ GOOD - Tenant-scoped
const roles = await prisma.role.findMany({
  where: { tenantId: req.currentTenantId },
})
```

### 3. System Role Protection

**Prevent modification of system roles:**

```typescript
if (role.isSystem) {
  throw Errors.validationError('Cannot modify system roles')
}
```

### 4. Permission Caching

**Cache permissions per request, not globally:**

```typescript
// ✅ GOOD - Request-scoped cache
req.currentPermissionKeys = await fetchPermissions(userId, tenantId)

// ❌ BAD - Global cache (stale permissions)
globalCache.set(userId, permissions)
```

**Rationale:** User permissions may change mid-session (role updated, user removed from tenant). Request-scoped cache ensures fresh permissions on each request.

### 5. Frontend UI Consistency

**Hide/disable UI elements** based on permissions to avoid confusing users.

```tsx
// ✅ GOOD - Consistent UI
{hasPerm('products:write') && (
  <Button onClick={handleDelete}>Delete</Button>
)}

// ❌ BAD - Confusing (button visible but disabled)
<Button
  disabled={!hasPerm('products:write')}
  onClick={handleDelete}
>
  Delete
</Button>
```

---

## Common Workflows

### Adding a New Permission

1. **Add to catalog** (`api-server/src/rbac/catalog.ts`):
   ```typescript
   export const PERMISSIONS = [
     ...
     { key: 'reports:view', description: 'View reports' },
   ]
   ```

2. **Assign to roles** (same file):
   ```typescript
   export const ROLE_DEFS = {
     OWNER: [..., 'reports:view'],
     ADMIN: [..., 'reports:view'],
     VIEWER: [..., 'reports:view'],
   }
   ```

3. **Seed database:**
   ```bash
   npm run seed:rbac
   ```

4. **Enforce in backend:**
   ```typescript
   router.get('/reports/sales',
     requirePermission('reports:view'),
     getSalesReport
   )
   ```

5. **Enforce in frontend:**
   ```tsx
   <RequirePermission perm="reports:view">
     <ReportsPage />
   </RequirePermission>
   ```

### Checking Permissions in Service Layer

**Avoid** - Permissions should be checked in middleware, not service layer.

```typescript
// ❌ BAD - Service layer permission check
async function deleteProduct(productId: string, userId: string) {
  const hasPermission = await checkPermission(userId, 'products:write')
  if (!hasPermission) throw new Error('Permission denied')
  ...
}

// ✅ GOOD - Middleware enforces, service assumes authorized
router.delete('/products/:id',
  requirePermission('products:write'),  // ← Enforce here
  deleteProduct
)

async function deleteProduct(req: Request) {
  // Assume req.currentUserId has permission
  const productId = req.params.id
  ...
}
```

**Rationale:** Separation of concerns. Middleware handles authz, service layer handles business logic.

---

## Testing RBAC

### Backend Testing

**Example: Test permission enforcement**

```typescript
describe('POST /api/products', () => {
  it('should require products:write permission', async () => {
    // User with VIEWER role (no products:write)
    const viewer = await createTestUser({ role: 'VIEWER' })
    const session = await signIn(viewer)

    const res = await request(app)
      .post('/api/products')
      .set('Cookie', session.cookie)
      .send({ productName: 'New Product', ... })
      .expect(403)

    expect(res.body.error.errorCode).toBe('PERMISSION_DENIED')
  })

  it('should allow users with products:write permission', async () => {
    const editor = await createTestUser({ role: 'EDITOR' })
    const session = await signIn(editor)

    const res = await request(app)
      .post('/api/products')
      .set('Cookie', session.cookie)
      .send({ productName: 'New Product', ... })
      .expect(200)

    expect(res.body.success).toBe(true)
  })
})
```

### Frontend Testing

**Example: Test component visibility**

```typescript
describe('ProductsPage', () => {
  it('should hide create button for viewers', () => {
    mockAuthStore({ permissionsCurrentTenant: ['products:read'] })

    render(<ProductsPage />)

    expect(screen.queryByText('Create Product')).not.toBeInTheDocument()
  })

  it('should show create button for editors', () => {
    mockAuthStore({
      permissionsCurrentTenant: ['products:read', 'products:write']
    })

    render(<ProductsPage />)

    expect(screen.getByText('Create Product')).toBeInTheDocument()
  })
})
```

---

## Troubleshooting

### Issue: User has permission but gets 403

**Possible Causes:**
1. Permission not seeded in database → Run `npm run seed:rbac`
2. Role not assigned permission → Check `RolePermission` table
3. User not assigned role → Check `UserTenantMembership.roleId`
4. Wrong tenant context → Check `req.currentTenantId`

**Debug Steps:**
```typescript
// 1. Check user's current tenant
console.log(req.currentUserId, req.currentTenantId)

// 2. Check user's role
const membership = await prisma.userTenantMembership.findUnique({
  where: { userId_tenantId: { userId, tenantId } },
  include: { role: true },
})
console.log(membership?.role)

// 3. Check role's permissions
const permissions = await prisma.rolePermission.findMany({
  where: { roleId: membership.roleId },
  include: { permission: true },
})
console.log(permissions.map(p => p.permission.key))
```

### Issue: Frontend shows UI but backend denies

**Cause:** Frontend permissions stale (not refreshed after role change).

**Solution:** Refresh auth state after role changes.

```typescript
// After updating user role
await updateUserRole(userId, newRoleId)
await authStore.refreshFromServer()  // ← Refresh frontend state
```

### Issue: System role modified/deleted

**Cause:** Missing `isSystem` check in update/delete endpoints.

**Solution:** Always check before modification:

```typescript
if (role.isSystem) {
  throw Errors.validationError('Cannot modify system roles')
}
```

---

## Related Documentation

- [Project Architecture](./project_architecture.md)
- [Database Schema Reference](./database_schema.md)

---

**Last Updated:** 2025-10-19
**Document Version:** 1.1
