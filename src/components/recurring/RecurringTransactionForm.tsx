'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Button,
  Select,
  NumberInput,
  Stack,
  Group,
  TextInput,
  NativeSelect,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from '@mantine/hooks';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, RecurringTransaction } from '@/types';

interface RecurringTransactionFormProps {
  opened: boolean;
  onClose: () => void;
  editingTransaction?: RecurringTransaction | null;
  onSave: (data: Omit<RecurringTransaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

export const RecurringTransactionForm: React.FC<RecurringTransactionFormProps> = ({
  opened,
  onClose,
  editingTransaction,
  onSave,
}) => {
  const [loading, setLoading] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const form = useForm({
    initialValues: {
      name: '',
      amount: '',
      category: '',
      subcategory: '',
      paymentMethod: '',
      dayOfMonth: '',
      isEnabled: true,
    },
    validate: {
      name: (value) => (!value || value.trim() === '' ? '名前を入力してください' : null),
      amount: (value) => {
        const num = Number(value);
        if (!value || num <= 0) return '金額は1円以上を入力してください';
        return null;
      },
      category: (value) => (!value || value.trim() === '' ? 'カテゴリを選択してください' : null),
      dayOfMonth: (value) => {
        const num = Number(value);
        if (!value || num < 1 || num > 31) return '実行日は1〜31の範囲で入力してください';
        return null;
      },
    },
  });

  useEffect(() => {
    if (!opened) return;

    if (editingTransaction) {
      form.setValues({
        name: editingTransaction.name,
        amount: editingTransaction.amount.toString(),
        category: editingTransaction.category,
        subcategory: editingTransaction.subcategory || '',
        paymentMethod: editingTransaction.paymentMethod || '',
        dayOfMonth: editingTransaction.dayOfMonth.toString(),
        isEnabled: editingTransaction.isEnabled,
      });
    } else {
      form.reset();
    }
    form.resetDirty();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, editingTransaction]);

  const categories = useMemo(() => EXPENSE_CATEGORIES, []);

  const subcategories = useMemo(() => {
    const selected = categories.find(cat => cat.name === form.values.category);
    return selected?.subcategories || [];
  }, [form.values.category, categories]);

  const handleCategoryChange = (category: string | null) => {
    form.setFieldValue('category', category || '');
    form.setFieldValue('subcategory', '');
  };

  const handleSubmit = async (values: typeof form.values) => {
    setLoading(true);
    try {
      const data: Omit<RecurringTransaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
        name: values.name.trim(),
        amount: Math.floor(Number(values.amount)),
        category: values.category,
        dayOfMonth: Number(values.dayOfMonth),
        isEnabled: values.isEnabled,
      };

      if (values.subcategory && values.subcategory.trim()) {
        data.subcategory = values.subcategory.trim();
      }
      if (values.paymentMethod && values.paymentMethod.trim()) {
        data.paymentMethod = values.paymentMethod.trim();
      }

      await onSave(data);
      onClose();

      notifications.show({
        title: '成功',
        message: editingTransaction ? '定期取引を更新しました' : '定期取引を作成しました',
        color: 'green',
      });
    } catch (error) {
      console.error('Error saving recurring transaction:', error);
      notifications.show({
        title: 'エラー',
        message: '保存に失敗しました。もう一度お試しください。',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={editingTransaction ? '定期取引を編集' : '新しい定期取引を追加'}
      size={isMobile ? 'full' : 'lg'}
      fullScreen={isMobile}
      radius={isMobile ? 0 : undefined}
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          <TextInput
            label="名前"
            placeholder="例: 家賃、投資（積立NISA）"
            required
            {...form.getInputProps('name')}
            styles={{
              input: {
                fontSize: isMobile ? '16px' : undefined,
                padding: isMobile ? '12px' : undefined,
                minHeight: isMobile ? '48px' : undefined,
              },
              label: {
                fontSize: isMobile ? '14px' : undefined,
                fontWeight: 500,
              }
            }}
          />

          <NumberInput
            label="金額"
            placeholder="金額を入力"
            min={1}
            required
            {...form.getInputProps('amount')}
            styles={{
              input: {
                fontSize: isMobile ? '16px' : undefined,
                padding: isMobile ? '12px' : undefined,
                minHeight: isMobile ? '48px' : undefined,
              },
              label: {
                fontSize: isMobile ? '14px' : undefined,
                fontWeight: 500,
              }
            }}
          />

          {isMobile ? (
            <NativeSelect
              label="カテゴリ"
              required
              value={form.values.category}
              onChange={(event) => handleCategoryChange(event.currentTarget.value)}
              data={[
                { value: '', label: 'カテゴリを選択', disabled: true },
                ...categories.map(cat => ({ value: cat.name, label: cat.name }))
              ]}
              styles={{
                input: {
                  fontSize: '16px',
                  padding: '12px',
                  minHeight: '48px',
                },
                label: {
                  fontSize: '14px',
                  fontWeight: 500,
                }
              }}
            />
          ) : (
            <Select
              label="カテゴリ"
              placeholder="カテゴリを選択"
              data={categories.map(cat => ({ value: cat.name, label: cat.name }))}
              required
              value={form.values.category}
              onChange={handleCategoryChange}
              searchable
            />
          )}

          {subcategories.length > 0 && (
            isMobile ? (
              <NativeSelect
                label="サブカテゴリ"
                {...form.getInputProps('subcategory')}
                data={[
                  { value: '', label: 'サブカテゴリを選択（任意）' },
                  ...subcategories.map(sub => ({ value: sub, label: sub }))
                ]}
                styles={{
                  input: {
                    fontSize: '16px',
                    padding: '12px',
                    minHeight: '48px',
                  },
                  label: {
                    fontSize: '14px',
                    fontWeight: 500,
                  }
                }}
              />
            ) : (
              <Select
                label="サブカテゴリ"
                placeholder="サブカテゴリを選択（任意）"
                data={subcategories.map(sub => ({ value: sub, label: sub }))}
                {...form.getInputProps('subcategory')}
                searchable
              />
            )
          )}

          {isMobile ? (
            <NativeSelect
              label="支払方法"
              {...form.getInputProps('paymentMethod')}
              data={[
                { value: '', label: '支払方法を選択（任意）' },
                ...PAYMENT_METHODS.map(method => ({ value: method, label: method }))
              ]}
              styles={{
                input: {
                  fontSize: '16px',
                  padding: '12px',
                  minHeight: '48px',
                },
                label: {
                  fontSize: '14px',
                  fontWeight: 500,
                }
              }}
            />
          ) : (
            <Select
              label="支払方法"
              placeholder="支払方法を選択（任意）"
              data={PAYMENT_METHODS.map(method => ({ value: method, label: method }))}
              {...form.getInputProps('paymentMethod')}
              searchable
            />
          )}

          <NumberInput
            label="実行日"
            placeholder="1〜31"
            min={1}
            max={31}
            required
            {...form.getInputProps('dayOfMonth')}
            styles={{
              input: {
                fontSize: isMobile ? '16px' : undefined,
                padding: isMobile ? '12px' : undefined,
                minHeight: isMobile ? '48px' : undefined,
              },
              label: {
                fontSize: isMobile ? '14px' : undefined,
                fontWeight: 500,
              }
            }}
          />

          <Group justify="flex-end">
            <Button variant="light" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" loading={loading}>
              {editingTransaction ? '更新' : '作成'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};
