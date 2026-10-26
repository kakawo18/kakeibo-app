/**
 * Admin SDK での書き込み（src/server/kakeiboWriter.ts）をエミュレータで確かめる
 *
 * Admin SDK は firestore.rules を通らないので、「他人の取引を書かない」「アプリと同じ形で書く」ことは
 * kakeiboWriter の責務になる（docs/claude-connector/書き込み仕様書.md 9章）。形がルールとずれていないことは、
 * サーバーが書いた内容を同じ利用者としてクライアント SDK から書き、ルールに通るかで確かめる。
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RulesTestEnvironment, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Firestore, Timestamp as ClientTimestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { TransactionInput } from '@/types';
import { adminDb } from '@/server/firebaseAdmin';
import { createOwnTransaction, updateOwnTransaction } from '@/server/kakeiboWriter';
import { readTransaction } from '@/server/kakeiboReader';
import { UserFacingError } from '@/server/errors';
import { fromTransactionDoc } from '@/data/transactionSerializer';
import { updateTransaction } from '@/data/transactionRepository';

let env: RulesTestEnvironment;
// 他のテストファイルのデータと混ざらないよう、毎回別の uid・ID を使う
let alice: string;
let bob: string;
let run: string;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-kakeibo',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

beforeEach(() => {
  run = randomUUID().slice(0, 8);
  alice = `alice-${run}`;
  bob = `bob-${run}`;
});

afterAll(async () => {
  await env?.cleanup();
});

const NOW = new Date(2026, 9, 26, 15, 30);

const lunch: TransactionInput = {
  type: 'expense',
  amount: 1_200,
  category: '食費',
  subcategory: '外食',
  paymentMethod: '楽天カード',
  date: new Date(2026, 9, 26, 15, 30),
  description: 'ランチ',
  transactionType: 'card_payment',
  affectsExpense: true,
};

const clientDb = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore;

/** Admin SDK の値（Timestamp・FieldValue）を、クライアント SDK で書ける値に置き換える */
const asClientData = (data: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      value instanceof Timestamp ? ClientTimestamp.fromMillis(value.toMillis()) : value,
    ])
  );

describe('createOwnTransaction', () => {
  it('アプリが読むのと同じ形で書く', async () => {
    const id = `t-${run}`;
    const { transaction, created } = await createOwnTransaction(alice, id, lunch, NOW);

    expect(created).toBe(true);
    const stored = (await adminDb().collection('transactions').doc(id).get()).data()!;
    expect(stored.userId).toBe(alice);
    expect(fromTransactionDoc(id, stored)).toEqual(transaction);
    expect(transaction).toMatchObject({ ...lunch, id, userId: alice, createdAt: NOW, updatedAt: NOW });
  });

  it('書いた内容は、同じ利用者がクライアントから書いても firestore.rules に通る', async () => {
    const id = `t-${run}`;
    await createOwnTransaction(alice, id, lunch, NOW);
    await createOwnTransaction(alice, `${id}-plain`, { type: 'income', amount: 1, category: '給与', date: NOW, description: '' }, NOW);

    for (const docId of [id, `${id}-plain`]) {
      const stored = (await adminDb().collection('transactions').doc(docId).get()).data()!;
      await assertSucceeds(setDoc(doc(clientDb(alice), 'transactions', `${docId}-client`), asClientData(stored)));
    }
  });

  it('同じ ID で2回作っても1件のまま。2回目は既存の取引を返す', async () => {
    const id = `t-${run}`;
    await createOwnTransaction(alice, id, lunch, NOW);
    const second = await createOwnTransaction(alice, id, { ...lunch, amount: 9_999 }, NOW);

    expect(second.created).toBe(false);
    expect(second.transaction.amount).toBe(1_200);
    expect((await adminDb().collection('transactions').doc(id).get()).data()!.amount).toBe(1_200);
  });

  it('同じ ID の他人の取引があれば、上書きせずに失敗する', async () => {
    const id = `t-${run}`;
    await createOwnTransaction(bob, id, lunch, NOW);

    await expect(createOwnTransaction(alice, id, lunch, NOW)).rejects.toThrow('collision');
    expect((await adminDb().collection('transactions').doc(id).get()).data()!.userId).toBe(bob);
  });
});

describe('updateOwnTransaction', () => {
  it('変わる項目と updatedAt だけを書き、空文字の項目は消す', async () => {
    const id = `t-${run}`;
    await createOwnTransaction(alice, id, lunch, NOW);
    const later = new Date(2026, 9, 27, 9);

    const updated = await updateOwnTransaction(alice, id, { amount: 1_300, subcategory: '', paymentMethod: '' }, later);

    const stored = (await adminDb().collection('transactions').doc(id).get()).data()!;
    expect(stored).not.toHaveProperty('subcategory');
    expect(stored).not.toHaveProperty('paymentMethod');
    expect(stored.createdAt.toDate()).toEqual(NOW);
    expect(updated).toMatchObject({ amount: 1_300, description: 'ランチ', updatedAt: later, subcategory: undefined });
  });

  it('他人の取引・無い取引は「見つからない」と同じエラーにし、何も書かない', async () => {
    const id = `t-${run}`;
    await createOwnTransaction(bob, id, lunch, NOW);

    const attempts = [() => updateOwnTransaction(alice, id, { amount: 1 }, NOW), () => updateOwnTransaction(alice, `none-${run}`, { amount: 1 }, NOW)];
    for (const attempt of attempts) {
      await expect(attempt()).rejects.toThrow(UserFacingError);
    }
    expect((await adminDb().collection('transactions').doc(id).get()).data()!.amount).toBe(1_200);
    expect((await adminDb().collection('transactions').doc(`none-${run}`).get()).exists).toBe(false);
  });

  it('サーバーで作った取引を、アプリと同じ方法（クライアント SDK）で編集できる', async () => {
    const id = `t-${run}`;
    await createOwnTransaction(alice, id, lunch, NOW);

    await assertSucceeds(updateTransaction(clientDb(alice), id, { description: 'アプリで直した' }));
    const snapshot = await getDoc(doc(clientDb(alice), 'transactions', id));
    expect(snapshot.data()!.description).toBe('アプリで直した');
  });
});

describe('readTransaction', () => {
  it('自分の取引だけを返し、他人の取引と無い取引はどちらも null', async () => {
    const id = `t-${run}`;
    await createOwnTransaction(alice, id, lunch, NOW);

    expect((await readTransaction(alice, id))?.amount).toBe(1_200);
    expect(await readTransaction(bob, id)).toBeNull();
    expect(await readTransaction(alice, `none-${run}`)).toBeNull();
  });
});
