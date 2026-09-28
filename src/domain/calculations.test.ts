import { describe, expect, it } from 'vitest';
import { testRules as rules, tx } from '@/test/fixtures';
import {
  calculateCategoryChartData,
  calculateCategoryTrend,
  calculateDailyTotals,
  calculateMonthlyComparison,
  calculateMonthlyData,
} from '@/domain/calculations';


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
    expect(march.net).toBe(300_000 - 120_000);
  });

  it('取引の無い月を0で埋め、最後の月の翌月まで連続させる', () => {
    const data = calculateMonthlyData(
      [tx('2026-01-10', 'expense', 100, '食費'), tx('2026-04-10', 'expense', 200, '食費')],
      rules
    );
    expect(data.map((m) => m.month)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05']);
    expect(data[1]).toEqual({ month: '2026-02', income: 0, expense: 0, net: 0 });
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
    const chart = calculateCategoryChartData(transactions, 'expense', rules);
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
    month: '2026-03', income, expense, net: income - expense,
  });

  it('前月の収支がマイナスでも、改善したら上向きになる', () => {
    const result = calculateMonthlyComparison(month(100, 50), month(100, 150));
    expect(result.net.trend).toBe('up');
    expect(result.net.percentage).toBeGreaterThan(0);
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

describe('calculateDailyTotals（#100: カレンダーもホームと同じ除外ルール）', () => {
  const transactions = [
    tx('2026-03-05', 'expense', 1_000, '食費'),
    tx('2026-03-05', 'expense', 50_000, '投資'),
    tx('2026-03-05', 'expense', 3_000, '立替'),
    tx('2026-03-05', 'expense', 30_000, '食費', { affectsExpense: false, transactionType: 'card_withdrawal' }),
    tx('2026-03-05', 'income', 2_000, '立替回収'),
    tx('2026-03-05', 'income', 10_000, '給与'),
    tx('2026-03-06', 'expense', 500, '固定費', { subcategory: '積立NISA' }),
  ];

  it('投資・立替・支出除外フラグ・立替回収を除いて日ごとに集計する', () => {
    const totals = calculateDailyTotals(transactions, rules);
    expect(totals.get('2026-03-05')).toEqual({ income: 10_000, expense: 1_000 });
    expect(totals.get('2026-03-06')).toEqual({ income: 0, expense: 0 });
  });

  it('日ごとの合計は月次集計と一致する', () => {
    const totals = calculateDailyTotals(transactions, rules);
    const month = calculateMonthlyData(transactions, rules).find((m) => m.month === '2026-03')!;
    const sum = Array.from(totals.values()).reduce(
      (acc, t) => ({ income: acc.income + t.income, expense: acc.expense + t.expense }),
      { income: 0, expense: 0 }
    );
    expect(sum).toEqual({ income: month.income, expense: month.expense });
  });
});

describe('calculateCategoryTrend（#100 #118）', () => {
  it('取引の無い月も時系列に並べ、そのカテゴリの支出は0で埋める', () => {
    const trend = calculateCategoryTrend(
      [
        tx('2026-01-10', 'expense', 1_000, '食費'),
        tx('2026-04-10', 'expense', 2_000, '食費'),
        tx('2026-04-11', 'expense', 500, '交通費'),
      ],
      rules,
      '2026-04'
    );
    expect(trend.months.map((m) => m.month)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
    expect(trend.months[1].totals).toEqual({ 食費: 0, 交通費: 0 });
    expect(trend.months[0].totals).toEqual({ 食費: 1_000, 交通費: 0 });
    expect(trend.months[3].totals).toEqual({ 食費: 2_000, 交通費: 500 });
  });

  it('最後の取引から今月までの月も0で続ける（最新6ヶ月が本当に直近の6ヶ月になる）', () => {
    const trend = calculateCategoryTrend([tx('2026-01-10', 'expense', 1_000, '食費')], rules, '2026-03');
    expect(trend.months.map((m) => m.month)).toEqual(['2026-01', '2026-02', '2026-03']);
  });

  it('ホームの支出と同じ除外ルールで集計する（支出除外フラグ・投資・立替）', () => {
    const trend = calculateCategoryTrend(
      [
        tx('2026-03-01', 'expense', 1_000, '食費'),
        tx('2026-03-02', 'expense', 30_000, '食費', { affectsExpense: false }),
        tx('2026-03-03', 'expense', 50_000, '投資'),
        tx('2026-03-04', 'expense', 3_000, '立替'),
        tx('2026-03-05', 'expense', 600, '固定費', { subcategory: '積立NISA' }),
      ],
      rules,
      '2026-03'
    );
    expect(trend.categories).toEqual(['食費']);
    expect(trend.months[0].totals).toEqual({ 食費: 1_000 });
  });

  it('支出の多い順のカテゴリを返す（既定の選択に使う）', () => {
    const trend = calculateCategoryTrend(
      [
        tx('2026-03-01', 'expense', 100, '交通費'),
        tx('2026-03-01', 'expense', 300, '食費'),
        tx('2026-03-01', 'expense', 200, '固定費'),
      ],
      rules,
      '2026-03'
    );
    expect(trend.categoriesBySpending).toEqual(['食費', '固定費', '交通費']);
  });

  it('取引が無ければ空', () => {
    expect(calculateCategoryTrend([], rules, '2026-03').months).toEqual([]);
  });
});
