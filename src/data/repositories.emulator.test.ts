/**
 * データアクセス（src/data/*Repository.ts）の契約をエミュレータと firestore.rules で確かめる（#122）
 *
 * - 購読: 自分の取引だけを日付の新しい順に、変換済みで受け取る。0件でも通知される。解除後は通知されない
 * - 作成: ID 指定は上書き（同じ ID で2回書いても1件）
 * - 更新: undefined は変更しない / 空文字は項目を消す
 * - 旧データ: 必須項目が欠けたドキュメントは飛ばす
 * - 設定: 無ければ初期設定を作る（取引の有無で既定を切り替え、既にあれば上書きしない）
 * - 書き込みの形: アプリが書かないフィールド・長すぎる文字列・未知のパスは拒否する（#163）
 * - メールアドレスが未確認のアカウントは、自分のデータでも読み書きできない（#164）
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { verifiedFirestore } from '@/test/emulator';
import {
  Firestore,
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { RecurringTransaction, Transaction, TransactionInput, UserSettings } from '@/types';
import {
  createTransaction,
  deleteTransaction,
  subscribeTransactions,
  updateTransaction,
} from '@/data/transactionRepository';
import {
  createRecurringTransaction,
  deleteRecurringTransaction,
  subscribeRecurringTransactions,
  updateRecurringTransaction,
} from '@/data/recurringTransactionRepository';
import { patchSettings, seedSettingsIfMissing, subscribeSettings } from '@/data/settingsRepository';
import { serializeSettings } from '@/data/settingsSerializer';
import { testSettings } from '@/test/fixtures';

const UID = 'alice';
let env: RulesTestEnvironment;
let db: Firestore;
let otherDb: Firestore;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-kakeibo',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  db = verifiedFirestore(env, UID);
  otherDb = verifiedFirestore(env, 'bob');
});

// 注: 購読を解除しても Listen の通信はしばらく残り、次のテストの clearFirestore と重なると
// エミュレータが RESOURCE_EXHAUSTED のログを出すことがある。SDK が張り直すのでテストには影響しない
// （authenticatedContext は同じインスタンスを使い回すので terminate で閉じることはできない）

afterAll(async () => {
  await env?.cleanup();
});

/** 購読して、条件を満たす値が届くまで待つ */
const nextValue = <T,>(
  subscribe: (handlers: { onChange: (value: T) => void; onError: (error: Error) => void }) => () => void,
  predicate: (value: T) => boolean = () => true
): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error('timeout'));
    }, 10_000);
    const unsubscribe = subscribe({
      onChange: (value) => {
        if (!predicate(value)) return;
        clearTimeout(timer);
        unsubscribe();
        resolve(value);
      },
      onError: (error) => {
        clearTimeout(timer);
        unsubscribe();
        reject(error);
      },
    });
  });

const input = (overrides: Partial<TransactionInput> = {}): TransactionInput => ({
  type: 'expense',
  amount: 1000,
  category: '食費',
  date: new Date(2026, 2, 10, 12),
  transactionType: 'normal',
  affectsExpense: true,
  ...overrides,
});

const transactionsOf = (database: Firestore, uid: string, predicate?: (list: Transaction[]) => boolean) =>
  nextValue<Transaction[]>((handlers) => subscribeTransactions(database, uid, handlers), predicate);

