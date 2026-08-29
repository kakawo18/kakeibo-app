'use client';

/**
 * タブ配下の共通レイアウト
 *
 * 認証ガード・ローディング待ち・共通ヘッダー・タブバーをここに集約する。
 * 以前は3つのページがそれぞれ同じ認証ガードとローディングを持っていた。
 *
 * ルートグループ `(tabs)` は URL に現れないので、配下のパスは
 * `/`・`/history`・`/review`・`/settings` のまま変わらない。
 */
import { useState } from 'react';
import { Box, Container, Loader, Stack, Text } from '@mantine/core';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useTransactions } from '@/contexts/TransactionsContext';
import { LoginForm } from '@/components/ui/LoginForm';
import { AppHeader } from '@/components/nav/AppHeader';
import { AppTabBar } from '@/components/nav/AppTabBar';
import { RecurringTransactionManager } from '@/components/recurring/RecurringTransactionManager';
import { CSVImportExport } from '@/components/ui/CSVImportExport';
import { PWAInstaller } from '@/components/PWAInstaller';

const LoadingState = ({ message }: { message: string }) => (
  <Container size="lg" py={80}>
    <Stack align="center" gap="sm">
      <Loader size="sm" color="indigo" />
      <Text size="sm" c="dimmed">{message}</Text>
    </Stack>
  </Container>
);

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  // 設定のロード前は rules が空になり、投資や給与収入の判定が全て false になる。
  // 集計が静かにずれるので、取引と設定の両方が揃うまで中身を描画しない。
  const { loading: settingsLoading } = useSettings();
  const { loading: transactionsLoading } = useTransactions();

  const [recurringManagerOpened, setRecurringManagerOpened] = useState(false);
  const [csvModalOpened, setCsvModalOpened] = useState(false);

  if (authLoading) {
    return <LoadingState message="読み込み中..." />;
  }

  // 未ログインではタブもヘッダーも出さない
  if (!user) {
    return (
      <>
        <Container size="xs" py="xl">
          <LoginForm />
        </Container>
        <PWAInstaller />
      </>
    );
  }

  if (settingsLoading || transactionsLoading) {
    return <LoadingState message="データを読み込み中..." />;
  }

  return (
    <>
      <AppHeader
        onOpenRecurringManager={() => setRecurringManagerOpened(true)}
        onOpenCsvModal={() => setCsvModalOpened(true)}
      />
      <AppTabBar />

      <Box className="tab-page" pt="md">
        {children}
      </Box>

      <RecurringTransactionManager
        opened={recurringManagerOpened}
        onClose={() => setRecurringManagerOpened(false)}
      />

      <CSVImportExport
        opened={csvModalOpened}
        onClose={() => setCsvModalOpened(false)}
      />

      <PWAInstaller />
    </>
  );
}
