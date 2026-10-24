/**
 * 計算ユーティリティ
 * 
 * このファイルは家計簿アプリの各種計算ロジックを提供します。
 * 
 * 【主要な関数】
 * - calculateMonthlyData: 月別の収入・支出・収支を計算
 * - calculateCategoryChartData: 円グラフ用のカテゴリ別データを計算
 * - calculateMonthlyComparison: 前月比較データを計算
 * 
 * 【重要な計算ルール】
 * - 投資・立替金などの除外判定は rules（transactionRules.ts）に従う
 * - 収支(net) = その月の収入 - 支出。口座残高ではない（アプリは口座残高を扱わない）
 * - カード払いは購入月の支出として計上する（引き落とし月には計上しない）
 */
import { Transaction, MonthlyData, ChartData, Trend } from '@/types';
import { formatDate, formatMonthLocal, getNextMonth, monthRange } from '@/utils/dateUtils';
import { TransactionRules } from './transactionRules';


/**
 * 月別データを計算する
 *
 * @param transactions - 全取引データ
 * @param rules - 役割ベースの集計ルール(useSettings().rules)
 * @returns MonthlyData[] - 月別の収入・支出・収支データ
 *
 * 【計算内容】
 * - 各月の収入合計
 * - 各月の支出合計（投資は除外）
 * - 各月の収支（収入 - 支出）
 */
export const calculateMonthlyData = (
  transactions: Transaction[],
  rules: TransactionRules
): MonthlyData[] => {
  const monthlyMap = new Map<string, MonthlyData>();

  // ステップ1: 各月の収入・支出を集計
  transactions.forEach((transaction) => {
    const month = formatMonthLocal(transaction.date);

    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, {
        month,
        income: 0,
        expense: 0,
        net: 0,
      });
    }

    const monthData = monthlyMap.get(month)!;

    if (transaction.type === 'income') {
      // 収入: そのまま加算（立替回収は除外）
      if (!rules.isExcludedFromIncome(transaction)) {
        monthData.income += transaction.amount;
      }
    } else {
      // 支出: 投資（資産移動）・立替金・affectsExpense が false の取引は除外
      if (!rules.isExcludedFromExpense(transaction)) {
        monthData.expense += transaction.amount;
      }
    }
  });

  // 最小月から最大月+1まで連続した月データを作成
  if (monthlyMap.size > 0) {
    const months = Array.from(monthlyMap.keys()).sort();
    const startMonth = months[0];
    const endMonth = getNextMonth(months[months.length - 1]); // 最後の月の次月まで

    let currentMonth = startMonth;
    while (currentMonth <= endMonth) {
      if (!monthlyMap.has(currentMonth)) {
        monthlyMap.set(currentMonth, {
          month: currentMonth,
          income: 0,
          expense: 0,
          net: 0,
        });
      }
      currentMonth = getNextMonth(currentMonth);
    }
  }

  const sortedData = Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month));

  sortedData.forEach((monthData) => {
    // 収支 = 収入 - 支出（口座残高ではない）
    // ※立替分はすでに income/expense 集計段階で除外済み
    monthData.net = monthData.income - monthData.expense;
  });

  return sortedData;
};

/**
 * 円グラフ用のカテゴリ別の金額と割合
 *
 * 色は付けない（表示の都合なので画面側 PieChart がテーマに合わせて付ける。#123）
 */
