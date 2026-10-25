/**
 * 認可サーバーの保存と流れをエミュレータで確かめる（docs/claude-connector/仕様書.md 5.5〜5.10）
 *
 * - 認可コードは5分・1回限り。PKCE・client_id・redirect_uri が合わなければ交換できない
 * - リフレッシュトークンはローテーションし、使用済みのものが60秒より後に使われたら接続ごと消す
 * - 同意には直近のログインが要る（ログインしたままのセッションでは同意できない）
 * - 接続の一覧は接続（familyId）ごとに返し、解除はその利用者のトークンだけ・その接続だけを消す
 * ID トークンの検証（Firebase Auth）は差し替えて、uid を直接渡す。
 */
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { McpConfig } from '@/server/config';
import { CONSENT_MAX_AUTH_AGE_SECONDS, handleAuthorizeApproval } from '@/server/oauth/authorizeEndpoint';
import { handleTokenRequest } from '@/server/oauth/tokenEndpoint';
import { CLAUDE_REDIRECT_URI } from '@/server/oauth/params';
import { challengeOf } from '@/server/oauth/pkce';
import { verifyAccessToken } from '@/server/oauth/accessToken';
import {
  AUTHORIZATION_CODES,
  CODE_TTL_MS,
  REFRESH_REUSE_GRACE_MS,
  REFRESH_TOKENS,
  USED_REFRESH_TOKEN_RETENTION_MS,
  deleteExpired,
  listConnections,
  revokeRefreshTokensForUid,
} from '@/server/oauth/store';
import { handleConnectionsRequest } from '@/server/oauth/connectionsEndpoint';
import { sha256Hex } from '@/server/oauth/random';
import { adminDb } from '@/server/firebaseAdmin';

const verifier = 'v'.repeat(64);
let alice: string;
let bob: string;
let config: McpConfig;

beforeEach(() => {
  const run = randomUUID().slice(0, 8);
  alice = `alice-${run}`;
  bob = `bob-${run}`;
  config = {
    origin: 'https://kakeibo.example.com',
    resource: 'https://kakeibo.example.com/api/mcp',
    clientId: 'kakeibo-claude-test',
    allowedUids: new Set([alice, bob]),
    tokenSecret: new TextEncoder().encode('s'.repeat(48)),
  };
});

const query = (overrides: Record<string, string | undefined> = {}) => ({
  response_type: 'code',
  client_id: 'kakeibo-claude-test',
  redirect_uri: CLAUDE_REDIRECT_URI,
  code_challenge: challengeOf(verifier),
  code_challenge_method: 'S256',
  state: 'st',
  ...overrides,
});

/** ID トークンの検証の代わり。ログインした時刻は既定で now の1分前（直前にログインした本人） */
const loggedIn = (uid: string, now: Date, authAgeSeconds = 60) => async () => ({
  uid,
  authTime: Math.floor(now.getTime() / 1000) - authAgeSeconds,
});

/** 同意して、claude.ai へ戻る URL を受け取る */
const approve = async (uid: string, now = new Date(), q = query()) => {
  const response = await handleAuthorizeApproval({ idToken: 'id-token', query: q }, config, {
    verifyIdToken: loggedIn(uid, now),
    now,
  });
  return new URL((response.body as { redirectTo: string }).redirectTo);
};

const codeFor = async (uid: string, now = new Date()) => (await approve(uid, now)).searchParams.get('code')!;

const exchange = (code: string, overrides: Record<string, string> = {}, now = new Date()) =>
  handleTokenRequest(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: CLAUDE_REDIRECT_URI,
      client_id: 'kakeibo-claude-test',
      code_verifier: verifier,
      resource: config.resource,
      ...overrides,
    }),
    config,
    now
  );

const refresh = (refreshToken: string, now = new Date()) =>
  handleTokenRequest(
    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: 'kakeibo-claude-test' }),
    config,
    now
  );

