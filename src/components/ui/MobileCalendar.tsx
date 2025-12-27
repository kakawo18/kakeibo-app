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
  Drawer,
  ScrollArea,
  ThemeIcon,
  useMantineTheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconChevronLeft, IconChevronRight, IconX } from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [currentDate, setCurrentDate] = useState(value);
  const [selectedDate, setSelectedDate] = useState(value);
  const [drawerOpened, setDrawerOpened] = useState(false);

  // レスポンシブ対応
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isSmallScreen = useMediaQuery('(max-width: 380px)');

  // propsが変更された時にselectedDateを更新
  useEffect(() => {
    setSelectedDate(value);
    setCurrentDate(value);
  }, [value]);

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);

    if (isSelector) {
      onChange(date);
    } else {
      setDrawerOpened(true);
    }
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

  const monthNames = [
    '1月', '2月', '3月', '4月', '5月', '6月',
    '7月', '8月', '9月', '10月', '11月', '12月'
  ];

  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);

    startDate.setDate(firstDay.getDate() - firstDay.getDay());

    const days = [];
    const currentDateLoop = new Date(startDate);

    // 42日固定
    for (let i = 0; i < 42; i++) {
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

  // 日別の収支を計算
  const getDailyBalance = (date: Date) => {
    const dayTransactions = transactions.filter(t =>
      t.date.getFullYear() === date.getFullYear() &&
      t.date.getMonth() === date.getMonth() &&
      t.date.getDate() === date.getDate()
    );

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

  const calendarDays = generateCalendarDays();
  const { income: selectedIncome, expense: selectedExpense, balance: selectedBalance } = getDailyBalance(selectedDate);
  const selectedDayTransactions = transactions.filter(t =>
    t.date.getFullYear() === selectedDate.getFullYear() &&
    t.date.getMonth() === selectedDate.getMonth() &&
    t.date.getDate() === selectedDate.getDate()
  );

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
                <Text size="lg" fw={400} c="dimmed">{currentDate.getFullYear()}年</Text>
                <Text size="xl" fw={700}>{monthNames[currentDate.getMonth()]}</Text>
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
                const today = isToday(date);
                const selected = isSelected(date);
                const currentMonth = isCurrentMonth(date);
                const isSun = date.getDay() === 0;
                const isSat = date.getDay() === 6;
                const { income, expense, balance } = getDailyBalance(date);
                const hasIncome = income > 0;
                const hasExpense = expense > 0;
                const isFirstDay = date.getDate() === 1;

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
                        : (today ? 'rgba(33, 150, 243, 0.05)' : 'transparent'),
                      boxShadow: selected ? 'inset 0 0 0 2px var(--mantine-color-blue-5)' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-start', // Top aligned content
                      padding: '4px',
                      opacity: currentMonth ? 1 : 0.3,
                      minHeight: '80px', // Taller per user preference
                    }}
                  >
                    {/* Date Number */}
                    <Box mt={2} mb={2}>
                      <Text
                        size="sm"
                        fw={today ? 700 : 500}
                        c={today ? 'blue.6' : isSun ? 'red.6' : isSat ? 'blue.6' : 'var(--mantine-color-text)'}
                        style={{
                          textAlign: 'center',
                          lineHeight: '1.2',
                        }}
                      >
                        {/* Display Month for 1st day (e.g. 4月 1日) */}
                        {isFirstDay ? `${date.getMonth() + 1}月 ${date.getDate()}日` : date.getDate()}
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

      {/* Detail Drawer - Unchanged */}
      <Drawer
        opened={drawerOpened}
        onClose={() => setDrawerOpened(false)}
        position="bottom"
        size="60%"
        title={
          <Group gap="xs">
            <Text fw={700} size="xl" style={{ fontFamily: 'monospace' }}>
              {selectedDate.getDate()}
            </Text>
            <Text fw={600} size="lg" c="dimmed">
              {selectedDate.toLocaleString('ja-JP', { month: 'long', weekday: 'short' })}
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
            <Card withBorder p="md" mb="md" radius="md" bg="var(--mantine-color-gray-0)">
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