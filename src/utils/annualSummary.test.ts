import { describe, expect, it } from 'vitest';
import { testRules as rules, tx } from '@/test/fixtures';
import {
  calculateAnnualSummaries,
  calculateCategoryYoY,
  calculateCumulativeInvestment,
  calculateMonthlyDetail,
  getAvailableYears,
} from '@/utils/annualSummary';

const transactions = [
  tx('2025-06-25', 'income', 250_000, '給与', { subcategory: '給料' }),
  tx('2025-06-10', 'expense', 50_000, '食費'),
  tx('2026-01-25', 'income', 300_000, '給与', { subcategory: '給料' }),
  tx('2026-06-30', 'income', 500_000, '給与', { subcategory: '賞与' }),
  tx('2026-03-01', 'income', 20_000, 'その他', { subcategory: '配当収入' }),
  tx('2026-03-02', 'income', 8_000, '立替回収'),
  tx('2026-02-10', 'expense', 70_000, '食費'),
  tx('2026-02-11', 'expense', 100_000, '投資'),
  tx('2026-02-12', 'expense', 60_000, '固定費', { subcategory: '積立NISA' }),
  tx('2026-02-13', 'expense', 8_000, '立替'),
  tx('2026-02-14', 'expense', 9_999, '食費', { affectsExpense: false }),
];

describe('getAvailableYears', () => {
  it('取引のある年を新しい順に返す', () => {
    expect(getAvailableYears(transactions)).toEqual([2026, 2025]);
  });
});

describe('calculateAnnualSummaries', () => {
  const [y2025, y2026] = calculateAnnualSummaries(transactions, rules);

  it('給与とそれ以外の収入を分け、立替回収は収入に含めない', () => {
    expect(y2026.salaryIncome).toBe(800_000);
    expect(y2026.otherIncome).toBe(20_000);
    expect(y2026.netIncome).toBe(820_000);
  });

  it('投資は支出と別枠で集計する（カテゴリの役割でもサブカテゴリの役割でも）', () => {
    expect(y2026.investment).toBe(160_000);
    expect(y2026.expense).toBe(70_000);
  });

  it('手元に残った額 = 手取り − 支出 − 投資、貯蓄率 = 投資 ÷ 給与', () => {
    expect(y2026.balance).toBe(820_000 - 70_000 - 160_000);
    expect(y2026.savingsRate).toBeCloseTo((160_000 / 800_000) * 100);
  });

  it('額面の内訳を足すと額面に一致する', () => {
    const { deductions, estimatedGross, salaryIncome } = y2026;
    expect(
      salaryIncome + deductions.socialInsurance + deductions.incomeTax + deductions.residentTax
    ).toBe(estimatedGross);
  });

  it('古い年から順に返す', () => {
    expect(y2025.year).toBe(2025);
    expect(y2025.expense).toBe(50_000);
  });
});

describe('calculateMonthlyDetail', () => {
  it('1〜12月を必ず返し、取引の無い月は0', () => {
    const detail = calculateMonthlyDetail(transactions, 2026, rules);
    expect(detail).toHaveLength(12);
    expect(detail[1]).toEqual({
      month: '2026-02', income: 0, expense: 70_000, investment: 160_000, balance: -230_000,
    });
    expect(detail[11]).toEqual({ month: '2026-12', income: 0, expense: 0, investment: 0, balance: 0 });
  });
});

describe('calculateCategoryYoY', () => {
  it('差の大きい順に並べ、前年0なら増減率は null', () => {
    const entries = calculateCategoryYoY(
      [
        tx('2025-05-01', 'expense', 100_000, '食費'),
        tx('2026-05-01', 'expense', 40_000, '食費'),
        tx('2026-05-02', 'expense', 10_000, '固定費', { subcategory: '家賃' }),
        tx('2026-05-03', 'expense', 999_999, '投資'),
      ],
      2026,
      rules
    );
    expect(entries).toEqual([
      { name: '食費', current: 40_000, previous: 100_000, diff: -60_000, rate: -60 },
      { name: '家賃', current: 10_000, previous: 0, diff: 10_000, rate: null },
    ]);
  });
});

describe('calculateCumulativeInvestment（#118）', () => {
  it('投資しない月も時系列に並べ、累計は直前の値を保つ', () => {
    const data = calculateCumulativeInvestment(
      [
        tx('2026-01-10', 'expense', 10_000, '投資'),
        tx('2026-04-10', 'expense', 20_000, '固定費', { subcategory: '積立NISA' }),
        tx('2026-02-10', 'expense', 999, '食費'),
      ],
      rules,
      '2026-05'
    );
    expect(data).toEqual([
      { month: '2026-01', cumulative: 10_000 },
      { month: '2026-02', cumulative: 10_000 },
      { month: '2026-03', cumulative: 10_000 },
      { month: '2026-04', cumulative: 30_000 },
      { month: '2026-05', cumulative: 30_000 },
    ]);
  });

  it('投資が無ければ空', () => {
    expect(calculateCumulativeInvestment([tx('2026-01-10', 'expense', 1, '食費')], rules, '2026-05')).toEqual([]);
  });
});
