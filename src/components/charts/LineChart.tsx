'use client';

import { useMemo } from 'react';
import { LineChart as MantineLineChart } from '@mantine/charts';
import { Paper, Text } from '@mantine/core';
import { MonthlyData } from '@/types';
import { getMonthName } from '@/utils/dateUtils';

interface LineChartProps {
  title: string;
  data: MonthlyData[];
}

export const LineChart: React.FC<LineChartProps> = ({ title, data }) => {
  const chartData = useMemo(() => 
    data?.map((item) => ({
      month: getMonthName(item.month).replace('年', '/').replace('月', ''),
      残高: item.balance,
    })) || [],
    [data]
  );

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
      <Text size="lg" fw={600} mb="md">{title}</Text>
      
      <MantineLineChart
        h={300}
        data={chartData}
        dataKey="month"
        series={[
          { name: '残高', color: 'blue.6' },
        ]}
        curveType="linear"
        withLegend
        withTooltip
        withDots
        gridAxis="xy"
        tickLine="xy"
        valueFormatter={(value) =>
          value >= 0 
            ? `+¥${value.toLocaleString()}`
            : `-¥${Math.abs(value).toLocaleString()}`
        }
      />
    </Paper>
  );
};