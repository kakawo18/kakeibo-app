/**
 * 計算ユーティリティ
 * 
 * このファイルは家計簿アプリの各種計算ロジックを提供します。
 * 
 * 【主要な関数】
 * - calculateMonthlyData: 月別の収支・残高を計算
 * - calculateCategoryChartData: 円グラフ用のカテゴリ別データを計算
 * - calculateMonthlyComparison: 前月比較データを計算
 * 
 * 【重要な計算ルール】
 * - 投資（固定費→投資）は支出から除外される
 * - カード支払いは翌月の残高に影響する
 * - 実残高 = 前月残高 + 今月収入 - 今月現金支払い - 前月カード支払い
 */
import { Transaction, MonthlyData, ChartData, Trend } from '@/types';
import { formatMonthLocal, getNextMonth } from './dateUtils';
import { isExcludedFromExpense, isExcludedFromIncome } from './transactionRules';

/**
 * 月別データを計算する
 * 
 * @param transactions - 全取引データ
 * @returns MonthlyData[] - 月別の収支・残高データ
 * 
 * 【計算内容】
 * - 各月の収入合計
 * - 各月の支出合計（投資は除外）
 * - 各月の実残高（カード支払いの翌月反映を考慮）
 * - カテゴリ別の支出内訳
 */
export const calculateMonthlyData = (transactions: Transaction[]): MonthlyData[] => {
  const monthlyMap = new Map<string, MonthlyData>();

  // ステップ1: 各月の収入・支出を集計
  transactions.forEach((transaction) => {
    const month = formatMonthLocal(transaction.date);

    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, {
        month,
        income: 0,
        expense: 0,
        balance: 0,
        categories: {},
      });
    }

    const monthData = monthlyMap.get(month)!;

    if (transaction.type === 'income') {
      // 収入: そのまま加算（立替回収は除外）
      if (!isExcludedFromIncome(transaction)) {
        monthData.income += transaction.amount;
      }
    } else {
      // 支出: 投資（資産移動）・立替金・カード引き落とし等は除外
      if (!isExcludedFromExpense(transaction)) {
        monthData.expense += transaction.amount;
        // カテゴリ別集計（円グラフ用）
        const category = transaction.subcategory || transaction.category;
        monthData.categories[category] = (monthData.categories[category] || 0) + transaction.amount;
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
          balance: 0,
          categories: {},
        });
      }
      currentMonth = getNextMonth(currentMonth);
    }
  }

  const sortedData = Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month));

  sortedData.forEach((monthData) => {
    // 残高 = 収入 - 支出（発生主義）
    // ※立替分はすでに income/expense 集計段階で除外済み
    monthData.balance = monthData.income - monthData.expense;
  });

  return sortedData;
};

