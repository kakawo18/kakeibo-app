/**
 * トークンのエンドポイント（docs/claude-connector/仕様書.md 5.7・5.9）
 *
 * Claude（Anthropic のクラウド）が application/x-www-form-urlencoded で呼ぶ。
 */
import { getMcpConfig } from '@/server/config';
import { isOAuthAvailable, notFound } from '@/server/oauth/availability';
import { handleTokenRequest } from '@/server/oauth/tokenEndpoint';

export const runtime = 'nodejs';

export const POST = async (request: Request): Promise<Response> => {
  if (!isOAuthAvailable()) return notFound();
  const form = new URLSearchParams(await request.text());
  const { status, body } = await handleTokenRequest(form, getMcpConfig());
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
  });
};
