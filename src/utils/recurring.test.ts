import { describe, expect, it } from 'vitest';
import { tx } from '@/test/fixtures';
import { RecurringTransaction } from '@/types';
import { recurringRecordId, shouldShowRecurring } from '@/utils/recurring';

const recurring = (fields: Partial<RecurringTransaction> = {}): RecurringTransaction => ({
  id: 'rent',
  userId: 'u',
  name: '家賃',
  amount: 80_000,
  category: '固定費',
  subcategory: '家賃',
  dayOfMonth: 27,
  isEnabled: true,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  ...fields,
});

const TODAY = new Date(2026, 8, 28, 12); // 2026-09-28

describe('shouldShowRecurring（#101）', () => {
  it('実行日前は出さない', () => {
    expect(shouldShowRecurring(recurring(), [], new Date(2026, 8, 26, 12))).toBe(false);
    expect(shouldShowRecurring(recurring(), [], TODAY)).toBe(true);
  });

  it('31日設定は短い月では月末日から出す', () => {
    const r = recurring({ dayOfMonth: 31 });
    expect(shouldShowRecurring(r, [], new Date(2026, 8, 29, 12))).toBe(false);
    expect(shouldShowRecurring(r, [], new Date(2026, 8, 30, 12))).toBe(true);
    expect(shouldShowRecurring(r, [], new Date(2026, 1, 28, 12))).toBe(true);
  });

  it('記録時に金額・メモ・カテゴリを直しても、同じ月には再び出さない', () => {
    const recorded = tx('2026-09-27', 'expense', 81_234, '食費', {
      description: '今月は請求額が違った',
      recurringTransactionId: 'rent',
      recurringMonth: '2026-09',
    });
    expect(shouldShowRecurring(recurring(), [recorded], TODAY)).toBe(false);
  });

  it('記録した取引の日付を別の月に動かしても、記録済みの月は変わらない', () => {
    const recorded = tx('2026-10-01', 'expense', 80_000, '固定費', {
      recurringTransactionId: 'rent',
      recurringMonth: '2026-09',
    });
    expect(shouldShowRecurring(recurring(), [recorded], TODAY)).toBe(false);
  });

  it('同名・同額の別の定期取引を記録しても、こちらは記録済みにならない', () => {
    const other = tx('2026-09-27', 'expense', 80_000, '固定費', {
      subcategory: '家賃',
      description: '家賃',
      recurringTransactionId: 'rent-parking',
      recurringMonth: '2026-09',
    });
    expect(shouldShowRecurring(recurring(), [other], TODAY)).toBe(true);
  });

  it('先月の記録はこちらの月の記録にならない', () => {
    const lastMonth = tx('2026-08-27', 'expense', 80_000, '固定費', {
      recurringTransactionId: 'rent',
      recurringMonth: '2026-08',
    });
    expect(shouldShowRecurring(recurring(), [lastMonth], TODAY)).toBe(true);
  });

  it('記録した取引を削除すれば、また記録できる（通知に戻る）', () => {
    expect(shouldShowRecurring(recurring(), [], TODAY)).toBe(true);
  });

  describe('ID を持たない古い記録（互換）', () => {
    it('今月・カテゴリ・金額が一致し、メモに名前を含めば記録済み', () => {
      const legacy = tx('2026-09-27', 'expense', 80_000, '固定費', {
        subcategory: '家賃',
        description: '家賃',
      });
      expect(shouldShowRecurring(recurring(), [legacy], TODAY)).toBe(false);
    });

    it('ID を持つ取引は、名前・金額が一致しても古い記録の判定に使わない', () => {
      const withId = tx('2026-09-27', 'expense', 80_000, '固定費', {
        subcategory: '家賃',
        description: '家賃',
        recurringTransactionId: 'another',
        recurringMonth: '2026-09',
      });
      expect(shouldShowRecurring(recurring(), [withId], TODAY)).toBe(true);
    });
  });
});

describe('recurringRecordId', () => {
  it('定期取引と対象月から決まる（複数端末で同時に記録しても1件になる）', () => {
    expect(recurringRecordId('rent', '2026-09')).toBe('recurring-rent-2026-09');
    expect(recurringRecordId('rent', '2026-09')).toBe(recurringRecordId('rent', '2026-09'));
  });
});
