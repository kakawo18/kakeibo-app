/**
 * 定期取引の Firestore 保存形式との変換
 *
 * 取引と同じく、作成と部分更新で関数を分ける（#98）。
 * 更新では undefined = 変更しない / 空文字 = 項目を消す（deleteField）。
 */
import { DocumentData, FieldValue, deleteField } from 'firebase/firestore';
import { RecurringTransaction } from '@/types';

export type RecurringTransactionInput = Omit<
  RecurringTransaction,
  'id' | 'userId' | 'createdAt' | 'updatedAt'
>;

const trimmedOrUndefined = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

/** 作成時に書き込むデータ。空の任意項目はキーごと書かない */
export const toRecurringCreateData = (input: RecurringTransactionInput): DocumentData => {
  const subcategory = trimmedOrUndefined(input.subcategory);
  const paymentMethod = trimmedOrUndefined(input.paymentMethod);
  return {
    name: input.name.trim(),
    amount: input.amount,
    category: input.category,
    dayOfMonth: input.dayOfMonth,
    isEnabled: input.isEnabled,
    ...(subcategory ? { subcategory } : {}),
    ...(paymentMethod ? { paymentMethod } : {}),
  };
};

/** 部分更新で書き込むデータ */
export const toRecurringUpdateData = (
  updates: Partial<RecurringTransactionInput>
): Record<string, unknown> => {
  const data: Record<string, unknown> = {};

  if (updates.name !== undefined) data.name = updates.name.trim();
  if (updates.amount !== undefined) data.amount = updates.amount;
  if (updates.category !== undefined) data.category = updates.category;
  if (updates.dayOfMonth !== undefined) data.dayOfMonth = updates.dayOfMonth;
  if (updates.isEnabled !== undefined) data.isEnabled = updates.isEnabled;

  const optional = (value: string | undefined): string | FieldValue | undefined =>
    value === undefined ? undefined : trimmedOrUndefined(value) ?? deleteField();

  const subcategory = optional(updates.subcategory);
  if (subcategory !== undefined) data.subcategory = subcategory;
  const paymentMethod = optional(updates.paymentMethod);
  if (paymentMethod !== undefined) data.paymentMethod = paymentMethod;

  return data;
};

export const fromRecurringDoc = (
  id: string,
  userId: string,
  data: DocumentData
): RecurringTransaction => ({
  id,
  userId,
  name: data.name,
  amount: data.amount,
  category: data.category,
  subcategory: data.subcategory || undefined,
  paymentMethod: data.paymentMethod || undefined,
  dayOfMonth: data.dayOfMonth,
  isEnabled: data.isEnabled,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});
