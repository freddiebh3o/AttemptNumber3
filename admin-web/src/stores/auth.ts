// admin-web/src/stores/auth.ts
import { create } from 'zustand';

export type RoleName = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';

export type Membership = {
  tenantSlug: string;
  roleName: RoleName;
};

export type CurrentTenant = {
  tenantId: string;
  tenantSlug: string;
  roleName: RoleName;
} | null;

type AuthState = {
  // user
  currentUserId: string | null;
  currentUserEmail: string | null;

  // tenant context
  tenantMemberships: Membership[];
  currentTenant: CurrentTenant;         // richer than just slug
  currentTenantSlug: string | null;     // kept for convenience/URL sync

  // lifecycle
  hydrated: boolean;                    // has /me been applied?

  // setters
  setFromMe: (me: {
    user: { id: string; userEmailAddress: string };
    tenantMemberships: Membership[];
    currentTenant: CurrentTenant;
  }) => void;

  setCurrentTenantSlug: (slug: string | null) => void; // keeps slug & currentTenant in sync when possible
  clear: () => void;

  // helpers/selectors
  roleFor: (tenantSlug: string | null | undefined) => RoleName | null;
  isAdminOrOwnerForCurrent: () => boolean;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUserId: null,
  currentUserEmail: null,

  tenantMemberships: [],
  currentTenant: null,
  currentTenantSlug: null,

  hydrated: false,

  setFromMe: (me) =>
    set(() => ({
      currentUserId: me.user?.id ?? null,
      currentUserEmail: me.user?.userEmailAddress ?? null,
      tenantMemberships: me.tenantMemberships ?? [],
      currentTenant: me.currentTenant ?? null,
      currentTenantSlug: me.currentTenant?.tenantSlug ?? null,
      hydrated: true,
    })),

  setCurrentTenantSlug: (slug) =>
    set((s) => {
      // try to keep currentTenant in sync with the chosen slug if membership exists
      const match = slug
        ? s.tenantMemberships.find((m) => m.tenantSlug === slug)
        : undefined;
      const nextTenant: CurrentTenant =
        slug && match
          ? {
              tenantId: s.currentTenant?.tenantId ?? '', // unknown id until /me refresh after server switch
              tenantSlug: slug,
              roleName: match.roleName,
            }
          : s.currentTenant && s.currentTenant.tenantSlug === slug
          ? s.currentTenant
          : null;

      return {
        currentTenantSlug: slug,
        currentTenant: nextTenant,
      };
    }),

  clear: () =>
    set({
      currentUserId: null,
      currentUserEmail: null,
      tenantMemberships: [],
      currentTenant: null,
      currentTenantSlug: null,
      hydrated: false,
    }),

  roleFor: (tenantSlug) => {
    if (!tenantSlug) return null;
    const m = get().tenantMemberships.find((x) => x.tenantSlug === tenantSlug);
    return m?.roleName ?? null;
  },

  isAdminOrOwnerForCurrent: () => {
    const cur = get().currentTenant;
    return cur?.roleName === 'ADMIN' || cur?.roleName === 'OWNER';
  },
}));
