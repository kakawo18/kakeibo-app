/**
 * ホームタブの中身 — 選択中の月を見る画面
 *
 * 【デザインシステム: "Quiet Ledger"】
 * - フラットな面 + ヘアライン境界（グラスモーフィズム廃止）
 * - 数字が主役: ヒーロー収支 → 収入/支出 → KPI → チャート
 * - デザイントークンは globals.css の CSS 変数を参照
 *
 * 【構成】
 * 1. 月ナビゲーション
 * 2. 定期取引の通知
 * 3. 収支バンド: 今月の収支（ヒーロー数値）| 収入 | 支出
 * 4. KPIタイル: 貯蓄率 / 獲得ポイント / 年間投資額
 * 5. チャート: 支出内訳・収入内訳・支出ペース・カテゴリ別推移
 *
 * 表示する数値は useDashboardData、収支バンドは MonthSummaryCard、KPI は KpiTiles（#124）。
 * ヘッダー・タブ・認証ガードは (tabs)/layout.tsx が持つ。
 * 取引の一覧とカレンダーは履歴タブ (/history) にある。
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Container, Stack } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useTransactions } from '@/contexts/TransactionsContext';
import { useSettings } from '@/contexts/SettingsContext';
import { TransactionForm, AddTransactionFab } from '@/features/transactions';
import { RecurringTransactionNotice, RecurringTransactionConfirm } from '@/features/recurring';
import { SwipeArea } from '@/components/ui/SwipeArea';
import { VersionDisplay } from '@/components/ui/VersionDisplay';
import { formatMonthLocal } from '@/utils/dateUtils';
import { recurringRecordId } from '@/domain/recurring';
import { RecurringTransaction } from '@/types';
import { useSelectedMonth } from '@/hooks/useSelectedMonth';
import { WriteResult } from '@/data/pendingWrite';
import { useDashboardData } from './useDashboardData';
import { MonthSummaryCard } from './MonthSummaryCard';
import { KpiTiles } from './KpiTiles';
import { CategoryBreakdown } from './CategoryBreakdown';
import { LineChart } from './LineChart';
import { SpendingPaceChart } from './SpendingPaceChart';
import { CardRewardsDisplay } from './CardRewardsDisplay';
import { InvestmentHistoryModal } from './InvestmentHistoryModal';
import { SavingsRateDetailModal } from './SavingsRateDetailModal';

// ============================================================
// メインコンポーネント
// ============================================================
export function DashboardContent() {
  const { addTransaction } = useTransactions();
  const { settings, rules } = useSettings();

  const [transactionFormOpened, setTransactionFormOpened] = useState(false);
  const [recurringConfirmOpened, setRecurringConfirmOpened] = useState(false);
  const [selectedRecurringTransaction, setSelectedRecurringTransaction] = useState<RecurringTransaction | null>(null);
  const [cardRewardsOpened, setCardRewardsOpened] = useState(false);
  const [investmentHistoryOpened, setInvestmentHistoryOpened] = useState(false);
  const [savingsRateDetailOpened, setSavingsRateDetailOpened] = useState(false);

  const isMobile = useMediaQuery('(max-width: 768px)');
  const router = useRouter();
  const { selectedMonth, selectedYear, goPreviousMonth, goNextMonth } = useSelectedMonth();

  // ------------------------------------------------------------
  // データ計算
  // ------------------------------------------------------------
  // 表示する数値の組み立ては useDashboardData（計算は src/domain）
  const {
    transactions,
    selectedMonthData,
    monthlyComparison,
    selectedMonthTransactions,
    incomeChartData,
    expenseChartData,
    savingsData,
    monthlyCardPoints,
    displayRecurringTransactions,
  } = useDashboardData(selectedMonth, selectedYear);

  // ------------------------------------------------------------
  // ハンドラー
  // ------------------------------------------------------------
  const handleRecordRecurringTransaction = (transaction: RecurringTransaction) => {
    setSelectedRecurringTransaction(transaction);
    setRecurringConfirmOpened(true);
  };

  const handleConfirmRecurringTransaction = async (data: {
    amount: number;
    category: string;
    subcategory?: string;
    paymentMethod?: string;
    date: Date;
    description?: string;
  }): Promise<WriteResult> => {
    if (!selectedRecurringTransaction) throw new Error('No recurring transaction selected');
    // どの定期取引の、どの月の分かを取引に残す。記録済みの判定はこの2つで行い、
    // ID もこの2つから決めるので、複数端末から同じ月を記録しても1件になる（#101）
    const recurringMonth = formatMonthLocal(data.date);
    return addTransaction(
      {
        type: 'expense',
        ...data,
        ...rules.deriveTransactionFlags(data.category, data.paymentMethod),
        recurringTransactionId: selectedRecurringTransaction.id,
        recurringMonth,
      },
      { id: recurringRecordId(selectedRecurringTransaction.id, recurringMonth) }
    );
  };

  /** 年間振り返りタブへ。表示中の年をそのまま引き継ぐ */
  const openAnnualReview = () => router.push(`/review?year=${selectedYear}`);

  return (
    <Container size="lg">
      {/* 画面のどこを左右にスワイプしても月が変わる（カレンダーと同じ操作感） */}
      <SwipeArea
        enabled={isMobile}
        onPrevious={goPreviousMonth}
        onNext={goNextMonth}
      >
        <Stack gap={isMobile ? 'md' : 'lg'}>
          {/* 定期取引通知 */}
          {displayRecurringTransactions.length > 0 && (
            <RecurringTransactionNotice
              recurringTransactions={displayRecurringTransactions}
              onRecord={handleRecordRecurringTransaction}
            />
          )}

          {/* ============================================================
              収支バンド: 今月の収支（ヒーロー）| 収入 | 支出
              ============================================================ */}
          <MonthSummaryCard
            selectedMonthData={selectedMonthData}
            monthlyComparison={monthlyComparison}
            onOpenAnnualReview={openAnnualReview}
            isMobile={Boolean(isMobile)}
          />

        {/* ============================================================
            KPIタイル
            ============================================================ */}
        <KpiTiles
          savingsData={savingsData}
          monthlyCardPoints={monthlyCardPoints}
          isMobile={Boolean(isMobile)}
          onOpenSavingsRate={() => setSavingsRateDetailOpened(true)}
          onOpenCardRewards={() => setCardRewardsOpened(true)}
          onOpenInvestmentHistory={() => setInvestmentHistoryOpened(true)}
        />

        {/* ============================================================
            チャートセクション
            （モバイル: タブ切替 / デスクトップ: 2カラム）
            ============================================================ */}
        <CategoryBreakdown
          expenseData={expenseChartData}
          incomeData={incomeChartData}
          expenseTotal={selectedMonthData?.expense || 0}
          incomeTotal={selectedMonthData?.income || 0}
        />

        <SpendingPaceChart
          transactions={selectedMonthTransactions}
          selectedMonth={selectedMonth}
          budget={settings?.monthlyBudget ?? 100000}
        />

        <LineChart
          title="カテゴリ別支出推移"
          transactions={transactions}
        />

          <VersionDisplay />
        </Stack>
      </SwipeArea>

      <AddTransactionFab
        onClick={() => setTransactionFormOpened(true)}
        hidden={transactionFormOpened}
      />

      {/* ============================================================
          各種モーダル
          ============================================================ */}
      <TransactionForm
        opened={transactionFormOpened}
        onClose={() => setTransactionFormOpened(false)}
        editingTransaction={null}
      />

      <RecurringTransactionConfirm
        opened={recurringConfirmOpened}
        onClose={() => {
          setRecurringConfirmOpened(false);
          setSelectedRecurringTransaction(null);
        }}
        transaction={selectedRecurringTransaction}
        onConfirm={handleConfirmRecurringTransaction}
      />

      <CardRewardsDisplay
        transactions={transactions}
        selectedMonth={selectedMonth}
        opened={cardRewardsOpened}
        onClose={() => setCardRewardsOpened(false)}
      />

      <InvestmentHistoryModal
        opened={investmentHistoryOpened}
        onClose={() => setInvestmentHistoryOpened(false)}
        transactions={transactions}
        year={selectedYear}
      />

      <SavingsRateDetailModal
        opened={savingsRateDetailOpened}
        onClose={() => setSavingsRateDetailOpened(false)}
        transactions={transactions}
        year={selectedYear}
      />
    </Container>
  );
}
