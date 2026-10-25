/**
 * 定期取引の「今月もう記録したか」の判定（#101）
 *
 * 定期取引から記録した取引には、元の定期取引 ID（recurringTransactionId）と
 * 対象月（recurringMonth）を保存し、その2つで記録済みを判定する。
 *
 * 以前は金額・カテゴリの一致とメモの部分一致で推測していたため、
 * - 記録時に請求額やメモを直すと一致しなくなり、同じ月にまた通知が出る
 * - 同名・同額の別の定期取引を記録済みと取り違える
 * といったことが起きていた。ID を持たない過去の記録にだけ、従来の推測を使う。
 *
 * 毎月の定期取引の合計と内訳（ホーム・設定に表示する）も、ここで集計する。
 */
import { RecurringTransaction, Transaction } from '@/types';
import { formatMonthLocal } from '@/utils/dateUtils';
import { TransactionRules } from './transactionRules';

/** その月の実効日（31日設定なら短い月は月末日） */
const effectiveDay = (dayOfMonth: number, today: Date): number => {
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return Math.min(dayOfMonth, daysInMonth);
};

/** ID を持たない過去の記録を、金額・カテゴリ・メモから推測する（互換用） */
const matchesLegacyRecord = (
  recurring: RecurringTransaction,
  t: Transaction,
  month: string
): boolean => {
  if (formatMonthLocal(t.date) !== month) return false;
  const basicMatch =
    t.category === recurring.category &&
    t.amount === recurring.amount &&
    (recurring.subcategory ? t.subcategory === recurring.subcategory : true);
  if (!basicMatch) return false;
  // メモが無い古いデータは金額・カテゴリの一致だけで判定する
  if (recurring.name && t.description) return t.description.includes(recurring.name);
  return true;
};

/** この定期取引が、指定の月にもう記録されているか */
export const isRecurringRecorded = (
  recurring: RecurringTransaction,
  transactions: Transaction[],
  month: string
): boolean =>
  transactions.some((t) =>
    t.recurringTransactionId
      ? t.recurringTransactionId === recurring.id && t.recurringMonth === month
      : matchesLegacyRecord(recurring, t, month)
  );

/** ホームに「未記録の定期取引」として出すか */
export const shouldShowRecurring = (
  recurring: RecurringTransaction,
  transactions: Transaction[],
  today: Date = new Date()
): boolean => {
  if (today.getDate() < effectiveDay(recurring.dayOfMonth, today)) return false;
  return !isRecurringRecorded(recurring, transactions, formatMonthLocal(today));
};

/**
 * 定期取引から記録する取引のドキュメント ID
 *
 * 定期取引と対象月から決まる ID で書くので、複数のタブ・端末から同じ月を
 * 同時に記録しても取引は1件になる（後から保存した内容が残る）。
 */
export const recurringRecordId = (recurringId: string, month: string): string =>
  `recurring-${recurringId}-${month}`;

/** 定期取引の内訳（カテゴリごと） */
export interface RecurringCategoryTotal {
  /** カテゴリの今の名前（#97） */
  category: string;
  total: number;
  /** このカテゴリの定期取引（金額の大きい順） */
  items: RecurringTransaction[];
}

/** 毎月の定期取引の合計 */
export interface RecurringSummary {
  /** 有効な定期取引の合計（1か月分） */
  total: number;
  /** うち支出に数える額 */
  expense: number;
  /** うち投資（支出には数えない） */
  investment: number;
  /** うち立替など、支出にも投資にも数えない額 */
  other: number;
  /** 有効な定期取引の件数 */
  count: number;
  /** 無効にしている定期取引の件数（合計には入れない） */
  disabledCount: number;
  /** カテゴリごとの内訳（金額の大きい順） */
  byCategory: RecurringCategoryTotal[];
}

const byAmountDesc = (a: { amount: number }, b: { amount: number }) => b.amount - a.amount;

/**
 * 有効な定期取引の毎月の合計と内訳
 *
 * 支出・投資の分け方は記録した取引と同じ役割（CategoryRole）で判定する。
 * 定期取引は支出のカテゴリだけを選べ、記録すると支出に含める取引になる。
 */
export const summarizeRecurring = (
  recurringTransactions: RecurringTransaction[],
  rules: TransactionRules
): RecurringSummary => {
  const enabled = recurringTransactions.filter((r) => r.isEnabled);
  let expense = 0;
  let investment = 0;
  let other = 0;
  const groups = new Map<string, RecurringTransaction[]>();

  for (const r of enabled) {
    if (rules.isInvestment(r)) investment += r.amount;
    else if (rules.isExcludedFromExpense(r)) other += r.amount;
    else expense += r.amount;

    const category = rules.categoryName(r);
    groups.set(category, [...(groups.get(category) ?? []), r]);
  }

  const byCategory = [...groups.entries()]
    .map(([category, items]) => ({
      category,
      total: items.reduce((sum, r) => sum + r.amount, 0),
      items: [...items].sort(byAmountDesc),
    }))
    .sort((a, b) => b.total - a.total);

  return {
    total: expense + investment + other,
    expense,
    investment,
    other,
    count: enabled.length,
    disabledCount: recurringTransactions.length - enabled.length,
    byCategory,
  };
};
