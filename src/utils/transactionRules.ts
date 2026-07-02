/**
 * 取引の分類ルール
 *
 * 「投資は支出ではない」「立替金は収支から除外」「カード支払いは残高に
 * 影響しない」といった、アプリ全体で共有すべき業務ルールを一箇所に集約する。
 * 集計ロジック（calculations.ts）や各画面はここの判定関数を使うこと。
 */
import { Transaction, TransactionType } from '@/types';

/** カテゴリ判定に必要な最小限のフィールド */
type CategoryLike = Pick<Transaction, 'category'> & Partial<Pick<Transaction, 'subcategory' | 'affectsExpense'>>;

/** カード引き落とし取引のカテゴリ名 */
export const CARD_WITHDRAWAL_CATEGORY = 'カード引き落とし';

/** 投資（固定費→投資）か。資産移動であり支出ではないため、支出集計から除外する */
export const isInvestment = (t: CategoryLike): boolean =>
  t.category === '固定費' && t.subcategory === '投資';

/** 立替金（支出側）か。収支から除外する */
export const isAdvancePayment = (t: CategoryLike): boolean =>
  t.category === '立替金';

/** 立替回収（収入側）か。収支から除外する */
export const isAdvanceRepayment = (t: CategoryLike): boolean =>
  t.category === '立替回収';

/**
 * 支出合計から除外すべき取引か
 * - 投資・立替金
 * - カード引き落とし等（affectsExpense === false。カード支払いとの二重計上防止）
 */
export const isExcludedFromExpense = (t: CategoryLike): boolean =>
  isInvestment(t) || isAdvancePayment(t) || t.affectsExpense === false;

/** 収入合計から除外すべき取引か（立替回収） */
export const isExcludedFromIncome = (t: CategoryLike): boolean =>
  isAdvanceRepayment(t);

export interface TransactionFlags {
  transactionType: TransactionType;
  affectsExpense: boolean;
  affectsBalance: boolean;
}

/**
 * カテゴリと支払方法から取引タイプ・集計フラグを導出する
 *
 * - カード引き落とし: 支出集計には含めない（カード支払い時に計上済み）が、残高には影響する
 * - カード支払い（現金以外）: 支出には含めるが、実際の残高が減るのは引き落とし時
 * - それ以外（現金等）: 通常取引
 */
export const deriveTransactionFlags = (
  category: string,
  paymentMethod?: string
): TransactionFlags => {
  if (category === CARD_WITHDRAWAL_CATEGORY) {
    return { transactionType: 'card_withdrawal', affectsExpense: false, affectsBalance: true };
  }
  if (paymentMethod && paymentMethod !== '現金') {
    return { transactionType: 'card_payment', affectsExpense: true, affectsBalance: false };
  }
  return { transactionType: 'normal', affectsExpense: true, affectsBalance: true };
};
