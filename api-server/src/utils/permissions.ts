// api-server/src/utils/permissions.ts
// Central place for permission keys + roleName fallback mapping

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
  ] as const;
  
  export type PermissionKey = typeof PERMISSION_KEYS[number];
  
  // Back-compat while we still have RoleName on memberships
  // (Keep in sync with your seeder ROLE_DEFS)
  export const ROLE_NAME_TO_PERMS: Record<string, PermissionKey[]> = {
    OWNER:  ['products:read','products:write','users:manage','roles:manage','tenant:manage','theme:manage','uploads:write'],
    ADMIN:  ['products:read','products:write','users:manage','roles:manage','tenant:manage','theme:manage','uploads:write'],
    EDITOR: ['products:read','products:write','uploads:write'],
    VIEWER: ['products:read'],
  };
  
  // tiny helpers
  export function hasPermission(set: Set<PermissionKey>, key: PermissionKey) {
    return set.has(key);
  }
  
  export function hasAnyPermission(set: Set<PermissionKey>, keys: PermissionKey[]) {
    return keys.some(k => set.has(k));
  }
  