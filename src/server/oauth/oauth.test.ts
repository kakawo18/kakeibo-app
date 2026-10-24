/**
 * 認可サーバーの純粋な部品（PKCE・認可リクエストの検証・アクセストークン）
 * docs/claude-connector/仕様書.md 5.5・5.8・5.11
 */
import { describe, expect, it } from 'vitest';
import { SignJWT, UnsecuredJWT } from 'jose';
import { challengeOf, verifyPkce } from '@/server/oauth/pkce';
import {
  CLAUDE_REDIRECT_URI,
  buildRedirect,
  validateAuthorizeParams,
} from '@/server/oauth/params';
import { signAccessToken, verifyAccessToken } from '@/server/oauth/accessToken';

describe('PKCE', () => {
  it('RFC 7636 付録 B の例と一致する', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    expect(challengeOf(verifier)).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    expect(verifyPkce(verifier, 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')).toBe(true);
  });

  it('verifier が違う・短すぎる・使えない文字を含むなら通さない', () => {
    const challenge = challengeOf('a'.repeat(43));
    expect(verifyPkce('b'.repeat(43), challenge)).toBe(false);
    expect(verifyPkce('a'.repeat(42), challengeOf('a'.repeat(42)))).toBe(false);
    expect(verifyPkce(`${'a'.repeat(42)}+`, challengeOf(`${'a'.repeat(42)}+`))).toBe(false);
  });
});

describe('validateAuthorizeParams', () => {
  const expected = {
    clientId: 'kakeibo-claude-test',
    resource: 'https://kakeibo.example.com/api/mcp',
    redirectUris: [CLAUDE_REDIRECT_URI],
  };
  const valid = {
    response_type: 'code',
    client_id: 'kakeibo-claude-test',
    redirect_uri: CLAUDE_REDIRECT_URI,
    code_challenge: challengeOf('a'.repeat(43)),
    code_challenge_method: 'S256',
    state: 'xyz',
    scope: 'kakeibo.read',
    resource: 'https://kakeibo.example.com/api/mcp',
  };

  it('正しいリクエストを受け付ける。scope と resource は省略できる', () => {
    expect(validateAuthorizeParams(valid, expected)).toMatchObject({ ok: true, request: { state: 'xyz' } });
    expect(validateAuthorizeParams({ ...valid, scope: undefined, resource: undefined }, expected)).toMatchObject({
      ok: true,
      request: { scope: 'kakeibo.read', resource: expected.resource },
    });
  });

  it('client_id と redirect_uri が違えばリダイレクトしない（fatal）', () => {
    expect(validateAuthorizeParams({ ...valid, client_id: 'other' }, expected)).toMatchObject({ ok: false, fatal: true });
    expect(validateAuthorizeParams({ ...valid, redirect_uri: 'https://evil.example/cb' }, expected)).toMatchObject({ ok: false, fatal: true });
    // 前方一致や末尾のスラッシュ違いも通さない（完全一致）
    expect(validateAuthorizeParams({ ...valid, redirect_uri: `${CLAUDE_REDIRECT_URI}/` }, expected)).toMatchObject({ ok: false, fatal: true });
    expect(validateAuthorizeParams({ ...valid, redirect_uri: [CLAUDE_REDIRECT_URI, CLAUDE_REDIRECT_URI] }, expected)).toMatchObject({ ok: false, fatal: true });
  });

  it.each([
    [{ response_type: 'token' }, 'unsupported_response_type'],
    [{ code_challenge_method: 'plain' }, 'invalid_request'],
    [{ code_challenge_method: undefined }, 'invalid_request'],
    [{ code_challenge: 'short' }, 'invalid_request'],
    [{ scope: 'kakeibo.read kakeibo.write' }, 'invalid_scope'],
    [{ resource: 'https://other.example.com/api/mcp' }, 'invalid_target'],
  ])('%o は redirect_uri へ %s を返す', (override, error) => {
    expect(validateAuthorizeParams({ ...valid, ...override }, expected)).toMatchObject({
      ok: false,
      fatal: false,
      redirectUri: CLAUDE_REDIRECT_URI,
      error,
      state: 'xyz',
    });
  });

  it('buildRedirect は redirect_uri にクエリを足し、undefined は付けない', () => {
    expect(buildRedirect(CLAUDE_REDIRECT_URI, { code: 'c', state: undefined, iss: 'https://k.example' })).toBe(
      `${CLAUDE_REDIRECT_URI}?code=c&iss=https%3A%2F%2Fk.example`
    );
  });
});

describe('アクセストークン', () => {
  const config = {
    origin: 'https://kakeibo.example.com',
    resource: 'https://kakeibo.example.com/api/mcp',
    tokenSecret: new TextEncoder().encode('x'.repeat(48)),
  };
  const claims = { uid: 'alice', scope: 'kakeibo.read', clientId: 'kakeibo-claude-test' };
  const now = new Date('2026-10-24T00:00:00Z');

  it('発行したトークンを検証でき、uid・scope・期限が取り出せる', async () => {
    const token = await signAccessToken(claims, config, now);
    const verified = await verifyAccessToken(token, config, now);

    expect(verified).toEqual({
      uid: 'alice',
      scopes: ['kakeibo.read'],
      clientId: 'kakeibo-claude-test',
      expiresAt: now.getTime() / 1000 + 3600,
    });
  });

  it('期限切れ（1時間後）・宛先違い・発行者違い・別の鍵は拒否する', async () => {
    const token = await signAccessToken(claims, config, now);

    await expect(verifyAccessToken(token, config, new Date(now.getTime() + 3601_000))).rejects.toThrow();
    await expect(verifyAccessToken(token, { ...config, resource: 'https://other.example/api/mcp' }, now)).rejects.toThrow();
    await expect(verifyAccessToken(token, { ...config, origin: 'https://other.example' }, now)).rejects.toThrow();
    await expect(
      verifyAccessToken(token, { ...config, tokenSecret: new TextEncoder().encode('y'.repeat(48)) }, now)
    ).rejects.toThrow();
  });

  it('署名なし（alg: none）や種類（typ）違いのトークンは拒否する', async () => {
    const unsecured = new UnsecuredJWT({ scope: 'kakeibo.read', client_id: 'x' })
      .setIssuer(config.origin).setAudience(config.resource).setSubject('alice').setExpirationTime('1h').encode();
    await expect(verifyAccessToken(unsecured, config)).rejects.toThrow();

    // 同じ鍵で署名した、アクセストークンではない JWT
    const idLike = await new SignJWT({ scope: 'kakeibo.read', client_id: 'x' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(config.origin).setAudience(config.resource).setSubject('alice').setExpirationTime('1h')
      .sign(config.tokenSecret);
    await expect(verifyAccessToken(idLike, config)).rejects.toThrow();
  });

  it('署名鍵が短すぎれば使わない', async () => {
    await expect(signAccessToken(claims, { ...config, tokenSecret: new Uint8Array(16) })).rejects.toThrow('too short');
  });
});
