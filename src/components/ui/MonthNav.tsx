'use client';

/**
 * 月ナビゲーション（‹ 2026年08月 ›）
 *
 * ホームと履歴で共用する。表示月は URL クエリに持つので、このコンポーネントは
 * useSelectedMonth を直接使い、親から値を受け取らない。
 *
 * スワイプでの月移動はここには持たない。ページ全体を包む SwipeArea が担当する。
 * 両方に持たせると、この上でスワイプしたときに月が2つ進む。
 */
import { ActionIcon, Group, Select } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useMemo } from 'react';
import dayjs from 'dayjs';
import { formatMonthLocal, getCurrentMonth, monthOptionsBetween } from '@/utils/dateUtils';
import { useSelectedMonth } from '@/hooks/useSelectedMonth';
import { useTransactions } from '@/contexts/TransactionsContext';

/** 取引が無くても選べる範囲（今月から前後） */
const DEFAULT_YEARS_BACK = 2;
const DEFAULT_YEARS_FORWARD = 1;

export const MonthNav = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { selectedMonth, setMonth, goPreviousMonth, goNextMonth } = useSelectedMonth();
  const { transactions } = useTransactions();

  // 選択肢は「今月の前後」に加えて、記録のある最古〜最新の月と表示中の月を必ず含める。
  // 固定の範囲だと、矢印で範囲外の月へ進んだときに年月が表示されなくなり、
  // 古い取引をプルダウンから選べなかった（#116）
  const monthOptions = useMemo(() => {
    const current = getCurrentMonth();
    let from = dayjs(current).subtract(DEFAULT_YEARS_BACK, 'year').format('YYYY-MM');
    let to = dayjs(current).add(DEFAULT_YEARS_FORWARD, 'year').format('YYYY-MM');
    for (const month of [selectedMonth, ...transactions.map((t) => formatMonthLocal(t.date))]) {
      if (month < from) from = month;
      if (month > to) to = month;
    }
    return monthOptionsBetween(from, to);
  }, [transactions, selectedMonth]);

  const monthSelector = (
    <Select
      data={monthOptions}
      value={selectedMonth}
      onChange={setMonth}
      searchable={!isMobile}
      w={isMobile ? 132 : 160}
      size={isMobile ? 'sm' : 'md'}
      variant="unstyled"
      aria-label="表示する年月"
      styles={{
        input: {
          fontSize: isMobile ? '16px' : '19px',
          fontWeight: 700,
          textAlign: 'center',
          letterSpacing: '-0.02em',
          cursor: 'pointer',
        },
        dropdown: { maxHeight: '60vh' },
        option: { fontSize: '14px', padding: '10px' },
      }}
    />
  );

  return (
    <Group gap={isMobile ? 0 : 2} wrap="nowrap" justify="center">
      <ActionIcon
        variant="subtle"
        color="gray"
        // スマホは指で押すので高さ 44px を確保する（#111）。幅は、履歴タブで表示の切り替えと
        // 1行に並べても年月が欠けず、375px 幅でも折り返さない 34px にとどめる
        size={isMobile ? 44 : 40}
        style={isMobile ? { width: 34, minWidth: 34 } : undefined}
        onClick={goPreviousMonth}
        aria-label="前の月へ"
      >
        <IconChevronLeft size={isMobile ? 18 : 20} />
      </ActionIcon>

      {monthSelector}

      <ActionIcon
        variant="subtle"
        color="gray"
        // スマホは指で押すので高さ 44px を確保する（#111）。幅は、履歴タブで表示の切り替えと
        // 1行に並べても年月が欠けず、375px 幅でも折り返さない 34px にとどめる
        size={isMobile ? 44 : 40}
        style={isMobile ? { width: 34, minWidth: 34 } : undefined}
        onClick={goNextMonth}
        aria-label="次の月へ"
      >
        <IconChevronRight size={isMobile ? 18 : 20} />
      </ActionIcon>
    </Group>
  );
};
