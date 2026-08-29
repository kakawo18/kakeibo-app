'use client';

/**
 * カレンダー本体（月グリッド + 日別内訳ドロワー）
 *
 * モーダルを含まないので、ページに直接埋め込める。
 * フルスクリーンのモーダルとして使う場合は MobileCalendar が包む。
 */
import { useState, useEffect, useMemo } from 'react';
import {
  ActionIcon,
  Box,
  Card,
  Divider,
  Drawer,
  Group,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconChevronLeft, IconChevronRight, IconX } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import dayjs, { Dayjs } from 'dayjs';
import { Transaction } from '@/types';
import { useSettings } from '@/contexts/SettingsContext';

/** カレンダー表示に必要な取引フィールド */
export type CalendarTransaction = Pick<
  Transaction,
  'id' | 'date' | 'amount' | 'type' | 'category' | 'subcategory' | 'description' | 'paymentMethod'
>;

export interface CalendarViewProps {
  value: Date;
  onChange: (date: Date) => void;
  transactions?: CalendarTransaction[];
  /** true なら日付タップで即 onChange（取引フォームの日付選択用） */
  isSelector?: boolean;
  /** 月の見出しと前後ボタンを出すか。ページ側に月ナビがある場合は false */
  showHeader?: boolean;
  /** 指定すると見出し左に閉じるボタンを出す（モーダル用） */
  onClose?: () => void;
  /** グリッドを親の高さいっぱいに広げる（モーダル用） */
  fillHeight?: boolean;
  /** 表示月が変わったとき（前後ボタン・スワイプ）。ページ側で URL を更新する用 */
  onMonthChange?: (month: string) => void;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** 曜日ごとの文字色。日曜は支出色、土曜はアクセント色を流用する */
const weekdayColor = (day: number): string =>
  day === 0 ? 'var(--expense)' : day === 6 ? 'var(--accent)' : 'var(--ink-3)';

export const CalendarView: React.FC<CalendarViewProps> = ({
  value,
  onChange,
  transactions = [],
  isSelector = false,
  showHeader = true,
  onClose,
  fillHeight = false,
  onMonthChange,
}) => {
  const { rules } = useSettings();
  const [currentMonth, setCurrentMonth] = useState(() => dayjs(value));
  const [selectedDate, setSelectedDate] = useState(() => dayjs(value));
  const [drawerOpened, setDrawerOpened] = useState(false);
  const isSmallScreen = useMediaQuery('(max-width: 380px)');

  // 親から渡される日付が変わったら追従する
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
    const next =
      direction === 'prev' ? currentMonth.subtract(1, 'month') : currentMonth.add(1, 'month');
    setCurrentMonth(next);
    onMonthChange?.(next.format('YYYY-MM'));
  };

