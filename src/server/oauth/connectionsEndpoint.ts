/**
 * Claude との接続の確認と解除（/api/oauth/connections。docs/claude-connector/仕様書.md 5.10）
 *
 * 設定画面が Firebase の ID トークンを `Authorization: Bearer` に付けて呼ぶ。
 * 対象はトークンの本人だけで、ほかの利用者の接続には触れない。
 * - GET: まだ使える接続の一覧（いつ許可したか・最後に使った時期）。心当たりの無い接続に気づけるようにする（#178）
 * - DELETE: その利用者の接続をすべて解除する。`?id=` を付ければその接続だけ。手元のアクセストークンは最長1時間で切れる
 */
import 'server-only';
import { listConnections, revokeConnection, revokeRefreshTokensForUid } from './store';
import { verifyFirebaseIdToken } from './firebaseIdToken';

export interface ConnectionView {
  id: string;
  /** ISO 8601 */
  connectedAt: string;
  /** ISO 8601 */
  lastActiveAt: string;
}

export interface ConnectionsResponse {
  status: number;
  body: { connected: boolean; connections: ConnectionView[] } | { revoked: number } | { error: string };
}

/** 接続の ID の形（store.ts の connectionIdOf: sha256 の16進の先頭16文字） */
const CONNECTION_ID_PATTERN = /^[0-9a-f]{16}$/;

export const handleConnectionsRequest = async (
  request: { method: 'GET' | 'DELETE'; authorization: string | null; connectionId?: string | null },
  options: { verifyIdToken?: (idToken: string) => Promise<string>; now?: Date } = {}
): Promise<ConnectionsResponse> => {
  const {
    verifyIdToken = async (idToken: string) => (await verifyFirebaseIdToken(idToken)).uid,
    now = new Date(),
  } = options;
  const [scheme, idToken] = request.authorization?.split(' ') ?? [];
  if (scheme?.toLowerCase() !== 'bearer' || !idToken) return { status: 401, body: { error: 'login_required' } };

  let uid: string;
  try {
    uid = await verifyIdToken(idToken);
  } catch {
    return { status: 401, body: { error: 'login_required' } };
  }

  if (request.method === 'GET') {
    const connections = await listConnections(uid, now);
    return {
      status: 200,
      body: {
        connected: connections.length > 0,
        connections: connections.map((connection) => ({
          id: connection.id,
          connectedAt: connection.connectedAt.toISOString(),
          lastActiveAt: connection.lastActiveAt.toISOString(),
        })),
      },
    };
  }

  const { connectionId } = request;
  if (connectionId === undefined || connectionId === null) {
    return { status: 200, body: { revoked: await revokeRefreshTokensForUid(uid) } };
  }
  if (!CONNECTION_ID_PATTERN.test(connectionId)) return { status: 400, body: { error: 'invalid_request' } };
  return { status: 200, body: { revoked: await revokeConnection(uid, connectionId) } };
};
