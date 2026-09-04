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
 * 高さは globals.css の --tabbar-content-height（アイコン行）と --tabbar-bottom-gap
 * （ホームインジケータ避けの余白）。合計が --tabbar-height で、FAB の位置と
 * 本文の下余白がこれを参照する。
 *
 * ホームと履歴のあいだでは、見ている月(?month=)を引き継ぐ（tabHref を参照）。
 */
import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Box, Container, Group, Text, UnstyledButton } from '@mantine/core';
import { TABS, findActiveTab, tabHref } from '@/components/nav/tabs';

const TabBarView = ({ month }: { month: string | null }) => {
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
                  href={tabHref(tab, month)}
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
        <Group gap={0} grow h="var(--tabbar-content-height)" align="stretch">
          {TABS.map((tab) => {
            const active = tab.href === activeHref;
            const Icon = tab.icon;
            return (
              <UnstyledButton
                key={tab.href}
                component={Link}
                href={tabHref(tab, month)}
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

const TabBarWithMonth = () => {
  const searchParams = useSearchParams();
  return <TabBarView month={searchParams.get('month')} />;
};

export const AppTabBar = () => (
  // useSearchParams は Suspense 境界を要求する。フォールバックでも同じバーを描くので
  // タブが欠ける瞬間は無く、月の引き継ぎだけが効かない状態になる
  <Suspense fallback={<TabBarView month={null} />}>
    <TabBarWithMonth />
  </Suspense>
);
