import { Transaction, MonthlyData, ChartData } from '@/types';
import { formatMonth, formatMonthLocal, getPreviousMonthFromCurrent, getNextMonth } from './dateUtils';

export const calculateMonthlyData = (transactions: Transaction[]): MonthlyData[] => {
  const monthlyMap = new Map<string, MonthlyData>();

  // トランザクションがある月のデータを構築（ローカルタイムゾーン対応）
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
      monthData.income += transaction.amount;
    } else {
      // 支出計算: affectsExpenseがtrueの取引のみ
      if (transaction.affectsExpense !== false) {
        monthData.expense += transaction.amount;
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

  // 残高計算: 累積で計算
  let runningBalance = 0;
  const sortedData = Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month));
  
  sortedData.forEach((monthData) => {
    // その月の収入（ローカルタイムゾーン対応）
    const monthIncome = transactions
      .filter(t => formatMonthLocal(t.date) === monthData.month && t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    // その月の現金支払い（カード支払いとカード引き落としを除外）
    const monthCashExpense = transactions
      .filter(t => 
        formatMonthLocal(t.date) === monthData.month && 
        t.type === 'expense' && 
        t.transactionType !== 'card_payment' &&
        t.transactionType !== 'card_withdrawal' &&
        (t.transactionType === 'normal' || 
         (!t.transactionType && (t.paymentMethod === '現金' || !t.paymentMethod)))
      )
      .reduce((sum, t) => sum + t.amount, 0);
    
    // 前月のカード支払い（今月の残高から引き落とし）
    const previousMonth = getPreviousMonthFromCurrent(monthData.month);
    const previousMonthCardPayments = transactions
      .filter(t => 
        formatMonthLocal(t.date) === previousMonth && 
        t.transactionType === 'card_payment'
      )
      .reduce((sum, t) => sum + t.amount, 0);
    
    // 今月のカード引き落とし（従来の引き落とし取引）
    const monthCardWithdrawal = transactions
      .filter(t => 
        formatMonthLocal(t.date) === monthData.month && 
        t.transactionType === 'card_withdrawal'
      )
      .reduce((sum, t) => sum + t.amount, 0);
    
    // 実残高 = 前月残高 + 今月収入 - 今月現金支払い - 前月カード支払い - 今月カード引き落とし
    runningBalance = runningBalance + monthIncome - monthCashExpense - previousMonthCardPayments - monthCardWithdrawal;
    monthData.balance = runningBalance;
  });

  return sortedData;
};

// カテゴリ別カラーパレット
const CATEGORY_COLORS = {
  // 収入カテゴリ
  '給与': '#10B981',
  'ボーナス': '#059669',
  'その他': '#047857',
  
  // 支出カテゴリ
  '食費': '#EF4444',
  '飲み会費': '#DC2626',
  '交際費': '#A855F7',
  '電気代': '#F59E0B',
  'ガス代': '#D97706',
  '水道代': '#0EA5E9',
  '光熱費': '#F59E0B',
  '交通費': '#3B82F6',
  '趣味代': '#8B5CF6',
  '旅行代': '#EC4899',
  '医療費': '#06B6D4',
  '家賃': '#F97316',
  '投資': '#84CC16',
  '通信費': '#F97316',
  '日用品': '#14B8A6',
  '固定費': '#F97316',
  '三井住友カード': '#6B7280',
  '三菱UFJカード': '#6B7280',
  'amazonカード': '#6B7280',
  'EPOSカード': '#6B7280',
  '楽天カード': '#6B7280',
  'カード引き落とし': '#6B7280',
} as const;

export const getCategoryColor = (categoryName: string): string => {
  return CATEGORY_COLORS[categoryName as keyof typeof CATEGORY_COLORS] || '#9CA3AF';
};

export const calculateCategoryChartData = (transactions: Transaction[], type: 'income' | 'expense'): ChartData[] => {
  const categoryMap = new Map<string, number>();
  let total = 0;

  transactions
    .filter((t) => t.type === type)
    .forEach((transaction) => {
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