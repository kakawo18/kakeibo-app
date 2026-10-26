/**
 * MCP の受け口が、通知を待つ長い接続（subscriptions/listen）を開かないこと
 *
 * このサーバーのツールは変わらないので、通知は送らない。listen を受け付けると、
 * keepalive だけの SSE をクライアントが切るまで開き続け、Vercel では 300 秒で
 * 打ち切り → クライアントがつなぎ直す、を繰り返して関数の実行時間を使い続けていた。
 */
import { describe, expect, it } from 'vitest';
import { kakeiboMcpHandler } from '@/server/mcp/handler';

const META = {
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientCapabilities': {},
  'io.modelcontextprotocol/clientInfo': { name: 'test', version: '0' },
};

const post = (method: string, params: Record<string, unknown>, signal?: AbortSignal) =>
  kakeiboMcpHandler(
    new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'MCP-Protocol-Version': '2026-07-28',
        'Mcp-Method': method,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: { _meta: META, ...params } }),
      signal,
    })
  );

describe('通知の購読（subscriptions/listen）', () => {
  it('ツールの一覧が変わることを告げない（listChanged を出さない）', async () => {
    const body = await (await post('server/discover', {})).json();

    expect(body.result.capabilities.tools?.listChanged ?? false).toBe(false);
  });

  it('listen を受け付けず、ストリームを開いたままにしない', async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3_000);
    try {
      const response = await post('subscriptions/listen', { notifications: { toolsListChanged: true } }, controller.signal);
      // 開いたままのストリームなら、ここで本文を読み切れずに中断される
      const text = await response.text();
      expect(text).not.toContain('notifications/subscriptions/acknowledged');
    } finally {
      clearTimeout(timer);
    }
  });
});

describe('記録と編集のツール（書き込み仕様書）', () => {
  it('MCP_WRITE_ENABLED が無ければ、読み取りのツールだけを出す', async () => {
    const body = await (await post('tools/list', {})).json();
    const names: string[] = body.result.tools.map((tool: { name: string }) => tool.name);

    expect(names).toContain('get_kakeibo_overview');
    expect(names.filter((name) => /transaction$/.test(name) && name !== 'search_transactions')).toEqual([]);
  });
});
