/**
 * Claude 連携のツールが返す結果を組み立てる（docs/claude-connector/仕様書.md 6章）
 *
 * Firestore を読まない純関数だけを置く（読み出しは tools.ts、検証は summaries.test.ts）。
 * 集計の規則は画面と同じにするため、createTransactionRules と src/domain の関数を使い、
 * ここに独自の足し算の規則を書かない。カテゴリ名は rules で今の名前に読み替える（#97）。
 */
import {
  CategoryRole,
  RecurringTransaction,
  SubcategorySetting,
  Transaction,
  TransactionKind,
  UserSettings,
} from '@/types';
import { TransactionRules, createTransactionRules } from '@/domain/transactionRules';
import {
  calculateCategoryChartData,
  calculateCategoryTrend,
  calculateMonthlyComparison,
  calculateMonthlyData,
} from '@/domain/calculations';
import {
  calculateAnnualSummaries,
  calculateCategoryYoY,
  calculateMonthlyDetail,
} from '@/domain/annualSummary';
import { calculateBudgetUsage } from '@/domain/budget';
import { calculateMonthlyCardRewards } from '@/domain/cardRewards';
import { isRecurringRecorded } from '@/domain/recurring';
import { formatDate, formatMonthLocal, getPreviousMonthFromCurrent, monthRange } from '@/utils/dateUtils';

/** 割合を小数1桁に丸める */
const round1 = (value: number): number => Math.round(value * 10) / 10;

// ============================================================
// get_kakeibo_overview
// ============================================================

/** 役割の意味（Claude が集計の前提を理解するための説明） */
export const ROLE_DESCRIPTIONS: Record<CategoryRole, string> = {
  salary_income: '給与収入。貯蓄率の分母と額面年収の推定に使う',
  investment: '投資。支出から除き、投資額として別に集計する',
  advance_payment: '立替金。支出から除く',
  advance_repayment: '立替回収。収入から除く',
  exclude_from_pace: '支出ペース除外。月間予算との比較から除く（家賃など毎月一定の支出）',
};

const settingMeta = (setting: { aliases?: string[]; archived?: boolean }) => ({
  ...(setting.aliases?.length ? { formerNames: setting.aliases } : {}),
  ...(setting.archived ? { archived: true } : {}),
});

const describeSubcategory = (sub: SubcategorySetting) => ({
  name: sub.name,
  roles: sub.roles,
  ...settingMeta(sub),
});

export const buildOverview = (
  settings: UserSettings,
  period: { first: Date; last: Date } | null,
  today: Date
) => ({
  today: formatDate(today),
  recordedPeriod: period ? { first: formatDate(period.first), last: formatDate(period.last) } : null,
  monthlyBudget: settings.monthlyBudget,
  categories: settings.categories.map((category) => ({
    name: category.name,
    type: category.type,
    roles: category.roles,
    subcategories: category.subcategories.map(describeSubcategory),
    ...settingMeta(category),
  })),
  paymentMethods: settings.paymentMethods.map((method) => ({
    name: method.name,
    isCash: method.isCash,
    rewardRate: method.rewardRate,
  })),
  roleDescriptions: ROLE_DESCRIPTIONS,
});

// ============================================================
// search_transactions
// ============================================================

export type SearchSort = 'date_desc' | 'date_asc' | 'amount_desc';

export interface SearchParams {
  /** この日を含む（0時） */
  from: Date;
  /** この日を含む（0時） */
  to: Date;
  type?: TransactionKind;
  /** 今のカテゴリ名またはサブカテゴリ名 */
  categories?: string[];
  paymentMethods?: string[];
  keyword?: string;
  minAmount?: number;
  maxAmount?: number;
  sort: SearchSort;
  limit: number;
}

/** 部分一致の比較用。全角と半角・英字の大文字と小文字をそろえる */
const normalize = (value: string): string => value.normalize('NFKC').toLowerCase();

/** 集計（収入・支出）に含まれる取引か */
const isCounted = (t: Transaction, rules: TransactionRules): boolean =>
  t.type === 'expense' ? !rules.isExcludedFromExpense(t) : !rules.isExcludedFromIncome(t);

