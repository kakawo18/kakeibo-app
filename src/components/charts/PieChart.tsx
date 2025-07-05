'use client';

import { useMemo } from 'react';
import { PieChart as MantinePieChart } from '@mantine/charts';
import { Paper, Text, Stack, Group, Badge } from '@mantine/core';
import { motion } from 'framer-motion';
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
      percentage: item.percentage,
      color: item.color || `${color}.${Math.min(9, index + 1)}`,
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Paper withBorder p="md">
        <Text size="lg" fw={600} mb="md">{displayTitle}</Text>
        
        <Stack>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ 
              duration: 0.8,
              delay: 0.2,
              type: "spring",
              stiffness: 100
            }}
          >
            <MantinePieChart
              data={chartData}
              mx="auto"
              size={300}
              withLabels
              labelsPosition="inside"
              labelsType="percent"
              withTooltip
              tooltipDataSource="segment"
              valueFormatter={(value: number) => {
                const item = chartData.find(d => d.value === value);
                return item ? `${item.percentage}%` : `${Math.round(value)}%`;
              }}
              startAngle={90}
              endAngle={450}
              strokeWidth={2}
            />
          </motion.div>
          
          <Stack gap="xs">
            {data.map((item, index) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ 
                  duration: 0.4,
                  delay: 0.5 + index * 0.1
                }}
              >
                <Group justify="space-between">
                  <Group gap="xs">
                    <Badge 
                      variant="filled"
                      style={{ 
                        backgroundColor: item.color || `var(--mantine-color-${color}-${Math.min(9, index + 1)})`,
                        color: 'white',
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
              </motion.div>
            ))}
          </Stack>
        </Stack>
      </Paper>
    </motion.div>
  );
};