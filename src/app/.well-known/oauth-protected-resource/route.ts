/**
 * 保護リソースのメタデータ（RFC 9728。docs/claude-connector/仕様書.md 5.3）
 *
 * Claude は /api/mcp の 401 からここを知り、認可サーバー（このアプリ自身）の場所を得る。
 * resource と認可サーバーの URL は MCP_PUBLIC_ORIGIN から組み立てる（Host ヘッダーは使わない）。
 */
import { generateProtectedResourceMetadata, metadataCorsOptionsRequestHandler } from 'mcp-handler';
import { getMcpConfig, isMcpWriteEnabled } from '@/server/config';
import { isOAuthAvailable, notFound } from '@/server/oauth/availability';
import { supportedScopes } from '@/server/oauth/params';

export const runtime = 'nodejs';

export const GET = (): Response => {
  if (!isOAuthAvailable()) return notFound();
  const { origin, resource } = getMcpConfig();
  // mcp-handler の protectedResourceHandler は scopes_supported を載せられないので、同じ内容をここで返す。
  // Claude はここの scopes_supported を見て、認可リクエストで求める scope を決めることがある
  const metadata = generateProtectedResourceMetadata({
    authServerUrls: [origin],
    resourceUrl: resource,
    additionalMetadata: { scopes_supported: supportedScopes(isMcpWriteEnabled()) },
  });
  return Response.json(metadata, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
      'Cache-Control': 'max-age=3600',
    },
  });
};

export const OPTIONS = metadataCorsOptionsRequestHandler();
