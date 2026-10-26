/**
 * Claude からの記録・編集の入力の検査と整え（docs/claude-connector/書き込み仕様書.md 5章・6章）
 *
 * 確認のツールはここで整えた内容を利用者に見せ、確認トークンに入れる。記録のツールは、トークンの内容を
 * その時点の設定でもう一度ここに通してから書く（確認から記録までの間に設定が変わった場合に備える）。
 * 基準はアプリの画面と同じ（src/utils/validation.ts・アーカイブしたカテゴリを選べないこと・
 * 集計のフラグは createTransactionRules / resolveFlagsOnEdit）。Firestore には触れない純関数にする。
 */
import 'server-only';
import { CategorySetting, SubcategorySetting, Transaction, TransactionInput, TransactionKind, UserSettings } from '@/types';
import { CategoryLike, TransactionRules, createTransactionRules, resolveFlagsOnEdit } from '@/domain/transactionRules';
import { formatDate } from '@/utils/dateUtils';
import { validateAmount, validateDescription } from '@/utils/validation';
import { UserFacingError } from '../errors';
import { parseDay } from './dates';

/** preview_add_transaction の入力 */
export interface NewTransactionRequest {
  date: string;
  type: TransactionKind;
  amount: number;
  category: string;
  subcategory?: string;
  paymentMethod?: string;
  description?: string;
}

/** 確認した追加の内容（カテゴリは今の名前、値は整えた後）。確認トークンに入れる */
export interface TransactionDraft {
  date: string;
  type: TransactionKind;
  amount: number;
  category: string;
  subcategory?: string;
  paymentMethod?: string;
  description: string;
}

/**
 * preview_update_transaction の入力と、確認した編集の内容（変わる項目だけ）。
 * 指定しない項目は変えない。サブカテゴリ・支払方法・メモの空文字は消す
 */
export interface TransactionChanges {
  date?: string;
  amount?: number;
  category?: string;
  subcategory?: string;
  paymentMethod?: string;
  description?: string;
}

/** 利用者に見せる取引の形 */
export interface TransactionView {
  id?: string;
  date: string;
  type: TransactionKind;
  category: string;
  subcategory: string | null;
  paymentMethod: string | null;
  amount: number;
  description: string | null;
  /** アプリの集計での扱い */
  accounting: string;
}

export interface DraftWarning {
  kind: 'possible_duplicate' | 'future_date';
  message: string;
  transactions?: TransactionView[];
}

const FIELD_ORDER = ['date', 'amount', 'category', 'subcategory', 'paymentMethod', 'description'] as const;
export type ChangedField = (typeof FIELD_ORDER)[number];

type ViewSource = CategoryLike &
  Pick<Transaction, 'type' | 'amount' | 'date'> &
  Partial<Pick<Transaction, 'id' | 'paymentMethod' | 'description'>>;

const kindLabel = (type: TransactionKind) => (type === 'income' ? '収入' : '支出');

/** アプリの集計でどう扱われるか（役割の付いたカテゴリを選んだことに、承認の前に気づけるように） */
export const describeAccounting = (t: CategoryLike & Pick<Transaction, 'type'>, rules: TransactionRules): string => {
  if (t.type === 'income') return rules.isExcludedFromIncome(t) ? '立替回収（収入に含めない）' : '収入に含める';
  if (rules.isInvestment(t)) return '投資として別に集計（支出に含めない）';
  if (rules.isAdvancePayment(t)) return '立替金（支出に含めない）';
  if (t.affectsExpense === false) return '支出に含めない';
  return '支出に含める';
};

export const toTransactionView = (t: ViewSource, rules: TransactionRules): TransactionView => ({
  ...(t.id ? { id: t.id } : {}),
  date: formatDate(t.date),
  type: t.type,
  category: rules.categoryName(t),
  subcategory: rules.subcategoryName(t) ?? null,
  paymentMethod: t.paymentMethod || null,
  amount: t.amount,
  description: t.description || null,
  accounting: describeAccounting(t, rules),
});

// ============================================================
// 項目ごとの検査
// ============================================================

const checkAmount = (amount: number): number => {
  if (!Number.isInteger(amount)) throw new UserFacingError('金額は円の整数で指定してください');
  const error = validateAmount(amount);
  if (error) throw new UserFacingError(error);
  return amount;
};

const checkDescription = (description: string | undefined): string => {
  const trimmed = (description ?? '').trim();
  const error = validateDescription(trimmed);
  if (error) throw new UserFacingError(error);
  return trimmed;
};

const checkDate = (date: string): string => {
  parseDay(date, 'date');
  return date;
};

