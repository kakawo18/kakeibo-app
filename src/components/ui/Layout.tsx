'use client';

import { AppShell, Button, Group, Text, ActionIcon } from '@mantine/core';
import { useAuth } from '@/contexts/AuthContext';
import { IconLogout, IconHome, IconPlus } from '@tabler/icons-react';

interface LayoutProps {
  children: React.ReactNode;
  navbarOpened?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  navbarOpened = false 
}) => {
  const { user, logout } = useAuth();

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 300, breakpoint: 'sm', collapsed: { mobile: !navbarOpened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Text size="xl" fw={700}>
            家計簿アプリ
          </Text>
          
          {user && (
            <Group>
              <Text size="sm">{user.email}</Text>
              <ActionIcon variant="light" onClick={logout}>
                <IconLogout size={16} />
              </ActionIcon>
            </Group>
          )}
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Group>
          <ActionIcon variant="light">
            <IconHome size={16} />
          </ActionIcon>
          <Text>ダッシュボード</Text>
        </Group>
        
        <Button 
          leftSection={<IconPlus size={16} />}
          variant="light" 
          fullWidth 
          mt="md"
        >
          取引を追加
        </Button>
      </AppShell.Navbar>

      <AppShell.Main>
        {children}
      </AppShell.Main>
    </AppShell>
  );
};