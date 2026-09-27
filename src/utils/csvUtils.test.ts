import { describe, expect, it } from 'vitest';
import { testRules as rules, tx } from '@/test/fixtures';
import { buildCSV, parseCSV } from '@/utils/csvUtils';
import { Transaction } from '@/types';

/** エクスポート → インポートの往復 */
const roundTrip = (transactions: Transaction[]) => parseCSV(buildCSV(transactions), rules);

const LEGACY_HEADER = '日付,種別,カテゴリ,サブカテゴリ,金額,メモ,支払方法';

describe('CSV の往復（#102）', () => {
  it('改行を含むメモが1件のまま往復し、後ろの支払方法も欠けない', () => {
    const result = roundTrip([
      tx('2026-03-01', 'expense', 1_200, '食費', {
        description: 'first line\nsecond line',
        paymentMethod: '現金',
      }),
    ]);
    expect(result.skippedRows).toEqual([]);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].description).toBe('first line\nsecond line');
    expect(result.transactions[0].paymentMethod).toBe('現金');
  });

  it('CRLF・カンマ・二重引用符を含むメモも一致する', () => {
    const memo = 'A, "quoted"\r\nB';
    const result = roundTrip([tx('2026-03-01', 'expense', 1, '食費', { description: memo })]);
    expect(result.transactions[0].description).toBe(memo);
  });

  it('数式として解釈される先頭文字は往復で元に戻る', () => {
    const result = roundTrip([tx('2026-03-01', 'expense', 1, '食費', { description: '=SUM(A1)' })]);
    expect(result.transactions[0].description).toBe('=SUM(A1)');
  });

  it('エクスポートでは数式の先頭文字を無害化する', () => {
    const csv = buildCSV([tx('2026-03-01', 'expense', 1, '食費', { description: '=SUM(A1)' })]);
    expect(csv).toContain(`"'=SUM(A1)"`);
  });

  it('スキップ理由の行番号は、改行入りのメモがあってもファイル上の行を指す', () => {
    const csv = [
      LEGACY_HEADER,
      '"2026-03-01","支出","食費","","100","one\ntwo",""', // 2〜3行目
      '"2026-03-02","支出","","","100","",""', // 4行目: カテゴリが空
    ].join('\n');
    expect(parseCSV(csv, rules).skippedRows).toEqual([{ row: 4, reason: 'カテゴリが空' }]);
  });

  it('空行は数えない', () => {
    const csv = [LEGACY_HEADER, '', '"2026-03-01","支出","食費","","100","",""', '  ', ''].join('\n');
    const result = parseCSV(csv, rules);
    expect(result.transactions).toHaveLength(1);
    expect(result.skippedRows).toEqual([]);
  });

  it('BOM 付きでも読める', () => {
    const csv = '﻿' + [LEGACY_HEADER, '"2026-03-01","支出","食費","","100","",""'].join('\n');
    expect(parseCSV(csv, rules).transactions).toHaveLength(1);
  });
});

describe('支出集計フラグの保持（#99）', () => {
  it('支出から外していた取引（過去のカード引き落とし）は、復元後も外れたまま', () => {
    const [restored] = roundTrip([
      tx('2026-03-27', 'expense', 50_000, '食費', {
        paymentMethod: '楽天カード',
        affectsExpense: false,
        transactionType: 'card_withdrawal',
      }),
    ]).transactions;
    expect(restored.affectsExpense).toBe(false);
    expect(restored.transactionType).toBe('card_withdrawal');
    expect(rules.isExcludedFromExpense(restored)).toBe(true);
  });

  it('通常の取引・カード払いのフラグも維持する', () => {
    const restored = roundTrip([
      tx('2026-03-01', 'expense', 1, '食費', { paymentMethod: '現金', transactionType: 'normal' }),
      tx('2026-03-02', 'expense', 1, '食費', { paymentMethod: '楽天カード', transactionType: 'card_payment' }),
    ]).transactions;
    expect(restored.map((t) => [t.transactionType, t.affectsExpense])).toEqual([
      ['normal', true],
      ['card_payment', true],
    ]);
  });

  it('フラグ列の無い旧7列の CSV は、支払方法からフラグを導出する', () => {
    const csv = [
      LEGACY_HEADER,
      '"2026-03-01","支出","食費","","100","","楽天カード"',
      '"2026-03-02","支出","食費","","100","","現金"',
    ].join('\n');
    const restored = parseCSV(csv, rules).transactions;
    expect(restored.map((t) => [t.transactionType, t.affectsExpense])).toEqual([
      ['card_payment', true],
      ['normal', true],
    ]);
  });

  it('見出しが違う列は、位置が同じでもフラグとして読まない（他のアプリの CSV 対策）', () => {
    const csv = [
      `${LEGACY_HEADER},備考1,備考2`,
      '"2026-03-01","支出","食費","","100","","現金","card_withdrawal","0"',
    ].join('\n');
    const [restored] = parseCSV(csv, rules).transactions;
    expect(restored.affectsExpense).toBe(true);
    expect(restored.transactionType).toBe('normal');
  });

  it('取引タイプを持たない古いデータでも「支出に含めない」は維持する', () => {
    const [restored] = roundTrip([
      tx('2026-03-27', 'expense', 1, '食費', {
        paymentMethod: '楽天カード',
        transactionType: undefined,
        affectsExpense: false,
      }),
    ]).transactions;
    expect(restored.affectsExpense).toBe(false);
    expect(restored.transactionType).toBe('card_payment');
  });

  it('フラグ列に想定外の値があれば、その行は導出した値を使う', () => {
    const header = buildCSV([]).split('\n')[0];
    const csv = [header, '"2026-03-01","支出","食費","","100","","現金","???","maybe"'].join('\n');
    const [restored] = parseCSV(csv, rules).transactions;
    expect(restored.affectsExpense).toBe(true);
    expect(restored.transactionType).toBe('normal');
  });
});
