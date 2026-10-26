/**
 * トークンのエンドポイント（POST /api/oauth/token）の処理（docs/claude-connector/仕様書.md 5.7・5.9）
 *
 * Route Handler からはリクエストの本文（form）と設定を渡すだけにし、ここをテストから直接呼ぶ。
 * エラーは RFC 6749 の形で返し、error_description に内部の事情（uid や Firestore のエラー）を書かない。
 */
import 'server-only';
import type { McpConfig } from '../config';
import { ACCESS_TOKEN_TTL_SECONDS, signAccessToken } from './accessToken';
import { verifyPkce } from './pkce';
import { isWithinScope, supportedScopes } from './params';
import { isTokenFormat } from './random';
import {
  consumeAuthorizationCode,
  deleteExpired,
  findActiveRefreshToken,
  issueRefreshToken,
  revokeFamily,
  rotateRefreshToken,
} from './store';
import { type FirebaseAccountState, isConnectionRevokedBy, lookupFirebaseAccount } from './firebaseAccount';

export interface TokenResponse {
  status: number;
  body: Record<string, unknown>;
}

export interface TokenOptions {
  /** Firebase の利用者の状態を引く（テストでは差し替える） */
  lookupAccount?: (uid: string) => Promise<FirebaseAccountState>;
}

const oauthError = (error: string, description: string, status = 400): TokenResponse => ({
  status,
  body: { error, error_description: description },
});

/**
 * @param accessScope アクセストークンの scope。リフレッシュで狭めて求められたときだけ grant.scope と違う
 *   （リフレッシュトークンは最初に許可した scope のまま）
 */
const issueTokens = async (
  grant: { uid: string; clientId: string; scope: string },
  refreshToken: string,
  config: McpConfig,
  now: Date,
  accessScope: string = grant.scope
): Promise<TokenResponse> => {
  // 発行のついでに期限切れのコードとトークンを消す（TTL の代わり）。失敗しても発行は止めない
  await deleteExpired(now).catch((error: unknown) => {
    console.error('OAuth: failed to delete expired documents:', error instanceof Error ? error.message : 'unknown');
  });
  return {
    status: 200,
    body: {
      access_token: await signAccessToken({ ...grant, scope: accessScope }, config, now),
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: refreshToken,
      scope: accessScope,
    },
  };
};

const exchangeAuthorizationCode = async (
  form: URLSearchParams,
  config: McpConfig,
  now: Date
): Promise<TokenResponse> => {
  const code = form.get('code');
  const redirectUri = form.get('redirect_uri');
  const verifier = form.get('code_verifier');
  const resource = form.get('resource');
  if (!code || !redirectUri || !verifier) {
    return oauthError('invalid_request', 'code, redirect_uri and code_verifier are required');
  }

  if (!isTokenFormat(code)) return oauthError('invalid_grant', 'authorization code is invalid or expired');

  // 検証に失敗しても、コードは使用済みになる（同じコードで何度も試させない）
  const grant = await consumeAuthorizationCode(code, now);
  if (!grant) return oauthError('invalid_grant', 'authorization code is invalid or expired');
  if (grant.clientId !== form.get('client_id') || grant.redirectUri !== redirectUri) {
    return oauthError('invalid_grant', 'client_id or redirect_uri does not match');
  }
  if (!verifyPkce(verifier, grant.codeChallenge)) {
    return oauthError('invalid_grant', 'code_verifier does not match');
  }
  if (resource && resource !== grant.resource) {
    return oauthError('invalid_target', 'resource does not match');
  }
  // 同意の後に許可リストから外された場合
  if (!config.allowedUids.has(grant.uid)) return oauthError('invalid_grant', 'access is not allowed');

  const refreshGrant = { uid: grant.uid, clientId: grant.clientId, scope: grant.scope };
  return issueTokens(refreshGrant, await issueRefreshToken(refreshGrant, now), config, now);
};

