'use client';

/**
 * 取引1件の行
 *
 * 履歴タブのリストと、カレンダーの日別内訳で共用する。
 * 同じ取引が場所によって違う見た目になるのを避けるため、行の描画はここに集約する。
 *
 * 行のクリックで編集、ゴミ箱で削除（確認ダイアログ付き）。
 */
import { ActionIcon, Badge, Box, Group, Text, useComputedColorScheme } from '@mantine/core';
import { IconCreditCard, IconTrash } from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { Transaction } from '@/types';
import { useSettings } from '@/contexts/SettingsContext';
import { useTransactions } from '@/contexts/TransactionsContext';

interface TransactionRowProps {
  transaction: Transaction;
  onEdit: (transaction: Transaction) => void;
}

export const TransactionRow: React.FC<TransactionRowProps> = ({ transaction, onEdit }) => {
  const { getColor } = useSettings();
  const { deleteTransaction } = useTransactions();
  const isDark = useComputedColorScheme('light', { getInitialValueInEffect: true }) === 'dark';

  const categoryLabel = transaction.subcategory
    ? `${transaction.category}・${transaction.subcategory}`
    : transaction.category;
  const dotColor = getColor(transaction.subcategory || transaction.category, isDark);

  const handleDelete = () => {
    modals.openConfirmModal({
      title: '取引を削除',
      children: <Text size="sm">この取引を削除しますか？この操作は取り消せません。</Text>,
      labels: { confirm: '削除', cancel: 'キャンセル' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deleteTransaction(transaction.id);
        } catch (error) {
          console.error('Error deleting transaction:', error);
          notifications.show({
            title: 'エラー',
            message: '削除に失敗しました。もう一度お試しください。',
            color: 'red',
          });
        }
      },
    });
  };

  return (
    <Group
      className="ledger-row"
      justify="space-between"
      wrap="nowrap"
      py={10}
      px={8}
      style={{ borderBottom: '1px solid var(--hairline)', cursor: 'pointer' }}
      onClick={() => onEdit(transaction)}
    >
      {/* 左: カテゴリ・メモ */}
      <Group gap={10} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
        <Box w={8} h={8} style={{ borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
        <Box style={{ minWidth: 0 }}>
          <Group gap={6} wrap="nowrap">
            <Text size="sm" fw={600} truncate>
              {categoryLabel}
            </Text>
            {transaction.transactionType === 'card_payment' && (
              <IconCreditCard
                size={13}
                style={{ color: 'var(--ink-3)', flexShrink: 0 }}
                aria-label="カード支払い"
              />
            )}
            {transaction.transactionType === 'card_withdrawal' && (
              <Badge size="xs" variant="light" color="gray" style={{ flexShrink: 0 }}>
                引落
              </Badge>
            )}
          </Group>
          {(transaction.description || transaction.paymentMethod) && (
            <Text size="xs" c="dimmed" truncate>
              {[transaction.description, transaction.paymentMethod].filter(Boolean).join(' · ')}
            </Text>
          )}
        </Box>
      </Group>

      {/* 右: 金額・削除 */}
      <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
        <Text
          size="sm"
          fw={700}
          className={`tabular-nums ${transaction.type === 'income' ? 'amount-income' : ''}`}
        >
          {transaction.type === 'income' ? '+' : '-'}¥{transaction.amount.toLocaleString()}
        </Text>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          aria-label="削除"
          onClick={(event) => {
            event.stopPropagation();
            handleDelete();
          }}
        >
          <IconTrash size={14} />
        </ActionIcon>
      </Group>
    </Group>
  );
};
