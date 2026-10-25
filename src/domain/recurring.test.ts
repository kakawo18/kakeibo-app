import { describe, expect, it } from 'vitest';
import { testRules, testSettings, tx } from '@/test/fixtures';
import { RecurringTransaction } from '@/types';
import { recurringRecordId, shouldShowRecurring, summarizeRecurring } from '@/domain/recurring';
import { createTransactionRules } from '@/domain/transactionRules';

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

describe('summarizeRecurring', () => {
  it('有効な定期取引だけを合計し、支出・投資・立替に分ける', () => {
    const summary = summarizeRecurring(
      [
        recurring({ id: 'rent', amount: 80_000 }),
        recurring({ id: 'nisa', name: 'つみたて', amount: 30_000, subcategory: '積立NISA' }),
        recurring({ id: 'invest', name: '投資信託', amount: 10_000, category: '投資', subcategory: undefined }),
        recurring({ id: 'advance', name: '親の携帯代', amount: 3_000, category: '立替', subcategory: undefined }),
        recurring({ id: 'gym', name: 'ジム', amount: 7_000, category: '食費', subcategory: undefined }),
        recurring({ id: 'off', name: '解約予定', amount: 1_000, category: '食費', subcategory: undefined, isEnabled: false }),
      ],
      testRules
    );

    expect(summary.total).toBe(130_000);
    expect(summary.expense).toBe(87_000);
    expect(summary.investment).toBe(40_000);
    expect(summary.other).toBe(3_000);
    expect(summary.count).toBe(5);
    expect(summary.disabledCount).toBe(1);
  });

  it('カテゴリごとの内訳は金額の大きい順で、カテゴリの中も金額の大きい順', () => {
    const summary = summarizeRecurring(
      [
        recurring({ id: 'a', name: 'サブスクA', amount: 1_000, category: '食費', subcategory: undefined }),
        recurring({ id: 'rent', amount: 80_000 }),
        recurring({ id: 'b', name: 'サブスクB', amount: 2_000, category: '食費', subcategory: undefined }),
        recurring({ id: 'nisa', name: 'つみたて', amount: 30_000, subcategory: '積立NISA' }),
      ],
      testRules
    );

    expect(summary.byCategory.map((c) => [c.category, c.total])).toEqual([
      ['固定費', 110_000],
      ['食費', 3_000],
    ]);
    expect(summary.byCategory[1].items.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('改名前のカテゴリ名で登録した定期取引も今の名前でまとめる（#97）', () => {
    const rules = createTransactionRules({
      ...testSettings,
      categories: testSettings.categories.map((c) =>
        c.id === 'fixed' ? { ...c, name: '住まい', aliases: ['固定費'] } : c
      ),
    });
    const summary = summarizeRecurring(
      [
        recurring({ id: 'old', amount: 80_000, category: '固定費' }),
        recurring({ id: 'new', name: '管理費', amount: 5_000, category: '住まい', subcategory: undefined }),
      ],
      rules
    );

    expect(summary.byCategory).toHaveLength(1);
    expect(summary.byCategory[0]).toMatchObject({ category: '住まい', total: 85_000 });
  });

  it('定期取引が無ければ 0', () => {
    expect(summarizeRecurring([], testRules)).toEqual({
      total: 0, expense: 0, investment: 0, other: 0, count: 0, disabledCount: 0, byCategory: [],
    });
  });
});
