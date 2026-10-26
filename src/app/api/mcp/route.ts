/**
 * Claude 連携の MCP サーバー（docs/claude-connector/仕様書.md）
 *
 * Claude（Anthropic のクラウド）からの Streamable HTTP をここで受ける。
 * トークンの無い・無効なリクエストには 401 と、保護リソースのメタデータの場所を返す。
 * MCP_ENABLED=1 でない環境では 404（開発環境のエミュレータ接続時を除く）。
 */
import { withMcpAuth } from 'mcp-handler';
import { kakeiboMcpHandler } from '@/server/mcp/handler';
import { verifyMcpToken } from '@/server/oauth/verifyMcpToken';
import { isOAuthAvailable, notFound } from '@/server/oauth/availability';

// Admin SDK は Edge ランタイムでは動かない
export const runtime = 'nodejs';

const authHandler = withMcpAuth(kakeiboMcpHandler, verifyMcpToken, {
  required: true,
  requiredScopes: ['kakeibo.read'],
  // メタデータの URL は Host ヘッダーから組み立てない（仕様書 5.2）
  resourceUrl: process.env.MCP_PUBLIC_ORIGIN?.replace(/\/+$/, '') || undefined,
});

const route = (request: Request): Promise<Response> | Response =>
  isOAuthAvailable() ? authHandler(request) : notFound();

export { route as GET, route as POST, route as DELETE };
