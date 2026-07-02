'use client';

import { Paper, Text, Group, Button, Stack, Badge, Box } from '@mantine/core';
import { IconRepeat } from '@tabler/icons-react';
import { RecurringTransaction } from '@/types';

interface RecurringTransactionNoticeProps {
  recurringTransactions: RecurringTransaction[];
  onRecord: (transaction: RecurringTransaction) => void;
}

/**
 * 今月の定期取引の記録を促す通知カード
 *
 * 【デザイン方針】
 * - 通常カードと同じ ledger-card をベースに、左のアクセントストライプで
 *   「アクションが必要」であることだけを静かに示す（グラデーション・絵文字は使わない）
 * - 行は台帳リストと同じ構造（名前 + 補足 | アクション）で統一
 */
export const RecurringTransactionNotice: React.FC<RecurringTransactionNoticeProps> = ({
  recurringTransactions,
  onRecord,
}) => {
  if (recurringTransactions.length === 0) {
    return null;
  }

  return (
    <Paper
      className="ledger-card"
      p="lg"
      style={{ borderLeft: '3px solid var(--accent)' }}
    >
      <Group gap={8} mb={4}>
        <IconRepeat size={15} stroke={1.8} style={{ color: 'var(--accent)' }} />
        <Text className="section-title">今月の定期取引</Text>
        <Badge size="sm" variant="light" color="indigo" circle>
          {recurringTransactions.length}
        </Badge>
      </Group>
      <Text size="xs" c="dimmed" mb="sm">
        未記録の定期取引があります
      </Text>

      <Stack gap={0}>
        {recurringTransactions.map((transaction, index) => (
          <Group
            key={transaction.id}
            justify="space-between"
            wrap="nowrap"
            py={10}
            style={index > 0 ? { borderTop: '1px solid var(--hairline)' } : undefined}
          >
            <Box style={{ minWidth: 0, flex: 1 }}>
              <Group gap={8} wrap="nowrap">
                <Text size="sm" fw={600} truncate>
                  {transaction.name}
                </Text>
                <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                  毎月{transaction.dayOfMonth}日
                </Text>
              </Group>
              <Text size="xs" c="dimmed" truncate>
                <Text component="span" fw={600} className="tabular-nums" style={{ color: 'var(--ink-2)' }}>
                  ¥{transaction.amount.toLocaleString()}
                </Text>
                {' '}· {transaction.category}
                {transaction.subcategory && ` / ${transaction.subcategory}`}
              </Text>
            </Box>
            <Button
              size="xs"
              variant="light"
              onClick={() => onRecord(transaction)}
              style={{ flexShrink: 0 }}
            >
              記録する
            </Button>
          </Group>
        ))}
      </Stack>
    </Paper>
  );
};