describe('transactionRepository', () => {
  it('0件でも購読の通知が来る（取得失敗と区別できる）', async () => {
    await expect(transactionsOf(db, UID)).resolves.toEqual([]);
  });

  it('自分の取引だけを日付の新しい順に、変換済みで受け取る', async () => {
    await createTransaction(db, UID, input({ amount: 100, date: new Date(2026, 0, 5, 12) }));
    await createTransaction(db, UID, input({ amount: 300, date: new Date(2026, 2, 5, 12), subcategory: '外食' }));
    await createTransaction(otherDb, 'bob', input({ amount: 999 }));

    const list = await transactionsOf(db, UID, (l) => l.length === 2);
    expect(list.map((t) => t.amount)).toEqual([300, 100]);
    expect(list[0]).toMatchObject({ userId: UID, subcategory: '外食', category: '食費' });
    expect(list[0].date).toBeInstanceOf(Date);
  });

  it('ID を指定した作成は上書きになり、2回書いても1件', async () => {
    await createTransaction(db, UID, input({ amount: 100 }), { id: 'recurring-r1-2026-03' });
    await createTransaction(db, UID, input({ amount: 200 }), { id: 'recurring-r1-2026-03' });
    const list = await transactionsOf(db, UID, (l) => l.length === 1 && l[0].amount === 200);
    expect(list).toHaveLength(1);
  });

  it('更新: undefined は変更しない / 空文字は項目を消す', async () => {
    await createTransaction(db, UID, input({ subcategory: '外食', paymentMethod: '現金', description: 'メモ' }), { id: 't1' });
    await updateTransaction(db, 't1', { amount: 1500, subcategory: '' });
    const [t] = await transactionsOf(db, UID, (l) => l[0]?.amount === 1500);
    expect(t.subcategory).toBeUndefined();
    expect(t.paymentMethod).toBe('現金');
    expect(t.description).toBe('メモ');
  });

  it('削除すると購読から消える', async () => {
    await createTransaction(db, UID, input(), { id: 't1' });
    await deleteTransaction(db, 't1');
    await expect(transactionsOf(db, UID, (l) => l.length === 0)).resolves.toEqual([]);
  });

  it('他人の取引は更新・削除できない（所有者の確認はルールが行う）', async () => {
    await createTransaction(otherDb, 'bob', input(), { id: 'bob-1' });
    await assertFails(updateTransaction(db, 'bob-1', { amount: 1 }));
    await assertFails(deleteTransaction(db, 'bob-1'));
  });

  it('必須項目が欠けた古いドキュメントは飛ばす', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const admin = context.firestore() as unknown as Firestore;
      await setDoc(doc(admin, 'transactions', 'broken'), {
        userId: UID, type: 'expense', category: '食費', date: Timestamp.fromDate(new Date(2026, 2, 1)),
      });
    });
    await createTransaction(db, UID, input(), { id: 'ok' });
    const list = await transactionsOf(db, UID, (l) => l.length >= 1);
    expect(list.map((t) => t.id)).toEqual(['ok']);
  });

  it('購読を解除すると通知が来なくなる', async () => {
    const received: number[] = [];
    const unsubscribe = subscribeTransactions(db, UID, {
      onChange: (list) => received.push(list.length),
      onError: () => {},
    });
    await transactionsOf(db, UID); // 初回の通知が届くのを待つ
    unsubscribe();
    const before = received.length;
    await createTransaction(db, UID, input());
    await transactionsOf(db, UID, (l) => l.length === 1);
    expect(received.length).toBe(before);
  });
});

describe('期間を指定した購読（#125: 直近と過去に分けて読む）', () => {
  const boundary = new Date(2025, 8, 1); // 境界（この日時ちょうどは直近に入る）
  const recentOf = (predicate?: (list: Transaction[]) => boolean) =>
    nextValue<Transaction[]>(
      (handlers) => subscribeTransactions(db, UID, handlers, { from: boundary }),
      predicate
    );
  const olderOf = (predicate?: (list: Transaction[]) => boolean) =>
    nextValue<Transaction[]>(
      (handlers) => subscribeTransactions(db, UID, handlers, { before: boundary }),
      predicate
    );

  beforeEach(async () => {
    await createTransaction(db, UID, input({ amount: 1, date: new Date(2026, 8, 10, 12) }), { id: 'new' });
    await createTransaction(db, UID, input({ amount: 2, date: boundary }), { id: 'edge' });
    await createTransaction(db, UID, input({ amount: 3, date: new Date(2025, 7, 31, 23, 59, 59) }), { id: 'justBefore' });
    await createTransaction(db, UID, input({ amount: 4, date: new Date(2023, 0, 5, 12) }), { id: 'old' });
    await createTransaction(otherDb, 'bob', input({ amount: 99, date: new Date(2026, 0, 1) }), { id: 'bob' });
  });

  it('境界ちょうどは直近に入り、過去には入らない。2本を合わせると全件で重複しない', async () => {
    const recent = await recentOf((l) => l.length === 2);
    const older = await olderOf((l) => l.length === 2);
    expect(recent.map((t) => t.id)).toEqual(['new', 'edge']);
    expect(older.map((t) => t.id)).toEqual(['justBefore', 'old']);

    const all = await transactionsOf(db, UID, (l) => l.length === 4);
    expect([...recent, ...older].map((t) => t.id)).toEqual(all.map((t) => t.id));
  });

  it('日付を編集して境界をまたぐと、片方から消えてもう片方に現れる', async () => {
    await updateTransaction(db, 'old', { date: new Date(2026, 0, 20, 12) });
    const recent = await recentOf((l) => l.some((t) => t.id === 'old'));
    const older = await olderOf((l) => !l.some((t) => t.id === 'old'));
    expect(recent.map((t) => t.id)).toEqual(['new', 'old', 'edge']);
    expect(older.map((t) => t.id)).toEqual(['justBefore']);

    await updateTransaction(db, 'new', { date: new Date(2020, 5, 1, 12) });
    const older2 = await olderOf((l) => l.some((t) => t.id === 'new'));
    const recent2 = await recentOf((l) => !l.some((t) => t.id === 'new'));
    expect(older2.map((t) => t.id)).toEqual(['justBefore', 'new']);
    expect(recent2.map((t) => t.id)).toEqual(['old', 'edge']);
  });

  it('onSyncState を渡すと、サーバーで確認できたこと（fromCache = false）が後から分かる', async () => {
    // 手元の書き込みがあると最初はキャッシュから（fromCache = true）届き、
    // サーバーの確認はメタデータだけの変化として後から届く。一覧は作り直さない
    let lists = 0;
    let latest: Transaction[] = [];
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 10_000);
      const unsubscribe = subscribeTransactions(
        db,
        UID,
        {
          onChange: (list) => {
            lists += 1;
            latest = list;
          },
          onError: reject,
        },
        {
          before: boundary,
          onSyncState: (fromCache) => {
            if (fromCache) return;
            clearTimeout(timer);
            unsubscribe();
            resolve();
          },
        }
      );
    });
    expect(latest.map((t) => t.id)).toEqual(['justBefore', 'old']);
    expect(lists).toBe(1);
  });

  it('期間を指定しても他人の取引は含まれない', async () => {
    const recent = await recentOf((l) => l.length >= 2);
    expect(recent.every((t) => t.userId === UID)).toBe(true);
  });
});

