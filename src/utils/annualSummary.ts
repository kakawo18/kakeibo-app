/**
 * 年次集計
 *
 * 年単位の数字（年収・年間支出・投資額・貯蓄率）はこれまで各コンポーネントの
 * useMemo に散らばっていたため、純関数としてここに集約する。
 *
 * 【重要】投資・立替金・カード引き落としの除外判定は必ず rules（transactionRules.ts）
 * を通すこと。カテゴリ名で分岐すると、ユーザーがリネームした瞬間に壊れる。
 *
 * 【年間支出の定義】投資は「支出」に含めない。資産が現金から証券に移っただけで
 * 消費ではないため。投資額は investment として常に別枠で返す。
 */
import { Transaction } from '@/types';
import { formatMonthLocal } from './dateUtils';
import { TransactionRules } from './transactionRules';
import { GrossEstimateOptions, estimateGrossFromNet } from './tax/estimateGross';

export interface AnnualDeductions {
  socialInsurance: number;
  incomeTax: number;
  residentTax: number;
}

export interface AnnualSummary {
  year: number;
  /** 給与収入(salary_income役割)の手取り合計 */
  salaryIncome: number;
  /** 給与以外の収入（立替回収は除く） */
  otherIncome: number;
  /** 手取り収入の合計 */
  netIncome: number;
  /** 給与の推定額面（= salaryIncome + 控除合計）。その他収入は含まない */
  estimatedGross: number;
  /** 額面推定の内訳。すべて概算（utils/tax/estimateGross.ts 参照） */
  deductions: AnnualDeductions;
  /** 年間支出（投資・立替金・カード引き落としを除く） */
  expense: number;
  /** 年間投資額 */
  investment: number;
  /** 手元に残った額 = 手取り − 支出 − 投資 */
  balance: number;
  /** 貯蓄率(%) = 投資額 ÷ 給与収入。給与収入が無い年は 0 */
  savingsRate: number;
}

export interface MonthlyDetail {
  /** YYYY-MM */
  month: string;
  income: number;
  expense: number;
  investment: number;
  balance: number;
}

export interface CategoryYoY {
  /** サブカテゴリがあればサブカテゴリ名（円グラフと同じ粒度） */
  name: string;
  current: number;
  previous: number;
  /** 増減額（正 = 増えた） */
  diff: number;
  /** 増減率(%)。前年が0なら null */
  rate: number | null;
}

/** 取引のある年を新しい順に返す */
export const getAvailableYears = (transactions: Transaction[]): number[] => {
  const years = new Set<number>();
  transactions.forEach((t) => years.add(t.date.getFullYear()));
  return Array.from(years).sort((a, b) => b - a);
};

/** 円グラフと同じ粒度（サブカテゴリ優先）でカテゴリ名を決める */
const categoryKey = (t: Transaction): string => t.subcategory || t.category;

/**
 * 年ごとの収支サマリーを古い順に返す
 *
 * @param options 額面推定のオプション（40歳以上かどうかなど）
 */
export const calculateAnnualSummaries = (
  transactions: Transaction[],
  rules: TransactionRules,
  options: GrossEstimateOptions = {}
): AnnualSummary[] => {
  const byYear = new Map<number, { salaryIncome: number; otherIncome: number; expense: number; investment: number }>();

  transactions.forEach((t) => {
    const year = t.date.getFullYear();
    if (!byYear.has(year)) {
      byYear.set(year, { salaryIncome: 0, otherIncome: 0, expense: 0, investment: 0 });
    }
    const bucket = byYear.get(year)!;

    if (t.type === 'income') {
      if (rules.isExcludedFromIncome(t)) return;
      if (rules.isSalaryIncome(t)) {
        bucket.salaryIncome += t.amount;
      } else {
        bucket.otherIncome += t.amount;
      }
      return;
    }

    // 投資は支出ではなく資産移動として別枠で集計する
    if (rules.isInvestment(t)) {
      bucket.investment += t.amount;
      return;
    }
    if (!rules.isExcludedFromExpense(t)) {
      bucket.expense += t.amount;
    }
  });

  return Array.from(byYear.entries())
    .map(([year, bucket]) => {
      const estimate = estimateGrossFromNet(bucket.salaryIncome, year, options);
      const netIncome = bucket.salaryIncome + bucket.otherIncome;

      return {
        year,
        salaryIncome: bucket.salaryIncome,
        otherIncome: bucket.otherIncome,
        netIncome,
        estimatedGross: estimate.gross,
        deductions: {
          socialInsurance: estimate.socialInsurance,
          incomeTax: estimate.incomeTax,
          residentTax: estimate.residentTax,
        },
        expense: bucket.expense,
        investment: bucket.investment,
        balance: netIncome - bucket.expense - bucket.investment,
        savingsRate:
          bucket.salaryIncome > 0 ? (bucket.investment / bucket.salaryIncome) * 100 : 0,
      };
    })
    .sort((a, b) => a.year - b.year);
};

