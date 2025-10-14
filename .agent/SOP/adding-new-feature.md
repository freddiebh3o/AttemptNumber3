# SOP: Adding a New Feature

## Overview

This document outlines the step-by-step process for adding a new feature to the system, from database changes to frontend implementation.

---

## Example Scenario

**Goal:** Add a "Suppliers" feature to track product vendors.

**Requirements:**
- Suppliers table (name, email, phone, address)
- CRUD API endpoints
- Permission-based access control
- Frontend page to manage suppliers

---

## Step 1: Database Changes

### 1.1 Update Prisma Schema

**File:** `api-server/prisma/schema.prisma`

```prisma
model Supplier {
  id             String @id @default(cuid())
  tenantId       String
  tenant         Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  supplierName   String
  supplierEmail  String?
  supplierPhone  String?
  supplierAddress String?

  // Future: link to products
  // products      ProductSupplier[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenantId, supplierEmail])
  @@index([tenantId])
  @@index([tenantId, supplierName])
}

// Add relation to Tenant model
model Tenant {
  // ... existing fields
  suppliers Supplier[]
}
```

### 1.2 Regenerate Prisma Client

```bash
cd api-server
npm run prisma:generate
```

### 1.3 Create Migration

```bash
npm run db:migrate -- --name add_suppliers
```

**What this does:**
- Creates migration file in `prisma/migrations/`
- Applies migration to dev database
- Updates Prisma client types

### 1.4 Update Seed Data (Optional)

**File:** `api-server/prisma/seed.ts`

```typescript
// Add sample suppliers
const suppliers = await Promise.all([
  prisma.supplier.create({
    data: {
      tenantId: acmeTenant.id,
      supplierName: 'Coffee Beans Inc',
      supplierEmail: 'sales@coffeebeans.com',
      supplierPhone: '+1-555-0100',
    },
  }),
  prisma.supplier.create({
    data: {
      tenantId: acmeTenant.id,
      supplierName: 'Tea Traders Ltd',
      supplierEmail: 'info@teatraders.com',
    },
  }),
])
```

**Run seed:**
```bash
npm run db:seed
```

---

## Step 2: Add Permissions (If Needed)

### 2.1 Update RBAC Catalog

**File:** `api-server/src/rbac/catalog.ts`

```typescript
export const PERMISSIONS = [
  // ... existing permissions
  { key: 'suppliers:read',  description: 'View suppliers' },
  { key: 'suppliers:write', description: 'Create/update/delete suppliers' },
] as const
```

### 2.2 Assign to Roles

**File:** `api-server/src/rbac/catalog.ts`

```typescript
export const ROLE_DEFS = {
  OWNER: [
    // ... existing permissions
    'suppliers:read', 'suppliers:write',
  ],
  ADMIN: [
    // ... existing permissions
    'suppliers:read', 'suppliers:write',
  ],
  EDITOR: [
    // ... existing permissions
    'suppliers:read',
  ],
  VIEWER: [
    // ... existing permissions
    'suppliers:read',
  ],
}
```

### 2.3 Sync to Database

```bash
npm run seed:rbac
```

---

## Step 3: Backend Implementation

### 3.1 Create Service Layer

**File:** `api-server/src/services/suppliers/supplierService.ts`

```typescript
import { prismaClientInstance as prisma } from '../../db/prismaClient.js'
import { Errors } from '../../utils/httpErrors.js'

export async function listSuppliers(params: {
  tenantId: string
}) {
  return prisma.supplier.findMany({
    where: { tenantId: params.tenantId },
    orderBy: { supplierName: 'asc' },
    select: {
      id: true,
      supplierName: true,
      supplierEmail: true,
      supplierPhone: true,
      createdAt: true,
      updatedAt: true,
    },
  })
}

export async function getSupplier(params: {
  tenantId: string
  supplierId: string
}) {
  const supplier = await prisma.supplier.findFirst({
    where: {
      id: params.supplierId,
      tenantId: params.tenantId,
    },
  })

  if (!supplier) throw Errors.notFound('Supplier not found')
  return supplier
}

export async function createSupplier(params: {
  tenantId: string
  data: {
    supplierName: string
    supplierEmail?: string
    supplierPhone?: string
    supplierAddress?: string
  }
}) {
  return prisma.supplier.create({
    data: {
      tenantId: params.tenantId,
      ...params.data,
    },
  })
}

export async function updateSupplier(params: {
  tenantId: string
  supplierId: string
  data: {
    supplierName?: string
    supplierEmail?: string | null
    supplierPhone?: string | null
    supplierAddress?: string | null
  }
}) {
  const supplier = await getSupplier({
    tenantId: params.tenantId,
    supplierId: params.supplierId,
  })

  return prisma.supplier.update({
    where: { id: supplier.id },
    data: params.data,
  })
}

export async function deleteSupplier(params: {
  tenantId: string
  supplierId: string
}) {
  const supplier = await getSupplier({
    tenantId: params.tenantId,
    supplierId: params.supplierId,
  })

  await prisma.supplier.delete({
    where: { id: supplier.id },
  })
}
```

