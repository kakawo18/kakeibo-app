/**
 * トークンのエンドポイントの入力の検査（#179）
 *
 * 形の違うコード・リフレッシュトークンは Firestore を読まずに拒否する（でたらめな値の連打で
 * 読み取りの無料枠を使わせない）。保存の部品は差し替えて、呼ばれないことを確かめる。
 * 正しい形の値での流れは oauth.emulator.test.ts で確かめている。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { McpConfig } from '@/server/config';
import { handleTokenRequest } from '@/server/oauth/tokenEndpoint';
import { consumeAuthorizationCode, rotateRefreshToken } from '@/server/oauth/store';
import { isTokenFormat, randomToken } from '@/server/oauth/random';

vi.mock('@/server/oauth/store', () => ({
  consumeAuthorizationCode: vi.fn(async () => null),
  rotateRefreshToken: vi.fn(async () => ({ ok: false, reason: 'not_found' })),
  issueRefreshToken: vi.fn(),
  deleteExpired: vi.fn(),
}));

const config: McpConfig = {
  origin: 'https://kakeibo.example.com',
  resource: 'https://kakeibo.example.com/api/mcp',
  clientId: 'kakeibo-claude-test',
  allowedUids: new Set(['alice']),
  tokenSecret: new TextEncoder().encode('s'.repeat(48)),
};

const request = (params: Record<string, string>) =>
  handleTokenRequest(new URLSearchParams({ client_id: 'kakeibo-claude-test', ...params }), config);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('isTokenFormat', () => {
  it('randomToken の値を受け付け、長さや文字の違う値は受け付けない', () => {
    expect(isTokenFormat(randomToken())).toBe(true);
    expect(isTokenFormat('a'.repeat(42))).toBe(false);
    expect(isTokenFormat('a'.repeat(44))).toBe(false);
    expect(isTokenFormat(`${'a'.repeat(42)}=`)).toBe(false);
    expect(isTokenFormat(`${'a'.repeat(42)}/`)).toBe(false);
  });
});

describe('形の違う値は Firestore を読まずに拒否する', () => {
  it('認可コード', async () => {
    const response = await request({
      grant_type: 'authorization_code',
      code: 'not-a-code',
      redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
      code_verifier: 'v'.repeat(64),
    });

    expect(response.body).toMatchObject({ error: 'invalid_grant' });
    expect(consumeAuthorizationCode).not.toHaveBeenCalled();
  });

  it('リフレッシュトークン', async () => {
    const response = await request({ grant_type: 'refresh_token', refresh_token: 'not-a-token' });

    expect(response.body).toMatchObject({ error: 'invalid_grant' });
    expect(rotateRefreshToken).not.toHaveBeenCalled();
  });

  it('正しい形の値なら保存先を引く', async () => {
    await request({ grant_type: 'refresh_token', refresh_token: randomToken() });

    expect(rotateRefreshToken).toHaveBeenCalledOnce();
  });
});
