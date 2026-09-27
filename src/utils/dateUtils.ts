import dayjs from 'dayjs';

/** YYYY-MM-DD 形式にフォーマット（CSVエクスポート等） */
export const formatDate = (date: Date | string): string => {
  return dayjs(date).format('YYYY-MM-DD');
};

/** 現在の月を YYYY-MM 形式で返す */
export const getCurrentMonth = (): string => {
  return dayjs().format('YYYY-MM');
};

/** YYYY-MM 形式を「YYYY年MM月」表記に変換 */
export const getMonthName = (monthString: string): string => {
  return dayjs(monthString).format('YYYY年MM月');
};

/** 「2026年7月3日(金)」形式にフォーマット（フォームの日付表示用） */
export const formatDateJa = (date: Date): string => {
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
};

/** YYYY-MM 形式の翌月を返す */
export const getNextMonth = (month: string): string => {
  return dayjs(month).add(1, 'month').format('YYYY-MM');
};

/** YYYY-MM 形式の前月を返す */
export const getPreviousMonthFromCurrent = (month: string): string => {
  return dayjs(month).subtract(1, 'month').format('YYYY-MM');
};

/** ローカルタイムゾーンで YYYY-MM 形式にフォーマット */
export const formatMonthLocal = (date: Date): string => {
  return dayjs(date).format('YYYY-MM');
};

/** from〜to（YYYY-MM、両端を含む）の月を順に返す。from が to より後なら空 */
export const monthRange = (from: string, to: string): string[] => {
  const months: string[] = [];
  for (let month = from; month <= to; month = getNextMonth(month)) {
    months.push(month);
  }
  return months;
};

/** 受け付ける年の範囲（CSV の日付と同じ） */
const MIN_YEAR = 1970;
const MAX_YEAR = 2100;

/**
 * URL クエリの month を検証する（#116）
 *
 * YYYY-MM で実在する月（01〜12）のときだけ返し、それ以外は null。
 * 不正な値をそのまま使うと、年月表示が Invalid Date / NaN になり、
 * 前後の月への移動でも不正な値が続いてしまう。
 */
export const parseMonthParam = (value: string | null | undefined): string | null => {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  return year >= MIN_YEAR && year <= MAX_YEAR ? value : null;
};

/** from〜to（YYYY-MM）の月を、月選択の選択肢にする */
export const monthOptionsBetween = (
  from: string,
  to: string
): { value: string; label: string }[] =>
  monthRange(from, to).map((month) => ({ value: month, label: getMonthName(month) }));
