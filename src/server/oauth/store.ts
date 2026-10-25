/**
 * 認可コードとリフレッシュトークンの保存（Admin SDK。docs/claude-connector/仕様書.md 5.6・5.9）
 *
 * どちらもハッシュを ID にして保存する（値そのものは保存しない）。
 * クライアントからは firestore.rules で一切触らせない（Admin SDK だけが読み書きする）。
 * 期限切れのドキュメントは deleteExpired（トークンを発行するたびに呼ぶ）で消す。
 * Firestore の TTL ポリシーは無料プランでは使えないため（v6.8.0）。消すのは発行のついでなので、
 * 読み出すときは必ず expiresAt も確かめる。
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
/**
 * 使用済みのリフレッシュトークンを残しておく時間（再使用の検出に使う）
 *
 * 更新は1時間ごとに起きるので、30日の期限まで残すと1つの接続で数百件が溜まる。
 * 使った時点で期限をここまで縮め、deleteExpired で消えるようにする。
 * これより後の再使用は「知らないトークン」として拒否される（接続ごとの削除はしない）。
 */
export const USED_REFRESH_TOKEN_RETENTION_MS = 24 * 60 * 60 * 1000;
/** deleteExpired が1回に消す件数の上限（1回の処理を軽く保つ。残りは次の発行のときに消える） */
const DELETE_EXPIRED_LIMIT = 200;

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

/**
 * リフレッシュトークンのドキュメント
 *
 * connectedAt は最初に許可した時刻で、ローテーションでも引き継ぐ（設定画面の接続の一覧に出す。#178）。
 * createdAt はそのトークンを発行した時刻なので、接続の中で最も新しいトークンの createdAt が最後に使われた時刻になる。
 */
const refreshTokenData = (grant: RefreshGrant, familyId: string, now: Date, connectedAt: Date = now) => ({
  ...grant,
  familyId,
  usedAt: null,
  expiresAt: Timestamp.fromMillis(now.getTime() + REFRESH_TOKEN_TTL_MS),
  createdAt: Timestamp.fromDate(now),
  connectedAt: Timestamp.fromDate(connectedAt),
});

/** 最初の認可でリフレッシュトークンを発行する（新しい familyId を作る） */
export const issueRefreshToken = async (grant: RefreshGrant, now: Date = new Date()): Promise<string> => {
  const token = randomToken();
  await adminDb()
    .doc(`${REFRESH_TOKENS}/${sha256Hex(token)}`)
    .create(refreshTokenData(grant, randomToken(), now));
  return token;
};

export interface ActiveRefreshToken {
  uid: string;
  familyId: string;
  /** 接続を最初に許可した時刻（ミリ秒）。connectedAt の無い古いドキュメントは createdAt */
  connectedAtMs: number;
}

/**
 * まだ使える（未使用で期限内の）リフレッシュトークンの持ち主と接続を読む。無ければ null
 *
 * ローテーションの前に Firebase の利用者の状態を確かめるために使う（tokenEndpoint.ts。#178）。
 * 外部への問い合わせをトランザクションの中で行わないよう、トランザクションの外で読む。
 */
export const findActiveRefreshToken = async (
  token: string,
  now: Date = new Date()
): Promise<ActiveRefreshToken | null> => {
  const data = (await adminDb().doc(`${REFRESH_TOKENS}/${sha256Hex(token)}`).get()).data();
  if (!data || data.usedAt || (data.expiresAt as Timestamp).toMillis() <= now.getTime()) return null;
  return {
    uid: data.uid,
    familyId: data.familyId,
    connectedAtMs: ((data.connectedAt ?? data.createdAt) as Timestamp).toMillis(),
  };
};

/** 接続（familyId）のトークンをすべて消す。消した件数を返す */
export const revokeFamily = async (familyId: string): Promise<number> => {
  if (!familyId) throw new Error('familyId is required');
  const snapshot = await adminDb().collection(REFRESH_TOKENS).where('familyId', '==', familyId).get();
  const writer = adminDb().bulkWriter();
  snapshot.docs.forEach((doc) => writer.delete(doc.ref));
  await writer.close();
  return snapshot.size;
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
    const retainedUntil = Math.min(
      (data.expiresAt as Timestamp).toMillis(),
      now.getTime() + USED_REFRESH_TOKEN_RETENTION_MS
    );
    tx.update(ref, { usedAt: Timestamp.fromDate(now), expiresAt: Timestamp.fromMillis(retainedUntil) });
    // connectedAt の無い古いドキュメント（v6.10 まで）は、そのトークンの発行時刻で代える
    const connectedAt = ((data.connectedAt ?? data.createdAt) as Timestamp).toDate();
    tx.create(
      adminDb().doc(`${REFRESH_TOKENS}/${sha256Hex(next)}`),
      refreshTokenData(grant, data.familyId, now, connectedAt)
    );
    return { ok: true, grant, refreshToken: next };
  });

