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
 * ヘッダー・タブ・認証ガードは (tabs)/layout.tsx が持つ。
 * 取引の一覧とカレンダーは履歴タブ (/history) にある。
 */
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Container, Stack, Grid, Text, Group, Box, Paper, SimpleGrid, UnstyledButton } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconTrendingUp, IconWallet, IconArrowUpRight, IconArrowDownRight,
  IconMinus, IconCoins, IconChevronRight,
} from '@tabler/icons-react';
import { useTransactions } from '@/contexts/TransactionsContext';
import { useSettings } from '@/contexts/SettingsContext';
import { TransactionForm } from '@/components/forms/TransactionForm';
import { CategoryBreakdown } from '@/components/charts/CategoryBreakdown';
import { LineChart } from '@/components/charts/LineChart';
import { SpendingPaceChart } from '@/components/charts/SpendingPaceChart';
import { MonthNav } from '@/components/ui/MonthNav';
import { MonthSwipeArea } from '@/components/ui/MonthSwipeArea';
import { AddTransactionFab } from '@/components/ui/AddTransactionFab';
import { calculateMonthlyData, calculateCategoryChartData, calculateMonthlyComparison } from '@/utils/calculations';
import { calculateMonthlyCardRewards } from '@/utils/cardRewards';
import { getPreviousMonthFromCurrent, formatMonthLocal } from '@/utils/dateUtils';
import { RecurringTransaction, Trend } from '@/types';
import { CardRewardsDisplay } from '@/components/ui/CardRewardsDisplay';
import { VersionDisplay } from '@/components/ui/VersionDisplay';
import { useSelectedMonth } from '@/hooks/useSelectedMonth';
import { useRecurringTransactions } from '@/hooks/useRecurringTransactions';
import { RecurringTransactionNotice } from '@/components/recurring/RecurringTransactionNotice';
import { RecurringTransactionConfirm } from '@/components/recurring/RecurringTransactionConfirm';
import { InvestmentHistoryModal } from '@/components/ui/InvestmentHistoryModal';
import { SavingsRateDetailModal } from '@/components/ui/SavingsRateDetailModal';

// ============================================================
// 前月比トレンド（色付きの矢印 + % のみ。バッジの面は使わない）
// ============================================================
const TrendIndicator = ({ trend, percentage }: { trend: Trend; percentage: number }) => {
  if (percentage === 0) return null;

  const color = trend === 'up' ? 'var(--income)' : trend === 'down' ? 'var(--expense)' : 'var(--ink-3)';
  const icon =
    trend === 'up' ? <IconArrowUpRight size={13} /> :
    trend === 'down' ? <IconArrowDownRight size={13} /> :
    <IconMinus size={13} />;

  return (
    <Group gap={3} align="center" style={{ color }}>
      {icon}
      <Text size="xs" fw={600} className="tabular-nums" style={{ color }}>
        {Math.abs(percentage)}%
      </Text>
      <Text size="xs" c="dimmed">前月比</Text>
    </Group>
  );
};

// ============================================================
// KPIタイル（アイコンは無彩色 — 色は意味のある数値だけに使う）
// ============================================================
const KpiTile = ({
  label,
  value,
  unit,
  icon,
  compact,
  onClick,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: React.ReactNode;
  compact?: boolean;
  onClick?: () => void;
}) => (
  <Paper
    className={`ledger-card ${onClick ? 'ledger-card-clickable' : ''}`}
    p={compact ? 12 : 'md'}
    onClick={onClick}
    // 3列グリッドで金額が長いときにタイルがグリッドを押し広げないようにする
    style={{ minWidth: 0 }}
  >
    {/* compact（モバイル3列）ではアイコンを省き字間も詰めて、
        「獲得ポイント」等のラベルが省略記号で欠けないようにする */}
    <Group gap={6} mb={compact ? 8 : 10} c="var(--ink-3)" wrap="nowrap">
      {!compact && icon}
      <Text
        className="overline-label"
        truncate
        style={compact ? { fontSize: 10, letterSpacing: '0.01em' } : undefined}
      >
        {label}
      </Text>
    </Group>
    <Text
      fw={700}
      className="tabular-nums"
      truncate
      style={{ fontSize: compact ? 17 : 20, lineHeight: 1.1, letterSpacing: '-0.015em' }}
    >
      {value}
      {unit && <Text component="span" size="xs" c="dimmed" fw={600}> {unit}</Text>}
    </Text>
  </Paper>
);

