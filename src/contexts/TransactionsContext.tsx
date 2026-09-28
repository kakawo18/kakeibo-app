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
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Transaction, TransactionInput } from '@/types';
import {
  createTransaction,
  deleteTransaction as deleteTransactionDoc,
  subscribeTransactions,
  updateTransaction as updateTransactionDoc,
} from '@/data/transactionRepository';
import { writeTransactionsInBatches } from '@/data/transactionImport';
import { WriteResult } from '@/data/pendingWrite';
import { settle } from '@/contexts/writeResult';

interface TransactionsContextType {
  transactions: Transaction[];
  loading: boolean;
  /** 取得に失敗したときのエラー。0円や「取引なし」と区別するために使う（#105） */
  error: Error | null;
  /** 取得をやり直す */
  retry: () => void;
  /**
   * 取引を1件追加する。options.id を渡すとその ID で書く（同じ ID なら上書きになり、
   * 複数端末から同時に記録しても1件にまとまる。定期取引の記録で使う）
   */
  addTransaction: (transaction: TransactionInput, options?: { id?: string }) => Promise<WriteResult>;
  /**
   * CSVインポート用の一括追加。500件ずつバッチ書き込みする。
   * 途中で失敗すると ImportWriteError（保存済みの件数つき）を投げる
   */
  addTransactions: (
    transactions: TransactionInput[],
    options?: { importId?: string }
  ) => Promise<number>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<WriteResult>;
  deleteTransaction: (id: string) => Promise<WriteResult>;
}

const TransactionsContext = createContext<TransactionsContextType | null>(null);

/** 読み込み前・未ログインのときに返す空配列（毎回新しい配列を作らない） */
const NO_TRANSACTIONS: Transaction[] = [];

export const TransactionsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  // 受け取ったデータとエラーは「どのユーザーの、何回目の購読か」と一緒に持つ。
  // ユーザーが切り替わった直後に前のユーザーの取引や読み込み完了の状態が
  // 残って見えないよう、表示する値は下で現在のユーザー・購読に合うものだけにする（#105）
  const [attempt, setAttempt] = useState(0);
  const [received, setReceived] = useState<{ uid: string; transactions: Transaction[] } | null>(null);
  const [failure, setFailure] = useState<{ uid: string; attempt: number; error: Error } | null>(null);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;

    // 購読と保存形式の変換は data/transactionRepository.ts。ここは状態の配布と購読の開始・解除だけ（#122）
    const unsubscribe = subscribeTransactions(db, uid, {
      onChange: (transactions) => setReceived({ uid, transactions }),
      onError: (error) => {
        console.error('Error listening to transactions:', error);
        setFailure({ uid, attempt, error });
      },
    });

    return unsubscribe;
  }, [user, attempt]);

  const current = user && received?.uid === user.uid ? received : null;
  const error =
    user && failure?.uid === user.uid && failure.attempt === attempt ? failure.error : null;
  const transactions = current?.transactions ?? NO_TRANSACTIONS;
  // ログイン中で、データもエラーもまだ届いていないあいだが読み込み中
  const loading = Boolean(user) && !current && !error;

  /** 購読をやり直す（取得に失敗したときの再試行） */
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  const addTransaction = useCallback(
    async (transaction: TransactionInput, options?: { id?: string }): Promise<WriteResult> => {
      if (!user) throw new Error('User not authenticated');

      try {
        // オフラインではサーバーの確定を待たずに返す（端末に保存され、通信が戻ると送信される）
        return await settle(createTransaction(db, user.uid, transaction, { id: options?.id }));
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
    async (id: string, updates: Partial<Transaction>): Promise<WriteResult> => {
      if (!user) throw new Error('User not authenticated');

      try {
        // 省略した項目は変更しない。サブカテゴリ・支払方法の空文字は項目の削除（#98）
        return await settle(updateTransactionDoc(db, id, updates));
      } catch (error) {
        console.error('Error updating transaction:', error);
        throw error;
      }
    },
    [user]
  );

  const deleteTransaction = useCallback(
    async (id: string): Promise<WriteResult> => {
      if (!user) throw new Error('User not authenticated');

      try {
        return await settle(deleteTransactionDoc(db, id));
      } catch (error) {
        console.error('Error deleting transaction:', error);
        throw error;
      }
    },
    [user]
  );

  const value = useMemo(
    () => ({
      transactions,
      loading,
      error,
      retry,
      addTransaction,
      addTransactions,
      updateTransaction,
      deleteTransaction,
    }),
    [transactions, loading, error, retry, addTransaction, addTransactions, updateTransaction, deleteTransaction]
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
