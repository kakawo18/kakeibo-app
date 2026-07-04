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
import {
  Container, Stack, Grid, Text, Group, ActionIcon, Button, Menu, Select,
  Affix, Box, Loader, useMantineColorScheme, Paper, SimpleGrid,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconPlus, IconTrendingUp, IconWallet, IconDotsVertical, IconFileImport,
  IconChevronLeft, IconChevronRight, IconArrowUpRight, IconArrowDownRight,
  IconMinus, IconCalendar, IconCoins, IconRepeat, IconLogout, IconSun, IconMoon,
  IconSettings,
} from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { useTransactions } from '@/contexts/TransactionsContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { TransactionForm } from '@/components/forms/TransactionForm';
import { TransactionList } from '@/components/ui/TransactionList';
import { CategoryBreakdown } from '@/components/charts/CategoryBreakdown';
import { LineChart } from '@/components/charts/LineChart';
import { SpendingPaceChart } from '@/components/charts/SpendingPaceChart';
import { CSVImportExport } from '@/components/ui/CSVImportExport';
import { MobileCalendar } from '@/components/ui/MobileCalendar';
import { calculateMonthlyData, calculateCategoryChartData, calculateMonthlyComparison } from '@/utils/calculations';
import { calculateMonthlyCardRewards } from '@/utils/cardRewards';
import { getCurrentMonth, getMonthName, getMonthOptions, getNextMonth, getPreviousMonthFromCurrent, formatMonthLocal } from '@/utils/dateUtils';
import { Transaction, RecurringTransaction, Trend } from '@/types';
import { CardRewardsDisplay } from '@/components/ui/CardRewardsDisplay';
import { VersionDisplay } from '@/components/ui/VersionDisplay';
import { YearSummaryModal } from '@/components/ui/YearSummaryModal';
import { useRecurringTransactions } from '@/hooks/useRecurringTransactions';
import { RecurringTransactionManager } from '@/components/recurring/RecurringTransactionManager';
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
  // ------------------------------------------------------------
  // データ取得フック
  // ------------------------------------------------------------
  const { transactions, loading: transactionsLoading, addTransaction } = useTransactions();
  const { loading: settingsLoading, settings, rules, getColor, paymentMethods } = useSettings();
  const { user, logout } = useAuth();
  const {
    getActiveRecurringTransactions,
    shouldShowRecurringTransaction
  } = useRecurringTransactions();

  // ------------------------------------------------------------
  // モーダル表示状態の管理
  // ------------------------------------------------------------
  const [transactionFormOpened, setTransactionFormOpened] = useState(false);
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

  // 選択月の取引データ
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

  // 月間カード還元ポイント
  const monthlyCardPoints = useMemo(
    () => calculateMonthlyCardRewards(selectedMonthTransactions, paymentMethods).totalPoints,
    [selectedMonthTransactions, paymentMethods]
  );

  // 表示すべき定期取引
  const displayRecurringTransactions = useMemo(() => {
    const active = getActiveRecurringTransactions();
    return active.filter(transaction => shouldShowRecurringTransaction(transaction, transactions));
  }, [getActiveRecurringTransactions, shouldShowRecurringTransaction, transactions]);

  const monthOptions = useMemo(() => getMonthOptions(), []);

  // ------------------------------------------------------------
  // ハンドラー
  // ------------------------------------------------------------
  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setTransactionFormOpened(true);
  };

  const handleCloseTransactionForm = () => {
    setTransactionFormOpened(false);
    setEditingTransaction(null);
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
    await addTransaction({
      type: 'expense',
      ...data,
      ...rules.deriveTransactionFlags(data.category, data.paymentMethod),
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

  // 今月の収支
  const monthBalance = selectedMonthData?.balance ?? 0;

  // 設定ロード前にフォームがカテゴリ空で描画されないよう、両方の完了を待つ
  if (transactionsLoading || settingsLoading) {
    return (
      <Container size="lg" py={80}>
        <Stack align="center" gap="sm">
          <Loader size="sm" color="indigo" />
          <Text size="sm" c="dimmed">データを読み込み中...</Text>
        </Stack>
      </Container>
    );
  }

  // 月セレクター（モバイルはスワイプ対応）
  // モバイルはヘッダー右側のアイコン群（メニュー/テーマ/ログアウト）と
  // 1行に同居するため、幅とフォントを詰めて 360px 幅端末でも収まるようにする
  const monthSelector = (
    <Select
      data={monthOptions}
      value={selectedMonth}
      onChange={handleMonthChange}
      searchable={!isMobile}
      w={isMobile ? 124 : 160}
      size={isMobile ? 'sm' : 'md'}
      variant="unstyled"
      styles={{
        input: {
          fontSize: isMobile ? '16px' : '19px',
          fontWeight: 700,
          textAlign: 'center',
          letterSpacing: '-0.02em',
          cursor: 'pointer',
        },
        dropdown: { maxHeight: '60vh' },
        option: { fontSize: '14px', padding: '10px' },
      }}
    />
  );

  // 月ナビゲーション（‹ 年月 ›）
  // モバイル: スティッキーヘッダー左側に常駐（ブランド表示の代わり）
  // デスクトップ: 従来どおりヘッダー下の行に配置
  const monthNav = (
    <Group gap={isMobile ? 0 : 2} wrap="nowrap">
      <ActionIcon
        variant="subtle"
        color="gray"
        size={isMobile ? 'md' : 'lg'}
        onClick={handlePreviousMonth}
        aria-label="前の月へ"
      >
        <IconChevronLeft size={isMobile ? 18 : 20} />
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
        size={isMobile ? 'md' : 'lg'}
        onClick={handleNextMonth}
        aria-label="次の月へ"
      >
        <IconChevronRight size={isMobile ? 18 : 20} />
      </ActionIcon>
    </Group>
  );

  return (
    <Box pb={isMobile ? 90 : 40}>
      {/* ============================================================
          スティッキーヘッダー
          ============================================================ */}
      <Box className="app-header" mb="md">
        <Container size="lg">
          <Group justify="space-between" h={56} wrap="nowrap">
            {/* モバイル: ブランド表示の代わりに月ナビを常駐させ、専用行を節約する */}
            {isMobile ? (
              monthNav
            ) : (
              <Group gap={10}>
                <Box
                  w={28}
                  h={28}
                  style={{
                    borderRadius: 8,
                    background: 'var(--accent)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 15,
                    lineHeight: 1,
                  }}
                  aria-hidden
                >
                  ¥
                </Box>
                <div>
                  <Text fw={700} size="sm" style={{ letterSpacing: '-0.01em', lineHeight: 1 }}>
                    家計簿
                  </Text>
                  {user?.email && (
                    <Text size="10px" c="dimmed" style={{ lineHeight: 1.5 }}>{user.email}</Text>
                  )}
                </div>
              </Group>
            )}

            <Group gap={4}>
              {/* モバイル: カレンダー・設定は頻度が高いのでアイコンを常設 */}
              {isMobile && (
                <>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="lg"
                    onClick={() => setCalendarOpened(true)}
                    aria-label="カレンダー"
                  >
                    <IconCalendar size={18} />
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="lg"
                    onClick={() => router.push('/settings')}
                    aria-label="設定"
                  >
                    <IconSettings size={18} />
                  </ActionIcon>
                </>
              )}

              {/* モバイル: 使用頻度が低い項目（定期・CSV・テーマ・ログアウト）は三点リーダーに集約 */}
              {isMobile && (
                <Menu shadow="md" width={200} position="bottom-end">
                  <Menu.Target>
                    <ActionIcon variant="subtle" color="gray" size="lg" aria-label="メニュー">
                      <IconDotsVertical size={18} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item leftSection={<IconRepeat size={14} />} onClick={() => setRecurringManagerOpened(true)}>
                      定期取引
                    </Menu.Item>
                    <Menu.Item leftSection={<IconFileImport size={14} />} onClick={() => setCsvModalOpened(true)}>
                      CSV インポート/エクスポート
                    </Menu.Item>
                    <Menu.Item
                      leftSection={isDark ? <IconSun size={14} /> : <IconMoon size={14} />}
                      onClick={() => setColorScheme(isDark ? 'light' : 'dark')}
                    >
                      {isDark ? 'ライトモードに切替' : 'ダークモードに切替'}
                    </Menu.Item>
                    <Menu.Item leftSection={<IconLogout size={14} />} onClick={logout}>
                      ログアウト
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              )}

              {/* デスクトップ: 従来どおり全アイコンを常設 */}
              {!isMobile && (
                <>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="lg"
                    onClick={() => router.push('/settings')}
                    aria-label="設定"
                  >
                    <IconSettings size={18} />
                  </ActionIcon>
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
                </>
              )}
            </Group>
          </Group>
        </Container>
      </Box>

      <Container size="lg">
        <Stack gap={isMobile ? 'md' : 'lg'}>

          {/* ============================================================
              月ナビゲーション + アクション
              （モバイルは月ナビがヘッダーに常駐するため、この行ごと不要）
              ============================================================ */}
          {!isMobile && (
            <Group justify="space-between" align="center">
              {monthNav}

              {/* デスクトップ: アクションボタン */}
              <Group gap="xs">
                <Button
                  leftSection={<IconPlus size={16} stroke={2.2} />}
                  onClick={() => setTransactionFormOpened(true)}
                >
                  取引を追加
                </Button>
                <ActionIcon variant="default" size={36} radius={10} onClick={() => setRecurringManagerOpened(true)} aria-label="定期取引">
                  <IconRepeat size={16} stroke={1.8} />
                </ActionIcon>
                <ActionIcon variant="default" size={36} radius={10} onClick={() => setCalendarOpened(true)} aria-label="カレンダー">
                  <IconCalendar size={16} stroke={1.8} />
                </ActionIcon>
                <Menu shadow="md" width={220} position="bottom-end" radius={12}>
                  <Menu.Target>
                    <ActionIcon variant="default" size={36} radius={10} aria-label="その他">
                      <IconDotsVertical size={16} stroke={1.8} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item leftSection={<IconFileImport size={14} />} onClick={() => setCsvModalOpened(true)}>
                      CSV インポート/エクスポート
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </Group>
          )}

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
            pos="relative"
            onClick={() => setYearSummaryOpened(true)}
          >
            {/* 右上: 年間収支への導線 */}
            <Group
              gap={2}
              style={{
                position: 'absolute',
                top: isMobile ? 14 : 18,
                right: isMobile ? 16 : 22,
                color: 'var(--ink-3)',
              }}
            >
              <Text size="xs" fw={600} style={{ color: 'inherit' }}>年間収支</Text>
              <IconChevronRight size={13} />
            </Group>

            <Grid gutter={isMobile ? 'lg' : 'xl'} align="center">
              {/* ヒーロー: 今月の収支 */}
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Stack gap={8} align={isMobile ? 'center' : 'flex-start'}>
                  <Text className="overline-label">
                    {getMonthName(selectedMonth)}の収支
                  </Text>
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
        // zIndex はモーダル（Mantine デフォルト 200）より下に固定。上にするとモーダルの上に FAB が浮く
        // bottom は iOS PWA のホームインジケーター領域（safe-area）を避ける
        <Affix
          position={{ bottom: 'calc(24px + env(safe-area-inset-bottom))', right: 20 }}
          style={{ zIndex: transactionFormOpened ? 1 : 150 }}
        >
          <Button
            leftSection={<IconPlus size={18} stroke={2.2} />}
            onClick={() => setTransactionFormOpened(true)}
            size="md"
            radius="xl"
            style={{
              boxShadow: '0 2px 6px rgba(15, 23, 42, 0.12), 0 8px 22px rgba(76, 110, 245, 0.28)',
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
        transactions={transactions}
      />

      <CardRewardsDisplay
        transactions={transactions}
        selectedMonth={selectedMonth}
        opened={cardRewardsOpened}
        onClose={() => setCardRewardsOpened(false)}
      />

      <YearSummaryModal
        opened={yearSummaryOpened}
        onClose={() => setYearSummaryOpened(false)}
        transactions={transactions}
        monthlyData={monthlyData}
        selectedMonth={selectedMonth}
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
    </Box>
  );
}
