'use client';

import { AppShell, Button, Group, Text, ActionIcon, useMantineTheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { IconLogout, IconHome, IconChartBar, IconPlus, IconSettings, IconCalendar } from '@tabler/icons-react';
import { BottomNav } from './BottomNav';

interface LayoutProps {
  children: React.ReactNode;
  navbarOpened?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  navbarOpened = false
}) => {
  const { user, logout } = useAuth();
  const theme = useMantineTheme();
  // スマホサイズかどうかを判定 (Mantimeのsmブレークポイントは768px、それ未満ならtrue)
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);

  return (
    <>
      <AppShell
        header={isMobile ? undefined : { height: 60 }}
        navbar={isMobile ? undefined : { width: 300, breakpoint: 'sm', collapsed: { mobile: !navbarOpened } }}
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

        {!isMobile && (
          <AppShell.Navbar p="md">
            <Group mb="md">
              <IconHome size={20} />
              <Text>ダッシュボード</Text>
            </Group>
            <Group mb="md">
              <IconCalendar size={20} />
              <Text>カレンダー</Text>
            </Group>
            <Group mb="md">
              <IconChartBar size={20} />
              <Text>分析</Text>
            </Group>
            <Group>
              <IconSettings size={20} />
              <Text>設定</Text>
            </Group>

            <Button
              leftSection={<IconPlus size={16} />}
              variant="light"
              fullWidth
              mt="xl"
            >
              取引を追加
            </Button>
          </AppShell.Navbar>
        )}

        <AppShell.Main>
          {children}
        </AppShell.Main>
      </AppShell>
      <BottomNav />
    </>
  );
};