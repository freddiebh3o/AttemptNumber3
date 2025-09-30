// admin-web/src/components/shell/HeaderBar.tsx
import { Group, Text, Burger, Box, Button, ActionIcon, Tooltip, useComputedColorScheme, useMantineColorScheme, Image } from '@mantine/core';
import { IconSun, IconMoon, IconPalette } from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import TenantSwitcher from './TenantSwitcher';
import { signOutApiRequest } from '../../api/auth';
import { useAuthStore } from '../../stores/auth';
import { useThemeStore } from '../../stores/theme';

export default function HeaderBar({
  opened,
  onBurgerClick,
}: {
  opened: boolean;
  onBurgerClick: () => void;
}) {
  const navigate = useNavigate();
  const { tenantSlug } = useParams();
  const tenantKey = tenantSlug ?? 'default';
  const { logoUrl } = useThemeStore((s) => s.getFor(tenantKey));

  const clearAuth = useAuthStore((s) => s.clear);

  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light');
  const isLight = computedColorScheme === 'light';

  async function handleSignOut() {
    try { await signOutApiRequest(); } catch {} finally {
      clearAuth();
      navigate('/sign-in');
    }
  }

  function toggleScheme() {
    setColorScheme(isLight ? 'dark' : 'light');
  }

  return (
    <Group h="100%" px="md" justify="space-between" wrap="nowrap">
      <Group gap="sm" align="center">
        <Burger opened={opened} onClick={onBurgerClick} aria-label="Toggle navigation" />
        {logoUrl ? (
          <Image src={logoUrl} alt="Tenant logo" h={24} fit="contain" />
        ) : (
          <Text fw={600}>Admin</Text>
        )}
      </Group>

      <Group gap="sm">
        <Box>
          <TenantSwitcher />
        </Box>

        {/* Theme settings quick link */}
        <Tooltip label="Theme settings" withArrow>
          <ActionIcon
            variant="default"
            size="lg"
            radius="md"
            onClick={() => tenantSlug && navigate(`/${tenantSlug}/settings/theme`)}
            aria-label="Open theme settings"
          >
            <IconPalette size={18} />
          </ActionIcon>
        </Tooltip>

        {/* Light/Dark toggle */}
        <Tooltip label={isLight ? 'Switch to dark' : 'Switch to light'} withArrow>
          <ActionIcon
            variant="default"
            size="lg"
            radius="md"
            onClick={toggleScheme}
            aria-label="Toggle color scheme"
          >
            {isLight ? <IconMoon size={18} /> : <IconSun size={18} />}
          </ActionIcon>
        </Tooltip>

        <Button variant="light" onClick={handleSignOut}>
          Sign out
        </Button>
      </Group>
    </Group>
  );
}