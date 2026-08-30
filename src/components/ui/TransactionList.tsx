'use client';

import { useMemo, useState } from 'react';
import {
  Text,
  Group,
  Stack,
  Paper,
  Box,
  Chip,
  SegmentedControl,
} from '@mantine/core';
import { Transaction } from '@/types';
import { TransactionRow } from '@/components/ui/TransactionRow';

interface TransactionListProps {
  transactions: Transaction[];
  onEditTransaction: (transaction: Transaction) => void;
}

/** 日付を「7月2日（火）」形式にフォーマット */
const formatDayHeader = (date: Date): string =>
  date.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });

/**
 * 取引履歴 — 日付グループ型の台帳リスト
 *
 * 【デザイン方針】
 * - モバイル/デスクトップで同一のリストデザイン（テーブル廃止）
 * - 日付ごとにグループ化し、日次合計を右肩に表示
 * - 行の描画は TransactionRow（カレンダーの日別内訳と共用）
 */
export const TransactionList: React.FC<TransactionListProps> = ({ transactions, onEditTransaction }) => {
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // 利用可能なカテゴリ（表示中の月の取引から）
  const availableCategories = useMemo(
    () =>
      Array.from(
        new Set(transactions.map(t => t.subcategory || t.category).filter(Boolean))
      ).sort(),
    [transactions]
  );

  // フィルター処理
  const filteredTransactions = useMemo(
    () =>
      transactions.filter((transaction) => {
        if (filterType !== 'all' && transaction.type !== filterType) return false;
        if (filterCategory !== 'all') {
          const transactionCategory = transaction.subcategory || transaction.category;
          if (transactionCategory !== filterCategory) return false;
        }
        return true;
      }),
    [transactions, filterType, filterCategory]
  );

  // 日付ごとにグループ化（新しい日付順、同日内は作成順を保持）
  const groupedByDay = useMemo(() => {
    const sorted = [...filteredTransactions].sort(
      (a, b) => b.date.getTime() - a.date.getTime()
    );
    const groups = new Map<string, { date: Date; items: Transaction[] }>();
    sorted.forEach((t) => {
      const key = `${t.date.getFullYear()}-${t.date.getMonth()}-${t.date.getDate()}`;
      if (!groups.has(key)) {
        groups.set(key, { date: t.date, items: [] });
      }
      groups.get(key)!.items.push(t);
    });
    return Array.from(groups.values());
  }, [filteredTransactions]);

  // フィルター後の合計
  const totals = useMemo(() => {
    const income = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    return { income, expense, balance: income - expense };
  }, [filteredTransactions]);


  return (
    <Paper className="ledger-card" p="lg">
      <Stack gap="md">
        {/* ヘッダー */}
        <Group justify="space-between" align="center">
          <Text className="section-title">取引履歴</Text>
          <SegmentedControl
            value={filterType}
            onChange={(v) => setFilterType(v as 'all' | 'income' | 'expense')}
            data={[
              { label: 'すべて', value: 'all' },
              { label: '収入', value: 'income' },
              { label: '支出', value: 'expense' },
            ]}
            size="xs"
            radius={8}
          />
        </Group>

        {/* カテゴリフィルターチップ */}
        {availableCategories.length > 0 && (
          <Group gap={6}>
            <Chip
              checked={filterCategory === 'all'}
              onChange={() => setFilterCategory('all')}
              size="xs"
              radius="xl"
              variant="light"
            >
              全カテゴリ
            </Chip>
            {availableCategories.map((category) => (
              <Chip
                key={category}
                checked={filterCategory === category}
                onChange={() =>
                  setFilterCategory(filterCategory === category ? 'all' : category)
                }
                size="xs"
                radius="xl"
                variant="light"
              >
                {category}
              </Chip>
            ))}
          </Group>
        )}

        {/* 日付グループ */}
        {groupedByDay.length === 0 ? (
          <Text ta="center" c="dimmed" py="xl" size="sm">
            取引がありません
          </Text>
        ) : (
          <Stack gap="sm">
            {groupedByDay.map(({ date, items }) => {
              const dayExpense = items
                .filter(t => t.type === 'expense')
                .reduce((s, t) => s + t.amount, 0);
              const dayIncome = items
                .filter(t => t.type === 'income')
                .reduce((s, t) => s + t.amount, 0);

              return (
                <Box key={date.toDateString()}>
                  {/* 日付ヘッダー */}
                  <Group
                    justify="space-between"
                    px={8}
                    pb={6}
                    style={{ borderBottom: '1px solid var(--hairline)' }}
                  >
                    <Text className="overline-label">
                      {formatDayHeader(date)}
                    </Text>
                    <Group gap="sm">
                      {dayIncome > 0 && (
                        <Text size="xs" className="tabular-nums amount-income" fw={600}>
                          +¥{dayIncome.toLocaleString()}
                        </Text>
                      )}
                      {dayExpense > 0 && (
                        <Text size="xs" className="tabular-nums" c="dimmed" fw={600}>
                          -¥{dayExpense.toLocaleString()}
                        </Text>
                      )}
                    </Group>
                  </Group>

                  {/* 取引行 */}
                  <Stack gap={0}>
                    {items.map((transaction) => (
                      <TransactionRow
                        key={transaction.id}
                        transaction={transaction}
                        onEdit={onEditTransaction}
                      />
                    ))}
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        )}

        {/* 合計フッター */}
        {filteredTransactions.length > 0 && (
          <Group justify="space-between" pt={4}>
            <Text size="xs" c="dimmed">
              {filteredTransactions.length}件を表示
            </Text>
            <Group gap="md">
              <Text size="xs" c="dimmed">
                収入 <Text component="span" fw={700} className="tabular-nums amount-income">
                  ¥{totals.income.toLocaleString()}
                </Text>
              </Text>
              <Text size="xs" c="dimmed">
                支出 <Text component="span" fw={700} className="tabular-nums">
                  ¥{totals.expense.toLocaleString()}
                </Text>
              </Text>
            </Group>
          </Group>
        )}
      </Stack>
    </Paper>
  );
};
