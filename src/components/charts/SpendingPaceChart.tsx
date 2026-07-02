'use client';

import { useMemo } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { Paper, Text, Group, Badge, Box, Stack, Progress } from '@mantine/core';
import { Transaction } from '@/types';
import { isExcludedFromExpense } from '@/utils/transactionRules';

// ============================================================
// ヘルパー関数
// ============================================================

/** 月の日数を返す */
const getDaysInMonth = (yearMonth: string): number => {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month, 0).getDate();
};

// ============================================================
// 型定義
// ============================================================

interface DailyPaceData {
  day: number;
  /** 累計支出（未来日は null にして線を止める） */
  cumulative: number | null;
  /** 理想ペース（1日ごとに budget/daysInMonth ずつ増加） */
  ideal: number;
}

interface SpendingPaceChartProps {
  /** 選択月の取引データ */
  transactions: Transaction[];
  /** YYYY-MM 形式の選択月 */
  selectedMonth: string;
  /** 月の予算（デフォルト: 100,000円） */
  budget?: number;
}

// ============================================================
// カスタムツールチップ
// ============================================================

const CustomTooltip = ({
  active,
  payload,
  label,
  budget,
}: {
  active?: boolean;
  payload?: { dataKey: string; value?: number | null }[];
  label?: string | number;
  budget: number;
}) => {
  if (!active || !payload || payload.length === 0) return null;

  const cumulative = payload.find((p) => p.dataKey === 'cumulative')?.value;
  const ideal = payload.find((p) => p.dataKey === 'ideal')?.value;

  return (
    <Box
      p="xs"
      style={{
        background: 'var(--app-surface)',
        border: '1px solid var(--hairline-strong)',
        borderRadius: '10px',
        boxShadow: 'var(--shadow-raised)',
        minWidth: '170px',
      }}
    >
      <Text size="xs" fw={700} mb={4}>{label}日時点</Text>
      {cumulative != null && (
        <Group justify="space-between">
          <Text size="xs" c="dimmed">累計支出</Text>
          <Text size="xs" fw={700} className="tabular-nums">¥{cumulative.toLocaleString()}</Text>
        </Group>
      )}
      {ideal != null && (
        <Group justify="space-between">
          <Text size="xs" c="dimmed">理想ペース</Text>
          <Text size="xs" c="dimmed" className="tabular-nums">¥{Math.round(ideal).toLocaleString()}</Text>
        </Group>
      )}
      {cumulative != null && (
        <Group justify="space-between" mt={4} pt={4} style={{ borderTop: '1px solid var(--hairline)' }}>
          <Text size="xs" c="dimmed">予算消化</Text>
          <Text size="xs" fw={600} className="tabular-nums">
            {budget > 0 ? Math.round((cumulative / budget) * 100) : 0}%
          </Text>
        </Group>
      )}
    </Box>
  );
};

// ============================================================
// メインコンポーネント
// ============================================================

