'use client';

/**
 * 月間予算セクション
 *
 * 支出ペースチャートで使う月間予算を設定する。
 * 入力が止まってから少し待って自動保存する（デバウンス）。
 *
 * - 入力欄から離れたとき・画面を離れたときは待たずに保存する（#106）。
 *   以前は 600ms 以内にタブを移ると、保存されないまま変更が消えていた
 * - 保存中 / 保存しました / 失敗 を入力欄の下に出す
 * - 空欄・0 以下はエラーを出して保存しない。入力欄から離れると保存済みの値に戻す
 * - 入力していないあいだは保存済みの値（他の端末での変更を含む）をそのまま表示する
 */
import { useState } from 'react';
import { Paper, Text, NumberInput } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useSettings } from '@/contexts/SettingsContext';
import { validateAmount } from '@/utils/validation';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const STATUS_TEXT: Record<Exclude<SaveStatus, 'idle'>, string> = {
  saving: '保存中…',
  saved: '保存しました',
  error: '保存に失敗しました。もう一度入力してください',
};

export const BudgetSection = () => {
  const { settings, updateSettings } = useSettings();
  const savedBudget = settings?.monthlyBudget ?? 100000;

  // 入力中の値。null のあいだは保存済みの値を表示する
  const [draft, setDraft] = useState<number | string | null>(null);
  const [status, setStatus] = useState<SaveStatus>('idle');

  const save = useDebouncedCallback(
    async (budget: number) => {
      setStatus('saving');
      try {
        await updateSettings({ monthlyBudget: budget });
        setStatus('saved');
        // 保存した値のまま入力が止まっていれば、表示を保存済みの値に戻す
        setDraft((current) =>
          current !== null && Math.floor(Number(current)) === budget ? null : current
        );
      } catch {
        setStatus('error');
        notifications.show({
          title: 'エラー',
          message: '予算の保存に失敗しました。もう一度お試しください。',
          color: 'red',
        });
      }
    },
    // 画面を離れて入力欄が消えるときも、待たずに保存する
    { delay: 600, flushOnUnmount: true }
  );

  const value = draft ?? savedBudget;
  const inputError = draft === null ? null : validateAmount(draft);

  const handleChange = (newValue: number | string) => {
    setDraft(newValue);
    if (validateAmount(newValue)) {
      // 無効な値は保存しない。直前に予約した保存も取り消す（無効値を保存済みに見せない）
      save.cancel();
      setStatus('idle');
      return;
    }
    setStatus('idle');
    save(Math.floor(Number(newValue)));
  };

  const handleBlur = () => {
    if (inputError) {
      // 空欄のまま離れたら、保存済みの値に戻す
      setDraft(null);
      return;
    }
    save.flush();
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
        onBlur={handleBlur}
        min={1}
        step={1000}
        thousandSeparator=","
        prefix="¥ "
        allowDecimal={false}
        aria-label="月間予算"
        error={inputError}
      />
      {status !== 'idle' && !inputError && (
        <Text
          size="xs"
          mt={6}
          c={status === 'error' ? 'red' : 'dimmed'}
          role="status"
          aria-live="polite"
        >
          {STATUS_TEXT[status]}
        </Text>
      )}
    </Paper>
  );
};