describe('recurringTransactionRepository', () => {
  const recurringOf = (predicate?: (list: RecurringTransaction[]) => boolean) =>
    nextValue<RecurringTransaction[]>((handlers) => subscribeRecurringTransactions(db, UID, handlers), predicate);

  it('実行日の早い順に受け取り、更新（空文字で項目を消す）・削除できる', async () => {
    await createRecurringTransaction(db, UID, { name: '家賃', amount: 80000, category: '固定費', subcategory: '家賃', dayOfMonth: 27, isEnabled: true });
    await createRecurringTransaction(db, UID, { name: '携帯', amount: 3000, category: '固定費', dayOfMonth: 5, isEnabled: true });
    const list = await recurringOf((l) => l.length === 2);
    expect(list.map((r) => r.dayOfMonth)).toEqual([5, 27]);
    expect(list[1].userId).toBe(UID);

    const rent = list[1];
    await updateRecurringTransaction(db, UID, rent.id, { amount: 85000, subcategory: '' });
    const updated = await recurringOf((l) => l.some((r) => r.amount === 85000));
    expect(updated.find((r) => r.id === rent.id)?.subcategory).toBeUndefined();

    await deleteRecurringTransaction(db, UID, rent.id);
    await expect(recurringOf((l) => l.length === 1)).resolves.toHaveLength(1);
  });
});

describe('settingsRepository', () => {
  const settingsOf = (predicate?: (s: UserSettings | null) => boolean) =>
    nextValue<UserSettings | null>((handlers) => subscribeSettings(db, UID, handlers), predicate);

  it('設定が無いときは null が届き、初期設定（取引が無いので汎用の既定）を作れる', async () => {
    await expect(settingsOf()).resolves.toBeNull();
    await seedSettingsIfMissing(db, UID);
    const settings = await settingsOf((s) => s !== null);
    expect(settings!.categories.length).toBeGreaterThan(0);
  });

  it('取引がある既存ユーザーにはレガシー設定を作る', async () => {
    await createTransaction(db, UID, input());
    await seedSettingsIfMissing(db, UID);
    const settings = await settingsOf((s) => s !== null);
    // レガシー設定には旧ハードコードの「固定費」の投資サブカテゴリがある
    expect(settings!.categories.some((c) => c.subcategories.some((s) => s.roles.includes('investment')))).toBe(true);
  });

  it('既に設定があれば初期設定で上書きしない', async () => {
    await seedSettingsIfMissing(db, UID);
    await patchSettings(db, UID, { monthlyBudget: 123456 });
    await seedSettingsIfMissing(db, UID);
    const snapshot = await getDoc(doc(db, 'users', UID, 'settings', 'app'));
    expect(snapshot.data()?.monthlyBudget).toBe(123456);
  });

  it('部分更新は渡した項目だけを書く', async () => {
    await seedSettingsIfMissing(db, UID);
    const before = await settingsOf((s) => s !== null);
    await patchSettings(db, UID, { chartPreferences: { categoryTrendCategories: ['食費'] } });
    const after = await settingsOf((s) => s?.chartPreferences?.categoryTrendCategories?.[0] === '食費');
    expect(after!.categories).toEqual(before!.categories);
    expect(after!.monthlyBudget).toBe(before!.monthlyBudget);
  });

  it('他人の設定は読めない', async () => {
    await seedSettingsIfMissing(db, UID);
    await expect(
      nextValue<UserSettings | null>((handlers) => subscribeSettings(otherDb, UID, handlers))
    ).rejects.toThrow();
  });
});

