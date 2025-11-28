'use client';

import { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Group,
  Stack,
  ActionIcon,
  Select,
  Text,
  Box,
  SimpleGrid,
  Badge,
  Card,
  Divider,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { motion } from 'framer-motion';

interface MobileCalendarProps {
  opened: boolean;
  onClose: () => void;
  value: Date;
  onChange: (date: Date) => void;
  mode?: 'select' | 'view'; // 新しいモードプロパティ
  transactions?: Array<{
    id: string;
    date: Date;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    subcategory?: string;
    description?: string;
  }>;
}

export const MobileCalendar: React.FC<MobileCalendarProps> = ({
  opened,
  onClose,
  value,
  onChange,
  mode = 'view', // デフォルトは閲覧モード
  transactions = [],
}) => {
  const [currentDate, setCurrentDate] = useState(value);
  const [selectedDate, setSelectedDate] = useState(value);
  const [showDayTransactions, setShowDayTransactions] = useState(false);
  const [dayTransactionsDate, setDayTransactionsDate] = useState<Date | null>(null);

  // レスポンシブ対応
  const isLandscape = useMediaQuery('(orientation: landscape)');
  const isSmallScreen = useMediaQuery('(max-width: 480px)');
  const isMobile = useMediaQuery('(max-width: 768px)');

  // propsが変更された時にselectedDateを更新
  useEffect(() => {
    setSelectedDate(value);
    setCurrentDate(value);
  }, [value]);

  const handleDateSelect = (date: Date) => {
    try {
      // 日付の妥当性チェック
      if (!date || isNaN(date.getTime())) {
        console.error('Invalid date selected:', date);
        return;
      }
      
      setSelectedDate(date);
      onChange(date);
      onClose();
    } catch (error) {
      console.error('Error in handleDateSelect:', error);
    }
  };



  const handleShowDayTransactions = (date: Date) => {
    if (mode === 'select') {
      // 選択モード: 常に日付選択（取引があっても詳細表示しない）
      handleDateSelect(date);
      return;
    }
    
    // 閲覧モード: 取引がある場合は詳細表示、ない場合は日付選択
    // ローカルタイムゾーンでの日付比較
    const dayTransactions = transactions.filter(t => 
      t.date.getFullYear() === date.getFullYear() &&
      t.date.getMonth() === date.getMonth() &&
      t.date.getDate() === date.getDate()
    );
    
    if (dayTransactions.length > 0) {
      setDayTransactionsDate(date);
      setShowDayTransactions(true);
    } else {
      handleDateSelect(date);
    }
  };

  const handleQuickSelect = (daysBack: number) => {
    const date = new Date();
    date.setDate(date.getDate() - daysBack);
    handleDateSelect(date);
  };

  const handleMonthChange = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const handleYearChange = (year: string | null) => {
    if (year) {
      const newDate = new Date(currentDate);
      newDate.setFullYear(parseInt(year));
      setCurrentDate(newDate);
    }
  };

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 2; i <= currentYear + 1; i++) {
      years.push({ value: i.toString(), label: `${i}年` });
    }
    return years;
  };

  const monthNames = [
    '1月', '2月', '3月', '4月', '5月', '6月',
    '7月', '8月', '9月', '10月', '11月', '12月'
  ];

  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    const endDate = new Date(lastDay);

    // 月の最初の日の曜日まで前月の日付で埋める
    startDate.setDate(firstDay.getDate() - firstDay.getDay());

    // 月の最後の日の後を次月の日付で埋める
    endDate.setDate(lastDay.getDate() + (6 - lastDay.getDay()));

    const days = [];
    const currentDateLoop = new Date(startDate);

    while (currentDateLoop <= endDate) {
      days.push(new Date(currentDateLoop));
      currentDateLoop.setDate(currentDateLoop.getDate() + 1);
    }

    return days;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
           date.getMonth() === today.getMonth() &&
           date.getDate() === today.getDate();
  };

  const isSelected = (date: Date) => {
    return date.getFullYear() === selectedDate.getFullYear() &&
           date.getMonth() === selectedDate.getMonth() &&
           date.getDate() === selectedDate.getDate();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  // 日別の収支を計算（ローカルタイムゾーン対応）
  const getDailyBalance = (date: Date) => {
    const dayTransactions = transactions.filter(t => 
      t.date.getFullYear() === date.getFullYear() &&
      t.date.getMonth() === date.getMonth() &&
      t.date.getDate() === date.getDate()
    );

    const income = dayTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const expense = dayTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return { income, expense, balance: income - expense };
  };

  const calendarDays = generateCalendarDays();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="日付を選択"
      size={isMobile ? "full" : "lg"}
      fullScreen={isMobile}
      radius={isMobile ? 0 : 8}
      styles={{
        body: {
          padding: isMobile ? (isLandscape ? '12px' : '16px') : '20px',
          height: isMobile ? '100%' : 'auto',
          display: 'flex',
          flexDirection: 'column',
          overflow: isMobile ? 'hidden' : 'visible',
        },
        content: {
          height: isMobile ? '100vh' : 'auto',
          width: isMobile ? '100vw' : 'auto',
          display: 'flex',
          flexDirection: 'column',
          overflow: isMobile ? 'hidden' : 'visible',
        },
        header: {
          padding: isMobile ? (isLandscape ? '12px 16px' : '16px') : '20px 20px 0 20px',
          flexShrink: 0,
        },
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: isLandscape ? 'row' : 'column',
          overflow: 'hidden'
        }}
      >
        {isMobile && isLandscape ? (
          // 横画面レイアウト
          <>
            {/* 左側: クイック選択とナビゲーション */}
            <Box style={{
              width: '200px',
              padding: '16px 12px',
              borderRight: '1px solid var(--mantine-color-gray-3)',
              flexShrink: 0
            }}>
              <Stack gap="md">
                {/* クイック選択ボタン */}
                <Stack gap="xs">
                  <Text size="sm" fw={600} c="dimmed">クイック選択</Text>
                  <Button
                    variant="light"
                    size="xs"
                    onClick={() => handleQuickSelect(0)}
                    fullWidth
                  >
                    今日
                  </Button>
                  <Button
                    variant="light"
                    size="xs"
                    onClick={() => handleQuickSelect(1)}
                    fullWidth
                  >
                    昨日
                  </Button>
                  <Button
                    variant="light"
                    size="xs"
                    onClick={() => handleQuickSelect(2)}
                    fullWidth
                  >
                    一昨日
                  </Button>
                </Stack>

                {/* 年月選択 */}
                <Stack gap="xs">
                  <Text size="sm" fw={600} c="dimmed">年月選択</Text>
                  <Select
                    data={generateYearOptions()}
                    value={currentDate.getFullYear().toString()}
                    onChange={handleYearChange}
                    size="xs"
                  />
                  <Group gap="xs">
                    <ActionIcon
                      variant="light"
                      size="sm"
                      onClick={() => handleMonthChange('prev')}
                    >
                      <IconChevronLeft size={16} />
                    </ActionIcon>
                    <Text size="sm" fw={600} style={{ flex: 1, textAlign: 'center' }}>
                      {monthNames[currentDate.getMonth()]}
                    </Text>
                    <ActionIcon
                      variant="light"
                      size="sm"
                      onClick={() => handleMonthChange('next')}
                    >
                      <IconChevronRight size={16} />
                    </ActionIcon>
                  </Group>
                </Stack>
              </Stack>
            </Box>

            {/* 右側: カレンダー */}
            <Box style={{ flex: 1, padding: '16px 12px', overflow: 'hidden' }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
              >
                <Box style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {/* 曜日ヘッダー */}
                  <SimpleGrid cols={7} spacing={4} style={{ marginBottom: '8px', flexShrink: 0 }}>
                    {weekdays.map((day, index) => (
                      <Box
                        key={day}
                        style={{
                          textAlign: 'center',
                          padding: '4px 2px',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: index === 0 || index === 6 ? 'var(--mantine-color-red-6)' : 'var(--mantine-color-gray-6)',
                          minHeight: '20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {day}
                      </Box>
                    ))}
                  </SimpleGrid>

                  {/* カレンダーグリッド */}
                  <SimpleGrid cols={7} spacing={4} style={{ flex: 1 }}>
                    {calendarDays.map((date, index) => {
                      const today = isToday(date);
                      const selected = isSelected(date);
                      const currentMonth = isCurrentMonth(date);
                      const weekend = isWeekend(date);
                      const { income, expense, balance } = getDailyBalance(date);

                      return (
                        <Box
                          key={index}
                          onClick={() => handleShowDayTransactions(date)}
                          style={{
                            aspectRatio: '1',
                            width: '100%',
                            maxWidth: '50px',
                            minHeight: '45px',
                            fontSize: '11px',
                            fontWeight: selected ? 700 : 500,
                            borderRadius: '4px',
                            border: today ? '2px solid var(--mantine-color-blue-5)' : '1px solid transparent',
                            color: !currentMonth
                              ? 'var(--mantine-color-gray-4)'
                              : weekend
                                ? 'var(--mantine-color-red-6)'
                                : selected
                                  ? 'white'
                                  : 'var(--mantine-color-gray-8)',
                            backgroundColor: selected
                              ? 'var(--mantine-color-blue-6)'
                              : today
                                ? 'var(--mantine-color-blue-0)'
                                : 'transparent',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            opacity: currentMonth ? 1 : 0.6,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            userSelect: 'none',
                            margin: '0 auto',
                            padding: '2px',
                          }}
                        >
                          <Text size="xs" fw={selected ? 700 : 600}>
                            {date.getDate()}
                          </Text>
                          {currentMonth && (income > 0 || expense > 0) && (
                            <Text
                              size="8px"
                              c={selected ? 'white' : balance >= 0 ? 'green' : 'red'}
                              fw={500}
                              style={{
                                lineHeight: 1,
                                marginTop: '1px',
                                opacity: 0.8
                              }}
                            >
                              {balance >= 0 ? '+' : ''}¥{Math.abs(balance) >= 10000
                                ? `${Math.floor(Math.abs(balance) / 1000)}k`
                                : Math.abs(balance).toLocaleString()}
                            </Text>
                          )}
                        </Box>
                      );
                    })}
                  </SimpleGrid>
                </Box>
              </motion.div>
            </Box>
          </>
        ) : (
          // 縦画面レイアウト（元のデザイン）
          <Stack style={{ flex: 1, overflow: 'hidden' }}>
            {/* クイック選択ボタン */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              style={{ flexShrink: 0 }}
            >
              <Group gap="xs" style={{ marginBottom: isSmallScreen ? '12px' : '16px' }}>
                <Button
                  variant="light"
                  size={isSmallScreen ? "xs" : "sm"}
                  onClick={() => handleQuickSelect(0)}
                  style={{ flex: 1 }}
                >
                  今日
                </Button>
                <Button
                  variant="light"
                  size={isSmallScreen ? "xs" : "sm"}
                  onClick={() => handleQuickSelect(1)}
                  style={{ flex: 1 }}
                >
                  昨日
                </Button>
                <Button
                  variant="light"
                  size={isSmallScreen ? "xs" : "sm"}
                  onClick={() => handleQuickSelect(2)}
                  style={{ flex: 1 }}
                >
                  一昨日
                </Button>
              </Group>
            </motion.div>

            {/* 年月選択 - スワイプ対応 */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              style={{ flexShrink: 0 }}
            >
              <Group justify="space-between" style={{ marginBottom: isSmallScreen ? '12px' : '16px' }}>
                <ActionIcon
                  variant="light"
                  size="xl"
                  onClick={() => handleMonthChange('prev')}
                  style={{ 
                    minWidth: '48px', 
                    minHeight: '48px',
                    touchAction: 'manipulation',
                  }}
                >
                  <IconChevronLeft size={24} />
                </ActionIcon>

                <motion.div
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  dragMomentum={false}
                  onDragEnd={(e, info) => {
                    // 50px以上スワイプしたら月を変更
                    if (info.offset.x > 50) {
                      handleMonthChange('prev');
                    } else if (info.offset.x < -50) {
                      handleMonthChange('next');
                    }
                  }}
                  style={{
                    cursor: 'grab',
                    touchAction: 'none',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none',
                  }}
                  whileTap={{ cursor: 'grabbing', scale: 0.98 }}
                >
                  <Group gap="sm" style={{ 
                    padding: '8px 16px',
                    pointerEvents: 'none',
                  }}>
                    <Box style={{ pointerEvents: 'auto' }}>
                      <Select
                        data={generateYearOptions()}
                        value={currentDate.getFullYear().toString()}
                        onChange={handleYearChange}
                        size={isSmallScreen ? "sm" : "md"}
                        style={{ width: isSmallScreen ? '80px' : '90px' }}
                        styles={{
                          input: {
                            fontSize: '16px',
                            fontWeight: 600,
                          }
                        }}
                      />
                    </Box>
                    <Text size={isSmallScreen ? "lg" : "xl"} fw={700}>
                      {monthNames[currentDate.getMonth()]}
                    </Text>
                  </Group>
                  <Text 
                    size="xs" 
                    c="dimmed" 
                    ta="center"
                    style={{ 
                      marginTop: '-4px',
                      fontSize: '10px',
                      opacity: 0.6,
                    }}
                  >
                    ← スワイプで移動 →
                  </Text>
                </motion.div>

                <ActionIcon
                  variant="light"
                  size="xl"
                  onClick={() => handleMonthChange('next')}
                  style={{ 
                    minWidth: '48px', 
                    minHeight: '48px',
                    touchAction: 'manipulation',
                  }}
                >
                  <IconChevronRight size={24} />
                </ActionIcon>
              </Group>
            </motion.div>

            {/* カスタムカレンダー */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minHeight: '0',
                overflow: 'hidden'
              }}
            >
              <Box style={{ padding: '4px 0', width: '100%' }}>
                {/* 曜日ヘッダー */}
                <SimpleGrid cols={7} spacing={2} style={{ marginBottom: '4px', width: '100%' }}>
                  {weekdays.map((day, index) => (
                    <Box
                      key={day}
                      style={{
                        textAlign: 'center',
                        padding: '4px 2px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: index === 0 || index === 6 ? 'var(--mantine-color-red-6)' : 'var(--mantine-color-gray-6)',
                        minHeight: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {day}
                    </Box>
                  ))}
                </SimpleGrid>

                {/* カレンダーグリッド */}
                <SimpleGrid cols={7} spacing={2} style={{ width: '100%' }}>
                  {calendarDays.map((date, index) => {
                    const today = isToday(date);
                    const selected = isSelected(date);
                    const currentMonth = isCurrentMonth(date);
                    const weekend = isWeekend(date);
                    const { income, expense, balance } = getDailyBalance(date);

                    return (
                      <Box
                        key={index}
                        onClick={() => handleShowDayTransactions(date)}
                        style={{
                          aspectRatio: '1',
                          width: '100%',
                          maxWidth: '44px',
                          minHeight: '48px',
                          fontSize: '12px',
                          fontWeight: selected ? 700 : 500,
                          borderRadius: '6px',
                          border: today ? '2px solid var(--mantine-color-blue-5)' : '1px solid transparent',
                          color: !currentMonth
                            ? 'var(--mantine-color-gray-4)'
                            : weekend
                              ? 'var(--mantine-color-red-6)'
                              : selected
                                ? 'white'
                                : 'var(--mantine-color-gray-8)',
                          backgroundColor: selected
                            ? 'var(--mantine-color-blue-6)'
                            : today
                              ? 'var(--mantine-color-blue-0)'
                              : 'transparent',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease, transform 0.1s ease',
                          opacity: currentMonth ? 1 : 0.6,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center',
                          userSelect: 'none',
                          WebkitUserSelect: 'none',
                          WebkitTapHighlightColor: 'transparent',
                          margin: '0 auto',
                          padding: '2px',
                          touchAction: 'manipulation',
                        }}
                      >
                        <Text size="sm" fw={selected ? 700 : 600}>
                          {date.getDate()}
                        </Text>
                        {currentMonth && (income > 0 || expense > 0) && (
                          <Text
                            size="9px"
                            c={selected ? 'white' : balance >= 0 ? 'green' : 'red'}
                            fw={500}
                            style={{
                              lineHeight: 1,
                              marginTop: '1px',
                              opacity: 0.8
                            }}
                          >
                            {balance >= 0 ? '+' : ''}¥{Math.abs(balance) >= 10000
                              ? `${Math.floor(Math.abs(balance) / 1000)}k`
                              : Math.abs(balance).toLocaleString()}
                          </Text>
                        )}
                      </Box>
                    );
                  })}
                </SimpleGrid>
              </Box>
            </motion.div>

            {/* 選択した日付の表示 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
              style={{ flexShrink: 0 }}
            >
              <Box
                style={{
                  backgroundColor: 'var(--mantine-color-dark-3)',
                  padding: isSmallScreen ? '8px' : '12px',
                  borderRadius: '8px',
                  marginTop: isSmallScreen ? '8px' : '16px',
                }}
              >
                <Text size="xs" c="dimmed">選択した日付</Text>
                <Text size={isSmallScreen ? "md" : "lg"} fw={600} c="blue">
                  {selectedDate.toLocaleDateString('ja-JP', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long',
                  })}
                </Text>
              </Box>
            </motion.div>
          </Stack>
        )}
      </motion.div>

      {/* 日別取引詳細表示モーダル */}
      <Modal
        opened={showDayTransactions}
        onClose={() => setShowDayTransactions(false)}
        title={dayTransactionsDate ? `${dayTransactionsDate.toLocaleDateString('ja-JP', {
          month: 'long',
          day: 'numeric',
          weekday: 'short',
        })}の取引履歴` : '取引履歴'}
        size="md"
        centered
      >
        {dayTransactionsDate && (
          <Stack gap="sm">
            {transactions
              .filter(t => 
                dayTransactionsDate &&
                t.date.getFullYear() === dayTransactionsDate.getFullYear() &&
                t.date.getMonth() === dayTransactionsDate.getMonth() &&
                t.date.getDate() === dayTransactionsDate.getDate()
              )
              .map((transaction) => (
                <Card key={transaction.id} withBorder p="sm">
                  <Group justify="space-between" align="flex-start">
                    <Box>
                      <Group gap="xs" mb="xs">
                        <Badge
                          color={transaction.type === 'income' ? 'green' : 'red'}
                          size="sm"
                        >
                          {transaction.type === 'income' ? '収入' : '支出'}
                        </Badge>
                      </Group>
                      <Text fw={600} size="sm" mb={2}>
                        {transaction.category}
                      </Text>
                      {transaction.subcategory && (
                        <Text size="xs" c="dimmed" mb={2}>
                          📂 {transaction.subcategory}
                        </Text>
                      )}
                      {transaction.description && (
                        <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }}>
                          💭 {transaction.description}
                        </Text>
                      )}
                    </Box>
                    <Text
                      c={transaction.type === 'income' ? 'green' : 'red'}
                      fw={700}
                      size="lg"
                    >
                      {transaction.type === 'income' ? '+' : '-'}¥{transaction.amount.toLocaleString()}
                    </Text>
                  </Group>
                </Card>
              ))}

            {/* 日別合計 */}
            <Divider />
            <Card withBorder p="sm" style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
              <Group justify="space-between">
                <Text fw={600}>この日の合計</Text>
                <Box style={{ textAlign: 'right' }}>
                  {(() => {
                    const dayTransactions = transactions.filter(t =>
                      dayTransactionsDate &&
                      t.date.getFullYear() === dayTransactionsDate.getFullYear() &&
                      t.date.getMonth() === dayTransactionsDate.getMonth() &&
                      t.date.getDate() === dayTransactionsDate.getDate()
                    );
                    const income = dayTransactions
                      .filter(t => t.type === 'income')
                      .reduce((sum, t) => sum + t.amount, 0);
                    const expense = dayTransactions
                      .filter(t => t.type === 'expense')
                      .reduce((sum, t) => sum + t.amount, 0);
                    const balance = income - expense;

                    return (
                      <Stack gap="xs" align="flex-end">
                        {income > 0 && (
                          <Text size="sm" c="green">
                            収入: +¥{income.toLocaleString()}
                          </Text>
                        )}
                        {expense > 0 && (
                          <Text size="sm" c="red">
                            支出: -¥{expense.toLocaleString()}
                          </Text>
                        )}
                        <Text fw={700} c={balance >= 0 ? 'green' : 'red'}>
                          収支: {balance >= 0 ? '+' : ''}¥{balance.toLocaleString()}
                        </Text>
                      </Stack>
                    );
                  })()}
                </Box>
              </Group>
            </Card>
          </Stack>
        )}
      </Modal>
    </Modal>
  );
};