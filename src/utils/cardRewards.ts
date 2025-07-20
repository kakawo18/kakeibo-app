// カード別還元率設定
export const CARD_REWARD_RATES = {
  '楽天カード': 0.01,        // 1%
  '三菱UFJカード': 0.07,     // 7%
  'EPOSカード': 0.0025,      // 0.25%
  'amazonカード': 0.01,      // 1%
  '三井住友カード': 0.005,   // 0.5%
} as const;

export type CardType = keyof typeof CARD_REWARD_RATES;

// カード還元ポイント計算
export const calculateCardRewards = (amount: number, cardType: string): number => {
  const rate = CARD_REWARD_RATES[cardType as CardType];
  if (!rate) return 0;
  
  return Math.floor(amount * rate); // 小数点以下切り捨て
};

// 月間カード別還元ポイント集計
export const calculateMonthlyCardRewards = (transactions: { type: string; paymentMethod?: string; amount: number }[]) => {
  const cardRewards: { [key: string]: { amount: number; points: number } } = {};
  let totalPoints = 0;

  transactions
    .filter(t => t.type === 'expense' && t.paymentMethod && CARD_REWARD_RATES[t.paymentMethod as CardType])
    .forEach(transaction => {
      const cardType = transaction.paymentMethod;
      const points = calculateCardRewards(transaction.amount, cardType);
      
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

// カード色設定（UI用）
export const CARD_COLORS = {
  '楽天カード': '#bf0000',
  '三菱UFJカード': '#dc143c',
  'EPOSカード': '#ff6b35',
  'amazonカード': '#ff9900',
  '三井住友カード': '#009639',
} as const;