const refresh = async (
  form: URLSearchParams,
  config: McpConfig,
  now: Date,
  lookupAccount: (uid: string) => Promise<FirebaseAccountState>
): Promise<TokenResponse> => {
  const token = form.get('refresh_token');
  if (!token) return oauthError('invalid_request', 'refresh_token is required');
  const resource = form.get('resource');
  if (resource && resource !== config.resource) return oauthError('invalid_target', 'resource does not match');
  // 知らない scope は Firestore を読む前に拒否する
  const requestedScope = form.get('scope') ?? undefined;
  if (!isWithinScope(requestedScope, supportedScopes(true).join(' '))) {
    return oauthError('invalid_scope', 'scope is not allowed');
  }
  if (!isTokenFormat(token)) return oauthError('invalid_grant', 'refresh token is invalid or expired');

  // 接続を作った後にパスワードの変更・セッションの失効・アカウントの削除や無効化があれば、接続を消す（#178）。
  // 使用済み・期限切れのトークンはここでは見ず、下のローテーションの判定（再使用の検出など）に任せる
  const active = await findActiveRefreshToken(token, now);
  // 最初に許可した scope を超えて求めさせない（RFC 6749 6章）。読み取りだけの接続に書き込みを足させないため。
  // トークンは使用済みにしない（求め方を直せば同じトークンで更新できる）
  if (active && !isWithinScope(requestedScope, active.scope)) {
    return oauthError('invalid_scope', 'scope exceeds the originally granted scope');
  }
  if (active) {
    let account: FirebaseAccountState;
    try {
      account = await lookupAccount(active.uid);
    } catch (error) {
      // 確かめられないときは接続を消さず、トークンも使用済みにしない（Claude は後でやり直せる）
      console.error('OAuth: Firebase account lookup failed:', error instanceof Error ? error.message : 'unknown');
      return oauthError('temporarily_unavailable', 'please retry later', 503);
    }
    if (isConnectionRevokedBy(account, active.connectedAtMs)) {
      await revokeFamily(active.familyId);
      console.error('OAuth: revoked a connection because the Firebase account changed after it was connected');
      return oauthError('invalid_grant', 'refresh token is invalid or expired');
    }
  }

  const result = await rotateRefreshToken(token, config.clientId, now);
  if (!result.ok) {
    if (result.reason === 'reused') {
      // 盗まれたトークンが使われた可能性がある。同じ接続のトークンはすべて消した
      console.error('OAuth: refresh token reuse detected; revoked the token family');
    }
    return oauthError('invalid_grant', 'refresh token is invalid or expired');
  }
  if (!config.allowedUids.has(result.grant.uid)) return oauthError('invalid_grant', 'access is not allowed');
  // 猶予の間の再使用など、active で確かめられなかった場合のために、ここでも範囲を確かめる
  if (!isWithinScope(requestedScope, result.grant.scope)) {
    return oauthError('invalid_scope', 'scope exceeds the originally granted scope');
  }
  const accessScope = requestedScope
    ? result.grant.scope.split(' ').filter((s) => requestedScope.split(' ').includes(s)).join(' ')
    : result.grant.scope;
  return issueTokens(result.grant, result.refreshToken, config, now, accessScope);
};

export const handleTokenRequest = async (
  form: URLSearchParams,
  config: McpConfig,
  now: Date = new Date(),
  options: TokenOptions = {}
): Promise<TokenResponse> => {
  const { lookupAccount = lookupFirebaseAccount } = options;
  // 公開クライアント（client secret なし）。client_id は事前登録の1件だけ
  if (form.get('client_id') !== config.clientId) {
    return oauthError('invalid_client', 'unknown client', 401);
  }
  switch (form.get('grant_type')) {
    case 'authorization_code':
      return exchangeAuthorizationCode(form, config, now);
    case 'refresh_token':
      return refresh(form, config, now, lookupAccount);
    default:
      return oauthError('unsupported_grant_type', 'grant_type must be authorization_code or refresh_token');
  }
};
