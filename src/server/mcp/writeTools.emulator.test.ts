/**
 * 記録と編集のツールの流れ（確認 → 記録）をエミュレータで確かめる（docs/claude-connector/書き込み仕様書.md 4・5章）
 *
 * - 確認では何も書かず、記録では確認した内容だけを書く
 * - 同じ確認トークンでのやり直しは、二重に記録しない・結果を変えない
 * - 他人の取引・他人の確認トークンは使えない
 */
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebaseAdmin';
import { UserFacingError } from '@/server/errors';
import { serializeSettings } from '@/data/settingsSerializer';
import { testSettings } from '@/test/fixtures';
import {
  addTransaction,
  previewAddTransaction,
  previewUpdateTransaction,
  updateTransaction,
} from '@/server/mcp/writeTools';

const config = { origin: 'https://kakeibo.example.com', tokenSecret: new TextEncoder().encode('x'.repeat(32)) };
const NOW = new Date(2026, 9, 26, 15, 30);
const options = { now: NOW, config };

let alice: string;
let bob: string;

const settingsDoc = () => ({
  ...serializeSettings(testSettings),
  createdAt: Timestamp.fromDate(new Date(0)),
  updatedAt: Timestamp.fromDate(new Date(0)),
});

beforeEach(async () => {
  const run = randomUUID().slice(0, 8);
  alice = `alice-${run}`;
  bob = `bob-${run}`;
  await Promise.all([alice, bob].map((uid) => adminDb().doc(`users/${uid}/settings/app`).set(settingsDoc())));
});

const transactionsOf = async (uid: string) =>
  (await adminDb().collection('transactions').where('userId', '==', uid).get()).docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Array<Record<string, unknown> & { id: string }>;

const lunch = {
  date: '2026-10-26',
  type: 'expense' as const,
  amount: 1_200,
  category: '食費',
  paymentMethod: '現金',
  description: 'ランチ',
};

describe('取引の追加', () => {
  it('確認では何も書かず、記録で確認した内容を1件書く', async () => {
    const preview = await previewAddTransaction(alice, lunch, options);

    expect(preview.transaction).toMatchObject({ date: '2026-10-26', category: '食費', amount: 1_200, accounting: '支出に含める' });
    expect(preview.warnings).toEqual([]);
    expect(await transactionsOf(alice)).toEqual([]);

    const result = await addTransaction(alice, preview.confirmationToken, options);

    expect(result.alreadyRecorded).toBe(false);
    const [stored] = await transactionsOf(alice);
    expect(stored).toMatchObject({ id: result.transaction.id, userId: alice, amount: 1_200, paymentMethod: '現金', transactionType: 'normal' });
    expect((stored.date as Timestamp).toDate()).toEqual(NOW);
  });

  it('同じ確認トークンで呼び直しても1件のまま', async () => {
    const { confirmationToken } = await previewAddTransaction(alice, lunch, options);

    const first = await addTransaction(alice, confirmationToken, options);
    const second = await addTransaction(alice, confirmationToken, options);

    expect(second).toEqual({ ...first, alreadyRecorded: true });
    expect(await transactionsOf(alice)).toHaveLength(1);
  });

  it('同じ日・同じ金額の取引があれば、確認で警告する（他人の取引は数えない）', async () => {
    await addTransaction(alice, (await previewAddTransaction(alice, lunch, options)).confirmationToken, options);
    await addTransaction(bob, (await previewAddTransaction(bob, { ...lunch, amount: 980 }, options)).confirmationToken, options);

    const again = await previewAddTransaction(alice, lunch, options);
    const other = await previewAddTransaction(alice, { ...lunch, amount: 980 }, options);

    expect(again.warnings.map((w) => w.kind)).toEqual(['possible_duplicate']);
    expect(again.warnings[0].transactions).toHaveLength(1);
    expect(other.warnings).toEqual([]);
  });

  it('別の利用者の確認トークンでは記録できない', async () => {
    const { confirmationToken } = await previewAddTransaction(alice, lunch, options);

    await expect(addTransaction(bob, confirmationToken, options)).rejects.toThrow(UserFacingError);
    expect(await transactionsOf(bob)).toEqual([]);
  });

  it('編集の確認トークンでは追加できない', async () => {
    const { transaction } = await addTransaction(alice, (await previewAddTransaction(alice, lunch, options)).confirmationToken, options);
    const edit = await previewUpdateTransaction(alice, transaction.id!, { amount: 1_300 }, options);

    await expect(addTransaction(alice, edit.confirmationToken, options)).rejects.toThrow('update_transaction');
  });
});

describe('取引の編集', () => {
  const recorded = async () =>
    (await addTransaction(alice, (await previewAddTransaction(alice, lunch, options)).confirmationToken, options)).transaction;

  it('確認では変更前と変更後を返して何も書かず、記録で変わる項目だけを書く', async () => {
    const { id } = await recorded();

    const preview = await previewUpdateTransaction(alice, id!, { amount: 1_300, description: 'ランチ（大盛り）' }, options);
    expect(preview.before).toMatchObject({ amount: 1_200, description: 'ランチ' });
    expect(preview.after).toMatchObject({ amount: 1_300, description: 'ランチ（大盛り）' });
    expect(preview.changedFields).toEqual(['amount', 'description']);
    expect((await transactionsOf(alice))[0].amount).toBe(1_200);

    const later = new Date(NOW.getTime() + 60_000);
    const result = await updateTransaction(alice, preview.confirmationToken, { ...options, now: later });

    expect(result).toMatchObject({ alreadyApplied: false, transaction: { amount: 1_300, description: 'ランチ（大盛り）' } });
    const [stored] = await transactionsOf(alice);
    expect(stored).toMatchObject({ amount: 1_300, paymentMethod: '現金', category: '食費' });
    expect((stored.updatedAt as Timestamp).toDate()).toEqual(later);
  });

  it('同じ確認トークンで呼び直しても結果は変わらない', async () => {
    const { id } = await recorded();
    const { confirmationToken } = await previewUpdateTransaction(alice, id!, { amount: 1_300 }, options);

    await updateTransaction(alice, confirmationToken, options);
    const again = await updateTransaction(alice, confirmationToken, options);

    expect(again).toMatchObject({ alreadyApplied: true, transaction: { amount: 1_300 } });
  });

  it('今と同じ値だけなら、確認の時点で断る', async () => {
    const { id } = await recorded();
    await expect(previewUpdateTransaction(alice, id!, { amount: 1_200 }, options)).rejects.toThrow('変える項目がありません');
  });

  it('他人の取引は「見つからない」と同じに扱い、確認も記録もできない', async () => {
    const { id } = await recorded();

    await expect(previewUpdateTransaction(bob, id!, { amount: 1 }, options)).rejects.toThrow('見つかりません');
    await expect(previewUpdateTransaction(alice, 'no-such-id', { amount: 1 }, options)).rejects.toThrow('見つかりません');
    const own = await previewUpdateTransaction(alice, id!, { amount: 1 }, options);
    await expect(updateTransaction(bob, own.confirmationToken, options)).rejects.toThrow(UserFacingError);
    expect((await transactionsOf(alice))[0].amount).toBe(1_200);
  });
});
