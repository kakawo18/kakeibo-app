'use client';

import { useMemo } from 'react';
import { Modal, Stack, Card, Text, Group, Box, Grid, Divider } from '@mantine/core';
import { IconTrendingUp } from '@tabler/icons-react';
import { Transaction } from '@/types';
import { useSettings } from '@/contexts/SettingsContext';
import { formatMonthLocal, getMonthName } from '@/utils/dateUtils';

interface SavingsRateDetailModalProps {
  opened: boolean;
  onClose: () => void;
  transactions: Transaction[];
  year: number;
}

export const SavingsRateDetailModal: React.FC<SavingsRateDetailModalProps> = ({
  opened,
  onClose,
  transactions,
  year,
}) => {
  const { rules, incomeCategories } = useSettings();

  // 年間データの計算
  const savingsData = useMemo(() => {
    const yearTransactions = transactions.filter(t => t.date.getFullYear() === year);

    // 給与収入(salary_income役割)の取引
    const salaryTransactions = yearTransactions
      .filter(t => t.type === 'income' && rules.isSalaryIncome(t));

    const totalIncome = salaryTransactions.reduce((sum, t) => sum + t.amount, 0);

    // 収入内訳: 設定のサブカテゴリ順に集計し、どれにも該当しない分は「その他」に合算
    const breakdownMap = new Map<string, number>();
    // 表示順を設定のサブカテゴリ順に揃えるための下地
    incomeCategories
      .filter(c => c.roles.includes('salary_income'))
      .forEach(c => c.subcategories.forEach(sub => {
        if (!breakdownMap.has(sub.name)) breakdownMap.set(sub.name, 0);
      }));

    salaryTransactions.forEach(t => {
      const key = t.subcategory && breakdownMap.has(t.subcategory) ? t.subcategory : 'その他';
      breakdownMap.set(key, (breakdownMap.get(key) ?? 0) + t.amount);
    });

    const incomeBreakdown = Array.from(breakdownMap.entries())
      .filter(([, amount]) => amount > 0)
      .map(([name, amount]) => ({ name, amount }));

    // 年間投資額
    const totalInvestment = yearTransactions
      .filter(t => t.type === 'expense' && rules.isInvestment(t))
      .reduce((sum, t) => sum + t.amount, 0);

    // 年間貯蓄率
    const savingsRate = totalIncome > 0 ? (totalInvestment / totalIncome) * 100 : 0;

    // 月別貯蓄率
    const monthlyMap = new Map<string, { income: number; investment: number }>();

    yearTransactions.forEach(t => {
      const month = formatMonthLocal(t.date);
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, { income: 0, investment: 0 });
      }
      const data = monthlyMap.get(month)!;

      if (t.type === 'income' && rules.isSalaryIncome(t)) {
        data.income += t.amount;
      } else if (t.type === 'expense' && rules.isInvestment(t)) {
        data.investment += t.amount;
      }
    });

    const monthlyRates = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        income: data.income,
        investment: data.investment,
        rate: data.income > 0 ? (data.investment / data.income) * 100 : 0,
      }))
      .sort((a, b) => b.month.localeCompare(a.month)); // 新しい順

    return {
      incomeBreakdown,
      totalIncome,
      totalInvestment,
      savingsRate,
      monthlyRates,
    };
  }, [transactions, year, rules, incomeCategories]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <IconTrendingUp size={24} color="var(--mantine-color-violet-6)" />
          <Text size="lg" fw={600}>{year}年 年間貯蓄率詳細</Text>
        </Group>
      }
      size="lg"
      centered
    >
      <Stack gap="md">
        {/* 年間サマリー */}
        <Grid>
          <Grid.Col span={4}>
            <Box
              p="md"
              style={{
                backgroundColor: 'light-dark(var(--mantine-color-blue-0), var(--mantine-color-dark-6))',
                borderRadius: '8px',
                border: '1px solid light-dark(var(--mantine-color-blue-2), var(--mantine-color-dark-4))',
              }}
            >
              <Text size="xs" c="dimmed" mb="xs">年間収入</Text>
              <Text size="lg" fw={700} c="blue">
                ¥{savingsData.totalIncome.toLocaleString()}
              </Text>
            </Box>
          </Grid.Col>
          <Grid.Col span={4}>
            <Box
              p="md"
              style={{
                backgroundColor: 'light-dark(var(--mantine-color-orange-0), var(--mantine-color-dark-6))',
                borderRadius: '8px',
                border: '1px solid light-dark(var(--mantine-color-orange-2), var(--mantine-color-dark-4))',
              }}
            >
              <Text size="xs" c="dimmed" mb="xs">年間投資額</Text>
              <Text size="lg" fw={700} c="orange">
                ¥{savingsData.totalInvestment.toLocaleString()}
              </Text>
            </Box>
          </Grid.Col>
          <Grid.Col span={4}>
            <Box
              p="md"
              style={{
                backgroundColor: 'light-dark(var(--mantine-color-violet-0), var(--mantine-color-dark-6))',
                borderRadius: '8px',
                border: '1px solid light-dark(var(--mantine-color-violet-2), var(--mantine-color-dark-4))',
              }}
            >
              <Text size="xs" c="dimmed" mb="xs">年間貯蓄率</Text>
              <Text size="lg" fw={700} c="violet">
                {savingsData.savingsRate.toFixed(1)}%
              </Text>
            </Box>
          </Grid.Col>
        </Grid>

        {/* 収入内訳 */}
        <Card withBorder p="md">
          <Text size="sm" fw={600} mb="sm">年間収入の内訳</Text>
          <Stack gap="xs">
            {savingsData.incomeBreakdown.length === 0 && (
              <Text size="sm" c="dimmed" ta="center">給与収入のデータがありません</Text>
            )}
            {savingsData.incomeBreakdown.map(({ name, amount }) => (
              <Group key={name} justify="space-between">
                <Text size="sm" c="dimmed">{name}</Text>
                <Text size="sm" fw={600}>¥{amount.toLocaleString()}</Text>
              </Group>
            ))}
            <Divider />
            <Group justify="space-between">
              <Text size="sm" fw={600}>合計</Text>
              <Text size="sm" fw={700} c="blue">¥{savingsData.totalIncome.toLocaleString()}</Text>
            </Group>
          </Stack>
        </Card>

        {/* 月別貯蓄率 */}
        <Card withBorder p="md">
          <Text size="sm" fw={600} mb="sm">月別貯蓄率</Text>
          {savingsData.monthlyRates.length === 0 ? (
            <Text ta="center" c="dimmed" py="md">
              データがありません
            </Text>
          ) : (
            <Stack gap="xs">
              {savingsData.monthlyRates.map(({ month, income, investment, rate }) => (
                <Group key={month} justify="space-between" wrap="nowrap">
                  <Text size="sm" fw={500} style={{ minWidth: '60px' }}>
                    {getMonthName(month).replace('年', '/').replace('月', '')}
                  </Text>
                  <Text size="xs" c="dimmed" style={{ flex: 1 }}>
                    ¥{investment.toLocaleString()} / ¥{income.toLocaleString()}
                  </Text>
                  <Text
                    size="sm"
                    fw={600}
                    c={rate >= 20 ? 'green' : rate >= 10 ? 'orange' : 'red'}
                    style={{ minWidth: '60px', textAlign: 'right' }}
                  >
                    {rate.toFixed(1)}%
                  </Text>
                </Group>
              ))}
            </Stack>
          )}
        </Card>
      </Stack>
    </Modal>
  );
};
