'use client';

import { useMemo } from 'react';
import { PieChart as MantinePieChart } from '@mantine/charts';
import { Paper, Text, Stack, Group, Badge } from '@mantine/core';
import { ChartData } from '@/types';

interface PieChartProps {
  title: string;
  data: ChartData[];
  totalAmount?: number;
  color?: string;
}

export const PieChart: React.FC<PieChartProps> = ({ 
  title, 
  data, 
  totalAmount,
  color = 'blue' 
}) => {
  const chartData = useMemo(() => 
    data?.map((item, index) => ({
      name: item.name,
      value: item.value,
      color: `${color}.${Math.min(9, index + 1)}`,
    })) || [],
    [data, color]
  );

  const displayTitle = useMemo(() => 
    totalAmount !== undefined 
      ? `${title} (合計: ¥${totalAmount.toLocaleString()})`
      : title,
    [title, totalAmount]
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
      <Text size="lg" fw={600} mb="md">{displayTitle}</Text>
      
      <Stack>
        <MantinePieChart
          data={chartData}
          mx="auto"
          size={300}
          withLabels
          labelsPosition="inside"
          labelsType="percent"
          withTooltip
        />
        
        <Stack gap="xs">
          {data.map((item, index) => (
            <Group key={item.name} justify="space-between">
              <Group gap="xs">
                <Badge 
                  variant="outline"
                  style={{ 
                    borderColor: `var(--mantine-color-${color}-${Math.min(9, index + 1)})`,
                    color: '#000',
                    backgroundColor: 'transparent',
                    fontWeight: 600
                  }}
                >
                  {item.percentage}%
                </Badge>
                <Text size="sm" fw={500} c="#000">{item.name}</Text>
              </Group>
              <Text size="sm" fw={500} c="#000">
                ¥{item.value.toLocaleString()}
              </Text>
            </Group>
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
};