describe('書き込みの形と大きさ（firestore.rules。#163）', () => {
  /** ルールを通さずに書く（上限を入れる前に保存された既存データの再現） */
  const writeWithoutRules = (path: string, id: string, data: Record<string, unknown>) =>
    env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore() as unknown as Firestore, path, id), data);
    });

  const transactionData = (overrides: Record<string, unknown> = {}) => ({
    userId: UID,
    type: 'expense',
    amount: 1000,
    category: '食費',
    date: Timestamp.fromDate(new Date(2026, 2, 10, 12)),
    transactionType: 'normal',
    affectsExpense: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
  });

  it('取引: アプリが書くフィールドは全部通り、それ以外のフィールドは作成・更新とも拒否する', async () => {
    await assertSucceeds(
      createTransaction(
        db,
        UID,
        input({ subcategory: '外食', paymentMethod: '現金', description: 'あ'.repeat(200), recurringTransactionId: 'r1', recurringMonth: '2026-03' }),
        { id: 't1' }
      )
    );
    await assertFails(setDoc(doc(db, 'transactions', 'junk'), transactionData({ junk: 'x' })));
    await assertFails(updateDoc(doc(db, 'transactions', 't1'), { junk: 'x' }));
  });

  it('取引: 長すぎる文字列・未知の取引タイプ・形式の違う対象月は拒否する', async () => {
    const ref = (id: string) => doc(db, 'transactions', id);
    await assertFails(setDoc(ref('a'), transactionData({ description: 'あ'.repeat(201) })));
    await assertFails(setDoc(ref('b'), transactionData({ subcategory: 'あ'.repeat(51) })));
    await assertFails(setDoc(ref('c'), transactionData({ paymentMethod: 'あ'.repeat(51) })));
    await assertFails(setDoc(ref('d'), transactionData({ transactionType: 'other' })));
    await assertFails(setDoc(ref('e'), transactionData({ affectsExpense: 'yes' })));
    await assertFails(setDoc(ref('f'), transactionData({ recurringMonth: 'x'.repeat(1000) })));
    // 廃止済みのレガシー値は CSV の復元で書き戻すので通す
    await assertSucceeds(setDoc(ref('g'), transactionData({ transactionType: 'card_withdrawal' })));
  });

  it('取引: 上限を入れる前の長いメモを持つ取引も、メモ以外は編集できる。メモを長いまま書き換えるのは拒否する', async () => {
    await writeWithoutRules('transactions', 'legacy', transactionData({ description: 'あ'.repeat(500) }));
    await assertSucceeds(updateTransaction(db, 'legacy', { amount: 2000, description: 'あ'.repeat(500) }));
    await assertFails(updateTransaction(db, 'legacy', { description: 'い'.repeat(500) }));
    await assertSucceeds(updateTransaction(db, 'legacy', { description: '短いメモ' }));
  });

  it('設定: 初期設定・部分更新は通り、知らない項目や件数の多すぎる配列は拒否する', async () => {
    const ref = doc(db, 'users', UID, 'settings', 'app');
    await assertFails(setDoc(ref, { ...serializeSettings(testSettings), junk: 'x' }));
    await assertSucceeds(setDoc(ref, serializeSettings(testSettings)));
    await assertSucceeds(patchSettings(db, UID, { monthlyBudget: 200_000 }));
    await assertFails(updateDoc(ref, { junk: 'x' }));
    await assertFails(updateDoc(ref, { categories: Array.from({ length: 201 }, () => ({})) }));
    await assertFails(updateDoc(ref, { paymentMethods: 'x' }));
    await assertFails(updateDoc(ref, { monthlyBudget: 'x' }));
  });

  it('設定: settings/app 以外のドキュメントは書けない', async () => {
    await assertFails(setDoc(doc(db, 'users', UID, 'settings', 'other'), serializeSettings(testSettings)));
  });

  it('定期取引: 知らない項目・長すぎる名前・範囲外の実行日は拒否する', async () => {
    const col = collection(db, 'users', UID, 'recurringTransactions');
    const base = { name: '家賃', amount: 80000, category: '固定費', dayOfMonth: 27, isEnabled: true, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
    await assertSucceeds(setDoc(doc(col, 'r1'), base));
    await assertFails(setDoc(doc(col, 'r2'), { ...base, junk: 'x' }));
    await assertFails(setDoc(doc(col, 'r3'), { ...base, name: 'あ'.repeat(51) }));
    await assertFails(setDoc(doc(col, 'r4'), { ...base, dayOfMonth: 32 }));
    await assertFails(setDoc(doc(col, 'r5'), { ...base, dayOfMonth: 5.5 }));
    await assertFails(setDoc(doc(col, 'r6'), { name: '家賃' }));
    await assertFails(updateDoc(doc(col, 'r1'), { junk: 'x' }));
    await assertFails(updateRecurringTransaction(db, UID, 'r1', { name: 'あ'.repeat(51) }));
  });

  it('定期取引: 上限を入れる前の長い名前を持つものも、名前以外は編集できる', async () => {
    await writeWithoutRules(`users/${UID}/recurringTransactions`, 'legacy', {
      name: 'あ'.repeat(80), amount: 1000, category: '固定費', dayOfMonth: 1, isEnabled: true,
    });
    await assertSucceeds(updateRecurringTransaction(db, UID, 'legacy', { name: 'あ'.repeat(80), amount: 2000 }));
  });

  it('users/{uid} 配下のアプリが使わないパスは、本人でも読み書きできない', async () => {
    await assertFails(setDoc(doc(db, 'users', UID, 'junk', 'x'), { data: 'x' }));
    await assertFails(setDoc(doc(db, 'users', UID), { data: 'x' }));
    await assertFails(setDoc(doc(db, 'users', UID, 'settings', 'app', 'nested', 'x'), { data: 'x' }));
    await assertFails(getDoc(doc(db, 'users', UID, 'junk', 'x')));
  });
});

