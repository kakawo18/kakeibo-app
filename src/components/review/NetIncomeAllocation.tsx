'use client';

import { Box, Group, Paper, Stack, Text } from '@mantine/core';
import { AnnualSummary } from '@/utils/annualSummary';

interface NetIncomeAllocationProps {
  summary: AnnualSummary;
}

interface Segment {
  label: string;
  amount: number;
  color: string;
}

/**
 * 手取りの使い道
 *
 * その年の手取り収入が「支出 / 投資 / 手元に残った分」にどう割れたかを
 * 1本の帯で表す。支出と投資が手取りを超えた年は残りが負になるため、
 * 帯は支出と投資の比率だけで描き、超過額を別に示す。
 */
export const NetIncomeAllocation: React.FC<NetIncomeAllocationProps> = ({ summary }) => {
  const isOverspent = summary.balance < 0;

  const segments: Segment[] = [
    { label: '支出', amount: summary.expense, color: 'var(--expense)' },
    { label: '投資', amount: summary.investment, color: 'var(--series-investment)' },
    ...(isOverspent
      ? []
      : [{ label: '手元に残った分', amount: summary.balance, color: 'var(--income)' }]),
  ];

  const total = segments.reduce((sum, segment) => sum + segment.amount, 0);

  if (summary.netIncome === 0 && total === 0) {
    return (
      <Paper className="ledger-card" p="lg">
        <Text className="section-title" mb="md">手取りの使い道</Text>
        <Text ta="center" c="dimmed" py="xl" size="sm">データがありません</Text>
      </Paper>
    );
  }

  return (
    <Paper className="ledger-card" p="lg">
      <Stack gap={2} mb="md">
        <Text className="section-title">{summary.year}年 手取りの使い道</Text>
        <Text size="xs" c="dimmed">
          {isOverspent
            ? `手取り ¥${summary.netIncome.toLocaleString()} に対して 支出+投資 ¥${total.toLocaleString()}`
            : `手取り ¥${summary.netIncome.toLocaleString()} の内訳`}
        </Text>
      </Stack>

      <Box
        style={{
          display: 'flex',
          height: 28,
          borderRadius: 'var(--radius-control)',
          overflow: 'hidden',
          background: 'var(--app-surface-2)',
        }}
        mb="md"
      >
        {segments
          .filter((segment) => segment.amount > 0)
          .map((segment) => (
            <Box
              key={segment.label}
              style={{ flexGrow: segment.amount, background: segment.color }}
              title={`${segment.label} ¥${segment.amount.toLocaleString()}`}
            />
          ))}
      </Box>

      <Stack gap={8}>
        {segments.map((segment) => (
          <Group key={segment.label} justify="space-between" wrap="nowrap">
            <Group gap={8} wrap="nowrap">
              <Box w={10} h={10} style={{ borderRadius: 3, background: segment.color, flexShrink: 0 }} />
              <Text size="sm" c="dimmed">{segment.label}</Text>
            </Group>
            <Group gap="md" wrap="nowrap">
              <Text size="xs" c="dimmed" className="tabular-nums">
                {total > 0 ? Math.round((segment.amount / total) * 100) : 0}%
              </Text>
              <Text size="sm" fw={600} className="tabular-nums">
                ¥{segment.amount.toLocaleString()}
              </Text>
            </Group>
          </Group>
        ))}

        {isOverspent && (
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm" fw={600} style={{ color: 'var(--expense)' }}>
              手取りを超過
            </Text>
            <Text size="sm" fw={700} className="tabular-nums" style={{ color: 'var(--expense)' }}>
              ¥{Math.abs(summary.balance).toLocaleString()}
            </Text>
          </Group>
        )}
      </Stack>
    </Paper>
  );
};
