'use client';

/**
 * ホームに表示する数値を組み立てるフック（#124）
 *
 * 計算そのものは src/domain の純関数。ここは Context のデータと選択中の月を渡して
 * 画面に必要な形にまとめるだけで、表示（JSX）は持たない。
 */
import { useMemo } from 'react';
import { useTransactions } from '@/contexts/TransactionsContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useRecurringTransactions } from '@/contexts/RecurringTransactionsContext';
import { calculateMonthlyData, calculateCategoryChartData, calculateMonthlyComparison } from '@/domain/calculations';
import { calculateYearlySavings } from '@/domain/annualSummary';
import { calculateMonthlyCardRewards } from '@/domain/cardRewards';
import { getPreviousMonthFromCurrent, formatMonthLocal } from '@/utils/dateUtils';

export const useDashboardData = (selectedMonth: string, selectedYear: number) => {
  const { transactions } = useTransactions();
  const { rules, paymentMethods } = useSettings();
  const { getActiveRecurringTransactions, shouldShowRecurringTransaction } = useRecurringTransactions();

  const monthlyData = useMemo(() => calculateMonthlyData(transactions, rules), [transactions, rules]);

  const selectedMonthData = useMemo(() =>
    monthlyData.find(data => data.month === selectedMonth),
    [monthlyData, selectedMonth]
  );

  const previousMonthData = useMemo(() => {
    const previousMonth = getPreviousMonthFromCurrent(selectedMonth);
    return monthlyData.find(data => data.month === previousMonth);
  }, [monthlyData, selectedMonth]);

  const monthlyComparison = useMemo(() => {
    // 前月データが存在しない（データ範囲外の）月では「前月比 +100%」のような
    // 意味のない比較を出さない
    if (!selectedMonthData || !previousMonthData) return null;
    return calculateMonthlyComparison(selectedMonthData, previousMonthData);
  }, [selectedMonthData, previousMonthData]);

  const selectedMonthTransactions = useMemo(() =>
    transactions.filter(t => formatMonthLocal(t.date) === selectedMonth),
    [transactions, selectedMonth]
  );

  const incomeChartData = useMemo(() =>
    calculateCategoryChartData(selectedMonthTransactions, 'income', rules),
    [selectedMonthTransactions, rules]
  );

  const expenseChartData = useMemo(() =>
    calculateCategoryChartData(selectedMonthTransactions, 'expense', rules),
    [selectedMonthTransactions, rules]
  );

  // 年間の投資額と貯蓄率（計算は domain/annualSummary.ts）
  const savingsData = useMemo(
    () => calculateYearlySavings(transactions, rules, selectedYear),
    [transactions, selectedYear, rules]
  );

  const monthlyCardPoints = useMemo(
    () => calculateMonthlyCardRewards(selectedMonthTransactions, paymentMethods).totalPoints,
    [selectedMonthTransactions, paymentMethods]
  );

  const displayRecurringTransactions = useMemo(() => {
    const active = getActiveRecurringTransactions();
    return active.filter(transaction => shouldShowRecurringTransaction(transaction, transactions));
  }, [getActiveRecurringTransactions, shouldShowRecurringTransaction, transactions]);

  return {
    transactions,
    selectedMonthData,
    monthlyComparison,
    selectedMonthTransactions,
    incomeChartData,
    expenseChartData,
    savingsData,
    monthlyCardPoints,
    displayRecurringTransactions,
  };
};