/** 指定年の月別内訳を1〜12月ぶん返す（データの無い月も0で埋める） */
export const calculateMonthlyDetail = (
  transactions: Transaction[],
  year: number,
  rules: TransactionRules
): MonthlyDetail[] => {
  const months: MonthlyDetail[] = Array.from({ length: 12 }, (_, index) => ({
    month: `${year}-${String(index + 1).padStart(2, '0')}`,
    income: 0,
    expense: 0,
    investment: 0,
    balance: 0,
  }));

  transactions.forEach((t) => {
    if (t.date.getFullYear() !== year) return;
    const detail = months[t.date.getMonth()];

    if (t.type === 'income') {
      if (!rules.isExcludedFromIncome(t)) detail.income += t.amount;
      return;
    }
    if (rules.isInvestment(t)) {
      detail.investment += t.amount;
      return;
    }
    if (!rules.isExcludedFromExpense(t)) detail.expense += t.amount;
  });

  months.forEach((detail) => {
    detail.balance = detail.income - detail.expense - detail.investment;
  });

  return months;
};

/** 記録開始からの投資額（元本）の累計を月次で返す */
export const calculateCumulativeInvestment = (
  transactions: Transaction[],
  rules: TransactionRules
): { month: string; cumulative: number }[] => {
  const byMonth = new Map<string, number>();

  transactions.forEach((t) => {
    if (t.type !== 'expense' || !rules.isInvestment(t)) return;
    const month = formatMonthLocal(t.date);
    byMonth.set(month, (byMonth.get(month) ?? 0) + t.amount);
  });

  let cumulative = 0;
  return Array.from(byMonth.keys())
    .sort((a, b) => a.localeCompare(b))
    .map((month) => {
      cumulative += byMonth.get(month) ?? 0;
      return { month, cumulative };
    });
};

/** 指定年とその前年のカテゴリ別支出を比較し、増減額の大きい順に返す */
export const calculateCategoryYoY = (
  transactions: Transaction[],
  year: number,
  rules: TransactionRules
): CategoryYoY[] => {
  const current = new Map<string, number>();
  const previous = new Map<string, number>();

  transactions.forEach((t) => {
    if (t.type !== 'expense' || rules.isExcludedFromExpense(t)) return;

    const transactionYear = t.date.getFullYear();
    const target =
      transactionYear === year ? current : transactionYear === year - 1 ? previous : null;
    if (!target) return;

    const key = categoryKey(t);
    target.set(key, (target.get(key) ?? 0) + t.amount);
  });

  const names = new Set([...current.keys(), ...previous.keys()]);

  return Array.from(names)
    .map((name) => {
      const currentAmount = current.get(name) ?? 0;
      const previousAmount = previous.get(name) ?? 0;
      return {
        name,
        current: currentAmount,
        previous: previousAmount,
        diff: currentAmount - previousAmount,
        rate:
          previousAmount > 0
            ? ((currentAmount - previousAmount) / previousAmount) * 100
            : null,
      };
    })
    .filter((entry) => entry.diff !== 0)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
};
