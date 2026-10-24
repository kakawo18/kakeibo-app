/**
 * 認可サーバーのメタデータ（RFC 8414。docs/claude-connector/仕様書.md 5.3）
 */
import { metadataCorsOptionsRequestHandler } from 'mcp-handler';
import { getMcpConfig } from '@/server/config';
import { isOAuthAvailable, notFound } from '@/server/oauth/availability';
import { authorizationServerMetadata } from '@/server/oauth/metadata';

export const runtime = 'nodejs';

export const GET = (): Response => {
  if (!isOAuthAvailable()) return notFound();
  return Response.json(authorizationServerMetadata(getMcpConfig()), {
    headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'max-age=3600' },
  });
};

export const OPTIONS = metadataCorsOptionsRequestHandler();
