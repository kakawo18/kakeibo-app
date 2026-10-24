/**
 * Claude 連携のエンドポイントを開けてよいか
 *
 * 本番では MCP_ENABLED=1 のときだけ。開発中（エミュレータにつないだ開発サーバー）は手元で確かめられるよう開ける。
 * どちらでもなければ 404 にする（プレビュー環境では無効。仕様書 8章）。
 */
import 'server-only';
import { isMcpEnabled } from '../config';
import { isDevBypass } from './verifyMcpToken';

export const isOAuthAvailable = (): boolean => isMcpEnabled() || isDevBypass();

export const notFound = (): Response => new Response(null, { status: 404 });
