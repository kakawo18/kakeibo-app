/**
 * Admin SDK での読み出し（src/server/kakeiboReader.ts）をエミュレータで確かめる
 *
 * Admin SDK は firestore.rules を通らないので、「他人のデータを読まない」ことは
 * kakeiboReader の責務になる（docs/claude-connector/仕様書.md 7.2）。ここで一番確かめたいのはそれ。
 * npm run test:emulator は FIRESTORE_EMULATOR_HOST を設定するので、Admin SDK はエミュレータにつながる。
 */
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebaseAdmin';
import {
  readRecordedPeriod,
  readRecurringTransactions,
  readSettings,
  readTransactions,
} from '@/server/kakeiboReader';
import { UserFacingError } from '@/server/errors';
import { serializeSettings } from '@/data/settingsSerializer';
import { testSettings } from '@/test/fixtures';

// 他のテストファイルのデータと混ざらないよう、毎回別の uid を使う
let alice: string;
let bob: string;

beforeEach(() => {
  const run = randomUUID().slice(0, 8);
  alice = `alice-${run}`;
  bob = `bob-${run}`;
});

const writeTransaction = (userId: string, date: Date, amount: number, extra: Record<string, unknown> = {}) =>
  adminDb()
    .collection('transactions')
    .add({
      userId,
      type: 'expense',
      amount,
      category: '食費',
      date: Timestamp.fromDate(date),
      transactionType: 'normal',
      affectsExpense: true,
      createdAt: Timestamp.fromDate(date),
      updatedAt: Timestamp.fromDate(date),
      ...extra,
    });

// アプリと同じ保存形式の設定。日時だけは Admin SDK の Timestamp に替える
// （serializeSettings はクライアント SDK の Timestamp を作り、Admin SDK はそれを書けない）
const settingsDoc = () => ({
  ...serializeSettings(testSettings),
  createdAt: Timestamp.fromDate(new Date(0)),
  updatedAt: Timestamp.fromDate(new Date(0)),
});

const wholeYear = { from: new Date(2026, 0, 1), before: new Date(2027, 0, 1) };

describe('readTransactions', () => {
  it('指定した uid の取引だけを返す（他人の取引は混ざらない）', async () => {
    await writeTransaction(alice, new Date(2026, 2, 5, 12), 1_000);
    await writeTransaction(bob, new Date(2026, 2, 5, 12), 9_999);
    await writeTransaction(alice, new Date(2026, 2, 6, 12), 2_000);

    const transactions = await readTransactions(alice, wholeYear);

    expect(transactions.map((t) => t.amount)).toEqual([2_000, 1_000]);
    expect(transactions.every((t) => t.userId === alice)).toBe(true);
  });

  it('期間は from を含み before を含まない', async () => {
    await writeTransaction(alice, new Date(2026, 2, 1), 1);
    await writeTransaction(alice, new Date(2026, 2, 31, 23, 59), 2);
    await writeTransaction(alice, new Date(2026, 3, 1), 3);

    const march = await readTransactions(alice, { from: new Date(2026, 2, 1), before: new Date(2026, 3, 1) });

    expect(march.map((t) => t.amount)).toEqual([2, 1]);
  });

  it('Admin SDK の Timestamp を Date に変換し、必須項目が欠けたドキュメントは飛ばす', async () => {
    await writeTransaction(alice, new Date(2026, 4, 10, 12), 500, { subcategory: '外食' });
    await adminDb().collection('transactions').add({
      userId: alice,
      date: Timestamp.fromDate(new Date(2026, 4, 11)),
    });

    const [transaction, ...rest] = await readTransactions(alice, wholeYear);

    expect(rest).toEqual([]);
    expect(transaction.date).toEqual(new Date(2026, 4, 10, 12));
    expect(transaction.subcategory).toBe('外食');
  });

  it('uid が空なら読まない', async () => {
    await expect(readTransactions('', wholeYear)).rejects.toThrow('uid is required');
  });
});

describe('readRecordedPeriod', () => {
  it('最も古い取引と最も新しい取引の日付を返す。他人の取引は見ない', async () => {
    await writeTransaction(alice, new Date(2024, 3, 1), 1);
    await writeTransaction(alice, new Date(2026, 9, 20), 1);
    await writeTransaction(alice, new Date(2025, 5, 1), 1);
    await writeTransaction(bob, new Date(2020, 0, 1), 1);

    expect(await readRecordedPeriod(alice)).toEqual({
      first: new Date(2024, 3, 1),
      last: new Date(2026, 9, 20),
    });
  });

  it('取引が無ければ null', async () => {
    expect(await readRecordedPeriod(alice)).toBeNull();
  });
});

describe('readSettings', () => {
  it('users/{uid}/settings/app を読む', async () => {
    await adminDb().doc(`users/${alice}/settings/app`).set(settingsDoc());

    const settings = await readSettings(alice);

    expect(settings.monthlyBudget).toBe(testSettings.monthlyBudget);
    expect(settings.categories.map((c) => c.name)).toEqual(testSettings.categories.map((c) => c.name));
  });

  it('設定が無ければ、利用者に見せてよい説明つきのエラー', async () => {
    await adminDb().doc(`users/${bob}/settings/app`).set(settingsDoc());

    await expect(readSettings(alice)).rejects.toBeInstanceOf(UserFacingError);
  });
});

describe('readRecurringTransactions', () => {
  it('自分の定期取引だけを実行日の早い順に返す', async () => {
    const base = { amount: 1_000, category: '固定費', isEnabled: true };
    await adminDb().collection(`users/${alice}/recurringTransactions`).add({ ...base, name: '家賃', dayOfMonth: 27 });
    await adminDb().collection(`users/${alice}/recurringTransactions`).add({ ...base, name: '保険', dayOfMonth: 5 });
    await adminDb().collection(`users/${bob}/recurringTransactions`).add({ ...base, name: '他人', dayOfMonth: 1 });

    const recurring = await readRecurringTransactions(alice);

    expect(recurring.map((r) => r.name)).toEqual(['保険', '家賃']);
    expect(recurring.every((r) => r.userId === alice)).toBe(true);
  });
});
