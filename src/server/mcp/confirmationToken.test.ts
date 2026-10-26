import { describe, expect, it } from 'vitest';
import { UserFacingError } from '@/server/errors';
import { signAccessToken, verifyAccessToken } from '@/server/oauth/accessToken';
import { CONFIRMATION_TTL_SECONDS, signConfirmation, transactionIdFor, verifyConfirmation } from './confirmationToken';
import type { TransactionDraft } from './transactionDraft';

const config = {
  origin: 'https://kakeibo.example.com',
  resource: 'https://kakeibo.example.com/api/mcp',
  tokenSecret: new TextEncoder().encode('x'.repeat(32)),
};
const NOW = new Date(2026, 9, 26, 12);

const draft: TransactionDraft = {
  date: '2026-10-26',
  type: 'expense',
  amount: 5_400,
  category: '交際費',
  paymentMethod: '現金',
  description: 'ランチ 1,200 / カラオケ 2,000 / 夕食 2,200',
};

const later = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

describe('確認トークン', () => {
  it('追加と編集の内容をそのまま取り出せる', async () => {
    const add = await signConfirmation('alice', { action: 'add', draft }, config, NOW);
    const update = await signConfirmation(
      'alice',
      { action: 'update', transactionId: 'abc', changes: { amount: 1_300, subcategory: '' } },
      config,
      NOW
    );

    expect((await verifyConfirmation(add.token, 'alice', config, NOW)).confirmation).toEqual({ action: 'add', draft });
    expect((await verifyConfirmation(update.token, 'alice', config, NOW)).confirmation).toEqual({
      action: 'update',
      transactionId: 'abc',
      changes: { amount: 1_300, subcategory: '' },
    });
    expect(add.expiresAt).toEqual(later(CONFIRMATION_TTL_SECONDS));
  });

  it('期限切れ・別の利用者・改ざん・別の鍵は拒否する', async () => {
    const { token } = await signConfirmation('alice', { action: 'add', draft }, config, NOW);
    const [header, payload, signature] = token.split('.');
    const tampered = JSON.parse(Buffer.from(payload, 'base64url').toString());
    tampered.data.amount = 1;
    const forged = [header, Buffer.from(JSON.stringify(tampered)).toString('base64url'), signature].join('.');
    const otherKey = { ...config, tokenSecret: new TextEncoder().encode('y'.repeat(32)) };

    for (const attempt of [
      () => verifyConfirmation(token, 'alice', config, later(CONFIRMATION_TTL_SECONDS + 1)),
      () => verifyConfirmation(token, 'bob', config, NOW),
      () => verifyConfirmation(forged, 'alice', config, NOW),
      () => verifyConfirmation(token, 'alice', otherKey, NOW),
      () => verifyConfirmation('not-a-token', 'alice', config, NOW),
    ]) {
      await expect(attempt()).rejects.toThrow(UserFacingError);
    }
  });

  it('アクセストークンとは取り違えても通らない', async () => {
    const accessToken = await signAccessToken({ uid: 'alice', scope: 'kakeibo.read', clientId: 'c' }, config, NOW);
    const { token } = await signConfirmation('alice', { action: 'add', draft }, config, NOW);

    await expect(verifyConfirmation(accessToken, 'alice', config, NOW)).rejects.toThrow(UserFacingError);
    await expect(verifyAccessToken(token, config, NOW)).rejects.toThrow();
  });

  it('追加する取引の ID は、同じトークンなら同じ・利用者が違えば違う', async () => {
    const { token } = await signConfirmation('alice', { action: 'add', draft }, config, NOW);
    const { jti } = await verifyConfirmation(token, 'alice', config, NOW);

    expect(transactionIdFor('alice', jti)).toBe(transactionIdFor('alice', jti));
    expect(transactionIdFor('alice', jti)).not.toBe(transactionIdFor('bob', jti));
    expect(transactionIdFor('alice', jti)).toMatch(/^[A-Za-z0-9_-]{20}$/);
  });
});
