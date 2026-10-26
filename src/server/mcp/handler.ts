/**
 * MCP の受け口の本体（/api/mcp。認証は route.ts の withMcpAuth がかける）
 *
 * Route Handler から切り出して、テストから直接呼べるようにしている（handler.test.ts）。
 *
 * 通知を待つ長い接続（subscriptions/listen）は受け付けない。このサーバーのツールは変わらないので
 * 送る通知が無く、受け付けると keepalive だけの SSE をクライアントが切るまで開き続ける。
 * Vercel では関数が 300 秒で打ち切られ、クライアントがつなぎ直すのを繰り返して、
 * 誰も質問していなくても関数の実行時間を使い続けていた（ログに 5 分ごとの Runtime Timeout）。
 * - listChanged を出さない: クライアントに「一覧が変わるので購読して」と告げない
 * - maxSubscriptions: 0: それでも listen が来たら、ストリームを開かずにすぐ断る
 */
import 'server-only';
import { createMcpHandler } from 'mcp-handler';
import { registerKakeiboTools } from './tools';
import { kakeiboInstructions } from './instructions';
import { isMcpWriteEnabled } from '../config';
import packageJson from '../../../package.json';

export const kakeiboMcpHandler = createMcpHandler((server) => registerKakeiboTools(server), {
  serverInfo: { name: 'kakeibo', version: packageJson.version },
  instructions: kakeiboInstructions(isMcpWriteEnabled()),
  capabilities: { tools: { listChanged: false } },
  maxSubscriptions: 0,
});