/**
 * 期限切れの認可コードとリフレッシュトークンを消す（TTL ポリシーの代わり）。消した件数を返す
 *
 * expiresAt だけの条件なので、単一フィールドの自動インデックスで足りる。
 */
export const deleteExpired = async (now: Date = new Date()): Promise<number> => {
  const cutoff = Timestamp.fromDate(now);
  const snapshots = await Promise.all(
    [AUTHORIZATION_CODES, REFRESH_TOKENS].map((collection) =>
      adminDb().collection(collection).where('expiresAt', '<=', cutoff).limit(DELETE_EXPIRED_LIMIT).get()
    )
  );
  const writer = adminDb().bulkWriter();
  snapshots.forEach((snapshot) => snapshot.docs.forEach((doc) => writer.delete(doc.ref)));
  await writer.close();
  return snapshots.reduce((sum, snapshot) => sum + snapshot.size, 0);
};

/** uid のリフレッシュトークンをすべて消す（すべての接続の解除）。消した件数を返す */
export const revokeRefreshTokensForUid = async (uid: string): Promise<number> => {
  if (!uid) throw new Error('uid is required');
  const snapshot = await adminDb().collection(REFRESH_TOKENS).where('uid', '==', uid).get();
  const writer = adminDb().bulkWriter();
  snapshot.docs.forEach((doc) => writer.delete(doc.ref));
  await writer.close();
  return snapshot.size;
};

/**
 * 接続（familyId）を画面に出すときの ID
 *
 * familyId そのものは出さず、ハッシュの先頭だけを使う（画面や通信に内部の値を残さない）。
 */
const connectionIdOf = (familyId: string): string => sha256Hex(familyId).slice(0, 16);

export interface Connection {
  id: string;
  /** 最初に許可した時刻 */
  connectedAt: Date;
  /** 最後にトークンを発行した時刻（Claude は使うたびに1時間ごとに更新するので、最後に使った時期の目安） */
  lastActiveAt: Date;
}

/**
 * uid の、まだ使える（未使用で期限内のリフレッシュトークンがある）接続の一覧。新しく許可した順
 *
 * uid だけの条件で読み、familyId ごとにまとめるのはメモリ上で行う（複合インデックスを増やさない）。
 */
export const listConnections = async (uid: string, now: Date = new Date()): Promise<Connection[]> => {
  if (!uid) throw new Error('uid is required');
  const snapshot = await adminDb().collection(REFRESH_TOKENS).where('uid', '==', uid).get();
  const byFamily = new Map<string, Connection>();
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    if (data.usedAt || (data.expiresAt as Timestamp).toMillis() <= now.getTime()) return;
    const createdAt = (data.createdAt as Timestamp).toDate();
    const connectedAt = ((data.connectedAt ?? data.createdAt) as Timestamp).toDate();
    const current = byFamily.get(data.familyId);
    // 同時の更新で未使用のトークンが2つある接続は、新しいほうの発行時刻を使う
    if (!current || current.lastActiveAt < createdAt) {
      byFamily.set(data.familyId, { id: connectionIdOf(data.familyId), connectedAt, lastActiveAt: createdAt });
    }
  });
  return [...byFamily.values()].sort((a, b) => b.connectedAt.getTime() - a.connectedAt.getTime());
};

/** uid の接続のうち1つを解除する（その familyId のトークンをすべて消す）。消した件数を返す */
export const revokeConnection = async (uid: string, connectionId: string): Promise<number> => {
  if (!uid) throw new Error('uid is required');
  const snapshot = await adminDb().collection(REFRESH_TOKENS).where('uid', '==', uid).get();
  const targets = snapshot.docs.filter((doc) => connectionIdOf(doc.data().familyId) === connectionId);
  const writer = adminDb().bulkWriter();
  targets.forEach((doc) => writer.delete(doc.ref));
  await writer.close();
  return targets.length;
};
