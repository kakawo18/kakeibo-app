import { describe, expect, it } from 'vitest';
import { testRules as rules, tx } from '@/test/fixtures';
import { calculateBudgetUsage, isCountedInBudget } from '@/domain/budget';

describe('isCountedInBudget', () => {
  it('支出の共通の除外（投資・立替・affectsExpense = false）と支出ペース除外を外す', () => {
    expect(isCountedInBudget(tx('2026-03-05', 'expense', 1_000, '食費'), rules)).toBe(true);
    expect(isCountedInBudget(tx('2026-03-05', 'expense', 1_000, '投資'), rules)).toBe(false);
    expect(isCountedInBudget(tx('2026-03-05', 'expense', 1_000, '固定費', { subcategory: '積立NISA' }), rules)).toBe(false);
    expect(isCountedInBudget(tx('2026-03-05', 'expense', 1_000, '立替'), rules)).toBe(false);
    expect(isCountedInBudget(tx('2026-03-05', 'expense', 1_000, '食費', { affectsExpense: false }), rules)).toBe(false);
    expect(isCountedInBudget(tx('2026-03-05', 'expense', 1_000, '固定費', { subcategory: '家賃' }), rules)).toBe(false);
    expect(isCountedInBudget(tx('2026-03-05', 'income', 1_000, '給与'), rules)).toBe(false);
  });
});

describe('calculateBudgetUsage（ホームの支出ペースと同じ数え方）', () => {
  const transactions = [
    tx('2026-03-01', 'expense', 10_000, '食費'),
    tx('2026-03-31', 'expense', 20_000, '食費', { subcategory: '外食' }),
    tx('2026-03-06', 'expense', 80_000, '固定費', { subcategory: '家賃' }),
    tx('2026-03-10', 'expense', 50_000, '投資'),
    tx('2026-02-28', 'expense', 9_999, '食費'),
    tx('2026-04-01', 'expense', 9_999, '食費'),
    tx('2026-03-25', 'income', 300_000, '給与'),
  ];

  it('過去の月は月末までの、予算の対象になる支出を合計する', () => {
    const usage = calculateBudgetUsage(transactions, '2026-03', 100_000, rules, new Date(2026, 5, 1));
    expect(usage).toEqual({ paceExpense: 30_000, usageRate: 30 });
  });

  it('今月は今日までの支出だけを数える（先の日付の取引はまだ数えない）', () => {
    const usage = calculateBudgetUsage(transactions, '2026-03', 100_000, rules, new Date(2026, 2, 15, 9));
    expect(usage.paceExpense).toBe(10_000);
  });

  it('予算が0なら使用率は0', () => {
    expect(calculateBudgetUsage(transactions, '2026-03', 0, rules, new Date(2026, 5, 1)).usageRate).toBe(0);
  });
});