describe('同意（POST /api/oauth/authorize）', () => {
  it('claude.ai へ code・state・iss を付けて戻す', async () => {
    const redirect = await approve(alice);

    expect(`${redirect.origin}${redirect.pathname}`).toBe(CLAUDE_REDIRECT_URI);
    expect(redirect.searchParams.get('code')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(redirect.searchParams.get('state')).toBe('st');
    expect(redirect.searchParams.get('iss')).toBe(config.origin);
  });

  it('許可リストに無いアカウントは access_denied で戻し、コードを出さない', async () => {
    const redirect = await approve('mallory');

    expect(redirect.searchParams.get('error')).toBe('access_denied');
    expect(redirect.searchParams.get('code')).toBeNull();
  });

  it('ID トークンが無効なら 401。redirect_uri が不正ならどこへも戻さない', async () => {
    const invalidLogin = await handleAuthorizeApproval({ idToken: 'bad', query: query() }, config, {
      verifyIdToken: async () => {
        throw Object.assign(new Error('expired'), { code: 'auth/id-token-expired' });
      },
    });
    expect(invalidLogin.status).toBe(401);

    const badRedirect = await handleAuthorizeApproval(
      { idToken: 'id-token', query: query({ redirect_uri: 'https://evil.example/cb' }) },
      config,
      { verifyIdToken: loggedIn(alice, new Date()) }
    );
    expect(badRedirect).toEqual({ status: 400, body: { error: 'invalid_request' } });
  });

  it('ログインから時間がたっていれば、コードを出さずにログインし直しを求める', async () => {
    const now = new Date();
    const stale = await handleAuthorizeApproval({ idToken: 'id-token', query: query() }, config, {
      verifyIdToken: loggedIn(alice, now, CONSENT_MAX_AUTH_AGE_SECONDS + 1),
      now,
    });
    expect(stale).toEqual({ status: 401, body: { error: 'reauthentication_required' } });

    const fresh = await handleAuthorizeApproval({ idToken: 'id-token', query: query() }, config, {
      verifyIdToken: loggedIn(alice, now, CONSENT_MAX_AUTH_AGE_SECONDS),
      now,
    });
    expect(fresh.status).toBe(200);
  });
});

describe('認可コードの交換（grant_type=authorization_code）', () => {
  it('アクセストークン（1時間）とリフレッシュトークンを返す。トークンの宛先はこの MCP サーバー', async () => {
    const response = await exchange(await codeFor(alice));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ token_type: 'Bearer', expires_in: 3600, scope: 'kakeibo.read' });
    const verified = await verifyAccessToken(response.body.access_token as string, config);
    expect(verified.uid).toBe(alice);
    expect(await listConnections(alice)).toHaveLength(1);
  });

  it('同じコードは2回使えない', async () => {
    const code = await codeFor(alice);
    expect((await exchange(code)).status).toBe(200);

    expect(await exchange(code)).toMatchObject({ status: 400, body: { error: 'invalid_grant' } });
  });

  it('期限（5分）を過ぎたコードは使えない', async () => {
    const issuedAt = new Date();
    const code = await codeFor(alice, issuedAt);

    const late = await exchange(code, {}, new Date(issuedAt.getTime() + CODE_TTL_MS + 1));
    expect(late.body).toMatchObject({ error: 'invalid_grant' });
  });

  it('code_verifier・redirect_uri・client_id・resource が違えば交換できず、コードも使えなくなる', async () => {
    const wrongVerifier = await codeFor(alice);
    expect((await exchange(wrongVerifier, { code_verifier: 'w'.repeat(64) })).body).toMatchObject({ error: 'invalid_grant' });
    expect((await exchange(wrongVerifier)).body).toMatchObject({ error: 'invalid_grant' });

    expect((await exchange(await codeFor(alice), { redirect_uri: 'https://claude.ai/other' })).body).toMatchObject({ error: 'invalid_grant' });
    expect((await exchange(await codeFor(alice), { client_id: 'other' })).status).toBe(401);
    expect((await exchange(await codeFor(alice), { resource: 'https://other.example/api/mcp' })).body).toMatchObject({ error: 'invalid_target' });
  });

  it('同意の後に許可リストから外されたら交換できない', async () => {
    const code = await codeFor(alice);
    config = { ...config, allowedUids: new Set([bob]) };

    expect((await exchange(code)).body).toMatchObject({ error: 'invalid_grant' });
  });
});

