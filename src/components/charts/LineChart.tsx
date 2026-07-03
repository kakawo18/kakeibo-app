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
import { useSettings } from '@/contexts/SettingsContext';

const DISPLAY_MONTHS = 6; // 一度に表示する月数

interface LineChartProps {
  title: string;
  data: MonthlyData[];
  transactions?: Transaction[]; // カテゴリ分析用
}

export const LineChart: React.FC<LineChartProps> = ({ title, data, transactions = [] }) => {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const { rules, getColor } = useSettings();

  // 支出推移の分析対象か（投資・立替金は除外）
  const isAnalyzedExpense = useMemo(
    () => (t: Transaction): boolean =>
      t.type === 'expense' && !rules.isInvestment(t) && !rules.isAdvancePayment(t),
    [rules]
  );
  // ユーザーが明示的に選択するまでは支出Top 3カテゴリをデフォルト表示
  const [userSelectedCategories, setUserSelectedCategories] = useState<string[] | null>(null);

  // ユーザーがページングするまでは常に最新期間を表示する
  // （固定値で初期化すると、データ月数が変わったとき初期表示がずれる）
  const [userStartIndex, setUserStartIndex] = useState<number | null>(null);

  // 支出Top 3カテゴリ（デフォルト選択用）
  const defaultTopCategories = useMemo(() => {
    const categoryTotals = new Map<string, number>();

    transactions.forEach(t => {
      if (!isAnalyzedExpense(t)) return;

      const cat = t.category;
      categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + t.amount);
    });

    return Array.from(categoryTotals.entries())
      .sort((a, b) => b[1] - a[1]) // 金額降順
      .slice(0, 3) // Top 3
      .map(entry => entry[0]);
  }, [transactions, isAnalyzedExpense]);

  const selectedCategories = userSelectedCategories ?? defaultTopCategories;

  // 利用可能なカテゴリを取得
  const availableCategories = useMemo(() => {
    const categories = Array.from(new Set(
      transactions.filter(isAnalyzedExpense).map(t => t.category)
    )).sort();
    return categories.map(cat => ({ value: cat, label: cat }));
  }, [transactions, isAnalyzedExpense]);

  // 全データを計算（スライス前）
  const allCategoryData = useMemo(() => {
    // カテゴリ別の月間集計
    const monthlyCategories: Record<string, Record<string, number>> = {};

    transactions.forEach(transaction => {
      if (!isAnalyzedExpense(transaction)) return;

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
  }, [transactions, isAnalyzedExpense]);

  // 表示開始位置（未操作時は最新の6ヶ月）と表示データ
  const displayStartIndex = userStartIndex ?? Math.max(0, allCategoryData.length - DISPLAY_MONTHS);

  const categoryData = useMemo(
    () => allCategoryData.slice(displayStartIndex, displayStartIndex + DISPLAY_MONTHS),
    [allCategoryData, displayStartIndex]
  );

  // ページング制御
  const canGoPrev = displayStartIndex > 0;
  const canGoNext = displayStartIndex + DISPLAY_MONTHS < allCategoryData.length;

  const handlePrev = () => {
    if (canGoPrev) {
      setUserStartIndex(Math.max(0, displayStartIndex - DISPLAY_MONTHS));
    }
  };

  const handleNext = () => {
    if (canGoNext) {
      setUserStartIndex(Math.min(allCategoryData.length - DISPLAY_MONTHS, displayStartIndex + DISPLAY_MONTHS));
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
        <Group justify="center" mb="sm" gap="xs">
          <ActionIcon
            variant="default"
            size="md"
            radius={8}
            onClick={handlePrev}
            disabled={!canGoPrev}
            aria-label="前の期間へ"
          >
            <IconChevronLeft size={15} stroke={1.8} />
          </ActionIcon>
          <Text size="xs" c="dimmed" className="tabular-nums">
            {displayStartIndex + 1} - {Math.min(displayStartIndex + DISPLAY_MONTHS, allCategoryData.length)} / {allCategoryData.length}ヶ月
          </Text>
          <ActionIcon
            variant="default"
            size="md"
            radius={8}
            onClick={handleNext}
            disabled={!canGoNext}
            aria-label="次の期間へ"
          >
            <IconChevronRight size={15} stroke={1.8} />
          </ActionIcon>
        </Group>
      )}

      {/* カテゴリ選択 */}
      <MultiSelect
        data={availableCategories}
        value={selectedCategories}
        onChange={setUserSelectedCategories}
        placeholder="比較するカテゴリを選択"
        size="sm"
        mb="lg"
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
                boxShadow: 'var(--shadow-raised)',
                fontSize: '12px',
                color: 'var(--ink-1)',
                padding: '8px 12px',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--ink-2)' }} iconType="plainline" />
            {selectedCategories.map((category) => (
              <Line
                key={category}
                type="monotone"
                dataKey={category}
                stroke={getColor(category, isDark)}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: getColor(category, isDark) }}
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