  // カレンダーの日付グリッド（42日固定）
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = currentMonth.startOf('month');
    const startDate = firstDayOfMonth.subtract(firstDayOfMonth.day(), 'day');
    return Array.from({ length: 42 }, (_, i) => startDate.add(i, 'day'));
  }, [currentMonth]);

  // 日付をキーに取引を事前インデックス化する（42マス分の線形探索を避ける）
  const transactionsByDate = useMemo(() => {
    const map = new Map<string, CalendarTransaction[]>();
    transactions.forEach((t) => {
      const key = dayjs(t.date).format('YYYY-MM-DD');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return map;
  }, [transactions]);

  const today = dayjs();

  // 日別の収支。投資と立替は日々の増減として見たくないので除く
  const getDailyBalance = (date: Dayjs) => {
    const dayTransactions = transactionsByDate.get(date.format('YYYY-MM-DD')) || [];
    const income = dayTransactions
      .filter((t) => t.type === 'income' && !rules.isAdvanceRepayment(t))
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = dayTransactions
      .filter((t) => t.type === 'expense' && !rules.isAdvancePayment(t) && !rules.isInvestment(t))
      .reduce((sum, t) => sum + t.amount, 0);
    return { income, expense, balance: income - expense };
  };

  const {
    income: selectedIncome,
    expense: selectedExpense,
    balance: selectedBalance,
  } = getDailyBalance(selectedDate);
  const selectedDayTransactions = transactionsByDate.get(selectedDate.format('YYYY-MM-DD')) || [];

  return (
    <>
      <Box
        style={
          fillHeight
            ? { height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--app-page)' }
            : undefined
        }
      >
        {/* 見出し + 曜日 */}
        <Box px={showHeader ? 'md' : 0} pt={showHeader ? 'md' : 0} pb="xs">
          {showHeader && (
            <Group justify="space-between" align="center" mb="xs">
              {onClose ? (
                <ActionIcon variant="subtle" color="gray" onClick={onClose} size="lg" aria-label="閉じる">
                  <IconX size={20} />
                </ActionIcon>
              ) : (
                <Box w={34} />
              )}
              <Group gap={4}>
                <Text size="lg" fw={400} c="dimmed">{currentMonth.year()}年</Text>
                <Text size="xl" fw={700}>{currentMonth.format('M')}月</Text>
              </Group>
              <Group gap={0}>
                <ActionIcon variant="subtle" color="gray" size="lg" onClick={() => handleMonthChange('prev')} aria-label="前の月へ">
                  <IconChevronLeft size={20} />
                </ActionIcon>
                <ActionIcon variant="subtle" color="gray" size="lg" onClick={() => handleMonthChange('next')} aria-label="次の月へ">
                  <IconChevronRight size={20} />
                </ActionIcon>
              </Group>
            </Group>
          )}

          <SimpleGrid cols={7} spacing={0}>
            {WEEKDAYS.map((day, index) => (
              <Text
                key={day}
                ta="center"
                size="xs"
                fw={600}
                pb={6}
                style={{ color: weekdayColor(index) }}
              >
                {day}
              </Text>
            ))}
          </SimpleGrid>
        </Box>

        {/* 日付グリッド。左右スワイプで月を移動する
            touchAction は pan-y。none にするとページの縦スクロールまで止まる */}
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          dragMomentum={false}
          onDragEnd={(event, info) => {
            if (info.offset.x > 50) handleMonthChange('prev');
            else if (info.offset.x < -50) handleMonthChange('next');
          }}
          style={
            fillHeight
              ? { flex: 1, display: 'flex', flexDirection: 'column', touchAction: 'pan-y' }
              : { touchAction: 'pan-y' }
          }
        >
          <SimpleGrid
            cols={7}
            spacing={0}
            h={fillHeight ? '100%' : undefined}
            style={{
              borderTop: '1px solid var(--hairline)',
              borderLeft: '1px solid var(--hairline)',
            }}
          >
            {calendarDays.map((date, index) => {
              const isToday = date.isSame(today, 'day');
              const isSelected = date.isSame(selectedDate, 'day');
              const inCurrentMonth = date.month() === currentMonth.month();
              const { income, expense, balance } = getDailyBalance(date);
              const hasEntries = income > 0 || expense > 0;

              return (
                <Box
                  key={index}
                  onClick={() => handleDateClick(date)}
                  style={{
                    borderBottom: '1px solid var(--hairline)',
                    borderRight: '1px solid var(--hairline)',
                    background: isSelected
                      ? 'var(--accent-soft)'
                      : isToday
                        ? 'color-mix(in srgb, var(--accent) 6%, transparent)'
                        : 'transparent',
                    boxShadow: isSelected ? 'inset 0 0 0 2px var(--accent)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    padding: 4,
                    opacity: inCurrentMonth ? 1 : 0.35,
                    minHeight: fillHeight ? 80 : 62,
                  }}
                >
                  <Text
                    size="sm"
                    fw={isToday ? 700 : 500}
                    my={2}
                    className="tabular-nums"
                    style={{
                      lineHeight: 1.2,
                      color: isToday ? 'var(--accent)' : weekdayColor(date.day()) === 'var(--ink-3)' ? 'var(--ink-1)' : weekdayColor(date.day()),
                    }}
                  >
                    {date.date() === 1 ? `${date.month() + 1}/${date.date()}` : date.date()}
                  </Text>

                  {hasEntries && (
                    <Stack gap={2} mt="auto" mb={2} align="center" w="100%">
                      <Group gap={4} h={6}>
                        {income > 0 && (
                          <Box w={6} h={6} style={{ borderRadius: '50%', background: 'var(--income)' }} />
                        )}
                        {expense > 0 && (
                          <Box w={6} h={6} style={{ borderRadius: '50%', background: 'var(--expense)' }} />
                        )}
                      </Group>
                      <Text
                        size={isSmallScreen ? '8px' : '10px'}
                        fw={600}
                        className="tabular-nums"
                        style={{
                          lineHeight: 1,
                          color: balance >= 0 ? 'var(--income)' : 'var(--expense)',
                        }}
                      >
                        {balance >= 0 ? '+' : '−'}
                        {Math.abs(balance) >= 10000
                          ? `${Math.round(Math.abs(balance) / 1000)}k`
                          : Math.abs(balance).toLocaleString()}
                      </Text>
                    </Stack>
                  )}
                </Box>
              );
            })}
          </SimpleGrid>
        </motion.div>
      </Box>

      {/* 日別の内訳 */}
      <Drawer
        opened={drawerOpened}
        onClose={() => setDrawerOpened(false)}
        position="bottom"
        size="60%"
        title={
          <Group gap="xs">
            <Text fw={700} size="xl" className="tabular-nums">{selectedDate.date()}</Text>
            <Text fw={600} size="lg" c="dimmed">
              {selectedDate.format('M月')}（{WEEKDAYS[selectedDate.day()]}）
            </Text>
          </Group>
        }
        styles={{ body: { padding: 0 }, header: { borderBottom: '1px solid var(--hairline)' } }}
      >
        <ScrollArea h="100%">
          <Box p="md">
            <Card
              p="md"
              mb="md"
              radius="md"
              style={{ background: 'var(--app-surface-2)', border: '1px solid var(--hairline)' }}
            >
              <Group justify="space-between" align="center">
                <Stack gap={0} align="center" style={{ flex: 1 }}>
                  <Text className="overline-label">収入</Text>
                  <Text fw={700} size="lg" className="tabular-nums" style={{ color: 'var(--income)' }}>
                    +¥{selectedIncome.toLocaleString()}
                  </Text>
                </Stack>
                <Divider orientation="vertical" />
                <Stack gap={0} align="center" style={{ flex: 1 }}>
                  <Text className="overline-label">支出</Text>
                  <Text fw={700} size="lg" className="tabular-nums" style={{ color: 'var(--expense)' }}>
                    −¥{selectedExpense.toLocaleString()}
                  </Text>
                </Stack>
                <Divider orientation="vertical" />
                <Stack gap={0} align="center" style={{ flex: 1 }}>
                  <Text className="overline-label">収支</Text>
                  <Text
                    fw={800}
                    size="lg"
                    className="tabular-nums"
                    style={{ color: selectedBalance >= 0 ? 'var(--income)' : 'var(--expense)' }}
                  >
                    {selectedBalance >= 0 ? '+' : '−'}¥{Math.abs(selectedBalance).toLocaleString()}
                  </Text>
                </Stack>
              </Group>
            </Card>

            {selectedDayTransactions.length > 0 ? (
              <Stack gap="sm">
                {selectedDayTransactions.map((t) => {
                  const color = t.type === 'income' ? 'var(--income)' : 'var(--expense)';
                  return (
                    <Card
                      key={t.id}
                      p="sm"
                      radius="md"
                      style={{ background: 'var(--app-surface)', border: '1px solid var(--hairline)' }}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                          <Box
                            w={8}
                            h={8}
                            style={{ borderRadius: '50%', background: color, flexShrink: 0 }}
                          />
                          <Box style={{ minWidth: 0 }}>
                            <Text size="sm" fw={600} truncate>
                              {t.subcategory || t.category}
                            </Text>
                            <Text size="xs" c="dimmed" truncate>
                              {t.description || t.paymentMethod || t.category}
                            </Text>
                          </Box>
                        </Group>
                        <Text fw={700} className="tabular-nums" style={{ color, whiteSpace: 'nowrap' }}>
                          {t.type === 'income' ? '+' : '−'}¥{t.amount.toLocaleString()}
                        </Text>
                      </Group>
                    </Card>
                  );
                })}
              </Stack>
            ) : (
              <Text ta="center" c="dimmed" py="xl" size="sm">
                この日の取引はありません
              </Text>
            )}
            <Box h={40} />
          </Box>
        </ScrollArea>
      </Drawer>
    </>
  );
};
