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
  Card,
  Box,
  Collapse,
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
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // 利用可能なカテゴリを取得
  const availableCategories = Array.from(
    new Set(
      transactions.map(t => t.subcategory || t.category).filter(Boolean)
    )
  ).sort();

  // モバイル表示判定
  const isMobile = useMediaQuery('(max-width: 768px)');

  // フィルター処理
  const filteredTransactions = transactions.filter((transaction) => {
    // 種別フィルター
    if (filterType !== 'all' && transaction.type !== filterType) {
      return false;
    }

    // カテゴリフィルター
    if (filterCategory !== 'all') {
      const transactionCategory = transaction.subcategory || transaction.category;
      if (transactionCategory !== filterCategory) {
        return false;
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
    if (typeof window !== 'undefined' && window.confirm('この取引を削除しますか？')) {
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

              {/* カテゴリフィルター - 重点機能 */}
              <Text size="sm" c="dimmed" fw={600} mt="xs">カテゴリフィルター</Text>
              <Group gap="xs" style={{ flexWrap: 'wrap' }}>
                <Button
                  variant="light"
                  size="xs"
                  onClick={() => setFilterCategory('all')}
                  color={filterCategory === 'all' ? 'blue' : 'gray'}
                  style={{ minWidth: '70px' }}
                >
                  全て
                </Button>
                {availableCategories.map((category) => (
                  <Button
                    key={category}
                    variant="light"
                    size="xs"
                    onClick={() => setFilterCategory(category)}
                    color={filterCategory === category ? 'blue' : 'gray'}
                    style={{ minWidth: '70px' }}
                  >
                    {category.length > 8 ? `${category.slice(0, 8)}...` : category}
                  </Button>
                ))}
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
            <Stack gap="xs">
              <Group justify="space-between">
                <Group gap="xs">
                  <Text size="sm" c="dimmed">種別:</Text>
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
                </Group>
              </Group>
              
              {/* デスクトップ用カテゴリフィルター */}
              <Group gap="xs" align="center">
                <Text size="sm" c="dimmed">カテゴリ:</Text>
                <Button
                  variant="light"
                  size="xs"
                  onClick={() => setFilterCategory('all')}
                  color={filterCategory === 'all' ? 'blue' : 'gray'}
                >
                  全て
                </Button>
                {availableCategories.slice(0, 8).map((category) => (
                  <Button
                    key={category}
                    variant="light"
                    size="xs"
                    onClick={() => setFilterCategory(category)}
                    color={filterCategory === category ? 'blue' : 'gray'}
                  >
                    {category.length > 8 ? `${category.slice(0, 8)}...` : category}
                  </Button>
                ))}
                {availableCategories.length > 8 && (
                  <Text size="xs" c="dimmed">
                    他{availableCategories.length - 8}件
                  </Text>
                )}
              </Group>
            </Stack>

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

        {/* モバイル表示: コンパクトなカードレイアウト */}
        {isMobile ? (
          <Stack gap="xs">
            {sortedTransactions.map((transaction, index) => (
              <Card 
                key={transaction.id} 
                withBorder 
                p="sm" 
                style={{ 
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: `linear-gradient(135deg, 
                    ${transaction.type === 'income' 
                      ? 'rgba(76, 175, 80, 0.02) 0%, rgba(76, 175, 80, 0.08) 100%' 
                      : 'rgba(244, 67, 54, 0.02) 0%, rgba(244, 67, 54, 0.08) 100%'
                    })`,
                  borderLeft: `4px solid ${transaction.type === 'income' ? '#4caf50' : '#f44336'}`,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                  transform: 'translateY(0)',
                  opacity: 0,
                  animation: `slideInUp 0.4s ease-out ${index * 0.05}s forwards`,
                  minHeight: '50px', // 超スリム設計
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.04)';
                }}
                onClick={() => onEditTransaction(transaction)}
              >
                {/* レスポンシブ対応スリムレイアウト */}
                <Group justify="space-between" align="center" style={{ width: '100%' }}>
                  {/* 左側: 日付・カテゴリ・メモ */}
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Group gap="xs" align="center" wrap="nowrap">
                      <Text size="xs" c="dimmed" fw={500} style={{ minWidth: isMobile ? '25px' : '35px' }}>
                        {transaction.date.getDate()}日
                      </Text>
                      
                      {/* デスクトップのみ: 種別バッジ */}
                      {!isMobile && (
                        <Badge 
                          color={transaction.type === 'income' ? 'green' : 'red'} 
                          size="xs"
                          variant="dot"
                        />
                      )}
                      
                      <Text 
                        fw={600} 
                        size={isMobile ? "sm" : "xs"} 
                        truncate 
                        style={{ maxWidth: isMobile ? '100px' : '60px' }}
                      >
                        {transaction.category}
                      </Text>
                      
                      {/* メモ表示 */}
                      {transaction.description && (
                        <Text 
                          size="xs" 
                          c="dimmed" 
                          truncate 
                          style={{ maxWidth: isMobile ? '120px' : '80px' }}
                        >
                          {transaction.description.length > (isMobile ? 15 : 10)
                            ? `${transaction.description.substring(0, isMobile ? 15 : 10)}...` 
                            : transaction.description}
                        </Text>
                      )}
                      
                      {/* デスクトップのみ: カード支払いバッジ */}
                      {!isMobile && transaction.transactionType === 'card_payment' && (
                        <Badge variant="outline" color="blue" size="xs" style={{ fontSize: '9px', height: '16px' }}>
                          💳
                        </Badge>
                      )}
                    </Group>
                  </Box>

                  {/* 右側: 金額・操作ボタン */}
                  <Group gap="xs" align="center" wrap="nowrap">
                    <Text
                      c={transaction.type === 'income' ? 'green' : 'red'}
                      fw={700}
                      size={isMobile ? "md" : "sm"}
                      style={{ 
                        minWidth: isMobile ? '80px' : '70px', 
                        textAlign: 'right' 
                      }}
                    >
                      {transaction.type === 'income' ? '+' : ''}¥{transaction.amount.toLocaleString()}
                    </Text>
                    <Group gap={isMobile ? 4 : 2}>
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        size={isMobile ? "sm" : "xs"}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditTransaction(transaction);
                        }}
                      >
                        <IconEdit size={isMobile ? 14 : 12} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size={isMobile ? "sm" : "xs"}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(transaction.id);
                        }}
                      >
                        <IconTrash size={isMobile ? 14 : 12} />
                      </ActionIcon>
                    </Group>
                  </Group>
                </Group>
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