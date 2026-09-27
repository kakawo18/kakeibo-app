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
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
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
import { writeTransactionsInBatches } from '@/data/transactionImport';

interface TransactionsContextType {
  transactions: Transaction[];
  loading: boolean;
  /**
   * 取引を1件追加する。options.id を渡すとその ID で書く（同じ ID なら上書きになり、
   * 複数端末から同時に記録しても1件にまとまる。定期取引の記録で使う）
   */
  addTransaction: (transaction: TransactionInput, options?: { id?: string }) => Promise<void>;
  /**
   * CSVインポート用の一括追加。500件ずつバッチ書き込みする。
   * 途中で失敗すると ImportWriteError（保存済みの件数つき）を投げる
   */
  addTransactions: (
    transactions: TransactionInput[],
    options?: { importId?: string }
  ) => Promise<number>;
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
    async (transaction: TransactionInput, options?: { id?: string }) => {
      if (!user) return;

      const now = Timestamp.fromDate(new Date());
      const transactionData = {
        ...toTransactionCreateData(transaction),
        userId: user.uid,
        createdAt: now,
        updatedAt: now,
      };

      try {
        if (options?.id) {
          await setDoc(doc(db, 'transactions', options.id), transactionData);
        } else {
          await addDoc(collection(db, 'transactions'), transactionData);
        }
      } catch (error) {
        console.error('Error adding transaction:', error);
        throw error;
      }
    },
    [user]
  );

  const addTransactions = useCallback(
    async (inputs: TransactionInput[], options?: { importId?: string }): Promise<number> => {
      if (!user || inputs.length === 0) return 0;
      // 500件ずつまとめて書く。importId を渡すと、同じファイルの取り込み直しで重複しない（#103）
      return writeTransactionsInBatches(db, user.uid, inputs, { importId: options?.importId });
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