describe('メールアドレスが未確認のアカウント（firestore.rules。#164）', () => {
  it('自分のデータでも読み書きできない', async () => {
    // email_verified を持たないトークン（確認の仕組みを入れる前に登録したアカウントや、他人のアドレスで登録したもの）
    const unverified = env.authenticatedContext('carol').firestore() as unknown as Firestore;
    await env.withSecurityRulesDisabled(async (context) => {
      const admin = context.firestore() as unknown as Firestore;
      await setDoc(doc(admin, 'transactions', 'c1'), { userId: 'carol', type: 'expense', amount: 1, category: '食費', date: Timestamp.now() });
      await setDoc(doc(admin, 'users', 'carol', 'settings', 'app'), serializeSettings(testSettings));
    });

    await assertFails(getDoc(doc(unverified, 'transactions', 'c1')));
    await assertFails(getDocs(query(collection(unverified, 'transactions'), where('userId', '==', 'carol'))));
    await assertFails(createTransaction(unverified, 'carol', input()));
    await assertFails(deleteTransaction(unverified, 'c1'));
    await assertFails(getDoc(doc(unverified, 'users', 'carol', 'settings', 'app')));
    await assertFails(patchSettings(unverified, 'carol', { monthlyBudget: 1 }));
    await assertFails(
      createRecurringTransaction(unverified, 'carol', { name: '家賃', amount: 1, category: '固定費', dayOfMonth: 1, isEnabled: true })
    );
  });
});

describe('Claude 連携の認可コード・リフレッシュトークン（firestore.rules）', () => {
  it('ログインしていても、クライアントからは読めず書けない（Admin SDK だけが使う）', async () => {
    for (const path of ['oauthAuthorizationCodes', 'oauthRefreshTokens']) {
      await env.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore() as unknown as Firestore, path, 'h1'), { uid: UID });
      });
      await assertFails(getDoc(doc(db, path, 'h1')));
      await assertFails(getDocs(query(collection(db, path), where('uid', '==', UID))));
      await assertFails(setDoc(doc(db, path, 'h2'), { uid: UID }));
    }
  });
});
