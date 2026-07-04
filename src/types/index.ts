/**
 * 型定義ファイル
 *
 * このファイルは家計簿アプリで使用する全ての型定義を管理します。
 *
 * 【カテゴリ・支払方法の変更方法】
 * アプリ内の設定ページ(/settings)から変更できます。
 * 設定は Firestore の users/{uid}/settings/app に保存されます(./settings.ts 参照)。
 *
 * 【注意】
 * - 「投資」「立替金」などの特別な集計は、カテゴリ名ではなく
 *   カテゴリに付与された役割(CategoryRole)で判定されます
 */

// ユーザー設定関連の型(カテゴリ役割・支払方法・月間予算など)
export * from './settings';

// ============================================================
// 取引データの型定義
// ============================================================

/** 取引種別: 収入 or 支出 */
export type TransactionKind = 'income' | 'expense';

/** 取引タイプ: 通常 / カード支払い / カード引き落とし */
export type TransactionType = 'normal' | 'card_payment' | 'card_withdrawal';

/** 前月比較などのトレンド方向 */
export type Trend = 'up' | 'down' | 'same';

/**
 * 取引データ
 * Firestoreに保存される1件の取引を表す
 */
export interface Transaction {
  id: string;                    // 取引ID（Firestoreの自動生成ID）
  userId: string;                // ユーザーID
  type: TransactionKind;         // 取引種別: 収入 or 支出
  amount: number;                // 金額（円）
  category: string;              // カテゴリ（例: "食費", "給与"）
  subcategory?: string;          // サブカテゴリ（例: "飲み会費", "ボーナス"）
  paymentMethod?: string;        // 支払方法（例: "現金", "三井住友カード"）
  transactionType?: TransactionType;  // 取引タイプ
  affectsExpense?: boolean;      // 支出計算に影響するか
  date: Date;                    // 取引日
  description?: string;          // 説明・メモ
  createdAt: Date;               // 作成日時
  updatedAt: Date;               // 更新日時
}

/** 取引の新規作成時に入力する項目（ID・ユーザー・タイムスタンプはシステム側で付与） */
export type TransactionInput = Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;


/**
 * 定期取引
 * 毎月自動で記録される取引（家賃、投資など）
 */
export interface RecurringTransaction {
  id: string;
  userId: string;
  name: string;              // 表示名（例: "家賃"、"投資（積立NISA）"）
  amount: number;            // 金額（例: 75000）
  category: string;          // カテゴリ（例: "固定費"）
  subcategory?: string;      // サブカテゴリ（例: "家賃"）
  paymentMethod?: string;    // 支払方法（例: "EPOSカード"）
  dayOfMonth: number;        // 実行日（1-31）
  isEnabled: boolean;        // 有効/無効
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// カテゴリ定義
// ============================================================

/**
 * カテゴリの型(シンプルな名前+サブカテゴリ名の組)
 * ※ユーザー設定のカテゴリは settings.ts の CategorySetting を使用
 */
export interface Category {
  name: string;              // カテゴリ名
  subcategories?: string[];  // サブカテゴリ一覧
}

// ============================================================
// データ構造の型定義
// ============================================================

/**
 * 月別データ
 * 残高推移グラフ、月別比較に使用
 */
export interface MonthlyData {
  month: string;                      // 月（YYYY-MM形式）
  income: number;                     // 収入合計
  expense: number;                    // 支出合計（投資除外）
  balance: number;                    // 収支（収入 - 支出）
}

/**
 * グラフデータ
 * 円グラフの表示に使用
 */
export interface ChartData {
  name: string;       // カテゴリ名
  value: number;      // 金額
  percentage: number; // 割合（%）
  color?: string;     // 表示色
}

