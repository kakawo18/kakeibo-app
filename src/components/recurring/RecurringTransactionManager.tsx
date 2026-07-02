'use client';

import { useState } from 'react';
import {
  Modal,
  Button,
  Stack,
  Card,
  Text,
  Group,
  ActionIcon,
  Switch,
  Badge,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useRecurringTransactions } from '@/hooks/useRecurringTransactions';
import { RecurringTransactionForm } from './RecurringTransactionForm';
import { RecurringTransaction } from '@/types';

interface RecurringTransactionManagerProps {
  opened: boolean;
  onClose: () => void;
}

export const RecurringTransactionManager: React.FC<RecurringTransactionManagerProps> = ({
  opened,
  onClose,
}) => {
  const {
    recurringTransactions,
    loading,
    addRecurringTransaction,
    updateRecurringTransaction,
    deleteRecurringTransaction,
  } = useRecurringTransactions();

  const [formOpened, setFormOpened] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<RecurringTransaction | null>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const handleAdd = () => {
    setEditingTransaction(null);
    setFormOpened(true);
  };

  const handleEdit = (transaction: RecurringTransaction) => {
    setEditingTransaction(transaction);
    setFormOpened(true);
  };

  const handleDelete = (transaction: RecurringTransaction) => {
    modals.openConfirmModal({
      title: '定期取引を削除',
      children: (
        <Text size="sm">
          「{transaction.name}」を削除してもよろしいですか？この操作は取り消せません。
        </Text>
      ),
      labels: { confirm: '削除', cancel: 'キャンセル' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deleteRecurringTransaction(transaction.id);
          notifications.show({
            title: '成功',
            message: '定期取引を削除しました',
            color: 'green',
          });
        } catch (error) {
          console.error('Error deleting recurring transaction:', error);
          notifications.show({
            title: 'エラー',
            message: '削除に失敗しました。もう一度お試しください。',
            color: 'red',
          });
        }
      },
    });
  };

  const handleToggleEnabled = async (transaction: RecurringTransaction) => {
    try {
      await updateRecurringTransaction(transaction.id, {
        isEnabled: !transaction.isEnabled,
      });
    } catch (error) {
      console.error('Error toggling recurring transaction:', error);
      notifications.show({
        title: 'エラー',
        message: '更新に失敗しました。もう一度お試しください。',
        color: 'red',
      });
    }
  };

  const handleSave = async (data: Omit<RecurringTransaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (editingTransaction) {
      await updateRecurringTransaction(editingTransaction.id, data);
    } else {
      await addRecurringTransaction(data);
    }
    setFormOpened(false);
    setEditingTransaction(null);
  };

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title="定期取引の管理"
        size={isMobile ? 'full' : 'lg'}
        fullScreen={isMobile}
        radius={isMobile ? 0 : undefined}
      >
        <Stack>
          {loading ? (
            <Text ta="center">読み込み中...</Text>
          ) : recurringTransactions.length === 0 ? (
            <Text ta="center" c="dimmed">
              定期取引が登録されていません
            </Text>
          ) : (
            recurringTransactions.map((transaction) => (
              <Card key={transaction.id} withBorder p="md">
                <Stack gap="sm">
                  <Group justify="space-between" align="flex-start">
                    <div style={{ flex: 1 }}>
                      <Group gap="xs" mb="xs">
                        <Text fw={600} size="lg">
                          {transaction.name}
                        </Text>
                        {!transaction.isEnabled && (
                          <Badge color="gray" size="sm">
                            無効
                          </Badge>
                        )}
                      </Group>
                      <Text size="sm" c="dimmed" mb="xs">
                        ¥{transaction.amount.toLocaleString()} | 毎月{transaction.dayOfMonth}日
                      </Text>
                      <Text size="sm" c="dimmed">
                        {transaction.category}
                        {transaction.subcategory && ` > ${transaction.subcategory}`}
                        {' | '}
                        {transaction.paymentMethod || '未設定'}
                      </Text>
                    </div>
                    <Group gap="xs">
                      <ActionIcon
                        variant="light"
                        color="blue"
                        onClick={() => handleEdit(transaction)}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="light"
                        color="red"
                        onClick={() => handleDelete(transaction)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>
                      有効/無効
                    </Text>
                    <Switch
                      checked={transaction.isEnabled}
                      onChange={() => handleToggleEnabled(transaction)}
                    />
                  </Group>
                </Stack>
              </Card>
            ))
          )}

          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleAdd}
            fullWidth
          >
            新しい定期取引を追加
          </Button>
        </Stack>
      </Modal>

      <RecurringTransactionForm
        opened={formOpened}
        onClose={() => {
          setFormOpened(false);
          setEditingTransaction(null);
        }}
        editingTransaction={editingTransaction}
        onSave={handleSave}
      />
    </>
  );
};
