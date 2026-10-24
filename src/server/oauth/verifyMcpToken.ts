/**
 * MCP の受け口（/api/mcp）でアクセストークンを確かめる（docs/claude-connector/仕様書.md 5.11）
 *
 * 署名・iss・aud・exp を検証し、scope の確認は withMcpAuth の requiredScopes が行う。
 * uid が許可リストに無ければ、トークンが正しくても拒否する（許可リストから外せば即座に止まる）。
 * 失敗の理由は返さない（どれも 401 になる）。
 */
import 'server-only';
import type { AuthInfo } from '@modelcontextprotocol/server';
import { getMcpConfig } from '../config';
import { verifyAccessToken } from './accessToken';

/**
 * 開発用に認証を省いてよいか
 *
 * 開発サーバー（NODE_ENV=development）で、かつ Admin SDK がエミュレータに向いているときだけ。
 * 二つがそろうのはローカルの開発中だけなので、本番のデータを認証なしで読む経路にはならない。
 */
export const isDevBypass = (): boolean =>
  process.env.NODE_ENV === 'development' && Boolean(process.env.FIRESTORE_EMULATOR_HOST);

const verifyBearer = async (bearerToken: string): Promise<AuthInfo | undefined> => {
  try {
    const config = getMcpConfig();
    const token = await verifyAccessToken(bearerToken, config);
    if (!config.allowedUids.has(token.uid)) return undefined;
    return {
      token: bearerToken,
      clientId: token.clientId,
      scopes: token.scopes,
      expiresAt: token.expiresAt,
      extra: { uid: token.uid },
    };
  } catch {
    // 不正なトークン・設定の欠け。中身はログに出さない
    return undefined;
  }
};

export const verifyMcpToken = async (
  _request: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> => {
  if (bearerToken) {
    const verified = await verifyBearer(bearerToken);
    if (verified) return verified;
  }
  const devUid = process.env.MCP_DEV_UID?.trim();
  if (isDevBypass() && devUid) {
    return { token: bearerToken ?? 'dev', clientId: 'dev', scopes: ['kakeibo.read'], extra: { uid: devUid } };
  }
  return undefined;
};
