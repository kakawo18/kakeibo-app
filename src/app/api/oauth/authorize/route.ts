/**
 * 同意画面の「許可する」を受けて認可コードを発行する（docs/claude-connector/仕様書.md 5.5）
 *
 * 本文は { idToken, query }。応答の redirectTo へは画面が location.assign で移動する。
 */
import { getMcpConfig } from '@/server/config';
import { isOAuthAvailable, notFound } from '@/server/oauth/availability';
import { handleAuthorizeApproval } from '@/server/oauth/authorizeEndpoint';

export const runtime = 'nodejs';

export const POST = async (request: Request): Promise<Response> => {
  if (!isOAuthAvailable()) return notFound();
  const input = await request.json().catch(() => ({}));
  const { status, body } = await handleAuthorizeApproval(input ?? {}, getMcpConfig());
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
};
