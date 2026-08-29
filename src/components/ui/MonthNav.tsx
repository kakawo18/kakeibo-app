'use client';

/**
 * 月ナビゲーション（‹ 2026年08月 ›）
 *
 * ホームと履歴で共用する。表示月は URL クエリに持つので、このコンポーネントは
 * useSelectedMonth を直接使い、親から値を受け取らない。
 *
 * スワイプでの月移動はここには持たない。ページ全体を包む MonthSwipeArea が担当する。
 * 両方に持たせると、この上でスワイプしたときに月が2つ進む。
 */
import { ActionIcon, Group, Select } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useMemo } from 'react';
import { getMonthOptions } from '@/utils/dateUtils';
import { useSelectedMonth } from '@/hooks/useSelectedMonth';

export const MonthNav = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { selectedMonth, setMonth, goPreviousMonth, goNextMonth } = useSelectedMonth();
  const monthOptions = useMemo(() => getMonthOptions(), []);

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
        size={isMobile ? 'md' : 'lg'}
        onClick={goPreviousMonth}
        aria-label="前の月へ"
      >
        <IconChevronLeft size={isMobile ? 18 : 20} />
      </ActionIcon>

      {monthSelector}

      <ActionIcon
        variant="subtle"
        color="gray"
        size={isMobile ? 'md' : 'lg'}
        onClick={goNextMonth}
        aria-label="次の月へ"
      >
        <IconChevronRight size={isMobile ? 18 : 20} />
      </ActionIcon>
    </Group>
  );
};
