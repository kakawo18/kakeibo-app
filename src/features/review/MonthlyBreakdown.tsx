'use client';

import { Card, Divider, Group, Paper, Stack, Text } from '@mantine/core';
import { MonthlyDetail } from '@/domain/annualSummary';

interface MonthlyBreakdownProps {
  year: number;
  details: MonthlyDetail[];
}

const yen = (amount: number): string => `¥${Math.abs(amount).toLocaleString()}`;
const signedYen = (amount: number): string => `${amount >= 0 ? '+' : '−'}${yen(amount)}`;

/** 収入・支出（・投資）の内訳。スマホでは収支の下の行に出す */
const Breakdown = ({ income, expense, investment }: Pick<MonthlyDetail, 'income' | 'expense' | 'investment'>) => (
  <>
    収入 {yen(income)} / 支出 {yen(expense)}
    {investment > 0 && ` / 投資 ${yen(investment)}`}
  </>
);

/**
 * 指定年の月別内訳（収入 / 支出 / 投資 / 収支）
 *
 * 以前はスマホで内訳を丸ごと隠しており、月と収支しか見られなかった（#113）。
 * パソコンでは1行、スマホでは収支の下にもう1行で内訳を出す。
 */
export const MonthlyBreakdown: React.FC<MonthlyBreakdownProps> = ({ year, details }) => {
  const recorded = details.filter(
    (detail) => detail.income > 0 || detail.expense > 0 || detail.investment > 0
  );

  const totals = recorded.reduce(
    (sum, detail) => ({
      income: sum.income + detail.income,
      expense: sum.expense + detail.expense,
      investment: sum.investment + detail.investment,
      remaining: sum.remaining + detail.remaining,
    }),
    { income: 0, expense: 0, investment: 0, remaining: 0 }
  );
  const monthCount = recorded.length || 1;
  const average = {
    income: Math.round(totals.income / monthCount),
    expense: Math.round(totals.expense / monthCount),
    investment: Math.round(totals.investment / monthCount),
    remaining: Math.round(totals.remaining / monthCount),
  };

  return (
    <Paper className="ledger-card" p="lg">
      <Stack gap={2} mb="md">
        <Text className="section-title">{year}年 月別内訳</Text>
        <Text size="xs" c="dimmed">記録のある月のみ表示。収支 = 収入 − 支出 − 投資</Text>
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
                    <Breakdown {...detail} />
                  </Text>
                  <Text
                    size="sm"
                    fw={700}
                    className="tabular-nums"
                    style={{ color: detail.remaining >= 0 ? 'var(--income)' : 'var(--expense)' }}
                  >
                    {signedYen(detail.remaining)}
                  </Text>
                </Group>
              </Group>
              <Text size="xs" c="dimmed" className="tabular-nums" hiddenFrom="sm" mt={2}>
                <Breakdown {...detail} />
              </Text>
            </Card>
          ))}

          <Divider my={4} />
          <Group justify="space-between" align="flex-start" px={4} wrap="nowrap">
            <Text size="xs" c="dimmed" fw={600} style={{ flexShrink: 0 }}>月平均</Text>
            <Stack gap={0} align="flex-end">
              <Text
                size="xs"
                fw={700}
                className="tabular-nums"
                style={{ color: average.remaining >= 0 ? 'var(--income)' : 'var(--expense)' }}
              >
                {signedYen(average.remaining)}
              </Text>
              <Text size="xs" c="dimmed" className="tabular-nums" ta="right">
                <Breakdown {...average} />
              </Text>
            </Stack>
          </Group>
        </Stack>
      )}
    </Paper>
  );
};
