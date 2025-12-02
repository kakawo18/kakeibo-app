export interface Transaction {
  id: string;
  userId: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  subcategory?: string;
  paymentMethod?: string;
  transactionType?: 'normal' | 'card_payment' | 'card_withdrawal';
  affectsExpense?: boolean;
  affectsBalance?: boolean;
  date: Date;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionTemplate {
  id: string;
  userId: string;
  name: string;
  type: 'income' | 'expense';
  category: string;
  subcategory?: string;
  paymentMethod?: string;
  description?: string;
  amount?: number; // 金額をオプショナルフィールドとして追加
  createdAt: Date;
  updatedAt: Date;
  lastUsed: Date;
  usageCount: number;
}

export interface RecurringTransaction {
  id: string;
  userId: string;
  name: string;              // 例: "家賃"、"投資（積立NISA）"
  amount: number;            // 例: 75000
  category: string;          // 例: "固定費"
  subcategory?: string;      // 例: "家賃"
  paymentMethod?: string;    // 例: "EPOSカード"
  dayOfMonth: number;        // 1-31
  isEnabled: boolean;        // true/false
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  name: string;
  subcategories?: string[];
}

export const EXPENSE_CATEGORIES: Category[] = [
  { name: '食費' },
  { name: '交際費', subcategories: ['飲み会費']},
  { name: '固定費', subcategories: ['家賃', '投資', '通信費', '電気代', 'ガス代', '水道代'] },
  { name: '日用品' },
  { name: '交通費' },
  { name: '趣味代' },
  { name: '旅行代' },
  { name: '医療費' },
  { name: 'その他' },
];

export const INCOME_CATEGORIES: Category[] = [
  { name: '給与', subcategories: ['給与', 'ボーナス', '配当収入'] },
  { name: 'その他' },
];

export interface MonthlyData {
  month: string;
  income: number;
  expense: number;
  balance: number;
  categories: Record<string, number>;
}

export interface ChartData {
  name: string;
  value: number;
  percentage: number;
  color?: string;
}

export const PAYMENT_METHODS = [
  '現金',
  '三井住友カード',
  '三菱UFJカード',
  'amazonカード',
  'EPOSカード',
  '楽天カード',
] as const;