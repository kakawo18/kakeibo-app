/**
 * 保護リソースのメタデータ（RFC 9728。docs/claude-connector/仕様書.md 5.3）
 *
 * Claude は /api/mcp の 401 からここを知り、認可サーバー（このアプリ自身）の場所を得る。
 * resource と認可サーバーの URL は MCP_PUBLIC_ORIGIN から組み立てる（Host ヘッダーは使わない）。
 */
import { metadataCorsOptionsRequestHandler, protectedResourceHandler } from 'mcp-handler';
import { getMcpConfig } from '@/server/config';
import { isOAuthAvailable, notFound } from '@/server/oauth/availability';

export const runtime = 'nodejs';

export const GET = (request: Request): Response => {
  if (!isOAuthAvailable()) return notFound();
  const { origin, resource } = getMcpConfig();
  return protectedResourceHandler({ authServerUrls: [origin], resourceUrl: resource })(request);
};

export const OPTIONS = metadataCorsOptionsRequestHandler();
