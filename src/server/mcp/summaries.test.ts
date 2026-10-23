import { describe, expect, it } from 'vitest';
import { testRules, testSettings, tx } from '@/test/fixtures';
import { RecurringTransaction, UserSettings } from '@/types';
import { calculateAnnualSummaries, calculateMonthlyDetail } from '@/domain/annualSummary';
import { calculateMonthlyData } from '@/domain/calculations';
import {
  buildAnnualReview,
  buildMonthlySummary,
  buildOverview,
  buildRecurringList,
  buildSearchResult,
  buildTrend,
} from '@/server/mcp/summaries';

// 「食費」を以前は「食料品」と呼んでいた設定（改名の読み替え #97 を確かめる）
const renamedSettings: UserSettings = {
  ...testSettings,
  categories: testSettings.categories.map((c) => (c.name === '食費' ? { ...c, aliases: ['食料品'] } : c)),
};

describe('buildOverview', () => {
  it('カテゴリ・役割・以前の名前・今日の日付を返す', () => {
    const overview = buildOverview(
      renamedSettings,
      { first: new Date(2024, 3, 1), last: new Date(2026, 9, 20) },
      new Date(2026, 9, 22, 9)
    );

    expect(overview.today).toBe('2026-10-22');
    expect(overview.recordedPeriod).toEqual({ first: '2024-04-01', last: '2026-10-20' });
    expect(overview.categories.find((c) => c.name === '食費')).toMatchObject({ formerNames: ['食料品'] });
    expect(overview.categories.find((c) => c.name === '固定費')?.subcategories).toContainEqual({
      name: '積立NISA',
      roles: ['investment'],
    });
    expect(overview.roleDescriptions.investment).toContain('支出から除き');
  });

  it('取引が無ければ recordedPeriod は null', () => {
    expect(buildOverview(testSettings, null, new Date(2026, 9, 22)).recordedPeriod).toBeNull();
  });
});

describe('buildSearchResult', () => {
  const march = { from: new Date(2026, 2, 1), to: new Date(2026, 2, 31), sort: 'date_desc' as const, limit: 50 };
  const transactions = [
    tx('2026-03-05', 'expense', 580, '食費', { subcategory: '外食', description: 'ローソン', paymentMethod: '現金' }),
    tx('2026-03-06', 'expense', 1_200, '食料品', { description: 'スーパー' }),
    tx('2026-03-10', 'expense', 50_000, '投資'),
    tx('2026-03-11', 'expense', 30_000, '固定費', { subcategory: '積立NISA' }),
    tx('2026-03-25', 'income', 300_000, '給与', { subcategory: '給料' }),
  ];

  it('改名前の名前で記録された取引も、今の名前で絞り込めて今の名前で返る', () => {
    const result = buildSearchResult(transactions, renamedSettings, { ...march, categories: ['食費'] });

    expect(result.transactions.map((t) => t.amount)).toEqual([1_200, 580]);
    expect(result.transactions.every((t) => t.category === '食費')).toBe(true);
  });

  it('サブカテゴリ名でも絞り込める', () => {
    const result = buildSearchResult(transactions, testSettings, { ...march, categories: ['積立NISA'] });

    expect(result.transactions.map((t) => t.amount)).toEqual([30_000]);
  });

  it('キーワードは全角と半角・大文字と小文字を区別しない', () => {
    const withLatin = [tx('2026-03-07', 'expense', 900, '食費', { description: 'Amazon ﾀｲﾑｾｰﾙ' })];

    expect(buildSearchResult(withLatin, testSettings, { ...march, keyword: 'ＡＭＡＺＯＮ' }).matchedCount).toBe(1);
    expect(buildSearchResult(withLatin, testSettings, { ...march, keyword: 'タイムセール' }).matchedCount).toBe(1);
  });

  it('totals は件数の上限で切る前の全件の合計。投資は countedExpense に入らない', () => {
    const result = buildSearchResult(transactions, testSettings, { ...march, type: 'expense', limit: 1 });

    expect(result.matchedCount).toBe(4);
    expect(result.returnedCount).toBe(1);
    expect(result.truncated).toBe(true);
    expect(result.totals).toEqual({ income: 0, expense: 81_780, countedIncome: 0, countedExpense: 1_780 });
  });

  it('金額の大きい順に並べられ、集計に入るかを取引ごとに返す', () => {
    const result = buildSearchResult(transactions, testSettings, { ...march, sort: 'amount_desc', type: 'expense' });

    expect(result.transactions.map((t) => [t.amount, t.countedInTotals])).toEqual([
      [50_000, false],
      [30_000, false],
      [1_200, true],
      [580, true],
    ]);
  });

  it('金額の範囲と支払方法で絞り込める', () => {
    expect(buildSearchResult(transactions, testSettings, { ...march, minAmount: 1_000, maxAmount: 40_000 }).matchedCount).toBe(2);
    expect(buildSearchResult(transactions, testSettings, { ...march, paymentMethods: ['現金'] }).matchedCount).toBe(1);
  });
});

