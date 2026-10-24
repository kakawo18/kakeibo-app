/**
 * カード還元ポイント計算
 *
 * 還元率・カード色はユーザー設定(settings.paymentMethods)から渡される。
 * このファイルは純関数のみを提供し、設定の取得はコンポーネント側で行う。
 */
import { Transaction, PaymentMethodSetting } from '@/types';

// カード還元ポイント計算(小数点以下切り捨て)
const calculateCardRewards = (amount: number, rate: number): number =>
  Math.floor(amount * rate);

// 月間カード別還元ポイント集計
export const calculateMonthlyCardRewards = (
  transactions: Pick<Transaction, 'type' | 'paymentMethod' | 'amount'>[],
  paymentMethods: PaymentMethodSetting[]
) => {
  // 還元対象(現金以外かつ還元率>0)の支払方法名 → 還元率
  const rateByName = new Map(
    paymentMethods
      .filter((m) => !m.isCash && m.rewardRate > 0)
      .map((m) => [m.name, m.rewardRate])
  );

  const cardRewards: Record<string, { amount: number; points: number }> = {};
  let totalPoints = 0;

  transactions
    .filter((t) => t.type === 'expense' && t.paymentMethod && rateByName.has(t.paymentMethod))
    .forEach((transaction) => {
      const cardType = transaction.paymentMethod!; // 上のfilterで既にチェック済み
      const points = calculateCardRewards(transaction.amount, rateByName.get(cardType)!);

      if (!cardRewards[cardType]) {
        cardRewards[cardType] = { amount: 0, points: 0 };
      }

      cardRewards[cardType].amount += transaction.amount;
      cardRewards[cardType].points += points;
      totalPoints += points;
    });

  return {
    cardRewards,
    totalPoints,
    totalAmount: Object.values(cardRewards).reduce((sum, card) => sum + card.amount, 0)
  };
};
