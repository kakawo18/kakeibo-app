'use client';

import { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Container, Stack, Grid, Card, Text, Group, ActionIcon, Button, Menu, Select, Affix } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconPlus, IconTrendingUp, IconTrendingDown, IconWallet, IconDots, IconFileImport, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useTransactions } from '@/hooks/useTransactions';
import { TransactionForm } from '@/components/forms/TransactionForm';
import { TransactionList } from '@/components/ui/TransactionList';
import { PieChart } from '@/components/charts/PieChart';
import { LineChart } from '@/components/charts/LineChart';
import { CSVImportExport } from '@/components/ui/CSVImportExport';
import { calculateMonthlyData, calculateCategoryChartData } from '@/utils/calculations';
import { getCurrentMonth, getMonthName, getMonthOptions, getNextMonth, getPreviousMonthFromCurrent } from '@/utils/dateUtils';
import { Transaction } from '@/types';

export function DashboardContent() {
  const { transactions, loading: transactionsLoading } = useTransactions();
  const [transactionFormOpened, setTransactionFormOpened] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [csvModalOpened, setCsvModalOpened] = useState(false);
  
  // モバイル表示判定
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlMonth = searchParams.get('month');
  const selectedMonth = urlMonth || getCurrentMonth();

  const monthlyData = useMemo(() => calculateMonthlyData(transactions), [transactions]);
  const selectedMonthData = useMemo(() => 
    monthlyData.find(data => data.month === selectedMonth), 
    [monthlyData, selectedMonth]
  );

  const selectedMonthTransactions = useMemo(() => 
    transactions.filter(t => t.date.toISOString().startsWith(selectedMonth)),
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

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setTransactionFormOpened(true);
  };

  const handleCloseTransactionForm = () => {
    setTransactionFormOpened(false);
    setEditingTransaction(null);
  };

  const handleMonthChange = (month: string | null) => {
    if (month) {
      const params = new URLSearchParams(searchParams);
      params.set('month', month);
      router.push(`?${params.toString()}`);
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

  const monthOptions = getMonthOptions();

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
              size={isMobile ? "md" : "lg"}
              onClick={handlePreviousMonth}
            >
              <IconChevronLeft size={14} />
            </ActionIcon>
            <Select
              data={monthOptions}
              value={selectedMonth}
              onChange={handleMonthChange}
              searchable
              w={isMobile ? 140 : 200}
              size={isMobile ? "sm" : "md"}
            />
            <ActionIcon
              variant="light"
              size={isMobile ? "md" : "lg"}
              onClick={handleNextMonth}
            >
              <IconChevronRight size={14} />
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

        <Grid>
          <Grid.Col span={{ base: 6, sm: 6, md: 3 }}>
            <Card withBorder p="md">
              <Group>
                <ActionIcon size="lg" color="green" variant="light">
                  <IconTrendingUp size={20} />
                </ActionIcon>
                <div>
                  <Text size="sm" c="dimmed">収入</Text>
                  <Text size="xl" fw={700} c="green">
                    ¥{(selectedMonthData?.income || 0).toLocaleString()}
                  </Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 6, sm: 6, md: 3 }}>
            <Card withBorder p="md">
              <Group>
                <ActionIcon size="lg" color="red" variant="light">
                  <IconTrendingDown size={20} />
                </ActionIcon>
                <div>
                  <Text size="sm" c="dimmed">支出</Text>
                  <Text size="xl" fw={700} c="red">
                    ¥{(selectedMonthData?.expense || 0).toLocaleString()}
                  </Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 6, sm: 6, md: 3 }}>
            <Card withBorder p="md">
              <Group>
                <ActionIcon 
                  size="lg" 
                  color={(selectedMonthData?.income || 0) - (selectedMonthData?.expense || 0) >= 0 ? 'blue' : 'red'}
                  variant="light"
                >
                  <IconWallet size={20} />
                </ActionIcon>
                <div>
                  <Text size="sm" c="dimmed">支出収支</Text>
                  <Text size="xs" c="dimmed">カード支払い含む</Text>
                  <Text 
                    size="xl" 
                    fw={700} 
                    c={(selectedMonthData?.income || 0) - (selectedMonthData?.expense || 0) >= 0 ? 'blue' : 'red'}
                  >
                    ¥{((selectedMonthData?.income || 0) - (selectedMonthData?.expense || 0)).toLocaleString()}
                  </Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 6, sm: 6, md: 3 }}>
            <Card withBorder p="md">
              <Group>
                <ActionIcon 
                  size="lg" 
                  color={(selectedMonthData?.balance || 0) >= 0 ? 'blue' : 'red'}
                  variant="light"
                >
                  <IconWallet size={20} />
                </ActionIcon>
                <div>
                  <Text size="sm" c="dimmed">実残高</Text>
                  <Text size="xs" c="dimmed">引き落とし反映</Text>
                  <Text 
                    size="xl" 
                    fw={700} 
                    c={(selectedMonthData?.balance || 0) >= 0 ? 'blue' : 'red'}
                  >
                    ¥{(selectedMonthData?.balance || 0).toLocaleString()}
                  </Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 6, sm: 6, md: 3 }}>
            <Card withBorder p="md">
              <Group>
                <ActionIcon 
                  size="lg" 
                  color="orange"
                  variant="light"
                >
                  <IconTrendingUp size={20} />
                </ActionIcon>
                <div>
                  <Text size="sm" c="dimmed">カード支払い</Text>
                  <Text size="xs" c="dimmed">5社カード合計</Text>
                  <Text 
                    size="xl" 
                    fw={700} 
                    c="orange"
                  >
                    ¥{cardPaymentTotal.toLocaleString()}
                  </Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>
        </Grid>

        <Grid>
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <PieChart
              title={`${getMonthName(selectedMonth)}の収入内訳`}
              data={incomeChartData}
              totalAmount={selectedMonthData?.income || 0}
              color="green"
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 6 }}>
            <PieChart
              title={`${getMonthName(selectedMonth)}の支出内訳`}
              data={expenseChartData}
              totalAmount={selectedMonthData?.expense || 0}
              color="red"
            />
          </Grid.Col>
        </Grid>

        <LineChart
          title="残高推移"
          data={monthlyData}
        />

        <TransactionList 
          transactions={selectedMonthTransactions}
          onEditTransaction={handleEditTransaction} 
        />

        <TransactionForm
          opened={transactionFormOpened}
          onClose={handleCloseTransactionForm}
          editingTransaction={editingTransaction}
        />

        <CSVImportExport
          opened={csvModalOpened}
          onClose={() => setCsvModalOpened(false)}
        />

        {/* モバイル用フローティングアクションボタン */}
        {isMobile && (
          <Affix position={{ bottom: 20, right: 20 }}>
            <Group gap="xs">
              <Menu shadow="md" width={180}>
                <Menu.Target>
                  <ActionIcon 
                    variant="light" 
                    size="xl"
                    style={{ 
                      backgroundColor: 'var(--mantine-color-gray-1)',
                      border: '1px solid var(--mantine-color-gray-3)',
                      borderRadius: '50%',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                    }}
                  >
                    <IconDots size={20} />
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
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={() => setTransactionFormOpened(true)}
                size="md"
                style={{
                  borderRadius: '25px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  paddingLeft: '16px',
                  paddingRight: '20px'
                }}
              >
                追加
              </Button>
            </Group>
          </Affix>
        )}
      </Stack>
    </Container>
  );
}