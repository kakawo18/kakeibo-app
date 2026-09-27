/**
 * 取引の Firestore 保存形式との変換
 *
 * 作成と部分更新で入力の意味が違うので、関数を分けている（#98）。
 * - 作成: 空の任意項目はキーごと書かない（Firestore は undefined を受け付けない）
 * - 更新: undefined = その項目は変更しない / 空文字 = 項目を消す（deleteField）
 *
 * 以前は1つの関数で両方を扱い、空の任意項目を書き込みから落としていた。
 * updateDoc は書かなかったフィールドを残すので、サブカテゴリや支払方法を
 * 空にして保存しても前の値が復活していた。
 */
import { DocumentData, FieldValue, Timestamp, deleteField } from 'firebase/firestore';
import { Transaction, TransactionInput, TransactionKind, TransactionType } from '@/types';

/** 作成時に書き込む取引データ（userId・作成/更新日時は呼び出し側で足す） */
export interface TransactionCreateData {
  type: TransactionKind;
  amount: number;
  category: string;
  date: Timestamp;
  transactionType: TransactionType;
  affectsExpense: boolean;
  subcategory?: string;
  paymentMethod?: string;
  description?: string;
}

/** 部分更新で書き込むデータ。任意項目は削除の指示（FieldValue）も取りうる */
export type TransactionUpdateData = Partial<
  Omit<TransactionCreateData, 'subcategory' | 'paymentMethod'>
> & {
  subcategory?: string | FieldValue;
  paymentMethod?: string | FieldValue;
};

const toTimestamp = (date: Date | string): Timestamp =>
  Timestamp.fromDate(date instanceof Date ? date : new Date(date));

/** 前後の空白を除き、空なら undefined */
const trimmedOrUndefined = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const toTransactionCreateData = (input: TransactionInput): TransactionCreateData => {
  const subcategory = trimmedOrUndefined(input.subcategory);
  const paymentMethod = trimmedOrUndefined(input.paymentMethod);

  return {
    type: input.type,
    amount: input.amount,
    category: input.category,
    date: toTimestamp(input.date),
    transactionType: input.transactionType || 'normal',
    affectsExpense: input.affectsExpense !== undefined ? input.affectsExpense : true,
    ...(subcategory ? { subcategory } : {}),
    ...(paymentMethod ? { paymentMethod } : {}),
    // メモは空文字でも書く（空で保存 = メモなし）
    ...(input.description !== undefined ? { description: input.description.trim() } : {}),
  };
};

/**
 * 任意の文字列項目の更新値
 * undefined → 変更しない / 空 → 削除 / 値あり → トリムして上書き
 */
const optionalFieldUpdate = (value: string | undefined): string | FieldValue | undefined => {
  if (value === undefined) return undefined;
  return trimmedOrUndefined(value) ?? deleteField();
};

export const toTransactionUpdateData = (
  updates: Partial<Transaction>
): TransactionUpdateData => {
  const data: TransactionUpdateData = {};

  if (updates.type !== undefined) data.type = updates.type;
  if (updates.amount !== undefined) data.amount = updates.amount;
  if (updates.category !== undefined) data.category = updates.category;
  if (updates.date !== undefined) data.date = toTimestamp(updates.date);
  if (updates.transactionType !== undefined) data.transactionType = updates.transactionType;
  if (updates.affectsExpense !== undefined) data.affectsExpense = updates.affectsExpense;

  const subcategory = optionalFieldUpdate(updates.subcategory);
  if (subcategory !== undefined) data.subcategory = subcategory;
  const paymentMethod = optionalFieldUpdate(updates.paymentMethod);
  if (paymentMethod !== undefined) data.paymentMethod = paymentMethod;

  // メモは空文字で上書きする（読み込み時に「メモなし」になる）
  if (updates.description !== undefined) data.description = updates.description.trim();

  return data;
};

/**
 * Firestore のドキュメントを取引に変換する。必須項目が欠けていれば null。
 * フラグを持たない古いデータは「通常の取引・支出に含める」として読む。
 */
export const fromTransactionDoc = (id: string, data: DocumentData): Transaction | null => {
  // 金額0の取引は有効なので == null で判定する
  if (!data.type || data.amount == null || !data.category || !data.date) return null;

  return {
    id,
    userId: data.userId,
    type: data.type,
    amount: Number(data.amount),
    category: data.category,
    subcategory: data.subcategory || undefined,
    paymentMethod: data.paymentMethod || undefined,
    transactionType: data.transactionType || 'normal',
    affectsExpense: data.affectsExpense !== undefined ? data.affectsExpense : true,
    date: data.date?.toDate() || new Date(),
    description: data.description || undefined,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  };
};

/** 必須項目のうち欠けているもの（ログ用。取引の中身は出さない） */
export const missingRequiredFields = (data: DocumentData): string[] =>
  (['type', 'amount', 'category', 'date'] as const).filter((field) =>
    field === 'amount' ? data.amount == null : !data[field]
  );
