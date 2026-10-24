import { describe, expect, it } from 'vitest';
import { importIdFromText, importedTransactionId } from '@/data/transactionImport';

describe('importIdFromText（#103）', () => {
  it('同じ内容なら同じ ID、1文字でも違えば別の ID', async () => {
    const a = await importIdFromText('日付,種別\n"2026-03-01","支出"');
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(await importIdFromText('日付,種別\n"2026-03-01","支出"')).toBe(a);
    expect(await importIdFromText('日付,種別\n"2026-03-02","支出"')).not.toBe(a);
  });

  it('行の位置ごとに別の ID（同額・同日の正当な取引をまとめない）', () => {
    expect(importedTransactionId('abc', 0)).not.toBe(importedTransactionId('abc', 1));
  });
});
