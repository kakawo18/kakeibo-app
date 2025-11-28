'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Button,
  Select,
  NumberInput,
  Stack,
  Group,
  SegmentedControl,
  Textarea,
  TextInput,
  NativeSelect,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from '@mantine/hooks';
import { useTransactions } from '@/hooks/useTransactions';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS, Transaction } from '@/types';
import { MobileCalendar } from '@/components/ui/MobileCalendar';

interface TransactionFormProps {
  opened: boolean;
  onClose: () => void;
  editingTransaction?: Transaction | null;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({
  opened,
  onClose,
  editingTransaction,
}) => {
  const { addTransaction, updateTransaction, transactions } = useTransactions();
  const [loading, setLoading] = useState(false);
  const [mobileCalendarOpened, setMobileCalendarOpened] = useState(false);
  
  // モバイル表示判定
  const isMobile = useMediaQuery('(max-width: 768px)');

  const form = useForm({
    initialValues: {
      type: 'expense' as 'income' | 'expense',
      amount: '',
      category: '',
      subcategory: '',
      paymentMethod: '',
      date: new Date(),
      description: '',
    },
  });

  // editingTransactionまたはselectedTemplateが変更された時にフォーム値を更新
  // モーダルが開いたタイミングで一度だけ実行
  useEffect(() => {
    if (!opened) return;

    // 編集時: 既存情報を表示
    if (editingTransaction) {
      form.setValues({
        type: editingTransaction.type,
        amount: editingTransaction.amount.toString(),
        category: editingTransaction.category,
        subcategory: editingTransaction.subcategory || '',
        paymentMethod: editingTransaction.paymentMethod || '',
        date: editingTransaction.date,
        description: editingTransaction.description || '',
      });
    } 
    // 新規作成時: フォームをリセット
    else {
      form.setValues({
        type: 'expense',
        amount: '',
        category: '',
        subcategory: '',
        paymentMethod: '',
        date: new Date(),
        description: '',
      });
    }
    // フォームのisDirtyフラグをリセット
    form.resetDirty();
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, editingTransaction]);

  // パフォーマンス最適化: カテゴリ関連の計算をメモ化
  // メモ欄入力でのフリーズ防止のため、dependencyを制限
  const categories = useMemo(() => {
    return form.values.type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  }, [form.values.type]);

  const subcategories = useMemo(() => {
    const selected = categories.find(cat => cat.name === form.values.category);
    return selected?.subcategories || [];
  }, [form.values.category, categories]);

  const handleSubmit = async (values: {
    type: 'income' | 'expense';
    amount: string | number;
    category: string;
    subcategory?: string;
    paymentMethod?: string;
    date: Date;
    description?: string;
  }) => {
    // フォームバリデーション
    if (!values.amount || Number(values.amount) <= 0) {
      notifications.show({
        title: '入力エラー',
        message: '正しい金額を入力してください',
        color: 'red',
      });
      return;
    }
    
    if (!values.category || values.category.trim() === '') {
      notifications.show({
        title: '入力エラー',
        message: 'カテゴリを選択してください',
        color: 'red',
      });
      return;
    }
    setLoading(true);
    try {
      // カード取引タイプの判定
      let transactionType: 'normal' | 'card_payment' | 'card_withdrawal' = 'normal';
      let affectsExpense = true;
      let affectsBalance = true;

      if (values.category === 'カード引き落とし') {
        // カード引き落としの場合
        transactionType = 'card_withdrawal';
        affectsExpense = false;
        affectsBalance = true;
      } else if (values.paymentMethod && values.paymentMethod !== '現金') {
        // カード支払いの場合
        transactionType = 'card_payment';
        affectsExpense = true;
        affectsBalance = false;
      }

      const transactionData: {
        type: 'income' | 'expense';
        amount: number;
        category: string;
        date: Date;
        transactionType: 'normal' | 'card_payment' | 'card_withdrawal';
        affectsExpense: boolean;
        affectsBalance: boolean;
        subcategory?: string;
        paymentMethod?: string;
        description?: string;
      } = {
        type: values.type as 'income' | 'expense',
        amount: Math.floor(Number(values.amount)), // 小数点切り捨て
        category: values.category,
        date: values.date,
        transactionType,
        affectsExpense,
        affectsBalance,
      };

      // 空文字列でない場合のみ追加
      if (values.subcategory && values.subcategory.trim()) {
        transactionData.subcategory = values.subcategory.trim();
      }
      if (values.paymentMethod && values.paymentMethod.trim()) {
        transactionData.paymentMethod = values.paymentMethod.trim();
      }
      // description は削除対応のため、値が存在する場合は常に設定
      if (values.description !== undefined) {
        transactionData.description = values.description.trim() || '';
      }

      // 取引を追加
      if (editingTransaction) {
        await updateTransaction(editingTransaction.id, transactionData);
      } else {
        await addTransaction(transactionData);
      }

      onClose();

      // 成功通知
      notifications.show({
        title: '成功',
        message: editingTransaction ? '取引を更新しました' : '取引を追加しました',
        color: 'green',
      });
    } catch (error) {
      console.error('Error saving transaction:', error);
      
      // エラー通知
      notifications.show({
        title: 'エラー',
        message: '取引の保存に失敗しました。もう一度お試しください。',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (category: string | null) => {
    form.setFieldValue('category', category || '');
    form.setFieldValue('subcategory', '');
  };

  const handleClose = () => {
    // モーダルが閉じられた時のクリーンアップ処理は useEffect で処理
    onClose();
  };

  const handleMobileDateInputClick = () => {
    if (isMobile) {
      setMobileCalendarOpened(true);
    }
  };

  const handleMobileCalendarChange = (date: Date) => {
    form.setFieldValue('date', date);
    setMobileCalendarOpened(false);
  };

  const formatDateForDisplay = (date: Date) => {
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
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
            {...form.getInputProps('type')}
            onChange={(value) => {
              form.setFieldValue('type', value as 'income' | 'expense');
              form.setFieldValue('category', '');
              form.setFieldValue('subcategory', '');
              // 収入に切り替えた場合は支払方法をクリア
              if (value === 'income') {
                form.setFieldValue('paymentMethod', '');
              }
            }}
            fullWidth
            size={isMobile ? 'md' : 'sm'}
            styles={{
              root: {
                backgroundColor: 'var(--mantine-color-dark-3)',
              },
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

          {/* 支払方法は支出の場合のみ表示 */}
          {form.values.type === 'expense' && (
            isMobile ? (
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
            )
          )}

          {isMobile ? (
            <TextInput
              label="日付"
              required
              value={formatDateForDisplay(form.values.date)}
              onClick={handleMobileDateInputClick}
              readOnly
              styles={{
                input: {
                  fontSize: '16px',
                  padding: '12px',
                  minHeight: '48px',
                  cursor: 'pointer',
                  backgroundColor: 'var(--mantine-color-gray-0)',
                },
                label: {
                  fontSize: '14px',
                  fontWeight: 500,
                }
              }}
            />
          ) : (
            <DateInput
              label="日付"
              required
              {...form.getInputProps('date')}
            />
          )}

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
            <Button variant="light" onClick={handleClose}>
              キャンセル
            </Button>
            <Button type="submit" loading={loading}>
              {editingTransaction ? '更新' : '追加'}
            </Button>
          </Group>
        </Stack>
      </form>
      
      {/* モバイル専用カレンダー */}
      <MobileCalendar
        opened={mobileCalendarOpened}
        onClose={() => setMobileCalendarOpened(false)}
        value={form.values.date}
        onChange={handleMobileCalendarChange}
        mode="select" // 選択モード（日付選択専用）
        transactions={transactions?.map(t => ({
          id: t.id,
          date: t.date,
          amount: t.amount,
          type: t.type,
          category: t.category,
          subcategory: t.subcategory,
          description: t.description
        })) || []}
      />
    </Modal>
  );
};