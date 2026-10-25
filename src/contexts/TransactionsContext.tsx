'use client';

/**
 * 取引データの共有コンテキスト
 *
 * Firestoreの onSnapshot 購読をアプリ全体で1本に集約する。
 * （以前は useTransactions を呼ぶコンポーネントごとにリスナーが張られ、
 * 同一クエリの購読が複数本走っていた）
 *
 * 利用側は useTransactions() を呼ぶだけでよい。
 *
 * 購読は「直近」と「過去」の2本に分けている（#125）。
 * - 直近: 今月を含む13か月（data/transactionWindow.ts の recentWindowStart 以降）。常に購読する
 * - 過去: それより前。過去の月・年を表示する画面や CSV の書き出しなどが ensureHistory() を
 *   呼んでから購読し、そのセッション中は続ける。起動時には読まない（起動を速くするため）
 * 期間が重ならないので、2本をつなげても重複しない。
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
import { mergeTransactionRanges, recentWindowStart } from '@/data/transactionWindow';
import { WriteResult } from '@/data/pendingWrite';
import { settle } from '@/contexts/writeResult';

/**
 * 過去（直近13か月より前）の取引の読み込み状態
 * - idle: まだ読んでいない（ensureHistory() を呼ぶと読み始める）
 * - loading: 読み込み中
 * - loaded: 読み込み済み（以後は変更も反映される）
 */
export type HistoryStatus = 'idle' | 'loading' | 'loaded';

interface TransactionsContextType {
  /** 読み込み済みの取引（日付の新しい順）。過去の分が未読なら直近の分だけ */
  transactions: Transaction[];
  loading: boolean;
  /** 直近の購読の開始日時。これより前の取引は historyStatus が loaded のときだけ含まれる */
  recentFrom: Date;
  historyStatus: HistoryStatus;
  /**
   * 過去の取引がサーバーで確認済みか
   *
   * loaded でも、オフラインで端末キャッシュから出しているだけのときは false
   * （キャッシュに無い分は欠けている可能性がある）。欠けていると困る判断
   * （カテゴリを削除してよいか・CSV を全件書き出せたか）はこちらを見る
   */
  historyComplete: boolean;
  /** 過去の取引の購読を始める（すでに始めていれば何もしない） */
  ensureHistory: () => void;
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

type Received = { uid: string; transactions: Transaction[] };

export const TransactionsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  // 受け取ったデータとエラーは「どのユーザーの、何回目の購読か」と一緒に持つ。
  // ユーザーが切り替わった直後に前のユーザーの取引や読み込み完了の状態が
  // 残って見えないよう、表示する値は下で現在のユーザー・購読に合うものだけにする（#105）
  const [attempt, setAttempt] = useState(0);
  const [recentReceived, setRecentReceived] = useState<Received | null>(null);
  const [olderReceived, setOlderReceived] = useState<Received | null>(null);
  const [olderSync, setOlderSync] = useState<{ uid: string; fromCache: boolean } | null>(null);
  const [failure, setFailure] = useState<{ uid: string; attempt: number; error: Error } | null>(null);
  // 直近と過去の境界。起動中は固定する（月が変わっても直近が1か月広がるだけで、欠けはしない）
  const [recentFrom] = useState(() => recentWindowStart(new Date()));
  // 過去の取引を読むよう頼まれたユーザー。起動時には読まず、必要な画面が ensureHistory() で頼む
  const [historyRequestedBy, setHistoryRequestedBy] = useState<string | null>(null);
  const historyRequested = Boolean(user) && historyRequestedBy === user?.uid;

  // 購読と保存形式の変換は data/transactionRepository.ts。ここは状態の配布と購読の開始・解除だけ（#122）
  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    return subscribeTransactions(
      db,
      uid,
      {
        onChange: (transactions) => setRecentReceived({ uid, transactions }),
        onError: (error) => {
          console.error('Error listening to recent transactions:', error);
          setFailure({ uid, attempt, error });
        },
      },
      { from: recentFrom }
    );
  }, [user, attempt, recentFrom]);

  useEffect(() => {
    if (!user || !historyRequested) return;
    const uid = user.uid;
    return subscribeTransactions(
      db,
      uid,
      {
        onChange: (transactions) => setOlderReceived({ uid, transactions }),
        onError: (error) => {
          console.error('Error listening to older transactions:', error);
          setFailure({ uid, attempt, error });
        },
      },
      {
        before: recentFrom,
        onSyncState: (fromCache) =>
          setOlderSync((prev) =>
            prev?.uid === uid && prev.fromCache === fromCache ? prev : { uid, fromCache }
          ),
      }
    );
  }, [user, attempt, recentFrom, historyRequested]);

  const recent = user && recentReceived?.uid === user.uid ? recentReceived.transactions : null;
  const older =
    user && historyRequested && olderReceived?.uid === user.uid ? olderReceived.transactions : null;
  const error =
    user && failure?.uid === user.uid && failure.attempt === attempt ? failure.error : null;
  const transactions = useMemo(
    () => (recent ? mergeTransactionRanges(recent, older ?? NO_TRANSACTIONS) : NO_TRANSACTIONS),
    [recent, older]
  );
  const historyStatus: HistoryStatus = !historyRequested ? 'idle' : older ? 'loaded' : 'loading';
  const historyComplete =
    historyStatus === 'loaded' && olderSync?.uid === user?.uid && olderSync?.fromCache === false;
  // ログイン中で、直近の取引もエラーもまだ届いていないあいだが読み込み中（過去の分は待たない）
  const loading = Boolean(user) && !error && !recent;

  const ensureHistory = useCallback(() => {
    if (user) setHistoryRequestedBy(user.uid);
  }, [user]);

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
      recentFrom,
      historyStatus,
      historyComplete,
      ensureHistory,
      error,
      retry,
      addTransaction,
      addTransactions,
      updateTransaction,
      deleteTransaction,
    }),
    [transactions, loading, recentFrom, historyStatus, historyComplete, ensureHistory, error, retry, addTransaction, addTransactions, updateTransaction, deleteTransaction]
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
