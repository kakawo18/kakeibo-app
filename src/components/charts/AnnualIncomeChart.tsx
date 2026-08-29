'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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

interface AnnualIncomeChartProps {
  summaries: AnnualSummary[];
}

/**
 * 年収の推移
 *
 * 積み上げの合計が「額面」になる:
 *   手取り(給与) + その他収入 + 社会保険料 + 所得税 + 住民税
 * 下2つが実際に受け取った額、上3つが引かれた額。
 *
 * ※ 額面ベースの「収支」は作れない。収支 = 収入 − 支出 なので、額面を収入に
 *   すると控除を支出に数えることになり、結果は手取りベースの収支と必ず一致する。
 *   そのため額面は収支ではなく「年収」として手取りと並べている。
 */
export const AnnualIncomeChart: React.FC<AnnualIncomeChartProps> = ({ summaries }) => {
  if (summaries.length === 0) {
    return (
      <Paper className="ledger-card" p="lg">
        <Text className="section-title" mb="md">年収の推移</Text>
        <Text ta="center" c="dimmed" py="xl" size="sm">データがありません</Text>
      </Paper>
    );
  }

  // 給与以外の収入が1円も無いなら、常にゼロの系列を凡例に出しても紛らわしいだけなので隠す
  const hasOtherIncome = summaries.some((summary) => summary.otherIncome > 0);

  const chartData = summaries.map((summary) => ({
    year: summary.year,
    手取り: summary.salaryIncome,
    その他収入: summary.otherIncome,
    社会保険料: summary.deductions.socialInsurance,
    所得税: summary.deductions.incomeTax,
    住民税: summary.deductions.residentTax,
  }));

  return (
    <Paper className="ledger-card" p="lg">
      <Group justify="space-between" mb="md">
        <Stack gap={2}>
          <Text className="section-title">年収の推移</Text>
          <Text size="xs" c="dimmed">棒全体の高さが額面。上3つが税・社会保険料で引かれた分</Text>
        </Stack>
      </Group>

      <Box h={300}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
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
              tickFormatter={(value) => `${(value / 10000).toFixed(0)}万`}
              width={44}
            />
            <Tooltip
              cursor={{ fill: 'var(--accent-soft)' }}
              labelFormatter={(label) => `${label}年`}
              formatter={(value: number, name: string) => [`¥${value.toLocaleString()}`, name]}
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
            <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--ink-2)' }} iconType="square" />
            <Bar dataKey="手取り" stackId="income" fill="var(--income)" isAnimationActive={false} />
            {hasOtherIncome && (
              <Bar dataKey="その他収入" stackId="income" fill="var(--series-other-income)" isAnimationActive={false} />
            )}
            <Bar dataKey="社会保険料" stackId="income" fill="var(--series-social-insurance)" isAnimationActive={false} />
            <Bar dataKey="所得税" stackId="income" fill="var(--series-income-tax)" isAnimationActive={false} />
            <Bar dataKey="住民税" stackId="income" fill="var(--series-resident-tax)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};
