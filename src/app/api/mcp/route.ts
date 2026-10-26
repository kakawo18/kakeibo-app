/**
 * Claude 連携の MCP サーバー（docs/claude-connector/仕様書.md）
 *
 * Claude（Anthropic のクラウド）からの Streamable HTTP をここで受ける。
 * トークンの無い・無効なリクエストには 401 と、保護リソースのメタデータの場所を返す。
 * MCP_ENABLED=1 でない環境では 404（開発環境のエミュレータ接続時を除く）。
 */
import { withMcpAuth } from 'mcp-handler';
import { isMcpWriteEnabled } from '@/server/config';
import { kakeiboMcpHandler } from '@/server/mcp/handler';
import { verifyMcpToken } from '@/server/oauth/verifyMcpToken';
import { isOAuthAvailable, notFound } from '@/server/oauth/availability';
import { READ_SCOPE, supportedScopes } from '@/server/oauth/params';

// Admin SDK は Edge ランタイムでは動かない
export const runtime = 'nodejs';

const authHandler = withMcpAuth(kakeiboMcpHandler, verifyMcpToken, {
  required: true,
  requiredScopes: [READ_SCOPE],
  // メタデータの URL は Host ヘッダーから組み立てない（仕様書 5.2）
  resourceUrl: process.env.MCP_PUBLIC_ORIGIN?.replace(/\/+$/, '') || undefined,
});

/**
 * 401 の WWW-Authenticate の scope を、このサーバーが与えられる scope のすべてにする
 *
 * withMcpAuth は requiredScopes（受け口に必須の kakeibo.read）をそのまま載せる。MCP の認可仕様では
 * クライアントはこの scope を最優先で認可リクエストに使うので、そのままだと書き込みを有効にしても
 * claude.ai が読み取りだけを求め、接続し直しても書き込みの許可が付かない（v6.12.0。書き込み仕様書 8.1 節）。
 */
const advertiseScopes = (response: Response): Response => {
  const challenge = response.headers.get('WWW-Authenticate');
  if (response.status !== 401 || !challenge?.includes('scope="')) return response;
  const headers = new Headers(response.headers);
  headers.set(
    'WWW-Authenticate',
    challenge.replace(/scope="[^"]*"/, `scope="${supportedScopes(isMcpWriteEnabled()).join(' ')}"`)
  );
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};

const route = async (request: Request): Promise<Response> =>
  isOAuthAvailable() ? advertiseScopes(await authHandler(request)) : notFound();

export { route as GET, route as POST, route as DELETE };
