export const PERMISSION_KEYS = [
  // Products
  'products:read',
  'products:write',
  // Users / roles / tenancy
  'users:manage',
  'roles:manage',
  'tenant:manage',
  // Theme & uploads
  'theme:manage',
  'uploads:write',
  'branches:manage',
  'stock:read',
  'stock:write',
  'stock:allocate',
  // Reports & Analytics
  'reports:view',
] as const;

export type PermissionKey = typeof PERMISSION_KEYS[number];

export function hasPermission(set: Set<PermissionKey>, key: PermissionKey) {
  return set.has(key);
}
export function hasAnyPermission(set: Set<PermissionKey>, keys: PermissionKey[]) {
  return keys.some((k) => set.has(k));
}
