// admin-web/src/stores/auth.ts
import { create } from "zustand";
import { meApiRequest } from "../api/auth";

type RoleLite = { id: string; name: string };

type TenantMembership = {
  tenantSlug: string;
  role: RoleLite | null; // comes from /auth/me
};

type CurrentTenant =
  | {
      tenantId: string;
      tenantSlug: string;
      role: RoleLite | null; // comes from /auth/me
    }
  | null;

type AuthState = {
  hydrated: boolean;

  currentUserId: string | null;
  currentUserEmail: string | null;

  tenantMemberships: TenantMembership[];
  currentTenant: CurrentTenant;
  currentTenantSlug: string | null;

  // Permissions for the current tenant
  permissionsCurrentTenant: string[];

  // Actions
  refreshFromServer: () => Promise<void>;
  applySwitchTenant: (tenantSlug: string) => Promise<void>;
  clear: () => void;

  // Convenience
  hasPerm: (key: string) => boolean;
  hasAnyPerm: (keys: string[]) => boolean;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  hydrated: false,

  currentUserId: null,
  currentUserEmail: null,

  tenantMemberships: [],
  currentTenant: null,
  currentTenantSlug: null,

  permissionsCurrentTenant: [],

  async refreshFromServer() {
    try {
      const resp = await meApiRequest();
      const d = resp.data;

      const memberships: TenantMembership[] = (d.tenantMemberships ?? []).map(
        (m: any) => ({
          tenantSlug: m.tenantSlug,
          role: m.role
            ? { id: m.role.id as string, name: m.role.name as string }
            : null,
        })
      );

      const current: CurrentTenant = d.currentTenant
        ? {
            tenantId: d.currentTenant.tenantId,
            tenantSlug: d.currentTenant.tenantSlug,
            role: d.currentTenant.role
              ? {
                  id: d.currentTenant.role.id as string,
                  name: d.currentTenant.role.name as string,
                }
              : null,
          }
        : null;

      set({
        hydrated: true,
        currentUserId: d.user?.id ?? null,
        currentUserEmail: d.user?.userEmailAddress ?? null,
        tenantMemberships: memberships,
        currentTenant: current,
        currentTenantSlug: current?.tenantSlug ?? null,
        permissionsCurrentTenant: d.permissionsCurrentTenant ?? [],
      });
    } catch {
      // Even on error/401, mark hydrated so the UI can show sign-in routes, etc.
      set({
        hydrated: true,
        currentUserId: null,
        currentUserEmail: null,
        tenantMemberships: [],
        currentTenant: null,
        currentTenantSlug: null,
        permissionsCurrentTenant: [],
      });
    }
  },

  async applySwitchTenant(_tenantSlug: string) {
    // After /auth/switch-tenant succeeds, just refetch /me
    await get().refreshFromServer();
  },

  clear() {
    set({
      hydrated: true,
      currentUserId: null,
      currentUserEmail: null,
      tenantMemberships: [],
      currentTenant: null,
      currentTenantSlug: null,
      permissionsCurrentTenant: [],
    });
  },

  hasPerm(key: string) {
    return get().permissionsCurrentTenant.includes(key);
  },

  hasAnyPerm(keys: string[]) {
    const setPerms = new Set(get().permissionsCurrentTenant);
    return keys.some((k) => setPerms.has(k));
  },
}));