// カテゴリ別カラーパレット
// CVD（色覚多様性）検証済みの8色パレットをエンティティ固定で割り当てる。
// ライト面（白）/ ダーク面（#1d1e22）それぞれで検証済みのステップを使用。
const CATEGORY_COLORS: Record<string, { light: string; dark: string }> = {
  // 収入カテゴリ
  '給与': { light: '#0f9b6c', dark: '#1db584' },
  'ボーナス': { light: '#1baf7a', dark: '#199e70' },
  '賞与': { light: '#1baf7a', dark: '#199e70' },
  '配当収入': { light: '#008300', dark: '#3da23d' },
  'その他': { light: '#8b919e', dark: '#82868f' },

  // 支出カテゴリ（エンティティ固定割り当て）
  '食費': { light: '#e34948', dark: '#e66767' },
  '交際費': { light: '#e87ba4', dark: '#d55181' },
  '飲み会費': { light: '#e87ba4', dark: '#d55181' },
  '固定費': { light: '#2a78d6', dark: '#3987e5' },
  '家賃': { light: '#2a78d6', dark: '#3987e5' },
  '通信費': { light: '#4a3aa7', dark: '#9085e9' },
  '電気代': { light: '#eda100', dark: '#c98500' },
  'ガス代': { light: '#eb6834', dark: '#d95926' },
  '水道代': { light: '#1baf7a', dark: '#199e70' },
  '光熱費': { light: '#eda100', dark: '#c98500' },
  '日用品': { light: '#1baf7a', dark: '#199e70' },
  '交通費': { light: '#eda100', dark: '#c98500' },
  '趣味代': { light: '#4a3aa7', dark: '#9085e9' },
  '旅行代': { light: '#eb6834', dark: '#d95926' },
  '医療費': { light: '#008300', dark: '#3da23d' },
  '投資': { light: '#008300', dark: '#3da23d' },

  // カード・立替はニュートラル（シリーズ色を消費しない）
  '三井住友カード': { light: '#8b919e', dark: '#82868f' },
  '三菱UFJカード': { light: '#8b919e', dark: '#82868f' },
  'amazonカード': { light: '#8b919e', dark: '#82868f' },
  'EPOSカード': { light: '#8b919e', dark: '#82868f' },
  '楽天カード': { light: '#8b919e', dark: '#82868f' },
  'カード引き落とし': { light: '#8b919e', dark: '#82868f' },
  '立替金': { light: '#adb2bc', dark: '#6d7178' },
  '立替回収': { light: '#adb2bc', dark: '#6d7178' },
};

export const getCategoryColor = (categoryName: string, isDark = false): string => {
  const entry = CATEGORY_COLORS[categoryName];
  if (!entry) return isDark ? '#82868f' : '#8b919e';
  return isDark ? entry.dark : entry.light;
};

export const calculateCategoryChartData = (transactions: Transaction[], type: 'income' | 'expense'): ChartData[] => {
  const categoryMap = new Map<string, number>();
  let total = 0;

  transactions
    .filter((t) => t.type === type)
    .forEach((transaction) => {
      // 支出サマリーカードの金額と円グラフの合計を一致させるため、
      // 集計と同じ除外ルール（投資・立替・カード引き落とし等）を適用する
      if (type === 'expense' && isExcludedFromExpense(transaction)) return;
      if (type === 'income' && isExcludedFromIncome(transaction)) return;

      const category = transaction.subcategory || transaction.category;
      categoryMap.set(category, (categoryMap.get(category) || 0) + transaction.amount);
      total += transaction.amount;
    });

  return Array.from(categoryMap.entries())
    .map(([name, value]) => ({
      name,
      value,
      percentage: total > 0 ? Math.round((value / total) * 100) : 0,
      color: getCategoryColor(name),
    }))
    .sort((a, b) => b.value - a.value);
};

export const calculatePreviousMonthComparison = (
  currentMonth: MonthlyData,
  previousMonth: MonthlyData | undefined
): Record<string, number> => {
  if (!previousMonth) return {};

  const comparison: Record<string, number> = {};

  Object.keys(currentMonth.categories).forEach((category) => {
    const current = currentMonth.categories[category] || 0;
    const previous = previousMonth.categories[category] || 0;

    if (previous > 0) {
      comparison[category] = Math.round(((current - previous) / previous) * 100);
    } else if (current > 0) {
      comparison[category] = 100;
    }
  });

  return comparison;
};

export const calculateMonthlyComparison = (
  currentData: MonthlyData,
  previousData: MonthlyData | undefined
): {
  income: { value: number; percentage: number; trend: Trend };
  expense: { value: number; percentage: number; trend: Trend };
  balance: { value: number; percentage: number; trend: Trend };
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
  const prevBalance = previousData?.balance || 0;

  const income = calculateChange(currentData.income, prevIncome);
  const expense = calculateChange(currentData.expense, prevExpense);
  const balance = calculateChange(currentData.balance, prevBalance);

  return {
    income: { value: currentData.income, ...income },
    expense: { value: currentData.expense, ...expense },
    balance: { value: currentData.balance, ...balance },
  };
};