### 3.2 Create OpenAPI Schemas

**File:** `api-server/src/openapi/paths/suppliers.ts`

```typescript
import { z } from 'zod'
import { registry } from '../registry.js'

const SupplierSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  supplierName: z.string(),
  supplierEmail: z.string().email().nullable(),
  supplierPhone: z.string().nullable(),
  supplierAddress: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const CreateSupplierBodySchema = z.object({
  supplierName: z.string().min(1).max(255),
  supplierEmail: z.string().email().optional(),
  supplierPhone: z.string().max(50).optional(),
  supplierAddress: z.string().max(500).optional(),
})

const UpdateSupplierBodySchema = CreateSupplierBodySchema.partial()

// List suppliers
registry.registerPath({
  method: 'get',
  path: '/api/suppliers',
  tags: ['Suppliers'],
  summary: 'List all suppliers',
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.array(SupplierSchema),
          }),
        },
      },
    },
  },
})

// Get supplier
registry.registerPath({
  method: 'get',
  path: '/api/suppliers/{supplierId}',
  tags: ['Suppliers'],
  summary: 'Get supplier by ID',
  request: {
    params: z.object({ supplierId: z.string() }),
  },
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: SupplierSchema,
          }),
        },
      },
    },
  },
})

// Create supplier
registry.registerPath({
  method: 'post',
  path: '/api/suppliers',
  tags: ['Suppliers'],
  summary: 'Create a new supplier',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateSupplierBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: SupplierSchema,
          }),
        },
      },
    },
  },
})

// Update supplier
registry.registerPath({
  method: 'patch',
  path: '/api/suppliers/{supplierId}',
  tags: ['Suppliers'],
  summary: 'Update supplier',
  request: {
    params: z.object({ supplierId: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: UpdateSupplierBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: SupplierSchema,
          }),
        },
      },
    },
  },
})

// Delete supplier
registry.registerPath({
  method: 'delete',
  path: '/api/suppliers/{supplierId}',
  tags: ['Suppliers'],
  summary: 'Delete supplier',
  request: {
    params: z.object({ supplierId: z.string() }),
  },
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({ message: z.string() }),
          }),
        },
      },
    },
  },
})
```

### 3.3 Create Router

**File:** `api-server/src/routes/suppliersRouter.ts`