describe('buildMonthlySummary', () => {
  const transactions = [
    tx('2026-02-10', 'expense', 60_000, '食費'),
    tx('2026-02-25', 'income', 280_000, '給与'),
    tx('2026-03-05', 'expense', 40_000, '食費', { paymentMethod: '楽天カード', transactionType: 'card_payment' }),
    tx('2026-03-06', 'expense', 80_000, '固定費', { subcategory: '家賃' }),
    tx('2026-03-10', 'expense', 50_000, '投資'),
    tx('2026-03-25', 'income', 300_000, '給与', { subcategory: '給料' }),
  ];
  const summary = buildMonthlySummary(transactions, testSettings, '2026-03', new Date(2026, 5, 1));

  it('収入・支出・収支はホームと同じ calculateMonthlyData の値', () => {
    const march = calculateMonthlyData(transactions, testRules).find((m) => m.month === '2026-03')!;

    expect(summary).toMatchObject({ income: march.income, expense: march.expense, net: march.net });
    expect(summary.expense).toBe(120_000);
    expect(summary.investment).toBe(50_000);
  });

  it('予算の比較は支出ペース除外（家賃）を外す', () => {
    expect(summary.budget).toEqual({
      monthlyBudget: 100_000,
      paceExpense: 40_000,
      usageRate: 40,
      excludedFromBudget: ['固定費 / 家賃'],
    });
  });

  it('前月の値と増減率を返す', () => {
    expect(summary.previousMonth).toMatchObject({ month: '2026-02', income: 280_000, expense: 60_000, net: 220_000 });
    expect(summary.previousMonth.changePercent.expense).toBe(100);
  });

  it('カテゴリ別の合計は支出と一致し、カード還元も返す', () => {
    expect(summary.expenseByCategory.reduce((sum, c) => sum + c.amount, 0)).toBe(summary.expense);
    expect(summary.cardRewards).toMatchObject({ totalAmount: 40_000, totalPoints: 400 });
  });

  it('取引の無い月は0で返す', () => {
    const empty = buildMonthlySummary([], testSettings, '2026-03', new Date(2026, 5, 1));

    expect(empty).toMatchObject({ income: 0, expense: 0, net: 0, investment: 0 });
  });
});

describe('buildTrend', () => {
  const transactions = [
    tx('2026-01-10', 'expense', 10_000, '食費'),
    tx('2026-01-12', 'expense', 80_000, '固定費', { subcategory: '家賃' }),
    tx('2026-03-10', 'expense', 20_000, '食料品'),
    tx('2026-03-11', 'expense', 50_000, '投資'),
  ];

  it('取引の無い月も0で並べ、改名前の名前を今の名前でまとめる', () => {
    const trend = buildTrend(transactions, renamedSettings, '2026-01', '2026-04');

    expect(trend.months.map((m) => [m.month, m.expense, m.investment])).toEqual([
      ['2026-01', 90_000, 0],
      ['2026-02', 0, 0],
      ['2026-03', 20_000, 50_000],
      ['2026-04', 0, 0],
    ]);
    expect(trend.months[2].expenseByCategory).toEqual({ 食費: 20_000 });
    expect(trend.categoriesBySpending).toEqual(['固定費', '食費']);
  });

  it('カテゴリを指定するとその内訳だけを返す', () => {
    const trend = buildTrend(transactions, testSettings, '2026-01', '2026-01', ['食費']);

    expect(trend.months[0].expenseByCategory).toEqual({ 食費: 10_000 });
    expect(trend.months[0].expense).toBe(90_000);
  });
});

describe('buildAnnualReview', () => {
  const transactions = [
    tx('2025-06-25', 'income', 250_000, '給与'),
    tx('2025-06-10', 'expense', 30_000, '食費'),
    tx('2026-06-25', 'income', 300_000, '給与'),
    tx('2026-06-10', 'expense', 45_000, '食費'),
    tx('2026-06-11', 'expense', 60_000, '投資'),
  ];

  it('振り返りタブと同じ年間の値と、前年比を返す', () => {
    const review = buildAnnualReview(transactions, testSettings, 2026);
    const expected = calculateAnnualSummaries(transactions, testRules).find((s) => s.year === 2026)!;

    expect(review).toMatchObject({
      hasData: true,
      salaryIncome: expected.salaryIncome,
      expense: 45_000,
      investment: 60_000,
      remaining: expected.remaining,
      estimatedGrossSalary: expected.estimatedGross,
    });
    expect(review.monthly).toEqual(calculateMonthlyDetail(transactions, 2026, testRules));
    expect(review.expenseByCategoryVsPreviousYear).toContainEqual({
      name: '食費', current: 45_000, previous: 30_000, diff: 15_000, rate: 50,
    });
  });

  it('取引の無い年は hasData が false', () => {
    expect(buildAnnualReview(transactions, testSettings, 2020).hasData).toBe(false);
  });
});

describe('buildRecurringList', () => {
  const rent: RecurringTransaction = {
    id: 'rent', userId: 'test-user', name: '家賃', amount: 80_000, category: '固定費',
    subcategory: '家賃', dayOfMonth: 27, isEnabled: true, createdAt: new Date(0), updatedAt: new Date(0),
  };
  const gym: RecurringTransaction = { ...rent, id: 'gym', name: 'ジム', amount: 8_000, category: '食費', subcategory: undefined };

  it('今月記録済みかを返す', () => {
    const recorded = tx('2026-10-27', 'expense', 80_000, '固定費', {
      recurringTransactionId: 'rent', recurringMonth: '2026-10',
    });

    const list = buildRecurringList([rent, gym], [recorded], '2026-10');

    expect(list.recurring.map((r) => [r.name, r.recordedThisMonth])).toEqual([
      ['家賃', true],
      ['ジム', false],
    ]);
  });
});
