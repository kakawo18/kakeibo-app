# 定期取引機能 設計書

## Overview

定期取引機能は、毎月決まった日に発生する取引（家賃、投資など）を事前に登録し、該当日になったらワンタップで記録できる機能です。既存のテンプレート機能を完全に削除し、より実用的な定期取引機能に置き換えます。

## Architecture

### コンポーネント構成

```
src/
├── components/
│   ├── recurring/
│   │   ├── RecurringTransactionManager.tsx    # 定期取引管理画面
│   │   ├── RecurringTransactionForm.tsx       # 作成・編集フォーム
│   │   ├── RecurringTransactionNotice.tsx     # ダッシュボード通知
│   │   └── RecurringTransactionConfirm.tsx    # 記録確認画面
│   └── ui/
│       └── DashboardContent.tsx               # 修正: 通知セクション追加
├── hooks/
│   └── useRecurringTransactions.ts            # 定期取引フック
└── types/
    └── index.ts                                # 修正: 型定義追加
```

### 削除するファイル
```
src/
├── components/
│   └── ui/
│       └── TemplateSelector.tsx               # 削除
├── hooks/
│   └── useTransactionTemplates.ts             # 削除
```

## Components and Interfaces

### 1. RecurringTransaction型

```typescript
interface RecurringTransaction {
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
```

### 2. useRecurringTransactions フック

```typescript
interface UseRecurringTransactionsReturn {
  recurringTransactions: RecurringTransaction[];
  loading: boolean;
  addRecurringTransaction: (data: Omit<RecurringTransaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateRecurringTransaction: (id: string, data: Partial<RecurringTransaction>) => Promise<void>;
  deleteRecurringTransaction: (id: string) => Promise<void>;
  getActiveRecurringTransactions: () => RecurringTransaction[];
  shouldShowRecurringTransaction: (transaction: RecurringTransaction) => boolean;
}
```

**主要メソッド**:
- `getActiveRecurringTransactions()`: 有効な定期取引のみを返す
- `shouldShowRecurringTransaction(transaction)`: 今日の日付 >= 実行日 の場合にtrueを返す

### 3. RecurringTransactionManager コンポーネント

**Props**:
```typescript
interface RecurringTransactionManagerProps {
  opened: boolean;
  onClose: () => void;
}
```

**機能**:
- 定期取引の一覧表示
- 新規作成ボタン
- 編集・削除ボタン
- 有効/無効トグル

**レイアウト**:
```
┌─────────────────────────────────┐
│ 定期取引の管理            [×]   │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ 家賃                  [編集]│ │
│ │ 75,000円 | 毎月25日          │ │
│ │ 固定費 > 家賃 | EPOSカード   │ │
│ │ [有効] ●                    │ │
│ │ [削除]                      │ │
│ └─────────────────────────────┘ │
│                                 │
│ [+ 新しい定期取引を追加]        │
└─────────────────────────────────┘
```

### 4. RecurringTransactionForm コンポーネント

**Props**:
```typescript
interface RecurringTransactionFormProps {
  opened: boolean;
  onClose: () => void;
  editingTransaction?: RecurringTransaction | null;
}
```

**フォーム項目**:
- 名前（TextInput）
- 金額（NumberInput）
- カテゴリ（NativeSelect/Select）
- サブカテゴリ（NativeSelect/Select）
- 支払方法（NativeSelect/Select）
- 実行日（NumberInput、1-31）

### 5. RecurringTransactionNotice コンポーネント

**Props**:
```typescript
interface RecurringTransactionNoticeProps {
  recurringTransactions: RecurringTransaction[];
  onRecord: (transaction: RecurringTransaction) => void;
}
```

**表示条件**:
- `shouldShowRecurringTransaction()` がtrueの定期取引のみ表示
- 有効な定期取引のみ表示

**レイアウト**:
```
┌─────────────────────────────────┐
│ 📅 今月の定期取引                │
├─────────────────────────────────┤
│ 家賃（25日）                    │
│ 75,000円 - 固定費 > 家賃        │
│ [記録する]                      │
│                                 │
│ 投資（1日）                     │
│ 33,333円 - 固定費 > 投資        │
│ [記録する]                      │
└─────────────────────────────────┘
```

### 6. RecurringTransactionConfirm コンポーネント

**Props**:
```typescript
interface RecurringTransactionConfirmProps {
  opened: boolean;
  onClose: () => void;
  transaction: RecurringTransaction;
  onConfirm: (data: TransactionData) => Promise<void>;
}
```

