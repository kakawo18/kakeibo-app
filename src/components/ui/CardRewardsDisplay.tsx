'use client';

import { useMemo } from 'react';
import { Modal, Card, Text, Group, Stack, Progress, Badge, Grid, Box, ThemeIcon } from '@mantine/core';
import { IconCreditCard, IconCoins, IconTrendingUp } from '@tabler/icons-react';
import { Transaction } from '@/types';
import { calculateMonthlyCardRewards, CARD_COLORS, CARD_REWARD_RATES } from '@/utils/cardRewards';
interface CardRewardsDisplayProps {
  transactions: Transaction[];
  selectedMonth: string;
  opened: boolean;
  onClose: () => void;
}

export const CardRewardsDisplay: React.FC<CardRewardsDisplayProps> = ({ 
  transactions, 
  selectedMonth,
  opened,
  onClose
}) => {

  // 選択月の取引をフィルター（ローカルタイムゾーン対応）
  const monthlyTransactions = useMemo(() => 
    transactions.filter(t => {
      const transactionMonth = `${t.date.getFullYear()}-${(t.date.getMonth() + 1).toString().padStart(2, '0')}`;
      return transactionMonth === selectedMonth;
    }),
    [transactions, selectedMonth]
  );

  // 還元ポイント計算
  const rewardsData = useMemo(() => 
    calculateMonthlyCardRewards(monthlyTransactions),
    [monthlyTransactions]
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <ThemeIcon size="lg" color="orange" variant="light">
            <IconCoins size={20} />
          </ThemeIcon>
          <Text size="lg" fw={600}>カード還元ポイント詳細</Text>
        </Group>
      }
      size="lg"
      centered
    >
      {rewardsData.totalPoints === 0 ? (
        <Text ta="center" c="dimmed" py="xl">
          今月はカード還元ポイントがありません
        </Text>
      ) : (
        <Stack gap="md">
          {/* 総合サマリー */}
          <Grid>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <Box p="sm" style={{ backgroundColor: 'var(--mantine-color-orange-0)', borderRadius: '8px' }}>
                <Text size="xs" c="dimmed">カード利用額</Text>
                <Text size="lg" fw={700} c="orange">
                  ¥{rewardsData.totalAmount.toLocaleString()}
                </Text>
              </Box>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <Box p="sm" style={{ backgroundColor: 'var(--mantine-color-green-0)', borderRadius: '8px' }}>
                <Text size="xs" c="dimmed">獲得ポイント</Text>
                <Text size="lg" fw={700} c="green">
                  {rewardsData.totalPoints.toLocaleString()}pt
                </Text>
              </Box>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <Box p="sm" style={{ backgroundColor: 'var(--mantine-color-blue-0)', borderRadius: '8px' }}>
                <Text size="xs" c="dimmed">実質還元率</Text>
                <Text size="lg" fw={700} c="blue">
                  {((rewardsData.totalPoints / rewardsData.totalAmount) * 100).toFixed(2)}%
                </Text>
              </Box>
            </Grid.Col>
          </Grid>

          {/* カード別詳細 */}
          <Stack gap="sm">
            <Text size="sm" fw={600} c="dimmed">カード別詳細</Text>
            {Object.entries(rewardsData.cardRewards)
              .sort(([,a], [,b]) => b.points - a.points)
              .map(([cardType, data]) => {
                const rate = CARD_REWARD_RATES[cardType as keyof typeof CARD_REWARD_RATES];
                const color = CARD_COLORS[cardType as keyof typeof CARD_COLORS];
                
                return (
                  <Card key={cardType} withBorder p="sm" style={{ borderLeft: `4px solid ${color}` }}>
                    <Group justify="space-between" align="flex-start">
                      <Box style={{ flex: 1 }}>
                        <Group gap="xs" mb="xs">
                          <ThemeIcon size="sm" style={{ backgroundColor: color }}>
                            <IconCreditCard size={12} />
                          </ThemeIcon>
                          <Text size="sm" fw={600}>{cardType}</Text>
                          <Badge size="xs" color="gray" variant="light">
                            {(rate * 100).toFixed(2)}%還元
                          </Badge>
                        </Group>
                        
                        <Group gap="md" align="center">
                          <Box>
                            <Text size="xs" c="dimmed">利用額</Text>
                            <Text size="sm" fw={600}>
                              ¥{data.amount.toLocaleString()}
                            </Text>
                          </Box>
                          <Box>
                            <Text size="xs" c="dimmed">獲得ポイント</Text>
                            <Text size="sm" fw={600} c="green">
                              {data.points.toLocaleString()}pt
                            </Text>
                          </Box>
                        </Group>
                      </Box>
                      
                      <Box style={{ textAlign: 'right' }}>
                        <Text size="xs" c="dimmed">貢献度</Text>
                        <Text size="sm" fw={600}>
                          {((data.points / rewardsData.totalPoints) * 100).toFixed(1)}%
                        </Text>
                      </Box>
                    </Group>
                    
                    {/* プログレスバー */}
                    <Progress 
                      value={(data.points / rewardsData.totalPoints) * 100}
                      color={color}
                      size="sm"
                      mt="xs"
                    />
                  </Card>
                );
              })}
          </Stack>

          {/* 年間予測 */}
          <Box p="sm" style={{ backgroundColor: 'var(--mantine-color-gray-0)', borderRadius: '8px' }}>
            <Group gap="xs" mb="xs">
              <IconTrendingUp size={16} />
              <Text size="sm" fw={600}>年間予測</Text>
            </Group>
            <Group gap="md">
              <Text size="xs" c="dimmed">
                年間獲得予測: <Text component="span" fw={600} c="green">
                  {(rewardsData.totalPoints * 12).toLocaleString()}pt
                </Text>
              </Text>
              <Text size="xs" c="dimmed">
                年間利用予測: <Text component="span" fw={600}>
                  ¥{(rewardsData.totalAmount * 12).toLocaleString()}
                </Text>
              </Text>
            </Group>
          </Box>
        </Stack>
      )}
    </Modal>
  );
};