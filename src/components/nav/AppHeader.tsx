'use client';

/**
 * 全タブ共通のヘッダー
 *
 * ブランド表示とアカウント操作だけを持つ。画面固有の操作（月の切り替えなど）は
 * 各ページ側に置く。タブ間の移動は AppTabBar が担うので、ここに遷移用のアイコンは置かない。
 */
import { ActionIcon, Box, Container, Group, Menu, Text, useMantineColorScheme } from '@mantine/core';
import {
  IconDotsVertical,
  IconFileImport,
  IconLogout,
  IconMoon,
  IconRepeat,
  IconSun,
} from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';

interface AppHeaderProps {
  onOpenRecurringManager: () => void;
  onOpenCsvModal: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onOpenRecurringManager,
  onOpenCsvModal,
}) => {
  const { user, logout } = useAuth();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Box className="app-header">
      <Container size="lg">
        <Group justify="space-between" h={52} wrap="nowrap">
          <Group gap={10} wrap="nowrap">
            <Box
              w={26}
              h={26}
              style={{
                borderRadius: 8,
                background: 'var(--accent)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 14,
                lineHeight: 1,
                flexShrink: 0,
              }}
              aria-hidden
            >
              ¥
            </Box>
            <div style={{ minWidth: 0 }}>
              <Text fw={700} size="sm" style={{ letterSpacing: '-0.01em', lineHeight: 1 }}>
                家計簿
              </Text>
              {user?.email && (
                <Text size="10px" c="dimmed" truncate style={{ lineHeight: 1.5 }}>
                  {user.email}
                </Text>
              )}
            </div>
          </Group>

          <Group gap={4} wrap="nowrap">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              onClick={() => setColorScheme(isDark ? 'light' : 'dark')}
              aria-label="テーマ切り替え"
            >
              {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
            </ActionIcon>

            {/* 使用頻度の低い操作はまとめる */}
            <Menu shadow="md" width={220} position="bottom-end" radius={12}>
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray" size="lg" aria-label="メニュー">
                  <IconDotsVertical size={18} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconRepeat size={14} />} onClick={onOpenRecurringManager}>
                  定期取引
                </Menu.Item>
                <Menu.Item leftSection={<IconFileImport size={14} />} onClick={onOpenCsvModal}>
                  CSV インポート/エクスポート
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item leftSection={<IconLogout size={14} />} onClick={logout}>
                  ログアウト
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </Container>
    </Box>
  );
};
