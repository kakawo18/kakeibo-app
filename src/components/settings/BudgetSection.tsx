'use client';

/**
 * 月間予算セクション
 *
 * 支出ペースチャートで使う月間予算を設定する。
 * 入力後、少し待ってから自動保存される(デバウンス)。
 */
import { useState } from 'react';
import { Paper, Text, NumberInput } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useSettings } from '@/contexts/SettingsContext';

export const BudgetSection = () => {
  const { settings, updateSettings } = useSettings();
  const [value, setValue] = useState<number | string>(settings?.monthlyBudget ?? 100000);

  const save = useDebouncedCallback(async (budget: number) => {
    try {
      await updateSettings({ monthlyBudget: budget });
    } catch {
      notifications.show({
        title: 'エラー',
        message: '予算の保存に失敗しました。もう一度お試しください。',
        color: 'red',
      });
    }
  }, 600);

  const handleChange = (newValue: number | string) => {
    setValue(newValue);
    const budget = Math.floor(Number(newValue));
    if (Number.isFinite(budget) && budget > 0) {
      save(budget);
    }
  };

  return (
    <Paper className="ledger-card" p="lg">
      <Text className="section-title" mb={4}>月間予算</Text>
      <Text size="xs" c="dimmed" mb="md">
        支出ペースチャートの基準になる1ヶ月の予算です
      </Text>
      <NumberInput
        value={value}
        onChange={handleChange}
        min={1}
        step={1000}
        thousandSeparator=","
        prefix="¥ "
        allowDecimal={false}
        aria-label="月間予算"
      />
    </Paper>
  );
};
