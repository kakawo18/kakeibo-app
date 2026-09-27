import { describe, expect, it } from 'vitest';
import { testRules as rules, tx } from '@/test/fixtures';
import {
  calculateCategoryChartData,
  calculateMonthlyComparison,
  calculateMonthlyData,
} from '@/utils/calculations';

const color = () => 'x';

describe('calculateMonthlyData', () => {
  const transactions = [
    tx('2026-03-25', 'income', 300_000, '給与', { subcategory: '給料' }),
    tx('2026-03-26', 'income', 5_000, '立替回収'),
    tx('2026-03-05', 'expense', 40_000, '食費', { paymentMethod: '楽天カード', transactionType: 'card_payment' }),
    tx('2026-03-06', 'expense', 80_000, '固定費', { subcategory: '家賃' }),
    tx('2026-03-10', 'expense', 50_000, '投資'),
    tx('2026-03-11', 'expense', 30_000, '固定費', { subcategory: '積立NISA' }),
    tx('2026-03-12', 'expense', 5_000, '立替'),
    // 過去の「カード引き落とし」: 購入月に計上済みなので二重に数えない
    tx('2026-03-27', 'expense', 99_999, '食費', { affectsExpense: false, transactionType: 'card_withdrawal' }),
  ];

  it('収入は立替回収を、支出は投資・立替・affectsExpense=false を除いて集計する', () => {
    const march = calculateMonthlyData(transactions, rules).find((m) => m.month === '2026-03')!;
    expect(march.income).toBe(300_000);
    // カード払いは購入月の支出に入る
    expect(march.expense).toBe(40_000 + 80_000);
    expect(march.balance).toBe(300_000 - 120_000);
  });

  it('取引の無い月を0で埋め、最後の月の翌月まで連続させる', () => {
    const data = calculateMonthlyData(
      [tx('2026-01-10', 'expense', 100, '食費'), tx('2026-04-10', 'expense', 200, '食費')],
      rules
    );
    expect(data.map((m) => m.month)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05']);
    expect(data[1]).toEqual({ month: '2026-02', income: 0, expense: 0, balance: 0 });
  });

  it('年をまたいでも月が連続する', () => {
    const data = calculateMonthlyData(
      [tx('2025-12-31', 'expense', 100, '食費'), tx('2026-01-01', 'expense', 200, '食費')],
      rules
    );
    expect(data.map((m) => m.month)).toEqual(['2025-12', '2026-01', '2026-02']);
    expect(data[0].expense).toBe(100);
    expect(data[1].expense).toBe(200);
  });
});

describe('calculateCategoryChartData', () => {
  it('支出サマリーと同じ除外ルールで集計し、合計を一致させる', () => {
    const transactions = [
      tx('2026-03-05', 'expense', 60_000, '食費'),
      tx('2026-03-06', 'expense', 40_000, '固定費', { subcategory: '家賃' }),
      tx('2026-03-10', 'expense', 50_000, '投資'),
      tx('2026-03-11', 'expense', 1_000, '食費', { affectsExpense: false }),
    ];
    const chart = calculateCategoryChartData(transactions, 'expense', rules, color);
    // サブカテゴリがあればサブカテゴリ名で集計する
    expect(chart.map((c) => [c.name, c.value, c.percentage])).toEqual([
      ['食費', 60_000, 60],
      ['家賃', 40_000, 40],
    ]);
    const monthly = calculateMonthlyData(transactions, rules)[0];
    expect(chart.reduce((sum, c) => sum + c.value, 0)).toBe(monthly.expense);
  });
});

describe('calculateMonthlyComparison', () => {
  const month = (income: number, expense: number) => ({
    month: '2026-03', income, expense, balance: income - expense,
  });

  it('前月の収支がマイナスでも、改善したら上向きになる', () => {
    const result = calculateMonthlyComparison(month(100, 50), month(100, 150));
    expect(result.balance.trend).toBe('up');
    expect(result.balance.percentage).toBeGreaterThan(0);
  });

  it('前月が0なら ±100% / 変化なしは0%', () => {
    expect(calculateMonthlyComparison(month(100, 0), month(0, 0)).income.percentage).toBe(100);
    expect(calculateMonthlyComparison(month(0, 0), month(0, 0)).income).toEqual({
      value: 0, percentage: 0, trend: 'same',
    });
  });

  it('前月データが無ければ0として比較する', () => {
    expect(calculateMonthlyComparison(month(100, 0), undefined).income.trend).toBe('up');
  });
});
