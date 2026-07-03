'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Button,
  NumberInput,
  Stack,
  Group,
  SegmentedControl,
  Textarea,
  TextInput,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from '@mantine/hooks';
import { useTransactions } from '@/contexts/TransactionsContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Transaction, TransactionKind } from '@/types';
import { formatDateJa } from '@/utils/dateUtils';
import { MobileCalendar } from '@/components/ui/MobileCalendar';
import { ResponsiveSelect } from './ResponsiveSelect';
import { getInputStyles, getTextareaStyles } from './formStyles';

interface TransactionFormProps {
  opened: boolean;
  onClose: () => void;
  editingTransaction?: Transaction | null;
}

interface TransactionFormValues {
  type: TransactionKind;
  amount: string | number;
  category: string;
  subcategory: string;
  paymentMethod: string;
  date: Date;
  description: string;
}

const emptyValues: TransactionFormValues = {
  type: 'expense',
  amount: '',
  category: '',
  subcategory: '',
  paymentMethod: '',
  date: new Date(),
  description: '',
};

export const TransactionForm: React.FC<TransactionFormProps> = ({
  opened,
  onClose,
  editingTransaction,
}) => {
  const { addTransaction, updateTransaction, transactions } = useTransactions();
  const { expenseCategories, incomeCategories, paymentMethods, rules } = useSettings();
  const [loading, setLoading] = useState(false);
  const [mobileCalendarOpened, setMobileCalendarOpened] = useState(false);

  // モバイル表示判定
  const isMobile = useMediaQuery('(max-width: 768px)');
  const inputStyles = getInputStyles(isMobile ?? false);
  const textareaStyles = getTextareaStyles(isMobile ?? false);

  // uncontrolledモードでは form.values が再レンダリングをトリガーしないため、
  // 画面内で直接参照する項目（種別・カテゴリ・日付）のみローカルstateで管理する
  const [selectedType, setSelectedType] = useState<TransactionKind>('expense');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const form = useForm<TransactionFormValues>({
    // controlledモードだと金額・メモの1文字入力ごとにフォーム全体が再レンダリングされ、
    // スマホ(PWA)など描画が遅延する環境で入力イベントに追いつかず数字が重複することがあるため、
    // uncontrolledモードにして入力欄の再レンダリングを避ける
    mode: 'uncontrolled',
    initialValues: emptyValues,
    validate: {
      amount: (value) => (!value || Number(value) <= 0 ? '正しい金額を入力してください' : null),
      category: (value) => (!value || value.trim() === '' ? 'カテゴリを選択してください' : null),
    },
  });

  // モーダルが開いたタイミングでフォーム値を初期化する
  // （編集時は既存の取引内容を、新規作成時は空の値をセット）
  useEffect(() => {
    if (!opened) return;

    const values: TransactionFormValues = editingTransaction
      ? {
          type: editingTransaction.type,
          amount: editingTransaction.amount.toString(),
          category: editingTransaction.category,
          subcategory: editingTransaction.subcategory || '',
          paymentMethod: editingTransaction.paymentMethod || '',
          date: editingTransaction.date,
          description: editingTransaction.description || '',
        }
      : { ...emptyValues, date: new Date() };

    form.setValues(values);
    setSelectedType(values.type);
    setSelectedCategory(values.category);
    setSelectedDate(values.date);
    form.resetDirty();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, editingTransaction]);

  const categories = useMemo(() => {
    return selectedType === 'expense' ? expenseCategories : incomeCategories;
  }, [selectedType, expenseCategories, incomeCategories]);

  // 編集時: 設定から削除されたカテゴリ/サブカテゴリ/支払方法でも
  // 現在の値が選択肢から消えないよう、選択肢の末尾に注入する
  const categoryOptions = useMemo(() => {
    const options = categories.map(cat => ({ value: cat.name, label: cat.name }));
    const current = editingTransaction?.category;
    if (
      current &&
      editingTransaction.type === selectedType &&
      !options.some(o => o.value === current)
    ) {
      options.push({ value: current, label: current });
    }
    return options;
  }, [categories, editingTransaction, selectedType]);

  const subcategoryOptions = useMemo(() => {
    const selected = categories.find(cat => cat.name === selectedCategory);
    const options = (selected?.subcategories ?? []).map(sub => ({ value: sub.name, label: sub.name }));
    const current = editingTransaction?.subcategory;
    if (
      current &&
      editingTransaction.category === selectedCategory &&
      !options.some(o => o.value === current)
    ) {
      options.push({ value: current, label: current });
    }
    return options;
  }, [selectedCategory, categories, editingTransaction]);

  const paymentMethodOptions = useMemo(() => {
    const options = paymentMethods.map(method => ({ value: method.name, label: method.name }));
    const current = editingTransaction?.paymentMethod;
    if (current && !options.some(o => o.value === current)) {
      options.push({ value: current, label: current });
    }
    return options;
  }, [paymentMethods, editingTransaction]);

  const handleSubmit = async (values: TransactionFormValues) => {
    setLoading(true);
    try {
      const transactionData = {
        type: values.type,
        amount: Math.floor(Number(values.amount)), // 小数点切り捨て
        category: values.category,
        date: values.date,
        // カテゴリ・支払方法から取引タイプと集計フラグを導出
        ...rules.deriveTransactionFlags(values.category, values.paymentMethod),
        // 空文字列でない場合のみ設定
        subcategory: values.subcategory.trim() || undefined,
        paymentMethod: values.paymentMethod.trim() || undefined,
        // description は空文字列での削除に対応するため常に設定
        description: values.description.trim(),
      };

      if (editingTransaction) {
        await updateTransaction(editingTransaction.id, transactionData);
      } else {
        await addTransaction(transactionData);
      }

      onClose();

      notifications.show({
        title: '成功',
        message: editingTransaction ? '取引を更新しました' : '取引を追加しました',
        color: 'green',
      });
    } catch (error) {
      console.error('Error saving transaction:', error);

      notifications.show({
        title: 'エラー',
        message: '取引の保存に失敗しました。もう一度お試しください。',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (value: string) => {
    const type = value as TransactionKind;
    form.setFieldValue('type', type);
    form.setFieldValue('category', '');
    form.setFieldValue('subcategory', '');
    setSelectedType(type);
    setSelectedCategory('');
    // 収入に切り替えた場合は支払方法をクリア
    if (type === 'income') {
      form.setFieldValue('paymentMethod', '');
    }
  };

  const handleCategoryChange = (category: string) => {
    form.setFieldValue('category', category);
    form.setFieldValue('subcategory', '');
    setSelectedCategory(category);
  };

  const handleMobileCalendarChange = (date: Date) => {
    form.setFieldValue('date', date);
    setSelectedDate(date);
    setMobileCalendarOpened(false);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={editingTransaction ? '取引を編集' : '新しい取引を追加'}
      size={isMobile ? 'full' : 'lg'}
      fullScreen={isMobile}
      radius={isMobile ? 0 : undefined}
      styles={{
        body: {
          padding: isMobile ? '16px' : undefined,
        },
        content: {
          maxWidth: isMobile ? '100vw' : undefined,
        }
      }}
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          <SegmentedControl
            data={[
              { label: '支出', value: 'expense' },
              { label: '収入', value: 'income' },
            ]}
            key={form.key('type')}
            {...form.getInputProps('type')}
            onChange={handleTypeChange}
            fullWidth
            size={isMobile ? 'md' : 'sm'}
            radius={10}
            styles={{
              label: {
                fontSize: isMobile ? '16px' : undefined,
                padding: isMobile ? '12px' : undefined,
                minHeight: isMobile ? '48px' : undefined,
              }
            }}
          />

          <NumberInput
            label="金額"
            placeholder="金額を入力"
            min={0}
            required
            key={form.key('amount')}
            {...form.getInputProps('amount')}
            styles={inputStyles}
          />

          <ResponsiveSelect
            label="カテゴリ"
            placeholder="カテゴリを選択"
            required
            data={categoryOptions}
            value={selectedCategory}
            onChange={handleCategoryChange}
            error={form.errors.category}
          />

          {subcategoryOptions.length > 0 && (
            <ResponsiveSelect
              label="サブカテゴリ"
              placeholder="サブカテゴリを選択（任意）"
              data={subcategoryOptions}
              key={form.key('subcategory')}
              {...form.getInputProps('subcategory')}
            />
          )}

          {/* 支払方法は支出の場合のみ表示 */}
          {selectedType === 'expense' && (
            <ResponsiveSelect
              label="支払方法"
              placeholder="支払方法を選択（任意）"
              data={paymentMethodOptions}
              key={form.key('paymentMethod')}
              {...form.getInputProps('paymentMethod')}
            />
          )}

          {isMobile ? (
            <TextInput
              label="日付"
              required
              value={formatDateJa(selectedDate)}
              onClick={() => setMobileCalendarOpened(true)}
              readOnly
              styles={{
                ...inputStyles,
                input: {
                  ...inputStyles.input,
                  cursor: 'pointer',
                  backgroundColor: 'var(--app-surface-2)',
                },
              }}
            />
          ) : (
            <DateInput
              label="日付"
              required
              key={form.key('date')}
              {...form.getInputProps('date')}
            />
          )}

          <Textarea
            label="メモ（任意）"
            placeholder="メモを入力"
            key={form.key('description')}
            {...form.getInputProps('description')}
            autosize
            minRows={isMobile ? 2 : 3}
            maxRows={isMobile ? 4 : 6}
            styles={textareaStyles}
          />

          <Group justify="flex-end">
            <Button variant="light" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" loading={loading}>
              {editingTransaction ? '更新' : '追加'}
            </Button>
          </Group>
        </Stack>
      </form>

      {/* モバイル専用カレンダー（選択モード） */}
      <MobileCalendar
        opened={mobileCalendarOpened}
        onClose={() => setMobileCalendarOpened(false)}
        value={selectedDate}
        onChange={handleMobileCalendarChange}
        isSelector
        transactions={transactions}
      />
    </Modal>
  );
};
