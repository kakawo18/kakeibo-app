'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Button,
  NumberInput,
  Stack,
  Group,
  Textarea,
  TextInput,
  Text,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from '@mantine/hooks';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, RecurringTransaction } from '@/types';
import { formatDateJa } from '@/utils/dateUtils';
import { ResponsiveSelect } from '@/components/forms/ResponsiveSelect';
import { getInputStyles } from '@/components/forms/formStyles';

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

/** 実行日を今月の日付に変換する（31日設定の2月など、月の日数を超える場合は月末日に丸める） */
const getExecutionDate = (dayOfMonth: number): Date => {
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return new Date(today.getFullYear(), today.getMonth(), Math.min(dayOfMonth, daysInMonth));
};

export const RecurringTransactionConfirm: React.FC<RecurringTransactionConfirmProps> = ({
  opened,
  onClose,
  transaction,
  onConfirm,
}) => {
  const [loading, setLoading] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const inputStyles = getInputStyles(isMobile ?? false);

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

  const subcategories = useMemo(() => {
    const selected = EXPENSE_CATEGORIES.find(cat => cat.name === form.values.category);
    return selected?.subcategories || [];
  }, [form.values.category]);

  const handleCategoryChange = (category: string) => {
    form.setFieldValue('category', category);
    form.setFieldValue('subcategory', '');
  };

  const handleSubmit = async (values: typeof form.values) => {
    if (!transaction) return;

    setLoading(true);
    try {
      const data = {
        amount: Math.floor(Number(values.amount)),
        category: values.category,
        subcategory: values.subcategory.trim() || undefined,
        paymentMethod: values.paymentMethod.trim() || undefined,
        date: getExecutionDate(transaction.dayOfMonth),
        description: values.description.trim() || undefined,
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
            styles={inputStyles}
          />

          <ResponsiveSelect
            label="カテゴリ"
            placeholder="カテゴリを選択"
            required
            data={EXPENSE_CATEGORIES.map(cat => ({ value: cat.name, label: cat.name }))}
            value={form.values.category}
            onChange={handleCategoryChange}
          />

          {subcategories.length > 0 && (
            <ResponsiveSelect
              label="サブカテゴリ"
              placeholder="サブカテゴリを選択（任意）"
              data={subcategories.map(sub => ({ value: sub, label: sub }))}
              {...form.getInputProps('subcategory')}
            />
          )}

          <ResponsiveSelect
            label="支払方法"
            placeholder="支払方法を選択（任意）"
            data={PAYMENT_METHODS.map(method => ({ value: method, label: method }))}
            {...form.getInputProps('paymentMethod')}
          />

          <TextInput
            label="日付"
            value={formatDateJa(getExecutionDate(transaction.dayOfMonth))}
            readOnly
            styles={{
              ...inputStyles,
              input: {
                ...inputStyles.input,
                backgroundColor: 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-6))',
                cursor: 'not-allowed',
              },
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
            styles={inputStyles}
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
