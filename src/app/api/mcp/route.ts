/**
 * Claude 連携の MCP サーバー（docs/claude-connector/仕様書.md）
 *
 * Claude（Anthropic のクラウド）からの Streamable HTTP をここで受ける。
 * トークンの無い・無効なリクエストには 401 と、保護リソースのメタデータの場所を返す。
 * MCP_ENABLED=1 でない環境では 404（開発環境のエミュレータ接続時を除く）。
 */
import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { isMcpEnabled } from '@/server/config';
import { registerKakeiboTools } from '@/server/mcp/tools';
import { KAKEIBO_INSTRUCTIONS } from '@/server/mcp/instructions';
import { isDevBypass, verifyMcpToken } from '@/server/oauth/verifyMcpToken';
import packageJson from '../../../../package.json';

// Admin SDK は Edge ランタイムでは動かない
export const runtime = 'nodejs';

const handler = createMcpHandler((server) => registerKakeiboTools(server), {
  serverInfo: { name: 'kakeibo', version: packageJson.version },
  instructions: KAKEIBO_INSTRUCTIONS,
});

const authHandler = withMcpAuth(handler, verifyMcpToken, {
  required: true,
  requiredScopes: ['kakeibo.read'],
  // メタデータの URL は Host ヘッダーから組み立てない（仕様書 5.2）
  resourceUrl: process.env.MCP_PUBLIC_ORIGIN?.replace(/\/+$/, '') || undefined,
});

const route = (request: Request): Promise<Response> | Response =>
  isMcpEnabled() || isDevBypass() ? authHandler(request) : new Response(null, { status: 404 });

export { route as GET, route as POST, route as DELETE };