```typescript
import { Router } from 'express'
import { requireAuthenticatedUserMiddleware } from '../middleware/sessionMiddleware.js'
import { requirePermission } from '../middleware/permissionMiddleware.js'
import { validateRequest } from '../middleware/zodValidation.js'
import * as supplierService from '../services/suppliers/supplierService.js'
import { wrapSuccess } from '../utils/httpErrors.js'
import { z } from 'zod'

export const suppliersRouter = Router()

const CreateSupplierBodySchema = z.object({
  supplierName: z.string().min(1).max(255),
  supplierEmail: z.string().email().optional(),
  supplierPhone: z.string().max(50).optional(),
  supplierAddress: z.string().max(500).optional(),
})

const UpdateSupplierBodySchema = CreateSupplierBodySchema.partial()

// List suppliers
suppliersRouter.get(
  '/',
  requireAuthenticatedUserMiddleware,
  requirePermission('suppliers:read'),
  async (req, res, next) => {
    try {
      const suppliers = await supplierService.listSuppliers({
        tenantId: req.currentTenantId!,
      })
      res.json(wrapSuccess(suppliers))
    } catch (e) {
      next(e)
    }
  }
)

// Get supplier
suppliersRouter.get(
  '/:supplierId',
  requireAuthenticatedUserMiddleware,
  requirePermission('suppliers:read'),
  async (req, res, next) => {
    try {
      const supplier = await supplierService.getSupplier({
        tenantId: req.currentTenantId!,
        supplierId: req.params.supplierId,
      })
      res.json(wrapSuccess(supplier))
    } catch (e) {
      next(e)
    }
  }
)

// Create supplier
suppliersRouter.post(
  '/',
  requireAuthenticatedUserMiddleware,
  requirePermission('suppliers:write'),
  validateRequest({ body: CreateSupplierBodySchema }),
  async (req, res, next) => {
    try {
      const supplier = await supplierService.createSupplier({
        tenantId: req.currentTenantId!,
        data: req.body,
      })
      res.json(wrapSuccess(supplier))
    } catch (e) {
      next(e)
    }
  }
)

// Update supplier
suppliersRouter.patch(
  '/:supplierId',
  requireAuthenticatedUserMiddleware,
  requirePermission('suppliers:write'),
  validateRequest({ body: UpdateSupplierBodySchema }),
  async (req, res, next) => {
    try {
      const supplier = await supplierService.updateSupplier({
        tenantId: req.currentTenantId!,
        supplierId: req.params.supplierId,
        data: req.body,
      })
      res.json(wrapSuccess(supplier))
    } catch (e) {
      next(e)
    }
  }
)

// Delete supplier
suppliersRouter.delete(
  '/:supplierId',
  requireAuthenticatedUserMiddleware,
  requirePermission('suppliers:write'),
  async (req, res, next) => {
    try {
      await supplierService.deleteSupplier({
        tenantId: req.currentTenantId!,
        supplierId: req.params.supplierId,
      })
      res.json(wrapSuccess({ message: 'Supplier deleted successfully' }))
    } catch (e) {
      next(e)
    }
  }
)
```

### 3.4 Register Router

**File:** `api-server/src/routes/index.ts`

```typescript
import { suppliersRouter } from './suppliersRouter.js'

// ... existing imports

export const apiRouter = Router()

// ... existing routes
apiRouter.use('/suppliers', suppliersRouter)
```

### 3.5 Restart API Server

```bash
# In api-server directory
npm run dev
```

**Verify OpenAPI spec updated:**
- Visit `http://localhost:4000/docs`
- Check for "Suppliers" tag with CRUD endpoints

---

## Step 4: Frontend Implementation

### 4.1 Regenerate TypeScript Types

```bash
# In admin-web directory
npm run openapi:gen
```

**What this does:**
- Fetches `/openapi.json` from API server
- Generates `src/types/openapi.d.ts` with type-safe paths

### 4.2 Create API Client Module

**File:** `admin-web/src/api/suppliers.ts`

