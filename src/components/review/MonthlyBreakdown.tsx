'use client';

import { Card, Divider, Group, Paper, Stack, Text } from '@mantine/core';
import { MonthlyDetail } from '@/utils/annualSummary';

interface MonthlyBreakdownProps {
  year: number;
  details: MonthlyDetail[];
}

/** 指定年の月別内訳（収入 / 支出 / 投資 / 収支） */
export const MonthlyBreakdown: React.FC<MonthlyBreakdownProps> = ({ year, details }) => {
  const recorded = details.filter(
    (detail) => detail.income > 0 || detail.expense > 0 || detail.investment > 0
  );

  const totals = recorded.reduce(
    (sum, detail) => ({
      income: sum.income + detail.income,
      expense: sum.expense + detail.expense,
      investment: sum.investment + detail.investment,
      balance: sum.balance + detail.balance,
    }),
    { income: 0, expense: 0, investment: 0, balance: 0 }
  );
  const monthCount = recorded.length || 1;

  return (
    <Paper className="ledger-card" p="lg">
      <Stack gap={2} mb="md">
        <Text className="section-title">{year}年 月別内訳</Text>
        <Text size="xs" c="dimmed">記録のある月のみ表示</Text>
      </Stack>

      {recorded.length === 0 ? (
        <Text ta="center" c="dimmed" py="xl" size="sm">データがありません</Text>
      ) : (
        <Stack gap={6}>
          {recorded.map((detail) => (
            <Card
              key={detail.month}
              p="sm"
              radius="md"
              style={{ border: '1px solid var(--hairline)', background: 'var(--app-surface)' }}
            >
              <Group justify="space-between" wrap="nowrap">
                <Text size="sm" fw={700} className="tabular-nums">
                  {Number(detail.month.split('-')[1])}月
                </Text>
                <Group gap="md" wrap="nowrap">
                  <Text size="xs" c="dimmed" className="tabular-nums" visibleFrom="sm">
                    収入 ¥{detail.income.toLocaleString()} / 支出 ¥{detail.expense.toLocaleString()}
                    {detail.investment > 0 && ` / 投資 ¥${detail.investment.toLocaleString()}`}
                  </Text>
                  <Text
                    size="sm"
                    fw={700}
                    className="tabular-nums"
                    style={{ color: detail.balance >= 0 ? 'var(--income)' : 'var(--expense)' }}
                  >
                    {detail.balance >= 0 ? '+' : ''}¥{detail.balance.toLocaleString()}
                  </Text>
                </Group>
              </Group>
            </Card>
          ))}

          <Divider my={4} />
          <Group justify="space-between" px={4}>
            <Text size="xs" c="dimmed" fw={600}>月平均</Text>
            <Group gap="md">
              <Text size="xs" c="dimmed" className="tabular-nums">
                収入 ¥{Math.round(totals.income / monthCount).toLocaleString()}
              </Text>
              <Text size="xs" c="dimmed" className="tabular-nums">
                支出 ¥{Math.round(totals.expense / monthCount).toLocaleString()}
              </Text>
              <Text
                size="xs"
                fw={700}
                className="tabular-nums"
                style={{ color: totals.balance >= 0 ? 'var(--income)' : 'var(--expense)' }}
              >
                {totals.balance >= 0 ? '+' : ''}¥{Math.round(totals.balance / monthCount).toLocaleString()}
              </Text>
            </Group>
          </Group>
        </Stack>
      )}
    </Paper>
  );
};
