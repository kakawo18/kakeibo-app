/**
 * Firebase Auth の利用者の状態を引く（Claude との接続を、パスワードの変更などに追従させる。#178）
 *
 * Claude との接続（リフレッシュトークン）は Firebase のログイン状態と別に保存しているので、
 * そのままではパスワードを変えても切れない。リフレッシュのたびにここで利用者の状態を引き、
 * 接続を作った後にパスワードの変更やセッションの失効があれば、接続を消す（tokenEndpoint.ts）。
 *
 * firebase-admin/auth は Vercel で読み込めないので使わず、Identity Toolkit の REST（accounts:lookup）を
 * サービスアカウントのアクセストークンで呼ぶ。サービスアカウントに Firebase Authentication の閲覧の権限
 * （roles/firebaseauth.viewer）が要る（手順書 2.2）。
 */
import 'server-only';
import { adminAccessToken } from '../firebaseAdmin';

export interface FirebaseAccountState {
  /** アカウントが削除されていれば false */
  exists: boolean;
  disabled: boolean;
  /**
   * これより前に発行されたセッションは無効（ミリ秒。UNIX 時間）
   * パスワードの変更・再設定とセッションの失効（revokeRefreshTokens）で進む。
   */
  validSinceMs: number;
}

interface LookupResponse {
  users?: { validSince?: string; passwordUpdatedAt?: number; disabled?: boolean }[];
}

/** accounts:lookup の応答から状態を読む */
export const toAccountState = (body: LookupResponse): FirebaseAccountState => {
  const [user] = body.users ?? [];
  if (!user) return { exists: false, disabled: false, validSinceMs: 0 };
  const validSinceMs = Math.max(Number(user.validSince ?? 0) * 1000 || 0, user.passwordUpdatedAt ?? 0);
  return { exists: true, disabled: user.disabled === true, validSinceMs };
};

/** 接続を消すべきか。アカウントが無い・無効、または接続を作った後にセッションが失効していれば true */
export const isConnectionRevokedBy = (account: FirebaseAccountState, connectedAtMs: number): boolean =>
  !account.exists || account.disabled || account.validSinceMs > connectedAtMs;

/**
 * uid の利用者の状態を引く。通信や権限の失敗は例外（呼ぶ側で、接続を消さずに一時的なエラーにする）
 *
 * 開発中に Auth エミュレータを使っているときはエミュレータに問い合わせる（エミュレータは
 * `Bearer owner` を管理者として扱う）。
 */
export const lookupFirebaseAccount = async (uid: string): Promise<FirebaseAccountState> => {
  if (!uid) throw new Error('uid is required');
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('Firebase project ID is not set');

  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const base = emulatorHost
    ? `http://${emulatorHost}/identitytoolkit.googleapis.com`
    : 'https://identitytoolkit.googleapis.com';
  const accessToken = emulatorHost ? 'owner' : await adminAccessToken();

  const response = await fetch(`${base}/v1/projects/${encodeURIComponent(projectId)}/accounts:lookup`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ localId: [uid] }),
    cache: 'no-store',
  });
  // 応答の本文には利用者の情報が入るので、失敗してもログには状態コードだけを出す
  if (!response.ok) throw new Error(`accounts:lookup failed with status ${response.status}`);
  return toAccountState((await response.json()) as LookupResponse);
};
