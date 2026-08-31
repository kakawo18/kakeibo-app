'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  LabelProps,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Box, Paper, Stack, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { CategoryYoY } from '@/utils/annualSummary';

/**
 * ※ Recharts のアニメーションは全チャートで無効にしている。
 * データの件数が変わる再描画（読み込み中の空配列 → 取引到着、年の切り替え）で
 * 補間が破綻し、棒が描画されないままになるため。
 */

interface CategoryYoYChartProps {
  year: number;
  entries: CategoryYoY[];
  /** 前年の取引が1件でもあるか。無ければ比較自体が成り立たない */
  hasPreviousYear: boolean;
}

/** 一度に表示する件数。増やすとチャートが縦に伸びすぎる */
const DISPLAY_LIMIT = 8;

/** カテゴリ1件あたりの高さ（2本の棒 + 行間） */
const ROW_HEIGHT = 44;

/** 軸・凡例・余白の分 */
const CHART_PADDING = 56;

/** 差額ラベルは万単位に丸めて短くする（横並びの棒の右に置くため幅が取れない） */
const formatDiffLabel = (diff: number): string => {
  const sign = diff > 0 ? '+' : '−';
  const abs = Math.abs(diff);
  return abs >= 10000
    ? `${sign}${(abs / 10000).toFixed(1)}万`
    : `${sign}${abs.toLocaleString()}`;
};

/** Y軸のカテゴリ名。長いものは省略する（全文はツールチップで読める） */
const truncate = (name: string, limit: number): string =>
  name.length > limit ? `${name.slice(0, limit)}…` : name;

/**
 * カテゴリ別 年間支出の前年比
 *
 * 前年と今年の棒を1カテゴリにつき2本並べる横棒グラフ。
 * 「どれだけ使ったか」と「どれだけ変わったか」を同時に読めるよう、
 * 今年の棒の右端に増減額を出す（増えた＝支出色、減った＝収入色）。
 */
export const CategoryYoYChart: React.FC<CategoryYoYChartProps> = ({
  year,
  entries,
  hasPreviousYear,
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)');

  const displayed = entries.slice(0, DISPLAY_LIMIT);
  const previousKey = `${year - 1}年`;
  const currentKey = `${year}年`;

  const chartData = displayed.map((entry) => ({
    name: entry.name,
    [previousKey]: entry.previous,
    [currentKey]: entry.current,
    diff: entry.diff,
  }));

  // 増減ラベルは棒の右外に置くので、その分の余白をチャートの右に確保する
  const labelMargin = isMobile ? 52 : 64;
  const yAxisWidth = isMobile ? 74 : 104;
  const nameLimit = isMobile ? 5 : 8;

  // LabelList の content。recharts は座標を string | number で渡してくるので数値に寄せる
  const renderDiffLabel = (props: LabelProps) => {
    const x = Number(props.x ?? 0);
    const y = Number(props.y ?? 0);
    const width = Number(props.width ?? 0);
    const height = Number(props.height ?? 0);
    const value = Number(props.value ?? 0);
    if (value === 0) return null;

    return (
      <text
        x={x + width + 6}
        y={y + height / 2}
        dy={4}
        textAnchor="start"
        fontSize={isMobile ? 10 : 11}
        fontWeight={700}
        fill={value > 0 ? 'var(--expense)' : 'var(--income)'}
      >
        {formatDiffLabel(value)}
      </text>
    );
  };

  return (
    <Paper className="ledger-card" p="lg">
      <Stack gap={2} mb="md">
        <Text className="section-title">{year}年 カテゴリ別支出の前年比</Text>
        <Text size="xs" c="dimmed">
          {year - 1}年との差が大きい順・上位{DISPLAY_LIMIT}件
        </Text>
      </Stack>

      {!hasPreviousYear ? (
        <Text ta="center" c="dimmed" py="xl" size="sm">
          比較対象の{year - 1}年のデータがありません
        </Text>
      ) : displayed.length === 0 ? (
        <Text ta="center" c="dimmed" py="xl" size="sm">データがありません</Text>
      ) : (
        <>
          <Box h={displayed.length * ROW_HEIGHT + CHART_PADDING}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: labelMargin, left: 0, bottom: 0 }}
                barGap={2}
              >
                <CartesianGrid stroke="var(--grid-line)" strokeWidth={1} horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: 'var(--ink-3)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) => `${Math.round(value / 10000)}万`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'var(--ink-2)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--hairline-strong)' }}
                  tickFormatter={(value: string) => truncate(value, nameLimit)}
                  width={yAxisWidth}
                />
                <Tooltip
                  cursor={{ fill: 'var(--accent-soft)' }}
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
                  dataKey={previousKey}
                  fill="var(--ink-3)"
                  radius={[0, 3, 3, 0]}
                  maxBarSize={13}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey={currentKey}
                  fill="var(--expense)"
                  radius={[0, 3, 3, 0]}
                  maxBarSize={13}
                  isAnimationActive={false}
                >
                  {/* 今年の棒の右端に増減額。棒の長さだけでは差が読み取りにくいため */}
                  <LabelList dataKey="diff" content={renderDiffLabel} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>

          {entries.length > DISPLAY_LIMIT && (
            <Text size="xs" c="dimmed" ta="center" mt={4}>
              ほか {entries.length - DISPLAY_LIMIT} 件
            </Text>
          )}
        </>
      )}
    </Paper>
  );
};
