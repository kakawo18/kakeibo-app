'use client';

import { useState } from 'react';
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
} from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { motion } from 'framer-motion';

interface MobileCalendarProps {
  opened: boolean;
  onClose: () => void;
  value: Date;
  onChange: (date: Date) => void;
}

export const MobileCalendar: React.FC<MobileCalendarProps> = ({
  opened,
  onClose,
  value,
  onChange,
}) => {
  const [currentDate, setCurrentDate] = useState(value);
  const [selectedDate, setSelectedDate] = useState(value);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    onChange(date);
    onClose();
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
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date: Date) => {
    return date.toDateString() === selectedDate.toDateString();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const calendarDays = generateCalendarDays();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="日付を選択"
      size="full"
      fullScreen
      radius={0}
      styles={{
        body: {
          padding: '16px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        },
        content: {
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      >
        <Stack style={{ flex: 1 }}>
          {/* クイック選択ボタン */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Group gap="xs" style={{ marginBottom: '16px' }}>
              <Button
                variant="light"
                size="sm"
                onClick={() => handleQuickSelect(0)}
                style={{ flex: 1 }}
              >
                今日
              </Button>
              <Button
                variant="light"
                size="sm"
                onClick={() => handleQuickSelect(1)}
                style={{ flex: 1 }}
              >
                昨日
              </Button>
              <Button
                variant="light"
                size="sm"
                onClick={() => handleQuickSelect(2)}
                style={{ flex: 1 }}
              >
                一昨日
              </Button>
            </Group>
          </motion.div>

          {/* 年月選択 */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Group justify="space-between" style={{ marginBottom: '16px' }}>
              <ActionIcon
                variant="light"
                size="lg"
                onClick={() => handleMonthChange('prev')}
                style={{ minWidth: '44px', minHeight: '44px' }}
              >
                <IconChevronLeft size={20} />
              </ActionIcon>
              
              <Group gap="sm">
                <Select
                  data={generateYearOptions()}
                  value={currentDate.getFullYear().toString()}
                  onChange={handleYearChange}
                  size="sm"
                  style={{ width: '80px' }}
                />
                <Text size="lg" fw={600}>
                  {monthNames[currentDate.getMonth()]}
                </Text>
              </Group>
              
              <ActionIcon
                variant="light"
                size="lg"
                onClick={() => handleMonthChange('next')}
                style={{ minWidth: '44px', minHeight: '44px' }}
              >
                <IconChevronRight size={20} />
              </ActionIcon>
            </Group>
          </motion.div>

          {/* カスタムカレンダー */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            style={{ flex: 1 }}
          >
            <Box style={{ padding: '8px 0' }}>
              {/* 曜日ヘッダー */}
              <SimpleGrid cols={7} spacing="xs" style={{ marginBottom: '8px' }}>
                {weekdays.map((day, index) => (
                  <Box
                    key={day}
                    style={{
                      textAlign: 'center',
                      padding: '8px 4px',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: index === 0 || index === 6 ? 'var(--mantine-color-red-6)' : 'var(--mantine-color-gray-6)',
                    }}
                  >
                    {day}
                  </Box>
                ))}
              </SimpleGrid>

              {/* カレンダーグリッド */}
              <SimpleGrid cols={7} spacing="xs">
                {calendarDays.map((date, index) => {
                  const today = isToday(date);
                  const selected = isSelected(date);
                  const currentMonth = isCurrentMonth(date);
                  const weekend = isWeekend(date);

                  return (
                    <Button
                      key={index}
                      variant={selected ? 'filled' : 'subtle'}
                      color={selected ? 'blue' : 'gray'}
                      onClick={() => handleDateSelect(date)}
                      style={{
                        height: '48px',
                        fontSize: '16px',
                        fontWeight: selected ? 700 : 500,
                        borderRadius: '8px',
                        border: today ? '2px solid var(--mantine-color-blue-5)' : 'none',
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
                        transform: selected ? 'scale(1.05)' : 'scale(1)',
                        transition: 'all 0.2s ease',
                        opacity: currentMonth ? 1 : 0.6,
                      }}
                    >
                      {date.getDate()}
                    </Button>
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
          >
            <Box
              style={{
                backgroundColor: 'var(--mantine-color-blue-0)',
                padding: '12px',
                borderRadius: '8px',
                marginTop: '16px',
              }}
            >
              <Text size="sm" c="dimmed">選択した日付</Text>
              <Text size="lg" fw={600} c="blue">
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
      </motion.div>
    </Modal>
  );
};