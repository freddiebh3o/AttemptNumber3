// admin-web/src/components/rbac/RequirePermission.tsx
import type { ReactNode } from "react";
import { Alert, Center, Loader } from "@mantine/core";
import { usePermissions } from "../../hooks/usePermissions";
import { useAuthStore } from "../../stores/auth";

export default function RequirePermission({
  perm,
  children,
  fallback,
}: {
  perm: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const hydrated = useAuthStore((s) => s.hydrated);
  const { hasPerm } = usePermissions();

  if (!hydrated) {
    return (
      <Center mih={160}>
        <Loader />
      </Center>
    );
  }

  if (hasPerm(perm)) return <>{children}</>;

  return (
    <>
      {fallback ?? (
        <Alert color="red" variant="light" title="No access">
          You don't have permission to view this section.
        </Alert>
      )}
    </>
  );
}