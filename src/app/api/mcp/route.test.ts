/**
 * MCP の受け口の 401 が、Claude に求めさせる scope（WWW-Authenticate の scope）
 *
 * MCP の認可仕様では、クライアントは 401 の WWW-Authenticate の scope を最優先で認可リクエストに使う。
 * ここが kakeibo.read だけだと、書き込みを有効にしても claude.ai は読み取りだけを求め、
 * 接続し直しても書き込みの許可が付かない（v6.12.0 で起きた）。
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

let POST: (request: Request) => Promise<Response> | Response;

beforeAll(async () => {
  vi.stubEnv('MCP_ENABLED', '1');
  vi.stubEnv('MCP_PUBLIC_ORIGIN', 'https://kakeibo.example.com');
  ({ POST } = await import('./route'));
});

afterEach(() => {
  vi.stubEnv('MCP_WRITE_ENABLED', '');
});

const unauthenticated = () =>
  POST(
    new Request('https://kakeibo.example.com/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: '{}',
    })
  );

const challengeScope = (response: Response) =>
  /scope="([^"]*)"/.exec(response.headers.get('WWW-Authenticate') ?? '')?.[1];

describe('トークンの無いリクエストへの 401', () => {
  it('書き込みが有効なら、読み取りと書き込みの両方を求めさせる', async () => {
    vi.stubEnv('MCP_WRITE_ENABLED', '1');
    const response = await unauthenticated();

    expect(response.status).toBe(401);
    expect(challengeScope(response)).toBe('kakeibo.read kakeibo.write');
    expect(response.headers.get('WWW-Authenticate')).toContain(
      'resource_metadata="https://kakeibo.example.com/.well-known/oauth-protected-resource"'
    );
  });

  it('書き込みを止めていれば、読み取りだけを求めさせる', async () => {
    const response = await unauthenticated();

    expect(response.status).toBe(401);
    expect(challengeScope(response)).toBe('kakeibo.read');
  });
});
