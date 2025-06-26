'use client';

import { useState } from 'react';
import {
  Table,
  ActionIcon,
  Text,
  Group,
  Badge,
  Stack,
  Paper,
  Button,
} from '@mantine/core';
import { IconEdit, IconTrash, IconArrowUp, IconArrowDown } from '@tabler/icons-react';
import { useTransactions } from '@/hooks/useTransactions';
import { Transaction } from '@/types';
import { formatDate } from '@/utils/dateUtils';

interface TransactionListProps {
  transactions: Transaction[];
  onEditTransaction: (transaction: Transaction) => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({ transactions, onEditTransaction }) => {
  const { deleteTransaction } = useTransactions();
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const sortedTransactions = [...transactions].sort((a, b) => {
    let comparison = 0;
    
    if (sortBy === 'date') {
      const dateA = a.date instanceof Date ? a.date.getTime() : 0;
      const dateB = b.date instanceof Date ? b.date.getTime() : 0;
      comparison = dateA - dateB;
    } else {
      comparison = a.amount - b.amount;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleDelete = async (id: string) => {
    if (window.confirm('この取引を削除しますか？')) {
      await deleteTransaction(id);
    }
  };

  const toggleSort = (field: 'date' | 'amount') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <Paper withBorder p="md">
      <Stack>
        <Group justify="space-between">
          <Text size="lg" fw={600}>取引履歴</Text>
          <Group>
            <Button
              variant="light"
              leftSection={sortOrder === 'asc' ? <IconArrowUp size={16} /> : <IconArrowDown size={16} />}
              onClick={() => toggleSort('date')}
              color={sortBy === 'date' ? 'blue' : 'gray'}
            >
              日付順
            </Button>
            <Button
              variant="light"
              leftSection={sortOrder === 'asc' ? <IconArrowUp size={16} /> : <IconArrowDown size={16} />}
              onClick={() => toggleSort('amount')}
              color={sortBy === 'amount' ? 'blue' : 'gray'}
            >
              金額順
            </Button>
          </Group>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>日付</Table.Th>
              <Table.Th>種別</Table.Th>
              <Table.Th>カテゴリ</Table.Th>
              <Table.Th>支払方法</Table.Th>
              <Table.Th>金額</Table.Th>
              <Table.Th>メモ</Table.Th>
              <Table.Th>操作</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sortedTransactions.map((transaction) => (
              <Table.Tr key={transaction.id}>
                <Table.Td>{formatDate(transaction.date)}</Table.Td>
                <Table.Td>
                  <Stack gap={2}>
                    <Badge color={transaction.type === 'income' ? 'green' : 'red'}>
                      {transaction.type === 'income' ? '収入' : '支出'}
                    </Badge>
                    {transaction.transactionType === 'card_payment' && (
                      <Badge variant="light" color="blue" size="xs">
                        カード支払い
                      </Badge>
                    )}
                    {transaction.transactionType === 'card_withdrawal' && (
                      <Badge variant="light" color="orange" size="xs">
                        カード引き落とし
                      </Badge>
                    )}
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Stack gap={2}>
                    <Text size="sm">{transaction.category}</Text>
                    {transaction.subcategory && (
                      <Text size="xs" c="dimmed">{transaction.subcategory}</Text>
                    )}
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {transaction.paymentMethod || '-'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text 
                    c={transaction.type === 'income' ? 'green' : 'red'}
                    fw={500}
                  >
                    {transaction.type === 'income' ? '+' : '-'}
                    ¥{transaction.amount.toLocaleString()}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" truncate maw={150}>
                    {transaction.description || '-'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon
                      variant="light"
                      color="blue"
                      onClick={() => onEditTransaction(transaction)}
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="light"
                      color="red"
                      onClick={() => handleDelete(transaction.id)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        {transactions.length === 0 && (
          <Text ta="center" c="dimmed" py="xl">
            取引がありません
          </Text>
        )}
      </Stack>
    </Paper>
  );
};