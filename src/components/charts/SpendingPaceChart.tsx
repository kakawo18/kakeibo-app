'use client';

import { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Paper, Text, Group, Badge, Box, Stack } from '@mantine/core';
import { motion } from 'framer-motion';
import { Transaction } from '@/types';

// ============================================================
// 定数
// ============================================================

/** 週ごとの色設定 */
const WEEK_COLORS = {
  week1: '#12B886', // 緑（第1週: 1〜7日）
  week2: '#228BE6', // 青（第2週: 8〜14日）
  week3: '#F76707', // オレンジ（第3週: 15〜21日）
  week4: '#7950F2', // 紫（第4週〜: 22日以降）
} as const;

const WEEK_LABELS = {
  week1: '第1週（1〜7日）',
  week2: '第2週（8〜14日）',
  week3: '第3週（15〜21日）',
  week4: '第4週以降',
  idealLine: '理想ペース',
};

// ============================================================
// ヘルパー関数
// ============================================================

/** 日付から週番号（1〜4）を返す */
const getWeekNumber = (day: number): 1 | 2 | 3 | 4 => {
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
};

/** 月の日数を返す */
const getDaysInMonth = (yearMonth: string): number => {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month, 0).getDate();
};

// ============================================================
// 型定義
// ============================================================

interface DailyBarData {
  day: string;        // 表示ラベル（例: "1", "15"）
  dayNum: number;     // 実際の日付番号
  // 各週の累計上乗せ分（積み上げ用）
  week1: number;
  week2: number;
  week3: number;
  week4: number;
  // 累計支出合計（ツールチップ用）
  cumulativeTotal: number;
  // 理想ペース（1日ごとに budget/daysInMonth ずつ増加）
  idealLine: number;
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
  payload?: any[];
  label?: string;
  budget: number;
}) => {
  if (!active || !payload || payload.length === 0) return null;

  const weekBars = payload.filter((p) => p.dataKey !== 'idealLine' && p.value > 0);
  const idealEntry = payload.find((p) => p.dataKey === 'idealLine');
  const cumulativeTotal = weekBars.reduce((s: number, p: any) => s + (p.value || 0), 0);
  const percentage = budget > 0 ? Math.round((cumulativeTotal / budget) * 100) : 0;

  return (
    <Box
      p="xs"
      style={{
        background: 'var(--mantine-color-body)',
        border: '1px solid var(--mantine-color-default-border)',
        borderRadius: '8px',
        minWidth: '175px',
      }}
    >
      <Text size="xs" fw={700} mb={4}>{label}日（累計）</Text>

      {weekBars.map((p: any) => (
        <Group key={p.dataKey} justify="space-between" gap="xs">
          <Group gap={4}>
            <Box
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: p.fill,
                flexShrink: 0,
              }}
            />
            <Text size="xs" c="dimmed">{WEEK_LABELS[p.dataKey as keyof typeof WEEK_LABELS]}</Text>
          </Group>
          <Text size="xs" fw={600}>¥{(p.value || 0).toLocaleString()}</Text>
        </Group>
      ))}

      <Box mt={4} pt={4} style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
        <Group justify="space-between">
          <Text size="xs" fw={700}>累計合計</Text>
          <Text size="xs" fw={700}>¥{cumulativeTotal.toLocaleString()}</Text>
        </Group>
        {idealEntry && (
          <Group justify="space-between">
            <Text size="xs" c="dimmed">理想ペース</Text>
            <Text size="xs" c="blue">¥{Math.round(idealEntry.value).toLocaleString()}</Text>
          </Group>
        )}
        <Text size="xs" c="dimmed" ta="right">{percentage}% / 予算</Text>
      </Box>
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
  const chartData = useMemo((): DailyBarData[] => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const dailyPerDay = new Map<number, number>();
    for (let d = 1; d <= daysInMonth; d++) {
      dailyPerDay.set(d, 0);
    }

    transactions.forEach((t) => {
      if (t.type !== 'expense') return;
      if (t.category === '固定費' && t.subcategory === '投資') return;
      if (t.category === '立替金') return;
      if (t.affectsExpense === false) return;

      const tYear = t.date.getFullYear();
      const tMonth = t.date.getMonth() + 1;
      if (tYear !== year || tMonth !== month) return;

      const day = t.date.getDate();
      dailyPerDay.set(day, (dailyPerDay.get(day) || 0) + t.amount);
    });

    // 日ごとの理想増分（線形ペース）
    const idealPerDay = budget / daysInMonth;

    // 各週の累計を保持
    let cum1 = 0, cum2 = 0, cum3 = 0, cum4 = 0;

    return Array.from({ length: daysInMonth }, (_, i) => {
      const dayNum = i + 1;
      const amount = dailyPerDay.get(dayNum) || 0;
      const week = getWeekNumber(dayNum);

      // 当日の支出を該当週の累計に加算
      if (week === 1) cum1 += amount;
      else if (week === 2) cum2 += amount;
      else if (week === 3) cum3 += amount;
      else cum4 += amount;

      const cumulativeTotal = cum1 + cum2 + cum3 + cum4;
      const idealLine = idealPerDay * dayNum;

      return {
        day: String(dayNum),
        dayNum,
        week1: cum1,
        week2: cum2,
        week3: cum3,
        week4: cum4,
        cumulativeTotal,
        idealLine,
      };
    });
  }, [transactions, selectedMonth, daysInMonth, budget]);

  // 月の累計支出（最終日の値）
  const totalExpense = chartData[chartData.length - 1]?.cumulativeTotal ?? 0;

  // 警告レベル
  const isOverBudget = totalExpense > budget;
  const isWarning = !isOverBudget && totalExpense > budget * 0.8;

  // 支出が一件もない場合
  const hasData = chartData.some((d) => d.cumulativeTotal > 0);

  if (!hasData) {
    return (
      <Paper withBorder p="md" radius="md">
        <Text size="lg" fw={600} mb="md">月次支出ペース</Text>
        <Text ta="center" c="dimmed" py="xl">
          この月の支出データがありません
        </Text>
      </Paper>
    );
  }

  // Y軸上限: 予算の110%以上、かつデータ最大値の110%以上
  const yMax = Math.max(budget * 1.1, totalExpense * 1.1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Paper withBorder p="md" radius="md">
        {/* ヘッダー */}
        <Group justify="space-between" mb="sm" wrap="wrap" gap="xs">
          <Stack gap={2}>
            <Text size="lg" fw={600}>月次支出ペース</Text>
            <Text size="xs" c="dimmed">週ごと色分けの累計支出 · 点線 = 理想ペース</Text>
          </Stack>
          <Stack gap={4} align="flex-end">
            <Group gap="xs">
              <Text size="sm" c="dimmed">累計</Text>
              <Text
                size="sm"
                fw={700}
                c={isOverBudget ? 'red' : isWarning ? 'orange' : 'inherit'}
              >
                ¥{totalExpense.toLocaleString()}
              </Text>
              <Text size="xs" c="dimmed">/ ¥{budget.toLocaleString()}</Text>
            </Group>
            {isOverBudget && (
              <Badge color="red" variant="filled" size="sm">予算オーバー</Badge>
            )}
            {isWarning && (
              <Badge color="yellow" variant="filled" size="sm">予算80%超過</Badge>
            )}
          </Stack>
        </Group>

        {/* グラフ本体 */}
        <Box h={300}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
              barSize={8}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10 }}
                tickLine={false}
                tickFormatter={(val) =>
                  Number(val) === 1 || Number(val) % 5 === 0 ? val : ''
                }
                interval={0}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                tickFormatter={(v) =>
                  v === 0 ? '0' : `¥${(v / 10000).toFixed(0)}万`
                }
                width={48}
                domain={[0, yMax]}
              />
              <Tooltip
                content={<CustomTooltip budget={budget} />}
                cursor={{ fill: 'rgba(128,128,128,0.08)' }}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                formatter={(value) =>
                  WEEK_LABELS[value as keyof typeof WEEK_LABELS] ?? value
                }
              />

              {/* 予算ライン（水平） */}
              <ReferenceLine
                y={budget}
                stroke="#868E96"
                strokeDasharray="6 4"
                strokeWidth={1.5}
                label={{
                  value: `予算 ¥${(budget / 10000).toFixed(0)}万`,
                  position: 'insideTopRight',
                  fontSize: 11,
                  fill: '#868E96',
                }}
              />

              {/* 週ごとの累計Bar（積み上げ） */}
              <Bar dataKey="week1" stackId="cumulative" fill={WEEK_COLORS.week1} radius={[0, 0, 0, 0]} />
              <Bar dataKey="week2" stackId="cumulative" fill={WEEK_COLORS.week2} radius={[0, 0, 0, 0]} />
              <Bar dataKey="week3" stackId="cumulative" fill={WEEK_COLORS.week3} radius={[0, 0, 0, 0]} />
              <Bar dataKey="week4" stackId="cumulative" fill={WEEK_COLORS.week4} radius={[3, 3, 0, 0]} />

              {/* 理想ペース（斜め・青点線） */}
              <Line
                type="linear"
                dataKey="idealLine"
                stroke="#339AF0"
                strokeWidth={2}
                strokeDasharray="8 4"
                dot={false}
                activeDot={false}
                legendType="line"
                name="idealLine"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Box>
      </Paper>
    </motion.div>
  );
};
