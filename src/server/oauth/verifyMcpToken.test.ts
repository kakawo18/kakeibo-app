import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDevBypass, verifyMcpToken } from '@/server/oauth/verifyMcpToken';
import { signAccessToken } from '@/server/oauth/accessToken';

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

describe('アクセストークンの確認', () => {
  const stubConfig = () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('MCP_PUBLIC_ORIGIN', 'https://kakeibo.example.com/');
    vi.stubEnv('MCP_OAUTH_CLIENT_ID', 'kakeibo-claude-test');
    vi.stubEnv('MCP_ALLOWED_UIDS', 'alice, bob');
    vi.stubEnv('MCP_TOKEN_SECRET', 's'.repeat(48));
  };
  const tokenConfig = {
    origin: 'https://kakeibo.example.com',
    resource: 'https://kakeibo.example.com/api/mcp',
    tokenSecret: new TextEncoder().encode('s'.repeat(48)),
  };

  it('正しいトークンなら uid と scope を返す', async () => {
    stubConfig();
    const token = await signAccessToken({ uid: 'alice', scope: 'kakeibo.read', clientId: 'kakeibo-claude-test' }, tokenConfig);

    expect(await verifyMcpToken(request, token)).toMatchObject({
      clientId: 'kakeibo-claude-test',
      scopes: ['kakeibo.read'],
      extra: { uid: 'alice' },
    });
  });

  it('許可リストに無い uid のトークンは、署名が正しくても拒否する', async () => {
    stubConfig();
    const token = await signAccessToken({ uid: 'mallory', scope: 'kakeibo.read', clientId: 'kakeibo-claude-test' }, tokenConfig);

    expect(await verifyMcpToken(request, token)).toBeUndefined();
  });

  it('設定が欠けていれば、どのトークンも受け付けない', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('MCP_TOKEN_SECRET', '');
    const token = await signAccessToken({ uid: 'alice', scope: 'kakeibo.read', clientId: 'kakeibo-claude-test' }, tokenConfig);

    expect(await verifyMcpToken(request, token)).toBeUndefined();
  });
});
