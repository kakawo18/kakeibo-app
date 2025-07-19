'use client';

import { useState, useMemo } from 'react';
import { LineChart as MantineLineChart } from '@mantine/charts';
import { Paper, Text, Group, Button, MultiSelect } from '@mantine/core';
import { MonthlyData, Transaction } from '@/types';
import { getMonthName } from '@/utils/dateUtils';

interface LineChartProps {
  title: string;
  data: MonthlyData[];
  transactions?: Transaction[]; // カテゴリ分析用
}

export const LineChart: React.FC<LineChartProps> = ({ title, data, transactions = [] }) => {
  const [chartMode, setChartMode] = useState<'balance' | 'category'>('balance');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['食費']);

  // 利用可能なカテゴリを取得
  const availableCategories = useMemo(() => {
    const categories = Array.from(new Set(
      transactions
        .filter(t => t.type === 'expense')
        .map(t => t.category)
    )).sort();
    return categories.map(cat => ({ value: cat, label: cat }));
  }, [transactions]);

  // カテゴリ別月間データを計算
  const categoryData = useMemo(() => {
    if (chartMode === 'balance') {
      return data?.map((item) => ({
        month: getMonthName(item.month).replace('年', '/').replace('月', ''),
        残高: item.balance,
      })) || [];
    }

    // カテゴリ別の月間集計
    const monthlyCategories: { [key: string]: { [category: string]: number } } = {};
    
    transactions.forEach(transaction => {
      if (transaction.type !== 'expense') return;
      
      const month = transaction.date.toISOString().substring(0, 7);
      const monthName = getMonthName(month).replace('年', '/').replace('月', '');
      
      if (!monthlyCategories[monthName]) {
        monthlyCategories[monthName] = {};
      }
      
      if (!monthlyCategories[monthName][transaction.category]) {
        monthlyCategories[monthName][transaction.category] = 0;
      }
      
      monthlyCategories[monthName][transaction.category] += transaction.amount;
    });

    return Object.entries(monthlyCategories).map(([month, categories]) => ({
      month,
      ...categories,
    }));
  }, [data, transactions, chartMode]);

  // チャートシリーズを動的生成
  const chartSeries = useMemo(() => {
    if (chartMode === 'balance') {
      return [{ name: '残高', color: 'blue.6' }];
    }

    const colors = ['red.6', 'green.6', 'orange.6', 'purple.6', 'teal.6', 'pink.6'];
    return selectedCategories.map((category, index) => ({
      name: category,
      color: colors[index % colors.length],
    }));
  }, [chartMode, selectedCategories]);

  if (!data || data.length === 0) {
    return (
      <Paper withBorder p="md">
        <Text size="lg" fw={600} mb="md">{title}</Text>
        <Text ta="center" c="dimmed" py="xl">
          データがありません
        </Text>
      </Paper>
    );
  }

  return (
    <Paper withBorder p="md">
      <Group justify="space-between" mb="md">
        <Text size="lg" fw={600}>{title}</Text>
        
        {/* モード切替ボタン */}
        <Group gap="xs">
          <Button
            variant={chartMode === 'balance' ? 'filled' : 'light'}
            size="xs"
            onClick={() => setChartMode('balance')}
          >
            残高推移
          </Button>
          <Button
            variant={chartMode === 'category' ? 'filled' : 'light'}
            size="xs"
            onClick={() => setChartMode('category')}
            color="orange"
          >
            カテゴリ比較
          </Button>
        </Group>
      </Group>

      {/* カテゴリ選択（カテゴリモード時のみ表示） */}
      {chartMode === 'category' && (
        <MultiSelect
          data={availableCategories}
          value={selectedCategories}
          onChange={setSelectedCategories}
          placeholder="比較するカテゴリを選択"
          mb="md"
          maxValues={5}
          searchable
          clearable
        />
      )}
      
      <MantineLineChart
        h={300}
        data={categoryData}
        dataKey="month"
        series={chartSeries}
        curveType="linear"
        withLegend
        withTooltip
        withDots
        gridAxis="xy"
        tickLine="xy"
        valueFormatter={(value) =>
          chartMode === 'balance'
            ? (value >= 0 
                ? `+¥${value.toLocaleString()}`
                : `-¥${Math.abs(value).toLocaleString()}`)
            : `¥${value.toLocaleString()}`
        }
      />
    </Paper>
  );
};