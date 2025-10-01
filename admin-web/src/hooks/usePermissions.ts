// admin-web/src/hooks/usePermissions.ts
import { useAuthStore } from "../stores/auth";

export function usePermissions() {
  const hasPerm = useAuthStore((s) => s.hasPerm);
  const hasAnyPerm = useAuthStore((s) => s.hasAnyPerm);
  const perms = useAuthStore((s) => s.permissionsCurrentTenant);
  return { hasPerm, hasAnyPerm, perms };
}