/** 記録に使えるカテゴリ（その種類の、アーカイブしていないもの）。今の名前でだけ受け付ける */
const resolveCategory = (settings: UserSettings, type: TransactionKind, name: string): CategorySetting => {
  const trimmed = name.trim();
  // 収入と支出で同じ名前（「その他」など）があるので、種類の合うほうを先に探す
  const category =
    settings.categories.find((c) => c.name === trimmed && c.type === type) ??
    settings.categories.find((c) => c.name === trimmed);
  if (!category) {
    const renamed = settings.categories.find((c) => c.type === type && c.aliases?.includes(trimmed));
    if (renamed) {
      throw new UserFacingError(`カテゴリ「${trimmed}」は「${renamed.name}」に改名されています。今の名前で指定してください`);
    }
    throw new UserFacingError(`カテゴリ「${trimmed}」はありません。get_kakeibo_overview が返す今の名前で指定してください`);
  }
  if (category.type !== type) {
    throw new UserFacingError(`「${trimmed}」は${kindLabel(category.type)}のカテゴリです`);
  }
  if (category.archived) throw new UserFacingError(`カテゴリ「${trimmed}」はアーカイブされているので使えません`);
  return category;
};

const resolveSubcategory = (category: CategorySetting, name: string): SubcategorySetting => {
  const trimmed = name.trim();
  const subcategory = category.subcategories.find((s) => s.name === trimmed);
  if (!subcategory) {
    const renamed = category.subcategories.find((s) => s.aliases?.includes(trimmed));
    if (renamed) {
      throw new UserFacingError(`サブカテゴリ「${trimmed}」は「${renamed.name}」に改名されています。今の名前で指定してください`);
    }
    throw new UserFacingError(`「${category.name}」にサブカテゴリ「${trimmed}」はありません`);
  }
  if (subcategory.archived) throw new UserFacingError(`サブカテゴリ「${trimmed}」はアーカイブされているので使えません`);
  return subcategory;
};

const resolvePaymentMethod = (settings: UserSettings, type: TransactionKind, name: string): string => {
  const trimmed = name.trim();
  if (type === 'income') throw new UserFacingError('収入には支払方法を付けません');
  if (!settings.paymentMethods.some((m) => m.name === trimmed)) {
    throw new UserFacingError(`支払方法「${trimmed}」はありません。get_kakeibo_overview が返す支払方法の名前で指定してください`);
  }
  return trimmed;
};

const futureDateWarning = (date: string, today: Date): DraftWarning[] =>
  date > formatDate(today) ? [{ kind: 'future_date', message: `${date} は今日より後の日付です` }] : [];

/** 確認から記録までの間に設定が変わって、内容が使えなくなったとき */
const redo = (error: unknown): never => {
  if (error instanceof UserFacingError) {
    throw new UserFacingError(`確認した内容が今の設定と合いません（${error.message}）。確認からやり直してください`);
  }
  throw error;
};

// ============================================================
// 追加
// ============================================================

export const draftNewTransaction = (
  request: NewTransactionRequest,
  settings: UserSettings,
  today: Date
): { draft: TransactionDraft; view: TransactionView; warnings: DraftWarning[] } => {
  const date = checkDate(request.date);
  const amount = checkAmount(request.amount);
  const category = resolveCategory(settings, request.type, request.category);
  const subcategory = request.subcategory?.trim() ? resolveSubcategory(category, request.subcategory).name : undefined;
  const paymentMethod = request.paymentMethod?.trim()
    ? resolvePaymentMethod(settings, request.type, request.paymentMethod)
    : undefined;
  const description = checkDescription(request.description);

  const draft: TransactionDraft = {
    date,
    type: request.type,
    amount,
    category: category.name,
    ...(subcategory ? { subcategory } : {}),
    ...(paymentMethod ? { paymentMethod } : {}),
    description,
  };
  const rules = createTransactionRules(settings);
  const flags = rules.deriveTransactionFlags(draft.category, draft.paymentMethod);
  const view = toTransactionView({ ...draft, date: parseDay(date, 'date'), ...flags }, rules);
  return { draft, view, warnings: futureDateWarning(date, today) };
};

/**
 * 確認した追加の内容を、今の設定で検査し直して保存する形にする
 *
 * 日付が今日なら記録した時刻、それ以外はその日の0時（アプリで記録したとき・日付を選んだときと同じ）。
 */
export const toNewTransactionInput = (draft: TransactionDraft, settings: UserSettings, now: Date): TransactionInput => {
  let checked: TransactionDraft;
  try {
    checked = draftNewTransaction(draft, settings, now).draft;
  } catch (error) {
    return redo(error);
  }
  const rules = createTransactionRules(settings);
  return {
    type: checked.type,
    amount: checked.amount,
    category: checked.category,
    subcategory: checked.subcategory,
    paymentMethod: checked.paymentMethod,
    date: checked.date === formatDate(now) ? now : parseDay(checked.date, 'date'),
    description: checked.description,
    ...rules.deriveTransactionFlags(checked.category, checked.paymentMethod),
  };
};

// ============================================================
// 編集
// ============================================================

