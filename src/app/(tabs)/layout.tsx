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
import { useEffect, useState } from 'react';
import { Box, Button, Container, Group, Loader, Paper, Stack, Text } from '@mantine/core';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useTransactions } from '@/contexts/TransactionsContext';
import { LoginForm } from '@/components/ui/LoginForm';
import { AppHeader } from '@/components/nav/AppHeader';
import { AppTabBar } from '@/components/nav/AppTabBar';
import { RecurringTransactionManager } from '@/components/recurring/RecurringTransactionManager';
import { CSVImportExport } from '@/components/ui/CSVImportExport';
import { PWAInstaller } from '@/components/PWAInstaller';
import { SyncStatusBanner } from '@/components/ui/SyncStatusBanner';

/** この時間を過ぎても読み込み中なら、時間がかかっている理由を添える */
const SLOW_LOADING_MS = 4000;

const LoadingState = ({ message, slowHint }: { message: string; slowHint?: string }) => {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!slowHint) return;
    const timer = setTimeout(() => setSlow(true), SLOW_LOADING_MS);
    return () => clearTimeout(timer);
  }, [slowHint]);

  return (
    <Container size="lg" py={80}>
      <Stack align="center" gap="sm">
        <Loader size="sm" color="indigo" />
        <Text size="sm" c="dimmed">{message}</Text>
        {slow && slowHint && (
          <Text size="xs" c="dimmed" ta="center" maw={320}>
            {slowHint}
          </Text>
        )}
      </Stack>
    </Container>
  );
};

/** Firebase のエラーコード（permission-denied など）。取引の中身は含まないので表示してよい */
const errorCode = (error: Error): string | null =>
  'code' in error && typeof error.code === 'string' ? error.code : null;

/**
 * 取得に失敗したときの画面（#105）
 *
 * 0円や「取引がありません」と表示すると、データが消えたように見え、
 * 設定が読めていなければ空の役割で集計して誤った金額を出してしまう。
 * 画面の中身は出さずに、失敗したことと再試行の手段を示す。
 */
const LoadErrorState = ({
  error,
  onRetry,
  onLogout,
}: {
  error: Error;
  onRetry: () => void;
  onLogout: () => void;
}) => {
  const code = errorCode(error);
  return (
    <Container size="xs" py={80}>
      <Paper className="ledger-card" p="xl" role="alert">
        <Stack gap="sm" align="center">
          <Text fw={700}>データを読み込めませんでした</Text>
          <Text size="sm" c="dimmed" ta="center">
            通信状態を確認して、もう一度お試しください。記録したデータが消えたわけではありません。
          </Text>
          {code && (
            <Text size="xs" c="dimmed">
              エラー: {code}
            </Text>
          )}
          <Group mt="xs">
            <Button onClick={onRetry}>再読み込み</Button>
            <Button variant="default" onClick={onLogout}>
              ログアウト
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Container>
  );
};

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, logout } = useAuth();
  // 設定のロード前は rules が空になり、投資や給与収入の判定が全て false になる。
  // 集計が静かにずれるので、取引と設定の両方が揃うまで中身を描画しない。
  const { loading: settingsLoading, error: settingsError, retry: retrySettings } = useSettings();
  const {
    loading: transactionsLoading,
    error: transactionsError,
    retry: retryTransactions,
  } = useTransactions();

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

  const loadError = settingsError ?? transactionsError;
  if (loadError) {
    return (
      <LoadErrorState
        error={loadError}
        onRetry={() => {
          if (settingsError) retrySettings();
          if (transactionsError) retryTransactions();
        }}
        onLogout={() => void logout()}
      />
    );
  }

  if (settingsLoading || transactionsLoading) {
    return (
      <LoadingState
        message="データを読み込み中..."
        // 端末にキャッシュが無い初回（ログイン直後）は、全取引を端末に保存するので時間がかかる（#125）
        slowHint="ログイン後の初回は、オフラインでも使えるようにデータを端末に保存するため時間がかかります。次回からは速く開きます。"
      />
    );
  }

  return (
    <>
      <AppHeader
        onOpenRecurringManager={() => setRecurringManagerOpened(true)}
        onOpenCsvModal={() => setCsvModalOpened(true)}
      />
      <AppTabBar />

      <SyncStatusBanner />

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
