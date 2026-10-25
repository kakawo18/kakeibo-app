'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { waitForPendingWrites } from 'firebase/firestore';
import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { auth, db, clearLocalFirestoreCache } from '@/lib/firebase';

/** 未送信の変更が送れるのを待つ時間。これを過ぎたら未送信があるとみなす */
const PENDING_WRITES_WAIT_MS = 1500;

/** 未送信の変更が無い（または待つあいだに送れた）か */
const pendingWritesFlushed = (): Promise<boolean> =>
  Promise.race([
    waitForPendingWrites(db).then(() => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), PENDING_WRITES_WAIT_MS)),
  ]);

const confirmDiscardPendingWrites = (): Promise<boolean> =>
  new Promise((resolve) => {
    modals.openConfirmModal({
      title: '未送信の変更があります',
      children: (
        <Text size="sm">
          オフライン中に記録・編集した内容がまだ送信されていません。今ログアウトすると、その変更は失われます。通信が戻ってから（上の「未送信」の表示が消えてから）ログアウトしてください。
        </Text>
      ),
      labels: { confirm: '変更を捨ててログアウト', cancel: 'キャンセル' },
      confirmProps: { color: 'red' },
      onConfirm: () => resolve(true),
      // 最初に呼ばれた方が有効（確定のときも最後に onClose が呼ばれる）
      onClose: () => resolve(false),
    });
  });

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

// デフォルト値を持たせるとProvider外で使ってもエラーにならず気づけないため null にする
const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  /**
   * ログアウト（#126）
   *
   * 端末に残した Firestore のキャッシュ（家計データ）も消す。共有端末で次の人に残さないため。
   * 未送信の変更があるとキャッシュと一緒に消えてしまうので、先に確認する。
   * キャッシュを消すと Firestore を使えなくなるため、最後にページを読み込み直す。
   */
  const logout = useCallback(async () => {
    if (!(await pendingWritesFlushed()) && !(await confirmDiscardPendingWrites())) return;
    await signOut(auth);
    await clearLocalFirestoreCache();
    window.location.reload();
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      logout,
    }),
    [user, loading, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};