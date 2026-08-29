'use client';

/**
 * 表示中の年月を URL クエリ `?month=YYYY-MM` から読み書きする
 *
 * 表示月は専用の state ではなく URL に持つ（AGENTS.md）。
 * これによりブラウザの戻るが効き、`/history?month=2025-03` のように直接開ける。
 *
 * useSearchParams を使うため、呼び出し側のページは <Suspense> で包む必要がある。
 */
import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  getCurrentMonth,
  getNextMonth,
  getPreviousMonthFromCurrent,
} from '@/utils/dateUtils';

export interface SelectedMonth {
  /** YYYY-MM */
  selectedMonth: string;
  selectedYear: number;
  setMonth: (month: string | null) => void;
  goPreviousMonth: () => void;
  goNextMonth: () => void;
}

export const useSelectedMonth = (): SelectedMonth => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedMonth = searchParams.get('month') || getCurrentMonth();
  const selectedYear = Number(selectedMonth.split('-')[0]);

  const setMonth = useCallback(
    (month: string | null) => {
      if (!month) return;
      const params = new URLSearchParams(searchParams);
      params.set('month', month);
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const goPreviousMonth = useCallback(
    () => setMonth(getPreviousMonthFromCurrent(selectedMonth)),
    [setMonth, selectedMonth]
  );

  const goNextMonth = useCallback(
    () => setMonth(getNextMonth(selectedMonth)),
    [setMonth, selectedMonth]
  );

  return { selectedMonth, selectedYear, setMonth, goPreviousMonth, goNextMonth };
};
