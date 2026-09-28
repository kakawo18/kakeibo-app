/**
 * 取引の分類ルール
 *
 * 「投資は支出ではない」「立替金は収支から除外」といった、
 * アプリ全体で共有すべき業務ルールを一箇所に集約する。
 *
 * 判定はユーザー設定のカテゴリ役割(CategoryRole)に基づく。
 * createTransactionRules(settings) で判定関数一式を生成し、
 * 集計ロジック(calculations.ts)や各画面はそれを使うこと。
 * カテゴリ名の文字列一致に依存しないため、ユーザーがカテゴリを
 * 自由に追加・変更しても集計が壊れない。
 */
import { Transaction, TransactionType, UserSettings, CategoryRole } from '@/types';

/** カテゴリ判定に必要な最小限のフィールド */
export type CategoryLike = Pick<Transaction, 'category'> & Partial<Pick<Transaction, 'subcategory' | 'affectsExpense'>>;

export interface TransactionFlags {
  transactionType: TransactionType;
  affectsExpense: boolean;
}

export interface TransactionRules {
  isInvestment(t: CategoryLike): boolean;
  isAdvancePayment(t: CategoryLike): boolean;
  isAdvanceRepayment(t: CategoryLike): boolean;
  isSalaryIncome(t: CategoryLike): boolean;
  isExcludedFromExpense(t: CategoryLike): boolean;
  isExcludedFromIncome(t: CategoryLike): boolean;
  isExcludedFromPace(t: CategoryLike): boolean;
  deriveTransactionFlags(category: string, paymentMethod?: string): TransactionFlags;
  /** 取引のカテゴリの今の名前（改名前の名前で記録された取引も今の名前にする。#97） */
  categoryName(t: CategoryLike): string;
  /** 取引のサブカテゴリの今の名前。無ければ undefined */
  subcategoryName(t: CategoryLike): string | undefined;
  /** 円グラフ・年間集計の分類キー（サブカテゴリ優先、今の名前） */
  chartKey(t: CategoryLike): string;
}

/** サブカテゴリ役割マップのキー(区切りにNUL文字を使いカテゴリ名との衝突を防ぐ) */
const subKey = (category: string, subcategory: string): string =>
  `${category}\u0000${subcategory}`;

const addRoles = (
  map: Map<string, Set<CategoryRole>>,
  key: string,
  roles: CategoryRole[]
): void => {
  if (roles.length === 0) return;
  const existing = map.get(key) ?? new Set<CategoryRole>();
  roles.forEach((role) => existing.add(role));
  map.set(key, existing);
};

export const createTransactionRules = (settings: UserSettings): TransactionRules => {
  // カテゴリ名 → 役割集合(O(1)ルックアップ用に事前構築)
  const categoryRoles = new Map<string, Set<CategoryRole>>();
  const subcategoryRoles = new Map<string, Set<CategoryRole>>();
  // 以前の名前 → 今の名前（#97）
  const currentCategoryName = new Map<string, string>();
  const currentSubcategoryName = new Map<string, string>();

  // 1) 今の名前。同じ名前が複数あれば役割を合わせる（従来どおり）
  const currentCategoryNames = new Set<string>();
  const currentSubKeys = new Set<string>();
  for (const category of settings.categories) {
    currentCategoryNames.add(category.name);
    addRoles(categoryRoles, category.name, category.roles);
    for (const sub of category.subcategories) {
      currentSubKeys.add(subKey(category.name, sub.name));
      addRoles(subcategoryRoles, subKey(category.name, sub.name), sub.roles);
    }
  }

  // 2) 以前の名前（改名前の名前）。今の名前と重なるものは今の名前を優先する。
  //    改名した取引は旧名のまま残っているので、旧名でも同じ役割・表示名になるようにする
  for (const category of settings.categories) {
    const aliases = category.aliases ?? [];
    for (const alias of aliases) {
      if (currentCategoryNames.has(alias)) continue;
      addRoles(categoryRoles, alias, category.roles);
      if (!currentCategoryName.has(alias)) currentCategoryName.set(alias, category.name);
    }
    const categoryNames = [category.name, ...aliases];
    for (const sub of category.subcategories) {
      const subNames = [sub.name, ...(sub.aliases ?? [])];
      for (const categoryName of categoryNames) {
        for (const subName of subNames) {
          const key = subKey(categoryName, subName);
          if (currentSubKeys.has(key)) continue;
          addRoles(subcategoryRoles, key, sub.roles);
          if (!currentSubcategoryName.has(key)) currentSubcategoryName.set(key, sub.name);
        }
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

  const categoryName = (t: CategoryLike): string =>
    currentCategoryName.get(t.category) ?? t.category;
  const subcategoryName = (t: CategoryLike): string | undefined =>
    t.subcategory
      ? currentSubcategoryName.get(subKey(t.category, t.subcategory)) ?? t.subcategory
      : undefined;

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
      // 設定に未登録の支払方法もカード扱い(旧「'現金'以外は全てカード」互換。
      // CSVインポート等で未知の名前が来ても取引タイプの判定を変えないため)
      if (paymentMethod && !cashMethods.has(paymentMethod)) {
        return { transactionType: 'card_payment', affectsExpense: true };
      }
      return { transactionType: 'normal', affectsExpense: true };
    },
    categoryName,
    subcategoryName,
    chartKey: (t) => subcategoryName(t) || categoryName(t),
  };
};

/** 支払方法の「未設定」と空文字を同じに扱う */
const normalizeMethod = (method: string | undefined): string => method?.trim() ?? '';

/**
 * 既存の取引を編集して保存するときの集計フラグ（#99）
 *
 * メモを直しただけで支出の集計が変わらないよう、会計上の意味を保つ。
 * - 支出から外していた取引（affectsExpense = false。過去の「カード引き落とし」）は、
 *   何を編集しても外したまま。「購入月に計上済み」という意味は編集では変わらないため
 * - 支払方法が変わらなければ既存の取引タイプを保つ（記録後に設定で
 *   「現金扱い」を切り替えていても、過去の取引の扱いは変えない）
 * - 支払方法を変えたときだけ、今の設定から導出し直す
 */
export const resolveFlagsOnEdit = (
  existing: Pick<Transaction, 'paymentMethod' | 'transactionType' | 'affectsExpense'>,
  next: { category: string; paymentMethod?: string },
  rules: TransactionRules
): TransactionFlags => {
  const derived = rules.deriveTransactionFlags(next.category, next.paymentMethod || undefined);

  if (existing.affectsExpense === false) {
    return {
      transactionType: existing.transactionType ?? derived.transactionType,
      affectsExpense: false,
    };
  }

  if (normalizeMethod(existing.paymentMethod) === normalizeMethod(next.paymentMethod)) {
    return {
      transactionType: existing.transactionType ?? derived.transactionType,
      affectsExpense: true,
    };
  }

  return derived;
};
