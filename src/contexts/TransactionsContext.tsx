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
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Transaction, TransactionInput, TransactionKind, TransactionType } from '@/types';

// Firestore用のクリーンなトランザクションデータの型定義
interface CleanTransactionData {
  type?: TransactionKind;
  amount?: number;
  category?: string;
  date?: Timestamp;
  transactionType?: TransactionType;
  affectsExpense?: boolean;
  affectsBalance?: boolean;
  subcategory?: string;
  paymentMethod?: string;
  description?: string;
}

// トランザクションデータをFirestore用にクリーニングするヘルパー関数
// （undefined のフィールドを除去し、文字列はトリムする）
const cleanTransactionData = (transaction: Partial<Transaction>): CleanTransactionData => {
  const cleaned: CleanTransactionData = {};

  if (transaction.type !== undefined) {
    cleaned.type = transaction.type;
  }
  if (transaction.amount !== undefined) {
    cleaned.amount = transaction.amount;
  }
  if (transaction.category !== undefined) {
    cleaned.category = transaction.category;
  }
  if (transaction.date !== undefined) {
    cleaned.date = Timestamp.fromDate(
      transaction.date instanceof Date ? transaction.date : new Date(transaction.date)
    );
  }
  if (transaction.transactionType !== undefined) {
    cleaned.transactionType = transaction.transactionType;
  }
  if (transaction.affectsExpense !== undefined) {
    cleaned.affectsExpense = transaction.affectsExpense;
  }
  if (transaction.affectsBalance !== undefined) {
    cleaned.affectsBalance = transaction.affectsBalance;
  }

  // subcategory と paymentMethod: 値がある場合のみ追加、空文字列は除外
  if (transaction.subcategory && transaction.subcategory.trim()) {
    cleaned.subcategory = transaction.subcategory.trim();
  }
  if (transaction.paymentMethod && transaction.paymentMethod.trim()) {
    cleaned.paymentMethod = transaction.paymentMethod.trim();
  }

  // description: 空文字列での削除に対応するため、undefinedでない場合は常に設定
  if (transaction.description !== undefined) {
    cleaned.description = transaction.description.trim() || '';
  }

  return cleaned;
};

interface TransactionsContextType {
  transactions: Transaction[];
  loading: boolean;
  addTransaction: (transaction: TransactionInput) => Promise<void>;
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
          // データの型安全性を確保（金額0の取引は有効なので == null で判定）
          if (!data.type || data.amount == null || !data.category || !data.date) {
            console.warn('Incomplete transaction data:', docSnapshot.id, data);
            return;
          }

          transactionList.push({
            id: docSnapshot.id,
            userId: data.userId,
            type: data.type,
            amount: Number(data.amount),
            category: data.category,
            subcategory: data.subcategory || undefined,
            paymentMethod: data.paymentMethod || undefined,
            transactionType: data.transactionType || 'normal',
            affectsExpense: data.affectsExpense !== undefined ? data.affectsExpense : true,
            affectsBalance: data.affectsBalance !== undefined ? data.affectsBalance : true,
            date: data.date?.toDate() || new Date(),
            description: data.description || undefined,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          });
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

      const now = new Date();
      const cleanedData = cleanTransactionData({
        ...transaction,
        transactionType: transaction.transactionType || 'normal',
        affectsExpense: transaction.affectsExpense !== undefined ? transaction.affectsExpense : true,
        affectsBalance: transaction.affectsBalance !== undefined ? transaction.affectsBalance : true,
      });

      const transactionData = {
        ...cleanedData,
        userId: user.uid,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
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

  const updateTransaction = useCallback(
    async (id: string, updates: Partial<Transaction>) => {
      if (!user) return;

      const updateData = {
        ...cleanTransactionData(updates),
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
    () => ({ transactions, loading, addTransaction, updateTransaction, deleteTransaction }),
    [transactions, loading, addTransaction, updateTransaction, deleteTransaction]
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