describe('リフレッシュトークン（grant_type=refresh_token）', () => {
  const initialTokens = async () => (await exchange(await codeFor(alice))).body as Record<string, string>;

  it('新しいアクセストークンと、新しいリフレッシュトークンに替わる（ローテーション）', async () => {
    const first = await initialTokens();
    const second = await refresh(first.refresh_token);

    expect(second.status).toBe(200);
    expect(second.body.refresh_token).not.toBe(first.refresh_token);
    expect((await verifyAccessToken(second.body.access_token as string, config)).uid).toBe(alice);
    // 新しいトークンはさらに使える
    expect((await refresh(second.body.refresh_token as string)).status).toBe(200);
  });

  it('使用済みのトークンが60秒より後に使われたら、同じ接続のトークンをすべて消す', async () => {
    const usedAt = new Date();
    const first = await initialTokens();
    const second = await refresh(first.refresh_token, usedAt);

    const replay = await refresh(first.refresh_token, new Date(usedAt.getTime() + REFRESH_REUSE_GRACE_MS + 1_000));
    expect(replay.body).toMatchObject({ error: 'invalid_grant' });
    // 正しい利用者が持っている新しいトークンも消えている（盗まれた可能性があるため）
    expect((await refresh(second.body.refresh_token as string)).body).toMatchObject({ error: 'invalid_grant' });
  });

  it('60秒以内の再使用（同時の更新）では、接続は消さない', async () => {
    const usedAt = new Date();
    const first = await initialTokens();
    const second = await refresh(first.refresh_token, usedAt);

    expect((await refresh(first.refresh_token, new Date(usedAt.getTime() + 5_000))).body).toMatchObject({ error: 'invalid_grant' });
    expect((await refresh(second.body.refresh_token as string)).status).toBe(200);
  });

  it('期限（30日）を過ぎたトークン・知らないトークンは使えない', async () => {
    const first = await initialTokens();

    expect((await refresh(first.refresh_token, new Date(Date.now() + 31 * 24 * 60 * 60 * 1000))).body).toMatchObject({ error: 'invalid_grant' });
    expect((await refresh('unknown-token')).body).toMatchObject({ error: 'invalid_grant' });
  });

  it('許可リストから外されたら更新できない', async () => {
    const first = await initialTokens();
    config = { ...config, allowedUids: new Set([bob]) };

    expect((await refresh(first.refresh_token)).body).toMatchObject({ error: 'invalid_grant' });
  });
});

describe('接続の解除', () => {
  it('その利用者のリフレッシュトークンだけを消す', async () => {
    const aliceTokens = (await exchange(await codeFor(alice))).body as Record<string, string>;
    const bobTokens = (await exchange(await codeFor(bob))).body as Record<string, string>;

    expect(await revokeRefreshTokensForUid(alice)).toBe(1);

    expect(await listConnections(alice)).toEqual([]);
    expect((await refresh(aliceTokens.refresh_token)).body).toMatchObject({ error: 'invalid_grant' });
    expect((await refresh(bobTokens.refresh_token)).status).toBe(200);
  });
});

describe('トークンのエンドポイントの入力', () => {
  it('grant_type が対応外なら unsupported_grant_type', async () => {
    const response = await handleTokenRequest(
      new URLSearchParams({ grant_type: 'client_credentials', client_id: 'kakeibo-claude-test' }),
      config
    );
    expect(response.body).toMatchObject({ error: 'unsupported_grant_type' });
  });
});

describe('期限切れのデータの掃除（TTL の代わり）', () => {
  const exists = async (collection: string, value: string) =>
    (await adminDb().doc(`${collection}/${sha256Hex(value)}`).get()).exists;

  it('使ったリフレッシュトークンは24時間だけ残し、そのあとの再使用は接続を消さずに拒否する', async () => {
    const usedAt = new Date();
    const first = (await exchange(await codeFor(alice), {}, usedAt)).body as Record<string, string>;
    const second = await refresh(first.refresh_token, usedAt);

    const afterRetention = new Date(usedAt.getTime() + USED_REFRESH_TOKEN_RETENTION_MS + 1_000);
    expect((await refresh(first.refresh_token, afterRetention)).body).toMatchObject({ error: 'invalid_grant' });
    // 正しい利用者の新しいトークンは残っている（24時間を過ぎた再使用では接続ごとは消さない）
    expect((await refresh(second.body.refresh_token as string, afterRetention)).status).toBe(200);
  });

  it('期限切れの認可コードとリフレッシュトークンを消し、期限内のものは残す', async () => {
    const issuedAt = new Date();
    const unusedCode = await codeFor(alice, issuedAt);
    const first = (await exchange(await codeFor(alice, issuedAt), {}, issuedAt)).body as Record<string, string>;
    const second = await refresh(first.refresh_token, issuedAt);

    await deleteExpired(new Date(issuedAt.getTime() + USED_REFRESH_TOKEN_RETENTION_MS + 1_000));

    expect(await exists(AUTHORIZATION_CODES, unusedCode)).toBe(false);
    expect(await exists(REFRESH_TOKENS, first.refresh_token)).toBe(false);
    expect(await exists(REFRESH_TOKENS, second.body.refresh_token as string)).toBe(true);
  });

  it('トークンを発行するたびに、期限切れのものを消す', async () => {
    const longAgo = new Date(Date.now() - 2 * CODE_TTL_MS);
    const staleCode = await codeFor(alice, longAgo);

    await exchange(await codeFor(alice));

    expect(await exists(AUTHORIZATION_CODES, staleCode)).toBe(false);
  });
});

