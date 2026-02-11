/**
 * ダッシュボードコンテンツ - メイン画面のコンポーネント
 * 
 * このファイルは家計簿アプリのメイン画面を構成します。
 * 
 * 【構成要素】
 * - サマリーカード（8枚）: 収入、支出、今月の収支、実残高、カード支払い、獲得ポイント、年間投資額、年間貯蓄率
 * - 円グラフ: 収入・支出のカテゴリ別内訳
 * - 折れ線グラフ: 残高推移
 * - 取引履歴リスト
 * - 各種モーダル: 取引追加、定期取引、カレンダー、CSV入出力など
 * 
 * 【色変更時の参照】
 * - カードの色: 各カードのstyle内のbackground, borderLeft, boxShadowを変更
 * - アイコンの色: ActionIconのstyle内のbackgroundを変更
 * - 詳細は COLOR_CUSTOMIZATION_GUIDE.md を参照
 */
'use client';

// ============================================================
// インポート
// ============================================================
import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransactionForm } from '@/contexts/TransactionFormContext';
// Mantine UIコンポーネント
import { Container, Stack, Grid, Card, Text, Group, ActionIcon, Button, Menu, Select, Affix, Badge, Box, Modal, ThemeIcon, useMantineColorScheme, Paper } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
// アイコン（Tabler Icons）
import { IconPlus, IconTrendingUp, IconWallet, IconDots, IconFileImport, IconChevronLeft, IconChevronRight, IconArrowUpRight, IconArrowDownRight, IconMinus, IconCalendar, IconCoins, IconRepeat } from '@tabler/icons-react';
// アニメーション
import { motion } from 'framer-motion';
// カスタムフック
import { useTransactions } from '@/hooks/useTransactions';
// コンポーネント
import { TransactionForm } from '@/components/forms/TransactionForm';
import { TransactionList } from '@/components/ui/TransactionList';
import { PieChart } from '@/components/charts/PieChart';
import { LineChart } from '@/components/charts/LineChart';
import { CSVImportExport } from '@/components/ui/CSVImportExport';
import { MobileCalendar } from '@/components/ui/MobileCalendar';
// ユーティリティ関数
import { calculateMonthlyData, calculateCategoryChartData, calculateMonthlyComparison } from '@/utils/calculations';
import { getCurrentMonth, getMonthName, getMonthOptions, getNextMonth, getPreviousMonthFromCurrent, formatMonthLocal } from '@/utils/dateUtils';
// 型定義
import { Transaction, RecurringTransaction } from '@/types';
// その他のコンポーネント
import { CardRewardsDisplay } from '@/components/ui/CardRewardsDisplay';
import { VersionDisplay } from '@/components/ui/VersionDisplay';
import { useRecurringTransactions } from '@/hooks/useRecurringTransactions';
import { RecurringTransactionManager } from '@/components/recurring/RecurringTransactionManager';
import { RecurringTransactionNotice } from '@/components/recurring/RecurringTransactionNotice';
import { RecurringTransactionConfirm } from '@/components/recurring/RecurringTransactionConfirm';
import { InvestmentHistoryModal } from '@/components/ui/InvestmentHistoryModal';
import { SavingsRateDetailModal } from '@/components/ui/SavingsRateDetailModal';

