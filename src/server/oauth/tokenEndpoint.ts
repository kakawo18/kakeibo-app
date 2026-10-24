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
import { isAllowedScope } from './params';
import {
  consumeAuthorizationCode,
  deleteExpired,
  issueRefreshToken,
  rotateRefreshToken,
} from './store';

export interface TokenResponse {
  status: number;
  body: Record<string, unknown>;
}

const oauthError = (error: string, description: string, status = 400): TokenResponse => ({
  status,
  body: { error, error_description: description },
});

const issueTokens = async (
  grant: { uid: string; clientId: string; scope: string },
  refreshToken: string,
  config: McpConfig,
  now: Date
): Promise<TokenResponse> => {
  // 発行のついでに期限切れのコードとトークンを消す（TTL の代わり）。失敗しても発行は止めない
  await deleteExpired(now).catch((error: unknown) => {
    console.error('OAuth: failed to delete expired documents:', error instanceof Error ? error.message : 'unknown');
  });
  return {
    status: 200,
    body: {
      access_token: await signAccessToken(grant, config, now),
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: refreshToken,
      scope: grant.scope,
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

const refresh = async (form: URLSearchParams, config: McpConfig, now: Date): Promise<TokenResponse> => {
  const token = form.get('refresh_token');
  if (!token) return oauthError('invalid_request', 'refresh_token is required');
  const resource = form.get('resource');
  if (resource && resource !== config.resource) return oauthError('invalid_target', 'resource does not match');
  if (!isAllowedScope(form.get('scope') ?? undefined)) return oauthError('invalid_scope', 'scope is not allowed');

  const result = await rotateRefreshToken(token, config.clientId, now);
  if (!result.ok) {
    if (result.reason === 'reused') {
      // 盗まれたトークンが使われた可能性がある。同じ接続のトークンはすべて消した
      console.error('OAuth: refresh token reuse detected; revoked the token family');
    }
    return oauthError('invalid_grant', 'refresh token is invalid or expired');
  }
  if (!config.allowedUids.has(result.grant.uid)) return oauthError('invalid_grant', 'access is not allowed');
  return issueTokens(result.grant, result.refreshToken, config, now);
};

export const handleTokenRequest = async (
  form: URLSearchParams,
  config: McpConfig,
  now: Date = new Date()
): Promise<TokenResponse> => {
  // 公開クライアント（client secret なし）。client_id は事前登録の1件だけ
  if (form.get('client_id') !== config.clientId) {
    return oauthError('invalid_client', 'unknown client', 401);
  }
  switch (form.get('grant_type')) {
    case 'authorization_code':
      return exchangeAuthorizationCode(form, config, now);
    case 'refresh_token':
      return refresh(form, config, now);
    default:
      return oauthError('unsupported_grant_type', 'grant_type must be authorization_code or refresh_token');
  }
};
