/* admin-web/src/components/shell/SidebarNav.tsx */
import { NavLink, Stack, Text, Image, Divider, Group, Box, Badge } from '@mantine/core';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useThemeStore } from '../../stores/theme';
import { useAuthStore } from '../../stores/auth';
import TenantSwitcher from './TenantSwitcher';

export default function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { tenantSlug } = useParams();
  const { pathname } = useLocation();
  const tenantKey = tenantSlug ?? 'default';

  const { logoUrl } = useThemeStore((s) => s.getFor(tenantKey));

  // Pull the fields your store actually has
  const currentUserEmail = useAuthStore((s) => s.currentUserEmail);
  const currentTenant = useAuthStore((s) => s.currentTenant);
  const tenantMemberships = useAuthStore((s) => s.tenantMemberships);

  // Prefer the store's currentTenant role; if not present/mismatched, find by URL slug
  const roleForThisTenant =
    (currentTenant?.tenantSlug === tenantSlug ? currentTenant?.roleName : undefined) ??
    tenantMemberships?.find((m) => m.tenantSlug === tenantSlug)?.roleName ??
    null;

  const base = tenantSlug ? `/${tenantSlug}` : '';
  const active = (to: string) => pathname === to;

  return (
    <Stack p="sm" gap="xs" style={{ height: '100%' }}>
      {/* Top nav */}
      <Stack gap="xs">
        <NavLink
          label="Products"
          component={Link}
          to={`${base}/products`}
          active={active(`${base}/products`)}
          onClick={onNavigate}
        />
        <NavLink
          label="Users"
          component={Link}
          to={`${base}/users`}
          active={active(`${base}/users`)}
          onClick={onNavigate}
        />

        <Text size="sm" c="dimmed" px="xs" mt="sm">
          System
        </Text>
        {/* Add more system links here later if needed */}
      </Stack>

      {/* Push footer to bottom */}
      <Box style={{ flex: 1 }} />

      {/* Bottom section: tenant switcher, user info, logo */}
      <Stack gap="xs">
        <Divider />

        {logoUrl && (
          <Box px="xs" pt="xs">
            <Image src={logoUrl} alt="Tenant logo" h={34} fit="contain" />
          </Box>
        )}

        <TenantSwitcher />

        {(currentUserEmail || roleForThisTenant) && (
          <Group justify="space-between" px="xs">
            {currentUserEmail ? (
              <Text size="xs" c="dimmed" lineClamp={1} title={currentUserEmail}>
                {currentUserEmail}
              </Text>
            ) : (
              <span />
            )}
            {roleForThisTenant ? (
              <Badge size="xs" variant="light">
                {roleForThisTenant}
              </Badge>
            ) : null}
          </Group>
        )}
      </Stack>
    </Stack>
  );
}
