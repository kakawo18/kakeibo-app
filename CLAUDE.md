# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a personal household budget management web application built with Next.js, supporting both smartphone and desktop access. The app provides comprehensive financial tracking with credit card payment separation and multi-month navigation.

## Development Commands

```bash
# Development server (basic)
npm run dev

# Development server (WSL with external access)
npm run dev -- --hostname 0.0.0.0

# Build for production
npm run build

# Start production server
npm run start

# Run linting
npm run lint

# Type checking
npm run type-check
```

### WSL Environment Access
- Local: http://localhost:3000
- External (Windows browser): http://172.23.222.42:3000 (IP may vary)

## Tech Stack Architecture

**Frontend Framework**: Next.js 15.3.4 with App Router
**Language**: TypeScript 5
**UI Framework**: Mantine 8.1.1 (components, forms, dates, charts, notifications)
**Styling**: TailwindCSS 4
**Backend**: Firebase (Firestore for data, Auth for authentication)
**Date Management**: Day.js
**Charts**: Recharts 2.15.4
**Animation**: Framer Motion 11.15.0

## Core Architecture

### Authentication System
- **File**: `/src/contexts/AuthContext.tsx`
- **Pattern**: React Context + Firebase Auth
- **Features**: Email/password authentication with persistent state

### Data Management
- **File**: `/src/hooks/useTransactions.ts`
- **Pattern**: Custom hook with Firestore real-time subscriptions
- **Operations**: CRUD operations with optimistic updates
- **Data Flow**: Firestore ↔ useTransactions hook ↔ Components

### State Management
- **Pattern**: React hooks + Context (no external state management)
- **Global State**: Authentication only
- **Local State**: Component-level useState/useEffect

## Core Business Logic

### Transaction Type System
The app uses a sophisticated transaction classification system:

```typescript
type TransactionType = 'normal' | 'card_payment' | 'card_withdrawal'
```

**Transaction Flow**:
1. **`normal`**: Regular cash transactions (immediate balance impact)
2. **`card_payment`**: Credit card purchases (affects expenses, not balance)
3. **`card_withdrawal`**: Credit card charges (affects balance, not expenses)

### Financial Calculations (`/src/utils/calculations.ts`)

**Dual Calculation System**:
- **Expense Calculation**: Includes cash payments + card payments (excludes card withdrawals)
- **Balance Calculation**: Includes cash payments + card withdrawals (excludes card payments)

**Key Functions**:
- `calculateMonthlyData()`: Processes all transactions into monthly summaries
- `calculateCategoryChartData()`: Generates pie chart data for income/expense breakdown

### Category Management (`/src/types/index.ts`)

**Expense Categories**:
- 食費 (食費, 飲み会費)
- 光熱費 (電気代, ガス代)
- 固定費 (家賃, 投資)
- 交通費, 趣味代, 旅行代, 医療費
- カード引き落とし (各クレジットカード会社)
- その他

**Income Categories**:
- 給与 (給与, ボーナス)
- その他

**Payment Methods**:
現金, 三井住友カード, 三菱UFJカード, amazonカード, EPOSカード, 楽天カード

## Key Files & Responsibilities

### Core Business Logic
- `/src/utils/calculations.ts` - Financial calculations and monthly data processing
- `/src/utils/dateUtils.ts` - Date formatting and month navigation utilities
- `/src/types/index.ts` - TypeScript interfaces and category definitions

### Data Layer
- `/src/hooks/useTransactions.ts` - Transaction CRUD operations with Firestore
- `/src/contexts/AuthContext.tsx` - Authentication state management
- `/src/lib/firebase.ts` - Firebase configuration and initialization

### UI Components
- `/src/components/forms/TransactionForm.tsx` - Transaction creation/editing with smart card logic
- `/src/components/ui/TransactionList.tsx` - Transaction display with sorting and actions
- `/src/components/charts/` - Data visualization components
- `/src/components/ui/CSVImportExport.tsx` - Data backup/restore functionality

### Application Shell
- `/src/app/page.tsx` - Main dashboard with month navigation and summary cards
- `/src/app/layout.tsx` - Root layout and global providers

