/* admin-web/src/components/shell/SidebarNav.tsx */
import { NavLink, Stack, Text, Image, Box, Divider, Group } from "@mantine/core";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  IconTruckDelivery,
  IconPackage,
  IconUsers,
  IconPalette,
  IconShield,
  IconBuilding,
  IconHistory,
  IconTemplate,
  IconUserCog,
  IconChecklist,
  IconChartLine,
  IconSettings,
  IconPackageExport,
  IconMessageCircle,
} from "@tabler/icons-react";
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
            leftSection={<IconPackage size={16} />}
          />
        )}

        {hasPerm("stock:read") && (
          <NavLink
            label="Stock Management"
            leftSection={<IconPackageExport size={16} />}
            childrenOffset={28}
          >
            <NavLink
              label="Stock Transfers"
              component={Link}
              to={`${base}/stock-transfers`}
              active={active(`${base}/stock-transfers`)}
              onClick={onNavigate}
              leftSection={<IconTruckDelivery size={16} />}
            />
            <NavLink
              label="Transfer Templates"
              component={Link}
              to={`${base}/stock-transfers/templates`}
              active={active(`${base}/stock-transfers/templates`)}
              onClick={onNavigate}
              leftSection={<IconTemplate size={16} />}
            />
            {hasPerm("stock:write") && (
              <NavLink
                label="Approval Rules"
                component={Link}
                to={`${base}/stock-transfers/approval-rules`}
                active={active(`${base}/stock-transfers/approval-rules`)}
                onClick={onNavigate}
                leftSection={<IconChecklist size={16} />}
              />
            )}
            {hasPerm("reports:view") && (
              <NavLink
                label="Analytics"
                component={Link}
                to={`${base}/stock-transfers/analytics`}
                active={active(`${base}/stock-transfers/analytics`)}
                onClick={onNavigate}
                leftSection={<IconChartLine size={16} />}
              />
            )}
          </NavLink>
        )}

        {(hasPerm("users:manage") || hasPerm("roles:manage")) && (
          <NavLink
            label="User Management"
            leftSection={<IconUserCog size={16} />}
            childrenOffset={28}
          >
            {hasPerm("users:manage") && (
              <NavLink
                label="Users"
                component={Link}
                to={`${base}/users`}
                active={active(`${base}/users`)}
                onClick={onNavigate}
                leftSection={<IconUsers size={16} />}
              />
            )}
            {hasPerm("roles:manage") && (
              <NavLink
                label="Roles"
                component={Link}
                to={`${base}/roles`}
                active={active(`${base}/roles`)}
                onClick={onNavigate}
                leftSection={<IconShield size={16} />}
              />
            )}
          </NavLink>
        )}

        {hasPerm("branches:manage") && (
          <NavLink
            label="Branches"
            component={Link}
            to={`${base}/branches`}
            active={active(`${base}/branches`)}
            onClick={onNavigate}
            leftSection={<IconBuilding size={16} />}
          />
        )}

        {(hasPerm("theme:manage") || hasPerm("users:manage") || hasPerm("reports:view")) && (
          <NavLink
            label="System"
            leftSection={<IconSettings size={16} />}
            childrenOffset={28}
            data-testid="nav-system"
          >
            {hasPerm("theme:manage") && (
              <NavLink
                label="Theme"
                component={Link}
                to={`${base}/settings/theme?tab=settings`}
                active={active(`${base}/settings/theme`)}
                onClick={onNavigate}
                leftSection={<IconPalette size={16} />}
              />
            )}
            {hasPerm("users:manage") && (
              <NavLink
                label="Audit log"
                component={Link}
                to={`${base}/audit`}
                active={active(`${base}/audit`)}
                onClick={onNavigate}
                leftSection={<IconHistory size={16} />}
              />
            )}
            {hasPerm("reports:view") && (
              <NavLink
                label="Chat Analytics"
                component={Link}
                to={`${base}/chat-analytics`}
                active={active(`${base}/chat-analytics`)}
                onClick={onNavigate}
                leftSection={<IconMessageCircle size={16} />}
                data-testid="nav-chat-analytics"
              />
            )}
          </NavLink>
        )}
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