export const SpendingPaceChart: React.FC<SpendingPaceChartProps> = ({
  transactions,
  selectedMonth,
  budget = 100000,
}) => {
  const daysInMonth = useMemo(() => getDaysInMonth(selectedMonth), [selectedMonth]);

  // 日ごとの累計データを集計
  const chartData = useMemo((): DailyPaceData[] => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const dailyPerDay = new Map<number, number>();

    transactions.forEach((t) => {
      if (t.type !== 'expense') return;
      // 投資・立替金・カード引き落とし等の共通除外に加え、
      // 家賃も除外する（毎月自動で発生する固定費は「ペース」の対象外）
      if (isExcludedFromExpense(t)) return;
      if (t.category === '固定費' && t.subcategory === '家賃') return;

      const tYear = t.date.getFullYear();
      const tMonth = t.date.getMonth() + 1;
      if (tYear !== year || tMonth !== month) return;

      const day = t.date.getDate();
      dailyPerDay.set(day, (dailyPerDay.get(day) || 0) + t.amount);
    });

    // 当月なら「今日」まで、過去月なら月末まで実績線を描く
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
    const lastActualDay = isCurrentMonth ? today.getDate() : daysInMonth;

    const idealPerDay = budget / daysInMonth;
    const result: DailyPaceData[] = [];
    let cumulative = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      cumulative += dailyPerDay.get(day) || 0;
      result.push({
        day,
        cumulative: day <= lastActualDay ? cumulative : null,
        ideal: idealPerDay * day,
      });
    }

    return result;
  }, [transactions, selectedMonth, daysInMonth, budget]);

  // 実績の最終値（現時点の累計支出）
  const totalExpense = useMemo(() => {
    for (let i = chartData.length - 1; i >= 0; i--) {
      const v = chartData[i].cumulative;
      if (v != null) return v;
    }
    return 0;
  }, [chartData]);

  const usageRate = budget > 0 ? (totalExpense / budget) * 100 : 0;
  const isOverBudget = totalExpense > budget;
  const isWarning = !isOverBudget && totalExpense > budget * 0.8;

  const hasData = totalExpense > 0;

  if (!hasData) {
    return (
      <Paper className="ledger-card" p="lg">
        <Text className="section-title">支出ペース</Text>
        <Text ta="center" c="dimmed" py="xl" size="sm">
          この月の支出データがありません
        </Text>
      </Paper>
    );
  }

  const yMax = Math.max(budget * 1.1, totalExpense * 1.1);
  const paceColor = isOverBudget
    ? 'var(--expense)'
    : 'var(--accent)';

  return (
    <Paper className="ledger-card" p="lg">
      {/* ヘッダー */}
      <Group justify="space-between" mb="xs" wrap="wrap" gap="xs">
        <Stack gap={2}>
          <Text className="section-title">支出ペース</Text>
          <Text size="xs" c="dimmed">変動支出の累計（家賃・投資を除く）</Text>
        </Stack>
        <Stack gap={4} align="flex-end">
          <Group gap={6} align="baseline">
            <Text
              fw={700}
              className="tabular-nums"
              style={{
                fontSize: 18,
                letterSpacing: '-0.01em',
                color: isOverBudget ? 'var(--expense)' : undefined,
              }}
            >
              ¥{totalExpense.toLocaleString()}
            </Text>
            <Text size="xs" c="dimmed" className="tabular-nums">/ ¥{budget.toLocaleString()}</Text>
          </Group>
          {isOverBudget && <Badge color="red" variant="light" size="sm">予算オーバー</Badge>}
          {isWarning && <Badge color="orange" variant="light" size="sm">予算の80%を超過</Badge>}
        </Stack>
      </Group>

      {/* 予算消化メーター */}
      <Progress
        value={Math.min(usageRate, 100)}
        color={isOverBudget ? 'red' : isWarning ? 'orange' : 'indigo'}
        size={6}
        radius="xl"
        mb="md"
      />

      {/* グラフ本体 */}
      <Box h={260}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="paceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={paceColor} stopOpacity={0.22} />
                <stop offset="100%" stopColor={paceColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--grid-line)" strokeWidth={1} vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fill: 'var(--ink-3)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--hairline-strong)' }}
              tickFormatter={(val) =>
                Number(val) === 1 || Number(val) % 5 === 0 ? String(val) : ''
              }
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--ink-3)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => (v === 0 ? '0' : `${(v / 10000).toFixed(0)}万`)}
              width={36}
              domain={[0, yMax]}
            />
            <Tooltip
              content={<CustomTooltip budget={budget} />}
              cursor={{ stroke: 'var(--hairline-strong)', strokeDasharray: '3 3' }}
            />

            {/* 予算ライン（水平） */}
            <ReferenceLine
              y={budget}
              stroke="var(--expense)"
              opacity={0.5}
              strokeDasharray="6 4"
              strokeWidth={1.5}
              label={{
                value: `予算 ${(budget / 10000).toFixed(0)}万`,
                position: 'insideTopRight',
                fontSize: 10,
                fill: 'var(--ink-3)',
              }}
            />

            {/* 理想ペース（点線） */}
            <Line
              type="linear"
              dataKey="ideal"
              stroke="var(--ink-2)"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              activeDot={false}
            />

            {/* 実績累計（エリア） */}
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke={paceColor}
              strokeWidth={2}
              fill="url(#paceGradient)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--app-surface)' }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Box>

      {/* 凡例 */}
      <Group gap="md" mt={4} justify="center">
        <Group gap={6}>
          <Box w={16} h={3} style={{ background: paceColor, borderRadius: 2 }} />
          <Text size="xs" c="dimmed">実績累計</Text>
        </Group>
        <Group gap={6}>
          <Box w={16} h={0} style={{ borderTop: '2px dashed var(--ink-2)' }} />
          <Text size="xs" c="dimmed">理想ペース</Text>
        </Group>
      </Group>
    </Paper>
  );
};
