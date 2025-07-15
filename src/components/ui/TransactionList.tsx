'use client';

import { useState, useCallback } from 'react';
import {
  Table,
  ActionIcon,
  Text,
  Group,
  Badge,
  Stack,
  Paper,
  Button,
  Card,
  Box,
  Collapse,
  Loader,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconEdit, IconTrash, IconArrowUp, IconArrowDown, IconFilter, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { useTransactions } from '@/hooks/useTransactions';
import { Transaction } from '@/types';
import { formatDate } from '@/utils/dateUtils';

interface TransactionListProps {
  transactions: Transaction[];
  onEditTransaction: (transaction: Transaction) => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({ transactions, onEditTransaction }) => {
  const { deleteTransaction } = useTransactions();
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'category'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'week' | 'month'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // モバイル表示判定
  const isMobile = useMediaQuery('(max-width: 768px)');

  // フィルター処理
  const filteredTransactions = transactions.filter((transaction) => {
    // 種別フィルター
    if (filterType !== 'all' && transaction.type !== filterType) {
      return false;
    }

    // 期間フィルター
    if (filterPeriod !== 'all') {
      const now = new Date();
      const transactionDate = new Date(transaction.date);

      if (filterPeriod === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (transactionDate < weekAgo) return false;
      } else if (filterPeriod === 'month') {
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        if (transactionDate < monthAgo) return false;
      }
    }

    return true;
  });

  // ソート処理
  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    let comparison = 0;

    if (sortBy === 'date') {
      const dateA = a.date instanceof Date ? a.date.getTime() : 0;
      const dateB = b.date instanceof Date ? b.date.getTime() : 0;
      comparison = dateA - dateB;
    } else if (sortBy === 'amount') {
      comparison = a.amount - b.amount;
    } else if (sortBy === 'category') {
      const categoryA = a.subcategory || a.category;
      const categoryB = b.subcategory || b.category;
      comparison = categoryA.localeCompare(categoryB);
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleDelete = async (id: string) => {
    if (window.confirm('この取引を削除しますか？')) {
      await deleteTransaction(id);
    }
  };

  const toggleSort = (field: 'date' | 'amount' | 'category') => {
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
        {/* ヘッダー部分 */}
        <Group justify="space-between" align="center">
          <Text size="lg" fw={600}>取引履歴</Text>
          {isMobile && (
            <Button
              variant="light"
              size="xs"
              leftSection={<IconFilter size={14} />}
              rightSection={showFilters ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
              onClick={() => setShowFilters(!showFilters)}
              color={showFilters ? 'blue' : 'gray'}
            >
              フィルター
            </Button>
          )}
        </Group>

        {/* フィルター・ソートボタン - モバイル対応 */}
        {isMobile ? (
          <Collapse in={showFilters}>
            <Stack gap="xs" p="sm" style={{ backgroundColor: 'var(--mantine-color-gray-0)', borderRadius: '8px' }}>
              {/* フィルター */}
              <Text size="sm" c="dimmed" fw={600}>種別フィルター</Text>
              <Group gap="xs">
                <Button
                  variant="light"
                  size="xs"
                  onClick={() => setFilterType('all')}
                  color={filterType === 'all' ? 'blue' : 'gray'}
                  style={{ flex: 1 }}
                >
                  全て
                </Button>
                <Button
                  variant="light"
                  size="xs"
                  onClick={() => setFilterType('income')}
                  color={filterType === 'income' ? 'green' : 'gray'}
                  style={{ flex: 1 }}
                >
                  収入
                </Button>
                <Button
                  variant="light"
                  size="xs"
                  onClick={() => setFilterType('expense')}
                  color={filterType === 'expense' ? 'red' : 'gray'}
                  style={{ flex: 1 }}
                >
                  支出
                </Button>
              </Group>

              <Text size="sm" c="dimmed" fw={600} mt="xs">期間フィルター</Text>
              <Group gap="xs">
                <Button
                  variant="light"
                  size="xs"
                  onClick={() => setFilterPeriod('all')}
                  color={filterPeriod === 'all' ? 'blue' : 'gray'}
                  style={{ flex: 1 }}
                >
                  全期間
                </Button>
                <Button
                  variant="light"
                  size="xs"
                  onClick={() => setFilterPeriod('week')}
                  color={filterPeriod === 'week' ? 'blue' : 'gray'}
                  style={{ flex: 1 }}
                >
                  1週間
                </Button>
                <Button
                  variant="light"
                  size="xs"
                  onClick={() => setFilterPeriod('month')}
                  color={filterPeriod === 'month' ? 'blue' : 'gray'}
                  style={{ flex: 1 }}
                >
                  1ヶ月
                </Button>
              </Group>

              {/* ソート */}
              <Text size="sm" c="dimmed" fw={600} mt="xs">並び順</Text>
              <Group gap="xs">
                <Button
                  variant="light"
                  size="xs"
                  leftSection={sortBy === 'date' && (sortOrder === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />)}
                  onClick={() => toggleSort('date')}
                  color={sortBy === 'date' ? 'blue' : 'gray'}
                  style={{ flex: 1 }}
                >
                  日付順
                </Button>
                <Button
                  variant="light"
                  size="xs"
                  leftSection={sortBy === 'amount' && (sortOrder === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />)}
                  onClick={() => toggleSort('amount')}
                  color={sortBy === 'amount' ? 'blue' : 'gray'}
                  style={{ flex: 1 }}
                >
                  金額順
                </Button>
                <Button
                  variant="light"
                  size="xs"
                  leftSection={sortBy === 'category' && (sortOrder === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />)}
                  onClick={() => toggleSort('category')}
                  color={sortBy === 'category' ? 'blue' : 'gray'}
                  style={{ flex: 1 }}
                >
                  カテゴリ順
                </Button>
              </Group>
            </Stack>
          </Collapse>
        ) : (
          <Stack gap="sm">
            {/* デスクトップ用フィルター */}
            <Group justify="space-between">
              <Group gap="xs">
                <Text size="sm" c="dimmed">フィルター:</Text>
                <Button
                  variant="light"
                  size="xs"
                  onClick={() => setFilterType('all')}
                  color={filterType === 'all' ? 'blue' : 'gray'}
                >
                  全て
                </Button>
                <Button
                  variant="light"
                  size="xs"
                  onClick={() => setFilterType('income')}
                  color={filterType === 'income' ? 'green' : 'gray'}
                >
                  収入
                </Button>
                <Button
                  variant="light"
                  size="xs"
                  onClick={() => setFilterType('expense')}
                  color={filterType === 'expense' ? 'red' : 'gray'}
                >
                  支出
                </Button>
                <Button
                  variant="light"
                  size="xs"
                  onClick={() => setFilterPeriod('all')}
                  color={filterPeriod === 'all' ? 'blue' : 'gray'}
                >
                  全期間
                </Button>
                <Button
                  variant="light"
                  size="xs"
                  onClick={() => setFilterPeriod('week')}
                  color={filterPeriod === 'week' ? 'blue' : 'gray'}
                >
                  1週間
                </Button>
                <Button
                  variant="light"
                  size="xs"
                  onClick={() => setFilterPeriod('month')}
                  color={filterPeriod === 'month' ? 'blue' : 'gray'}
                >
                  1ヶ月
                </Button>
              </Group>
            </Group>

            {/* デスクトップ用ソート */}
            <Group justify="flex-end">
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
              <Button
                variant="light"
                leftSection={sortOrder === 'asc' ? <IconArrowUp size={16} /> : <IconArrowDown size={16} />}
                onClick={() => toggleSort('category')}
                color={sortBy === 'category' ? 'blue' : 'gray'}
              >
                カテゴリ順
              </Button>
            </Group>
          </Stack>
        )}

        {/* モバイル表示: カードレイアウト */}
        {isMobile ? (
          <Stack gap="sm">
            {sortedTransactions.map((transaction) => (
              <Card 
                key={transaction.id} 
                withBorder 
                p="md" 
                style={{ 
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  '&:active': {
                    transform: 'scale(0.98)',
                  }
                }}
                onClick={() => onEditTransaction(transaction)}
              >
                <Stack gap="sm">
                  {/* ヘッダー行: 日付と金額 */}
                  <Group justify="space-between" align="flex-start">
                    <Box>
                      <Text fw={600} size="sm" c="dimmed">
                        {formatDate(transaction.date)}
                      </Text>
                      <Group gap="xs" mt={2}>
                        <Badge 
                          color={transaction.type === 'income' ? 'green' : 'red'} 
                          size="sm"
                          variant="light"
                        >
                          {transaction.type === 'income' ? '収入' : '支出'}
                        </Badge>
                        {transaction.transactionType === 'card_payment' && (
                          <Badge variant="outline" color="blue" size="xs">
                            カード
                          </Badge>
                        )}
                        {transaction.transactionType === 'card_withdrawal' && (
                          <Badge variant="outline" color="orange" size="xs">
                            引落
                          </Badge>
                        )}
                      </Group>
                    </Box>

                    <Box style={{ textAlign: 'right' }}>
                      <Text
                        c={transaction.type === 'income' ? 'green' : 'red'}
                        fw={700}
                        size="xl"
                        style={{ lineHeight: 1.2 }}
                      >
                        {transaction.type === 'income' ? '+' : '-'}¥{transaction.amount.toLocaleString()}
                      </Text>
                      <Group gap="xs" justify="flex-end" mt={4}>
                        <ActionIcon
                          variant="light"
                          color="blue"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditTransaction(transaction);
                          }}
                          style={{ minWidth: '32px', minHeight: '32px' }}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="light"
                          color="red"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(transaction.id);
                          }}
                          style={{ minWidth: '32px', minHeight: '32px' }}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Box>
                  </Group>

                  {/* カテゴリ情報 */}
                  <Box>
                    <Text fw={600} size="md" mb={2}>
                      {transaction.category}
                    </Text>
                    <Group gap="md" align="flex-start">
                      {transaction.subcategory && (
                        <Text size="sm" c="dimmed">
                          📂 {transaction.subcategory}
                        </Text>
                      )}
                      {transaction.paymentMethod && (
                        <Text size="sm" c="dimmed">
                          💳 {transaction.paymentMethod}
                        </Text>
                      )}
                    </Group>
                  </Box>

                  {/* メモ */}
                  {transaction.description && (
                    <Box 
                      p="xs" 
                      style={{ 
                        backgroundColor: 'var(--mantine-color-gray-0)', 
                        borderRadius: '6px',
                        borderLeft: '3px solid var(--mantine-color-blue-4)'
                      }}
                    >
                      <Text size="sm" c="dimmed" style={{ fontStyle: 'italic' }}>
                        💭 {transaction.description}
                      </Text>
                    </Box>
                  )}
                </Stack>
              </Card>
            ))}
          </Stack>
        ) : (
          /* デスクトップ表示: テーブルレイアウト */
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
        )}

        {transactions.length === 0 ? (
          <Text ta="center" c="dimmed" py="xl">
            取引がありません
          </Text>
        ) : (
          /* 統計情報 */
          <Paper withBorder p="sm" style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
            <Group justify="space-between" align="center">
              <Text size="sm" c="dimmed">
                表示中: {sortedTransactions.length}件
              </Text>
              <Group gap="md">
                {(() => {
                  const totalIncome = sortedTransactions
                    .filter(t => t.type === 'income')
                    .reduce((sum, t) => sum + t.amount, 0);
                  const totalExpense = sortedTransactions
                    .filter(t => t.type === 'expense')
                    .reduce((sum, t) => sum + t.amount, 0);
                  const balance = totalIncome - totalExpense;

                  return (
                    <>
                      {totalIncome > 0 && (
                        <Text size="xs" c="green">
                          収入: ¥{totalIncome.toLocaleString()}
                        </Text>
                      )}
                      {totalExpense > 0 && (
                        <Text size="xs" c="red">
                          支出: ¥{totalExpense.toLocaleString()}
                        </Text>
                      )}
                      {(totalIncome > 0 || totalExpense > 0) && (
                        <Text size="xs" c={balance >= 0 ? 'green' : 'red'} fw={600}>
                          収支: {balance >= 0 ? '+' : ''}¥{balance.toLocaleString()}
                        </Text>
                      )}
                    </>
                  );
                })()}
              </Group>
            </Group>
          </Paper>
        )}
      </Stack>
    </Paper>
  );
};