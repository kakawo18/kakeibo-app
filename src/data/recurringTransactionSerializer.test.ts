import { describe, expect, it } from 'vitest';
import { deleteField } from 'firebase/firestore';
import {
  toRecurringCreateData,
  toRecurringUpdateData,
} from '@/data/recurringTransactionSerializer';

const isDelete = (value: unknown) =>
  typeof value === 'object' && value !== null && deleteField().isEqual(value as never);

const base = { name: '家賃', amount: 80_000, category: '固定費', dayOfMonth: 27, isEnabled: true };

describe('定期取引の保存形式（#98）', () => {
  it('作成では空の任意項目を書かない', () => {
    const data = toRecurringCreateData({ ...base, subcategory: '', paymentMethod: ' ' });
    expect(data).not.toHaveProperty('subcategory');
    expect(data).not.toHaveProperty('paymentMethod');
  });

  it('更新でサブカテゴリ・支払方法を空にしたら削除する', () => {
    const data = toRecurringUpdateData({ ...base, subcategory: '', paymentMethod: '' });
    expect(isDelete(data.subcategory)).toBe(true);
    expect(isDelete(data.paymentMethod)).toBe(true);
  });

  it('有効/無効の切り替えだけなら他の項目に触れない', () => {
    expect(toRecurringUpdateData({ isEnabled: false })).toEqual({ isEnabled: false });
  });
});
