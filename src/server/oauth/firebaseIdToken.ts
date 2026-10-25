/**
 * Firebase の ID トークンの検証（同意画面で本人を確かめる。docs/claude-connector/仕様書.md 5.5）
 *
 * firebase-admin/auth は使わない。依存する jwks-rsa が ES モジュールの jose を require() で読み込み、
 * Vercel の Node.js 22（require(esm) に未対応の版）では読み込みに失敗して 500 になったため（v6.7.2）。
 * 代わりに Firebase が公開している手順（第三者の JWT ライブラリでの検証）どおりに jose で確かめる:
 * https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
 *
 * firebase-admin の verifyIdToken(token, true) と違い、失効（revokeRefreshTokens）は確かめない。
 * その代わり同意では authTime（最後にログインした時刻）が直近であることを求め、何か月も前から
 * ログインしたままのセッションでは同意させない（authorizeEndpoint.ts。#178）。
 */
import 'server-only';
import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose';
import type { JWTPayload, JWTVerifyGetKey } from 'jose';
import { isDevBypass } from './verifyMcpToken';

/** Firebase Auth が ID トークンの署名に使う公開鍵（JWK 形式） */
const FIREBASE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

/** 公開鍵はモジュールで1つだけ持ち、jose のキャッシュ（鍵の取り直しの間隔）を効かせる */
let firebaseKeys: JWTVerifyGetKey | undefined;
const defaultKeys = (): JWTVerifyGetKey => (firebaseKeys ??= createRemoteJWKSet(new URL(FIREBASE_JWKS_URL)));

/** 時計のずれとして許す秒数 */
const CLOCK_TOLERANCE_SECONDS = 60;

/** 検証した ID トークンの中身 */
export interface VerifiedIdToken {
  uid: string;
  /** 最後にパスワードなどでログインした時刻（秒。UNIX 時間）。ID トークンの自動更新では変わらない */
  authTime: number;
}

const checkClaims = (payload: JWTPayload, now: Date): VerifiedIdToken => {
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (!payload.sub) throw new Error('ID token has no subject');
  if (typeof payload.iat !== 'number' || payload.iat > nowSeconds + CLOCK_TOLERANCE_SECONDS) {
    throw new Error('ID token was issued in the future');
  }
  if (typeof payload.auth_time !== 'number' || payload.auth_time > nowSeconds + CLOCK_TOLERANCE_SECONDS) {
    throw new Error('ID token has no valid auth_time');
  }
  return { uid: payload.sub, authTime: payload.auth_time };
};

/**
 * ID トークンを検証して uid とログインした時刻を返す。不正なら例外
 *
 * 開発中に Auth エミュレータを使っているときは、エミュレータが署名なしのトークンを出すので
 * 署名だけは確かめない（開発用の認証の省略と同じ条件のときだけ）。
 */
export const verifyFirebaseIdToken = async (
  idToken: string,
  options: { projectId?: string; keys?: JWTVerifyGetKey; now?: Date } = {}
): Promise<VerifiedIdToken> => {
  const { projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, keys, now = new Date() } = options;
  if (!projectId) throw new Error('Firebase project ID is not set');
  const issuer = `https://securetoken.google.com/${projectId}`;

  if (!keys && isDevBypass() && process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    const payload = decodeJwt(idToken);
    if (payload.aud !== projectId || payload.iss !== issuer) throw new Error('ID token is not for this project');
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= now.getTime()) throw new Error('ID token expired');
    return checkClaims(payload, now);
  }

  const { payload } = await jwtVerify(idToken, keys ?? defaultKeys(), {
    algorithms: ['RS256'],
    issuer,
    audience: projectId,
    currentDate: now,
    clockTolerance: CLOCK_TOLERANCE_SECONDS,
  });
  return checkClaims(payload, now);
};
