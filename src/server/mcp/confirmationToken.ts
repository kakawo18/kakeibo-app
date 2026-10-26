/**
 * 確認トークン（docs/claude-connector/書き込み仕様書.md 5.6 節）
 *
 * 確認のツールが整えた内容を、記録のツールまで改ざんされずに運ぶための署名付き JWT（HS256）。
 * 記録のツールはトークンの中身だけを書くので、利用者が見て承認した内容と違うものは書けない。
 * サーバーには保存しない。中身は署名するだけで暗号化しない（Claude が確認で受け取った内容と同じ）。
 *
 * アクセストークンと取り違えても通らないよう、鍵（MCP_TOKEN_SECRET から用途の名前で導いた値）・
 * typ・aud をアクセストークンと分けている。
 */
import 'server-only';
import { createHash, createHmac } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import { UserFacingError } from '../errors';
import { randomToken } from '../oauth/random';
import type { TransactionChanges, TransactionDraft } from './transactionDraft';

export const CONFIRMATION_TTL_SECONDS = 30 * 60;

const TYP = 'kakeibo-confirm+jwt';
const AUDIENCE = 'kakeibo:confirm';
const KEY_PURPOSE = 'kakeibo-confirm';
const MIN_SECRET_BYTES = 32;

export interface ConfirmationConfig {
  origin: string;
  tokenSecret: Uint8Array;
}

export type Confirmation =
  | { action: 'add'; draft: TransactionDraft }
  | { action: 'update'; transactionId: string; changes: TransactionChanges };

const draftSchema = z.object({
  date: z.string(),
  type: z.enum(['income', 'expense']),
  amount: z.number(),
  category: z.string(),
  subcategory: z.string().optional(),
  paymentMethod: z.string().optional(),
  description: z.string(),
});

const changesSchema = z.object({
  date: z.string().optional(),
  amount: z.number().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  paymentMethod: z.string().optional(),
  description: z.string().optional(),
});

const payloadSchema = z.discriminatedUnion('act', [
  z.object({ act: z.literal('add'), data: draftSchema }),
  z.object({ act: z.literal('update'), tid: z.string().min(1), data: changesSchema }),
]);

/** 確認トークン用の鍵。アクセストークンの鍵（MCP_TOKEN_SECRET そのもの）とは別の値にする */
const confirmationKey = (secret: Uint8Array): Uint8Array => {
  if (secret.length < MIN_SECRET_BYTES) throw new Error('MCP_TOKEN_SECRET is too short');
  return new Uint8Array(createHmac('sha256', secret).update(KEY_PURPOSE).digest());
};

const INVALID_MESSAGE = '確認の期限が切れたか、確認の内容が正しくありません。確認からやり直してください';

export const signConfirmation = async (
  uid: string,
  confirmation: Confirmation,
  config: ConfirmationConfig,
  now: Date = new Date()
): Promise<{ token: string; expiresAt: Date }> => {
  if (!uid) throw new Error('uid is required');
  const issuedAt = Math.floor(now.getTime() / 1000);
  const expiresAt = issuedAt + CONFIRMATION_TTL_SECONDS;
  const claims =
    confirmation.action === 'add'
      ? { act: 'add', data: confirmation.draft }
      : { act: 'update', tid: confirmation.transactionId, data: confirmation.changes };
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256', typ: TYP })
    .setIssuer(config.origin)
    .setSubject(uid)
    .setAudience(AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .setJti(randomToken())
    .sign(confirmationKey(config.tokenSecret));
  return { token, expiresAt: new Date(expiresAt * 1000) };
};

/**
 * 確認トークンを検証し、中身と jti を返す
 *
 * 署名・期限・用途が正しくなければ、理由を分けずに同じ説明つきのエラーにする。
 * 別の利用者のトークン（sub が uid と違う）も同じ扱いにする。
 */
export const verifyConfirmation = async (
  token: string,
  uid: string,
  config: ConfirmationConfig,
  now: Date = new Date()
): Promise<{ confirmation: Confirmation; jti: string }> => {
  let payload: Record<string, unknown>;
  try {
    ({ payload } = await jwtVerify(token, confirmationKey(config.tokenSecret), {
      issuer: config.origin,
      audience: AUDIENCE,
      algorithms: ['HS256'],
      typ: TYP,
      currentDate: now,
    }));
  } catch (error) {
    if (error instanceof Error && error.message === 'MCP_TOKEN_SECRET is too short') throw error;
    throw new UserFacingError(INVALID_MESSAGE);
  }
  const parsed = payloadSchema.safeParse(payload);
  if (payload.sub !== uid || typeof payload.jti !== 'string' || !parsed.success) {
    throw new UserFacingError(INVALID_MESSAGE);
  }
  const confirmation: Confirmation =
    parsed.data.act === 'add'
      ? { action: 'add', draft: parsed.data.data }
      : { action: 'update', transactionId: parsed.data.tid, changes: parsed.data.data };
  return { confirmation, jti: payload.jti };
};

/**
 * 確認トークンから追加する取引の ID を決める（Firestore の自動の ID と同じ20文字）
 *
 * 同じトークンで記録のツールが2回呼ばれても、同じ ID になるので二重に作らない。
 */
export const transactionIdFor = (uid: string, jti: string): string =>
  createHash('sha256').update(`${uid}\n${jti}`).digest('base64url').slice(0, 20);
