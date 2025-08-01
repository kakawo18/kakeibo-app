# カレンダー機能強化 - 設計文書

## 概要

既存の`MobileCalendar.tsx`コンポーネントを拡張し、新しい機能を追加することで、より包括的なカレンダー体験を提供します。既存のアーキテクチャを活用しながら、段階的に機能を追加していく設計とします。

## アーキテクチャ

### 既存コンポーネントの拡張

```
src/components/ui/
├── MobileCalendar.tsx (拡張)
├── CalendarWeekView.tsx (新規)
├── CalendarContextMenu.tsx (新規)
├── CalendarSettings.tsx (新規)
├── PeriodSelector.tsx (新規)
└── BudgetProgressBar.tsx (新規)
```

### 状態管理の拡張

```typescript
// 既存の状態に追加
interface CalendarState {
  // 既存
  currentDate: Date;
  selectedDate: Date;
  showDayTransactions: boolean;
  
  // 新規追加
  viewMode: 'month' | 'week';
  displayOptions: CalendarDisplayOptions;
  selectedPeriod: DateRange | null;
  contextMenu: ContextMenuState | null;
  budgetProgress: BudgetProgressData | null;
}

interface CalendarDisplayOptions {
  showBalance: boolean;
  showCategoryBreakdown: boolean;
  showTransactionCount: boolean;
  colorScheme: 'default' | 'high-contrast';
}
```

## コンポーネント設計

### 1. MobileCalendar.tsx の拡張

#### 新しいProps
```typescript
interface MobileCalendarProps {
  // 既存のprops...
  
  // 新規追加
  viewMode?: 'month' | 'week';
  displayOptions?: CalendarDisplayOptions;
  budgetData?: BudgetData;
  onPeriodSelect?: (period: DateRange) => void;
  onQuickAddTransaction?: (date: Date) => void;
}
```

#### 主要な変更点
- ビューモード切り替えボタンの追加
- 長押し/右クリックイベントハンドラーの実装
- 期間選択機能の統合
- アクセシビリティ属性の追加

### 2. CalendarWeekView.tsx (新規コンポーネント)

```typescript
interface CalendarWeekViewProps {
  currentWeek: Date;
  transactions: Transaction[];
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  onDateLongPress: (date: Date) => void;
  displayOptions: CalendarDisplayOptions;
}

export const CalendarWeekView: React.FC<CalendarWeekViewProps> = ({
  currentWeek,
  transactions,
  selectedDate,
  onDateSelect,
  onDateLongPress,
  displayOptions
}) => {
  // 週の7日間を生成
  const weekDays = generateWeekDays(currentWeek);
  
  return (
    <Box>
      {/* 週ナビゲーション */}
      <Group justify="space-between" mb="md">
        <ActionIcon onClick={() => navigateWeek('prev')}>
          <IconChevronLeft />
        </ActionIcon>
        <Text fw={600}>{formatWeekRange(currentWeek)}</Text>
        <ActionIcon onClick={() => navigateWeek('next')}>
          <IconChevronRight />
        </ActionIcon>
      </Group>
      
      {/* 週間グリッド */}
      <SimpleGrid cols={7} spacing="xs">
        {weekDays.map(date => (
          <WeekDayCell
            key={date.toISOString()}
            date={date}
            transactions={getTransactionsForDate(date)}
            isSelected={isSameDay(date, selectedDate)}
            onClick={() => onDateSelect(date)}
            onLongPress={() => onDateLongPress(date)}
            displayOptions={displayOptions}
          />
        ))}
      </SimpleGrid>
    </Box>
  );
};
```

### 3. CalendarContextMenu.tsx (新規コンポーネント)

