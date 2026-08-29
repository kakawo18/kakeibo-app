'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Box, Group, Paper, Stack, Text } from '@mantine/core';
import { AnnualSummary } from '@/utils/annualSummary';

/**
 * ※ Recharts のアニメーションは全チャートで無効にしている。
 * データの件数が変わる再描画（読み込み中の空配列 → 取引到着、年の切り替え）で
 * 補間が破綻し、棒や面が描画されないままになるため。
 */

interface SavingsRateTrendChartProps {
  summaries: AnnualSummary[];
}

/** 貯蓄率(%) の年次推移。貯蓄率 = 年間投資額 ÷ 給与収入(手取り) */
export const SavingsRateTrendChart: React.FC<SavingsRateTrendChartProps> = ({ summaries }) => {
  // 給与収入が記録されていない年は貯蓄率を計算できないため対象外
  const chartData = summaries
    .filter((summary) => summary.salaryIncome > 0)
    .map((summary) => ({ year: summary.year, 貯蓄率: Number(summary.savingsRate.toFixed(1)) }));

  if (chartData.length === 0) {
    return (
      <Paper className="ledger-card" p="lg">
        <Text className="section-title" mb="md">貯蓄率の推移</Text>
        <Text ta="center" c="dimmed" py="xl" size="sm">データがありません</Text>
      </Paper>
    );
  }

  return (
    <Paper className="ledger-card" p="lg">
      <Group justify="space-between" mb="md">
        <Stack gap={2}>
          <Text className="section-title">貯蓄率の推移</Text>
          <Text size="xs" c="dimmed">年間投資額 ÷ 給与収入(手取り)</Text>
        </Stack>
      </Group>

      <Box h={240}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
            <CartesianGrid stroke="var(--grid-line)" strokeWidth={1} vertical={false} />
            <XAxis
              dataKey="year"
              tickFormatter={(value) => `${value}年`}
              tick={{ fontSize: 11, fill: 'var(--ink-3)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--hairline-strong)' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--ink-3)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}%`}
              width={40}
            />
            <Tooltip
              labelFormatter={(label) => `${label}年`}
              formatter={(value: number) => [`${value.toFixed(1)}%`, '貯蓄率']}
              contentStyle={{
                background: 'var(--app-surface)',
                border: '1px solid var(--hairline-strong)',
                borderRadius: '10px',
                boxShadow: 'var(--shadow-raised)',
                fontSize: '12px',
                color: 'var(--ink-1)',
                padding: '8px 12px',
              }}
            />
            <Line
              type="monotone"
              dataKey="貯蓄率"
              isAnimationActive={false}
              stroke="var(--accent)"
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 0, fill: 'var(--accent)' }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--app-surface)' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};
