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