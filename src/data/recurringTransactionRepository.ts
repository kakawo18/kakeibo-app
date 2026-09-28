/**
 * 定期取引（users/{uid}/recurringTransactions）の読み書き（#122）
 *
 * 考え方は transactionRepository.ts と同じ。書き込みは Firestore の Promise をそのまま返す。
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
  updateDoc,
} from 'firebase/firestore';
import { RecurringTransaction } from '@/types';
import {
  RecurringTransactionInput,
  fromRecurringDoc,
  toRecurringCreateData,
  toRecurringUpdateData,
} from '@/data/recurringTransactionSerializer';
import { SubscriptionHandlers } from '@/data/transactionRepository';

const recurringCollection = (db: Firestore, uid: string) =>
  collection(db, 'users', uid, 'recurringTransactions');

/** 定期取引を実行日の早い順に購読する */
export const subscribeRecurringTransactions = (
  db: Firestore,
  uid: string,
  { onChange, onError }: SubscriptionHandlers<RecurringTransaction[]>
): Unsubscribe =>
  onSnapshot(
    query(recurringCollection(db, uid), orderBy('dayOfMonth', 'asc')),
    (snapshot) =>
      onChange(
        snapshot.docs.map((docSnapshot) => fromRecurringDoc(docSnapshot.id, uid, docSnapshot.data()))
      ),
    onError
  );

export const createRecurringTransaction = (
  db: Firestore,
  uid: string,
  input: RecurringTransactionInput,
  now: Date = new Date()
): Promise<unknown> => {
  const timestamp = Timestamp.fromDate(now);
  return addDoc(recurringCollection(db, uid), {
    ...toRecurringCreateData(input),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
};

/** 省略した項目は変更しない。サブカテゴリ・支払方法の空文字は項目の削除（#98） */
export const updateRecurringTransaction = (
  db: Firestore,
  uid: string,
  id: string,
  input: Partial<RecurringTransactionInput>,
  now: Date = new Date()
): Promise<void> =>
  updateDoc(doc(recurringCollection(db, uid), id), {
    ...toRecurringUpdateData(input),
    updatedAt: Timestamp.fromDate(now),
  });

export const deleteRecurringTransaction = (db: Firestore, uid: string, id: string): Promise<void> =>
  deleteDoc(doc(recurringCollection(db, uid), id));