```typescript
import type { paths } from '@/types/openapi'
import { httpClient } from './http'

type Supplier = paths['/api/suppliers']['get']['responses']['200']['content']['application/json']['data'][0]
type CreateSupplierBody = paths['/api/suppliers']['post']['requestBody']['content']['application/json']
type UpdateSupplierBody = paths['/api/suppliers/{supplierId}']['patch']['requestBody']['content']['application/json']

export async function listSuppliersApiRequest() {
  return httpClient<{ success: true; data: Supplier[] }>('/api/suppliers', {
    method: 'GET',
  })
}

export async function getSupplierApiRequest(supplierId: string) {
  return httpClient<{ success: true; data: Supplier }>(`/api/suppliers/${supplierId}`, {
    method: 'GET',
  })
}

export async function createSupplierApiRequest(data: CreateSupplierBody) {
  return httpClient<{ success: true; data: Supplier }>('/api/suppliers', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateSupplierApiRequest(supplierId: string, data: UpdateSupplierBody) {
  return httpClient<{ success: true; data: Supplier }>(`/api/suppliers/${supplierId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteSupplierApiRequest(supplierId: string) {
  return httpClient<{ success: true; data: { message: string } }>(`/api/suppliers/${supplierId}`, {
    method: 'DELETE',
  })
}
```

### 4.3 Create Page Component

**File:** `admin-web/src/pages/SuppliersPage.tsx`

```tsx
import { useState, useEffect } from 'react'
import { Container, Title, Button, Table, Group, Modal, TextInput, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { usePermissions } from '@/hooks/usePermissions'
import { listSuppliersApiRequest, createSupplierApiRequest, deleteSupplierApiRequest } from '@/api/suppliers'

export default function SuppliersPage() {
  const { hasPerm } = usePermissions()
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    supplierName: '',
    supplierEmail: '',
    supplierPhone: '',
  })

  const loadSuppliers = async () => {
    try {
      setLoading(true)
      const res = await listSuppliersApiRequest()
      setSuppliers(res.data)
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: 'Failed to load suppliers',
        color: 'red',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSuppliers()
  }, [])

  const handleCreate = async () => {
    try {
      await createSupplierApiRequest(formData)
      notifications.show({
        title: 'Success',
        message: 'Supplier created successfully',
        color: 'green',
      })
      setModalOpen(false)
      setFormData({ supplierName: '', supplierEmail: '', supplierPhone: '' })
      loadSuppliers()
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: 'Failed to create supplier',
        color: 'red',
      })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this supplier?')) return

    try {
      await deleteSupplierApiRequest(id)
      notifications.show({
        title: 'Success',
        message: 'Supplier deleted successfully',
        color: 'green',
      })
      loadSuppliers()
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: 'Failed to delete supplier',
        color: 'red',
      })
    }
  }

  return (
    <Container size="xl">
      <Group justify="space-between" mb="md">
        <Title order={2}>Suppliers</Title>
        {hasPerm('suppliers:write') && (
          <Button onClick={() => setModalOpen(true)}>Create Supplier</Button>
        )}
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Email</Table.Th>
            <Table.Th>Phone</Table.Th>
            {hasPerm('suppliers:write') && <Table.Th>Actions</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {suppliers.map((supplier) => (
            <Table.Tr key={supplier.id}>
              <Table.Td>{supplier.supplierName}</Table.Td>
              <Table.Td>{supplier.supplierEmail || '-'}</Table.Td>
              <Table.Td>{supplier.supplierPhone || '-'}</Table.Td>
              {hasPerm('suppliers:write') && (
                <Table.Td>
                  <Button size="xs" color="red" onClick={() => handleDelete(supplier.id)}>
                    Delete
                  </Button>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Create Supplier">
        <Stack>
          <TextInput
            label="Supplier Name"
            required
            value={formData.supplierName}
            onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
          />
          <TextInput
            label="Email"
            type="email"
            value={formData.supplierEmail}
            onChange={(e) => setFormData({ ...formData, supplierEmail: e.target.value })}
          />
          <TextInput
            label="Phone"
            value={formData.supplierPhone}
            onChange={(e) => setFormData({ ...formData, supplierPhone: e.target.value })}
          />
          <Button onClick={handleCreate}>Create</Button>
        </Stack>
      </Modal>
    </Container>
  )
}
```

### 4.4 Register Route

**File:** `admin-web/src/main.tsx`

```tsx
import SuppliersPage from './pages/SuppliersPage'
import RequirePermission from './components/rbac/RequirePermission'

// ... existing imports

const router = createBrowserRouter([
  {
    path: ':tenantSlug',
    element: <AdminLayout />,
    children: [
      // ... existing routes
      {
        path: 'suppliers',
        element: (
          <RequirePermission perm="suppliers:read">
            <SuppliersPage />
          </RequirePermission>
        ),
        errorElement: <RouteErrorBoundary />,
      },
    ],
  },
])
```

### 4.5 Add Navigation Link (Optional)

**File:** `admin-web/src/components/shell/AdminLayout.tsx`

```tsx
import { usePermissions } from '@/hooks/usePermissions'

function AdminLayout() {
  const { hasPerm } = usePermissions()

  return (
    // ... existing layout
    <NavLink
      to={`/${tenantSlug}/suppliers`}
      label="Suppliers"
      leftSection={<IconTruck />}
      display={hasPerm('suppliers:read') ? 'block' : 'none'}
    />
  )
}
```

---

## Step 5: Testing

### 5.1 Backend Testing (Optional)

**File:** `api-server/src/routes/__tests__/suppliersRouter.test.ts`

```typescript
import request from 'supertest'
import { app } from '../../app'
import { signInTestUser, createTestTenant } from '../testHelpers'

describe('Suppliers API', () => {
  let tenant, session

  beforeAll(async () => {
    tenant = await createTestTenant()
    session = await signInTestUser({ role: 'ADMIN', tenantId: tenant.id })
  })

  it('should create a supplier', async () => {
    const res = await request(app)
      .post('/api/suppliers')
      .set('Cookie', session.cookie)
      .send({
        supplierName: 'Test Supplier',
        supplierEmail: 'test@example.com',
      })
      .expect(200)

    expect(res.body.success).toBe(true)
    expect(res.body.data.supplierName).toBe('Test Supplier')
  })

  it('should list suppliers', async () => {
    const res = await request(app)
      .get('/api/suppliers')
      .set('Cookie', session.cookie)
      .expect(200)

    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })
})
```

**Run tests:**
```bash
npm run test:accept
```

### 5.2 Frontend Testing (Optional)

**File:** `admin-web/e2e/suppliers.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test('create and delete supplier', async ({ page }) => {
  // Sign in
  await page.goto('/sign-in')
  await page.fill('[name=email]', 'admin@example.com')
  await page.fill('[name=password]', 'password')
  await page.click('button[type=submit]')

  // Navigate to suppliers
  await page.goto('/acme/suppliers')

  // Create supplier
  await page.click('text=Create Supplier')
  await page.fill('[label="Supplier Name"]', 'Test Supplier')
  await page.fill('[label="Email"]', 'test@example.com')
  await page.click('button:has-text("Create")')
  await expect(page.getByText('Supplier created successfully')).toBeVisible()

  // Verify in list
  await expect(page.getByText('Test Supplier')).toBeVisible()

  // Delete supplier
  await page.click('button:has-text("Delete")')
  await page.click('button:has-text("OK")')  // Confirm dialog
  await expect(page.getByText('Supplier deleted successfully')).toBeVisible()
})
```

**Run tests:**
```bash
npm run test:accept:ui
```

---

## Checklist

- [ ] Database schema updated (`schema.prisma`)
- [ ] Prisma client regenerated (`npm run prisma:generate`)
- [ ] Migration created and applied (`npm run db:migrate`)
- [ ] Permissions added to RBAC catalog (if needed)
- [ ] Permissions seeded to database (`npm run seed:rbac`)
- [ ] Service layer created (`supplierService.ts`)
- [ ] OpenAPI schemas defined (`openapi/paths/suppliers.ts`)
- [ ] Router created (`suppliersRouter.ts`)
- [ ] Router registered in `routes/index.ts`
- [ ] API server restarted
- [ ] OpenAPI spec verified (`/docs`)
- [ ] Frontend types regenerated (`npm run openapi:gen`)
- [ ] API client module created (`api/suppliers.ts`)
- [ ] Page component created (`pages/SuppliersPage.tsx`)
- [ ] Route registered in `main.tsx`
- [ ] Navigation link added (optional)
- [ ] Backend tests written and passing (optional)
- [ ] Frontend tests written and passing (optional)

---

## Common Issues

### Issue: Prisma client out of sync

**Error:** `Property 'supplier' does not exist on type 'PrismaClient'`

**Solution:** Regenerate Prisma client
```bash
npm run prisma:generate
```

### Issue: OpenAPI types not updated

**Error:** `Type 'suppliers' does not exist on paths`

**Solution:**
1. Restart API server (to rebuild OpenAPI spec)
2. Regenerate frontend types
```bash
npm run openapi:gen
```

### Issue: Permission denied (403)

**Possible causes:**
- Permission not seeded → Run `npm run seed:rbac`
- Role not assigned permission → Check `ROLE_DEFS` in `catalog.ts`
- User missing permission → Check user's role in database

---

## Related Documentation

- [Database Schema Reference](../System/database_schema.md)
- [RBAC System Design](../System/rbac_system.md)
- [Project Architecture](../System/project_architecture.md)

---

**Last Updated:** 2025-10-11
**Document Version:** 1.0
