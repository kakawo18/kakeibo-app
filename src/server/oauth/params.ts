/**
 * 認可リクエスト（/oauth/authorize のクエリ）の検証（docs/claude-connector/仕様書.md 5.5）
 *
 * client_id と redirect_uri が不正なときは、リダイレクトせずにエラーを表示する（fatal）。
 * 不正な redirect_uri へエラーを返すと、攻撃者の用意した URL へ利用者を送る踏み台になるため。
 * それ以外の不正は、redirect_uri へ error を付けて返す。
 */
import { CHALLENGE_PATTERN } from './pkce';

/** 読み取り（v1 から）。MCP の受け口はこれを必須にする */
export const READ_SCOPE = 'kakeibo.read';
/** 取引の追加と編集（docs/claude-connector/書き込み仕様書.md 8章）。MCP_WRITE_ENABLED=1 のときだけ出す */
export const WRITE_SCOPE = 'kakeibo.write';

/** 認可サーバーが今与えられる scope */
export const supportedScopes = (writeEnabled: boolean): string[] =>
  writeEnabled ? [READ_SCOPE, WRITE_SCOPE] : [READ_SCOPE];

const splitScope = (scope: string | undefined): string[] => (scope ?? '').split(' ').filter(Boolean);

/**
 * 認可リクエストの scope から、与える scope を決める。知らない scope があれば null
 *
 * 省略なら今与えられるすべて。指定があればそれに kakeibo.read を足す（受け口が kakeibo.read を必須にするため）。
 * 並びは supported の順にそろえる。
 */
export const grantScope = (requested: string | undefined, supported: readonly string[]): string | null => {
  const list = splitScope(requested);
  if (list.some((s) => !supported.includes(s))) return null;
  const granted = new Set(list.length > 0 ? [READ_SCOPE, ...list] : supported);
  return supported.filter((s) => granted.has(s)).join(' ');
};

/** リフレッシュで指定された scope が、最初に許可した scope の範囲内か（省略は範囲内。RFC 6749 6章） */
export const isWithinScope = (requested: string | undefined, granted: string): boolean => {
  const allowed = splitScope(granted);
  return splitScope(requested).every((s) => allowed.includes(s));
};

/** claude.ai（Web・デスクトップ・スマホ）のコールバック */
export const CLAUDE_REDIRECT_URI = 'https://claude.ai/api/mcp/auth_callback';

/** 開発環境での手作業の確認用（手順書 5.10）。開発用の認証の省略と同じ条件のときだけ許す */
export const DEV_REDIRECT_URI = 'http://localhost:9999/callback';

export interface AuthorizeRequest {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
  resource: string;
  state?: string;
}

export type AuthorizeValidation =
  | { ok: true; request: AuthorizeRequest }
  | { ok: false; fatal: true; message: string }
  | { ok: false; fatal: false; redirectUri: string; error: string; description: string; state?: string };

/** クエリの値。同じ名前が複数あれば不正として扱う */
type QueryValue = string | string[] | undefined;

const single = (value: QueryValue): string | undefined | null =>
  Array.isArray(value) ? null : value;

export const validateAuthorizeParams = (
  query: Record<string, QueryValue>,
  expected: {
    clientId: string;
    resource: string;
    redirectUris: readonly string[];
    /** 与えられる scope（省略なら kakeibo.read だけ） */
    scopes?: readonly string[];
  }
): AuthorizeValidation => {
  const clientId = single(query.client_id);
  const redirectUri = single(query.redirect_uri);
  if (!clientId || clientId !== expected.clientId) {
    return { ok: false, fatal: true, message: 'このアプリからの接続は受け付けていません（client_id が違います）。' };
  }
  if (!redirectUri || !expected.redirectUris.includes(redirectUri)) {
    return { ok: false, fatal: true, message: '戻り先の URL が登録されたものと違います（redirect_uri が違います）。' };
  }

  const state = single(query.state) ?? undefined;
  const fail = (error: string, description: string): AuthorizeValidation => ({
    ok: false, fatal: false, redirectUri, error, description, state,
  });

  if (single(query.response_type) !== 'code') {
    return fail('unsupported_response_type', 'response_type must be code');
  }
  if (single(query.code_challenge_method) !== 'S256') {
    return fail('invalid_request', 'code_challenge_method must be S256');
  }
  const codeChallenge = single(query.code_challenge);
  if (!codeChallenge || !CHALLENGE_PATTERN.test(codeChallenge)) {
    return fail('invalid_request', 'code_challenge is invalid');
  }
  const supported = expected.scopes ?? [READ_SCOPE];
  const requestedScope = single(query.scope);
  const scope = requestedScope === null ? null : grantScope(requestedScope, supported);
  if (scope === null) {
    return fail('invalid_scope', `supported scopes: ${supported.join(' ')}`);
  }
  const resource = single(query.resource);
  if (resource === null || (resource !== undefined && resource !== expected.resource)) {
    return fail('invalid_target', 'resource does not match this server');
  }

  return {
    ok: true,
    request: { clientId, redirectUri, codeChallenge, scope, resource: expected.resource, state },
  };
};

/** redirect_uri にクエリを足した URL（undefined の値は付けない） */
export const buildRedirect = (redirectUri: string, params: Record<string, string | undefined>): string => {
  const url = new URL(redirectUri);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) url.searchParams.set(key, value);
  });
  return url.toString();
};