## Firebase Configuration

Required environment variables:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

## Credit Card Logic Implementation

### Current Implementation
1. **Card Payment**: User pays with credit card
   - `transactionType: 'card_payment'`
   - `affectsExpense: true` (counts as monthly expense)
   - `affectsBalance: false` (no immediate balance impact)

2. **Card Withdrawal**: Credit card company charges account
   - `transactionType: 'card_withdrawal'`
   - `affectsExpense: false` (already counted as expense)
   - `affectsBalance: true` (reduces actual balance)

### Balance Timing Implementation
**Current Implementation**: Card payments affect the **next month's** balance to reflect realistic cash flow timing.

**Logic**: When processing monthly balances, the system applies card payments from the **previous month** to the current month's balance calculation. This ensures that:
- Credit card payments made in June affect July's balance
- Reflects when money actually leaves the bank account (next billing cycle)
- Provides accurate cash flow tracking

**Key Implementation Details**:
1. **Card Payment (`card_payment`)**: Affects expenses immediately, but not balance
2. **Balance Calculation**: Previous month's `card_payment` transactions are applied to current month's balance
3. **Continuous Month Generation**: System creates month data for all months from first transaction to last transaction +1 month
4. **Mixed Withdrawal Support**: Also handles traditional `card_withdrawal` transactions in the same month

**Implementation**: `/src/utils/calculations.ts` lines 79-97
```typescript
// 前月のカード支払い（今月の残高から引き落とし）
const previousMonthCardPayments = transactions
  .filter(t => 
    formatMonth(t.date) === previousMonth && 
    t.transactionType === 'card_payment'
  )
  .reduce((sum, t) => sum + t.amount, 0);

// 今月のカード引き落とし（従来の引き落とし取引）
const monthCardWithdrawal = transactions
  .filter(t => 
    formatMonth(t.date) === monthData.month && 
    t.transactionType === 'card_withdrawal'
  )
  .reduce((sum, t) => sum + t.amount, 0);

// 実残高 = 前月残高 + 今月収入 - 今月現金支払い - 前月カード支払い - 今月カード引き落とし
runningBalance = runningBalance + monthIncome - monthCashExpense - previousMonthCardPayments - monthCardWithdrawal;
```

## CSV Import/Export System

**Features**:
- Full data backup in CSV format
- Data restoration from CSV files
- Date range: 2+ years of transaction history
- Format: Standard CSV with Japanese headers

**Usage**: Accessible via menu in main dashboard (three dots icon)

## Month Navigation System

**Features**:
- Select any month/year (2 years back, 1 year forward)
- Previous/next month buttons
- URL state persistence via query parameters
- Separate data views per month (except balance chart which shows cumulative data)

**Implementation**: Query parameter `?month=YYYY-MM` drives all month-specific displays

## Recent Changes and Improvements

### 2024-06 Update: Credit Card Balance Timing Fix
**Problem Solved**: Credit card payments were incorrectly affecting the same month's balance instead of the next month's balance.

**Root Cause**: 
- Card payments created `transactionType: 'card_payment'`
- Balance calculation was looking for `transactionType: 'card_withdrawal'`
- This mismatch caused card payments to never affect balance calculations

**Solutions Implemented**:
1. **Fixed Transaction Type Matching**: Balance calculation now correctly searches for previous month's `card_payment` transactions
2. **Continuous Month Generation**: Added logic to create month data for all months between first and last transaction +1 month
3. **Dual Withdrawal Support**: System now handles both `card_payment` (delayed impact) and `card_withdrawal` (immediate impact) transactions

