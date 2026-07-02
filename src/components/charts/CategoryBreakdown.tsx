'use client';

import { useState } from 'react';
import { Paper, Grid, Box } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { ChartData } from '@/types';
import { PieChart, PieChartBody } from './PieChart';

interface CategoryBreakdownProps {
  expenseData: ChartData[];
  incomeData: ChartData[];
  expenseTotal: number;
  incomeTotal: number;
}

const TABS = [
  { value: 'expense', label: '支出の内訳' },
  { value: 'income', label: '収入の内訳' },
] as const;

type TabValue = (typeof TABS)[number]['value'];

/**
 * カテゴリ内訳セクション（支出・収入のドーナツチャート）
 *
 * - デスクトップ: 2カラムで「支出の内訳」「収入の内訳」を並べる
 * - モバイル: 1枚のカードに集約し、カード上端のアンダーライン式タブで
 *   支出/収入を切り替える（縦積み2カードはスクロール量が嵩むため）
 */
export const CategoryBreakdown: React.FC<CategoryBreakdownProps> = ({
  expenseData,
  incomeData,
  expenseTotal,
  incomeTotal,
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [activeTab, setActiveTab] = useState<TabValue>('expense');

  if (!isMobile) {
    return (
      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <PieChart title="支出の内訳" data={expenseData} totalAmount={expenseTotal} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <PieChart title="収入の内訳" data={incomeData} totalAmount={incomeTotal} />
        </Grid.Col>
      </Grid>
    );
  }

  const activeIndex = TABS.findIndex((t) => t.value === activeTab);
  const isExpense = activeTab === 'expense';

  return (
    <Paper className="ledger-card" p={0}>
      {/* タブはカード上端にフラッシュさせ、スライドインジケーターで選択を示す */}
      <Box className="underline-tabs" role="tablist" px="sm">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            className="underline-tab"
            aria-selected={activeTab === tab.value}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
        <Box
          className="underline-tabs-indicator"
          style={{
            // px="sm"(12px) 分を除いた実効幅の 1/2 をスライドさせる
            width: `calc((100% - 24px) / ${TABS.length})`,
            left: 12,
            transform: `translateX(${activeIndex * 100}%)`,
          }}
        />
      </Box>

      {/* key でタブごとに再マウントし、クロスフェードさせる */}
      <Box key={activeTab} className="chart-swap" px="xs" py="sm">
        <PieChartBody
          data={isExpense ? expenseData : incomeData}
          totalAmount={isExpense ? expenseTotal : incomeTotal}
        />
      </Box>
    </Paper>
  );
};