export const calculateCategoryChartData = (
  transactions: Transaction[],
  type: 'income' | 'expense',
  rules: TransactionRules
): ChartData[] => {
  const categoryMap = new Map<string, number>();
  let total = 0;

  transactions
    .filter((t) => t.type === type)
    .forEach((transaction) => {
      // 支出サマリーカードの金額と円グラフの合計を一致させるため、
      // 集計と同じ除外ルール（投資・立替など）を適用する
      if (type === 'expense' && rules.isExcludedFromExpense(transaction)) return;
      if (type === 'income' && rules.isExcludedFromIncome(transaction)) return;

      const category = rules.chartKey(transaction);
      categoryMap.set(category, (categoryMap.get(category) || 0) + transaction.amount);
      total += transaction.amount;
    });

  return Array.from(categoryMap.entries())
    .map(([name, value]) => ({
      name,
      value,
      percentage: total > 0 ? Math.round((value / total) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value);
};

export const calculateMonthlyComparison = (
  currentData: MonthlyData,
  previousData: MonthlyData | undefined
): {
  income: { value: number; percentage: number; trend: Trend };
  expense: { value: number; percentage: number; trend: Trend };
  net: { value: number; percentage: number; trend: Trend };
} => {
  // トレンド（矢印の向き）は増減の差分で判定し、%の符号も必ず差分と一致させる。
  // 分母に previous をそのまま使うと、収支がマイナスの月を基準にしたとき
  // 符号が反転する（改善したのに下矢印になる）ため、分母は絶対値を取る。
  const calculateChange = (current: number, previous: number) => {
    const diff = current - previous;
    const trend: Trend = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
    const percentage = previous === 0
      ? (diff === 0 ? 0 : 100 * Math.sign(diff))
      : Math.round((diff / Math.abs(previous)) * 100);
    return { trend, percentage };
  };

  const prevIncome = previousData?.income || 0;
  const prevExpense = previousData?.expense || 0;
  const prevNet = previousData?.net || 0;

  const income = calculateChange(currentData.income, prevIncome);
  const expense = calculateChange(currentData.expense, prevExpense);
  const net = calculateChange(currentData.net, prevNet);

  return {
    income: { value: currentData.income, ...income },
    expense: { value: currentData.expense, ...expense },
    net: { value: currentData.net, ...net },
  };
};
/**
 * 日付（YYYY-MM-DD）ごとの収入・支出（カレンダー用）
 *
 * 月次集計と同じ除外ルールを使う（#100）。以前はカレンダーだけが投資・立替を
 * 個別に除いており、支出から外した過去の取引（affectsExpense = false）が
 * カレンダーにだけ加算されてホームの支出と食い違っていた。
 */
export const calculateDailyTotals = (
  transactions: Transaction[],
  rules: TransactionRules
): Map<string, { income: number; expense: number }> => {
  const totals = new Map<string, { income: number; expense: number }>();

  transactions.forEach((t) => {
    const key = formatDate(t.date);
    const day = totals.get(key) ?? { income: 0, expense: 0 };
    if (t.type === 'income') {
      if (!rules.isExcludedFromIncome(t)) day.income += t.amount;
    } else if (!rules.isExcludedFromExpense(t)) {
      day.expense += t.amount;
    }
    totals.set(key, day);
  });

  return totals;
};

export interface CategoryTrend {
  /** 月ごとのカテゴリ別支出。取引の無い月・カテゴリも0で入る */
  months: { month: string; totals: Record<string, number> }[];
  /** 対象期間に支出のあるカテゴリ（名前順） */
  categories: string[];
  /** 同じカテゴリを全期間の支出の多い順に */
  categoriesBySpending: string[];
}

/**
 * カテゴリ別支出の月次推移（ホームの推移グラフ用）
 *
 * - 支出はホームと同じ除外ルール（投資・立替・affectsExpense = false）で数える（#100）
 * - 最初の取引の月から「最後の取引の月か今月の遅い方」までを連続で並べ、
 *   取引の無い月やカテゴリは0で埋める（#118）。以前は支出のある月だけを並べて
 *   いたので、6ヶ月表示が実際には飛び飛びの6つの月になり、線も途切れていた
 *
 * @param currentMonth 今月（YYYY-MM）。テストで固定できるよう引数で受け取る
 */
export const calculateCategoryTrend = (
  transactions: Transaction[],
  rules: TransactionRules,
  currentMonth: string
): CategoryTrend => {
  const byMonth = new Map<string, Map<string, number>>();
  const totalByCategory = new Map<string, number>();

  transactions.forEach((t) => {
    if (t.type !== 'expense' || rules.isExcludedFromExpense(t)) return;
    const month = formatMonthLocal(t.date);
    // 改名前の名前で記録された取引も今の名前でまとめる（#97）
    const category = rules.categoryName(t);
    const monthTotals = byMonth.get(month) ?? new Map<string, number>();
    monthTotals.set(category, (monthTotals.get(category) ?? 0) + t.amount);
    byMonth.set(month, monthTotals);
    totalByCategory.set(category, (totalByCategory.get(category) ?? 0) + t.amount);
  });

  if (byMonth.size === 0) return { months: [], categories: [], categoriesBySpending: [] };

  const categories = Array.from(totalByCategory.keys()).sort();
  const recorded = Array.from(byMonth.keys()).sort();
  const last = recorded[recorded.length - 1];
  const end = last > currentMonth ? last : currentMonth;

  return {
    months: monthRange(recorded[0], end).map((month) => ({
      month,
      totals: Object.fromEntries(
        categories.map((category) => [category, byMonth.get(month)?.get(category) ?? 0])
      ),
    })),
    categories,
    categoriesBySpending: Array.from(totalByCategory.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category]) => category),
  };
};