/** 編集後の取引（保存されている名前のまま。カテゴリを変えない限り改名前の名前も残す） */
const applyChanges = (existing: Transaction, changes: TransactionChanges, rules: TransactionRules): Transaction => {
  const category = changes.category ?? existing.category;
  const paymentMethod =
    changes.paymentMethod !== undefined ? changes.paymentMethod || undefined : existing.paymentMethod;
  return {
    ...existing,
    ...(changes.date !== undefined ? { date: parseDay(changes.date, 'date') } : {}),
    ...(changes.amount !== undefined ? { amount: changes.amount } : {}),
    category,
    subcategory: changes.subcategory !== undefined ? changes.subcategory || undefined : existing.subcategory,
    paymentMethod,
    ...(changes.description !== undefined ? { description: changes.description || undefined } : {}),
    ...resolveFlagsOnEdit(existing, { category, paymentMethod }, rules),
  };
};

/**
 * 編集の内容を検査し、今と違う項目だけを changes にする
 *
 * 今と同じ値は変更なしとして扱う（カテゴリ・サブカテゴリは今の名前で比べる）。
 * カテゴリを変えてサブカテゴリを指定しなければ、サブカテゴリを消す（新しいカテゴリに属さないため）。
 * changedFields が空なら変えるものは無い（記録のツールでは、同じトークンの2回目がこれになる）。
 */
export const draftTransactionChange = (
  existing: Transaction,
  request: TransactionChanges,
  settings: UserSettings,
  today: Date
): {
  changes: TransactionChanges;
  changedFields: ChangedField[];
  before: TransactionView;
  after: TransactionView;
  warnings: DraftWarning[];
} => {
  const rules = createTransactionRules(settings);
  const currentCategory = rules.categoryName(existing);
  const currentSubcategory = rules.subcategoryName(existing);
  const changes: TransactionChanges = {};

  if (request.date !== undefined && checkDate(request.date) !== formatDate(existing.date)) {
    changes.date = request.date;
  }
  if (request.amount !== undefined && checkAmount(request.amount) !== existing.amount) {
    changes.amount = request.amount;
  }

  const categoryName = request.category?.trim();
  if (categoryName && categoryName !== currentCategory) {
    changes.category = resolveCategory(settings, existing.type, categoryName).name;
  }

  const subcategoryName = request.subcategory?.trim();
  if (subcategoryName) {
    if (changes.category !== undefined || subcategoryName !== currentSubcategory) {
      const targetName = changes.category ?? currentCategory;
      const target = settings.categories.find((c) => c.name === targetName && c.type === existing.type);
      if (!target) {
        throw new UserFacingError(`カテゴリ「${targetName}」が設定に無いため、サブカテゴリを指定できません`);
      }
      changes.subcategory = resolveSubcategory(target, subcategoryName).name;
    }
  } else if ((request.subcategory !== undefined || changes.category !== undefined) && existing.subcategory) {
    changes.subcategory = '';
  }

  if (request.paymentMethod !== undefined) {
    const method = request.paymentMethod.trim();
    if (method && method !== existing.paymentMethod) {
      changes.paymentMethod = resolvePaymentMethod(settings, existing.type, method);
    } else if (!method && existing.paymentMethod) {
      changes.paymentMethod = '';
    }
  }

  if (request.description !== undefined) {
    const description = checkDescription(request.description);
    if (description !== (existing.description ?? '')) changes.description = description;
  }

  const changedFields = FIELD_ORDER.filter((field) => changes[field] !== undefined);
  return {
    changes,
    changedFields,
    before: toTransactionView(existing, rules),
    after: toTransactionView(applyChanges(existing, changes, rules), rules),
    warnings: changes.date !== undefined ? futureDateWarning(changes.date, today) : [],
  };
};

/**
 * 確認した編集の内容を、今の取引と設定で検査し直して、書き込む項目にする。変えるものが無ければ null
 *
 * 集計のフラグはアプリの編集と同じく resolveFlagsOnEdit で決める（メモや金額だけを直したときに、
 * 支出の集計の扱いを変えない。#99）。
 */
export const toTransactionUpdates = (
  existing: Transaction,
  changes: TransactionChanges,
  settings: UserSettings,
  now: Date
): Partial<Transaction> | null => {
  let checked: TransactionChanges;
  try {
    const result = draftTransactionChange(existing, changes, settings, now);
    if (result.changedFields.length === 0) return null;
    checked = result.changes;
  } catch (error) {
    return redo(error);
  }
  const rules = createTransactionRules(settings);
  const after = applyChanges(existing, checked, rules);
  return {
    ...(checked.date !== undefined ? { date: after.date } : {}),
    ...(checked.amount !== undefined ? { amount: checked.amount } : {}),
    ...(checked.category !== undefined ? { category: checked.category } : {}),
    // 空文字はアプリの更新と同じく「項目を消す」（transactionSerializer）
    ...(checked.subcategory !== undefined ? { subcategory: checked.subcategory } : {}),
    ...(checked.paymentMethod !== undefined ? { paymentMethod: checked.paymentMethod } : {}),
    ...(checked.description !== undefined ? { description: checked.description } : {}),
    transactionType: after.transactionType,
    affectsExpense: after.affectsExpense,
  };
};
