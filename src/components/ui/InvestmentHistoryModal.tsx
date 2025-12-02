'use client';

import { useMemo } from 'react';
import { Modal, Stack, Card, Text, Group, Box, Divider, Badge } from '@mantine/core';
import { IconCoins } from '@tabler/icons-react';
import { Transaction } from '@/types';
import { formatMonthLocal, getMonthName } from '@/utils/dateUtils';

interface InvestmentHistoryModalProps {
  opened: boolean;
  onClose: () => void;
  transactions: Transaction[];
  year: number;
}

export const InvestmentHistoryModal: React.FC<InvestmentHistoryModalProps> = ({
  opened,
  onClose,
  transactions,
  year,
}) => {
  // 年間投資データの計算
  const investmentData = useMemo(() => {
    // 投資取引のフィルタリング
    const investmentTransactions = transactions.filter(t =>
      t.date.getFullYear() === year &&
      t.type === 'expense' &&
      t.category === '固定費' &&
      t.subcategory === '投資'
    );

    // 年間合計
    const yearlyTotal = investmentTransactions.reduce((sum, t) => sum + t.amount, 0);

    // 月別にグループ化
    const monthlyMap = new Map<string, Transaction[]>();
    investmentTransactions.forEach(t => {
      const month = formatMonthLocal(t.date);
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, []);
      }
      monthlyMap.get(month)!.push(t);
    });

    // 月別データを作成（新しい順）
    const monthlyData = Array.from(monthlyMap.entries())
      .map(([month, txs]) => ({
        month,
        transactions: txs.sort((a, b) => b.date.getTime() - a.date.getTime()),
        total: txs.reduce((sum, t) => sum + t.amount, 0),
      }))
      .sort((a, b) => b.month.localeCompare(a.month)); // 新しい順

    return {
      yearlyTotal,
      monthlyData,
    };
  }, [transactions, year]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <IconCoins size={24} color="var(--mantine-color-orange-6)" />
          <Text size="lg" fw={600}>{year}年 年間投資履歴</Text>
        </Group>
      }
      size="lg"
      centered
    >
      <Stack gap="md">
        {/* 年間合計 */}
        <Box
          p="md"
          style={{
            backgroundColor: 'light-dark(var(--mantine-color-orange-0), var(--mantine-color-dark-6))',
            borderRadius: '8px',
            border: '1px solid light-dark(var(--mantine-color-orange-2), var(--mantine-color-dark-4))',
          }}
        >
          <Text size="sm" c="dimmed" mb="xs">年間投資額合計</Text>
          <Text size="xl" fw={700} c="orange">
            ¥{investmentData.yearlyTotal.toLocaleString()}
          </Text>
        </Box>

        {/* 月別投資履歴 */}
        {investmentData.monthlyData.length === 0 ? (
          <Text ta="center" c="dimmed" py="xl">
            {year}年の投資履歴がありません
          </Text>
        ) : (
          <Stack gap="sm">
            {investmentData.monthlyData.map(({ month, transactions: txs, total }) => (
              <Card key={month} withBorder p="md">
                {/* 月ヘッダー */}
                <Group justify="space-between" mb="md">
                  <Group gap="xs">
                    <Badge size="lg" color="orange" variant="light">
                      {getMonthName(month)}
                    </Badge>
                    <Text size="sm" c="dimmed">
                      {txs.length}件
                    </Text>
                  </Group>
                  <Text size="lg" fw={700} c="orange">
                    ¥{total.toLocaleString()}
                  </Text>
                </Group>

                <Divider mb="sm" />

                {/* 取引一覧 */}
                <Stack gap="xs">
                  {txs.map((tx) => (
                    <Group key={tx.id} justify="space-between" wrap="nowrap">
                      <Box style={{ flex: 1 }}>
                        <Text size="sm" fw={500}>
                          {tx.date.toLocaleDateString('ja-JP', {
                            month: 'numeric',
                            day: 'numeric',
                          })}
                        </Text>
                        {tx.description && (
                          <Text size="xs" c="dimmed" lineClamp={1}>
                            {tx.description}
                          </Text>
                        )}
                      </Box>
                      <Text size="sm" fw={600} c="orange" style={{ whiteSpace: 'nowrap' }}>
                        ¥{tx.amount.toLocaleString()}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>
    </Modal>
  );
};
