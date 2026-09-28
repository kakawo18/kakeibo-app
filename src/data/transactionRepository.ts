/**
 * 取引（トップレベル transactions）の読み書き（#122）
 *
 * Firestore の操作と保存形式の変換をここに閉じ込め、Context は状態の配布と
 * 購読の開始・解除だけを持つ。db を引数で受け取るので、エミュレータのテストから
 * そのまま呼べる（transactionRepository.emulator.test.ts）。
 *
 * 書き込み関数は Firestore の Promise をそのまま返す（サーバーが受け取ると解決する）。
 * オフラインで待ち続けない扱いは呼び出し側（contexts/writeResult.ts の settle）が行う。
 */
import {
  Firestore,
  Timestamp,
  Unsubscribe,
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Transaction, TransactionInput } from '@/types';
import {
  fromTransactionDoc,
  missingRequiredFields,
  toTransactionCreateData,
  toTransactionUpdateData,
} from '@/data/transactionSerializer';

export interface SubscriptionHandlers<T> {
  onChange: (value: T) => void;
  onError: (error: Error) => void;
}

/**
 * ユーザーの取引を日付の新しい順に購読する
 *
 * 必須項目が欠けたドキュメントは飛ばす（取引の中身はログに出さず、ID と欠けた項目名だけ出す）。
 * 取引が0件のときも onChange([]) が呼ばれる。取得の失敗は onError（0件とは区別する。#105）。
 */
export const subscribeTransactions = (
  db: Firestore,
  uid: string,
  { onChange, onError }: SubscriptionHandlers<Transaction[]>
): Unsubscribe =>
  onSnapshot(
    query(collection(db, 'transactions'), where('userId', '==', uid), orderBy('date', 'desc')),
    (snapshot) => {
      const transactions: Transaction[] = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const transaction = fromTransactionDoc(docSnapshot.id, data);
        if (!transaction) {
          console.warn('Incomplete transaction data:', docSnapshot.id, missingRequiredFields(data));
          return;
        }
        transactions.push(transaction);
      });
      onChange(transactions);
    },
    onError
  );

/**
 * 取引を1件作る
 *
 * id を渡すとその ID で書く（同じ ID なら上書きになり、複数端末から同時に記録しても1件にまとまる。
 * 定期取引の記録で使う。#101）。渡さなければ自動の ID。
 */
export const createTransaction = (
  db: Firestore,
  uid: string,
  input: TransactionInput,
  { id, now = new Date() }: { id?: string; now?: Date } = {}
): Promise<unknown> => {
  const timestamp = Timestamp.fromDate(now);
  const data = {
    ...toTransactionCreateData(input),
    userId: uid,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return id
    ? setDoc(doc(db, 'transactions', id), data)
    : addDoc(collection(db, 'transactions'), data);
};

/**
 * 取引の一部を更新する
 *
 * undefined の項目は変更しない。サブカテゴリ・支払方法の空文字は項目の削除（#98）。
 * 所有者の確認は firestore.rules が行う（他人の取引は更新できない）。
 */
export const updateTransaction = (
  db: Firestore,
  id: string,
  updates: Partial<Transaction>,
  now: Date = new Date()
): Promise<void> =>
  updateDoc(doc(db, 'transactions', id), {
    ...toTransactionUpdateData(updates),
    updatedAt: Timestamp.fromDate(now),
  });

export const deleteTransaction = (db: Firestore, id: string): Promise<void> =>
  deleteDoc(doc(db, 'transactions', id));
