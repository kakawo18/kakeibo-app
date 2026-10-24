/**
 * 認可コードとリフレッシュトークンの保存（Admin SDK。docs/claude-connector/仕様書.md 5.6・5.9）
 *
 * どちらもハッシュを ID にして保存する（値そのものは保存しない）。
 * クライアントからは firestore.rules で一切触らせない（Admin SDK だけが読み書きする）。
 * 期限切れのドキュメントは Firestore の TTL ポリシー（expiresAt）で消えるが、
 * 消えるのは最大で1日ほど遅れるので、ここでも必ず expiresAt を確かめる。
 */
import 'server-only';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '../firebaseAdmin';
import { randomToken, sha256Hex } from './random';

export const AUTHORIZATION_CODES = 'oauthAuthorizationCodes';
export const REFRESH_TOKENS = 'oauthRefreshTokens';

export const CODE_TTL_MS = 5 * 60 * 1000;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** 使用済みのリフレッシュトークンがこの時間内に再び使われたら、同時の更新とみなす */
export const REFRESH_REUSE_GRACE_MS = 60 * 1000;

// ============================================================
// 認可コード
// ============================================================

export interface AuthorizationGrant {
  uid: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
  resource: string;
}

/** 認可コードを発行して保存する。返すのはコードの値（保存はハッシュ） */
export const issueAuthorizationCode = async (grant: AuthorizationGrant, now: Date = new Date()): Promise<string> => {
  const code = randomToken();
  await adminDb()
    .doc(`${AUTHORIZATION_CODES}/${sha256Hex(code)}`)
    .create({
      ...grant,
      expiresAt: Timestamp.fromMillis(now.getTime() + CODE_TTL_MS),
      createdAt: Timestamp.fromDate(now),
    });
  return code;
};

/**
 * 認可コードを使う（1回限り）。読み出しと削除を同じトランザクションで行う
 * 無い・期限切れなら null（期限切れのものも削除する）
 */
export const consumeAuthorizationCode = (code: string, now: Date = new Date()): Promise<AuthorizationGrant | null> =>
  adminDb().runTransaction(async (tx) => {
    const ref = adminDb().doc(`${AUTHORIZATION_CODES}/${sha256Hex(code)}`);
    const snapshot = await tx.get(ref);
    const data = snapshot.data();
    if (!data) return null;
    tx.delete(ref);
    if ((data.expiresAt as Timestamp).toMillis() <= now.getTime()) return null;
    return {
      uid: data.uid,
      clientId: data.clientId,
      redirectUri: data.redirectUri,
      codeChallenge: data.codeChallenge,
      scope: data.scope,
      resource: data.resource,
    };
  });

// ============================================================
// リフレッシュトークン
// ============================================================

export interface RefreshGrant {
  uid: string;
  clientId: string;
  scope: string;
}

const refreshTokenData = (grant: RefreshGrant, familyId: string, now: Date) => ({
  ...grant,
  familyId,
  usedAt: null,
  expiresAt: Timestamp.fromMillis(now.getTime() + REFRESH_TOKEN_TTL_MS),
  createdAt: Timestamp.fromDate(now),
});

/** 最初の認可でリフレッシュトークンを発行する（新しい familyId を作る） */
export const issueRefreshToken = async (grant: RefreshGrant, now: Date = new Date()): Promise<string> => {
  const token = randomToken();
  await adminDb()
    .doc(`${REFRESH_TOKENS}/${sha256Hex(token)}`)
    .create(refreshTokenData(grant, randomToken(), now));
  return token;
};

export type RotateResult =
  | { ok: true; grant: RefreshGrant; refreshToken: string }
  | { ok: false; reason: 'not_found' | 'expired' | 'client_mismatch' | 'reused' | 'reused_within_grace' };

/**
 * リフレッシュトークンを使い、同じ familyId の新しいトークンに替える（ローテーション）
 *
 * 使用済みのトークンがもう一度使われたら、盗まれた可能性があるので familyId ごと消す。
 * ただし使用から60秒以内なら、Claude が同時に2回更新したとみなして消さない。
 */
export const rotateRefreshToken = (
  token: string,
  clientId: string,
  now: Date = new Date()
): Promise<RotateResult> =>
  adminDb().runTransaction(async (tx): Promise<RotateResult> => {
    const ref = adminDb().doc(`${REFRESH_TOKENS}/${sha256Hex(token)}`);
    const snapshot = await tx.get(ref);
    const data = snapshot.data();
    if (!data) return { ok: false, reason: 'not_found' };
    if ((data.expiresAt as Timestamp).toMillis() <= now.getTime()) return { ok: false, reason: 'expired' };
    if (data.clientId !== clientId) return { ok: false, reason: 'client_mismatch' };

    if (data.usedAt) {
      if (now.getTime() - (data.usedAt as Timestamp).toMillis() <= REFRESH_REUSE_GRACE_MS) {
        return { ok: false, reason: 'reused_within_grace' };
      }
      const family = await tx.get(adminDb().collection(REFRESH_TOKENS).where('familyId', '==', data.familyId));
      family.docs.forEach((doc) => tx.delete(doc.ref));
      return { ok: false, reason: 'reused' };
    }

    const grant: RefreshGrant = { uid: data.uid, clientId: data.clientId, scope: data.scope };
    const next = randomToken();
    tx.update(ref, { usedAt: Timestamp.fromDate(now) });
    tx.create(adminDb().doc(`${REFRESH_TOKENS}/${sha256Hex(next)}`), refreshTokenData(grant, data.familyId, now));
    return { ok: true, grant, refreshToken: next };
  });

/** uid のリフレッシュトークンをすべて消す（接続の解除）。消した件数を返す */
export const revokeRefreshTokensForUid = async (uid: string): Promise<number> => {
  if (!uid) throw new Error('uid is required');
  const snapshot = await adminDb().collection(REFRESH_TOKENS).where('uid', '==', uid).get();
  const writer = adminDb().bulkWriter();
  snapshot.docs.forEach((doc) => writer.delete(doc.ref));
  await writer.close();
  return snapshot.size;
};

/** uid に、まだ使える（未使用で期限内の）リフレッシュトークンがあるか */
export const hasActiveRefreshToken = async (uid: string, now: Date = new Date()): Promise<boolean> => {
  if (!uid) throw new Error('uid is required');
  const snapshot = await adminDb().collection(REFRESH_TOKENS).where('uid', '==', uid).get();
  return snapshot.docs.some((doc) => {
    const data = doc.data();
    return !data.usedAt && (data.expiresAt as Timestamp).toMillis() > now.getTime();
  });
};
