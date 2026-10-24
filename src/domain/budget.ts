/**
 * 月間予算との比較
 *
 * ホームの支出ペースのグラフと、Claude 連携の月の収支（docs/claude-connector/仕様書.md 6.4）が
 * 同じ数え方をするよう、画面から取り出した。
 */
import { Transaction } from '@/types';
import { TransactionRules } from './transactionRules';

/**
 * 予算と比べる支出に入るか
 *
 * 投資・立替金などの共通の除外に加え、「支出ペース除外」役割のカテゴリ
 * （家賃など毎月一定の支出）も外す。
 */
export const isCountedInBudget = (t: Transaction, rules: TransactionRules): boolean =>
  t.type === 'expense' && !rules.isExcludedFromExpense(t) && !rules.isExcludedFromPace(t);

export interface BudgetUsage {
  /** 予算と比べる支出の合計（今月なら今日まで） */
  paceExpense: number;
  /** paceExpense ÷ 予算 × 100。予算が0なら0 */
  usageRate: number;
}

/**
 * 月の予算に対する支出
 *
 * 今月は今日までの取引だけを数える（先の日付で記録した取引はまだ数えない）。
 *
 * @param month YYYY-MM
 * @param today 基準日。テストで固定できるよう引数で受け取る
 */
export const calculateBudgetUsage = (
  transactions: Transaction[],
  month: string,
  budget: number,
  rules: TransactionRules,
  today: Date = new Date()
): BudgetUsage => {
  const [year, monthNumber] = month.split('-').map(Number);
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === monthNumber;
  const lastDay = isCurrentMonth ? today.getDate() : new Date(year, monthNumber, 0).getDate();

  const paceExpense = transactions
    .filter(
      (t) =>
        t.date.getFullYear() === year &&
        t.date.getMonth() + 1 === monthNumber &&
        t.date.getDate() <= lastDay &&
        isCountedInBudget(t, rules)
    )
    .reduce((sum, t) => sum + t.amount, 0);

  return { paceExpense, usageRate: budget > 0 ? (paceExpense / budget) * 100 : 0 };
};
