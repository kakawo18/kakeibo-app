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
  Checkbox,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from '@mantine/hooks';
import { useTransactions } from '@/hooks/useTransactions';
import { useTransactionTemplates } from '@/hooks/useTransactionTemplates';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS, Transaction, TransactionTemplate } from '@/types';
import { MobileCalendar } from '@/components/ui/MobileCalendar';

interface TransactionFormProps {
  opened: boolean;
  onClose: () => void;
  editingTransaction?: Transaction | null;
  selectedTemplate?: TransactionTemplate | null;
  templateOnlyMode?: boolean; // テンプレート専用モード
  initialDate?: Date; // カレンダーから選択された日付
}

export const TransactionForm: React.FC<TransactionFormProps> = ({
  opened,
  onClose,
  editingTransaction,
  selectedTemplate,
  templateOnlyMode = false,
  initialDate,
}) => {
  const { addTransaction, updateTransaction, transactions } = useTransactions();
  const { addTemplate } = useTransactionTemplates();
  const [loading, setLoading] = useState(false);
  const [mobileCalendarOpened, setMobileCalendarOpened] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  
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

    console.log('TransactionForm useEffect triggered on open:', {
      editingTransaction: !!editingTransaction,
      selectedTemplate: !!selectedTemplate,
      templateName: selectedTemplate?.name,
    });

    // 編集時: 既存情報を表示
    if (editingTransaction) {
      console.log('Setting form values for editing transaction:', editingTransaction);
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
    // テンプレート使用時: テンプレート値を設定
    else if (selectedTemplate) {
      console.log('Setting form values for template:', selectedTemplate);
      form.setValues({
        type: selectedTemplate.type,
        amount: selectedTemplate.amount ? selectedTemplate.amount.toString() : '',
        category: selectedTemplate.category,
        subcategory: selectedTemplate.subcategory || '',
        paymentMethod: selectedTemplate.paymentMethod || '',
        date: new Date(),
        description: selectedTemplate.description || '',
      });
    } 
    // 新規作成時: フォームをリセット
    else {
      console.log('Resetting form for new transaction');
      form.setValues({
        type: 'expense',
        amount: '',
        category: '',
        subcategory: '',
        paymentMethod: '',
        date: initialDate || new Date(), // カレンダーから選択された日付を使用
        description: '',
      });
    }
    // フォームのisDirtyフラグをリセット
    form.resetDirty();
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, editingTransaction, selectedTemplate]);

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
    // フォームバリデーション（テンプレート専用モードでは金額チェックを緩和）
    if (!templateOnlyMode && (!values.amount || Number(values.amount) <= 0)) {
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

      // テンプレート専用モードの場合は取引を追加せず、テンプレートのみ保存
      if (templateOnlyMode) {
        // テンプレート専用モード: テンプレートのみ保存
        const templateName = `${values.category}${values.subcategory ? ` - ${values.subcategory}` : ''}`;
        
        // テンプレートデータを構築（undefined値を除外）
        const templateData: Omit<TransactionTemplate, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'lastUsed' | 'usageCount'> = {
          name: templateName,
          type: values.type,
          category: values.category,
        };
        
        // 空文字列でない場合のみ追加
        if (values.subcategory && values.subcategory.trim()) {
          templateData.subcategory = values.subcategory.trim();
        }
        if (values.paymentMethod && values.paymentMethod.trim()) {
          templateData.paymentMethod = values.paymentMethod.trim();
        }
        if (values.description !== undefined) {
          templateData.description = values.description.trim() || '';
        }
        
        // 金額の適切な処理
        const amountValue = Number(values.amount);
        if (!isNaN(amountValue) && amountValue > 0) {
          templateData.amount = Math.floor(amountValue);
        }
        // 金額が0またはNaNの場合は、amountフィールドを含めない（undefined送信を回避）
        
        await addTemplate(templateData);
        
        onClose();
        
        // 成功通知
        notifications.show({
          title: '成功',
          message: 'テンプレートを作成しました',
          color: 'green',
        });
        return; // ここで処理終了
      }

      // 通常モード: 取引を追加
      if (editingTransaction) {
        await updateTransaction(editingTransaction.id, transactionData);
      } else {
        await addTransaction(transactionData);
      }

      onClose();
      
      // テンプレート保存処理（通常モードのみ）
      if (saveAsTemplate && !editingTransaction) {
        try {
          const templateName = `${values.category}${values.subcategory ? ` - ${values.subcategory}` : ''}`;
          
          // テンプレートデータを構築（undefined値を除外）
          const templateData: Omit<TransactionTemplate, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'lastUsed' | 'usageCount'> = {
            name: templateName,
            type: values.type,
            category: values.category,
          };
          
          // 空文字列でない場合のみ追加
          if (values.subcategory && values.subcategory.trim()) {
            templateData.subcategory = values.subcategory.trim();
          }
          if (values.paymentMethod && values.paymentMethod.trim()) {
            templateData.paymentMethod = values.paymentMethod.trim();
          }
          if (values.description !== undefined) {
            templateData.description = values.description.trim() || '';
          }
          
          // 金額の適切な処理
          const amountValue = Number(values.amount);
          if (!isNaN(amountValue) && amountValue > 0) {
            templateData.amount = Math.floor(amountValue);
          }
          // 金額が0またはNaNの場合は、amountフィールドを含めない（undefined送信を回避）
          
          await addTemplate(templateData);
          notifications.show({
            title: '成功',
            message: 'テンプレートとして保存しました',
            color: 'green',
          });
        } catch (error) {
          console.error('Error saving template:', error);
          notifications.show({
            title: 'エラー',
            message: 'テンプレートの保存に失敗しました',
            color: 'red',
          });
        }
      }

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
    console.log('TransactionForm closing');
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
      title={
        templateOnlyMode
          ? '新しいテンプレートを作成'
          : editingTransaction 
            ? '取引を編集' 
            : selectedTemplate 
              ? `${selectedTemplate.name} (テンプレート使用中)` 
              : '新しい取引を追加'
      }
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
            }}
          />

          <NumberInput
            label="金額"
            placeholder={templateOnlyMode ? "金額を入力（任意）" : "金額を入力"}
            min={0}
            required={!templateOnlyMode} // テンプレート専用モードでは金額は任意
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

          <Select
            label="カテゴリ"
            placeholder="カテゴリを選択"
            data={categories.map(cat => ({ value: cat.name, label: cat.name }))}
            required
            value={form.values.category}
            onChange={handleCategoryChange}
            styles={{
              input: {
                backgroundColor: selectedTemplate ? 'var(--mantine-color-gray-0)' : undefined,
                color: selectedTemplate ? 'var(--mantine-color-gray-7)' : undefined,
              }
            }}
          />

          {subcategories.length > 0 && (
            <Select
              label="サブカテゴリ"
              placeholder="サブカテゴリを選択（任意）"
              data={subcategories.map(sub => ({ value: sub, label: sub }))}
              {...form.getInputProps('subcategory')}
            />
          )}

          <Select
            label="支払方法"
            placeholder="支払方法を選択（任意）"
            data={PAYMENT_METHODS.map(method => ({ value: method, label: method }))}
            {...form.getInputProps('paymentMethod')}
            styles={{
              input: {
                backgroundColor: selectedTemplate ? 'var(--mantine-color-gray-0)' : undefined,
                color: selectedTemplate ? 'var(--mantine-color-gray-7)' : undefined,
              }
            }}
          />

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
          />

          {/* テンプレート保存チェックボックス（通常の新規作成時のみ） */}
          {!editingTransaction && !templateOnlyMode && (
            <Checkbox
              label="この取引をテンプレートとして保存する"
              checked={saveAsTemplate}
              onChange={(event) => setSaveAsTemplate(event.currentTarget.checked)}
            />
          )}

          <Group justify="flex-end">
            <Button variant="light" onClick={handleClose}>
              キャンセル
            </Button>
            <Button type="submit" loading={loading}>
              {templateOnlyMode ? 'テンプレート作成' : editingTransaction ? '更新' : '追加'}
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