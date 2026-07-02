/**
 * ダッシュボードコンテンツ — メイン画面のコンポーネント
 *
 * 【デザインシステム: "Quiet Ledger"】
 * - フラットな面 + ヘアライン境界（グラスモーフィズム廃止）
 * - 数字が主役: ヒーロー収支 → 収入/支出 → KPI → チャート → 台帳
 * - デザイントークンは globals.css の CSS 変数を参照
 *
 * 【構成】
 * 1. スティッキーヘッダー: ブランド + テーマ切替 + ログアウト
 * 2. 月ナビゲーション + アクション（追加/定期/カレンダー/CSV）
 * 3. 収支バンド: 今月の収支（ヒーロー数値）| 収入 | 支出
 * 4. KPIタイル: 貯蓄率 / 獲得ポイント / 年間投資額
 * 5. チャート: 支出内訳・収入内訳・支出ペース・カテゴリ別推移
 * 6. 取引履歴（日付グループ型台帳）
 */
'use client';

import { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransactionForm } from '@/contexts/TransactionFormContext';
import {
  Container, Stack, Grid, Text, Group, ActionIcon, Button, Menu, Select,
  Affix, Badge, Box, Modal, ThemeIcon, useMantineColorScheme, Paper,
  SimpleGrid, Divider, Card,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconPlus, IconTrendingUp, IconWallet, IconDotsVertical, IconFileImport,
  IconChevronLeft, IconChevronRight, IconArrowUpRight, IconArrowDownRight,
  IconMinus, IconCalendar, IconCoins, IconRepeat, IconLogout, IconSun, IconMoon,
} from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { useTransactions } from '@/hooks/useTransactions';
import { useAuth } from '@/contexts/AuthContext';
import { TransactionForm } from '@/components/forms/TransactionForm';
import { TransactionList } from '@/components/ui/TransactionList';
import { PieChart } from '@/components/charts/PieChart';
import { LineChart } from '@/components/charts/LineChart';
import { SpendingPaceChart } from '@/components/charts/SpendingPaceChart';
import { CSVImportExport } from '@/components/ui/CSVImportExport';
import { MobileCalendar } from '@/components/ui/MobileCalendar';
import { calculateMonthlyData, calculateCategoryChartData, calculateMonthlyComparison } from '@/utils/calculations';
import { calculateMonthlyCardRewards } from '@/utils/cardRewards';
import { getCurrentMonth, getMonthName, getMonthOptions, getNextMonth, getPreviousMonthFromCurrent, formatMonthLocal } from '@/utils/dateUtils';
import { Transaction, RecurringTransaction } from '@/types';
import { CardRewardsDisplay } from '@/components/ui/CardRewardsDisplay';
import { VersionDisplay } from '@/components/ui/VersionDisplay';
import { useRecurringTransactions } from '@/hooks/useRecurringTransactions';
import { RecurringTransactionManager } from '@/components/recurring/RecurringTransactionManager';
import { RecurringTransactionNotice } from '@/components/recurring/RecurringTransactionNotice';
import { RecurringTransactionConfirm } from '@/components/recurring/RecurringTransactionConfirm';
import { InvestmentHistoryModal } from '@/components/ui/InvestmentHistoryModal';
import { SavingsRateDetailModal } from '@/components/ui/SavingsRateDetailModal';

// ============================================================
// 前月比トレンドバッジ
// ============================================================
const TrendIndicator = ({ trend, percentage }: { trend: 'up' | 'down' | 'same'; percentage: number }) => {
  const color = trend === 'up' ? 'teal' : trend === 'down' ? 'red' : 'gray';
  const icon =
    trend === 'up' ? <IconArrowUpRight size={12} /> :
    trend === 'down' ? <IconArrowDownRight size={12} /> :
    <IconMinus size={12} />;

  if (percentage === 0) return null;

  return (
    <Badge variant="light" color={color} leftSection={icon} size="xs">
      {Math.abs(percentage)}%
    </Badge>
  );
};

