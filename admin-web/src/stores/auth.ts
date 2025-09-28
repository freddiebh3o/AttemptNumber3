// admin-web/src/stores/authStore.ts
import { create } from 'zustand';

type RoleName = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';

type Membership = {
  tenantSlug: string;
  roleName: RoleName;
};

type AuthState = {
  currentUserId: string | null;
  tenantMemberships: Membership[];
  currentTenantSlug: string | null;

  // setters
  setFromMe: (me: {
    currentUserId: string;
    tenantMemberships: Membership[];
    // currentTenantId not used here because /me doesn't include slug for it
  }) => void;
  setCurrentTenantSlug: (slug: string | null) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  currentUserId: null,
  tenantMemberships: [],
  currentTenantSlug: null,

  setFromMe: (me) =>
    set({
      currentUserId: me.currentUserId ?? null,
      tenantMemberships: me.tenantMemberships ?? [],
    }),

  setCurrentTenantSlug: (slug) => set({ currentTenantSlug: slug }),

  clear: () =>
    set({
      currentUserId: null,
      tenantMemberships: [],
      currentTenantSlug: null,
    }),
}));
