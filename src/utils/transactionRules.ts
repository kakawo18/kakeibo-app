/**
 * 取引の分類ルール
 *
 * 「投資は支出ではない」「立替金は収支から除外」「カード支払いは残高に
 * 影響しない」といった、アプリ全体で共有すべき業務ルールを一箇所に集約する。
 * 集計ロジック（calculations.ts）や各画面はここの判定関数を使うこと。
 */
import { Transaction, TransactionType, UserSettings, CategoryRole } from '@/types';

/** カテゴリ判定に必要な最小限のフィールド */
export type CategoryLike = Pick<Transaction, 'category'> & Partial<Pick<Transaction, 'subcategory' | 'affectsExpense'>>;

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

// ============================================================
// 役割(role)ベースの判定ルール
//
// ユーザー設定のカテゴリ役割から判定関数一式を生成する。
// カテゴリ名の文字列一致に依存しないため、ユーザーがカテゴリを
// 自由に追加・変更しても集計が壊れない。
// ============================================================

export interface TransactionRules {
  isInvestment(t: CategoryLike): boolean;
  isAdvancePayment(t: CategoryLike): boolean;
  isAdvanceRepayment(t: CategoryLike): boolean;
  isSalaryIncome(t: CategoryLike): boolean;
  isExcludedFromExpense(t: CategoryLike): boolean;
  isExcludedFromIncome(t: CategoryLike): boolean;
  isExcludedFromPace(t: CategoryLike): boolean;
  deriveTransactionFlags(category: string, paymentMethod?: string): TransactionFlags;
}

/** サブカテゴリ役割マップのキー(区切りにNUL文字を使いカテゴリ名との衝突を防ぐ) */
const subKey = (category: string, subcategory: string): string =>
  `${category}\u0000${subcategory}`;

export const createTransactionRules = (settings: UserSettings): TransactionRules => {
  // カテゴリ名 → 役割集合(O(1)ルックアップ用に事前構築)
  const categoryRoles = new Map<string, Set<CategoryRole>>();
  const subcategoryRoles = new Map<string, Set<CategoryRole>>();

  for (const category of settings.categories) {
    if (category.roles.length > 0) {
      const existing = categoryRoles.get(category.name) ?? new Set<CategoryRole>();
      category.roles.forEach((role) => existing.add(role));
      categoryRoles.set(category.name, existing);
    }
    for (const sub of category.subcategories) {
      if (sub.roles.length > 0) {
        const key = subKey(category.name, sub.name);
        const existing = subcategoryRoles.get(key) ?? new Set<CategoryRole>();
        sub.roles.forEach((role) => existing.add(role));
        subcategoryRoles.set(key, existing);
      }
    }
  }

  // 現金扱いの支払方法名
  const cashMethods = new Set(
    settings.paymentMethods.filter((m) => m.isCash).map((m) => m.name)
  );

  const hasRole = (t: CategoryLike, role: CategoryRole): boolean => {
    if (categoryRoles.get(t.category)?.has(role)) return true;
    if (t.subcategory && subcategoryRoles.get(subKey(t.category, t.subcategory))?.has(role)) {
      return true;
    }
    return false;
  };

  const isInvestment = (t: CategoryLike) => hasRole(t, 'investment');
  const isAdvancePayment = (t: CategoryLike) => hasRole(t, 'advance_payment');
  const isAdvanceRepayment = (t: CategoryLike) => hasRole(t, 'advance_repayment');

  return {
    isInvestment,
    isAdvancePayment,
    isAdvanceRepayment,
    isSalaryIncome: (t) => hasRole(t, 'salary_income'),
    isExcludedFromExpense: (t) =>
      isInvestment(t) || isAdvancePayment(t) || t.affectsExpense === false,
    isExcludedFromIncome: (t) => isAdvanceRepayment(t),
    isExcludedFromPace: (t) => hasRole(t, 'exclude_from_pace'),
    deriveTransactionFlags: (category, paymentMethod) => {
      if (categoryRoles.get(category)?.has('card_withdrawal')) {
        return { transactionType: 'card_withdrawal', affectsExpense: false, affectsBalance: true };
      }
      // 設定に未登録の支払方法もカード扱い(旧「'現金'以外は全てカード」互換。
      // CSVインポート等で未知の名前が来ても残高計算の挙動を変えないため)
      if (paymentMethod && !cashMethods.has(paymentMethod)) {
        return { transactionType: 'card_payment', affectsExpense: true, affectsBalance: false };
      }
      return { transactionType: 'normal', affectsExpense: true, affectsBalance: true };
    },
  };
};