// ============================================================
// KPIタイル
// ============================================================
const KpiTile = ({
  label,
  value,
  unit,
  icon,
  color,
  onClick,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: React.ReactNode;
  color: string;
  onClick?: () => void;
}) => (
  <Paper
    className={`ledger-card ${onClick ? 'ledger-card-clickable' : ''}`}
    p="md"
    onClick={onClick}
  >
    <Group gap={8} mb={6}>
      <ThemeIcon variant="light" color={color} size="sm" radius="md">
        {icon}
      </ThemeIcon>
      <Text size="xs" c="dimmed" fw={600}>{label}</Text>
    </Group>
    <Text size="lg" fw={800} className="tabular-nums" style={{ lineHeight: 1.1 }}>
      {value}
      {unit && <Text component="span" size="xs" c="dimmed" fw={600}> {unit}</Text>}
    </Text>
  </Paper>
);

// ============================================================
// メインコンポーネント
// ============================================================
export function DashboardContent() {
  // ------------------------------------------------------------
  // データ取得フック
  // ------------------------------------------------------------
  const { transactions, loading: transactionsLoading, addTransaction } = useTransactions();
  const { user, logout } = useAuth();
  const {
    getActiveRecurringTransactions,
    shouldShowRecurringTransaction
  } = useRecurringTransactions();

  // ------------------------------------------------------------
  // 取引フォーム状態（Context経由 + ローカル状態の統合）
  // ------------------------------------------------------------
  const { isFormOpen, closeForm } = useTransactionForm();
  const [localFormOpened, setLocalFormOpened] = useState(false);
  const transactionFormOpened = localFormOpened || isFormOpen;

  // ------------------------------------------------------------
  // モーダル表示状態の管理
  // ------------------------------------------------------------
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [recurringManagerOpened, setRecurringManagerOpened] = useState(false);
  const [recurringConfirmOpened, setRecurringConfirmOpened] = useState(false);
  const [selectedRecurringTransaction, setSelectedRecurringTransaction] = useState<RecurringTransaction | null>(null);
  const [csvModalOpened, setCsvModalOpened] = useState(false);
  const [calendarOpened, setCalendarOpened] = useState(false);
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(new Date());
  const [cardRewardsOpened, setCardRewardsOpened] = useState(false);
  const [yearSummaryOpened, setYearSummaryOpened] = useState(false);
  const [investmentHistoryOpened, setInvestmentHistoryOpened] = useState(false);
  const [savingsRateDetailOpened, setSavingsRateDetailOpened] = useState(false);

  // ------------------------------------------------------------
  // レスポンシブ・テーマ判定
  // ------------------------------------------------------------
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  // ------------------------------------------------------------
  // ルーティング・月選択
  // ------------------------------------------------------------
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlMonth = searchParams.get('month');
  const selectedMonth = urlMonth || getCurrentMonth();
  const selectedYear = Number(selectedMonth.split('-')[0]);

  // ------------------------------------------------------------
  // データ計算
  // ------------------------------------------------------------
  const monthlyData = useMemo(() => calculateMonthlyData(transactions), [transactions]);

  const selectedMonthData = useMemo(() =>
    monthlyData.find(data => data.month === selectedMonth),
    [monthlyData, selectedMonth]
  );

  const previousMonthData = useMemo(() => {
    const previousMonth = getPreviousMonthFromCurrent(selectedMonth);
    return monthlyData.find(data => data.month === previousMonth);
  }, [monthlyData, selectedMonth]);

  const monthlyComparison = useMemo(() => {
    if (!selectedMonthData) return null;
    return calculateMonthlyComparison(selectedMonthData, previousMonthData);
  }, [selectedMonthData, previousMonthData]);

  // 年間収支（「今月の収支」バンドをクリックした時のモーダルに表示）
  const yearSummary = useMemo(() => {
    const yearTransactions = transactions.filter(t =>
      t.date.getFullYear() === selectedYear &&
      t.category !== '立替回収' &&
      t.category !== '立替金'
    );

    const income = yearTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    // カード引き落とし等（affectsExpense === false）は二重計上になるため除外
    const expense = yearTransactions
      .filter(t => t.type === 'expense' && t.affectsExpense !== false)
      .reduce((sum, t) => sum + t.amount, 0);

    const balance = income - expense;

    const monthlyBreakdown = monthlyData
      .filter(m => m.month.startsWith(`${selectedYear}-`))
      .sort((a, b) => a.month.localeCompare(b.month));

    return { year: selectedYear, income, expense, balance, monthlyBreakdown };
  }, [transactions, selectedYear, monthlyData]);

  // 選択月の取引データ
  const selectedMonthTransactions = useMemo(() =>
    transactions.filter(t => formatMonthLocal(t.date) === selectedMonth),
    [transactions, selectedMonth]
  );

  const incomeChartData = useMemo(() =>
    calculateCategoryChartData(selectedMonthTransactions, 'income'),
    [selectedMonthTransactions]
  );

  const expenseChartData = useMemo(() =>
    calculateCategoryChartData(selectedMonthTransactions, 'expense'),
    [selectedMonthTransactions]
  );

  // 貯蓄額と貯蓄率の計算
  const savingsData = useMemo(() => {
    const yearlyInvestmentAmount = transactions
      .filter(t =>
        t.date.getFullYear() === selectedYear &&
        t.type === 'expense' &&
        t.category === '固定費' &&
        t.subcategory === '投資'
      )
      .reduce((sum, t) => sum + t.amount, 0);

    const yearlySalaryAmount = transactions
      .filter(t =>
        t.date.getFullYear() === selectedYear &&
        t.type === 'income' &&
        t.category === '給与'
      )
      .reduce((sum, t) => sum + t.amount, 0);

    const yearlySavingsRate = yearlySalaryAmount > 0
      ? (yearlyInvestmentAmount / yearlySalaryAmount) * 100
      : 0;

    return { yearlyInvestmentAmount, yearlySalaryAmount, yearlySavingsRate };
  }, [transactions, selectedYear]);

  // 月間カード還元ポイント
  const monthlyCardPoints = useMemo(
    () => calculateMonthlyCardRewards(selectedMonthTransactions).totalPoints,
    [selectedMonthTransactions]
  );

  // 表示すべき定期取引
  const displayRecurringTransactions = useMemo(() => {
    const active = getActiveRecurringTransactions();
    return active.filter(transaction => shouldShowRecurringTransaction(transaction, transactions));
  }, [getActiveRecurringTransactions, shouldShowRecurringTransaction, transactions]);

  // ------------------------------------------------------------
  // ハンドラー
  // ------------------------------------------------------------
  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setLocalFormOpened(true);
  };

  const handleCloseTransactionForm = () => {
    setLocalFormOpened(false);
    setEditingTransaction(null);
    closeForm();
  };

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
    let transactionType: 'normal' | 'card_payment' | 'card_withdrawal' = 'normal';
    let affectsExpense = true;
    let affectsBalance = true;

    if (data.category === 'カード引き落とし') {
      transactionType = 'card_withdrawal';
      affectsExpense = false;
      affectsBalance = true;
    } else if (data.paymentMethod && data.paymentMethod !== '現金') {
      transactionType = 'card_payment';
      affectsExpense = true;
      affectsBalance = false;
    }

    await addTransaction({
      type: 'expense',
      amount: data.amount,
      category: data.category,
      subcategory: data.subcategory,
      paymentMethod: data.paymentMethod,
      date: data.date,
      description: data.description,
      transactionType,
      affectsExpense,
      affectsBalance,
    });
  };

  const handleMonthChange = (month: string | null) => {
    if (month) {
      const params = new URLSearchParams(searchParams);
      params.set('month', month);
      router.push(`?${params.toString()}`, { scroll: false });
    }
  };

  const handlePreviousMonth = () => handleMonthChange(getPreviousMonthFromCurrent(selectedMonth));
  const handleNextMonth = () => handleMonthChange(getNextMonth(selectedMonth));

  const handleCalendarDateChange = (date: Date) => {
    setCalendarSelectedDate(date);
    setCalendarOpened(false);
    handleMonthChange(formatMonthLocal(date));
  };

  const monthOptions = getMonthOptions();

  // 今月の収支
  const monthBalance = (selectedMonthData?.income || 0) - (selectedMonthData?.expense || 0);

  if (transactionsLoading) {
    return (
      <Container size="lg" py="xl">
        <Text ta="center" c="dimmed">データを読み込み中...</Text>
      </Container>
    );
  }

  // 月セレクター（モバイルはスワイプ対応）
  const monthSelector = (
    <Select
      data={monthOptions}
      value={selectedMonth}
      onChange={handleMonthChange}
      searchable={!isMobile}
      w={isMobile ? 140 : 160}
      size={isMobile ? 'sm' : 'md'}
      variant="unstyled"
      styles={{
        input: {
          fontSize: isMobile ? '18px' : '20px',
          fontWeight: 800,
          textAlign: 'center',
          letterSpacing: '-0.02em',
          cursor: 'pointer',
        },
        dropdown: { maxHeight: '60vh' },
        option: { fontSize: '14px', padding: '10px' },
      }}
    />
  );

  return (
    <Box pb={isMobile ? 90 : 40}>
      {/* ============================================================
          スティッキーヘッダー
          ============================================================ */}
      <Box className="app-header" mb="md">
        <Container size="lg">
          <Group justify="space-between" h={56}>
            <Group gap={10}>
              <ThemeIcon
                size="md"
                radius="md"
                variant="gradient"
                gradient={{ from: 'indigo', to: 'cyan', deg: 135 }}
              >
                <IconWallet size={16} />
              </ThemeIcon>
              <div>
                <Text fw={800} size="md" style={{ letterSpacing: '-0.3px', lineHeight: 1 }}>
                  家計簿
                </Text>
                {!isMobile && user?.email && (
                  <Text size="10px" c="dimmed" style={{ lineHeight: 1.4 }}>{user.email}</Text>
                )}
              </div>
            </Group>

            <Group gap={4}>
              {/* モバイル: ツールメニュー（カレンダー・定期・CSV） */}
              {isMobile && (
                <Menu shadow="md" width={200} position="bottom-end">
                  <Menu.Target>
                    <ActionIcon variant="subtle" color="gray" size="lg" aria-label="メニュー">
                      <IconDotsVertical size={18} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item leftSection={<IconCalendar size={14} />} onClick={() => setCalendarOpened(true)}>
                      カレンダー
                    </Menu.Item>
                    <Menu.Item leftSection={<IconRepeat size={14} />} onClick={() => setRecurringManagerOpened(true)}>
                      定期取引
                    </Menu.Item>
                    <Menu.Item leftSection={<IconFileImport size={14} />} onClick={() => setCsvModalOpened(true)}>
                      CSV インポート/エクスポート
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              )}
              <ActionIcon
                variant="subtle"
                color="gray"
                size="lg"
                onClick={() => setColorScheme(isDark ? 'light' : 'dark')}
                aria-label="テーマ切り替え"
              >
                {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
              </ActionIcon>
              <ActionIcon variant="subtle" color="gray" size="lg" onClick={logout} aria-label="ログアウト">
                <IconLogout size={18} />
              </ActionIcon>
            </Group>
          </Group>
        </Container>
      </Box>

      <Container size="lg">
        <Stack gap={isMobile ? 'md' : 'lg'}>

          {/* ============================================================
              月ナビゲーション + アクション
              ============================================================ */}
          <Group justify="space-between" align="center">
            <Group gap={2}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="lg"
                onClick={handlePreviousMonth}
                aria-label="前の月へ"
              >
                <IconChevronLeft size={20} />
              </ActionIcon>

              {isMobile ? (
                <motion.div
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  dragMomentum={false}
                  onDragEnd={(e, info) => {
                    if (info.offset.x > 50) handlePreviousMonth();
                    else if (info.offset.x < -50) handleNextMonth();
                  }}
                  style={{ touchAction: 'none' }}
                >
                  {monthSelector}
                </motion.div>
              ) : (
                monthSelector
              )}

              <ActionIcon
                variant="subtle"
                color="gray"
                size="lg"
                onClick={handleNextMonth}
                aria-label="次の月へ"
              >
                <IconChevronRight size={20} />
              </ActionIcon>
            </Group>

            {/* デスクトップ: アクションボタン */}
            {!isMobile && (
              <Group gap="xs">
                <Button
                  leftSection={<IconPlus size={16} />}
                  onClick={() => setLocalFormOpened(true)}
                  variant="gradient"
                  gradient={{ from: 'indigo', to: 'cyan', deg: 135 }}
                  radius="xl"
                >
                  取引を追加
                </Button>
                <ActionIcon variant="default" size={36} radius="xl" onClick={() => setRecurringManagerOpened(true)} aria-label="定期取引">
                  <IconRepeat size={16} />
                </ActionIcon>
                <ActionIcon variant="default" size={36} radius="xl" onClick={() => setCalendarOpened(true)} aria-label="カレンダー">
                  <IconCalendar size={16} />
                </ActionIcon>
                <Menu shadow="md" width={220} position="bottom-end">
                  <Menu.Target>
                    <ActionIcon variant="default" size={36} radius="xl" aria-label="その他">
                      <IconDotsVertical size={16} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item leftSection={<IconFileImport size={14} />} onClick={() => setCsvModalOpened(true)}>
                      CSV インポート/エクスポート
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            )}
          </Group>

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
          <Paper
            className="ledger-card ledger-card-clickable"
            p={isMobile ? 'lg' : 'xl'}
            onClick={() => setYearSummaryOpened(true)}
          >
            <Grid gutter={isMobile ? 'lg' : 'xl'} align="center">
              {/* ヒーロー: 今月の収支 */}
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Stack gap={6} align={isMobile ? 'center' : 'flex-start'}>
                  <Text size="xs" c="dimmed" fw={700} style={{ letterSpacing: '0.04em' }}>
                    {getMonthName(selectedMonth)}の収支
                  </Text>
                  <Text
                    className="tabular-nums"
                    style={{
                      fontSize: isMobile ? '2.5rem' : '3rem',
                      fontWeight: 800,
                      lineHeight: 1,
                      letterSpacing: '-0.03em',
                      color: monthBalance >= 0 ? 'var(--income)' : 'var(--expense)',
                    }}
                  >
                    {monthBalance >= 0 ? '+' : ''}¥{monthBalance.toLocaleString()}
                  </Text>
                  <Group gap={8}>
                    {monthlyComparison && (
                      <TrendIndicator
                        trend={monthlyComparison.balance.trend}
                        percentage={monthlyComparison.balance.percentage}
                      />
                    )}
                    <Text size="xs" c="dimmed">タップで年間収支を表示</Text>
                  </Group>
                </Stack>
              </Grid.Col>

              {/* 収入・支出 */}
              <Grid.Col span={{ base: 6, sm: 3 }}>
                <Stack
                  gap={4}
                  pl={isMobile ? 0 : 'lg'}
                  style={isMobile ? undefined : { borderLeft: '1px solid var(--hairline)' }}
                >
                  <Group gap={6}>
                    <Box w={8} h={8} style={{ borderRadius: '50%', background: 'var(--income)' }} />
                    <Text size="xs" c="dimmed" fw={600}>収入</Text>
                  </Group>
                  <Text size="xl" fw={800} className="tabular-nums amount-income" style={{ lineHeight: 1.1 }}>
                    ¥{(selectedMonthData?.income || 0).toLocaleString()}
                  </Text>
                  {monthlyComparison && (
                    <Text size="xs" c="dimmed">
                      前月比 {monthlyComparison.income.trend === 'up' ? '+' : ''}{monthlyComparison.income.percentage}%
                    </Text>
                  )}
                </Stack>
              </Grid.Col>

              <Grid.Col span={{ base: 6, sm: 3 }}>
                <Stack
                  gap={4}
                  pl={isMobile ? 0 : 'lg'}
                  style={isMobile ? undefined : { borderLeft: '1px solid var(--hairline)' }}
                >
                  <Group gap={6}>
                    <Box w={8} h={8} style={{ borderRadius: '50%', background: 'var(--expense)' }} />
                    <Text size="xs" c="dimmed" fw={600}>支出</Text>
                  </Group>
                  <Text size="xl" fw={800} className="tabular-nums amount-expense" style={{ lineHeight: 1.1 }}>
                    ¥{(selectedMonthData?.expense || 0).toLocaleString()}
                  </Text>
                  {monthlyComparison && (
                    <Text size="xs" c="dimmed">
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
              icon={<IconTrendingUp size={14} />}
              color="violet"
              onClick={() => setSavingsRateDetailOpened(true)}
            />
            <KpiTile
              label="獲得ポイント"
              value={monthlyCardPoints.toLocaleString()}
              unit="pt"
              icon={<IconCoins size={14} />}
              color="orange"
              onClick={() => setCardRewardsOpened(true)}
            />
            <KpiTile
              label="年間投資額"
              value={`¥${savingsData.yearlyInvestmentAmount.toLocaleString()}`}
              icon={<IconWallet size={14} />}
              color="indigo"
              onClick={() => setInvestmentHistoryOpened(true)}
            />
          </SimpleGrid>

          {/* ============================================================
              チャートセクション
              ============================================================ */}
          <Grid gutter={isMobile ? 'md' : 'lg'}>
            <Grid.Col span={{ base: 12, lg: 6 }}>
              <PieChart
                title="支出の内訳"
                data={expenseChartData}
                totalAmount={selectedMonthData?.expense || 0}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, lg: 6 }}>
              <PieChart
                title="収入の内訳"
                data={incomeChartData}
                totalAmount={selectedMonthData?.income || 0}
              />
            </Grid.Col>
          </Grid>

          <SpendingPaceChart
            transactions={selectedMonthTransactions}
            selectedMonth={selectedMonth}
            budget={100000}
          />

          <LineChart
            title="カテゴリ別支出推移"
            data={monthlyData}
            transactions={transactions}
          />

          {/* ============================================================
              取引履歴
              ============================================================ */}
          <TransactionList
            transactions={selectedMonthTransactions}
            onEditTransaction={handleEditTransaction}
          />

          <VersionDisplay />
        </Stack>
      </Container>

      {/* ============================================================
          モバイル: フローティング追加ボタン
          ============================================================ */}
      {isMobile && (
        <Affix position={{ bottom: 24, right: 20 }} style={{ zIndex: transactionFormOpened ? 1 : 300 }}>
          <Button
            leftSection={<IconPlus size={18} />}
            onClick={() => setLocalFormOpened(true)}
            size="md"
            variant="gradient"
            gradient={{ from: 'indigo', to: 'cyan', deg: 135 }}
            radius="xl"
            style={{
              boxShadow: '0 8px 24px rgba(76, 110, 245, 0.4)',
              opacity: transactionFormOpened ? 0 : 1,
              pointerEvents: transactionFormOpened ? 'none' : 'auto',
            }}
          >
            追加
          </Button>
        </Affix>
      )}

      {/* ============================================================
          各種モーダル
          ============================================================ */}
      <TransactionForm
        opened={transactionFormOpened}
        onClose={handleCloseTransactionForm}
        editingTransaction={editingTransaction}
      />

      <RecurringTransactionManager
        opened={recurringManagerOpened}
        onClose={() => setRecurringManagerOpened(false)}
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

      <CSVImportExport
        opened={csvModalOpened}
        onClose={() => setCsvModalOpened(false)}
      />

      <MobileCalendar
        opened={calendarOpened}
        onClose={() => setCalendarOpened(false)}
        value={calendarSelectedDate}
        onChange={handleCalendarDateChange}
        transactions={transactions.map(t => ({
          id: t.id,
          date: t.date,
          amount: t.amount,
          type: t.type,
          category: t.category,
          subcategory: t.subcategory,
          description: t.description
        }))}
      />

      <CardRewardsDisplay
        transactions={transactions}
        selectedMonth={selectedMonth}
        opened={cardRewardsOpened}
        onClose={() => setCardRewardsOpened(false)}
      />

      {/* 年間収支サマリーモーダル */}
      <Modal
        opened={yearSummaryOpened}
        onClose={() => setYearSummaryOpened(false)}
        title={
          <Group gap="sm">
            <ThemeIcon size="lg" color="indigo" variant="light">
              <IconTrendingUp size={20} />
            </ThemeIcon>
            <Text size="lg" fw={700}>{yearSummary.year}年の収支</Text>
          </Group>
        }
        size="lg"
        centered
      >
        <Stack gap="md">
          {/* 年間サマリー */}
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <Box p="md" style={{ background: 'var(--app-surface-2)', borderRadius: 12, border: '1px solid var(--hairline)' }}>
              <Text size="xs" c="dimmed" fw={600} mb={4}>年間収入</Text>
              <Text size="lg" fw={800} className="tabular-nums amount-income">
                ¥{yearSummary.income.toLocaleString()}
              </Text>
            </Box>
            <Box p="md" style={{ background: 'var(--app-surface-2)', borderRadius: 12, border: '1px solid var(--hairline)' }}>
              <Text size="xs" c="dimmed" fw={600} mb={4}>年間支出（投資含む）</Text>
              <Text size="lg" fw={800} className="tabular-nums amount-expense">
                ¥{yearSummary.expense.toLocaleString()}
              </Text>
            </Box>
            <Box p="md" style={{ background: 'var(--app-surface-2)', borderRadius: 12, border: '1px solid var(--hairline)' }}>
              <Text size="xs" c="dimmed" fw={600} mb={4}>年間収支</Text>
              <Text
                size="lg"
                fw={800}
                className="tabular-nums"
                style={{ color: yearSummary.balance >= 0 ? 'var(--income)' : 'var(--expense)' }}
              >
                {yearSummary.balance >= 0 ? '+' : ''}¥{yearSummary.balance.toLocaleString()}
              </Text>
            </Box>
          </SimpleGrid>

          {/* 月別内訳 */}
          <Box>
            <Text size="sm" fw={700} c="dimmed" mb="sm">月別内訳</Text>
            <Stack gap={6}>
              {yearSummary.monthlyBreakdown.map((monthData) => {
                const balance = monthData.income - monthData.expense;
                const isSelected = monthData.month === selectedMonth;
                return (
                  <Card
                    key={monthData.month}
                    p="sm"
                    radius="md"
                    style={{
                      border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--hairline)'}`,
                      background: isSelected ? 'var(--accent-soft)' : 'var(--app-surface)',
                    }}
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <Group gap="xs">
                        <Text size="sm" fw={700}>{getMonthName(monthData.month)}</Text>
                        {isSelected && <Badge size="xs" color="indigo" variant="light">表示中</Badge>}
                      </Group>
                      <Group gap="md" wrap="nowrap">
                        <Text size="xs" c="dimmed" className="tabular-nums" visibleFrom="sm">
                          収入 ¥{monthData.income.toLocaleString()} / 支出 ¥{monthData.expense.toLocaleString()}
                        </Text>
                        <Text
                          size="sm"
                          fw={800}
                          className="tabular-nums"
                          style={{ color: balance >= 0 ? 'var(--income)' : 'var(--expense)' }}
                        >
                          {balance >= 0 ? '+' : ''}¥{balance.toLocaleString()}
                        </Text>
                      </Group>
                    </Group>
                  </Card>
                );
              })}

              <Divider my={4} />
              <Group justify="space-between" px={4}>
                <Text size="xs" c="dimmed" fw={600}>月平均</Text>
                <Group gap="md">
                  <Text size="xs" c="dimmed" className="tabular-nums">
                    収入 ¥{Math.round(yearSummary.income / 12).toLocaleString()}
                  </Text>
                  <Text size="xs" c="dimmed" className="tabular-nums">
                    支出 ¥{Math.round(yearSummary.expense / 12).toLocaleString()}
                  </Text>
                  <Text size="xs" fw={700} className="tabular-nums"
                    style={{ color: yearSummary.balance >= 0 ? 'var(--income)' : 'var(--expense)' }}
                  >
                    {yearSummary.balance >= 0 ? '+' : ''}¥{Math.round(yearSummary.balance / 12).toLocaleString()}
                  </Text>
                </Group>
              </Group>
            </Stack>
          </Box>
        </Stack>
      </Modal>

      {/* 年間投資履歴モーダル */}
      <InvestmentHistoryModal
        opened={investmentHistoryOpened}
        onClose={() => setInvestmentHistoryOpened(false)}
        transactions={transactions}
        year={selectedYear}
      />

      {/* 年間貯蓄率詳細モーダル */}
      <SavingsRateDetailModal
        opened={savingsRateDetailOpened}
        onClose={() => setSavingsRateDetailOpened(false)}
        transactions={transactions}
        year={selectedYear}
      />
    </Box>
  );
}
