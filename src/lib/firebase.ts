import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  Firestore,
  getFirestore,
  initializeFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
  clearIndexedDbPersistence,
} from 'firebase/firestore';

// 環境変数の存在確認（ビルド時エラー回避）
const requiredEnvVars = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
};

// 環境変数のバリデーション（実行時のみ）
if (typeof window !== 'undefined') {
  const missingVars = Object.entries(requiredEnvVars)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    console.error(`Missing required Firebase environment variables: ${missingVars.join(', ')}`);
    console.error('Please check your .env.local file and ensure all Firebase configuration values are set.');
  }
}

// ビルド時の環境変数チェック（サーバーサイドでのみ実行）
if (typeof window === 'undefined') {
  const hasAllEnvVars = Object.values(requiredEnvVars).every(value => value !== '');
  if (!hasAllEnvVars && process.env.NODE_ENV === 'production') {
    console.warn('Missing required Firebase environment variables in production build');
    // 開発時はエラーを投げずに警告のみ
  }
}

const firebaseConfig = {
  // apiKeyが空だとビルド時のプリレンダリング（SSR）で getAuth が
  // auth/invalid-api-key を投げてビルド自体が失敗するため、
  // 環境変数未設定時はプレースホルダーで初期化する（実際の認証は環境変数が必要）
  apiKey: requiredEnvVars.apiKey || 'missing-api-key',
  authDomain: requiredEnvVars.authDomain || 'missing.firebaseapp.com',
  projectId: requiredEnvVars.projectId || 'missing-project',
  storageBucket: requiredEnvVars.storageBucket,
  messagingSenderId: requiredEnvVars.messagingSenderId,
  appId: requiredEnvVars.appId || 'missing-app-id',
};

// HMR等での二重初期化を防止
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

/**
 * Firestore を端末の永続キャッシュ（IndexedDB）付きで作る（#126）
 *
 * 一度読み込んだ取引・設定を端末に残し、オフラインでアプリを起動し直しても表示できるようにする。
 * オフライン中の書き込みも端末に保存され、通信が戻ると送信される。
 * 複数のタブで開いても1つのキャッシュを共有する（persistentMultipleTabManager）。
 * サーバー側（ビルド時のプリレンダリング）には IndexedDB が無いので既定のメモリキャッシュ。
 */
const createFirestore = (): Firestore => {
  if (typeof window === 'undefined') return getFirestore(app);
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // HMR で2回目に評価されたときは初期化済みのものを使う
    return getFirestore(app);
  }
};

export const db = createFirestore();

/**
 * 端末に残した Firestore のキャッシュを消す（ログアウト時）
 *
 * 共有端末で前のユーザーの家計データが端末に残らないようにする。
 * 消した後は Firestore を使えなくなるため、呼び出し側でページを読み込み直すこと。
 * 別のタブが開いていると消せない（そのタブを閉じれば次回ログアウト時に消える）。
 */
export const clearLocalFirestoreCache = async (): Promise<void> => {
  await terminate(db);
  try {
    await clearIndexedDbPersistence(db);
  } catch (error) {
    console.error('Failed to clear local Firestore cache:', error);
  }
};

// Firebase App Check（任意）
// Firebase の設定値はクライアントに露出する前提のため、これが無いと
// アプリの画面を経由しないスクリプトからも API を叩ける。
// NEXT_PUBLIC_RECAPTCHA_SITE_KEY を設定すると有効になる。
// 未設定なら何もしない（App Check のコードはバンドルにも載らない）。
const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
if (typeof window !== 'undefined' && recaptchaSiteKey) {
  import('firebase/app-check')
    .then(({ initializeAppCheck, ReCaptchaV3Provider }) => {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    })
    .catch((error) => {
      console.error('Failed to initialize App Check:', error);
    });
}

// ローカル開発用: NEXT_PUBLIC_FIREBASE_EMULATOR=1 のときエミュレータに接続
if (
  process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === '1' &&
  typeof window !== 'undefined'
) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

export default app;