export const buildSearchResult = (
  transactions: Transaction[],
  settings: UserSettings,
  params: SearchParams
) => {
  const rules = createTransactionRules(settings);
  const categories = params.categories?.length ? new Set(params.categories) : undefined;
  const paymentMethods = params.paymentMethods?.length ? new Set(params.paymentMethods) : undefined;
  const keyword = params.keyword ? normalize(params.keyword) : undefined;

  const matched = transactions.filter((t) => {
    if (params.type && t.type !== params.type) return false;
    if (params.minAmount !== undefined && t.amount < params.minAmount) return false;
    if (params.maxAmount !== undefined && t.amount > params.maxAmount) return false;
    if (paymentMethods && !(t.paymentMethod && paymentMethods.has(t.paymentMethod))) return false;
    const category = rules.categoryName(t);
    const subcategory = rules.subcategoryName(t);
    if (categories && !categories.has(category) && !(subcategory && categories.has(subcategory))) {
      return false;
    }
    if (keyword) {
      // 改名前の名前（t.category）でも引けるようにする
      const haystack = [t.description, category, subcategory, t.category, t.subcategory]
        .filter((value): value is string => Boolean(value))
        .map(normalize);
      if (!haystack.some((value) => value.includes(keyword))) return false;
    }
    return true;
  });

  const totals = { income: 0, expense: 0, countedIncome: 0, countedExpense: 0 };
  matched.forEach((t) => {
    const counted = isCounted(t, rules);
    if (t.type === 'income') {
      totals.income += t.amount;
      if (counted) totals.countedIncome += t.amount;
    } else {
      totals.expense += t.amount;
      if (counted) totals.countedExpense += t.amount;
    }
  });

  const compare: Record<SearchSort, (a: Transaction, b: Transaction) => number> = {
    date_desc: (a, b) => b.date.getTime() - a.date.getTime(),
    date_asc: (a, b) => a.date.getTime() - b.date.getTime(),
    amount_desc: (a, b) => b.amount - a.amount || b.date.getTime() - a.date.getTime(),
  };
  const returned = [...matched].sort(compare[params.sort]).slice(0, params.limit);

  return {
    period: { from: formatDate(params.from), to: formatDate(params.to) },
    matchedCount: matched.length,
    totals,
    returnedCount: returned.length,
    truncated: matched.length > returned.length,
    transactions: returned.map((t) => ({
      id: t.id,
      date: formatDate(t.date),
      type: t.type,
      category: rules.categoryName(t),
      subcategory: rules.subcategoryName(t),
      amount: t.amount,
      paymentMethod: t.paymentMethod,
      description: t.description || undefined,
      countedInTotals: isCounted(t, rules),
    })),
  };
};

// ============================================================
// get_monthly_summary
// ============================================================

const toCategoryAmounts = (transactions: Transaction[], type: TransactionKind, rules: TransactionRules) =>
  calculateCategoryChartData(transactions, type, rules).map(({ name, value, percentage }) => ({
    name,
    amount: value,
    percentage,
  }));

/** 予算との比較から外れる（支出ペース除外の役割を持つ）カテゴリ・サブカテゴリの名前 */
const namesExcludedFromBudget = (settings: UserSettings): string[] =>
  settings.categories.flatMap((category) => [
    ...(category.roles.includes('exclude_from_pace') ? [category.name] : []),
    ...category.subcategories
      .filter((sub) => sub.roles.includes('exclude_from_pace'))
      .map((sub) => `${category.name} / ${sub.name}`),
  ]);

/**
 * @param transactions 前月の1日から翌月の1日の前までの取引
 * @param month YYYY-MM
 */
export const buildMonthlySummary = (
  transactions: Transaction[],
  settings: UserSettings,
  month: string,
  today: Date
) => {
  const rules = createTransactionRules(settings);
  const previousMonth = getPreviousMonthFromCurrent(month);
  const inMonth = transactions.filter((t) => formatMonthLocal(t.date) === month);

  const monthly = calculateMonthlyData(transactions, rules);
  const empty = (m: string) => ({ month: m, income: 0, expense: 0, net: 0 });
  const current = monthly.find((m) => m.month === month) ?? empty(month);
  const previous = monthly.find((m) => m.month === previousMonth) ?? empty(previousMonth);
  const change = calculateMonthlyComparison(current, previous);

  const year = Number(month.slice(0, 4));
  const investment = calculateMonthlyDetail(inMonth, year, rules).find((m) => m.month === month)?.investment ?? 0;

  const budget = calculateBudgetUsage(inMonth, month, settings.monthlyBudget, rules, today);
  const rewards = calculateMonthlyCardRewards(inMonth, settings.paymentMethods);

  return {
    month,
    income: current.income,
    expense: current.expense,
    net: current.net,
    investment,
    budget: {
      monthlyBudget: settings.monthlyBudget,
      paceExpense: budget.paceExpense,
      usageRate: round1(budget.usageRate),
      excludedFromBudget: namesExcludedFromBudget(settings),
    },
    previousMonth: {
      month: previousMonth,
      income: previous.income,
      expense: previous.expense,
      net: previous.net,
      changePercent: {
        income: change.income.percentage,
        expense: change.expense.percentage,
        net: change.net.percentage,
      },
    },
    expenseByCategory: toCategoryAmounts(inMonth, 'expense', rules),
    incomeByCategory: toCategoryAmounts(inMonth, 'income', rules),
    cardRewards: {
      totalAmount: rewards.totalAmount,
      totalPoints: rewards.totalPoints,
      byPaymentMethod: Object.entries(rewards.cardRewards).map(([name, { amount, points }]) => ({
        name,
        amount,
        points,
      })),
    },
  };
};

