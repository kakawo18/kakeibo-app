/**
 * Claude との接続の確認と解除（/api/oauth/connections。docs/claude-connector/仕様書.md 5.10）
 *
 * 設定画面が Firebase の ID トークンを `Authorization: Bearer` に付けて呼ぶ。
 * 対象はトークンの本人だけで、ほかの利用者の接続には触れない。
 * - GET: まだ使えるリフレッシュトークンがあるか（接続中か）
 * - DELETE: その利用者のリフレッシュトークンをすべて消す。手元のアクセストークンは最長1時間で切れる
 */
import 'server-only';
import { hasActiveRefreshToken, revokeRefreshTokensForUid } from './store';
import { verifyFirebaseIdToken } from './firebaseIdToken';

export interface ConnectionsResponse {
  status: number;
  body: { connected: boolean } | { revoked: number } | { error: string };
}

export const handleConnectionsRequest = async (
  method: 'GET' | 'DELETE',
  authorization: string | null,
  options: { verifyIdToken?: (idToken: string) => Promise<string>; now?: Date } = {}
): Promise<ConnectionsResponse> => {
  const { verifyIdToken = (idToken: string) => verifyFirebaseIdToken(idToken), now = new Date() } = options;
  const [scheme, idToken] = authorization?.split(' ') ?? [];
  if (scheme?.toLowerCase() !== 'bearer' || !idToken) return { status: 401, body: { error: 'login_required' } };

  let uid: string;
  try {
    uid = await verifyIdToken(idToken);
  } catch {
    return { status: 401, body: { error: 'login_required' } };
  }

  return method === 'GET'
    ? { status: 200, body: { connected: await hasActiveRefreshToken(uid, now) } }
    : { status: 200, body: { revoked: await revokeRefreshTokensForUid(uid) } };
};
