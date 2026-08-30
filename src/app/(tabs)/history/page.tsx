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
import { Box, Container, Group, Loader, Paper, SegmentedControl, Stack, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { MonthNav } from '@/components/ui/MonthNav';
import { MonthSwipeArea } from '@/components/ui/MonthSwipeArea';
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
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { transactions } = useTransactions();
  const { selectedMonth, setMonth, goPreviousMonth, goNextMonth } = useSelectedMonth();
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

  return (
    <Container size="lg">
      {/* 画面のどこを左右にスワイプしても月が変わる。
          カレンダー側のスワイプは切ってある（入れ子にすると月が2つ進む） */}
      <MonthSwipeArea enabled={isMobile} onPrevious={goPreviousMonth} onNext={goNextMonth}>
        <Stack gap="md">
          {/* 月の切り替えと表示の切り替えを1行に収める。専用の行を作ると高さだけを食う */}
          <Group justify="space-between" align="center" wrap="nowrap">
            <MonthNav />
            <SegmentedControl
              value={view}
              onChange={(value) => setView(value as ViewMode)}
              data={VIEW_TABS}
              size="xs"
              radius={8}
            />
          </Group>

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
                // 日付タップは下の欄に内訳を出すだけなので、選択の通知は不要
                onChange={() => {}}
                transactions={selectedMonthTransactions}
                showHeader={false}
                swipeable={false}
                onMonthChange={setMonth}
                onEditTransaction={handleEditTransaction}
              />
            </Paper>
          )}
        </Stack>
      </MonthSwipeArea>

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