// ============================================================
// get_trend
// ============================================================

/**
 * @param transactions fromMonth の1日から toMonth の翌月1日の前までの取引
 * @param categories 指定すれば expenseByCategory をこのカテゴリだけにする
 */
export const buildTrend = (
  transactions: Transaction[],
  settings: UserSettings,
  fromMonth: string,
  toMonth: string,
  categories?: string[]
) => {
  const rules = createTransactionRules(settings);
  const months = monthRange(fromMonth, toMonth);

  const monthly = new Map(calculateMonthlyData(transactions, rules).map((m) => [m.month, m]));
  const years = Array.from(new Set(months.map((m) => Number(m.slice(0, 4)))));
  const investment = new Map(
    years.flatMap((year) => calculateMonthlyDetail(transactions, year, rules)).map((m) => [m.month, m.investment])
  );
  const trend = calculateCategoryTrend(transactions, rules, toMonth);
  const byCategory = new Map(trend.months.map((m) => [m.month, m.totals]));
  const keep = categories?.length ? new Set(categories) : undefined;

  return {
    fromMonth,
    toMonth,
    months: months.map((month) => {
      const data = monthly.get(month);
      const totals = byCategory.get(month) ?? {};
      return {
        month,
        income: data?.income ?? 0,
        expense: data?.expense ?? 0,
        net: data?.net ?? 0,
        investment: investment.get(month) ?? 0,
        expenseByCategory: Object.fromEntries(
          Object.entries(totals).filter(([name, amount]) => amount > 0 && (!keep || keep.has(name)))
        ),
      };
    }),
    categoriesBySpending: trend.categoriesBySpending.filter((name) => !keep || keep.has(name)),
  };
};

// ============================================================
// get_annual_review
// ============================================================

/**
 * @param transactions 前年の1月1日から翌年の1月1日の前までの取引（前年比のため前年も含める）
 */
export const buildAnnualReview = (transactions: Transaction[], settings: UserSettings, year: number) => {
  const rules = createTransactionRules(settings);
  const summary = calculateAnnualSummaries(transactions, rules).find((s) => s.year === year);

  return {
    year,
    hasData: Boolean(summary),
    salaryIncome: summary?.salaryIncome ?? 0,
    otherIncome: summary?.otherIncome ?? 0,
    netIncome: summary?.netIncome ?? 0,
    expense: summary?.expense ?? 0,
    investment: summary?.investment ?? 0,
    remaining: summary?.remaining ?? 0,
    savingsRate: round1(summary?.savingsRate ?? 0),
    estimatedGrossSalary: summary?.estimatedGross ?? 0,
    estimatedDeductions: summary?.deductions ?? { socialInsurance: 0, incomeTax: 0, residentTax: 0 },
    grossIncomeNote: '額面年収は給与の手取りから逆算した概算。考慮していない控除がある',
    monthly: calculateMonthlyDetail(transactions, year, rules),
    expenseByCategoryVsPreviousYear: calculateCategoryYoY(transactions, year, rules).map((c) => ({
      ...c,
      rate: c.rate === null ? null : round1(c.rate),
    })),
  };
};

// ============================================================
// list_recurring_transactions
// ============================================================

/**
 * @param transactionsThisMonth 今月の取引（記録済みかの判定に使う）
 * @param month 今月（YYYY-MM）
 */
export const buildRecurringList = (
  recurring: RecurringTransaction[],
  transactionsThisMonth: Transaction[],
  month: string
) => ({
  month,
  recurring: recurring.map((r) => ({
    name: r.name,
    amount: r.amount,
    category: r.category,
    subcategory: r.subcategory,
    paymentMethod: r.paymentMethod,
    dayOfMonth: r.dayOfMonth,
    isEnabled: r.isEnabled,
    recordedThisMonth: isRecurringRecorded(r, transactionsThisMonth, month),
  })),
});
