import { NavLink, Stack, Text } from '@mantine/core';
import { Link, useLocation, useParams } from 'react-router-dom';

export default function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { tenantSlug } = useParams();
  const { pathname } = useLocation();

  const base = `/${tenantSlug ?? ''}`;
  const active = (to: string) => pathname === to;

  return (
    <Stack p="sm" gap="xs">
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

      <Text size="sm" c="dimmed" px="xs" mt="sm">System</Text>
    </Stack>
  );
}
