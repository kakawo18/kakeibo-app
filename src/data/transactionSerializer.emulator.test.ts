/**
 * 保存形式を実際の Firestore（エミュレータ）と firestore.rules に通して確かめる
 *
 * 単体テストでは「deleteField を返すこと」までしか分からないので、
 * 本当にフィールドが消えるか・ルールが書き込みを許すかをここで見る。
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  RulesTestEnvironment,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  Firestore,
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import { fromTransactionDoc, toTransactionCreateData, toTransactionUpdateData } from '@/data/transactionSerializer';
import { toRecurringCreateData, toRecurringUpdateData } from '@/data/recurringTransactionSerializer';

const UID = 'alice';
let env: RulesTestEnvironment;
let db: Firestore;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-kakeibo',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  db = env.authenticatedContext(UID).firestore() as unknown as Firestore;
});

afterAll(async () => {
  await env?.cleanup();
});

const now = () => Timestamp.fromDate(new Date());

const createTransaction = async (input: Parameters<typeof toTransactionCreateData>[0]) => {
  const ref = await assertSucceeds(
    addDoc(collection(db, 'transactions'), {
      ...toTransactionCreateData(input),
      userId: UID,
      createdAt: now(),
      updatedAt: now(),
    })
  );
  return ref;
};

const read = async (id: string) => {
  const snapshot = await getDoc(doc(db, 'transactions', id));
  return fromTransactionDoc(snapshot.id, snapshot.data()!)!;
};

describe('取引の更新（#98）', () => {
  it('サブカテゴリと支払方法を空にして保存すると、読み直しても空のまま', async () => {
    const ref = await createTransaction({
      type: 'expense', amount: 1_000, category: '食費', subcategory: '外食',
      paymentMethod: '楽天カード', date: new Date(2026, 2, 1),
    });

    await assertSucceeds(
      updateDoc(ref, { ...toTransactionUpdateData({ subcategory: '', paymentMethod: '' }), updatedAt: now() })
    );

    const raw = (await getDoc(ref)).data()!;
    expect(raw).not.toHaveProperty('subcategory');
    expect(raw).not.toHaveProperty('paymentMethod');
    expect((await read(ref.id)).category).toBe('食費');
  });

  it('支出→収入に変えて支払方法を消しても、ルールに通る', async () => {
    const ref = await createTransaction({
      type: 'expense', amount: 1_000, category: '食費', paymentMethod: '現金', date: new Date(),
    });
    await assertSucceeds(
      updateDoc(ref, {
        ...toTransactionUpdateData({ type: 'income', category: '給与', paymentMethod: '', subcategory: '' }),
        updatedAt: now(),
      })
    );
    const t = await read(ref.id);
    expect(t.type).toBe('income');
    expect(t.paymentMethod).toBeUndefined();
  });

  it('送らなかった項目（集計フラグ）は変わらない（#99）', async () => {
    const ref = await createTransaction({
      type: 'expense', amount: 50_000, category: '食費', paymentMethod: '楽天カード',
      date: new Date(), transactionType: 'card_withdrawal', affectsExpense: false,
    });
    await assertSucceeds(
      updateDoc(ref, { ...toTransactionUpdateData({ description: 'メモだけ直す' }), updatedAt: now() })
    );
    const t = await read(ref.id);
    expect(t.affectsExpense).toBe(false);
    expect(t.transactionType).toBe('card_withdrawal');
    expect(t.description).toBe('メモだけ直す');
  });
});

describe('定期取引の更新（#98）', () => {
  it('サブカテゴリと支払方法を空にして保存すると消える', async () => {
    const ref = await assertSucceeds(
      addDoc(collection(db, 'users', UID, 'recurringTransactions'), {
        ...toRecurringCreateData({
          name: '家賃', amount: 80_000, category: '固定費', subcategory: '家賃',
          paymentMethod: '楽天カード', dayOfMonth: 27, isEnabled: true,
        }),
        createdAt: now(),
        updatedAt: now(),
      })
    );

    await assertSucceeds(
      updateDoc(ref, { ...toRecurringUpdateData({ subcategory: '', paymentMethod: '' }), updatedAt: now() })
    );

    const raw = (await getDoc(ref)).data()!;
    expect(raw).not.toHaveProperty('subcategory');
    expect(raw).not.toHaveProperty('paymentMethod');
    expect(raw.name).toBe('家賃');
  });
});
