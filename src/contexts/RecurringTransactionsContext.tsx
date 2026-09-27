'use client';

/**
 * 定期取引の共有コンテキスト（#107）
 *
 * users/{uid}/recurringTransactions の onSnapshot 購読をアプリ全体で1本にする。
 * 以前は useRecurringTransactions を呼ぶコンポーネントごとに購読していたため、
 * ホームの通知と、閉じたままの管理モーダル（共通レイアウトと設定ページに1つずつ）が
 * 同じコレクションを重ねて購読していた。
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { RecurringTransaction, Transaction } from '@/types';
import { shouldShowRecurring } from '@/utils/recurring';
import {
  RecurringTransactionInput,
  fromRecurringDoc,
  toRecurringCreateData,
  toRecurringUpdateData,
} from '@/data/recurringTransactionSerializer';

type RecurringTransactionsContextType = {
  recurringTransactions: RecurringTransaction[];
  loading: boolean;
  error: Error | null;
  addRecurringTransaction: (data: RecurringTransactionInput) => Promise<void>;
  updateRecurringTransaction: (id: string, data: Partial<RecurringTransactionInput>) => Promise<void>;
  deleteRecurringTransaction: (id: string) => Promise<void>;
  getActiveRecurringTransactions: () => RecurringTransaction[];
  shouldShowRecurringTransaction: (
    recurring: RecurringTransaction,
    existingTransactions?: Transaction[]
  ) => boolean;
};

const RecurringTransactionsContext = createContext<RecurringTransactionsContextType | null>(null);

const NO_RECURRING: RecurringTransaction[] = [];

export const RecurringTransactionsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  // 受け取ったデータとエラーは「どのユーザーのものか」と一緒に持ち、
  // ユーザーが切り替わった直後に前のユーザーの定期取引が見えないようにする
  const [received, setReceived] = useState<{ uid: string; list: RecurringTransaction[] } | null>(null);
  const [failure, setFailure] = useState<{ uid: string; error: Error } | null>(null);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;

    const recurringTransactionsRef = collection(db, 'users', user.uid, 'recurringTransactions');
    const q = query(recurringTransactionsRef, orderBy('dayOfMonth', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const transactions = snapshot.docs.map((docSnapshot) =>
          fromRecurringDoc(docSnapshot.id, user.uid, docSnapshot.data())
        );
        setReceived({ uid, list: transactions });
      },
      (error) => {
        console.error('Error fetching recurring transactions:', error);
        setFailure({ uid, error });
      }
    );

    return () => unsubscribe();
  }, [user]);

  const current = user && received?.uid === user.uid ? received : null;
  const recurringTransactions = current?.list ?? NO_RECURRING;
  /** 取得に失敗したとき。管理画面に表示する（ホームの通知は出ないだけ。#105） */
  const error = user && failure?.uid === user.uid ? failure.error : null;
  const loading = Boolean(user) && !current && !error;

  const addRecurringTransaction = useCallback(async (data: RecurringTransactionInput) => {
    if (!user) throw new Error('User not authenticated');

    const recurringTransactionsRef = collection(db, 'users', user.uid, 'recurringTransactions');
    const now = Timestamp.now();

    await addDoc(recurringTransactionsRef, {
      ...toRecurringCreateData(data),
      createdAt: now,
      updatedAt: now,
    });
  }, [user]);

  const updateRecurringTransaction = useCallback(async (
    id: string,
    data: Partial<RecurringTransactionInput>
  ) => {
    if (!user) throw new Error('User not authenticated');

    // 省略した項目は変更しない。サブカテゴリ・支払方法の空文字は項目の削除（#98）
    const recurringTransactionRef = doc(db, 'users', user.uid, 'recurringTransactions', id);
    await updateDoc(recurringTransactionRef, {
      ...toRecurringUpdateData(data),
      updatedAt: Timestamp.now(),
    });
  }, [user]);

  const deleteRecurringTransaction = useCallback(async (id: string) => {
    if (!user) throw new Error('User not authenticated');

    const recurringTransactionRef = doc(db, 'users', user.uid, 'recurringTransactions', id);
    await deleteDoc(recurringTransactionRef);
  }, [user]);

  // 参照が安定するよう useCallback で包む（利用側の useMemo が毎レンダー無効化されるのを防ぐ）
  const getActiveRecurringTransactions = useCallback(() => {
    return recurringTransactions.filter((transaction) => transaction.isEnabled);
  }, [recurringTransactions]);

  // 判定の中身は utils/recurring.ts（定期取引 ID と対象月で記録済みを判定する。#101）
  const shouldShowRecurringTransaction = useCallback(
    (recurring: RecurringTransaction, existingTransactions: Transaction[] = []) =>
      shouldShowRecurring(recurring, existingTransactions),
    []
  );

  const value = useMemo(
    () => ({
      recurringTransactions,
      loading,
      error,
      addRecurringTransaction,
      updateRecurringTransaction,
      deleteRecurringTransaction,
      getActiveRecurringTransactions,
      shouldShowRecurringTransaction,
    }),
    [recurringTransactions, loading, error, addRecurringTransaction, updateRecurringTransaction, deleteRecurringTransaction, getActiveRecurringTransactions, shouldShowRecurringTransaction]
  );

  return (
    <RecurringTransactionsContext.Provider value={value}>{children}</RecurringTransactionsContext.Provider>
  );
};

export const useRecurringTransactions = () => {
  const context = useContext(RecurringTransactionsContext);
  if (!context) {
    throw new Error('useRecurringTransactions must be used within RecurringTransactionsProvider');
  }
  return context;
};
