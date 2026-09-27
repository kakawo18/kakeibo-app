/**
 * CSV の一括書き込みが途中で失敗したときの挙動（#103）
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RulesTestEnvironment, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Firestore, collection, getDocs, query, where } from 'firebase/firestore';
import { TransactionInput } from '@/types';
import { ImportWriteError, writeTransactionsInBatches } from '@/data/transactionImport';

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

const row = (amount: number, category = '食費'): TransactionInput => ({
  type: 'expense', amount, category, date: new Date(2026, 2, 1),
});
const count = async () =>
  (await getDocs(query(collection(db, 'transactions'), where('userId', '==', UID)))).size;

describe('writeTransactionsInBatches', () => {
  it('2つ目のバッチで失敗すると、保存済みの件数を返し、再試行で重複しない', async () => {
    // 3件ずつのバッチ。5件目はカテゴリが空で、ルールに拒否される
    const rows = [row(1), row(1), row(1), row(2), row(2, ''), row(2)];

    const error = await writeTransactionsInBatches(db, UID, rows, { importId: 'file1', batchSize: 3 })
      .then(() => null, (e: unknown) => e);
    expect(error).toBeInstanceOf(ImportWriteError);
    expect((error as ImportWriteError).written).toBe(3);
    expect(await count()).toBe(3);

    // 原因を直した同じファイルを取り込み直す（同額・同日の3件は別の取引として残る）
    const fixed = [row(1), row(1), row(1), row(2), row(2), row(2)];
    await expect(
      writeTransactionsInBatches(db, UID, fixed, { importId: 'file1', batchSize: 3 })
    ).resolves.toBe(6);
    expect(await count()).toBe(6);
  });

  it('同じファイルを2回取り込んでも重複しない', async () => {
    const rows = [row(1), row(2)];
    await writeTransactionsInBatches(db, UID, rows, { importId: 'file2' });
    await writeTransactionsInBatches(db, UID, rows, { importId: 'file2' });
    expect(await count()).toBe(2);
  });

  it('別のファイルなら同じ内容の行でも別の取引として追加する', async () => {
    await writeTransactionsInBatches(db, UID, [row(1)], { importId: 'fileA' });
    await writeTransactionsInBatches(db, UID, [row(1)], { importId: 'fileB' });
    expect(await count()).toBe(2);
  });
});