describe('接続の確認と解除（/api/oauth/connections）', () => {
  const as = (uid: string) => ({ verifyIdToken: async () => uid });
  const get = (uid: string) => handleConnectionsRequest({ method: 'GET', authorization: 'Bearer id' }, as(uid));
  const remove = (uid: string, connectionId?: string) =>
    handleConnectionsRequest({ method: 'DELETE', authorization: 'Bearer id', connectionId }, as(uid));
  const connectionsOf = async (uid: string) =>
    ((await get(uid)).body as { connections: { id: string; connectedAt: string; lastActiveAt: string }[] }).connections;

  it('接続ごとに、許可した時刻と最後に使った時刻を返す。ローテーションしても許可した時刻は変わらない', async () => {
    const connectedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const first = (await exchange(await codeFor(alice, connectedAt), {}, connectedAt)).body as Record<string, string>;
    const refreshedAt = new Date(connectedAt.getTime() + 60 * 60 * 1000);
    await refresh(first.refresh_token, refreshedAt);

    expect(await get(alice)).toEqual({
      status: 200,
      body: {
        connected: true,
        connections: [
          { id: expect.stringMatching(/^[0-9a-f]{16}$/), connectedAt: connectedAt.toISOString(), lastActiveAt: refreshedAt.toISOString() },
        ],
      },
    });
  });

  it('許可を2回すれば接続は2つになる。新しく許可した順に並ぶ', async () => {
    const earlier = new Date(Date.now() - 60_000);
    await exchange(await codeFor(alice, earlier), {}, earlier);
    await exchange(await codeFor(alice));

    const connections = await connectionsOf(alice);
    expect(connections).toHaveLength(2);
    expect(connections[1].connectedAt).toBe(earlier.toISOString());
  });

  it('id を付けた解除はその接続だけを消す。ほかの利用者の接続の id では何も消えない', async () => {
    const keep = (await exchange(await codeFor(alice))).body as Record<string, string>;
    const drop = (await exchange(await codeFor(alice))).body as Record<string, string>;
    await refresh(drop.refresh_token, new Date(Date.now() + 1_000));
    const bobTokens = (await exchange(await codeFor(bob))).body as Record<string, string>;
    const [bobConnection] = await connectionsOf(bob);

    const before = await connectionsOf(alice);
    // 更新した（最後に使った時刻が許可した時刻より後の）ほうが drop の接続
    const target = before.find((connection) => connection.lastActiveAt !== connection.connectedAt)!;

    expect(await remove(alice, bobConnection.id)).toEqual({ status: 200, body: { revoked: 0 } });
    // 使用済みのトークンも含めて、その接続のトークンをすべて消す
    expect(await remove(alice, target.id)).toEqual({ status: 200, body: { revoked: 2 } });

    expect((await connectionsOf(alice)).map((connection) => connection.id)).toEqual(
      before.filter((connection) => connection.id !== target.id).map((connection) => connection.id)
    );
    expect((await refresh(keep.refresh_token)).status).toBe(200);
    expect((await refresh(bobTokens.refresh_token)).status).toBe(200);
  });

  it('id を付けない解除はその利用者の接続をすべて消し、ほかの利用者には触れない', async () => {
    await exchange(await codeFor(alice));
    await exchange(await codeFor(bob));

    expect(await remove(alice)).toEqual({ status: 200, body: { revoked: 1 } });

    expect((await get(alice)).body).toEqual({ connected: false, connections: [] });
    expect((await get(bob)).body).toMatchObject({ connected: true });
  });

  it('id の形が違えば 400', async () => {
    expect((await remove(alice, 'not-an-id')).status).toBe(400);
  });

  it('ログインの証明が無い・無効なら 401', async () => {
    expect((await handleConnectionsRequest({ method: 'GET', authorization: null })).status).toBe(401);
    expect((await handleConnectionsRequest({ method: 'DELETE', authorization: 'Basic abc' })).status).toBe(401);
    const invalid = await handleConnectionsRequest({ method: 'DELETE', authorization: 'Bearer bad' }, {
      verifyIdToken: async () => {
        throw new Error('invalid');
      },
    });
    expect(invalid.status).toBe(401);
  });
});
