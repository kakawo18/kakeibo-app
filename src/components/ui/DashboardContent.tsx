'use client';

import { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Container, Stack, Grid, Card, Text, Group, ActionIcon, Button, Menu, Select, Affix, Badge, Box, Modal, ThemeIcon, useMantineColorScheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconPlus, IconTrendingUp, IconTrendingDown, IconWallet, IconDots, IconFileImport, IconChevronLeft, IconChevronRight, IconArrowUpRight, IconArrowDownRight, IconMinus, IconCreditCard, IconBuildingBank, IconCalendar, IconCoins, IconRepeat } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { useTransactions } from '@/hooks/useTransactions';
import { TransactionForm } from '@/components/forms/TransactionForm';
import { TransactionList } from '@/components/ui/TransactionList';
import { PieChart } from '@/components/charts/PieChart';
import { LineChart } from '@/components/charts/LineChart';
import { CSVImportExport } from '@/components/ui/CSVImportExport';
import { MobileCalendar } from '@/components/ui/MobileCalendar';
import { calculateMonthlyData, calculateCategoryChartData, calculateMonthlyComparison } from '@/utils/calculations';
import { getCurrentMonth, getMonthName, getMonthOptions, getNextMonth, getPreviousMonthFromCurrent, formatMonthLocal } from '@/utils/dateUtils';
import { Transaction, RecurringTransaction } from '@/types';
import { CardRewardsDisplay } from '@/components/ui/CardRewardsDisplay';
import { VersionDisplay } from '@/components/ui/VersionDisplay';
import { useRecurringTransactions } from '@/hooks/useRecurringTransactions';
import { RecurringTransactionManager } from '@/components/recurring/RecurringTransactionManager';
import { RecurringTransactionNotice } from '@/components/recurring/RecurringTransactionNotice';
import { RecurringTransactionConfirm } from '@/components/recurring/RecurringTransactionConfirm';

