/**
 * Claude 連携の環境変数（docs/claude-connector/仕様書.md 9章）
 *
 * 環境変数はこのファイルだけで読む。値が欠けていても読み込みの時点では失敗させず、
 * 使う時点でエラーにする（環境変数の無いビルドやプレビューでもビルドが通るように）。
 * どれもサーバー専用で、NEXT_PUBLIC_ を付けない。
 */
import 'server-only';

/** MCP_ENABLED=1 のときだけ Claude 連携のエンドポイントを有効にする */
export const isMcpEnabled = (): boolean => process.env.MCP_ENABLED === '1';

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

export interface McpConfig {
  /** 本番の URL（末尾のスラッシュなし）。Host ヘッダーからは組み立てない */
  origin: string;
  /** MCP サーバーの URL。アクセストークンの aud */
  resource: string;
  /** 事前登録した OAuth クライアント（Claude）の client_id */
  clientId: string;
  /** Claude 連携を使ってよい Firebase の uid */
  allowedUids: ReadonlySet<string>;
  /** アクセストークンの署名鍵 */
  tokenSecret: Uint8Array;
}

export const getMcpConfig = (): McpConfig => {
  const origin = required('MCP_PUBLIC_ORIGIN').replace(/\/+$/, '');
  return {
    origin,
    resource: `${origin}/api/mcp`,
    clientId: required('MCP_OAUTH_CLIENT_ID'),
    allowedUids: new Set(
      required('MCP_ALLOWED_UIDS')
        .split(',')
        .map((uid) => uid.trim())
        .filter(Boolean)
    ),
    tokenSecret: new TextEncoder().encode(required('MCP_TOKEN_SECRET')),
  };
};