// ============================================================
// メインコンポーネント
// ============================================================
export function DashboardContent() {
  const { transactions, addTransaction } = useTransactions();
  const { settings, rules, getColor, paymentMethods } = useSettings();
  const { getActiveRecurringTransactions, shouldShowRecurringTransaction } = useRecurringTransactions();

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
  const monthlyData = useMemo(() => calculateMonthlyData(transactions, rules), [transactions, rules]);

  const selectedMonthData = useMemo(() =>
    monthlyData.find(data => data.month === selectedMonth),
    [monthlyData, selectedMonth]
  );

  const previousMonthData = useMemo(() => {
    const previousMonth = getPreviousMonthFromCurrent(selectedMonth);
    return monthlyData.find(data => data.month === previousMonth);
  }, [monthlyData, selectedMonth]);

  const monthlyComparison = useMemo(() => {
    // 前月データが存在しない（データ範囲外の）月では「前月比 +100%」のような
    // 意味のない比較を出さない
    if (!selectedMonthData || !previousMonthData) return null;
    return calculateMonthlyComparison(selectedMonthData, previousMonthData);
  }, [selectedMonthData, previousMonthData]);

  const selectedMonthTransactions = useMemo(() =>
    transactions.filter(t => formatMonthLocal(t.date) === selectedMonth),
    [transactions, selectedMonth]
  );

  const incomeChartData = useMemo(() =>
    calculateCategoryChartData(selectedMonthTransactions, 'income', rules, getColor),
    [selectedMonthTransactions, rules, getColor]
  );

  const expenseChartData = useMemo(() =>
    calculateCategoryChartData(selectedMonthTransactions, 'expense', rules, getColor),
    [selectedMonthTransactions, rules, getColor]
  );

  // 貯蓄額と貯蓄率の計算
  const savingsData = useMemo(() => {
    const yearlyInvestmentAmount = transactions
      .filter(t =>
        t.date.getFullYear() === selectedYear &&
        t.type === 'expense' &&
        rules.isInvestment(t)
      )
      .reduce((sum, t) => sum + t.amount, 0);

    const yearlySalaryAmount = transactions
      .filter(t =>
        t.date.getFullYear() === selectedYear &&
        t.type === 'income' &&
        rules.isSalaryIncome(t)
      )
      .reduce((sum, t) => sum + t.amount, 0);

    const yearlySavingsRate = yearlySalaryAmount > 0
      ? (yearlyInvestmentAmount / yearlySalaryAmount) * 100
      : 0;

    return { yearlyInvestmentAmount, yearlySavingsRate };
  }, [transactions, selectedYear, rules]);

  const monthlyCardPoints = useMemo(
    () => calculateMonthlyCardRewards(selectedMonthTransactions, paymentMethods).totalPoints,
    [selectedMonthTransactions, paymentMethods]
  );

  const displayRecurringTransactions = useMemo(() => {
    const active = getActiveRecurringTransactions();
    return active.filter(transaction => shouldShowRecurringTransaction(transaction, transactions));
  }, [getActiveRecurringTransactions, shouldShowRecurringTransaction, transactions]);

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
  }) => {
    await addTransaction({
      type: 'expense',
      ...data,
      ...rules.deriveTransactionFlags(data.category, data.paymentMethod),
    });
  };

  /** 年間振り返りタブへ。表示中の年をそのまま引き継ぐ */
  const openAnnualReview = () => router.push(`/review?year=${selectedYear}`);

  const monthBalance = selectedMonthData?.balance ?? 0;

  return (
    <Container size="lg">
      {/* 画面のどこを左右にスワイプしても月が変わる（カレンダーと同じ操作感） */}
      <MonthSwipeArea
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
          <Paper className="ledger-card" p={isMobile ? 'lg' : 'xl'}>
            {/* 月の切り替えはこの行に同居させる。専用の行を作ると高さだけを食うため。
                カード自体はクリック対象にしない（中に月移動のボタンがあるため） */}
            <Group justify="space-between" align="center" wrap="nowrap" mb={isMobile ? 'sm' : 'md'}>
              <MonthNav />
              <UnstyledButton onClick={openAnnualReview} aria-label="年間振り返りを開く">
                <Group gap={2} style={{ color: 'var(--ink-3)' }} wrap="nowrap">
                  <Text size="xs" fw={600} style={{ color: 'inherit', whiteSpace: 'nowrap' }}>年間振り返り</Text>
                  <IconChevronRight size={13} />
                </Group>
              </UnstyledButton>
            </Group>

            <Grid gutter={isMobile ? 'lg' : 'xl'} align="center">
              {/* ヒーロー: 今月の収支 */}
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Stack gap={8} align={isMobile ? 'center' : 'flex-start'}>
                  <Text className="overline-label">収支</Text>
                  <Text
                    className="tabular-nums"
                    style={{
                      fontSize: isMobile ? '2.375rem' : '2.75rem',
                      fontWeight: 700,
                      lineHeight: 1,
                      letterSpacing: '-0.025em',
                      color: monthBalance >= 0 ? 'var(--income)' : 'var(--expense)',
                    }}
                  >
                    {monthBalance >= 0 ? '+' : '-'}
                    <span className="amount-symbol">¥</span>
                    {Math.abs(monthBalance).toLocaleString()}
                  </Text>
                  {monthlyComparison && (
                    <TrendIndicator
                      trend={monthlyComparison.balance.trend}
                      percentage={monthlyComparison.balance.percentage}
                    />
                  )}
              </Stack>
            </Grid.Col>

            {/* 収入・支出 */}
            <Grid.Col span={{ base: 6, sm: 3 }}>
              <Stack
                gap={6}
                pl={isMobile ? 0 : 'lg'}
                style={isMobile ? undefined : { borderLeft: '1px solid var(--hairline)' }}
              >
                <Group gap={6}>
                  <Box w={7} h={7} style={{ borderRadius: '50%', background: 'var(--income)' }} />
                  <Text className="overline-label">収入</Text>
                </Group>
                <Text fw={700} className="tabular-nums" style={{ fontSize: 19, lineHeight: 1.1, letterSpacing: '-0.01em' }}>
                  <span className="amount-symbol">¥</span>
                  {(selectedMonthData?.income || 0).toLocaleString()}
                </Text>
                {monthlyComparison && (
                  <Text size="xs" c="dimmed" className="tabular-nums">
                    前月比 {monthlyComparison.income.trend === 'up' ? '+' : ''}{monthlyComparison.income.percentage}%
                  </Text>
                )}
              </Stack>
            </Grid.Col>

            <Grid.Col span={{ base: 6, sm: 3 }}>
              <Stack
                gap={6}
                pl={isMobile ? 0 : 'lg'}
                style={isMobile ? undefined : { borderLeft: '1px solid var(--hairline)' }}
              >
                <Group gap={6}>
                  <Box w={7} h={7} style={{ borderRadius: '50%', background: 'var(--expense)' }} />
                  <Text className="overline-label">支出</Text>
                </Group>
                <Text fw={700} className="tabular-nums" style={{ fontSize: 19, lineHeight: 1.1, letterSpacing: '-0.01em' }}>
                  <span className="amount-symbol">¥</span>
                  {(selectedMonthData?.expense || 0).toLocaleString()}
                </Text>
                {monthlyComparison && (
                  <Text size="xs" c="dimmed" className="tabular-nums">
                    前月比 {monthlyComparison.expense.trend === 'up' ? '+' : ''}{monthlyComparison.expense.percentage}%
                  </Text>
                )}
              </Stack>
            </Grid.Col>
          </Grid>
        </Paper>

        {/* ============================================================
            KPIタイル
            ============================================================ */}
        <SimpleGrid cols={3} spacing={isMobile ? 'xs' : 'md'}>
          <KpiTile
            label="貯蓄率"
            value={savingsData.yearlySavingsRate.toFixed(1)}
            unit="%"
            icon={<IconTrendingUp size={14} stroke={1.8} />}
            compact={isMobile}
            onClick={() => setSavingsRateDetailOpened(true)}
          />
          <KpiTile
            label="獲得ポイント"
            value={monthlyCardPoints.toLocaleString()}
            unit="pt"
            icon={<IconCoins size={14} stroke={1.8} />}
            compact={isMobile}
            onClick={() => setCardRewardsOpened(true)}
          />
          <KpiTile
            label="年間投資額"
            value={`¥${savingsData.yearlyInvestmentAmount.toLocaleString()}`}
            icon={<IconWallet size={14} stroke={1.8} />}
            compact={isMobile}
            onClick={() => setInvestmentHistoryOpened(true)}
          />
        </SimpleGrid>

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
      </MonthSwipeArea>

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
