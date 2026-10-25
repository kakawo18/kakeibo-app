/**
 * 同意の結果を受けて認可コードを発行する（POST /api/oauth/authorize。docs/claude-connector/仕様書.md 5.5）
 *
 * 同意画面は Firebase の ID トークンとクエリをそのまま送ってくる。画面での検証は表示のためのものなので、
 * ここでクエリをもう一度検証する。ID トークンを Cookie ではなく本文で受け取るので CSRF は成り立たない。
 */
import 'server-only';
import type { McpConfig } from '../config';
import { isDevBypass } from './verifyMcpToken';
import {
  CLAUDE_REDIRECT_URI,
  DEV_REDIRECT_URI,
  buildRedirect,
  validateAuthorizeParams,
} from './params';
import { issueAuthorizationCode } from './store';
import { verifyFirebaseIdToken, type VerifiedIdToken } from './firebaseIdToken';

/**
 * 同意に求めるログインの新しさ（秒）
 *
 * Claude との接続は一度作ると30日ごとに延びて続くので、ログインしたままのセッション（ID トークンは
 * 自動で更新される）では同意させず、直前にパスワードを入れた本人だけに許す（#178）。
 * 同意画面は、ログインから時間がたっていればパスワードを入れ直させてから送る。
 */
export const CONSENT_MAX_AUTH_AGE_SECONDS = 5 * 60;

/** 受け付ける redirect_uri。開発中だけ手作業の確認用を足す（手順書 5.10） */
export const allowedRedirectUris = (): string[] =>
  isDevBypass() ? [CLAUDE_REDIRECT_URI, DEV_REDIRECT_URI] : [CLAUDE_REDIRECT_URI];

export interface AuthorizeResponse {
  status: number;
  /** reauthentication_required: ログインから時間がたっている。パスワードを入れ直してから送り直す */
  body: { redirectTo: string } | { error: string };
}

export const handleAuthorizeApproval = async (
  input: { idToken?: unknown; query?: unknown },
  config: McpConfig,
  options: {
    redirectUris?: readonly string[];
    verifyIdToken?: (idToken: string) => Promise<VerifiedIdToken>;
    now?: Date;
  } = {}
): Promise<AuthorizeResponse> => {
  const {
    redirectUris = allowedRedirectUris(),
    verifyIdToken = (idToken: string) => verifyFirebaseIdToken(idToken),
    now = new Date(),
  } = options;
  if (typeof input.idToken !== 'string' || !input.idToken || typeof input.query !== 'object' || !input.query) {
    return { status: 400, body: { error: 'invalid_request' } };
  }

  const validation = validateAuthorizeParams(input.query as Record<string, string | string[] | undefined>, {
    clientId: config.clientId,
    resource: config.resource,
    redirectUris,
  });
  if (!validation.ok) {
    return validation.fatal
      ? { status: 400, body: { error: 'invalid_request' } }
      : {
          status: 200,
          body: {
            redirectTo: buildRedirect(validation.redirectUri, {
              error: validation.error,
              error_description: validation.description,
              state: validation.state,
              iss: config.origin,
            }),
          },
        };
  }
  const { request } = validation;

  let verified: VerifiedIdToken;
  try {
    verified = await verifyIdToken(input.idToken);
  } catch (error) {
    // 理由の種類（期限切れ・宛先違いなど）だけを記録する。トークンは出さない
    const reason = (error as { code?: string }).code ?? (error instanceof Error ? error.message : 'unknown');
    console.error('OAuth: ID token verification failed:', reason);
    return { status: 401, body: { error: 'login_required' } };
  }
  const { uid } = verified;
  if (Math.floor(now.getTime() / 1000) - verified.authTime > CONSENT_MAX_AUTH_AGE_SECONDS) {
    return { status: 401, body: { error: 'reauthentication_required' } };
  }

  if (!config.allowedUids.has(uid)) {
    return {
      status: 200,
      body: {
        redirectTo: buildRedirect(request.redirectUri, {
          error: 'access_denied',
          error_description: 'this account is not allowed to connect',
          state: request.state,
          iss: config.origin,
        }),
      },
    };
  }

  const code = await issueAuthorizationCode(
    {
      uid,
      clientId: request.clientId,
      redirectUri: request.redirectUri,
      codeChallenge: request.codeChallenge,
      scope: request.scope,
      resource: request.resource,
    },
    now
  );
  return {
    status: 200,
    body: { redirectTo: buildRedirect(request.redirectUri, { code, state: request.state, iss: config.origin }) },
  };
};
