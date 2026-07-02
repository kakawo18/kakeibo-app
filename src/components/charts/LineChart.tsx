'use client';

import { useState, useMemo } from 'react';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Paper, Text, Group, MultiSelect, ActionIcon, Box, Stack, useMantineColorScheme } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { MonthlyData, Transaction } from '@/types';
import { getMonthName, formatMonthLocal } from '@/utils/dateUtils';
import { getCategoryColor } from '@/utils/calculations';

interface LineChartProps {
  title: string;
  data: MonthlyData[];
  transactions?: Transaction[]; // カテゴリ分析用
}

export const LineChart: React.FC<LineChartProps> = ({ title, data, transactions = [] }) => {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  // ユーザーが明示的に選択するまでは支出Top 3カテゴリをデフォルト表示
  const [userSelectedCategories, setUserSelectedCategories] = useState<string[] | null>(null);
  const DISPLAY_MONTHS = 6; // 表示する月数

  // 初期表示を最新の6ヶ月にする
  const initialStartIndex = useMemo(() => {
    const totalMonths = data?.length || 0;
    return Math.max(0, totalMonths - DISPLAY_MONTHS);
  }, [data]);

  const [displayStartIndex, setDisplayStartIndex] = useState(initialStartIndex);

  // 支出Top 3カテゴリ（デフォルト選択用）
  const defaultTopCategories = useMemo(() => {
    const categoryTotals = new Map<string, number>();

    transactions.forEach(t => {
      // 支出のみ、投資・立替金は除外
      if (t.type !== 'expense') return;
      if (t.category === '固定費' && t.subcategory === '投資') return;
      if (t.category === '立替金') return;

      const cat = t.category;
      categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + t.amount);
    });

    return Array.from(categoryTotals.entries())
      .sort((a, b) => b[1] - a[1]) // 金額降順
      .slice(0, 3) // Top 3
      .map(entry => entry[0]);
  }, [transactions]);

  const selectedCategories = userSelectedCategories ?? defaultTopCategories;

  // 利用可能なカテゴリを取得
  const availableCategories = useMemo(() => {
    const categories = Array.from(new Set(
      transactions
        .filter(t =>
          t.type === 'expense' &&
          !(t.category === '固定費' && t.subcategory === '投資') &&
          t.category !== '立替金'
        )
        .map(t => t.category)
    )).sort();
    return categories.map(cat => ({ value: cat, label: cat }));
  }, [transactions]);

  // 全データを計算（スライス前）
  const allCategoryData = useMemo(() => {
    // カテゴリ別の月間集計
    const monthlyCategories: { [key: string]: { [category: string]: number } } = {};

    transactions.forEach(transaction => {
      if (transaction.type !== 'expense') return;
      // 投資・立替金は除外
      if (transaction.category === '固定費' && transaction.subcategory === '投資') return;
      if (transaction.category === '立替金') return;

      const month = formatMonthLocal(transaction.date);

      if (!monthlyCategories[month]) {
        monthlyCategories[month] = {};
      }

      if (!monthlyCategories[month][transaction.category]) {
        monthlyCategories[month][transaction.category] = 0;
      }

      monthlyCategories[month][transaction.category] += transaction.amount;
    });

    // 月を時系列順にソート（過去→現在）
    return Object.entries(monthlyCategories)
      .sort(([monthA], [monthB]) => monthA.localeCompare(monthB)) // YYYY-MM形式で文字列ソート
      .map(([month, categories]) => ({
        month: getMonthName(month).replace('年', '/').replace('月', ''),
        ...categories,
      }));
  }, [transactions]);

  // 表示するデータ（6ヶ月分）
  const categoryData = useMemo(() => {
    const endIndex = displayStartIndex + DISPLAY_MONTHS;
    return allCategoryData.slice(displayStartIndex, endIndex);
  }, [allCategoryData, displayStartIndex]);

  // ページング制御
  const canGoPrev = displayStartIndex > 0;
  const canGoNext = displayStartIndex + DISPLAY_MONTHS < allCategoryData.length;

  const handlePrev = () => {
    if (canGoPrev) {
      setDisplayStartIndex(prev => Math.max(0, prev - DISPLAY_MONTHS));
    }
  };

  const handleNext = () => {
    if (canGoNext) {
      setDisplayStartIndex(prev => Math.min(allCategoryData.length - DISPLAY_MONTHS, prev + DISPLAY_MONTHS));
    }
  };

  if (!data || data.length === 0) {
    return (
      <Paper className="ledger-card" p="lg">
        <Text className="section-title">{title}</Text>
        <Text ta="center" c="dimmed" py="xl" size="sm">
          データがありません
        </Text>
      </Paper>
    );
  }

  // ツールチップのフォーマッター
  const tooltipFormatter = (value: number, name: string) => {
    return [`¥${value.toLocaleString()}`, name];
  };

  return (
    <Paper className="ledger-card" p="lg">
      <Group justify="space-between" mb="md">
        <Stack gap={2}>
          <Text className="section-title">{title}</Text>
          <Text size="xs" c="dimmed">月別の推移を比較</Text>
        </Stack>
      </Group>

      {/* ページングコントロール */}
      {allCategoryData.length > DISPLAY_MONTHS && (
        <Group justify="center" mb="md" gap="xs">
          <ActionIcon
            variant="light"
            size="lg"
            onClick={handlePrev}
            disabled={!canGoPrev}
          >
            <IconChevronLeft size={18} />
          </ActionIcon>
          <Text size="sm" c="dimmed">
            {displayStartIndex + 1} - {Math.min(displayStartIndex + DISPLAY_MONTHS, allCategoryData.length)} / {allCategoryData.length}ヶ月
          </Text>
          <ActionIcon
            variant="light"
            size="lg"
            onClick={handleNext}
            disabled={!canGoNext}
          >
            <IconChevronRight size={18} />
          </ActionIcon>
        </Group>
      )}

      {/* カテゴリ選択 */}
      <MultiSelect
        data={availableCategories}
        value={selectedCategories}
        onChange={setUserSelectedCategories}
        placeholder="比較するカテゴリを選択"
        mb="xl"
        maxValues={5}
        searchable
        clearable
        hidePickedOptions
      />

      <Box h={280}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsLineChart
            data={categoryData}
            margin={{ top: 5, right: 16, left: 0, bottom: 5 }}
          >
            <CartesianGrid stroke="var(--grid-line)" strokeWidth={1} vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: 'var(--ink-3)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--hairline-strong)' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--ink-3)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${(value / 10000).toFixed(0)}万`}
              width={36}
            />
            <Tooltip
              formatter={tooltipFormatter}
              contentStyle={{
                background: 'var(--app-surface)',
                border: '1px solid var(--hairline-strong)',
                borderRadius: '10px',
                fontSize: '12px',
                color: 'var(--ink-1)',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} iconType="plainline" />
            {selectedCategories.map((category) => (
              <Line
                key={category}
                type="monotone"
                dataKey={category}
                stroke={getCategoryColor(category, isDark)}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: getCategoryColor(category, isDark) }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--app-surface)' }}
                connectNulls={false}
              />
            ))}
          </RechartsLineChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};