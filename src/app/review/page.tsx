'use client';

/**
 * 年間振り返りページ (/review)
 *
 * 年収(額面/手取り)・支出・投資・貯蓄率を年単位で見返す画面。
 * 表示する年は URL クエリ `?year=YYYY` に持つため、
 * useSearchParams を使う ReviewContent は Suspense で包む必要がある。
 */
import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Container, Loader, Stack, Text } from '@mantine/core';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useTransactions } from '@/contexts/TransactionsContext';
import { ReviewHeader } from '@/components/review/ReviewHeader';
import { ReviewContent } from '@/components/review/ReviewContent';

const LoadingState = () => (
  <Container size="lg" py={80}>
    <Stack align="center" gap="sm">
      <Loader size="sm" color="indigo" />
      <Text size="sm" c="dimmed">データを読み込み中...</Text>
    </Stack>
  </Container>
);

export default function ReviewPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  // 設定のロード前は rules が空になり、投資や給与収入の判定が全て false になる。
  // 集計が静かにずれるため、必ず両方の完了を待つ。
  const { loading: settingsLoading } = useSettings();
  const { loading: transactionsLoading } = useTransactions();

  // 未ログインならダッシュボード(ログイン画面)へ
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/');
    }
  }, [authLoading, user, router]);

  if (authLoading || settingsLoading || transactionsLoading || !user) {
    return <LoadingState />;
  }

  return (
    <Box pb={40}>
      <ReviewHeader />
      <Suspense fallback={<LoadingState />}>
        <ReviewContent />
      </Suspense>
    </Box>
  );
}
