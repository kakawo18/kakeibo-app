/**
 * Firebase Auth の利用者の状態の読み取り（#178）
 *
 * Identity Toolkit の accounts:lookup の応答から、接続を消すべきかを判定する。
 * 通信はスタブにして、宛先・認証・本文と、失敗したときに例外になることを確かめる。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isConnectionRevokedBy,
  lookupFirebaseAccount,
  toAccountState,
} from '@/server/oauth/firebaseAccount';

vi.mock('@/server/firebaseAdmin', () => ({ adminAccessToken: vi.fn(async () => 'admin-access-token') }));

describe('toAccountState', () => {
  it('validSince（秒）と passwordUpdatedAt（ミリ秒）の新しいほうを使う', () => {
    expect(toAccountState({ users: [{ validSince: '1700000000', passwordUpdatedAt: 1700000500000 }] })).toEqual({
      exists: true,
      disabled: false,
      validSinceMs: 1700000500000,
    });
    expect(toAccountState({ users: [{ validSince: '1700000900', passwordUpdatedAt: 1700000500000 }] }).validSinceMs).toBe(
      1700000900000
    );
  });

  it('利用者がいなければ exists: false。無効化されていれば disabled: true', () => {
    expect(toAccountState({})).toMatchObject({ exists: false });
    expect(toAccountState({ users: [{ validSince: '1', disabled: true }] })).toMatchObject({ exists: true, disabled: true });
  });
});

describe('isConnectionRevokedBy', () => {
  const connectedAtMs = 1_700_000_000_000;
  const account = { exists: true, disabled: false, validSinceMs: connectedAtMs - 1 };

  it('接続を作る前のパスワードの変更では消さない', () => {
    expect(isConnectionRevokedBy(account, connectedAtMs)).toBe(false);
    expect(isConnectionRevokedBy({ ...account, validSinceMs: connectedAtMs }, connectedAtMs)).toBe(false);
  });

  it('接続を作った後の変更・アカウントの削除・無効化では消す', () => {
    expect(isConnectionRevokedBy({ ...account, validSinceMs: connectedAtMs + 1000 }, connectedAtMs)).toBe(true);
    expect(isConnectionRevokedBy({ ...account, exists: false }, connectedAtMs)).toBe(true);
    expect(isConnectionRevokedBy({ ...account, disabled: true }, connectedAtMs)).toBe(true);
  });
});

describe('lookupFirebaseAccount', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'demo-kakeibo');
    vi.stubEnv('FIRESTORE_EMULATOR_HOST', '');
    vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '');
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('サービスアカウントのトークンで accounts:lookup を呼び、uid の状態を返す', async () => {
    fetchMock.mockResolvedValue(Response.json({ users: [{ validSince: '1700000000' }] }));

    expect(await lookupFirebaseAccount('alice')).toEqual({ exists: true, disabled: false, validSinceMs: 1700000000000 });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://identitytoolkit.googleapis.com/v1/projects/demo-kakeibo/accounts:lookup');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer admin-access-token');
    expect(JSON.parse(init.body as string)).toEqual({ localId: ['alice'] });
  });

  it('エミュレータに向いているときはエミュレータを管理者（owner）として呼ぶ', async () => {
    vi.stubEnv('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080');
    vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '127.0.0.1:9099');
    fetchMock.mockResolvedValue(Response.json({ users: [] }));

    expect(await lookupFirebaseAccount('alice')).toMatchObject({ exists: false });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/demo-kakeibo/accounts:lookup');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer owner');
  });

  it('権限が無い・通信に失敗したときは例外にする（状態コードだけを伝える）', async () => {
    fetchMock.mockResolvedValue(new Response('{"error":{"message":"PERMISSION_DENIED"}}', { status: 403 }));
    await expect(lookupFirebaseAccount('alice')).rejects.toThrow('status 403');

    fetchMock.mockRejectedValue(new Error('network'));
    await expect(lookupFirebaseAccount('alice')).rejects.toThrow('network');
  });
});