**Testing Scenario**:
- May: 40,000円 income → Balance: 40,000円
- June: 100円 card payment → Expense: 100円, Balance: 40,000円 (unchanged)
- July: No transactions → Expense: 0円, Balance: 39,900円 (June's card payment applied)

### 2025-06-26 Update: Transaction Edit Form Fix & Performance Optimization

#### Transaction Edit Form Fix
**Problem Solved**: Transaction edit form was resetting all fields instead of preserving existing data.

**Root Cause**: 
- `useForm` `initialValues` only evaluated on first render
- No dynamic updating when `editingTransaction` prop changed
- Form state not synchronized with editing data

**Solutions Implemented**:
1. **Dynamic Form Value Updates**: Added `useEffect` to update form values when `editingTransaction` changes
2. **Proper Form Initialization**: Static `initialValues` with dynamic updates via `useEffect`
3. **Safe Dependency Management**: Used ESLint disable for appropriate hook dependencies

**Files Modified**: `/src/components/forms/TransactionForm.tsx`

#### Performance Optimization & Infinite Loop Fix
**Problem Solved**: "Maximum update depth exceeded" error caused by infinite rendering loops.

**Root Causes**:
1. **TransactionForm**: `useEffect` dependency array included `form` object causing infinite loops
2. **Chart Components**: Creating new objects on every render without memoization

**Solutions Implemented**:
1. **TransactionForm useEffect Fix**:
   - Removed `form` from dependency array
   - Added ESLint disable comment for exhaustive-deps rule
   - Only `editingTransaction` triggers form updates

2. **Chart Component Optimization**:
   - **LineChart**: Added `useMemo` for `chartData` calculation
   - **PieChart**: Added `useMemo` for both `chartData` and `displayTitle`
   - Moved hooks before early returns to comply with React Hook rules

**Files Modified**:
- `/src/components/forms/TransactionForm.tsx`
- `/src/components/charts/LineChart.tsx` 
- `/src/components/charts/PieChart.tsx`
- `/src/utils/calculations.ts` (removed unused dayjs import)

**Performance Benefits**:
- Eliminated infinite rendering loops
- Reduced unnecessary re-calculations in chart components
- Improved overall application stability and performance

### Code Quality Improvements
**TypeScript & ESLint**: All type errors and lint warnings resolved
- Removed unused imports and variables
- Replaced `any` types with specific TypeScript interfaces
- Added `type-check` script to package.json
- Fixed React Hook dependency warnings and violations
- Optimized component re-rendering with proper memoization

### 2025-07-05 Update: v1.1.0 Mobile Optimization & Performance Enhancement

#### Mobile Freeze Issue Resolution
**Problem Solved**: Smartphone users experienced app freeze when selecting subcategories during transaction entry.

**Root Cause Analysis**:
1. **Performance Bottleneck**: Heavy calculations in `TransactionForm.tsx:72-74` executed on every render
2. **React 19 Compatibility**: Potential compatibility issues with Mantine 8.1.1
3. **Form State Management**: Competition between `useForm` and `useEffect` state updates
4. **Mobile UI/UX**: Lack of mobile-optimized interface design

#### Solutions Implemented

##### 1. Performance Optimization with useMemo
**File**: `/src/components/forms/TransactionForm.tsx`
```typescript
// Before: Heavy calculations on every render
const categories = form.values.type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
const selectedCategory = categories.find(cat => cat.name === form.values.category);
const subcategories = selectedCategory?.subcategories || [];

// After: Memoized calculations
const categories = useMemo(() => {
  return form.values.type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
}, [form.values.type]);

const selectedCategory = useMemo(() => {
  return categories.find(cat => cat.name === form.values.category);
}, [categories, form.values.category]);

const subcategories = useMemo(() => {
  return selectedCategory?.subcategories || [];
}, [selectedCategory]);
```

##### 2. Enhanced Error Handling & User Notifications
```typescript
// Success notification
notifications.show({
  title: '成功',
  message: editingTransaction ? '取引を更新しました' : '取引を追加しました',
  color: 'green',
});

// Error notification with user-friendly messages
notifications.show({
  title: 'エラー',
  message: '取引の保存に失敗しました。もう一度お試しください。',
  color: 'red',
});
```

##### 3. Form Validation Enhancement
```typescript
// Input validation with immediate feedback
if (!values.amount || values.amount <= 0) {
  notifications.show({
    title: '入力エラー',
    message: '正しい金額を入力してください',
    color: 'red',
  });
  return;
}
```

##### 4. Mobile-First Responsive Design

**TransactionForm Mobile Optimization**:
```typescript
const isMobile = useMediaQuery('(max-width: 768px)');

<Modal
  size={isMobile ? 'full' : 'lg'}
  fullScreen={isMobile}
  radius={isMobile ? 0 : undefined}
>
```

**TransactionList Responsive Layout**:
- **Mobile**: Card-based layout for better touch interaction
- **Desktop**: Traditional table layout for data density
- **Automatic switching**: Based on screen size detection

**DashboardContent Mobile Optimization**:
- Compact month navigation controls
- Optimized button sizes and spacing
- 2x2 grid layout for summary cards on mobile

#### Technical Implementation Details

**Files Modified**:
- `/src/components/forms/TransactionForm.tsx`: Performance optimization + mobile UI
- `/src/components/ui/TransactionList.tsx`: Responsive table/card layout
- `/src/components/ui/DashboardContent.tsx`: Mobile-optimized controls

**Quality Assurance**:
- ✅ TypeScript: Zero type errors
- ✅ ESLint: Zero warnings or errors  
- ✅ Build: Successful production build
- ✅ Testing: Manual verification on mobile and desktop

#### Version Management Strategy
**Safe Deployment Process**:
- **Stable Version**: Tagged as `v1.0.0` for rollback safety
- **Development Branch**: `feature/mobile-optimization`
- **Version Control**: Detailed commit history with rollback capability
- **Documentation**: Comprehensive change tracking

**Git Workflow**:
```bash
# Safety: Tagged stable version
git tag -a v1.0.0 -m "Production stable version"

# Development: Feature branch approach
git checkout -b feature/mobile-optimization

# Release: Version 1.1.0 preparation
git tag -a v1.1.0 -m "Mobile optimization and performance improvement"
```

#### Impact Assessment

**Performance Improvements**:
- Eliminated subcategory selection freeze on mobile devices
- Reduced unnecessary re-renders through memoization
- Enhanced error handling with user-friendly notifications

**Mobile Experience Enhancement**:
- Full-screen modal interface on smartphones
- Touch-optimized controls and spacing
- Responsive layout adaptation for all screen sizes

**Code Quality**:
- Type-safe implementation with zero TypeScript errors
- ESLint compliance with zero warnings
- Improved maintainability through better error handling

**User Experience**:
- Seamless mobile transaction entry
- Clear feedback through notifications
- Consistent experience across devices

#### Rollback Strategy
**Emergency Procedures**:
```bash
# Immediate rollback to stable version
git checkout v1.0.0

# File-specific rollback if needed
git checkout v1.0.0 -- src/components/forms/TransactionForm.tsx
```

**Monitoring Points**:
- Mobile user engagement metrics
- Error rates in transaction entry
- Performance metrics for subcategory selection

This update successfully resolves the critical mobile freeze issue while establishing a robust foundation for future mobile-first development.

### 2025-07-05 Update: v1.3.0 UI/UX大幅改善 - カラーテーマ・アニメーション・前月比表示

#### 概要
家計簿アプリの見た目と使いやすさを大幅に改善。カラーテーマの統一、滑らかなアニメーション、前月比の視覚的表現を実装し、ユーザー体験を向上させました。

#### 実装内容

##### 1. カラーテーマの強化 (`/src/utils/calculations.ts`)
**統一されたカラーパレット実装**:
```typescript
const CATEGORY_COLORS = {
  // 収入カテゴリ
  '給与': '#10B981',      // エメラルドグリーン
  'ボーナス': '#059669',  // ダークエメラルド
  'その他': '#047857',    // より深いエメラルド
  
  // 支出カテゴリ
  '食費': '#EF4444',      // レッド
  '飲み会費': '#DC2626',  // ダークレッド
  '電気代': '#F59E0B',    // アンバー
  'ガス代': '#D97706',    // ダークアンバー
  '交通費': '#3B82F6',    // ブルー
  '趣味代': '#8B5CF6',    // バイオレット
  '旅行代': '#EC4899',    // ピンク
  '医療費': '#06B6D4',    // シアン
  '家賃': '#F97316',      // オレンジ
  '投資': '#84CC16',      // ライム
  
  // カード支払い（統一）
  'カード各社': '#6B7280'  // グレー系統
} as const;
```

**新機能**:
- `getCategoryColor()`: カテゴリ名から適切な色を取得
- `ChartData`型にcolor属性追加で型安全性確保

##### 2. 円グラフアニメーション (`/src/components/charts/PieChart.tsx`)
**framer-motion導入による高品質アニメーション**:
```typescript
// コンテナアニメーション
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
>

// グラフアニメーション
<motion.div
  initial={{ scale: 0 }}
  animate={{ scale: 1 }}
  transition={{ 
    duration: 0.8,
    delay: 0.2,
    type: "spring",
    stiffness: 100
  }}
>

// 凡例順次表示
{data.map((item, index) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ 
      duration: 0.4,
      delay: 0.5 + index * 0.1
    }}
  >
))}
```

**アニメーション効果**:
- ページロード時のフェードイン
- グラフのスプリングスケールアニメーション
- 凡例の段階的表示（左から右へ）

##### 3. 前月比増減の視覚的表現 (`/src/components/ui/DashboardContent.tsx`)
**新機能: 前月比計算ロジック** (`/src/utils/calculations.ts`):
```typescript
export const calculateMonthlyComparison = (
  currentData: MonthlyData,
  previousData: MonthlyData | undefined
): {
  income: { value: number; percentage: number; trend: 'up' | 'down' | 'same' };
  expense: { value: number; percentage: number; trend: 'up' | 'down' | 'same' };
  balance: { value: number; percentage: number; trend: 'up' | 'down' | 'same' };
}
```

**TrendIndicatorコンポーネント**:
```typescript
const TrendIndicator = ({ trend, percentage }) => {
  // 増加: 🟢 緑の上向き矢印（ポジティブ変化）
  // 減少: 🔴 赤の下向き矢印（注意要変化）
  // 横ばい: ⚪ グレーの水平線（変化なし）
};
```

**適用対象**:
- 収入の前月比
- 支出の前月比
- 実残高の前月比

##### 4. スマートフォンUI改善
**フローティングアクションボタン重複問題解決**:
```typescript
// モーダル表示時の制御
style={{ 
  zIndex: transactionFormOpened ? 1 : 1000,
  opacity: transactionFormOpened ? 0.3 : 1,
  pointerEvents: transactionFormOpened ? 'none' : 'auto'
}}
```

**改善効果**:
- モーダル表示時のボタン競合回避
- 適切なレイヤー管理
- ユーザー混乱の防止

#### 技術仕様

**新依存関係**:
- **framer-motion**: `11.15.0` - 軽量で高性能なアニメーションライブラリ（+3 packages）

**型定義拡張**:
```typescript
export interface ChartData {
  name: string;
  value: number;
  percentage: number;
  color?: string;  // 新規追加
}
```

**ファイル変更統計**:
- 7ファイル変更
- 355行追加
- 66行削除

#### コード品質保証

**検証結果**:
- ✅ TypeScript: 型エラー 0件
- ✅ ESLint: 警告 0件
- ✅ Build: 正常完了（28.0秒）
- ✅ Bundle Size: 最適化済み（507kB First Load JS）

**テスト完了項目**:
- [x] モバイル端末での動作確認
- [x] デスクトップブラウザでの動作確認
- [x] アニメーション性能確認
- [x] 前月比計算の正確性確認
- [x] レスポンシブデザイン確認

#### パフォーマンス最適化

**アニメーション最適化**:
- GPU加速によるスムーズな描画
- 適切なアニメーション遅延設定
- メモリ効率的な実装

**レンダリング最適化**:
- useMemoによる不要な再計算防止
- 条件付きレンダリングでリソース節約

#### ユーザー体験の向上

**Before（改善前）**:
- 単調な色使いで情報の区別が困難
- 静的な表示で視覚的魅力に欠ける
- 前月との比較情報が不明
- スマホでのボタン重複による操作混乱

**After（改善後）**:
- 🌈 美しく統一されたカラーテーマ
- ✨ 滑らかで心地よいアニメーション
- 📊 前月比が一目で分かる視覚的表現
- 📱 快適で直感的なモバイル操作

#### バージョン管理

**Git管理**:
- **ブランチ**: `feature/ui-improvements` → `testbranch`
- **安定版タグ**: `v1.2.0`（改善前のロールバック用）
- **新バージョン**: `v1.3.0`（今回の改善版）

**デプロイメント**:
- testbranchにプッシュ完了
- プルリクエスト準備完了
- 本番環境へのマージ待機

#### Future Improvements準備

**次回実装候補**:
- ダークモード対応
- スワイプジェスチャー
- 音声入力機能
- より詳細なアニメーション設定

**技術基盤**:
- framer-motionによる拡張可能なアニメーション基盤
- 型安全なカラーシステム
- モジュール化されたUI コンポーネント

この更新により、家計簿アプリは視覚的に美しく、使いやすく、情報豊富なアプリケーションに生まれ変わりました。

### 2025-07-05 Update: v1.4.0 総合改善アップデート - カレンダー・取引修正・UI/UX向上

#### 概要
家計簿アプリの使い勝手を大幅に向上させる包括的なアップデート。モバイル体験の改善、データ整合性の確保、視覚的な改善を実施。

#### 実装内容

##### 1. スマートフォンカレンダー操作性の大幅改善

**問題**: スマートフォンでの日付選択時の操作性不良
- 縦画面での数字見切れ
- 横画面表示時のバグ
- タップ領域の不適切なサイズ

**解決策**:
```typescript
// フルスクリーンモバイルカレンダーの実装
export const MobileCalendar: React.FC<MobileCalendarProps> = ({
  opened, onClose, value, onChange
}) => {
  const isLandscape = useMediaQuery('(orientation: landscape)');
  const isSmallScreen = useMediaQuery('(max-width: 480px)');
  
  // レスポンシブレイアウト対応
  return (
    <Modal opened={opened} onClose={onClose} fullScreen>
      {isLandscape ? (
        // 横画面: サイドバー + カレンダー
        <HorizontalLayout />
      ) : (
        // 縦画面: 縦積みレイアウト
        <VerticalLayout />
      )}
    </Modal>
  );
}
```

**実装機能**:
- **フルスクリーンカレンダー**: 画面全体を使用した見やすい表示
- **大きなタップ領域**: 48px以上のタッチフレンドリーなセル
- **クイック選択**: 「今日」「昨日」「一昨日」ボタン
- **年月ナビゲーション**: 素早い年・月移動
- **レスポンシブ対応**: 縦画面・横画面で最適化されたレイアウト
- **視覚的改善**: 今日・選択日のハイライト、週末の色分け

##### 2. 取引履歴修正機能の根本的な修正

**問題**: 取引編集時にデータが正しく反映されない致命的なバグ

**根本原因**:
```typescript
// 問題のあった updateTransaction 関数
const updateTransaction = async (id: string, updates: Partial<Transaction>) => {
  const updateData = { ...updates }; // undefined フィールドがそのまま送信
  await updateDoc(docRef, updateData); // Firestore エラーの原因
};
```

**解決策**:
```typescript
// 共通データクリーニング関数の実装
const cleanTransactionData = (transaction: Partial<Transaction>): CleanTransactionData => {
  const cleaned: CleanTransactionData = {};
  
  // undefined除外 + 型安全な処理
  if (transaction.type !== undefined) cleaned.type = transaction.type;
  if (transaction.amount !== undefined) cleaned.amount = transaction.amount;
  // ... 他のフィールドも同様に処理
  
  // 空文字列フィルタリング
  if (transaction.subcategory && transaction.subcategory.trim()) {
    cleaned.subcategory = transaction.subcategory.trim();
  }
  
  return cleaned;
};

// 修正された updateTransaction 関数
const updateTransaction = async (id: string, updates: Partial<Transaction>) => {
  const cleanedData = cleanTransactionData(updates);
  const updateData = {
    ...cleanedData,
    updatedAt: Timestamp.fromDate(new Date()),
  };
  
  await updateDoc(docRef, updateData);
};
```

**改善効果**:
- **データ整合性**: undefined値によるFirestoreエラーを完全に排除
- **型安全性**: TypeScript型定義による厳密なデータ検証
- **一貫性**: addTransaction と updateTransaction で同じデータ処理ロジック
- **エラーハンドリング**: 包括的なエラー捕捉と適切なログ出力

##### 3. ダッシュボードアイコン・色彩設計の改善

**問題**: アイコンと色の重複により項目の識別が困難

**Before**:
```
収入:     🔼 green  - IconTrendingUp
支出:     🔽 red    - IconTrendingDown  
今月収支: 💰 blue   - IconWallet
実残高:   💰 blue   - IconWallet        ← 重複
カード:   🔼 orange - IconTrendingUp     ← 重複
```

**After**:
```
収入:     🔼 green  - IconTrendingUp
支出:     🔽 red    - IconTrendingDown
今月収支: 💰 blue   - IconWallet
実残高:   🏦 teal   - IconBuildingBank  ← 銀行口座を表現
カード:   💳 violet - IconCreditCard    ← クレジットカードを表現
```

**実装**:
```typescript
// 新しいアイコンのインポート
import { 
  IconCreditCard,    // カード支払い用
  IconBuildingBank   // 実残高（銀行口座）用
} from '@tabler/icons-react';

// 色彩の分離
const iconColors = {
  income: 'green',      // 成長・プラス
  expense: 'red',       // 注意・マイナス
  balance: 'blue',      // 情報・中立
  realBalance: 'teal',  // 安定・資産
  cardPayment: 'violet' // 特別・クレジット
};
```

##### 4. 円グラフ表示の最適化

**改善**: タップ時の情報表示を使いやすく調整

**最終仕様**:
- **円グラフ上**: 割合（%）表示でバランス把握
- **下部サマリー**: 割合（%）+ カテゴリ名 + 金額で詳細情報
- **ツールチップ**: タップ時に % 表示
- **バッジ**: カテゴリカラーで塗りつぶし、円グラフとの対応明確

```typescript
// 理想的な表示形式
円グラフ: [タップ] → "15%" 
サマリー: "🟢 15% 食費  ¥15,000"
```

#### 技術的改善

##### モバイルファーストの設計哲学
```typescript
// レスポンシブ対応の例
const isMobile = useMediaQuery('(max-width: 768px)');
const isLandscape = useMediaQuery('(orientation: landscape)');

// 条件分岐でのレイアウト最適化
{isMobile ? (
  <MobileOptimizedComponent />
) : (
  <DesktopComponent />
)}
```

##### 型安全性の徹底
```typescript
// 明確な型定義
interface CleanTransactionData {
  type?: 'income' | 'expense';
  amount?: number;
  // ... 他のフィールド
}

// 型ガードによる安全性確保
if (!data.type || !data.amount || !data.category) {
  console.warn('Incomplete transaction data:', doc.id);
  return;
}
```

##### パフォーマンス最適化
```typescript
// useMemo による計算の最適化
const chartData = useMemo(() => 
  data?.map(item => ({
    name: item.name,
    value: item.value,
    percentage: item.percentage,
    color: item.color
  })) || [],
  [data, color]
);
```

#### 品質保証とテスト

**自動化テスト**:
- ✅ TypeScript: 型エラー 0件
- ✅ ESLint: 警告 0件
- ✅ Build: 正常完了
- ✅ Performance: Bundle size 最適化

**手動テスト**:
- ✅ モバイル操作性: iPhone/Android テスト完了
- ✅ 取引編集機能: データ反映確認
- ✅ レスポンシブ: 縦画面・横画面動作確認
- ✅ アクセシビリティ: タップ領域・色コントラスト確認

#### ユーザー体験の向上

**操作性の改善**:
- 📱 **モバイル**: フルスクリーンカレンダーで快適な日付選択
- ⚡ **効率性**: クイック選択で1タップ日付選択
- 🎯 **精度**: 大きなタップ領域で誤操作防止

**情報の見やすさ**:
- 🎨 **視認性**: 5色分離で項目識別が瞬時
- 📊 **情報量**: 円グラフで%と金額の両方提供
- 🏦 **直感性**: アイコンで機能が一目瞭然

**データの信頼性**:
- 💾 **確実な保存**: 取引編集が確実に反映
- 🔄 **リアルタイム**: Firestore連携で即座に更新
- 🛡️ **データ整合性**: undefined値エラーの完全排除

#### 開発効率とメンテナンス性

**コード品質**:
- 🧹 **DRY原則**: 共通ヘルパー関数で重複排除
- 🏗️ **モジュール化**: コンポーネントの責務分離
- 📝 **型安全性**: TypeScript活用で実行時エラー防止

**保守性**:
- 📚 **ドキュメント**: 包括的な技術文書整備
- 🔍 **デバッグ**: 詳細なエラーログ出力
- 🎛️ **設定管理**: 環境別設定の適切な管理

#### バージョン管理

**Git管理**:
- **ブランチ**: `testbranch` での開発・テスト
- **タグ付け**: `v1.4.0` 安定版
- **コミット**: 機能別の詳細なコミット履歴

**デプロイ戦略**:
- 段階的リリース: テスト → ステージング → 本番
- ロールバック準備: 前バージョンタグでの即座復旧可能

この v1.4.0 アップデートにより、家計簿アプリは実用性・信頼性・使いやすさの全ての面で大幅に向上し、日常的に使いたくなる完成度の高いアプリケーションに進化しました。

## Development Notes

### Type Safety
- Strict TypeScript configuration
- Comprehensive interfaces for all data structures
- Firebase Timestamp handling with type safety

### Error Handling
- Form validation with Mantine
- Firebase error handling in data operations
- User-friendly notifications for errors

### Performance Considerations
- Real-time Firestore subscriptions
- Memoized calculations with useMemo (enhanced in v1.1.0)
- Component-level state management to minimize re-renders
- Mobile-optimized rendering with conditional layouts

### Code Quality
- ESLint configuration with Next.js rules
- Consistent code formatting
- Clear separation of concerns between UI and business logic
- Zero TypeScript errors and ESLint warnings (maintained since v1.1.0)

## Development Guidelines & Best Practices

### Mobile-First Development
- **Always test on mobile devices first**: Primary user base is mobile
- **Use useMediaQuery for responsive design**: Consistent breakpoint management
- **Implement touch-friendly interfaces**: Minimum 44px touch targets
- **Consider performance on mobile devices**: Limited processing power and memory

### Performance Optimization
- **Use useMemo for expensive calculations**: Especially in form components
- **Implement proper error boundaries**: Graceful error handling
- **Optimize bundle size**: Regular analysis and tree-shaking
- **Monitor rendering performance**: React DevTools profiling

### Code Quality Standards
- **TypeScript strict mode**: Zero tolerance for type errors
- **ESLint compliance**: Zero warnings in production builds
- **Consistent import order**: External libraries → Internal modules → Relative imports
- **Comprehensive error handling**: User-friendly notifications with technical logging

### Version Control Best Practices
- **Feature branch strategy**: Always develop in feature branches
- **Semantic versioning**: Clear version numbering for releases
- **Comprehensive commit messages**: Include problem description and solution
- **Tag stable versions**: Enable easy rollback when needed

### Testing Strategy
- **Manual testing required**: Both mobile and desktop environments
- **Type checking**: `npm run type-check` before commits
- **Linting verification**: `npm run lint` as part of workflow
- **Build verification**: `npm run build` before deployment

### Documentation Requirements
- **Update CLAUDE.md**: Record all significant changes
- **Technical documentation**: Detailed implementation notes
- **User-facing changes**: Update USER_GUIDE.md when applicable
- **Version records**: Maintain DEVELOPMENT_RECORD files for major releases

### Emergency Procedures
- **Rollback strategy**: Always have tagged stable versions
- **Hotfix process**: Use hotfix branches for critical fixes
- **Monitoring**: Watch for errors and performance degradation
- **Communication**: Document all emergency actions taken