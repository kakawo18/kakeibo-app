/**
 * 設定画面の「Claude との接続」欄が使う（docs/claude-connector/仕様書.md 5.10）
 *
 * Claude 連携が無効な環境では 404 を返し、画面は欄ごと出さない。
 */
import { isOAuthAvailable, notFound } from '@/server/oauth/availability';
import { handleConnectionsRequest } from '@/server/oauth/connectionsEndpoint';

export const runtime = 'nodejs';

const respond = async (method: 'GET' | 'DELETE', request: Request): Promise<Response> => {
  if (!isOAuthAvailable()) return notFound();
  const { status, body } = await handleConnectionsRequest({
    method,
    authorization: request.headers.get('authorization'),
    connectionId: new URL(request.url).searchParams.get('id'),
  });
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
};

export const GET = (request: Request) => respond('GET', request);
export const DELETE = (request: Request) => respond('DELETE', request);
