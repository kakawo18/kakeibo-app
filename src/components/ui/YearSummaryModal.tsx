'use client';

import { useMemo } from 'react';
import { Modal, Stack, SimpleGrid, Box, Text, Card, Group, Badge, Divider } from '@mantine/core';
import { Transaction, MonthlyData } from '@/types';
import { getMonthName } from '@/utils/dateUtils';
import { isAdvancePayment, isAdvanceRepayment } from '@/utils/transactionRules';

interface YearSummaryModalProps {
  opened: boolean;
  onClose: () => void;
  transactions: Transaction[];
  monthlyData: MonthlyData[];
  /** YYYY-MM 形式。この月の属する年を集計し、月別内訳でハイライトする */
  selectedMonth: string;
}

/**
 * 年間収支サマリーモーダル
 * （「今月の収支」バンドをクリックしたときに表示）
 */
export const YearSummaryModal: React.FC<YearSummaryModalProps> = ({
  opened,
  onClose,
  transactions,
  monthlyData,
  selectedMonth,
}) => {
  const selectedYear = Number(selectedMonth.split('-')[0]);

  const yearSummary = useMemo(() => {
    const yearTransactions = transactions.filter(t =>
      t.date.getFullYear() === selectedYear &&
      !isAdvanceRepayment(t) &&
      !isAdvancePayment(t)
    );

    const income = yearTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    // 投資は含める（年間支出は資産移動込みで見る）が、
    // カード引き落とし等（affectsExpense === false）は二重計上になるため除外
    const expense = yearTransactions
      .filter(t => t.type === 'expense' && t.affectsExpense !== false)
      .reduce((sum, t) => sum + t.amount, 0);

    const monthlyBreakdown = monthlyData
      .filter(m => m.month.startsWith(`${selectedYear}-`))
      .sort((a, b) => a.month.localeCompare(b.month));

    return { year: selectedYear, income, expense, balance: income - expense, monthlyBreakdown };
  }, [transactions, selectedYear, monthlyData]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text size="md" fw={700}>{yearSummary.year}年の収支</Text>}
      size="lg"
      centered
    >
      <Stack gap="md">
        {/* 年間サマリー */}
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <Box p="md" style={{ background: 'var(--app-surface-2)', borderRadius: 12, border: '1px solid var(--hairline)' }}>
            <Text size="xs" c="dimmed" fw={600} mb={4}>年間収入</Text>
            <Text size="lg" fw={700} className="tabular-nums amount-income">
              ¥{yearSummary.income.toLocaleString()}
            </Text>
          </Box>
          <Box p="md" style={{ background: 'var(--app-surface-2)', borderRadius: 12, border: '1px solid var(--hairline)' }}>
            <Text size="xs" c="dimmed" fw={600} mb={4}>年間支出（投資含む）</Text>
            <Text size="lg" fw={700} className="tabular-nums amount-expense">
              ¥{yearSummary.expense.toLocaleString()}
            </Text>
          </Box>
          <Box p="md" style={{ background: 'var(--app-surface-2)', borderRadius: 12, border: '1px solid var(--hairline)' }}>
            <Text size="xs" c="dimmed" fw={600} mb={4}>年間収支</Text>
            <Text
              size="lg"
              fw={700}
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
                        fw={700}
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
  );
};
