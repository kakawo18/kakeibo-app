'use client';

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Box, Group, Paper, Stack, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { AnnualSummary } from '@/utils/annualSummary';
import { AnnualValueColumn, AnnualValueTable } from '@/components/charts/AnnualValueTable';

/**
 * ※ Recharts のアニメーションは全チャートで無効にしている。
 * データの件数が変わる再描画（読み込み中の空配列 → 取引到着、年の切り替え）で
 * 補間が破綻し、棒や面が描画されないままになるため。
 */

interface AnnualFlowChartProps {
  summaries: AnnualSummary[];
}

/** 年が少ないと棒が極端に太くなって見苦しいので上限を決める */
const MAX_BAR_SIZE = 56;

/** これを超える本数では棒が細くなり、合計ラベルが隣と重なる */
const MAX_BARS_WITH_LABEL_MOBILE = 4;
const MAX_BARS_WITH_LABEL_DESKTOP = 10;

const formatTotalLabel = (value: number): string =>
  value > 0 ? `${Math.round(value / 10000).toLocaleString()}万` : '';

/**
 * 支出と投資の推移
 *
 * 棒が「使った額 + 積んだ額」、線が「手取り収入」。
 * 線が棒より上にあれば、その差が手元に残った分。
 */
export const AnnualFlowChart: React.FC<AnnualFlowChartProps> = ({ summaries }) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  // 棒が細いとラベルが隣と重なって読めなくなる。金額は下のテーブルで必ず読めるので、
  // 本数が多いときはラベルを出さない
  const showTotalLabels =
    summaries.length <= (isMobile ? MAX_BARS_WITH_LABEL_MOBILE : MAX_BARS_WITH_LABEL_DESKTOP);

  if (summaries.length === 0) {
    return (
      <Paper className="ledger-card" p="lg">
        <Text className="section-title" mb="md">支出と投資の推移</Text>
        <Text ta="center" c="dimmed" py="xl" size="sm">データがありません</Text>
      </Paper>
    );
  }

  const chartData = summaries.map((summary) => ({
    year: summary.year,
    支出: summary.expense,
    投資: summary.investment,
    手取り収入: summary.netIncome,
    支出と投資の合計: summary.expense + summary.investment,
  }));

  const columns: AnnualValueColumn[] = [
    { key: '手取り収入', label: '手取り収入', color: 'var(--income)' },
    { key: '支出', label: '支出', color: 'var(--expense)' },
    { key: '投資', label: '投資', color: 'var(--series-investment)' },
    { key: '残り', label: '手元に残った分', signed: true, emphasize: true },
  ];

  return (
    <Paper className="ledger-card" p="lg">
      <Group justify="space-between" mb="md">
        <Stack gap={2}>
          <Text className="section-title">支出と投資の推移</Text>
          <Text size="xs" c="dimmed">線が棒より上にあれば、その差が手元に残った分</Text>
        </Stack>
      </Group>

      <Box h={300}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 24, right: 16, left: 0, bottom: 5 }}>
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
            <Bar
              dataKey="支出"
              stackId="outflow"
              fill="var(--expense)"
              maxBarSize={MAX_BAR_SIZE}
              isAnimationActive={false}
            />
            <Bar
              dataKey="投資"
              stackId="outflow"
              fill="var(--series-investment)"
              radius={[4, 4, 0, 0]}
              maxBarSize={MAX_BAR_SIZE}
              isAnimationActive={false}
            >
              {/* 積み上げの一番上に、支出+投資の合計を出す */}
              {showTotalLabels && (
                <LabelList
                  dataKey="支出と投資の合計"
                  position="top"
                  offset={8}
                  formatter={formatTotalLabel}
                  style={{ fontSize: 11, fontWeight: 700, fill: 'var(--ink-2)' }}
                />
              )}
            </Bar>
            <Line
              type="monotone"
              dataKey="手取り収入"
              isAnimationActive={false}
              stroke="var(--income)"
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 0, fill: 'var(--income)' }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--app-surface)' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Box>

      <AnnualValueTable
        columns={columns}
        rows={summaries.map((summary) => ({
          year: summary.year,
          values: {
            手取り収入: summary.netIncome,
            支出: summary.expense,
            投資: summary.investment,
            残り: summary.balance,
          },
        }))}
        minWidth={520}
      />
    </Paper>
  );
};
