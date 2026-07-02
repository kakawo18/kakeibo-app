'use client';

import { useMemo } from 'react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Paper, Text, Stack, Box, Group, useMantineColorScheme } from '@mantine/core';
import { ChartData } from '@/types';
import { useMediaQuery } from '@mantine/hooks';
import { getCategoryColor } from '@/utils/calculations';

interface PieChartProps {
  title: string;
  data: ChartData[];
  totalAmount?: number;
}

/**
 * 支出/収入内訳のドーナツチャート
 *
 * 【デザイン方針】
 * - ラベル引き出し線は使わない（モバイルで重なるため）。
 *   代わりに凡例リスト（色ドット + カテゴリ名 + 金額 + %）を常設し、
 *   低コントラスト色のリリーフ（可視ラベル）も兼ねる。
 * - セグメント間に隙間（paddingAngle）を入れ、色だけに頼らない分離を確保。
 */
export const PieChart: React.FC<PieChartProps> = ({
  title,
  data,
  totalAmount,
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  // データ処理: 3%未満を「その他」にまとめ、カテゴリ固定色を解決
  const processedData = useMemo(() => {
    if (!data) return [];

    const threshold = 3;
    let othersValue = 0;
    let othersPercentage = 0;

    const sortedData = [...data].sort((a, b) => b.value - a.value);
    const mainItems: ChartData[] = [];

    for (const item of sortedData) {
      if (item.name === 'その他' || item.percentage < threshold) {
        othersValue += item.value;
        othersPercentage += item.percentage;
      } else {
        mainItems.push({ ...item, color: getCategoryColor(item.name, isDark) });
      }
    }

    if (othersValue > 0) {
      mainItems.push({
        name: 'その他',
        value: othersValue,
        percentage: Number(othersPercentage.toFixed(1)),
        color: getCategoryColor('その他', isDark),
      });
    }

    return mainItems;
  }, [data, isDark]);

  const displayTotal = totalAmount ?? data?.reduce((sum, item) => sum + item.value, 0) ?? 0;

  if (!data || data.length === 0) {
    return (
      <Paper className="ledger-card" p="lg" h="100%">
        <Text className="section-title">{title}</Text>
        <Text ta="center" c="dimmed" py="xl" size="sm">
          データがありません
        </Text>
      </Paper>
    );
  }

  const chartSize = isMobile ? 190 : 220;
  const outerRadius = chartSize / 2 - 4;
  const innerRadius = outerRadius - (isMobile ? 26 : 30);

  return (
    <Paper className="ledger-card" p="lg" h="100%">
      <Text className="section-title" mb="md">{title}</Text>

      <Group
        align="center"
        gap={isMobile ? 'md' : 'xl'}
        wrap={isMobile ? 'wrap' : 'nowrap'}
        justify={isMobile ? 'center' : 'flex-start'}
      >
        {/* ドーナツ本体 */}
        <Box pos="relative" w={chartSize} h={chartSize} style={{ flexShrink: 0 }}>
          <Stack
            gap={0}
            align="center"
            justify="center"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              pointerEvents: 'none'
            }}
          >
            <Text size="xs" c="dimmed" fw={600}>合計</Text>
            <Text size={isMobile ? 'lg' : 'xl'} fw={800} className="tabular-nums">
              ¥{displayTotal.toLocaleString()}
            </Text>
          </Stack>

          <ResponsiveContainer width="100%" height="100%">
            <RechartsPieChart margin={{ top: 0, left: 0, right: 0, bottom: 0 }}>
              <Pie
                data={processedData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={outerRadius}
                innerRadius={innerRadius}
                dataKey="value"
                paddingAngle={2.5}
                cornerRadius={4}
                stroke="none"
              >
                {processedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string, props: { payload?: ChartData }) => [
                  `¥${value.toLocaleString()}（${(props.payload?.percentage ?? 0).toFixed(1)}%）`,
                  name,
                ]}
                contentStyle={{
                  background: 'var(--app-surface)',
                  border: '1px solid var(--hairline-strong)',
                  borderRadius: '10px',
                  fontSize: '12px',
                  color: 'var(--ink-1)',
                }}
              />
            </RechartsPieChart>
          </ResponsiveContainer>
        </Box>

        {/* 凡例リスト（金額・% を常時表示 = 低コントラスト色のリリーフ） */}
        <Stack gap={6} style={{ flex: 1, minWidth: isMobile ? '100%' : 180 }}>
          {processedData.map((item) => (
            <Group key={item.name} justify="space-between" wrap="nowrap" gap="xs">
              <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
                <Box
                  w={10}
                  h={10}
                  style={{
                    borderRadius: 3,
                    background: item.color,
                    flexShrink: 0,
                  }}
                />
                <Text size="sm" truncate>{item.name}</Text>
              </Group>
              <Group gap={8} wrap="nowrap" style={{ flexShrink: 0 }}>
                <Text size="sm" fw={600} className="tabular-nums">
                  ¥{item.value.toLocaleString()}
                </Text>
                <Text size="xs" c="dimmed" className="tabular-nums" w={44} ta="right">
                  {item.percentage.toFixed(1)}%
                </Text>
              </Group>
            </Group>
          ))}
        </Stack>
      </Group>
    </Paper>
  );
};
