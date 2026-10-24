import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDevBypass, verifyMcpToken } from '@/server/oauth/verifyMcpToken';

const request = new Request('http://localhost:3000/api/mcp', { method: 'POST' });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('開発用の認証の省略', () => {
  it('開発サーバーでエミュレータにつないでいるときだけ、MCP_DEV_UID の利用者として扱う', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080');
    vi.stubEnv('MCP_DEV_UID', 'dev-user');

    expect(isDevBypass()).toBe(true);
    expect((await verifyMcpToken(request))?.extra?.uid).toBe('dev-user');
  });

  it('本番（NODE_ENV=production）では、MCP_DEV_UID があっても省略しない', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080');
    vi.stubEnv('MCP_DEV_UID', 'dev-user');

    expect(isDevBypass()).toBe(false);
    expect(await verifyMcpToken(request, 'anything')).toBeUndefined();
  });

  it('エミュレータにつないでいなければ、開発サーバーでも省略しない', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('FIRESTORE_EMULATOR_HOST', '');
    vi.stubEnv('MCP_DEV_UID', 'dev-user');

    expect(await verifyMcpToken(request, 'anything')).toBeUndefined();
  });
});
