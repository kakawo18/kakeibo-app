/**
 * 利用者の取引を Admin SDK で書く（Claude 連携の書き込み。docs/claude-connector/書き込み仕様書.md 9章）
 *
 * Admin SDK は firestore.rules を通らないので、他人のデータを書かないこと・ルールと同じ形で書くことは
 * このファイルが保証する。
 * - どの関数も uid を最初の引数で受け取る。uid はトークンの検証結果からだけ渡すこと
 * - 作成は userId に uid を書く。更新は、読んだドキュメントの userId が uid と一致するときだけ書く
 * - 保存の形はアプリと同じ規則（transactionSerializer の *Fields）で作り、ルールと同じ上限を確かめる
 * 利用者のデータを書くサーバーのコードは、このファイルの外に置かない。削除の関数は作らない。
 */
import 'server-only';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { Transaction, TransactionInput } from '@/types';
import {
  fromTransactionDoc,
  toTransactionCreateFields,
  toTransactionUpdateFields,
} from '@/data/transactionSerializer';
import { MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH } from '@/utils/validation';
import { adminDb } from './firebaseAdmin';
import { UserFacingError } from './errors';

/** gRPC の ALREADY_EXISTS（同じ ID のドキュメントがある） */
const ALREADY_EXISTS = 6;

const NOT_FOUND_MESSAGE = '取引が見つかりません。search_transactions で ID を確かめてください';

/**
 * firestore.rules の取引の検査と同じ基準（形と長さ）。サーバーの入力の検査を通った値なので、
 * ここで失敗するのは検査の漏れである。中身はログにもエラーにも出さない
 */
const assertStorable = (data: Record<string, unknown>): void => {
  // undefined（書かない）と null（消す）は検査しない
  const isShort = (key: string, max: number) =>
    data[key] == null || (typeof data[key] === 'string' && (data[key] as string).length <= max);
  const ok =
    (!('type' in data) || data.type === 'income' || data.type === 'expense') &&
    (!('amount' in data) || (typeof data.amount === 'number' && Number.isInteger(data.amount) && data.amount >= 0)) &&
    (!('category' in data) ||
      (typeof data.category === 'string' && data.category.length > 0 && data.category.length <= MAX_NAME_LENGTH)) &&
    isShort('subcategory', MAX_NAME_LENGTH) &&
    isShort('paymentMethod', MAX_NAME_LENGTH) &&
    isShort('description', MAX_DESCRIPTION_LENGTH);
  if (!ok) throw new Error('kakeiboWriter: transaction data does not match firestore.rules');
};

/**
 * uid の取引を、指定した ID で作る
 *
 * 同じ ID のドキュメントがもうあれば書かない（確認トークンのやり直しで二重に作らないため）。
 * そのときは、uid の取引なら既存の取引を返し、他人のものなら例外にする。
 */
export const createOwnTransaction = async (
  uid: string,
  id: string,
  input: TransactionInput,
  now: Date = new Date()
): Promise<{ transaction: Transaction; created: boolean }> => {
  if (!uid) throw new Error('uid is required');
  const fields = toTransactionCreateFields(input);
  assertStorable(fields);
  const timestamp = Timestamp.fromDate(now);
  const data = {
    ...fields,
    date: Timestamp.fromDate(fields.date),
    userId: uid,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const ref = adminDb().collection('transactions').doc(id);

  try {
    await ref.create(data);
  } catch (error) {
    if ((error as { code?: unknown }).code !== ALREADY_EXISTS) throw error;
    const existing = (await ref.get()).data();
    if (!existing || existing.userId !== uid) throw new Error('kakeiboWriter: transaction id collision');
    const transaction = fromTransactionDoc(id, existing);
    if (!transaction) throw new Error('kakeiboWriter: existing transaction is malformed');
    return { transaction, created: false };
  }

  const transaction = fromTransactionDoc(id, data);
  if (!transaction) throw new Error('kakeiboWriter: created transaction is malformed');
  return { transaction, created: true };
};

/**
 * uid の取引の一部を更新し、更新後の取引を返す
 *
 * undefined の項目は変更しない。サブカテゴリ・支払方法の空文字は項目の削除（アプリと同じ。#98）。
 * 無い取引・他人の取引は、どちらも同じ説明つきのエラーにする。
 */
export const updateOwnTransaction = async (
  uid: string,
  id: string,
  updates: Partial<Transaction>,
  now: Date = new Date()
): Promise<Transaction> => {
  if (!uid) throw new Error('uid is required');
  const { date, subcategory, paymentMethod, ...rest } = toTransactionUpdateFields(updates);
  assertStorable({ ...rest, subcategory, paymentMethod });
  const data = {
    ...rest,
    ...(date !== undefined ? { date: Timestamp.fromDate(date) } : {}),
    ...(subcategory !== undefined ? { subcategory: subcategory ?? FieldValue.delete() } : {}),
    ...(paymentMethod !== undefined ? { paymentMethod: paymentMethod ?? FieldValue.delete() } : {}),
    updatedAt: Timestamp.fromDate(now),
  };
  const ref = adminDb().collection('transactions').doc(id);

  await adminDb().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (snapshot.data()?.userId !== uid) throw new UserFacingError(NOT_FOUND_MESSAGE);
    tx.update(ref, data);
  });

  const updated = (await ref.get()).data();
  const transaction = updated ? fromTransactionDoc(id, updated) : null;
  if (!transaction) throw new Error('kakeiboWriter: updated transaction is malformed');
  return transaction;
};
