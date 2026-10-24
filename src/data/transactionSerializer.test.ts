import { describe, expect, it } from 'vitest';
import { deleteField, Timestamp } from 'firebase/firestore';
import {
  fromTransactionDoc,
  toTransactionCreateData,
  toTransactionUpdateData,
} from '@/data/transactionSerializer';

const isDelete = (value: unknown) =>
  typeof value === 'object' && value !== null && deleteField().isEqual(value as never);

describe('toTransactionCreateData', () => {
  it('空の任意項目はキーごと書かない（Firestore は undefined を受け付けない）', () => {
    const data = toTransactionCreateData({
      type: 'expense',
      amount: 1_000,
      category: '食費',
      subcategory: '  ',
      paymentMethod: '',
      date: new Date(2026, 2, 1),
      description: '',
    });
    expect(data).not.toHaveProperty('subcategory');
    expect(data).not.toHaveProperty('paymentMethod');
    expect(data.description).toBe('');
    expect(data.date).toBeInstanceOf(Timestamp);
  });

  it('集計フラグが無ければ通常の取引として補う', () => {
    const data = toTransactionCreateData({
      type: 'expense', amount: 1, category: '食費', date: new Date(),
    });
    expect(data.transactionType).toBe('normal');
    expect(data.affectsExpense).toBe(true);
  });

  it('渡されたフラグ（CSV から戻した支出除外など）はそのまま書く', () => {
    const data = toTransactionCreateData({
      type: 'expense', amount: 1, category: '食費', date: new Date(),
      transactionType: 'card_withdrawal', affectsExpense: false,
    });
    expect(data.transactionType).toBe('card_withdrawal');
    expect(data.affectsExpense).toBe(false);
  });
});

describe('toTransactionUpdateData（#98: 省略 = 変更しない、空 = 消す）', () => {
  it('undefined の項目は書き込みに含めない', () => {
    const data = toTransactionUpdateData({ amount: 500 });
    expect(Object.keys(data)).toEqual(['amount']);
  });

  it('サブカテゴリ・支払方法を空にしたらフィールドを削除する', () => {
    const data = toTransactionUpdateData({ subcategory: '', paymentMethod: ' ' });
    expect(isDelete(data.subcategory)).toBe(true);
    expect(isDelete(data.paymentMethod)).toBe(true);
  });

  it('値があればトリムして上書きする', () => {
    const data = toTransactionUpdateData({ subcategory: ' 外食 ', paymentMethod: '現金' });
    expect(data.subcategory).toBe('外食');
    expect(data.paymentMethod).toBe('現金');
  });

  it('メモは空文字で上書きする（従来どおり）', () => {
    expect(toTransactionUpdateData({ description: '  ' }).description).toBe('');
  });
});

describe('fromTransactionDoc', () => {
  const base = {
    userId: 'u', type: 'expense', amount: 100, category: '食費',
    date: Timestamp.fromDate(new Date(2026, 2, 1)),
  };

  it('フラグの無い古いデータは通常の取引・支出に含めるとして読む', () => {
    const t = fromTransactionDoc('id1', base)!;
    expect(t.transactionType).toBe('normal');
    expect(t.affectsExpense).toBe(true);
    expect(t.subcategory).toBeUndefined();
  });

  it('支出から外したフラグを読み落とさない', () => {
    const t = fromTransactionDoc('id1', { ...base, affectsExpense: false, transactionType: 'card_withdrawal' })!;
    expect(t.affectsExpense).toBe(false);
    expect(t.transactionType).toBe('card_withdrawal');
  });

  it('金額0の取引は有効として読む', () => {
    expect(fromTransactionDoc('id1', { ...base, amount: 0 })?.amount).toBe(0);
  });

  it('必須項目が欠けたドキュメントは null', () => {
    expect(fromTransactionDoc('id1', { ...base, category: '' })).toBeNull();
    expect(fromTransactionDoc('id1', { ...base, date: undefined })).toBeNull();
  });
});
