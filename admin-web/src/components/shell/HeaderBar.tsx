// admin-web/src/components/shell/HeaderBar.tsx
import { Group, Text, Burger, Box, Button } from '@mantine/core';
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
        <Button variant="light" onClick={handleSignOut}>
          Sign out
        </Button>
      </Group>
    </Group>
  );
}
