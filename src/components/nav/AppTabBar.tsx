'use client';

/**
 * タブナビゲーション
 *
 * モバイル: 画面下部に固定するバー / デスクトップ: ヘッダー直下に横並び。
 * 出し分けは JS のメディアクエリではなく CSS（Mantine の hiddenFrom / visibleFrom）で行う。
 * useMediaQuery は初回レンダリングで undefined になり、モバイルで一瞬デスクトップ用の
 * タブ列が見えてしまうため。表示されていない方は display:none なので支援技術からも見えない。
 *
 * z-index はヘッダーと同じ 100。Mantine のモーダル(200)より必ず下にする（AGENTS.md）。
 * 高さは globals.css の --tabbar-height。FAB の位置と本文の下余白がこれを参照する。
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Box, Container, Group, Text, UnstyledButton } from '@mantine/core';
import { TABS, findActiveTab } from '@/components/nav/tabs';

export const AppTabBar = () => {
  const pathname = usePathname();
  const activeHref = findActiveTab(pathname ?? '/')?.href;

  return (
    <>
      {/* デスクトップ: ヘッダー直下の横並びタブ */}
      <Box className="app-subnav" component="nav" aria-label="メインナビゲーション" visibleFrom="sm">
        <Container size="lg">
          <Group gap={4} h={46} align="center">
            {TABS.map((tab) => {
              const active = tab.href === activeHref;
              const Icon = tab.icon;
              return (
                <UnstyledButton
                  key={tab.href}
                  component={Link}
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  px={12}
                  py={7}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    borderRadius: 'var(--radius-control)',
                    color: active ? 'var(--accent)' : 'var(--ink-2)',
                    background: active ? 'var(--accent-soft)' : 'transparent',
                  }}
                >
                  <Icon size={17} stroke={active ? 2.1 : 1.7} />
                  <Text size="sm" fw={active ? 700 : 500} style={{ color: 'inherit' }}>
                    {tab.label}
                  </Text>
                </UnstyledButton>
              );
            })}
          </Group>
        </Container>
      </Box>

      {/* モバイル: 画面下部の固定バー */}
      <Box className="app-tabbar" component="nav" aria-label="メインナビゲーション" hiddenFrom="sm">
        <Group gap={0} grow h="var(--tabbar-height)" align="stretch">
          {TABS.map((tab) => {
            const active = tab.href === activeHref;
            const Icon = tab.icon;
            return (
              <UnstyledButton
                key={tab.href}
                component={Link}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  color: active ? 'var(--accent)' : 'var(--ink-3)',
                }}
              >
                <Icon size={21} stroke={active ? 2.1 : 1.7} />
                <Text size="10px" fw={active ? 700 : 500} style={{ color: 'inherit', lineHeight: 1 }}>
                  {tab.label}
                </Text>
              </UnstyledButton>
            );
          })}
        </Group>
      </Box>
    </>
  );
};
