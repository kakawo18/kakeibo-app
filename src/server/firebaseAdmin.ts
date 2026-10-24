/**
 * Firebase Admin SDK（サーバー専用）。使うのは Firestore だけ
 *
 * firebase-admin/auth は読み込まない（Vercel で読み込みに失敗する。ID トークンの検証は
 * oauth/firebaseIdToken.ts。ESLint でも禁止している）。
 *
 * Admin SDK は firestore.rules を通らない。利用者のデータは kakeiboReader.ts の関数で、
 * 必ず uid を指定して読むこと（docs/claude-connector/仕様書.md 7.2）。
 */
import 'server-only';
import './timezone';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const createApp = (): App => {
  // エミュレータ（FIRESTORE_EMULATOR_HOST が設定されている）なら認証情報は要らない
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-kakeibo',
    });
  }
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not set');
  // サービスアカウントの JSON を base64 にした値（docs/claude-connector/手順書.md 2.2）
  return initializeApp({
    credential: cert(JSON.parse(Buffer.from(key, 'base64').toString('utf8'))),
  });
};

// 初期化は最初に使うときまで遅らせる（環境変数の無いビルドでも読み込めるように）
let app: App | undefined;
const getApp = (): App => (app ??= getApps()[0] ?? createApp());

export const adminDb = () => getFirestore(getApp());
