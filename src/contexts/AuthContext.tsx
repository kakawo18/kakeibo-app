'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { waitForPendingWrites } from 'firebase/firestore';
import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { auth, db, clearLocalFirestoreCache } from '@/lib/firebase';

/**
 * ID トークンがメールアドレス確認済み（email_verified）を持つか
 *
 * ルールが見るのはトークンの email_verified で、User.emailVerified ではない。起動時に Firebase は
 * アカウントの情報を読み直す（確認済みなら emailVerified が true になる）が、トークンは取り直さない。
 * 確認より前に発行されたトークン（有効期限は1時間）のまま購読すると permission-denied になるので、
 * 食い違っていればトークンを取り直す。確認のリンクから別のタブでアプリを開いたときなどに起きる。
 * オフラインで取り直せないときは端末の情報を使う（キャッシュから表示でき、通信が戻れば取り直せる）
 */
const hasVerifiedToken = async (user: User): Promise<boolean> => {
  try {
    const { claims } = await user.getIdTokenResult();
    if (claims.email_verified === true) return true;
    if (!user.emailVerified) return false;
    const refreshed = await user.getIdTokenResult(true);
    return refreshed.claims.email_verified === true;
  } catch {
    return user.emailVerified;
  }
};

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
  /**
   * メールアドレスを確認済みのユーザー（#164）。未ログイン・未確認なら null
   *
   * firestore.rules は確認済みのユーザーにしか家計データを読み書きさせないので、
   * データの購読（各 Context）はこちらを使い、未確認の間は購読しない
   */
  verifiedUser: User | null;
  loading: boolean;
  /**
   * 確認メールのリンクを開いた後に呼ぶ。サーバーから最新の状態を読み直し、
   * 確認済みになっていれば ID トークンも取り直す（ルールが見る email_verified はトークンに入っている）
   */
  refreshEmailVerification: () => Promise<boolean>;
  /**
   * トークンを取り直してページを読み込み直す（読み込みが permission-denied になったとき）
   *
   * Firestore は、開いている通信に古いトークンを使い続けることがあるので、読み込み直して張り直す
   */
  reloadWithFreshToken: () => Promise<void>;
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
  // User の emailVerified は reload() で書き換わるだけで再描画されないので、別に持つ
  const [emailVerified, setEmailVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // トークンの確認は非同期なので、その間にログアウト・別のユーザーへの切り替えが起きたら古い結果を捨てる
    let generation = 0;
    const unsubscribe = onAuthStateChanged(auth, (next) => {
      const current = ++generation;
      if (!next) {
        setUser(null);
        setEmailVerified(false);
        setLoading(false);
        return;
      }
      // 確認済みかが決まるまで loading のままにする（確認の画面が一瞬出たり、古いトークンで購読したりしない）
      void hasVerifiedToken(next).then((verified) => {
        if (current !== generation) return;
        setUser(next);
        setEmailVerified(verified);
        setLoading(false);
      });
    });

    return unsubscribe;
  }, []);

  const refreshEmailVerification = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) return false;
    await current.reload();
    const verified = await hasVerifiedToken(current);
    setEmailVerified(verified);
    return verified;
  }, []);

  const reloadWithFreshToken = useCallback(async () => {
    try {
      await auth.currentUser?.getIdToken(true);
    } catch {
      // 取り直せなくても読み込み直す（オフラインなら、戻ってから再読み込みすればよい）
    }
    window.location.reload();
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

  const verifiedUser = user && emailVerified ? user : null;

  const value = useMemo(
    () => ({
      user,
      verifiedUser,
      loading,
      refreshEmailVerification,
      reloadWithFreshToken,
      logout,
    }),
    [user, verifiedUser, loading, refreshEmailVerification, reloadWithFreshToken, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};