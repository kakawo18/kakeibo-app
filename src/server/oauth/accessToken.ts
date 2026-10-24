/**
 * アクセストークン（署名付き JWT。HS256）の発行と検証（docs/claude-connector/仕様書.md 5.8・5.11）
 *
 * 保存せずに署名だけで検証できるので、ツールを呼ぶたびに Firestore を読まずに済む。
 * 個別に失効させる仕組みが無いので、有効期限を1時間と短くしている。
 */
import { SignJWT, jwtVerify } from 'jose';
import { randomToken } from './random';

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;

/** 署名鍵の最低の長さ（HS256 には 256 ビット以上の鍵を使う） */
const MIN_SECRET_BYTES = 32;

export interface TokenConfig {
  origin: string;
  resource: string;
  tokenSecret: Uint8Array;
}

const checkSecret = (secret: Uint8Array): Uint8Array => {
  if (secret.length < MIN_SECRET_BYTES) throw new Error('MCP_TOKEN_SECRET is too short');
  return secret;
};

export const signAccessToken = async (
  claims: { uid: string; scope: string; clientId: string },
  config: TokenConfig,
  now: Date = new Date()
): Promise<string> => {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({ scope: claims.scope, client_id: claims.clientId })
    .setProtectedHeader({ alg: 'HS256', typ: 'at+jwt' })
    .setIssuer(config.origin)
    .setSubject(claims.uid)
    .setAudience(config.resource)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + ACCESS_TOKEN_TTL_SECONDS)
    .setJti(randomToken())
    .sign(checkSecret(config.tokenSecret));
};

export interface VerifiedAccessToken {
  uid: string;
  scopes: string[];
  clientId: string;
  /** 秒（UNIX 時間） */
  expiresAt: number;
}

/** 署名・iss・aud・exp・typ を確かめる。不正なら例外 */
export const verifyAccessToken = async (
  token: string,
  config: TokenConfig,
  now: Date = new Date()
): Promise<VerifiedAccessToken> => {
  const { payload } = await jwtVerify(token, checkSecret(config.tokenSecret), {
    issuer: config.origin,
    audience: config.resource,
    algorithms: ['HS256'],
    typ: 'at+jwt',
    currentDate: now,
  });
  if (!payload.sub || typeof payload.scope !== 'string' || typeof payload.client_id !== 'string' || !payload.exp) {
    throw new Error('Access token is missing claims');
  }
  return {
    uid: payload.sub,
    scopes: payload.scope.split(' ').filter(Boolean),
    clientId: payload.client_id,
    expiresAt: payload.exp,
  };
};
