/**
 * 認可サーバーのメタデータ（RFC 8414。docs/claude-connector/仕様書.md 5.3）
 *
 * issuer は末尾のスラッシュを付けず、メタデータの URL を組み立てた元の値と完全に一致させる
 * （一致しないと MCP クライアントはメタデータを使わない）。code_challenge_methods_supported を
 * 省くと PKCE 非対応とみなされて接続が止まる。クライアント登録は事前登録だけなので、
 * registration_endpoint と client_id_metadata_document_supported は載せない（仕様書 5.4）。
 */
import type { McpConfig } from '../config';
import { SCOPE } from './params';

export const authorizationServerMetadata = (config: Pick<McpConfig, 'origin'>) => ({
  issuer: config.origin,
  authorization_endpoint: `${config.origin}/oauth/authorize`,
  token_endpoint: `${config.origin}/api/oauth/token`,
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
  code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: ['none'],
  scopes_supported: [SCOPE],
  authorization_response_iss_parameter_supported: true,
});
