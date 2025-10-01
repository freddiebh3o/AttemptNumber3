// admin-web/src/stores/auth.ts
import { create } from "zustand";
import { meApiRequest, switchTenantApiRequest } from "../api/auth";

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
      set({
        hydrated: true,
        currentUserId: d.user.id ?? null,
        currentUserEmail: d.user.userEmailAddress ?? null,
        tenantMemberships: d.tenantMemberships.map((m) => ({
          tenantSlug: m.tenantSlug,
          // RoleBrief from the API has { id, name } — matches RoleLite structurally.
          role: m.role ?? null,
        })),
        currentTenant: d.currentTenant
          ? {
              tenantId: d.currentTenant.tenantId,
              tenantSlug: d.currentTenant.tenantSlug,
              role: d.currentTenant.role ?? null,
            }
          : null,
        currentTenantSlug: d.currentTenant?.tenantSlug ?? null,
        permissionsCurrentTenant: d.permissionsCurrentTenant ?? [],
      });
    } catch {
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
  
  async applySwitchTenant(tenantSlug: string) {
    set({ currentTenantSlug: tenantSlug });
    try {
      await switchTenantApiRequest({ tenantSlug }); 
    } finally {
      await get().refreshFromServer();
    }
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
