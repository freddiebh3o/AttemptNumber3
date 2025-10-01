// admin-web/src/stores/auth.ts
import { create } from "zustand";
import { meApiRequest } from "../api/auth";

type RoleName = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

type TenantMembership = { tenantSlug: string; roleName: RoleName | null };
type CurrentTenant = { tenantId: string; tenantSlug: string; roleName: RoleName | null } | null;

type AuthState = {
  hydrated: boolean;

  currentUserId: string | null;
  currentUserEmail: string | null;

  tenantMemberships: TenantMembership[];
  currentTenant: CurrentTenant;
  currentTenantSlug: string | null;

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
          roleName: m.roleName ?? null,
        })),
        currentTenant: d.currentTenant
          ? {
              tenantId: d.currentTenant.tenantId,
              tenantSlug: d.currentTenant.tenantSlug,
              roleName: d.currentTenant.roleName ?? null,
            }
          : null,
        currentTenantSlug: d.currentTenant?.tenantSlug ?? null,
        permissionsCurrentTenant: d.permissionsCurrentTenant ?? [],
      });
    } catch (_err) {
      // On error (incl. 401), still mark hydrated so UI can react (e.g. show sign-in or “no access”)
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