```typescript
interface ContextMenuProps {
  position: { x: number; y: number };
  date: Date;
  hasTransactions: boolean;
  onClose: () => void;
  onAddTransaction: (date: Date) => void;
  onAddFromTemplate: (date: Date) => void;
  onViewTransactions: (date: Date) => void;
}

export const CalendarContextMenu: React.FC<ContextMenuProps> = ({
  position,
  date,
  hasTransactions,
  onClose,
  onAddTransaction,
  onAddFromTemplate,
  onViewTransactions
}) => {
  return (
    <Menu
      opened={true}
      onClose={onClose}
      position="bottom-start"
      offset={{ mainAxis: 0, crossAxis: 0 }}
      styles={{
        dropdown: {
          position: 'fixed',
          left: position.x,
          top: position.y,
        }
      }}
    >
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconPlus size={16} />}
          onClick={() => onAddTransaction(date)}
        >
          取引を追加
        </Menu.Item>
        <Menu.Item
          leftSection={<IconTemplate size={16} />}
          onClick={() => onAddFromTemplate(date)}
        >
          テンプレートから追加
        </Menu.Item>
        {hasTransactions && (
          <Menu.Item
            leftSection={<IconEye size={16} />}
            onClick={() => onViewTransactions(date)}
          >
            取引を表示
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  );
};
```

### 4. CalendarSettings.tsx (新規コンポーネント)

```typescript
interface CalendarSettingsProps {
  opened: boolean;
  onClose: () => void;
  displayOptions: CalendarDisplayOptions;
  onOptionsChange: (options: CalendarDisplayOptions) => void;
}

export const CalendarSettings: React.FC<CalendarSettingsProps> = ({
  opened,
  onClose,
  displayOptions,
  onOptionsChange
}) => {
  return (
    <Modal opened={opened} onClose={onClose} title="カレンダー表示設定">
      <Stack>
        <Checkbox
          label="収支バランスを表示"
          checked={displayOptions.showBalance}
          onChange={(event) => 
            onOptionsChange({
              ...displayOptions,
              showBalance: event.currentTarget.checked
            })
          }
        />
        <Checkbox
          label="カテゴリ別内訳を表示"
          checked={displayOptions.showCategoryBreakdown}
          onChange={(event) => 
            onOptionsChange({
              ...displayOptions,
              showCategoryBreakdown: event.currentTarget.checked
            })
          }
        />
        <Checkbox
          label="取引件数を表示"
          checked={displayOptions.showTransactionCount}
          onChange={(event) => 
            onOptionsChange({
              ...displayOptions,
              showTransactionCount: event.currentTarget.checked
            })
          }
        />
        <Select
          label="カラーテーマ"
          data={[
            { value: 'default', label: '標準' },
            { value: 'high-contrast', label: '高コントラスト' }
          ]}
          value={displayOptions.colorScheme}
          onChange={(value) => 
            onOptionsChange({
              ...displayOptions,
              colorScheme: value as 'default' | 'high-contrast'
            })
          }
        />
      </Stack>
    </Modal>
  );
};
```

### 5. PeriodSelector.tsx (新規コンポーネント)

```typescript
interface PeriodSelectorProps {
  onPeriodSelect: (period: DateRange) => void;
  onCancel: () => void;
}

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  onPeriodSelect,
  onCancel
}) => {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const handleDateClick = (date: Date) => {
    if (!isSelecting) {
      setStartDate(date);
      setEndDate(null);
      setIsSelecting(true);
    } else {
      if (startDate && date >= startDate) {
        setEndDate(date);
        onPeriodSelect({ start: startDate, end: date });
      } else {
        setStartDate(date);
        setEndDate(null);
      }
    }
  };

  return (
    <Box>
      <Text size="sm" c="dimmed" mb="md">
        期間の開始日と終了日をタップして選択してください
      </Text>
      {/* カレンダーグリッドを期間選択モードで表示 */}
      <CalendarGrid
        onDateClick={handleDateClick}
        selectedPeriod={{ start: startDate, end: endDate }}
        mode="period-select"
      />
      <Group justify="flex-end" mt="md">
        <Button variant="light" onClick={onCancel}>
          キャンセル
        </Button>
        <Button 
          disabled={!startDate || !endDate}
          onClick={() => startDate && endDate && onPeriodSelect({ start: startDate, end: endDate })}
        >
          選択完了
        </Button>
      </Group>
    </Box>
  );
};
```

### 6. BudgetProgressBar.tsx (新規コンポーネント)

