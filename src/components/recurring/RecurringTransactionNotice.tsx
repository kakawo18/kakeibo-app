'use client';

import { Card, Text, Group, Button, Stack, Badge } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconCalendar } from '@tabler/icons-react';
import { RecurringTransaction } from '@/types';

interface RecurringTransactionNoticeProps {
  recurringTransactions: RecurringTransaction[];
  onRecord: (transaction: RecurringTransaction) => void;
}

export const RecurringTransactionNotice: React.FC<RecurringTransactionNoticeProps> = ({
  recurringTransactions,
  onRecord,
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)');

  if (recurringTransactions.length === 0) {
    return null;
  }

  return (
    <Card
      withBorder
      p={isMobile ? 'md' : 'lg'}
      style={{
        background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.05) 0%, rgba(33, 150, 243, 0.15) 100%)',
        borderLeft: '4px solid #2196f3',
        boxShadow: '0 2px 12px rgba(33, 150, 243, 0.1)',
      }}
    >
      <Stack gap="md">
        <Group gap="xs">
          <IconCalendar size={20} color="#2196f3" />
          <Text fw={600} size={isMobile ? 'md' : 'lg'}>
            📅 今月の定期取引
          </Text>
        </Group>

        <Stack gap="sm">
          {recurringTransactions.map((transaction) => (
            <Card key={transaction.id} withBorder p="sm" style={{ backgroundColor: 'white' }}>
              <Group justify="space-between" align="flex-start">
                <div style={{ flex: 1 }}>
                  <Group gap="xs" mb="xs">
                    <Text fw={600} size="sm">
                      {transaction.name}
                    </Text>
                    <Badge size="xs" color="blue">
                      {transaction.dayOfMonth}日
                    </Badge>
                  </Group>
                  <Text size="sm" c="dimmed">
                    ¥{transaction.amount.toLocaleString()} - {transaction.category}
                    {transaction.subcategory && ` > ${transaction.subcategory}`}
                  </Text>
                </div>
                <Button
                  size={isMobile ? 'xs' : 'sm'}
                  onClick={() => onRecord(transaction)}
                  style={{ flexShrink: 0 }}
                >
                  記録する
                </Button>
              </Group>
            </Card>
          ))}
        </Stack>
      </Stack>
    </Card>
  );
};
