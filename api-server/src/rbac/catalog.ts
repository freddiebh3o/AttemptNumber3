// api-server/src/rbac/catalog.ts
// Central RBAC catalog (single source of truth)

export const PERMISSIONS = [
  // Products
  { key: 'products:read',  description: 'View products' },
  { key: 'products:write', description: 'Create/update/delete products' },

  // Users / roles / tenancy
  { key: 'users:manage',   description: 'Invite or manage tenant users' },
  { key: 'roles:read',     description: 'View roles (for assignment)' },
  { key: 'roles:manage',   description: 'Create/edit roles and permissions' },
  { key: 'tenant:manage',  description: 'Manage tenant settings' },

  // Theme & uploads
  { key: 'theme:manage',   description: 'Manage tenant theme/branding' },
  { key: 'uploads:write',  description: 'Upload images/files' },

  // Features
  { key: 'features:read',   description: 'View feature settings' },
  { key: 'features:manage', description: 'Manage feature flags (AI chat, barcode scanning)' },

  { key: 'branches:manage', description: 'Manage branches and memberships' },
  { key: 'stock:read',      description: 'View branch stock, lots, and movements' },
  { key: 'stock:write',     description: 'Receive and adjust stock' },
  { key: 'stock:allocate',  description: 'Allocate/consume stock for orders' },

  // Reports & Analytics
  { key: 'reports:view',    description: 'View analytics reports and dashboards' },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]['key'];

// Default per-tenant roles (seeded/system roles)
export const ROLE_DEFS: Record<
  'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER',
  readonly PermissionKey[]
> = {
  OWNER: [
    'products:read','products:write',
    'users:manage','roles:read','roles:manage','tenant:manage',
    'theme:manage','uploads:write',
    'features:read','features:manage',
    'branches:manage','stock:read','stock:write','stock:allocate',
    'reports:view',
  ],
  ADMIN: [
    'products:read','products:write',
    'users:manage','roles:read',
    'theme:manage','uploads:write',
    'features:read',
    'branches:manage','stock:read','stock:write','stock:allocate',
    'reports:view',
  ],
  EDITOR: [
    'products:read','products:write','uploads:write',
    'features:read',
    'stock:read','stock:allocate',
  ],
  VIEWER: [
    'products:read',
    'features:read',
    'stock:read',
  ],
};
