/**
 * Firebase の ID トークンの検証（firebase-admin/auth を使わない版。v6.7.2）
 *
 * Firebase が公開している手順（第三者の JWT ライブラリでの検証）どおりに確かめる:
 * RS256・公開鍵の kid・aud = プロジェクト ID・iss = https://securetoken.google.com/<プロジェクト ID>・
 * exp が未来・iat が過去・sub（uid）が空でない・auth_time が過去
 * （auth_time が直近かどうかは同意の側で確かめる。oauth.emulator.test.ts）
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { SignJWT, UnsecuredJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import type { JWTVerifyGetKey } from 'jose';
import { verifyFirebaseIdToken } from '@/server/oauth/firebaseIdToken';

const PROJECT = 'demo-kakeibo';
const now = new Date('2026-10-24T12:00:00Z');
const seconds = Math.floor(now.getTime() / 1000);

let privateKey: CryptoKey;
let keys: JWTVerifyGetKey;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  keys = createLocalJWKSet({ keys: [jwk] });
});

/** 正しい ID トークンの中身に claims を上書きして署名する（undefined の項目は消す） */
const sign = (claims: Record<string, unknown> = {}, header: { kid?: string } = { kid: 'k1' }) => {
  const payload: Record<string, unknown> = {
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    sub: 'alice',
    iat: seconds - 60,
    exp: seconds + 3000,
    auth_time: seconds - 60,
    ...claims,
  };
  Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
  return new SignJWT(payload).setProtectedHeader({ alg: 'RS256', ...header }).sign(privateKey);
};

const verify = (token: string) => verifyFirebaseIdToken(token, { projectId: PROJECT, keys, now });

describe('verifyFirebaseIdToken', () => {
  it('Firebase が署名した正しい ID トークンなら uid とログインした時刻を返す', async () => {
    expect(await verify(await sign())).toEqual({ uid: 'alice', authTime: seconds - 60 });
  });

  it('別のプロジェクト宛て（aud）・別の発行者（iss）のトークンは拒否する', async () => {
    await expect(verify(await sign({ aud: 'other-project' }))).rejects.toThrow();
    await expect(verify(await sign({ iss: 'https://securetoken.google.com/other-project' }))).rejects.toThrow();
  });

  it('期限切れ・未来に発行されたトークンは拒否する', async () => {
    await expect(verify(await sign({ iat: seconds - 7200, auth_time: seconds - 7200, exp: seconds - 3600 }))).rejects.toThrow();
    await expect(verify(await sign({ iat: seconds + 600 }))).rejects.toThrow();
  });

  it('uid（sub）が無い・ログイン時刻（auth_time）が無いか未来のトークンは拒否する', async () => {
    await expect(verify(await sign({ sub: '' }))).rejects.toThrow();
    await expect(verify(await sign({ auth_time: undefined }))).rejects.toThrow();
    await expect(verify(await sign({ auth_time: seconds + 600 }))).rejects.toThrow();
  });

  it('知らない鍵（kid）で署名されたもの・署名なし（alg: none）は拒否する', async () => {
    await expect(verify(await sign({}, { kid: 'unknown' }))).rejects.toThrow();
    const unsigned = new UnsecuredJWT({ auth_time: seconds - 60 })
      .setIssuer(`https://securetoken.google.com/${PROJECT}`).setAudience(PROJECT).setSubject('alice')
      .setIssuedAt(seconds - 60).setExpirationTime(seconds + 3000).encode();
    await expect(verify(unsigned)).rejects.toThrow();
  });

  it('プロジェクト ID が無ければ検証しない', async () => {
    await expect(verifyFirebaseIdToken(await sign(), { projectId: '', keys, now })).rejects.toThrow('project');
  });
});
