import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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
export const db = getFirestore(app);
export default app;