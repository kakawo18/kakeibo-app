/**
 * トークンのエンドポイントの入力の検査（#179）と、リフレッシュのときの Firebase の利用者の確認（#178）
 *
 * 形の違うコード・リフレッシュトークンは Firestore を読まずに拒否する（でたらめな値の連打で
 * 読み取りの無料枠を使わせない）。利用者の状態を確かめられないときは、接続を消さずに 503 にする。
 * 保存の部品は差し替えて、呼ばれ方を確かめる。保存を含めた流れは oauth.emulator.test.ts で確かめている。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { McpConfig } from '@/server/config';
import { handleTokenRequest } from '@/server/oauth/tokenEndpoint';
import {
  consumeAuthorizationCode,
  findActiveRefreshToken,
  revokeFamily,
  rotateRefreshToken,
} from '@/server/oauth/store';
import { isTokenFormat, randomToken } from '@/server/oauth/random';

vi.mock('@/server/oauth/store', () => ({
  consumeAuthorizationCode: vi.fn(async () => null),
  rotateRefreshToken: vi.fn(async () => ({ ok: false, reason: 'not_found' })),
  findActiveRefreshToken: vi.fn(async () => null),
  revokeFamily: vi.fn(async () => 1),
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

const lookupAccount = vi.fn();

const request = (params: Record<string, string>) =>
  handleTokenRequest(new URLSearchParams({ client_id: 'kakeibo-claude-test', ...params }), config, new Date(), {
    lookupAccount,
  });

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
    expect(findActiveRefreshToken).not.toHaveBeenCalled();
  });

  it('正しい形の値なら保存先を引く', async () => {
    await request({ grant_type: 'refresh_token', refresh_token: randomToken() });

    expect(findActiveRefreshToken).toHaveBeenCalledOnce();
    expect(rotateRefreshToken).toHaveBeenCalledOnce();
  });
});

describe('リフレッシュのときの Firebase の利用者の確認', () => {
  const connectedAtMs = Date.now() - 60 * 60 * 1000;

  beforeEach(() => {
    vi.mocked(findActiveRefreshToken).mockResolvedValue({ uid: 'alice', familyId: 'family-1', connectedAtMs });
  });

  it('利用者の状態を確かめられなければ 503。接続は消さず、トークンも使用済みにしない', async () => {
    lookupAccount.mockRejectedValue(new Error('accounts:lookup failed with status 403'));

    const response = await request({ grant_type: 'refresh_token', refresh_token: randomToken() });

    expect(response).toEqual({ status: 503, body: { error: 'temporarily_unavailable', error_description: 'please retry later' } });
    expect(revokeFamily).not.toHaveBeenCalled();
    expect(rotateRefreshToken).not.toHaveBeenCalled();
  });

  it('接続を作った後にパスワードが変わっていれば、その接続を消して invalid_grant', async () => {
    lookupAccount.mockResolvedValue({ exists: true, disabled: false, validSinceMs: connectedAtMs + 1000 });

    const response = await request({ grant_type: 'refresh_token', refresh_token: randomToken() });

    expect(response.body).toMatchObject({ error: 'invalid_grant' });
    expect(lookupAccount).toHaveBeenCalledWith('alice');
    expect(revokeFamily).toHaveBeenCalledWith('family-1');
    expect(rotateRefreshToken).not.toHaveBeenCalled();
  });

  it('変わっていなければローテーションに進む', async () => {
    lookupAccount.mockResolvedValue({ exists: true, disabled: false, validSinceMs: connectedAtMs - 1000 });

    await request({ grant_type: 'refresh_token', refresh_token: randomToken() });

    expect(revokeFamily).not.toHaveBeenCalled();
    expect(rotateRefreshToken).toHaveBeenCalledOnce();
  });
});
