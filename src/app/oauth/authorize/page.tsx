/**
 * Claude との接続の同意画面（OAuth の認可エンドポイント。docs/claude-connector/仕様書.md 5.5）
 *
 * サーバー側でクエリを検証してから画面を出す。client_id か redirect_uri が不正ならどこへも移動せず
 * エラーだけを表示し、それ以外の不正は redirect_uri へ error を付けて戻す。
 * タブ（(tabs) グループ）の外に置き、ヘッダーやタブバーは出さない。
 */
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ConsentError, ConsentScreen } from '@/features/claude-connect';
import { getMcpConfig } from '@/server/config';
import { isOAuthAvailable } from '@/server/oauth/availability';
import { allowedRedirectUris } from '@/server/oauth/authorizeEndpoint';
import { buildRedirect, validateAuthorizeParams } from '@/server/oauth/params';

export const metadata: Metadata = {
  title: 'Claude との接続 | 家計簿',
  robots: { index: false, follow: false },
};

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // 先にクエリを読む。読まずに notFound() すると、ビルド時（MCP_ENABLED が無い）の 404 が静的に固定される
  const query = await searchParams;
  if (!isOAuthAvailable()) notFound();
  const config = getMcpConfig();
  const validation = validateAuthorizeParams(query, {
    clientId: config.clientId,
    resource: config.resource,
    redirectUris: allowedRedirectUris(),
  });

  if (!validation.ok && validation.fatal) return <ConsentError message={validation.message} />;
  if (!validation.ok) {
    redirect(
      buildRedirect(validation.redirectUri, {
        error: validation.error,
        error_description: validation.description,
        state: validation.state,
        iss: config.origin,
      })
    );
  }

  const { request } = validation;
  // 検証済みなので、どの値も1つの文字列
  const plainQuery = Object.fromEntries(
    Object.entries(query).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  );
  return (
    <ConsentScreen
      query={plainQuery}
      redirectHost={new URL(request.redirectUri).host}
      cancelUrl={buildRedirect(request.redirectUri, {
        error: 'access_denied',
        state: request.state,
        iss: config.origin,
      })}
    />
  );
}
