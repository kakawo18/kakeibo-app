/**
 * 利用者の家計データを Admin SDK で読む（Claude 連携。docs/claude-connector/仕様書.md 7.2）
 *
 * Admin SDK は firestore.rules を通らないので、他人のデータを読まないことはこのファイルが保証する。
 * - どの関数も uid を最初の引数で受け取る。uid はトークンの検証結果からだけ渡すこと
 * - 取引のクエリは最初に userId で絞り、読んだ結果の userId ももう一度確かめる
 * - 設定と定期取引は users/{uid}/ の下だけを読む
 * Firestore を読むサーバーのコードは、このファイルの外に置かない。
 */
import 'server-only';
import { Query, QueryDocumentSnapshot, Timestamp } from 'firebase-admin/firestore';
import { RecurringTransaction, Transaction, UserSettings } from '@/types';
import { fromTransactionDoc } from '@/data/transactionSerializer';
import { deserializeSettings } from '@/data/settingsSerializer';
import { fromRecurringDoc } from '@/data/recurringTransactionSerializer';
import { adminDb } from './firebaseAdmin';
import { UserFacingError } from './errors';

/** 取引の期間。from は含む（date >= from）、before は含まない（date < before） */
export interface DateRange {
  from: Date;
  before: Date;
}

/** uid の取引だけを対象にしたクエリ。取引のクエリは必ずここから作る */
const ownTransactions = (uid: string): Query => {
  if (!uid) throw new Error('uid is required');
  return adminDb().collection('transactions').where('userId', '==', uid);
};

/** 読んだドキュメントを取引にする。所有者が違うもの・必須項目が欠けたものは捨てる */
const toOwnTransactions = (
  uid: string,
  docs: QueryDocumentSnapshot[]
): Transaction[] =>
  docs.flatMap((doc) => {
    const data = doc.data();
    if (data.userId !== uid) {
      // クエリで絞っているので起きないはず。起きたら中身は出さず ID だけ記録する
      console.error('kakeiboReader: userId mismatch', doc.id);
      return [];
    }
    const transaction = fromTransactionDoc(doc.id, data);
    return transaction ? [transaction] : [];
  });

/** uid の取引のうち、期間に入るものを日付の新しい順に読む */
export const readTransactions = async (uid: string, range: DateRange): Promise<Transaction[]> => {
  const snapshot = await ownTransactions(uid)
    .where('date', '>=', Timestamp.fromDate(range.from))
    .where('date', '<', Timestamp.fromDate(range.before))
    .orderBy('date', 'desc')
    .get();
  return toOwnTransactions(uid, snapshot.docs);
};

/** 最も古い取引と最も新しい取引の日付。取引が無ければ null */
export const readRecordedPeriod = async (
  uid: string
): Promise<{ first: Date; last: Date } | null> => {
  const [oldest, newest] = await Promise.all([
    ownTransactions(uid).orderBy('date', 'asc').limit(1).get(),
    ownTransactions(uid).orderBy('date', 'desc').limit(1).get(),
  ]);
  const [first] = toOwnTransactions(uid, oldest.docs);
  const [last] = toOwnTransactions(uid, newest.docs);
  return first && last ? { first: first.date, last: last.date } : null;
};

/** 設定（users/{uid}/settings/app）。まだ無ければ説明つきのエラー */
export const readSettings = async (uid: string): Promise<UserSettings> => {
  if (!uid) throw new Error('uid is required');
  const snapshot = await adminDb().doc(`users/${uid}/settings/app`).get();
  const data = snapshot.data();
  if (!data) {
    throw new UserFacingError(
      '家計簿の設定がまだありません。家計簿アプリを一度開いて、設定を作ってから試してください。'
    );
  }
  return deserializeSettings(data);
};

/** 定期取引（users/{uid}/recurringTransactions）を実行日の早い順に読む */
export const readRecurringTransactions = async (uid: string): Promise<RecurringTransaction[]> => {
  if (!uid) throw new Error('uid is required');
  const snapshot = await adminDb()
    .collection(`users/${uid}/recurringTransactions`)
    .orderBy('dayOfMonth', 'asc')
    .get();
  return snapshot.docs.map((doc) => fromRecurringDoc(doc.id, uid, doc.data()));
};