**機能**:
- 定期取引の情報を全て入力済み状態で表示
- 全項目編集可能（金額、カテゴリ、サブカテゴリ、支払方法）
- 日付は実行日で固定（編集不可）
- メモ欄は空欄
- 「記録する」ボタンで取引を作成

**レイアウト**:
```
┌─────────────────────────────────┐
│ 家賃を記録                [×]   │
├─────────────────────────────────┤
│ 金額                            │
│ [75,000] 円                     │
│                                 │
│ カテゴリ                        │
│ [固定費 ▼]                      │
│                                 │
│ サブカテゴリ                    │
│ [家賃 ▼]                        │
│                                 │
│ 支払方法                        │
│ [EPOSカード ▼]                  │
│                                 │
│ 日付                            │
│ 2025年10月25日（実行日）        │
│                                 │
│ メモ（任意）                    │
│ [                    ]          │
│                                 │
│ [キャンセル] [記録する]        │
└─────────────────────────────────┘
```

## Data Models

### Firestore構造

```
users/
  {userId}/
    recurringTransactions/
      {recurringTransactionId}/
        - name: string
        - amount: number
        - category: string
        - subcategory?: string
        - paymentMethod?: string
        - dayOfMonth: number
        - isEnabled: boolean
        - createdAt: timestamp
        - updatedAt: timestamp
```

### セキュリティルール

```javascript
match /users/{userId}/recurringTransactions/{recurringTransactionId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

## Error Handling

### エラーケース

1. **Firestore接続エラー**
   - エラー通知を表示
   - リトライボタンを提供

2. **バリデーションエラー**
   - 金額が0以下の場合
   - 実行日が1-31の範囲外の場合
   - 必須項目が未入力の場合

3. **削除確認**
   - 削除前に確認ダイアログを表示

### エラーメッセージ

```typescript
const ERROR_MESSAGES = {
  INVALID_AMOUNT: '金額は1円以上を入力してください',
  INVALID_DAY: '実行日は1〜31の範囲で入力してください',
  REQUIRED_FIELD: 'この項目は必須です',
  SAVE_FAILED: '保存に失敗しました。もう一度お試しください',
  DELETE_FAILED: '削除に失敗しました。もう一度お試しください',
};
```

## Testing Strategy

### ユニットテスト

1. **useRecurringTransactions フック**
   - CRUD操作のテスト
   - `shouldShowRecurringTransaction()` のロジックテスト
   - エラーハンドリングのテスト

2. **日付判定ロジック**
   - 今日 >= 実行日 の判定
   - 月末の扱い（31日設定の場合）

### 統合テスト

1. **定期取引の作成から記録まで**
   - 定期取引を作成
   - ダッシュボードに表示されることを確認
   - 記録ボタンをクリック
   - 確認画面が表示されることを確認
   - 記録ボタンをクリック
   - 取引が作成されることを確認

2. **編集・削除**
   - 定期取引を編集
   - 変更が保存されることを確認
   - 定期取引を削除
   - 削除されることを確認

### E2Eテスト

1. **モバイルでの操作**
   - モバイルデバイスで定期取引を作成
   - タップ操作が正常に動作することを確認
   - NativeSelectが正常に動作することを確認

2. **複数の定期取引**
   - 複数の定期取引を作成
   - 全て正常に表示されることを確認
   - それぞれ記録できることを確認

## UI/UX Considerations

### モバイル最適化

- タップ領域: 48px以上
- フォントサイズ: 16px以上（ズーム防止）
- NativeSelectの使用（モバイルのみ）
- 全画面モーダル

### アクセシビリティ

- ラベルの明確化
- エラーメッセージの視認性
- キーボード操作対応（デスクトップ）

### パフォーマンス

- Firestoreのリアルタイムリスナーを使用
- 不要な再レンダリングを防ぐ（useMemo、useCallback）
- 画像の遅延読み込み（該当なし）

## Migration Plan

### テンプレート機能の削除

1. **Phase 1: 定期取引機能の実装**
   - 新機能を完全に実装
   - テンプレート機能は残したまま

2. **Phase 2: テンプレート機能の削除**
   - テンプレート関連のコンポーネントを削除
   - テンプレート関連のフックを削除
   - テンプレートボタンを定期取引ボタンに置き換え
   - 取引フォームからテンプレート関連の機能を削除

3. **Phase 3: データのクリーンアップ**
   - Firestoreのtemplatesコレクションは残す（既存ユーザーのため）
   - 新規ユーザーはtemplatesコレクションを使用しない

### 既存ユーザーへの影響

- テンプレート機能は削除されるが、既存のテンプレートデータは残る
- 必要に応じて定期取引として再作成を推奨
- 移行ガイドを提供（任意）
