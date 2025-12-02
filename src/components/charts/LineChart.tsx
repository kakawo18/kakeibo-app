'use client';

import { useState, useMemo } from 'react';
import { LineChart as MantineLineChart } from '@mantine/charts';
import { Paper, Text, Group, Button, MultiSelect, ActionIcon } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { MonthlyData, Transaction } from '@/types';
import { getMonthName, formatMonthLocal } from '@/utils/dateUtils';

interface LineChartProps {
  title: string;
  data: MonthlyData[];
  transactions?: Transaction[]; // カテゴリ分析用
}

export const LineChart: React.FC<LineChartProps> = ({ title, data, transactions = [] }) => {
  const [chartMode, setChartMode] = useState<'balance' | 'category'>('balance');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['食費']);
  const DISPLAY_MONTHS = 6; // 表示する月数
  
  // 初期表示を最新の6ヶ月にする
  const initialStartIndex = useMemo(() => {
    const totalMonths = data?.length || 0;
    return Math.max(0, totalMonths - DISPLAY_MONTHS);
  }, [data]);
  
  const [displayStartIndex, setDisplayStartIndex] = useState(initialStartIndex);

  // 利用可能なカテゴリを取得
  const availableCategories = useMemo(() => {
    const categories = Array.from(new Set(
      transactions
        .filter(t => t.type === 'expense')
        .map(t => t.category)
    )).sort();
    return categories.map(cat => ({ value: cat, label: cat }));
  }, [transactions]);

  // 全データを計算（スライス前）
  const allCategoryData = useMemo(() => {
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
  }, [data, transactions, chartMode]);

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