```typescript
interface BudgetProgressBarProps {
  budgetData: BudgetData;
  currentSpending: number;
  month: string;
}

export const BudgetProgressBar: React.FC<BudgetProgressBarProps> = ({
  budgetData,
  currentSpending,
  month
}) => {
  const progressPercentage = (currentSpending / budgetData.monthlyBudget) * 100;
  const progressColor = progressPercentage >= 90 ? 'red' : progressPercentage >= 70 ? 'yellow' : 'green';

  return (
    <Box mb="md">
      <Group justify="space-between" mb="xs">
        <Text size="sm" fw={600}>
          {getMonthName(month)}の予算進捗
        </Text>
        <Text size="sm" c={progressColor}>
          ¥{currentSpending.toLocaleString()} / ¥{budgetData.monthlyBudget.toLocaleString()}
        </Text>
      </Group>
      <Progress
        value={progressPercentage}
        color={progressColor}
        size="lg"
        radius="md"
      />
      {progressPercentage >= 90 && (
        <Alert color="red" mt="xs" size="sm">
          <IconAlertTriangle size={16} />
          予算の90%に達しました。支出にご注意ください。
        </Alert>
      )}
    </Box>
  );
};
```

## データモデル

### 新しい型定義

```typescript
// types/calendar.ts
export interface DateRange {
  start: Date;
  end: Date;
}

export interface CalendarDisplayOptions {
  showBalance: boolean;
  showCategoryBreakdown: boolean;
  showTransactionCount: boolean;
  colorScheme: 'default' | 'high-contrast';
}

export interface ContextMenuState {
  position: { x: number; y: number };
  date: Date;
  visible: boolean;
}

export interface BudgetData {
  monthlyBudget: number;
  categoryBudgets: Record<string, number>;
  alertThresholds: {
    warning: number; // 70%
    danger: number;   // 90%
  };
}

export interface BudgetProgressData {
  totalSpent: number;
  categorySpent: Record<string, number>;
  progressPercentage: number;
  status: 'safe' | 'warning' | 'danger' | 'exceeded';
}
```

## エラーハンドリング

### 1. 期間選択エラー
```typescript
const validatePeriodSelection = (start: Date, end: Date): string | null => {
  if (start > end) {
    return '開始日は終了日より前である必要があります';
  }
  
  const daysDiff = Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff > 365) {
    return '選択期間は1年以内にしてください';
  }
  
  return null;
};
```

### 2. 設定保存エラー
```typescript
const saveCalendarSettings = async (options: CalendarDisplayOptions) => {
  try {
    localStorage.setItem('calendar-display-options', JSON.stringify(options));
  } catch (error) {
    console.error('Failed to save calendar settings:', error);
    notifications.show({
      title: 'エラー',
      message: '設定の保存に失敗しました',
      color: 'red',
    });
  }
};
```

### 3. アクセシビリティエラー
```typescript
const ensureAccessibility = (element: HTMLElement) => {
  // ARIA属性の確認
  if (!element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby')) {
    console.warn('Missing accessibility label:', element);
  }
  
  // キーボードフォーカスの確認
  if (element.tabIndex < 0 && element.onclick) {
    element.tabIndex = 0;
  }
};
```

## テスト戦略

### 1. ユニットテスト
- 各新規コンポーネントの個別機能テスト
- 日付計算ユーティリティのテスト
- 期間選択ロジックのテスト

### 2. 統合テスト
- カレンダーと取引フォームの連携テスト
- 設定変更の永続化テスト
- 予算データとの統合テスト

### 3. アクセシビリティテスト
- スクリーンリーダーでの操作テスト
- キーボードナビゲーションテスト
- 高コントラストモードでの表示テスト

### 4. パフォーマンステスト
- 大量取引データでの表示速度テスト
- 期間選択時のレスポンス性テスト
- メモリ使用量の監視

## 実装の優先順位

1. **Phase 1**: 週表示モードの実装
2. **Phase 2**: コンテキストメニューとクイック追加
3. **Phase 3**: 表示カスタマイズ機能
4. **Phase 4**: 期間選択と一括操作
5. **Phase 5**: アクセシビリティ向上
6. **Phase 6**: 予算管理統合

各フェーズは独立して実装・テスト・デプロイが可能な設計とします。