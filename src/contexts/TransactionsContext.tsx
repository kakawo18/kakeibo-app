'use client';

/**
 * 取引データの共有コンテキスト
 *
 * Firestoreの onSnapshot 購読をアプリ全体で1本に集約する。
 * （以前は useTransactions を呼ぶコンポーネントごとにリスナーが張られ、
 * 同一クエリの購読が複数本走っていた）
 *
 * 利用側は useTransactions() を呼ぶだけでよい。
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Transaction, TransactionInput } from '@/types';
import {
  fromTransactionDoc,
  missingRequiredFields,
  toTransactionCreateData,
  toTransactionUpdateData,
} from '@/data/transactionSerializer';

/** writeBatch の上限（Firestore の制約） */
const WRITE_BATCH_LIMIT = 500;

interface TransactionsContextType {
  transactions: Transaction[];
  loading: boolean;
  addTransaction: (transaction: TransactionInput) => Promise<void>;
  /** CSVインポート用の一括追加。500件ずつバッチ書き込みする */
  addTransactions: (transactions: TransactionInput[]) => Promise<number>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
}

const TransactionsContext = createContext<TransactionsContextType | null>(null);

export const TransactionsProvider = ({ children }: { children: ReactNode }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const transactionList: Transaction[] = [];
        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data();
          const transaction = fromTransactionDoc(docSnapshot.id, data);
          if (!transaction) {
            // 取引の中身はコンソールに出さない（共有端末・拡張機能経由の漏洩を避ける）。
            // 調査に必要な「どのドキュメントの、どのフィールドが欠けているか」だけを出す。
            console.warn('Incomplete transaction data:', docSnapshot.id, missingRequiredFields(data));
            return;
          }
          transactionList.push(transaction);
        });
        setTransactions(transactionList);
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to transactions:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  const addTransaction = useCallback(
    async (transaction: TransactionInput) => {
      if (!user) return;

      const now = Timestamp.fromDate(new Date());
      const transactionData = {
        ...toTransactionCreateData(transaction),
        userId: user.uid,
        createdAt: now,
        updatedAt: now,
      };

      try {
        await addDoc(collection(db, 'transactions'), transactionData);
      } catch (error) {
        console.error('Error adding transaction:', error);
        throw error;
      }
    },
    [user]
  );

  const addTransactions = useCallback(
    async (inputs: TransactionInput[]): Promise<number> => {
      if (!user || inputs.length === 0) return 0;

      const now = Timestamp.fromDate(new Date());
      let written = 0;

      // 1件ずつ addDoc すると件数分の往復が発生するため、500件ずつまとめて書く
      for (let start = 0; start < inputs.length; start += WRITE_BATCH_LIMIT) {
        const chunk = inputs.slice(start, start + WRITE_BATCH_LIMIT);
        const batch = writeBatch(db);

        chunk.forEach((input) => {
          batch.set(doc(collection(db, 'transactions')), {
            ...toTransactionCreateData(input),
            userId: user.uid,
            createdAt: now,
            updatedAt: now,
          });
        });

        await batch.commit();
        written += chunk.length;
      }

      return written;
    },
    [user]
  );

  const updateTransaction = useCallback(
    async (id: string, updates: Partial<Transaction>) => {
      if (!user) return;

      // 省略した項目は変更しない。サブカテゴリ・支払方法の空文字は項目の削除（#98）
      const updateData = {
        ...toTransactionUpdateData(updates),
        updatedAt: Timestamp.fromDate(new Date()),
      };

      try {
        await updateDoc(doc(db, 'transactions', id), updateData);
      } catch (error) {
        console.error('Error updating transaction:', error);
        throw error;
      }
    },
    [user]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      if (!user) return;

      try {
        await deleteDoc(doc(db, 'transactions', id));
      } catch (error) {
        console.error('Error deleting transaction:', error);
        throw error;
      }
    },
    [user]
  );

  const value = useMemo(
    () => ({ transactions, loading, addTransaction, addTransactions, updateTransaction, deleteTransaction }),
    [transactions, loading, addTransaction, addTransactions, updateTransaction, deleteTransaction]
  );

  return <TransactionsContext.Provider value={value}>{children}</TransactionsContext.Provider>;
};

export const useTransactions = () => {
  const context = useContext(TransactionsContext);
  if (!context) {
    throw new Error('useTransactions must be used within TransactionsProvider');
  }
  return context;
};
