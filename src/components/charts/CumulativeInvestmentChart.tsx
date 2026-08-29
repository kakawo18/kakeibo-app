'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Box, Group, Paper, Stack, Text } from '@mantine/core';
import { getMonthName } from '@/utils/dateUtils';

/**
 * ※ Recharts のアニメーションは全チャートで無効にしている。
 * データの件数が変わる再描画（読み込み中の空配列 → 取引到着、年の切り替え）で
 * 補間が破綻し、棒や面が描画されないままになるため。
 */

interface CumulativeInvestmentChartProps {
  data: { month: string; cumulative: number }[];
}

/**
 * 累計投資額（元本）の推移
 *
 * 記録した投資の積み上げであり、時価評価額ではない。
 */
export const CumulativeInvestmentChart: React.FC<CumulativeInvestmentChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <Paper className="ledger-card" p="lg">
        <Text className="section-title" mb="md">累計投資額の推移</Text>
        <Text ta="center" c="dimmed" py="xl" size="sm">データがありません</Text>
      </Paper>
    );
  }

  const chartData = data.map((entry) => ({
    ...entry,
    label: getMonthName(entry.month).replace('年', '/').replace('月', ''),
  }));
  const total = data[data.length - 1].cumulative;

  return (
    <Paper className="ledger-card" p="lg">
      <Group justify="space-between" align="flex-start" mb="md" wrap="nowrap">
        <Stack gap={2}>
          <Text className="section-title">累計投資額の推移</Text>
          <Text size="xs" c="dimmed">投資した元本の積み上げ（時価ではありません）</Text>
        </Stack>
        <Stack gap={0} align="flex-end">
          <Text className="overline-label">累計</Text>
          <Text size="lg" fw={700} className="tabular-nums" style={{ color: 'var(--series-investment)' }}>
            ¥{total.toLocaleString()}
          </Text>
        </Stack>
      </Group>

      <Box h={240}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="cumulativeInvestmentGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--series-investment)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--series-investment)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--grid-line)" strokeWidth={1} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--ink-3)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--hairline-strong)' }}
              minTickGap={24}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--ink-3)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${(value / 10000).toFixed(0)}万`}
              width={44}
            />
            <Tooltip
              formatter={(value: number) => [`¥${value.toLocaleString()}`, '累計投資額']}
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
            <Area
              type="monotone"
              dataKey="cumulative"
              isAnimationActive={false}
              stroke="var(--series-investment)"
              strokeWidth={2}
              fill="url(#cumulativeInvestmentGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};