export function DashboardContent() {
  const { transactions, loading: transactionsLoading, addTransaction } = useTransactions();
  const { 
    getActiveRecurringTransactions, 
    shouldShowRecurringTransaction 
  } = useRecurringTransactions();
  
  const [transactionFormOpened, setTransactionFormOpened] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [recurringManagerOpened, setRecurringManagerOpened] = useState(false);
  const [recurringConfirmOpened, setRecurringConfirmOpened] = useState(false);
  const [selectedRecurringTransaction, setSelectedRecurringTransaction] = useState<RecurringTransaction | null>(null);
  const [csvModalOpened, setCsvModalOpened] = useState(false);
  const [calendarOpened, setCalendarOpened] = useState(false);
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(new Date());
  const [mobileChartType, setMobileChartType] = useState<'expense' | 'income'>('expense'); // モバイル用円グラフ切り替え
  const [cardRewardsOpened, setCardRewardsOpened] = useState(false); // カード還元ポイント詳細モーダル
  const [yearSummaryOpened, setYearSummaryOpened] = useState(false); // 年間収支サマリーモーダル
  
  // モバイル表示判定
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  // ダークモード判定
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlMonth = searchParams.get('month');
  const selectedMonth = urlMonth || getCurrentMonth();

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

  // 年間収支の計算
  const yearSummary = useMemo(() => {
    const currentYear = new Date(selectedMonth).getFullYear();
    const yearTransactions = transactions.filter(t => t.date.getFullYear() === currentYear);
    
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

  const selectedMonthTransactions = useMemo(() => 
    transactions.filter(t => {
      // ローカルタイムゾーンで月を比較（タイムゾーン問題解決）
      const transactionMonth = formatMonthLocal(t.date);
      return transactionMonth === selectedMonth;
    }),
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

  const cardPaymentTotal = useMemo(() => {
    const cardMethods = ['三井住友カード', '三菱UFJカード', 'amazonカード', 'EPOSカード', '楽天カード'];
    return selectedMonthTransactions
      .filter(t => 
        t.type === 'expense' && 
        cardMethods.includes(t.paymentMethod || '')
      )
      .reduce((sum, t) => sum + t.amount, 0);
  }, [selectedMonthTransactions]);

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
    return active.filter(transaction => shouldShowRecurringTransaction(transaction));
  }, [getActiveRecurringTransactions, shouldShowRecurringTransaction]);

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
    <Container size="xl" py="xl" style={{ paddingBottom: isMobile ? '100px' : undefined }}>
      <Stack>
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

        {/* 3行2列レイアウト - スペース効率最適化 */}
        <Grid>
          {/* 1行目: 収入・支出 */}
          <Grid.Col span={{ base: 6, sm: 6 }}>
            <Card 
              withBorder 
              p={isMobile ? "sm" : "md"} 
              className="enhanced-card"
              style={{ 
                minHeight: isMobile ? '80px' : undefined,
                background: isDark 
                  ? 'linear-gradient(135deg, rgba(76, 175, 80, 0.15) 0%, rgba(76, 175, 80, 0.25) 100%)'
                  : 'linear-gradient(135deg, rgba(76, 175, 80, 0.05) 0%, rgba(76, 175, 80, 0.15) 100%)',
                borderLeft: '4px solid #4caf50',
                boxShadow: '0 2px 12px rgba(76, 175, 80, 0.1)',
                cursor: 'pointer',
                animation: 'fadeInScale 0.5s ease-out',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(76, 175, 80, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 12px rgba(76, 175, 80, 0.1)';
              }}
            >
              <Group>
                <ActionIcon 
                  size={isMobile ? "md" : "lg"} 
                  color="green" 
                  variant="light"
                  style={{
                    background: 'linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)',
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)',
                  }}
                >
                  <IconTrendingUp size={isMobile ? 16 : 20} />
                </ActionIcon>
                <div>
                  <Group gap="xs" align="center">
                    <Text size={isMobile ? "xs" : "sm"} c="dimmed" fw={600}>収入</Text>
                    {monthlyComparison && (
                      <TrendIndicator 
                        trend={monthlyComparison.income.trend} 
                        percentage={monthlyComparison.income.percentage} 
                      />
                    )}
                  </Group>
                  <Text size={isMobile ? "md" : "xl"} fw={700} c="green">
                    ¥{(selectedMonthData?.income || 0).toLocaleString()}
                  </Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 6, sm: 6 }}>
            <Card 
              withBorder 
              p={isMobile ? "sm" : "md"} 
              className="enhanced-card"
              style={{ 
                minHeight: isMobile ? '80px' : undefined,
                background: isDark
                  ? 'linear-gradient(135deg, rgba(244, 67, 54, 0.15) 0%, rgba(244, 67, 54, 0.25) 100%)'
                  : 'linear-gradient(135deg, rgba(244, 67, 54, 0.05) 0%, rgba(244, 67, 54, 0.15) 100%)',
                borderLeft: '4px solid #f44336',
                boxShadow: '0 2px 12px rgba(244, 67, 54, 0.1)',
                cursor: 'pointer',
                animation: 'fadeInScale 0.5s ease-out 0.1s both',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(244, 67, 54, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 12px rgba(244, 67, 54, 0.1)';
              }}
            >
              <Group>
                <ActionIcon 
                  size={isMobile ? "md" : "lg"} 
                  color="red" 
                  variant="light"
                  style={{
                    background: 'linear-gradient(135deg, #f44336 0%, #ef5350 100%)',
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(244, 67, 54, 0.3)',
                  }}
                >
                  <IconTrendingDown size={isMobile ? 16 : 20} />
                </ActionIcon>
                <div>
                  <Group gap="xs" align="center">
                    <Text size={isMobile ? "xs" : "sm"} c="dimmed" fw={600}>支出</Text>
                    {monthlyComparison && (
                      <TrendIndicator 
                        trend={monthlyComparison.expense.trend} 
                        percentage={monthlyComparison.expense.percentage} 
                      />
                    )}
                  </Group>
                  <Text size={isMobile ? "md" : "xl"} fw={700} c="red">
                    ¥{(selectedMonthData?.expense || 0).toLocaleString()}
                  </Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>

          {/* 2行目: 今月の収支・実残高 */}
          <Grid.Col span={{ base: 6, sm: 6 }}>
            <Card 
              withBorder 
              p={isMobile ? "sm" : "md"} 
              className="enhanced-card"
              onClick={() => setYearSummaryOpened(true)}
              style={{ 
                minHeight: isMobile ? '80px' : undefined,
                background: `linear-gradient(135deg, ${
                  (selectedMonthData?.income || 0) - (selectedMonthData?.expense || 0) >= 0 
                    ? isDark ? 'rgba(33, 150, 243, 0.15) 0%, rgba(33, 150, 243, 0.25) 100%' : 'rgba(33, 150, 243, 0.05) 0%, rgba(33, 150, 243, 0.15) 100%'
                    : isDark ? 'rgba(244, 67, 54, 0.15) 0%, rgba(244, 67, 54, 0.25) 100%' : 'rgba(244, 67, 54, 0.05) 0%, rgba(244, 67, 54, 0.15) 100%'
                })`,
                borderLeft: `4px solid ${(selectedMonthData?.income || 0) - (selectedMonthData?.expense || 0) >= 0 ? '#2196f3' : '#f44336'}`,
                boxShadow: `0 2px 12px ${(selectedMonthData?.income || 0) - (selectedMonthData?.expense || 0) >= 0 ? 'rgba(33, 150, 243, 0.1)' : 'rgba(244, 67, 54, 0.1)'}`,
                cursor: 'pointer',
                animation: 'fadeInScale 0.5s ease-out 0.2s both',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = `0 8px 30px ${(selectedMonthData?.income || 0) - (selectedMonthData?.expense || 0) >= 0 ? 'rgba(33, 150, 243, 0.2)' : 'rgba(244, 67, 54, 0.2)'}`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = `0 2px 12px ${(selectedMonthData?.income || 0) - (selectedMonthData?.expense || 0) >= 0 ? 'rgba(33, 150, 243, 0.1)' : 'rgba(244, 67, 54, 0.1)'}`;
              }}
            >
              <Group>
                <ActionIcon 
                  size={isMobile ? "md" : "lg"} 
                  color={(selectedMonthData?.income || 0) - (selectedMonthData?.expense || 0) >= 0 ? 'blue' : 'red'}
                  variant="light"
                  style={{
                    background: `linear-gradient(135deg, ${
                      (selectedMonthData?.income || 0) - (selectedMonthData?.expense || 0) >= 0 
                        ? '#2196f3 0%, #42a5f5 100%'
                        : '#f44336 0%, #ef5350 100%'
                    })`,
                    color: 'white',
                    boxShadow: `0 4px 12px ${(selectedMonthData?.income || 0) - (selectedMonthData?.expense || 0) >= 0 ? 'rgba(33, 150, 243, 0.3)' : 'rgba(244, 67, 54, 0.3)'}`,
                  }}
                >
                  <IconWallet size={isMobile ? 16 : 20} />
                </ActionIcon>
                <div>
                  <Text size={isMobile ? "xs" : "sm"} c="dimmed" fw={600}>今月の収支</Text>
                  <Text size={isMobile ? "xs" : "xs"} c="dimmed">カード支払い含む</Text>
                  <Text 
                    size={isMobile ? "md" : "xl"} 
                    fw={700} 
                    c={(selectedMonthData?.income || 0) - (selectedMonthData?.expense || 0) >= 0 ? 'blue' : 'red'}
                  >
                    ¥{((selectedMonthData?.income || 0) - (selectedMonthData?.expense || 0)).toLocaleString()}
                  </Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 6, sm: 6 }}>
            <Card 
              withBorder 
              p={isMobile ? "sm" : "md"} 
              className="enhanced-card"
              style={{ 
                minHeight: isMobile ? '80px' : undefined,
                background: `linear-gradient(135deg, ${
                  (selectedMonthData?.balance || 0) >= 0 
                    ? 'rgba(0, 150, 136, 0.05) 0%, rgba(0, 150, 136, 0.15) 100%'
                    : 'rgba(244, 67, 54, 0.05) 0%, rgba(244, 67, 54, 0.15) 100%'
                })`,
                borderLeft: `4px solid ${(selectedMonthData?.balance || 0) >= 0 ? '#009688' : '#f44336'}`,
                boxShadow: `0 2px 12px ${(selectedMonthData?.balance || 0) >= 0 ? 'rgba(0, 150, 136, 0.1)' : 'rgba(244, 67, 54, 0.1)'}`,
                cursor: 'pointer',
                animation: 'fadeInScale 0.5s ease-out 0.3s both',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = `0 8px 30px ${(selectedMonthData?.balance || 0) >= 0 ? 'rgba(0, 150, 136, 0.2)' : 'rgba(244, 67, 54, 0.2)'}`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = `0 2px 12px ${(selectedMonthData?.balance || 0) >= 0 ? 'rgba(0, 150, 136, 0.1)' : 'rgba(244, 67, 54, 0.1)'}`;
              }}
            >
              <Group>
                <ActionIcon 
                  size={isMobile ? "md" : "lg"} 
                  color={(selectedMonthData?.balance || 0) >= 0 ? 'teal' : 'red'}
                  variant="light"
                  style={{
                    background: `linear-gradient(135deg, ${
                      (selectedMonthData?.balance || 0) >= 0 
                        ? '#009688 0%, #26a69a 100%'
                        : '#f44336 0%, #ef5350 100%'
                    })`,
                    color: 'white',
                    boxShadow: `0 4px 12px ${(selectedMonthData?.balance || 0) >= 0 ? 'rgba(0, 150, 136, 0.3)' : 'rgba(244, 67, 54, 0.3)'}`,
                  }}
                >
                  <IconBuildingBank size={isMobile ? 16 : 20} />
                </ActionIcon>
                <div>
                  <Group gap="xs" align="center">
                    <Text size={isMobile ? "xs" : "sm"} c="dimmed" fw={600}>実残高</Text>
                    {monthlyComparison && (
                      <TrendIndicator 
                        trend={monthlyComparison.balance.trend} 
                        percentage={monthlyComparison.balance.percentage} 
                      />
                    )}
                  </Group>
                  <Text size={isMobile ? "xs" : "xs"} c="dimmed">前月カード反映済</Text>
                  <Text 
                    size={isMobile ? "md" : "xl"} 
                    fw={700} 
                    c={(selectedMonthData?.balance || 0) >= 0 ? 'teal' : 'red'}
                  >
                    ¥{(selectedMonthData?.balance || 0).toLocaleString()}
                  </Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>

          {/* 3行目: カード支払い */}
          <Grid.Col span={{ base: 6, sm: 6 }}>
            <Card 
              withBorder 
              p={isMobile ? "sm" : "md"} 
              className="enhanced-card"
              style={{ 
                minHeight: isMobile ? '80px' : undefined,
                background: 'linear-gradient(135deg, rgba(156, 39, 176, 0.05) 0%, rgba(156, 39, 176, 0.15) 100%)',
                borderLeft: '4px solid #9c27b0',
                boxShadow: '0 2px 12px rgba(156, 39, 176, 0.1)',
                cursor: 'pointer',
                animation: 'fadeInScale 0.5s ease-out 0.4s both',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(156, 39, 176, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 12px rgba(156, 39, 176, 0.1)';
              }}
            >
              <Group>
                <ActionIcon 
                  size={isMobile ? "md" : "lg"} 
                  color="violet"
                  variant="light"
                  style={{
                    background: 'linear-gradient(135deg, #9c27b0 0%, #ab47bc 100%)',
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(156, 39, 176, 0.3)',
                  }}
                >
                  <IconCreditCard size={isMobile ? 16 : 20} />
                </ActionIcon>
                <div>
                  <Text size={isMobile ? "xs" : "sm"} c="dimmed" fw={600}>カード支払い</Text>
                  <Text size={isMobile ? "xs" : "xs"} c="dimmed">5社カード合計</Text>
                  <Text 
                    size={isMobile ? "md" : "xl"} 
                    fw={700} 
                    c="violet"
                  >
                    ¥{cardPaymentTotal.toLocaleString()}
                  </Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>

          {/* 3行目右側: 獲得ポイント */}
          <Grid.Col span={{ base: 6, sm: 6 }}>
            <Card 
              withBorder 
              p={isMobile ? "sm" : "md"} 
              className="enhanced-card"
              style={{ 
                minHeight: isMobile ? '80px' : undefined,
                background: 'linear-gradient(135deg, rgba(255, 152, 0, 0.05) 0%, rgba(255, 152, 0, 0.15) 100%)',
                borderLeft: '4px solid #ff9800',
                boxShadow: '0 2px 12px rgba(255, 152, 0, 0.1)',
                cursor: 'pointer',
                animation: 'fadeInScale 0.5s ease-out 0.5s both',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(255, 152, 0, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 12px rgba(255, 152, 0, 0.1)';
              }}
              onClick={() => setCardRewardsOpened(true)}
            >
              <Group>
                <ActionIcon 
                  size={isMobile ? "md" : "lg"} 
                  color="orange"
                  variant="light"
                  style={{
                    background: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(255, 152, 0, 0.3)',
                  }}
                >
                  <IconCoins size={isMobile ? 16 : 20} />
                </ActionIcon>
                <div>
                  <Text size={isMobile ? "xs" : "sm"} c="dimmed" fw={600}>獲得ポイント</Text>
                  <Text size={isMobile ? "xs" : "xs"} c="dimmed">カード還元合計</Text>
                  <Text 
                    size={isMobile ? "md" : "xl"} 
                    fw={700} 
                    c="orange"
                  >
                    {monthlyCardPoints}pt
                  </Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>
        </Grid>

        {/* 円グラフセクション - モバイル対応 */}
        {isMobile ? (
          /* モバイル: 切り替え式円グラフ */
          <Stack gap="md">
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
        )}

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
          mode="view" // 閲覧モード（取引詳細表示可能）
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
        {isMobile && (
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
        )}
      </Stack>

      {/* 年間収支サマリーモーダル */}
      <Modal
        opened={yearSummaryOpened}
        onClose={() => setYearSummaryOpened(false)}
        title={
          <Group gap="sm">
            <ThemeIcon size="lg" color="blue" variant="light">
              <IconTrendingUp size={20} />
            </ThemeIcon>
            <Text size="lg" fw={600}>{yearSummary.year}年 年間収支</Text>
          </Group>
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
                  <Text size="xs" c="dimmed" fw={600}>年間支出</Text>
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
            </Stack>
          </Box>

          {/* 平均値 */}
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
      </Modal>
    </Container>
  );
}
