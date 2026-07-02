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
import { Transaction, MonthlyData, ChartData } from '@/types';
import { formatMonthLocal, getNextMonth } from './dateUtils';

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
      if (transaction.category !== '立替回収') {
        monthData.income += transaction.amount;
      }
    } else {
      // 支出計算: 投資は除外（投資は資産移動であり支出ではないため）
      // 立替金も除外
      const isInvestment = transaction.category === '固定費' && transaction.subcategory === '投資';
      const isReimbursement = transaction.category === '立替金';

      if (!isInvestment && !isReimbursement && transaction.affectsExpense !== false) {
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
      // 支出の場合、投資は除外（別枠で表示するため）
      // 立替回収、立替金も除外
      // カード引き落とし等（affectsExpense === false）も除外し、
      // 支出サマリーカードの金額と円グラフの合計を一致させる（カード支払いとの二重計上防止）
      if (type === 'expense') {
        if ((transaction.category === '固定費' && transaction.subcategory === '投資') ||
          transaction.category === '立替金' ||
          transaction.affectsExpense === false) {
          return;
        }
      } else if (type === 'income') {
        if (transaction.category === '立替回収') {
          return;
        }
      }

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
  income: { value: number; percentage: number; trend: 'up' | 'down' | 'same' };
  expense: { value: number; percentage: number; trend: 'up' | 'down' | 'same' };
  balance: { value: number; percentage: number; trend: 'up' | 'down' | 'same' };
} => {
  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 'up' : 'same';
    const percentage = ((current - previous) / previous) * 100;
    if (percentage > 0) return 'up';
    if (percentage < 0) return 'down';
    return 'same';
  };

  const calculatePercentage = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const prevIncome = previousData?.income || 0;
  const prevExpense = previousData?.expense || 0;
  const prevBalance = previousData?.balance || 0;

  return {
    income: {
      value: currentData.income,
      percentage: calculatePercentage(currentData.income, prevIncome),
      trend: calculateTrend(currentData.income, prevIncome)
    },
    expense: {
      value: currentData.expense,
      percentage: calculatePercentage(currentData.expense, prevExpense),
      trend: calculateTrend(currentData.expense, prevExpense)
    },
    balance: {
      value: currentData.balance,
      percentage: calculatePercentage(currentData.balance, prevBalance),
      trend: calculateTrend(currentData.balance, prevBalance)
    }
  };
};