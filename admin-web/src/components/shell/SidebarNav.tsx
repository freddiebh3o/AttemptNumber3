/* admin-web/src/components/shell/SidebarNav.tsx */
import { NavLink, Stack, Text, Image, Box, Divider, Group } from "@mantine/core";
import { Link, useLocation, useParams } from "react-router-dom";
import { useThemeStore } from "../../stores/theme";
import { useAuthStore } from "../../stores/auth";
import { usePermissions } from "../../hooks/usePermissions"; // <-- add
import TenantSwitcher from './TenantSwitcher';

export default function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { tenantSlug } = useParams();
  const { pathname } = useLocation();
  const tenantKey = tenantSlug ?? "default";
  const { logoUrl } = useThemeStore((s) => s.getFor(tenantKey));

  const base = `/${tenantSlug ?? ""}`;
  const active = (to: string) => pathname === to;

  const userEmail = useAuthStore((s) => s.currentUserEmail);
  const { hasPerm } = usePermissions(); // uses current perms

  return (
    <Stack p="sm" gap="xs" style={{ height: "100%" }}>
      <Stack gap="xs" style={{ flexGrow: 1 }}>
        {hasPerm("products:read") && (
          <NavLink
            label="Products"
            component={Link}
            to={`${base}/products`}
            active={active(`${base}/products`)}
            onClick={onNavigate}
          />
        )}

        {hasPerm("users:manage") && (
          <NavLink
            label="Users"
            component={Link}
            to={`${base}/users`}
            active={active(`${base}/users`)}
            onClick={onNavigate}
          />
        )}

        {hasPerm("theme:manage") && (
          <NavLink
            label="Theme"
            component={Link}
            to={`${base}/settings/theme?tab=settings`}
            active={active(`${base}/settings/theme`)}
            onClick={onNavigate}
          />
        )}

        {hasPerm("roles:manage") && (
          <NavLink
            label="Roles"
            component={Link}
            to={`${base}/roles`}
            active={active(`${base}/roles`)}
            onClick={onNavigate}
          />
        )}

        {hasPerm("branches:manage") && (
          <NavLink
            label="Branches"
            component={Link}
            to={`${base}/branches`}
            active={active(`${base}/branches`)}
            onClick={onNavigate}
          />
        )}

        {/* --- NEW: Audit log (admins) --- */}
        {hasPerm("users:manage") && (
          <NavLink
            label="Audit log"
            component={Link}
            to={`${base}/audit`}
            active={active(`${base}/audit`)}
            onClick={onNavigate}
          />
        )}

        <Text size="sm" c="dimmed" px="xs" mt="sm">
          System
        </Text>
      </Stack>

      <Divider />

      <TenantSwitcher />

      <Group justify="space-between" px="xs">
        <Text size="xs" c="dimmed" lineClamp={1}>
          {userEmail}
        </Text>
      </Group>

      {logoUrl && (
        <Box px="xs" pt="xs">
          <Image src={logoUrl} alt="Tenant logo" h={34} fit="contain" />
        </Box>
      )}
    </Stack>
  );
}
