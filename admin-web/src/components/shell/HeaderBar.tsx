// admin-web/src/components/shell/HeaderBar.tsx
import { Group, Text, Burger, Box, Button, ActionIcon, Tooltip, useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import { IconSun, IconMoon } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import TenantSwitcher from './TenantSwitcher';
import { signOutApiRequest } from '../../api/auth';
import { useAuthStore } from '../../stores/auth';

export default function HeaderBar({
  opened,
  onBurgerClick,
}: {
  opened: boolean;
  onBurgerClick: () => void;
}) {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((s) => s.clear);

  // ⬇️ Mantine color scheme hooks
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const isLight = computedColorScheme === 'light';

  async function handleSignOut() {
    try {
      await signOutApiRequest();
    } catch {
      // ignore; navigate regardless
    } finally {
      clearAuth();
      navigate('/sign-in');
    }
  }

  function toggleScheme() {
    setColorScheme(isLight ? 'dark' : 'light');
  }

  return (
    <Group h="100%" px="md" justify="space-between" wrap="nowrap">
      <Group gap="sm">
        <Burger opened={opened} onClick={onBurgerClick} aria-label="Toggle navigation" />
        <Text fw={600}>Admin</Text>
      </Group>

      <Group gap="sm">
        <Box>
          <TenantSwitcher />
        </Box>

        {/* ⬇️ Dark / Light toggle */}
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
