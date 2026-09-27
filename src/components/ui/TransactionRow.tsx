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
import { pressable } from '@/components/ui/pressable';

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
      gap={0}
      style={{ borderBottom: '1px solid var(--hairline)' }}
    >
      {/* 編集する部分（カテゴリ・メモ・金額）と削除ボタンを兄弟に分ける。
          行全体を押せるようにしたまま中に削除ボタンを入れると、ボタンが入れ子になり
          読み上げ・キーボードで区別できず、誤って押しやすかった（#111） */}
      <Group
        gap={10}
        wrap="nowrap"
        justify="space-between"
        py={10}
        pl={8}
        pr={4}
        style={{ minWidth: 0, flex: 1, cursor: 'pointer' }}
        {...pressable(
          () => onEdit(transaction),
          `${categoryLabel} ${transaction.type === 'income' ? '+' : '-'}${transaction.amount.toLocaleString()}円を編集`
        )}
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
            {/* 役割を廃止したので新規には付かない。過去の取引を説明するために残している */}
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

      {/* 右: 金額 */}
      <Text
        size="sm"
        fw={700}
        className={`tabular-nums ${transaction.type === 'income' ? 'amount-income' : ''}`}
        style={{ flexShrink: 0 }}
      >
        {transaction.type === 'income' ? '+' : '-'}¥{transaction.amount.toLocaleString()}
      </Text>
      </Group>

      {/* 削除。編集部分とは別のボタンにし、タップ領域も広げる */}
      <ActionIcon
        variant="subtle"
        color="gray"
        size={40}
        aria-label={`${categoryLabel} ${transaction.amount.toLocaleString()}円を削除`}
        onClick={handleDelete}
        style={{ flexShrink: 0 }}
      >
        <IconTrash size={16} />
      </ActionIcon>
    </Group>
  );
};
