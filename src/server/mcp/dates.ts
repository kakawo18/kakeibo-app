/**
 * ツールの入力の日付・月（日本時間）
 *
 * Claude からは 'YYYY-MM-DD' と 'YYYY-MM' の文字列で受け取る。存在しない日付（2026-02-30 など）は
 * Date に直すと翌月へ繰り越されてしまうので、往復して同じ文字列に戻るかで確かめる。
 */
import { formatDate, getNextMonth } from '@/utils/dateUtils';
import { UserFacingError } from '../errors';

export const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** 'YYYY-MM-DD' をその日の0時（ローカル時刻）にする */
export const parseDay = (value: string, label: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (!DAY_PATTERN.test(value) || formatDate(date) !== value) {
    throw new UserFacingError(`${label} の日付 ${value} は存在しません（YYYY-MM-DD で指定してください）`);
  }
  return date;
};

/** 翌日の0時 */
export const nextDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

/** 'YYYY-MM' の1日の0時 */
export const monthStart = (month: string): Date => {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(year, monthNumber - 1, 1);
};

/** month の翌月の1日の0時（month の取引を読むときの before） */
export const nextMonthStart = (month: string): Date => monthStart(getNextMonth(month));

/** month から n か月前（n が負なら後）の 'YYYY-MM' */
export const shiftMonth = (month: string, n: number): string => {
  const start = monthStart(month);
  const shifted = new Date(start.getFullYear(), start.getMonth() - n, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
};

/** from から to までの日数（両端を含む）。どちらもその日の0時（日本時間。夏時間は無い） */
export const daysInclusive = (from: Date, to: Date): number =>
  Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;

/** 'YYYY-MM' 同士の月数の差（to − from） */
export const monthsBetween = (from: string, to: string): number => {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
};
