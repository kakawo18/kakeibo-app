'use client';

/**
 * 履歴タブ (/history)
 *
 * 選択中の月の取引を「リスト」と「カレンダー」の2つの見せ方で確認する。
 * どちらも同じ取引を見る目的なので、タブを分けずにこの画面の中で切り替える。
 *
 * useSearchParams（表示月）を使うため Suspense で包む。
 */
import { Suspense, useMemo, useState } from 'react';
import { Box, Container, Loader, Paper, Stack, Text } from '@mantine/core';
import { MonthNav } from '@/components/ui/MonthNav';
import { TransactionList } from '@/components/ui/TransactionList';
import { CalendarView } from '@/components/ui/CalendarView';
import { AddTransactionFab } from '@/components/ui/AddTransactionFab';
import { TransactionForm } from '@/components/forms/TransactionForm';
import { useTransactions } from '@/contexts/TransactionsContext';
import { useSelectedMonth } from '@/hooks/useSelectedMonth';
import { formatMonthLocal } from '@/utils/dateUtils';
import { Transaction } from '@/types';

type ViewMode = 'list' | 'calendar';

const VIEW_TABS: { value: ViewMode; label: string }[] = [
  { value: 'list', label: 'リスト' },
  { value: 'calendar', label: 'カレンダー' },
];

function HistoryContent() {
  const { transactions } = useTransactions();
  const { selectedMonth, setMonth } = useSelectedMonth();
  const [view, setView] = useState<ViewMode>('list');
  const [formOpened, setFormOpened] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const selectedMonthTransactions = useMemo(
    () => transactions.filter((t) => formatMonthLocal(t.date) === selectedMonth),
    [transactions, selectedMonth]
  );

  // カレンダーには選択月の1日を渡す。月内の日付が選ばれても表示月は変えない
  const calendarValue = useMemo(() => new Date(`${selectedMonth}-01T00:00:00`), [selectedMonth]);

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setFormOpened(true);
  };

  const handleCloseForm = () => {
    setFormOpened(false);
    setEditingTransaction(null);
  };

  const activeIndex = VIEW_TABS.findIndex((tab) => tab.value === view);

  return (
    <Container size="lg">
      <Stack gap="md">
        <MonthNav />

        {/* リスト / カレンダーの切り替え。カードには入れず画面幅いっぱいの帯にする */}
        <Box className="underline-tabs" role="tablist">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              className="underline-tab"
              aria-selected={view === tab.value}
              onClick={() => setView(tab.value)}
            >
              {tab.label}
            </button>
          ))}
          <Box
            className="underline-tabs-indicator"
            style={{
              width: `calc(100% / ${VIEW_TABS.length})`,
              transform: `translateX(${activeIndex * 100}%)`,
            }}
          />
        </Box>

        {view === 'list' ? (
          <Box key="list" className="chart-swap">
            <TransactionList
              transactions={selectedMonthTransactions}
              onEditTransaction={handleEditTransaction}
            />
          </Box>
        ) : (
          <Paper key="calendar" className="ledger-card chart-swap" p="xs">
            <CalendarView
              value={calendarValue}
              // 日付タップはドロワーで内訳を出すだけなので、選択の通知は不要
              onChange={() => {}}
              transactions={selectedMonthTransactions}
              showHeader={false}
              onMonthChange={setMonth}
            />
          </Paper>
        )}
      </Stack>

      <AddTransactionFab onClick={() => setFormOpened(true)} hidden={formOpened} />

      <TransactionForm
        opened={formOpened}
        onClose={handleCloseForm}
        editingTransaction={editingTransaction}
      />
    </Container>
  );
}

export default function HistoryPage() {
  return (
    <Suspense
      fallback={
        <Container size="lg" py={80}>
          <Stack align="center" gap="sm">
            <Loader size="sm" color="indigo" />
            <Text size="sm" c="dimmed">データを読み込み中...</Text>
          </Stack>
        </Container>
      }
    >
      <HistoryContent />
    </Suspense>
  );
}
