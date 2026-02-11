'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Button,
  Select,
  NumberInput,
  Stack,
  Group,
  Textarea,
  TextInput,
  NativeSelect,
  Text,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from '@mantine/hooks';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, RecurringTransaction } from '@/types';

interface RecurringTransactionConfirmProps {
  opened: boolean;
  onClose: () => void;
  transaction: RecurringTransaction | null;
  onConfirm: (data: {
    amount: number;
    category: string;
    subcategory?: string;
    paymentMethod?: string;
    date: Date;
    description?: string;
  }) => Promise<void>;
}

export const RecurringTransactionConfirm: React.FC<RecurringTransactionConfirmProps> = ({
  opened,
  onClose,
  transaction,
  onConfirm,
}) => {
  const [loading, setLoading] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const form = useForm({
    initialValues: {
      amount: '',
      category: '',
      subcategory: '',
      paymentMethod: '',
      description: '',
    },
  });

  useEffect(() => {
    if (!opened || !transaction) return;

    form.setValues({
      amount: transaction.amount.toString(),
      category: transaction.category,
      subcategory: transaction.subcategory || '',
      paymentMethod: transaction.paymentMethod || '',
      // メモの初期値として定期取引名を設定
      description: transaction.name || '',
    });
    form.resetDirty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, transaction]);

  const categories = useMemo(() => EXPENSE_CATEGORIES, []);

  const subcategories = useMemo(() => {
    const selected = categories.find(cat => cat.name === form.values.category);
    return selected?.subcategories || [];
  }, [form.values.category, categories]);

  const handleCategoryChange = (category: string | null) => {
    form.setFieldValue('category', category || '');
    form.setFieldValue('subcategory', '');
  };

  const getExecutionDate = () => {
    if (!transaction) return new Date();
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), transaction.dayOfMonth);
  };

  const formatDateForDisplay = (date: Date) => {
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  };

  const handleSubmit = async (values: typeof form.values) => {
    if (!transaction) return;

    setLoading(true);
    try {
      const data = {
        amount: Math.floor(Number(values.amount)),
        category: values.category,
        subcategory: values.subcategory && values.subcategory.trim() ? values.subcategory.trim() : undefined,
        paymentMethod: values.paymentMethod && values.paymentMethod.trim() ? values.paymentMethod.trim() : undefined,
        date: getExecutionDate(),
        description: values.description && values.description.trim() ? values.description.trim() : undefined,
      };

      await onConfirm(data);
      onClose();

      notifications.show({
        title: '成功',
        message: '取引を記録しました',
        color: 'green',
      });
    } catch (error) {
      console.error('Error recording transaction:', error);
      notifications.show({
        title: 'エラー',
        message: '記録に失敗しました。もう一度お試しください。',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!transaction) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`${transaction.name}を記録`}
      size={isMobile ? 'full' : 'lg'}
      fullScreen={isMobile}
      radius={isMobile ? 0 : undefined}
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          <NumberInput
            label="金額"
            placeholder="金額を入力"
            min={0}
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

          <TextInput
            label="日付"
            value={formatDateForDisplay(getExecutionDate())}
            readOnly
            styles={{
              input: {
                fontSize: isMobile ? '16px' : undefined,
                padding: isMobile ? '12px' : undefined,
                minHeight: isMobile ? '48px' : undefined,
                backgroundColor: 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-6))',
                cursor: 'not-allowed',
              },
              label: {
                fontSize: isMobile ? '14px' : undefined,
                fontWeight: 500,
              }
            }}
          />
          <Text size="xs" c="dimmed" mt={-8}>
            ※ 実行日（{transaction.dayOfMonth}日）で記録されます
          </Text>

          <Textarea
            label="メモ（任意）"
            placeholder="メモを入力"
            {...form.getInputProps('description')}
            autosize
            minRows={isMobile ? 2 : 3}
            maxRows={isMobile ? 4 : 6}
            styles={{
              input: {
                fontSize: isMobile ? '16px' : undefined,
                padding: isMobile ? '12px' : undefined,
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
              記録する
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};
