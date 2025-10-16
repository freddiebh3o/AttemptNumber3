// admin-web/src/components/shell/AdminLayout.tsx
import { AppShell } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet } from 'react-router-dom';
import HeaderBar from './HeaderBar';
import SidebarNav from './SidebarNav';
import TenantThemeProvider from '../theme/TenantThemeProvider';
import DirtyNavigationGuard from '../nav/DirtyNavigationGuard';
import { useEffect, useState } from "react";
import { useAuthStore } from "../../stores/auth";
import { ChatModal } from '../Chat/ChatModal';

export default function AdminLayout() {
  const [opened, { toggle, close }] = useDisclosure(false);
  const [chatOpened, setChatOpened] = useState(false);
  const hydrated = useAuthStore((s) => s.hydrated);
  const refreshFromServer = useAuthStore((s) => s.refreshFromServer);

  useEffect(() => {
    if (!hydrated) {
      refreshFromServer().catch(() => {});
    }
  }, [hydrated, refreshFromServer]);

  return (
    <TenantThemeProvider>
      <DirtyNavigationGuard />
      <AppShell
        header={{ height: 56 }}
        navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !opened } }}
        padding="md"
      >
        <AppShell.Header>
          <HeaderBar
            opened={opened}
            onBurgerClick={toggle}
            onChatClick={() => setChatOpened(true)}
          />
        </AppShell.Header>

        <AppShell.Navbar>
          <SidebarNav onNavigate={close} />
        </AppShell.Navbar>

        <AppShell.Main>
          <Outlet />
        </AppShell.Main>
      </AppShell>

      {/* AI Chat Assistant Modal */}
      <ChatModal opened={chatOpened} onClose={() => setChatOpened(false)} />
    </TenantThemeProvider>
  );
}
