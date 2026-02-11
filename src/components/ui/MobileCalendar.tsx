'use client';

import { useState, useEffect, useMemo } from 'react';
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
  Drawer,
  ScrollArea,
  ThemeIcon,
  useMantineTheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconChevronLeft, IconChevronRight, IconX } from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs, { Dayjs } from 'dayjs';

interface MobileCalendarProps {
  opened: boolean;
  onClose: () => void;
  value: Date;
  onChange: (date: Date) => void;
  transactions?: Array<{
    id: string;
    date: Date;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    subcategory?: string;
    description?: string;
    paymentMethod?: string;
  }>;
  isSelector?: boolean;
}

export const MobileCalendar: React.FC<MobileCalendarProps> = ({
  opened,
  onClose,
  value,
  onChange,
  transactions = [],
  isSelector = false,
}) => {
  const theme = useMantineTheme();
  const [currentMonth, setCurrentMonth] = useState(() => dayjs(value));
  const [selectedDate, setSelectedDate] = useState(() => dayjs(value));
  const [drawerOpened, setDrawerOpened] = useState(false);

  // レスポンシブ対応
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isSmallScreen = useMediaQuery('(max-width: 380px)');

  // propsが変更された時にselectedDateを更新
  useEffect(() => {
    setSelectedDate(dayjs(value));
    setCurrentMonth(dayjs(value));
  }, [value]);

  const handleDateClick = (date: Dayjs) => {
    setSelectedDate(date);

    if (isSelector) {
      onChange(date.toDate());
    } else {
      setDrawerOpened(true);
    }
  };

  const handleMonthChange = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev =>
      direction === 'prev' ? prev.subtract(1, 'month') : prev.add(1, 'month')
    );
  };

  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

  // カレンダーの日付グリッド生成（42日固定）
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = currentMonth.startOf('month');
    const startDate = firstDayOfMonth.subtract(firstDayOfMonth.day(), 'day');

    return Array.from({ length: 42 }, (_, i) => startDate.add(i, 'day'));
  }, [currentMonth]);

  // 取引データをdayjsで事前インデックス化（パフォーマンス向上）
  const transactionsByDate = useMemo(() => {
    const map = new Map<string, typeof transactions>();
    transactions.forEach(t => {
      const key = dayjs(t.date).format('YYYY-MM-DD');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return map;
  }, [transactions]);

  const today = dayjs();

  const isToday = (date: Dayjs) => date.isSame(today, 'day');
  const isSelected = (date: Dayjs) => date.isSame(selectedDate, 'day');
  const isCurrentMonthDay = (date: Dayjs) => date.month() === currentMonth.month();

  // 日別の収支を計算
  const getDailyBalance = (date: Dayjs) => {
    const key = date.format('YYYY-MM-DD');
    const dayTransactions = transactionsByDate.get(key) || [];

    const income = dayTransactions
      .filter(t =>
        t.type === 'income' &&
        t.category !== '立替回収'
      )
      .reduce((sum, t) => sum + t.amount, 0);

    const expense = dayTransactions
      .filter(t =>
        t.type === 'expense' &&
        t.category !== '立替金' &&
        !(t.category === '固定費' && t.subcategory === '投資')
      )
      .reduce((sum, t) => sum + t.amount, 0);

    return { income, expense, balance: income - expense };
  };

  const { income: selectedIncome, expense: selectedExpense, balance: selectedBalance } = getDailyBalance(selectedDate);
  const selectedKey = selectedDate.format('YYYY-MM-DD');
  const selectedDayTransactions = transactionsByDate.get(selectedKey) || [];

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        withCloseButton={false}
        fullScreen={true}
        padding={0}
        transitionProps={{ duration: 200, transition: 'fade' }}
      >
        <Box style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--mantine-color-body)' }}>

          {/* Header */}
          <Box
            px="md"
            pt="md"
            pb="xs"
            style={{
              borderBottom: '1px solid var(--mantine-color-gray-2)',
              backgroundColor: 'var(--mantine-color-body)',
              zIndex: 10
            }}
          >
            <Group justify="space-between" align="center" mb="xs">
              <ActionIcon variant="subtle" color="gray" onClick={onClose} size="lg">
                <IconX />
              </ActionIcon>
              <Group gap={4}>
                <Text size="lg" fw={400} c="dimmed">{currentMonth.year()}年</Text>
                <Text size="xl" fw={700}>{currentMonth.format('M')}月</Text>
              </Group>
              <Group gap={0}>
                <ActionIcon variant="subtle" color="gray" onClick={() => handleMonthChange('prev')} size="lg">
                  <IconChevronLeft />
                </ActionIcon>
                <ActionIcon variant="subtle" color="gray" onClick={() => handleMonthChange('next')} size="lg">
                  <IconChevronRight />
                </ActionIcon>
              </Group>
            </Group>

            {/* Weekdays */}
            <SimpleGrid cols={7} spacing={0}>
              {weekdays.map((day, index) => (
                <Text
                  key={day}
                  ta="center"
                  size="xs"
                  fw={600}
                  c={index === 0 ? 'red.6' : index === 6 ? 'blue.6' : 'dimmed'}
                  style={{ textTransform: 'uppercase' }}
                >
                  {day}
                </Text>
              ))}
            </SimpleGrid>
          </Box>

          {/* Calendar Grid */}
          <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(e, info) => {
              if (info.offset.x > 50) handleMonthChange('prev');
              if (info.offset.x < -50) handleMonthChange('next');
            }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', touchAction: 'none' }}
          >
            {/* Grid with Google Calendar Style borders */}
            <SimpleGrid
              cols={7}
              spacing={0}
              h="100%"
              style={{
                borderTop: '1px solid var(--mantine-color-gray-2)',
                borderLeft: '1px solid var(--mantine-color-gray-2)' // Close the grid
              }}
            >
              {calendarDays.map((date, index) => {
                const todayFlag = isToday(date);
                const selected = isSelected(date);
                const inCurrentMonth = isCurrentMonthDay(date);
                const isSun = date.day() === 0;
                const isSat = date.day() === 6;
                const { income, expense, balance } = getDailyBalance(date);
                const hasIncome = income > 0;
                const hasExpense = expense > 0;
                const isFirstDay = date.date() === 1;

                return (
                  <Box
                    key={index}
                    onClick={() => handleDateClick(date)}
                    style={{
                      borderBottom: '1px solid var(--mantine-color-gray-2)',
                      borderRight: '1px solid var(--mantine-color-gray-2)',
                      // Selected state: Tinted background + Inner shadow border
                      backgroundColor: selected
                        ? 'rgba(33, 150, 243, 0.1)'
                        : (todayFlag ? 'rgba(33, 150, 243, 0.05)' : 'transparent'),
                      boxShadow: selected ? 'inset 0 0 0 2px var(--mantine-color-blue-5)' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-start', // Top aligned content
                      padding: '4px',
                      opacity: inCurrentMonth ? 1 : 0.3,
                      minHeight: '80px', // Taller per user preference
                    }}
                  >
                    {/* Date Number */}
                    <Box mt={2} mb={2}>
                      <Text
                        size="sm"
                        fw={todayFlag ? 700 : 500}
                        c={todayFlag ? 'blue.6' : isSun ? 'red.6' : isSat ? 'blue.6' : 'var(--mantine-color-text)'}
                        style={{
                          textAlign: 'center',
                          lineHeight: '1.2',
                        }}
                      >
                        {/* Display Month for 1st day (e.g. 4月 1日) */}
                        {isFirstDay ? `${date.month() + 1}月 ${date.date()}日` : date.date()}
                      </Text>
                    </Box>

                    {/* Dot Indicators & Balance */}
                    {(hasIncome || hasExpense) && (
                      <Stack gap={2} mt="auto" mb={2} align="center" w="100%">
                        {/* Dots */}
                        <Group gap={4} h={6}>
                          {hasIncome && (
                            <Box style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--mantine-color-teal-5)'
                            }} />
                          )}
                          {hasExpense && (
                            <Box style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--mantine-color-red-5)'
                            }} />
                          )}
                        </Group>

                        {/* Balance Text */}
                        <Text
                          size={isSmallScreen ? "8px" : "10px"} // Small but crisp
                          fw={600}
                          c={balance >= 0 ? 'teal.7' : 'red.7'}
                          style={{ lineHeight: 1 }}
                        >
                          {balance >= 0 ? '+' : '▲'}{Math.abs(balance) >= 10000 ? `${Math.round(Math.abs(balance) / 1000)}k` : Math.abs(balance).toLocaleString()}
                        </Text>
                      </Stack>
                    )}
                  </Box>
                );
              })}
            </SimpleGrid>
          </motion.div>
        </Box>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        opened={drawerOpened}
        onClose={() => setDrawerOpened(false)}
        position="bottom"
        size="60%"
        title={
          <Group gap="xs">
            <Text fw={700} size="xl" style={{ fontFamily: 'monospace' }}>
              {selectedDate.date()}
            </Text>
            <Text fw={600} size="lg" c="dimmed">
              {selectedDate.format('M月')} ({weekdays[selectedDate.day()]})
            </Text>
          </Group>
        }
        styles={{
          body: { padding: 0 },
          header: { borderBottom: '1px solid var(--mantine-color-gray-2)' }
        }}
      >
        <ScrollArea h="100%">
          <Box p="md">
            <Card withBorder p="md" mb="md" radius="md" bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-6))">
              <Group justify="space-between" align="center">
                <Stack gap={0} align="center" style={{ flex: 1 }}>
                  <Text size="xs" c="green.7" fw={600}>INCOME</Text>
                  <Text fw={700} size="lg" c="green.8">+{selectedIncome.toLocaleString()}</Text>
                </Stack>
                <Divider orientation="vertical" />
                <Stack gap={0} align="center" style={{ flex: 1 }}>
                  <Text size="xs" c="red.7" fw={600}>EXPENSE</Text>
                  <Text fw={700} size="lg" c="red.8">{selectedExpense > 0 ? '-' : ''}{selectedExpense.toLocaleString()}</Text>
                </Stack>
                <Divider orientation="vertical" />
                <Stack gap={0} align="center" style={{ flex: 1 }}>
                  <Text size="xs" c="dimmed" fw={600}>TOTAL</Text>
                  <Text fw={800} size="lg" c={selectedBalance >= 0 ? 'green.8' : 'red.8'}>
                    {selectedBalance >= 0 ? '+' : ''}{selectedBalance.toLocaleString()}
                  </Text>
                </Stack>
              </Group>
            </Card>

            {selectedDayTransactions.length > 0 ? (
              <Stack gap="sm">
                {selectedDayTransactions.map((t) => (
                  <Card key={t.id} withBorder p="sm" radius="md" shadow="sm">
                    <Group justify="space-between">
                      <Group gap="sm">
                        <ThemeIcon
                          color={t.type === 'income' ? 'green' : (t.category === '立替金' ? 'orange' : 'red')}
                          variant="light"
                          size="lg"
                          radius="xl"
                        >
                          {t.type === 'income' ? '+' : '-'}
                        </ThemeIcon>
                        <Box>
                          <Text size="sm" fw={600}>
                            {t.category}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {t.description || t.subcategory || t.paymentMethod || '詳細なし'}
                          </Text>
                        </Box>
                      </Group>
                      <Text fw={700} c={t.type === 'income' ? 'green.7' : 'red.7'}>
                        {t.type === 'income' ? '+' : '-'}¥{t.amount.toLocaleString()}
                      </Text>
                    </Group>
                  </Card>
                ))}
              </Stack>
            ) : (
              <Stack align="center" py="xl" gap="xs">
                <Text size="xl">🍃</Text>
                <Text c="dimmed" size="sm">取引はありません</Text>
              </Stack>
            )}
            <Box h={40} />
          </Box>
        </ScrollArea>
      </Drawer>
    </>
  );
};