// ============================================================
// メインコンポーネント
// ============================================================
export function DashboardContent() {
  // ------------------------------------------------------------
  // データ取得フック
  // ------------------------------------------------------------
  const { transactions, loading: transactionsLoading, addTransaction } = useTransactions();
  const {
    getActiveRecurringTransactions,
    shouldShowRecurringTransaction
  } = useRecurringTransactions();

  // ------------------------------------------------------------
  // 取引フォーム状態（Context経由 + ローカル状態の統合）
  // ------------------------------------------------------------
  const { isFormOpen, closeForm } = useTransactionForm();
  const [transactionFormOpened, setTransactionFormOpened] = useState(false);      // 取引追加フォーム

  // Context経由でフォームが開かれた場合にローカル状態を同期
  useEffect(() => {
    if (isFormOpen) {
      setTransactionFormOpened(true);
    }
  }, [isFormOpen]);

  // ------------------------------------------------------------
  // モーダル表示状態の管理
  // ------------------------------------------------------------
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);  // 編集中の取引
  const [recurringManagerOpened, setRecurringManagerOpened] = useState(false);    // 定期取引管理モーダル
  const [recurringConfirmOpened, setRecurringConfirmOpened] = useState(false);    // 定期取引確認モーダル
  const [selectedRecurringTransaction, setSelectedRecurringTransaction] = useState<RecurringTransaction | null>(null);
  const [csvModalOpened, setCsvModalOpened] = useState(false);                    // CSV入出力モーダル
  const [calendarOpened, setCalendarOpened] = useState(false);                    // カレンダーモーダル
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(new Date());
  const [mobileChartType, setMobileChartType] = useState<'expense' | 'income'>('expense'); // モバイル用円グラフ切り替え
  const [cardRewardsOpened, setCardRewardsOpened] = useState(false);              // カード還元ポイント詳細モーダル
  const [yearSummaryOpened, setYearSummaryOpened] = useState(false);              // 年間収支サマリーモーダル
  const [investmentHistoryOpened, setInvestmentHistoryOpened] = useState(false);  // 年間投資履歴モーダル
  const [savingsRateDetailOpened, setSavingsRateDetailOpened] = useState(false);  // 年間貯蓄率詳細モーダル

  // ------------------------------------------------------------
  // レスポンシブ・テーマ判定
  // ------------------------------------------------------------
  // モバイル表示判定（768px以下でtrue）
  const isMobile = useMediaQuery('(max-width: 768px)');

  // ダークモード判定
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  // ------------------------------------------------------------
  // ルーティング・月選択
  // ------------------------------------------------------------
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlMonth = searchParams.get('month');  // URLパラメータから月を取得
  const selectedMonth = urlMonth || getCurrentMonth();  // 未指定時は今月

  // ------------------------------------------------------------
  // データ計算（useMemoでパフォーマンス最適化）
  // ------------------------------------------------------------

  // 月別データの計算（全期間）
  // → 残高推移グラフ、月別比較に使用
  const monthlyData = useMemo(() => calculateMonthlyData(transactions), [transactions]);

  // 選択中の月のデータ
  // → サマリーカードの表示に使用
  const selectedMonthData = useMemo(() =>
    monthlyData.find(data => data.month === selectedMonth),
    [monthlyData, selectedMonth]
  );

  // 前月のデータ（前月比較用）
  const previousMonthData = useMemo(() => {
    const previousMonth = getPreviousMonthFromCurrent(selectedMonth);
    return monthlyData.find(data => data.month === previousMonth);
  }, [monthlyData, selectedMonth]);

  // 前月比較データ（↑↓表示用）
  const monthlyComparison = useMemo(() => {
    if (!selectedMonthData) return null;
    return calculateMonthlyComparison(selectedMonthData, previousMonthData);
  }, [selectedMonthData, previousMonthData]);

  // 年間収支の計算
  // → 「今月の収支」カードをクリックした時のモーダルに表示
  const yearSummary = useMemo(() => {
    const currentYear = new Date(selectedMonth).getFullYear();
    // 年間収支の計算（立替分は除外）
    const yearTransactions = transactions.filter(t =>
      t.date.getFullYear() === currentYear &&
      t.category !== '立替回収' &&
      t.category !== '立替金'
    );

    const income = yearTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const expense = yearTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const balance = income - expense;

    // 月別データ
    const monthlyBreakdown = monthlyData
      .filter(m => new Date(m.month).getFullYear() === currentYear)
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      year: currentYear,
      income,
      expense,
      balance,
      monthlyBreakdown,
    };
  }, [transactions, selectedMonth, monthlyData]);

  // 選択月の取引データ
  // → 円グラフ、取引履歴リストに使用
  const selectedMonthTransactions = useMemo(() =>
    transactions.filter(t => {
      // ローカルタイムゾーンで月を比較（タイムゾーン問題解決）
      const transactionMonth = formatMonthLocal(t.date);
      return transactionMonth === selectedMonth;
    }),
    [transactions, selectedMonth]
  );

  // 収入の円グラフデータ
  const incomeChartData = useMemo(() =>
    calculateCategoryChartData(selectedMonthTransactions, 'income'),
    [selectedMonthTransactions]
  );

  // 支出の円グラフデータ（投資は除外される）
  const expenseChartData = useMemo(() =>
    calculateCategoryChartData(selectedMonthTransactions, 'expense'),
    [selectedMonthTransactions]
  );



  // 貯蓄額と貯蓄率の計算
  // → 「年間投資額」「年間貯蓄率」カードに表示
  // 計算式: 年間貯蓄率 = 年間投資額 / 年間給与額 × 100
  const savingsData = useMemo(() => {
    const currentYear = new Date(selectedMonth).getFullYear();

    // 年間の投資額（固定費カテゴリの投資サブカテゴリのみ）
    const yearlyInvestmentAmount = transactions
      .filter(t =>
        t.date.getFullYear() === currentYear &&
        t.type === 'expense' &&
        t.category === '固定費' &&
        t.subcategory === '投資'
      )
      .reduce((sum, t) => sum + t.amount, 0);

    // 年間の給与額（給与・ボーナス・賞与カテゴリの全て）
    // ※貯蓄率の分母として使用
    const yearlySalaryAmount = transactions
      .filter(t =>
        t.date.getFullYear() === currentYear &&
        t.type === 'income' &&
        ['給与', '賞与', 'ボーナス'].includes(t.category)
      )
      .reduce((sum, t) => sum + t.amount, 0);

    // 年間貯蓄率
    const yearlySavingsRate = yearlySalaryAmount > 0
      ? (yearlyInvestmentAmount / yearlySalaryAmount) * 100
      : 0;

    return {
      yearlyInvestmentAmount: yearlyInvestmentAmount,
      yearlySalaryAmount: yearlySalaryAmount,
      yearlySavingsRate: yearlySavingsRate,
    };
  }, [transactions, selectedMonth]);

  // 月間カード還元ポイント計算
  const monthlyCardPoints = useMemo(() => {
    const cardMethods = ['三井住友カード', '三菱UFJカード', 'amazonカード', 'EPOSカード', '楽天カード'];
    const cardTransactions = selectedMonthTransactions.filter(t =>
      t.type === 'expense' && cardMethods.includes(t.paymentMethod || '')
    );

    const CARD_REWARD_RATES = {
      '楽天カード': 0.01,
      '三菱UFJカード': 0.07,
      'EPOSカード': 0.0025,
      'amazonカード': 0.01,
      '三井住友カード': 0.005,
    };

    return cardTransactions.reduce((sum, t) => {
      const rate = CARD_REWARD_RATES[t.paymentMethod as keyof typeof CARD_REWARD_RATES];
      return sum + (rate ? Math.floor(t.amount * rate) : 0);
    }, 0);
  }, [selectedMonthTransactions]);

  // 表示すべき定期取引を取得
  const displayRecurringTransactions = useMemo(() => {
    const active = getActiveRecurringTransactions();
    // 全取引履歴（transactions）を渡して、今月登録済みかをチェック
    return active.filter(transaction => shouldShowRecurringTransaction(transaction, transactions));
  }, [getActiveRecurringTransactions, shouldShowRecurringTransaction, transactions]);

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setTransactionFormOpened(true);
  };

  const handleCloseTransactionForm = () => {
    setTransactionFormOpened(false);
    setEditingTransaction(null);
    closeForm(); // Context側も閉じる
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
    // カード取引タイプの判定
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

  const handlePreviousMonth = () => {
    const previousMonth = getPreviousMonthFromCurrent(selectedMonth);
    handleMonthChange(previousMonth);
  };

  const handleNextMonth = () => {
    const nextMonth = getNextMonth(selectedMonth);
    handleMonthChange(nextMonth);
  };

  const handleCalendarDateChange = (date: Date) => {
    setCalendarSelectedDate(date);
    setCalendarOpened(false);
    // 選択した日付の取引履歴を表示するため、その月に移動
    const selectedMonth = formatMonthLocal(date);
    handleMonthChange(selectedMonth);
  };

  const monthOptions = getMonthOptions();

  // トレンドアイコンとバッジを表示するコンポーネント
  const TrendIndicator = ({ trend, percentage }: { trend: 'up' | 'down' | 'same'; percentage: number }) => {
    const getTrendColor = (trend: 'up' | 'down' | 'same') => {
      switch (trend) {
        case 'up': return 'green';
        case 'down': return 'red';
        case 'same': return 'gray';
      }
    };

    const getTrendIcon = (trend: 'up' | 'down' | 'same') => {
      switch (trend) {
        case 'up': return <IconArrowUpRight size={12} />;
        case 'down': return <IconArrowDownRight size={12} />;
        case 'same': return <IconMinus size={12} />;
      }
    };

    if (percentage === 0) return null;

    return (
      <Badge
        variant="light"
        color={getTrendColor(trend)}
        leftSection={getTrendIcon(trend)}
        size="xs"
      >
        {Math.abs(percentage)}%
      </Badge>
    );
  };

  if (transactionsLoading) {
    return (
      <Container size="xl" py="xl">
        <Text ta="center">データを読み込み中...</Text>
      </Container>
    );
  }

  return (
    <Container size="xl" py={isMobile ? "md" : "lg"} style={{ paddingBottom: isMobile ? '80px' : undefined }}>
      <Stack gap={isMobile ? "sm" : "md"}>
        <Group justify="space-between">
          <Group gap={isMobile ? "xs" : "md"}>
            <ActionIcon
              variant="light"
              size={isMobile ? "xl" : "lg"}
              onClick={handlePreviousMonth}
              style={isMobile ? {
                minWidth: '48px',
                minHeight: '48px',
                touchAction: 'manipulation',
              } : undefined}
            >
              <IconChevronLeft size={isMobile ? 20 : 18} />
            </ActionIcon>
            {isMobile ? (
              <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                dragMomentum={false}
                onDragEnd={(e, info) => {
                  // 50px以上スワイプしたら月を変更
                  if (info.offset.x > 50) {
                    handlePreviousMonth();
                  } else if (info.offset.x < -50) {
                    handleNextMonth();
                  }
                }}
                style={{
                  cursor: 'grab',
                  touchAction: 'none',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  WebkitTouchCallout: 'none',
                }}
                whileTap={{ cursor: 'grabbing', scale: 0.98 }}
              >
                <Stack gap={0} align="center" style={{ pointerEvents: 'none' }}>
                  <Box style={{ pointerEvents: 'auto' }}>
                    <Select
                      data={monthOptions}
                      value={selectedMonth}
                      onChange={handleMonthChange}
                      searchable={false}
                      w={140}
                      size="sm"
                      styles={{
                        input: {
                          fontSize: '16px',
                          fontWeight: 600,
                          minHeight: '40px',
                          textAlign: 'center',
                        },
                        dropdown: {
                          maxHeight: '60vh',
                        },
                        option: {
                          fontSize: '14px',
                          padding: '10px',
                        }
                      }}
                    />
                  </Box>
                  <Text
                    size="9px"
                    c="dimmed"
                    style={{
                      marginTop: '-2px',
                      opacity: 0.5,
                    }}
                  >
                    ← スワイプ →
                  </Text>
                </Stack>
              </motion.div>
            ) : (
              <Select
                data={monthOptions}
                value={selectedMonth}
                onChange={handleMonthChange}
                searchable
                w={200}
                size="md"
              />
            )}
            <ActionIcon
              variant="light"
              size={isMobile ? "xl" : "lg"}
              onClick={handleNextMonth}
              style={isMobile ? {
                minWidth: '48px',
                minHeight: '48px',
                touchAction: 'manipulation',
              } : undefined}
            >
              <IconChevronRight size={isMobile ? 20 : 18} />
            </ActionIcon>
          </Group>
          {!isMobile && (
            <Group gap={isMobile ? "xs" : "md"}>
              <Button
                leftSection={<IconPlus size={14} />}
                onClick={() => setTransactionFormOpened(true)}
                size={isMobile ? "sm" : "md"}
              >
                {isMobile ? '追加' : '取引を追加'}
              </Button>
              <Button
                variant="light"
                leftSection={<IconRepeat size={14} />}
                onClick={() => setRecurringManagerOpened(true)}
                size={isMobile ? "sm" : "md"}
                color="orange"
              >
                定期取引
              </Button>
              <Button
                variant="light"
                leftSection={<IconCalendar size={14} />}
                onClick={() => setCalendarOpened(true)}
                size={isMobile ? "sm" : "md"}
                color="blue"
              >
                カレンダー
              </Button>
              <Menu shadow="md" width={isMobile ? 180 : 200}>
                <Menu.Target>
                  <ActionIcon variant="light" size={isMobile ? "md" : "lg"}>
                    <IconDots size={14} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    leftSection={<IconFileImport size={14} />}
                    onClick={() => setCsvModalOpened(true)}
                  >
                    CSV インポート/エクスポート
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          )}
        </Group>

        {/* 定期取引通知セクション */}
        {displayRecurringTransactions.length > 0 && (
          <RecurringTransactionNotice
            recurringTransactions={displayRecurringTransactions}
            onRecord={handleRecordRecurringTransaction}
          />
        )}

        {/* ============================================================
            サマリーカード（4行2列レイアウト）
            
            【レイアウト構成】
            1行目: 収入カード（緑）| 支出カード（赤）
            2行目: 今月の収支カード（青/赤）| 実残高カード（ティール/赤）
            3行目: カード支払いカード（紫）| 獲得ポイントカード（オレンジ）
            4行目: 年間投資額カード（オレンジ）| 年間貯蓄率カード（紫）
            
            【色変更方法】
            各カードのstyle内の以下を変更:
            - background: グラデーション背景色
            - borderLeft: 左側のアクセントライン
            - boxShadow: 影の色
            
            【サイズ変更方法】
            - p={isMobile ? "xs" : "sm"}: カード内のパディング
            - minHeight: カードの最小高さ
            - Grid gutter="xs": カード間の隙間（xs=8px, sm=12px, md=16px）
            ============================================================ */}
        {/* ============================================================
            Bento Grid Layout (Hierarchy Focused)
            
            1. Hero Card (Span 12): Net Balance (Most Important)
            2. Secondary Cards (Span 6): Income vs Expense (Comparison)
            3. Tertiary Cards (Span 6/4): Savings, Points etc. (Supplements)
            ============================================================ */}
        <Grid mb={isMobile ? "md" : "lg"} gutter={isMobile ? "xs" : "md"}>
          {/* HERO CARD: 今月の収支/残高 */}
          <Grid.Col span={{ base: 12 }}>
            <Paper
              p={isMobile ? "md" : "lg"}
              radius="lg"
              className="glass"
              onClick={() => setYearSummaryOpened(true)}
              style={{
                cursor: 'pointer',
                background: isDark
                  ? 'linear-gradient(135deg, rgba(33, 150, 243, 0.1) 0%, rgba(33, 150, 243, 0.05) 100%)'
                  : 'linear-gradient(135deg, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.4) 100%)',
                border: isDark
                  ? '1px solid rgba(33, 150, 243, 0.2)'
                  : '1px solid rgba(255, 255, 255, 0.6)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '160px', // Taller for impact
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Background Decoration */}
              <Box style={{
                position: 'absolute',
                top: '-50%',
                left: '-50%',
                width: '200%',
                height: '200%',
                background: 'radial-gradient(circle, rgba(33,150,243,0.05) 0%, rgba(0,0,0,0) 70%)',
                zIndex: 0,
                pointerEvents: 'none',
              }} />

              <Stack gap={0} align="center" style={{ zIndex: 1, width: '100%' }}>
                <Text size="sm" c="dimmed" fw={600} mb={4} style={{ letterSpacing: '1px', textTransform: 'uppercase' }}>
                  Current Balance
                </Text>
                <Group align="flex-start" gap={4}>
                  <Text
                    span
                    style={{
                      fontSize: '3.5rem',
                      fontWeight: 800,
                      lineHeight: 1,
                      letterSpacing: '-1px',
                      color: ((selectedMonthData?.income || 0) - (selectedMonthData?.expense || 0)) >= 0
                        ? 'var(--mantine-color-blue-6)'
                        : 'var(--mantine-color-red-6)'
                    }}
                  >
                    ¥{((selectedMonthData?.income || 0) - (selectedMonthData?.expense || 0)).toLocaleString()}
                  </Text>
                </Group>
                <Group gap="xs" mt="xs">
                  <Badge
                    variant="light"
                    color={((selectedMonthData?.income || 0) - (selectedMonthData?.expense || 0)) >= 0 ? 'blue' : 'red'}
                    size="lg"
                  >
                    今月の収支
                  </Badge>
                  {monthlyComparison && (
                    <TrendIndicator
                      trend={monthlyComparison.balance.trend}
                      percentage={monthlyComparison.balance.percentage}
                    />
                  )}
                </Group>
              </Stack>
            </Paper>
          </Grid.Col>

          {/* SECONDARY: Income & Expense (Side by Side) */}
          <Grid.Col span={{ base: 6 }}>
            <Paper
              p={isMobile ? "sm" : "md"}
              radius="lg"
              className="glass"
              style={{
                height: '100%',
                background: isDark
                  ? 'rgba(33, 37, 41, 0.6)'
                  : 'rgba(255, 255, 255, 0.5)',
                borderLeft: '4px solid var(--mantine-color-teal-5)'
              }}
            >
              <Stack gap={4} h="100%" justify="space-between">
                <Group justify="space-between">
                  <Text size="xs" c="dimmed" fw={600}>INCOME</Text>
                  <ThemeIcon variant="light" color="teal" size="sm" radius="xl">
                    <IconArrowUpRight size={12} />
                  </ThemeIcon>
                </Group>
                <div>
                  <Text size="xl" fw={700} c="teal" style={{ lineHeight: 1.2 }}>
                    ¥{(selectedMonthData?.income || 0).toLocaleString()}
                  </Text>
                  {monthlyComparison && (
                    <Group gap={4}>
                      <Text size="xs" c="dimmed">前月比</Text>
                      <Text size="xs" c={monthlyComparison.income.trend === 'up' ? 'teal' : 'red'}>
                        {monthlyComparison.income.trend === 'up' ? '+' : ''}{monthlyComparison.income.percentage}%
                      </Text>
                    </Group>
                  )}
                </div>
              </Stack>
            </Paper>
          </Grid.Col>

          <Grid.Col span={{ base: 6 }}>
            <Paper
              p={isMobile ? "sm" : "md"}
              radius="lg"
              className="glass"
              style={{
                height: '100%',
                background: isDark
                  ? 'rgba(33, 37, 41, 0.6)'
                  : 'rgba(255, 255, 255, 0.5)',
                borderLeft: '4px solid var(--mantine-color-red-5)'
              }}
            >
              <Stack gap={4} h="100%" justify="space-between">
                <Group justify="space-between">
                  <Text size="xs" c="dimmed" fw={600}>EXPENSE</Text>
                  <ThemeIcon variant="light" color="red" size="sm" radius="xl">
                    <IconArrowDownRight size={12} />
                  </ThemeIcon>
                </Group>
                <div>
                  <Text size="xl" fw={700} c="red" style={{ lineHeight: 1.2 }}>
                    ¥{(selectedMonthData?.expense || 0).toLocaleString()}
                  </Text>
                  {monthlyComparison && (
                    <Group gap={4}>
                      <Text size="xs" c="dimmed">前月比</Text>
                      <Text size="xs" c={monthlyComparison.expense.trend === 'up' ? 'red' : 'teal'}>
                        {monthlyComparison.expense.trend === 'up' ? '+' : ''}{monthlyComparison.expense.percentage}%
                      </Text>
                    </Group>
                  )}
                </div>
              </Stack>
            </Paper>
          </Grid.Col>

          {/* TERTIARY: Smaller metrics */}
          <Grid.Col span={{ base: 6 }}>
            <Paper
              p={isMobile ? "sm" : "md"}
              radius="lg"
              className="glass"
              onClick={() => setCardRewardsOpened(true)}
              style={{ cursor: 'pointer', height: '100%' }}
            >
              <Stack gap="xs">
                <Group gap="xs">
                  <ThemeIcon variant="light" color="orange" size="md" radius="md">
                    <IconCoins size={16} />
                  </ThemeIcon>
                  <Text size="xs" c="dimmed" fw={600}>獲得ポイント</Text>
                </Group>
                <Text size="lg" fw={700}>
                  {monthlyCardPoints.toLocaleString()} <Text span size="xs" c="dimmed">pt</Text>
                </Text>
              </Stack>
            </Paper>
          </Grid.Col>

          <Grid.Col span={{ base: 6 }}>
            <Paper
              p={isMobile ? "sm" : "md"}
              radius="lg"
              className="glass"
              onClick={() => setSavingsRateDetailOpened(true)}
              style={{ cursor: 'pointer', height: '100%' }}
            >
              <Stack gap="xs">
                <Group gap="xs">
                  <ThemeIcon variant="light" color="violet" size="md" radius="md">
                    <IconTrendingUp size={16} />
                  </ThemeIcon>
                  <Text size="xs" c="dimmed" fw={600}>貯蓄率</Text>
                </Group>
                <Text size="lg" fw={700}>
                  {savingsData.yearlySavingsRate.toFixed(1)} <Text span size="xs" c="dimmed">%</Text>
                </Text>
              </Stack>
            </Paper>
          </Grid.Col>

          <Grid.Col span={{ base: 12 }}>
            <Paper
              p="xs"
              radius="lg"
              style={{
                background: 'transparent',
                border: '1px dashed var(--mantine-color-gray-4)',
                cursor: 'pointer'
              }}
              onClick={() => setInvestmentHistoryOpened(true)}
            >
              <Group justify="center" gap="xs">
                <Text size="xs" c="dimmed">年間投資額: </Text>
                <Text size="sm" fw={600}>¥{savingsData.yearlyInvestmentAmount.toLocaleString()}</Text>
                <IconChevronRight size={12} color="gray" />
              </Group>
            </Paper>
          </Grid.Col>
        </Grid>

        {/* 円グラフセクション - モバイル対応 */}
        {
          isMobile ? (
            /* モバイル: 切り替え式円グラフ */
            <Stack gap="sm">
              {/* 切り替えボタン */}
              <Group justify="center" gap="xs">
                <Button
                  variant={mobileChartType === 'expense' ? 'filled' : 'light'}
                  color="red"
                  size="sm"
                  onClick={() => setMobileChartType('expense')}
                  style={{
                    borderRadius: '20px',
                    transition: 'all 0.3s ease',
                    transform: mobileChartType === 'expense' ? 'scale(1.05)' : 'scale(1)',
                  }}
                >
                  📊 支出内訳
                </Button>
                <Button
                  variant={mobileChartType === 'income' ? 'filled' : 'light'}
                  color="green"
                  size="sm"
                  onClick={() => setMobileChartType('income')}
                  style={{
                    borderRadius: '20px',
                    transition: 'all 0.3s ease',
                    transform: mobileChartType === 'income' ? 'scale(1.05)' : 'scale(1)',
                  }}
                >
                  💰 収入内訳
                </Button>
              </Group>

              {/* 選択された円グラフを表示 */}
              <div style={{
                animation: 'fadeInScale 0.4s ease-out',
                transform: 'translateY(0)',
              }}>
                {mobileChartType === 'expense' ? (
                  <PieChart
                    title={`${getMonthName(selectedMonth)}の支出内訳`}
                    data={expenseChartData}
                    totalAmount={selectedMonthData?.expense || 0}
                    color="red"
                  />
                ) : (
                  <PieChart
                    title={`${getMonthName(selectedMonth)}の収入内訳`}
                    data={incomeChartData}
                    totalAmount={selectedMonthData?.income || 0}
                    color="green"
                  />
                )}
              </div>
            </Stack>
          ) : (
            /* デスクトップ: 並列表示 */
            <Grid>
              <Grid.Col span={{ base: 12, lg: 6 }}>
                <PieChart
                  title={`${getMonthName(selectedMonth)}の支出内訳`}
                  data={expenseChartData}
                  totalAmount={selectedMonthData?.expense || 0}
                  color="red"
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, lg: 6 }}>
                <PieChart
                  title={`${getMonthName(selectedMonth)}の収入内訳`}
                  data={incomeChartData}
                  totalAmount={selectedMonthData?.income || 0}
                  color="green"
                />
              </Grid.Col>
            </Grid>
          )
        }

        <LineChart
          title="残高推移"
          data={monthlyData}
          transactions={transactions}
        />

        <CardRewardsDisplay
          transactions={transactions}
          selectedMonth={selectedMonth}
          opened={cardRewardsOpened}
          onClose={() => setCardRewardsOpened(false)}
        />

        <TransactionList
          transactions={selectedMonthTransactions}
          onEditTransaction={handleEditTransaction}
        />

        {/* バージョン表示 */}
        <VersionDisplay />

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

        {/* モバイル用フローティングアクションボタン */}
        {
          isMobile && (
            <Affix position={{ bottom: 20, right: 20 }} style={{ zIndex: transactionFormOpened ? 1 : 1000 }}>
              <Group gap="xs">
                <Button
                  variant="light"
                  leftSection={<IconCalendar size={16} />}
                  onClick={() => setCalendarOpened(true)}
                  size="md"
                  color="blue"
                  style={{
                    borderRadius: '25px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    paddingLeft: '16px',
                    paddingRight: '20px',
                    opacity: transactionFormOpened ? 0.3 : 1,
                    pointerEvents: transactionFormOpened ? 'none' : 'auto'
                  }}
                >
                  📅
                </Button>
                <Button
                  variant="light"
                  leftSection={<IconRepeat size={16} />}
                  onClick={() => setRecurringManagerOpened(true)}
                  size="md"
                  color="orange"
                  style={{
                    borderRadius: '25px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    paddingLeft: '16px',
                    paddingRight: '20px',
                    opacity: transactionFormOpened ? 0.3 : 1,
                    pointerEvents: transactionFormOpened ? 'none' : 'auto'
                  }}
                >
                  定期
                </Button>
                <Button
                  leftSection={<IconPlus size={16} />}
                  onClick={() => setTransactionFormOpened(true)}
                  size="md"
                  style={{
                    borderRadius: '25px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    paddingLeft: '16px',
                    paddingRight: '20px',
                    opacity: transactionFormOpened ? 0.3 : 1,
                    pointerEvents: transactionFormOpened ? 'none' : 'auto'
                  }}
                >
                  追加
                </Button>
              </Group>
            </Affix>
          )
        }
      </Stack >

      {/* 年間収支サマリーモーダル */}
      < Modal
        opened={yearSummaryOpened}
        onClose={() => setYearSummaryOpened(false)
        }
        title={
          < Group gap="sm" >
            <ThemeIcon size="lg" color="blue" variant="light">
              <IconTrendingUp size={20} />
            </ThemeIcon>
            <Text size="lg" fw={600}>{yearSummary.year}年 年間収支</Text>
          </Group >
        }
        size="lg"
        centered
      >
        <Stack gap="md">
          {/* 年間サマリー */}
          <Grid>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <Box
                p="md"
                style={{
                  backgroundColor: 'light-dark(var(--mantine-color-blue-0), var(--mantine-color-dark-6))',
                  borderRadius: '8px',
                  border: '1px solid light-dark(var(--mantine-color-blue-2), var(--mantine-color-dark-4))'
                }}
              >
                <Group gap="xs" mb="xs">
                  <IconArrowDownRight size={16} color="var(--mantine-color-blue-6)" />
                  <Text size="xs" c="dimmed" fw={600}>年間収入</Text>
                </Group>
                <Text size="xl" fw={700} c="blue">
                  ¥{yearSummary.income.toLocaleString()}
                </Text>
              </Box>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <Box
                p="md"
                style={{
                  backgroundColor: 'light-dark(var(--mantine-color-red-0), var(--mantine-color-dark-6))',
                  borderRadius: '8px',
                  border: '1px solid light-dark(var(--mantine-color-red-2), var(--mantine-color-dark-4))'
                }}
              >
                <Group gap="xs" mb="xs">
                  <IconArrowUpRight size={16} color="var(--mantine-color-red-6)" />
                  <Text size="xs" c="dimmed" fw={600}>年間支出(投資含む)</Text>
                </Group>
                <Text size="xl" fw={700} c="red">
                  ¥{yearSummary.expense.toLocaleString()}
                </Text>
              </Box>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <Box
                p="md"
                style={{
                  backgroundColor: yearSummary.balance >= 0
                    ? 'light-dark(var(--mantine-color-green-0), var(--mantine-color-dark-6))'
                    : 'light-dark(var(--mantine-color-orange-0), var(--mantine-color-dark-6))',
                  borderRadius: '8px',
                  border: `1px solid ${yearSummary.balance >= 0
                    ? 'light-dark(var(--mantine-color-green-2), var(--mantine-color-dark-4))'
                    : 'light-dark(var(--mantine-color-orange-2), var(--mantine-color-dark-4))'}`
                }}
              >
                <Group gap="xs" mb="xs">
                  <IconWallet size={16} color={yearSummary.balance >= 0 ? 'var(--mantine-color-green-6)' : 'var(--mantine-color-orange-6)'} />
                  <Text size="xs" c="dimmed" fw={600}>年間収支</Text>
                </Group>
                <Text size="xl" fw={700} c={yearSummary.balance >= 0 ? 'green' : 'orange'}>
                  {yearSummary.balance >= 0 ? '+' : ''}¥{yearSummary.balance.toLocaleString()}
                </Text>
              </Box>
            </Grid.Col>
          </Grid>

          {/* 月別内訳 */}
          <Box>
            <Text size="sm" fw={600} c="dimmed" mb="sm">月別内訳</Text>
            <Stack gap="xs">
              {yearSummary.monthlyBreakdown.map((monthData) => {
                const balance = monthData.income - monthData.expense;
                return (
                  <Card
                    key={monthData.month}
                    withBorder
                    p="sm"
                    style={{
                      backgroundColor: monthData.month === selectedMonth
                        ? 'light-dark(var(--mantine-color-blue-0), var(--mantine-color-dark-7))'
                        : undefined
                    }}
                  >
                    <Group justify="space-between">
                      <Box>
                        <Group gap="xs" align="center">
                          <Text size="sm" fw={600}>
                            {getMonthName(monthData.month)}
                          </Text>
                          {monthData.month === selectedMonth && (
                            <Badge size="xs" color="blue">今月</Badge>
                          )}
                        </Group>
                        <Group gap="md" mt="xs">
                          <Text size="xs" c="dimmed">
                            収入: <Text component="span" c="blue" fw={600}>¥{monthData.income.toLocaleString()}</Text>
                          </Text>
                          <Text size="xs" c="dimmed">
                            支出: <Text component="span" c="red" fw={600}>¥{monthData.expense.toLocaleString()}</Text>
                          </Text>
                        </Group>
                      </Box>
                      <Text
                        size="lg"
                        fw={700}
                        c={balance >= 0 ? 'green' : 'red'}
                      >
                        {balance >= 0 ? '+' : ''}¥{balance.toLocaleString()}
                      </Text>
                    </Group>
                  </Card>
                );
              })}

              <Box
                p="md"
                style={{
                  backgroundColor: 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-6))',
                  borderRadius: '8px',
                  border: '1px solid light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-4))'
                }}
              >
                <Text size="sm" fw={600} mb="sm">月平均</Text>
                <Group gap="md">
                  <Text size="xs" c="dimmed">
                    収入: <Text component="span" fw={600} c="blue">
                      ¥{Math.round(yearSummary.income / 12).toLocaleString()}
                    </Text>
                  </Text>
                  <Text size="xs" c="dimmed">
                    支出: <Text component="span" fw={600} c="red">
                      ¥{Math.round(yearSummary.expense / 12).toLocaleString()}
                    </Text>
                  </Text>
                  <Text size="xs" c="dimmed">
                    収支: <Text component="span" fw={600} c={yearSummary.balance >= 0 ? 'green' : 'orange'}>
                      {yearSummary.balance >= 0 ? '+' : ''}¥{Math.round(yearSummary.balance / 12).toLocaleString()}
                    </Text>
                  </Text>
                </Group>
              </Box>
            </Stack>
          </Box>
        </Stack>
      </Modal>

      {/* 年間投資履歴モーダル */}
      <InvestmentHistoryModal
        opened={investmentHistoryOpened}
        onClose={() => setInvestmentHistoryOpened(false)}
        transactions={transactions}
        year={new Date(selectedMonth).getFullYear()}
      />

      {/* 年間貯蓄率詳細モーダル */}
      <SavingsRateDetailModal
        opened={savingsRateDetailOpened}
        onClose={() => setSavingsRateDetailOpened(false)}
        transactions={transactions}
        year={new Date(selectedMonth).getFullYear()}
      />
    </Container>
  );
}
