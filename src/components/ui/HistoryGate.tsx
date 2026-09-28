'use client';

/**
 * 過去の取引（直近13か月より前）が要る画面のための部品（#125）
 *
 * 起動時には直近の取引だけを読む。過去の月・年を表示するときはこのフックで読み始め、
 * そろうまでは金額を出さずに「読み込み中」を出す（未取得の期間を0円に見せない）。
 */
import { useEffect } from 'react';
import { Loader, Stack, Text } from '@mantine/core';
import { useNetwork } from '@mantine/hooks';
import { useTransactions } from '@/contexts/TransactionsContext';

/**
 * needed が true なら過去の取引を読み始める
 *
 * @returns ready: 表示してよいか（要らない、または読み込み済み）
 *          complete: サーバーで確認済みか（オフラインで端末の分だけを出していると false）
 */
export const useHistoryFor = (needed: boolean) => {
  const { historyStatus, historyComplete, ensureHistory } = useTransactions();
  useEffect(() => {
    if (needed) ensureHistory();
  }, [needed, ensureHistory]);
  return {
    ready: !needed || historyStatus === 'loaded',
    complete: !needed || historyComplete,
  };
};

export const HistoryLoading = ({ py = 'xl' }: { py?: string | number }) => (
  <Stack align="center" gap={6} py={py} role="status">
    <Loader size="sm" color="indigo" />
    <Text size="xs" c="dimmed">
      過去のデータを読み込み中…
    </Text>
  </Stack>
);

/** オフラインで、過去の取引を端末に保存済みの分だけで表示しているときの注記 */
export const HistoryPartialNotice = ({ complete }: { complete: boolean }) => {
  const { online } = useNetwork();
  if (complete || online) return null;
  return (
    <Text size="xs" c="dimmed" ta="center">
      オフラインのため、過去のデータはこの端末に保存済みの分だけを表示しています
    </Text>
  );
};
