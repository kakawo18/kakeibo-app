'use client';

import { AppShell, Group, Text, ActionIcon, useMantineTheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { IconLogout } from '@tabler/icons-react';
import { BottomNav } from './BottomNav';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
}) => {
  const { user, logout } = useAuth();
  const theme = useMantineTheme();
  // スマホサイズかどうかを判定 (Mantineのsmブレークポイントは768px、それ未満ならtrue)
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);

  return (
    <>
      <AppShell
        header={isMobile ? undefined : { height: 60 }}
        padding="md"
        // スマホでは下部ナビゲーション分の余白を確保
        style={{ marginBottom: isMobile ? 80 : 0 }}
      >
        {!isMobile && (
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
        )}

        <AppShell.Main>
          {children}
        </AppShell.Main>
      </AppShell>
      <BottomNav />
    </>
  );
};