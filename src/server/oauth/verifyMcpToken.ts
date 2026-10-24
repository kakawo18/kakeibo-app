/**
 * MCP の受け口（/api/mcp）でアクセストークンを確かめる（docs/claude-connector/仕様書.md 5.11）
 *
 * 認可サーバー（手順書 PR 3）ができるまでは、開発環境でエミュレータにつないでいるときだけ
 * 認証を省いて MCP_DEV_UID の利用者として扱う。それ以外は常に未認証（401）になる。
 */
import 'server-only';
import type { AuthInfo } from '@modelcontextprotocol/server';

/**
 * 開発用に認証を省いてよいか
 *
 * 開発サーバー（NODE_ENV=development）で、かつ Admin SDK がエミュレータに向いているときだけ。
 * 二つがそろうのはローカルの開発中だけなので、本番のデータを認証なしで読む経路にはならない。
 */
export const isDevBypass = (): boolean =>
  process.env.NODE_ENV === 'development' && Boolean(process.env.FIRESTORE_EMULATOR_HOST);

export const verifyMcpToken = async (
  _request: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> => {
  const devUid = process.env.MCP_DEV_UID?.trim();
  if (isDevBypass() && devUid) {
    return { token: bearerToken ?? 'dev', clientId: 'dev', scopes: ['kakeibo.read'], extra: { uid: devUid } };
  }
  return undefined;
};
